import React, { useState, useEffect } from 'react';
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Item } from '../types';
import { stockConfirmationService, type StockConfirmationResult } from '../services/stockConfirmationService';

interface StockConfirmationButtonsProps {
    item: Item;
    userId: string | null;
    variant?: 'default' | 'map';
    title?: string;
    onConfirmed?: (result: StockConfirmationResult) => void;
}

export const StockConfirmationButtons: React.FC<StockConfirmationButtonsProps> = ({
    item,
    userId,
    variant = 'default',
    title = 'Update Stock Status',
    onConfirmed
}) => {
    const [isDisabled, setIsDisabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [reinforcementMessage, setReinforcementMessage] = useState<string | null>(null);
    const [todayCountMessage, setTodayCountMessage] = useState<string | null>(null);
    const [localStatusLabel, setLocalStatusLabel] = useState<string | null>(null);

    useEffect(() => {
        const checkRateLimit = async () => {
            if (!userId) return;

            try {
                const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const eventsRef = collection(db, 'itemStatusEvents');
                // Single-field query only — compound queries hang with offline persistence
                const q = query(eventsRef, where('itemId', '==', item.id));

                const snapshot = await getDocs(q);
                const hasRecent = snapshot.docs.some((d) => {
                    const data = d.data();
                    const createdAt = data.createdAt as Timestamp | undefined;
                    return data.userId === userId && createdAt ? createdAt.toDate() >= sixHoursAgo : false;
                });
                if (hasRecent) {
                    setIsDisabled(true);
                }
            } catch (error) {
                console.error("Error checking rate limit:", error);
            }
        };

        checkRateLimit();
    }, [item.id, userId]);

    const handleConfirm = async (type: 'GREEN' | 'YELLOW' | 'RED') => {
        if (!userId) {
            setToastMessage("User ID required to submit status.");
            setTimeout(() => setToastMessage(null), 3000);
            return;
        }

        setIsLoading(true);
        try {
            const result = await stockConfirmationService.submitConfirmation(item.id, item.storeId, userId, type);
            setToastMessage('Thanks - stock updated');
            setReinforcementMessage('You just helped other shoppers');
            const statusLabel = result.type === 'GREEN'
                ? 'In Stock'
                : result.type === 'YELLOW'
                    ? 'Low Stock'
                    : 'Out of Stock';
            setLocalStatusLabel(statusLabel);
            if (result.todayConfirmationCount && result.todayConfirmationCount > 0) {
                setTodayCountMessage(
                    `${result.todayConfirmationCount} shopper${result.todayConfirmationCount === 1 ? '' : 's'} confirmed this today`
                );
            }
            onConfirmed?.(result);
            setIsDisabled(true);
        } catch (error: any) {
            setToastMessage(error.message || "Failed to submit status.");
        } finally {
            setIsLoading(false);
            setTimeout(() => setToastMessage(null), 3000);
            setTimeout(() => setReinforcementMessage(null), 5000);
            setTimeout(() => setTodayCountMessage(null), 5000);
        }
    };

    const yellowLabel = variant === 'map'
        ? 'Few'
        : 'Low Stock – Only a Few Left';

    const redLabel = variant === 'map'
        ? 'None'
        : 'Out of Stock – Not Available';

    const greenLabel = variant === 'map'
        ? 'Found'
        : 'In Stock – I Found It';

    const showStatusSummary = variant !== 'map';

    return (
        <div className="flex flex-col gap-2 relative">
            {title && <p className="text-sm font-semibold text-gray-700">{title}</p>}
            <div className={variant === 'map' ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-1 sm:grid-cols-3 gap-2'}>
                <button
                    onClick={() => handleConfirm('GREEN')}
                    disabled={isDisabled || isLoading}
                    className={`flex items-center justify-center gap-2 border rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variant === 'map' ? 'px-3 py-3 bg-green-100 text-green-800 border-green-200 text-[0.82rem] leading-tight' : 'px-3 py-2 bg-green-50 text-green-700 border-green-200 text-sm hover:bg-green-100'}`}
                >
                    <span>🟢</span> {greenLabel}
                </button>
                <button
                    onClick={() => handleConfirm('YELLOW')}
                    disabled={isDisabled || isLoading}
                    className={`flex items-center justify-center gap-2 border rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variant === 'map' ? 'px-3 py-3 bg-amber-100 text-amber-800 border-amber-200 text-[0.82rem] leading-tight' : 'px-3 py-2 bg-yellow-50 text-yellow-700 border-yellow-200 text-sm hover:bg-yellow-100'}`}
                >
                    <span>🟡</span> {yellowLabel}
                </button>
                <button
                    onClick={() => handleConfirm('RED')}
                    disabled={isDisabled || isLoading}
                    className={`flex items-center justify-center gap-2 border rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variant === 'map' ? 'px-3 py-3 bg-red-100 text-red-800 border-red-200 text-[0.82rem] leading-tight' : 'px-3 py-2 bg-red-50 text-red-700 border-red-200 text-sm hover:bg-red-100'}`}
                >
                    <span>🔴</span> {redLabel}
                </button>
            </div>

            {showStatusSummary && (reinforcementMessage || todayCountMessage) && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    {localStatusLabel && <p className="font-semibold">Status now: {localStatusLabel}</p>}
                    {localStatusLabel && <p className="text-green-700">Just confirmed</p>}
                    {reinforcementMessage && <p className="font-medium">{reinforcementMessage}</p>}
                    {todayCountMessage && <p className="text-green-700">{todayCountMessage}</p>}
                </div>
            )}

            {toastMessage && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm p-3 bg-gray-900 text-white text-sm text-center rounded-lg animate-fade-in z-[70] shadow-xl pointer-events-none">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};
