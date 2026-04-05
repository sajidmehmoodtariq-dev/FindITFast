import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Item, ItemStatusEvent } from '../types';

const RATE_LIMIT_HOURS = 6;
const MS_PER_HOUR = 60 * 60 * 1000;

export interface StockConfirmationResult {
    type: 'GREEN' | 'YELLOW' | 'RED';
    lastConfirmedAt: Timestamp;
    weeklyGreenCount: number;
    weeklyYellowCount: number;
    recentRedCount24h: number;
    statusOverride: 'OUT_OF_STOCK' | null;
    todayConfirmationCount: number | null;
}

export interface LiveConfirmationSummary {
    lastConfirmedAt: Timestamp | null;
    weeklyGreenCount: number;
    weeklyYellowCount: number;
    recentRedCount24h: number;
    statusOverride: 'OUT_OF_STOCK' | null;
}

export const stockConfirmationService = {
    /**
     * Submits a user stock confirmation and updates the Item trust score fields
     */
    async submitConfirmation(
        itemId: string,
        storeId: string,
        userId: string,
        type: 'GREEN' | 'YELLOW' | 'RED'
    ): Promise<StockConfirmationResult> {
        // 1. Check rate limit
        const sixHoursAgo = new Date(Date.now() - RATE_LIMIT_HOURS * MS_PER_HOUR);
        const eventsRef = collection(db, 'itemStatusEvents');
        const q = query(
            eventsRef,
            where('itemId', '==', itemId),
            where('userId', '==', userId),
            where('createdAt', '>=', Timestamp.fromDate(sixHoursAgo))
        );

        const recentEvents = await getDocs(q);
        if (!recentEvents.empty) {
            throw new Error(`You have already confirmed this item's status recently. Please wait ${RATE_LIMIT_HOURS} hours.`);
        }

        // 2. Write new event
        const newEvent: ItemStatusEvent = {
            itemId,
            userId,
            type,
            storeId,
            createdAt: Timestamp.now()
        };
        await addDoc(eventsRef, newEvent);

        // 3. Update the parent Item document
        const itemRef = doc(db, 'items', itemId);
        const itemSnap = await getDoc(itemRef);

        if (!itemSnap.exists()) {
            throw new Error('Item not found');
        }

        const item = itemSnap.data() as Item;

        // Default zero values if fields don't exist yet
        let weeklyGreenCount = item.weeklyGreenCount || 0;
        let weeklyYellowCount = item.weeklyYellowCount || 0;
        let recentRedCount24h = item.recentRedCount24h || 0;
        let statusOverride = item.statusOverride || null;

        if (type === 'GREEN') {
            weeklyGreenCount += 1;
            statusOverride = null;
            recentRedCount24h = 0;
        } else if (type === 'YELLOW') {
            weeklyYellowCount += 1;
        } else if (type === 'RED') {
            recentRedCount24h += 1;
            if (recentRedCount24h >= 2) {
                statusOverride = 'OUT_OF_STOCK';
            }
        }

        const nowTimestamp = Timestamp.now();

        await updateDoc(itemRef, {
            lastConfirmedAt: nowTimestamp,
            weeklyGreenCount,
            weeklyYellowCount,
            recentRedCount24h,
            statusOverride,
            updatedAt: nowTimestamp
        });

        // Keep this optional signal index-safe by using a single-field query
        // and filtering by date in memory.
        let todayConfirmationCount: number | null = null;
        try {
            const itemEventsQuery = query(eventsRef, where('itemId', '==', itemId));
            const itemEvents = await getDocs(itemEventsQuery);
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            todayConfirmationCount = itemEvents.docs.reduce((count, eventDoc) => {
                const createdAt = eventDoc.data().createdAt as Timestamp | undefined;
                if (!createdAt) return count;
                return createdAt.toDate() >= startOfDay ? count + 1 : count;
            }, 0);
        } catch (error) {
            console.warn('Unable to fetch today confirmation count:', error);
        }

        return {
            type,
            lastConfirmedAt: nowTimestamp,
            weeklyGreenCount,
            weeklyYellowCount,
            recentRedCount24h,
            statusOverride,
            todayConfirmationCount
        };
    },

    /**
     * Rebuilds the live trust summary from confirmation events.
     * This keeps item details, search cards, and analytics aligned.
     */
    async getLiveConfirmationSummary(itemId: string, fallbackItem?: Item): Promise<LiveConfirmationSummary> {
        try {
            const eventsRef = collection(db, 'itemStatusEvents');
            const eventsQuery = query(eventsRef, where('itemId', '==', itemId));
            const snapshot = await getDocs(eventsQuery);

            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            let lastConfirmedAt: Timestamp | null = null;
            let weeklyGreenCount = 0;
            let weeklyYellowCount = 0;
            let recentRedCount24h = 0;

            snapshot.forEach((eventDoc) => {
                const event = eventDoc.data() as ItemStatusEvent & { createdAt?: Timestamp };
                const createdAt = event.createdAt;

                if (createdAt && (!lastConfirmedAt || createdAt.toMillis() > lastConfirmedAt.toMillis())) {
                    lastConfirmedAt = createdAt;
                }

                if (!createdAt) return;

                const eventDate = createdAt.toDate();
                if (eventDate >= sevenDaysAgo) {
                    if (event.type === 'GREEN') weeklyGreenCount += 1;
                    if (event.type === 'YELLOW') weeklyYellowCount += 1;
                }

                if (event.type === 'RED' && eventDate >= twentyFourHoursAgo) {
                    recentRedCount24h += 1;
                }
            });

            const statusOverride = recentRedCount24h >= 2 ? 'OUT_OF_STOCK' : null;

            if (lastConfirmedAt || weeklyGreenCount > 0 || weeklyYellowCount > 0 || recentRedCount24h > 0) {
                return {
                    lastConfirmedAt,
                    weeklyGreenCount,
                    weeklyYellowCount,
                    recentRedCount24h,
                    statusOverride
                };
            }
        } catch (error) {
            console.warn('Unable to load live confirmation summary:', error);
        }

        return {
            lastConfirmedAt: fallbackItem?.lastConfirmedAt ?? null,
            weeklyGreenCount: fallbackItem?.weeklyGreenCount ?? 0,
            weeklyYellowCount: fallbackItem?.weeklyYellowCount ?? 0,
            recentRedCount24h: fallbackItem?.recentRedCount24h ?? 0,
            statusOverride: fallbackItem?.statusOverride ?? null
        };
    },

    /**
     * Computes the time-decay trust score for an item
     */
    computeTrustScore(item: Item): number {
        let score = 50;

        if (!item.lastConfirmedAt) {
            score = 10;
        } else {
            const now = new Date();
            const lastConfirmed = item.lastConfirmedAt.toDate();
            const diffSeconds = (now.getTime() - lastConfirmed.getTime()) / 1000;
            const days = Math.floor(diffSeconds / 86400);

            if (days <= 7) {
                // no decay
            } else if (days >= 8 && days <= 30) {
                score -= 1 * (days - 7);
            } else if (days >= 31 && days <= 60) {
                score -= 23 + 2 * (days - 30);
            } else if (days >= 61 && days <= 90) {
                score -= 83 + 3 * (days - 60);
            } else if (days > 90) {
                score = 10; // floor value
            }

            if ((item.weeklyGreenCount || 0) > 0) score += 25;
            if ((item.weeklyYellowCount || 0) > 0) score += 10;
            if ((item.recentRedCount24h || 0) >= 1) score -= 30;
        }

        // Clamp between 0 and 100
        return Math.max(0, Math.min(100, score));
    },

    /**
     * Returns UI state for the trust badge
     */
    getBadgeState(item: Item, summary?: LiveConfirmationSummary) {
        const source = summary ?? {
            lastConfirmedAt: item.lastConfirmedAt,
            weeklyGreenCount: item.weeklyGreenCount,
            weeklyYellowCount: item.weeklyYellowCount,
            recentRedCount24h: item.recentRedCount24h,
            statusOverride: item.statusOverride
        };

        const score = this.computeTrustScore({
            ...item,
            lastConfirmedAt: source.lastConfirmedAt,
            weeklyGreenCount: source.weeklyGreenCount,
            weeklyYellowCount: source.weeklyYellowCount,
            recentRedCount24h: source.recentRedCount24h,
            statusOverride: source.statusOverride
        });
        let color = '';
        let label = '';

        if (source.statusOverride === 'OUT_OF_STOCK') {
            color = '🔴';
            label = 'Out of Stock';
        } else if (score >= 80) {
            color = '🟢';
            label = 'In Stock';
        } else if (score >= 50) {
            color = '🟡';
            label = 'Likely In Stock';
        } else if (score >= 20) {
            color = '🟠';
            label = 'Stock Uncertain';
        } else {
            color = '⚪';
            label = 'Not Recently Confirmed';
        }

        const weeklyTotal = (source.weeklyGreenCount || 0) + (source.weeklyYellowCount || 0);

        let sublabelA = 'No confirmations yet';
        if (source.statusOverride === 'OUT_OF_STOCK') {
            sublabelA = 'Reported unavailable today';
        } else if (source.lastConfirmedAt) {
            const millisSinceConfirmation = Date.now() - source.lastConfirmedAt.toMillis();
            if (millisSinceConfirmation <= 120000) {
                sublabelA = 'Just confirmed';
            } else {
                const days = Math.floor(millisSinceConfirmation / 86400000);
                sublabelA = `Last confirmed ${days === 0 ? 'today' : days === 1 ? '1 day ago' : days + ' days ago'}`;
            }
        }

        let sublabelB = '';
        const hasRecentConfirmation = !!source.lastConfirmedAt && (Date.now() - source.lastConfirmedAt.toMillis()) <= 7 * 86400000;
        if (weeklyTotal > 0 && hasRecentConfirmation) {
            sublabelB = `Confirmed by ${weeklyTotal} shopper${weeklyTotal === 1 ? '' : 's'} this week`;
        }

        let warning = '';
        if ((source.recentRedCount24h || 0) === 1 && source.statusOverride !== 'OUT_OF_STOCK') {
            warning = '1 recent out-of-stock report';
        }

        return { color, label, sublabelA, sublabelB, warning };
    }
};
