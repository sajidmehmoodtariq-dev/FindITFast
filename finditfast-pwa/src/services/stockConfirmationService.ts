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
    getBadgeState(item: Item) {
        const score = this.computeTrustScore(item);
        let color = '';
        let label = '';

        if (item.statusOverride === 'OUT_OF_STOCK') {
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

        const weeklyTotal = (item.weeklyGreenCount || 0) + (item.weeklyYellowCount || 0);

        let sublabelA = 'No confirmations yet';
        if (item.statusOverride === 'OUT_OF_STOCK') {
            sublabelA = 'Reported unavailable today';
        } else if (item.lastConfirmedAt) {
            const millisSinceConfirmation = Date.now() - item.lastConfirmedAt.toMillis();
            if (millisSinceConfirmation <= 120000) {
                sublabelA = 'Just confirmed';
            } else {
                const days = Math.floor(millisSinceConfirmation / 86400000);
                sublabelA = `Last confirmed ${days === 0 ? 'today' : days === 1 ? '1 day ago' : days + ' days ago'}`;
            }
        }

        let sublabelB = '';
        const hasRecentConfirmation = !!item.lastConfirmedAt && (Date.now() - item.lastConfirmedAt.toMillis()) <= 7 * 86400000;
        if (weeklyTotal > 0 && hasRecentConfirmation) {
            sublabelB = `Confirmed by ${weeklyTotal} shopper${weeklyTotal === 1 ? '' : 's'} this week`;
        }

        let warning = '';
        if ((item.recentRedCount24h || 0) === 1 && item.statusOverride !== 'OUT_OF_STOCK') {
            warning = '1 recent out-of-stock report';
        }

        return { color, label, sublabelA, sublabelB, warning };
    }
};
