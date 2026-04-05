import React, { useEffect, useState } from 'react';
import type { Item } from '../types';
import { stockConfirmationService } from '../services/stockConfirmationService';

interface StockTrustBadgeProps {
    item: Item;
}

export const StockTrustBadge: React.FC<StockTrustBadgeProps> = ({ item }) => {
    const [summary, setSummary] = useState<Awaited<ReturnType<typeof stockConfirmationService.getLiveConfirmationSummary>> | null>(null);

    useEffect(() => {
        let active = true;

        stockConfirmationService.getLiveConfirmationSummary(item.id, item)
            .then((result) => {
                if (active) {
                    setSummary(result);
                }
            })
            .catch((error) => {
                console.warn('Unable to load live badge summary:', error);
            });

        return () => {
            active = false;
        };
    }, [item.id, item]);

    const { color, label, sublabelA, sublabelB, warning } = stockConfirmationService.getBadgeState(item, summary ?? undefined);

    return (
        <div className="flex flex-col gap-1 my-2">
            <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{color}</span>
                <span className="font-semibold text-gray-800 tracking-tight">{label}</span>
            </div>

            <div className="flex flex-col ml-7 text-sm text-gray-500">
                <span>{sublabelA}</span>
                {sublabelB && <span>{sublabelB}</span>}
                {warning && <span className="text-amber-600 font-medium mt-0.5">{warning}</span>}
            </div>
        </div>
    );
};
