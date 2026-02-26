import React, { useState, useEffect } from 'react';
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Item } from '../types';
import { stockConfirmationService } from '../services/stockConfirmationService';

interface StockConfirmationButtonsProps {
    item: Item;
    userId: string | null;
}

export const StockConfirmationButtons: React.FC<StockConfirmationButtonsProps> = ({ item, userId }) => {
    const [isDisabled, setIsDisabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        const checkRateLimit = async () => {
            if (!userId) return;

            try {
                const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const eventsRef = collection(db, 'itemStatusEvents');
                const q = query(
                    eventsRef,
                    where('itemId', '==', item.id),
                    where('userId', '==', userId),
                    where('createdAt', '>=', Timestamp.fromDate(sixHoursAgo))
                );

                const recentEvents = await getDocs(q);
                if (!recentEvents.empty) {
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
            await stockConfirmationService.submitConfirmation(item.id, item.storeId, userId, type);
            setToastMessage("Thanks. Status updated just now.");
            setIsDisabled(true);
        } catch (error: any) {
            setToastMessage(error.message || "Failed to submit status.");
        } finally {
            setIsLoading(false);
            setTimeout(() => setToastMessage(null), 3000);
        }
    };

    return (
        <div className="flex flex-col gap-2 mt-4 relative">
            <p className="text-sm font-semibold text-gray-700">Update Stock Status</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                    onClick={() => handleConfirm('GREEN')}
                    disabled={isDisabled || isLoading}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md font-medium text-sm hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <span>🟢</span> In Stock – I Found It
                </button>
                <button
                    onClick={() => handleConfirm('YELLOW')}
                    disabled={isDisabled || isLoading}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md font-medium text-sm hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <span>🟡</span> Low Stock – Only a Few Left
                </button>
                <button
                    onClick={() => handleConfirm('RED')}
                    disabled={isDisabled || isLoading}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium text-sm hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <span>🔴</span> Out of Stock – Not Available
                </button>
            </div>

            {toastMessage && (
                <div className="absolute -bottom-10 left-0 right-0 p-2 bg-gray-800 text-white text-xs text-center rounded-md animate-fade-in z-10 shadow-lg">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};
