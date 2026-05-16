import React from 'react';
import { TouchArea } from '../common/MobileLayout';
import { LazyImage } from '../performance/LazyLoading';
import { StockTrustBadge } from '../StockTrustBadge';
import type { SearchResult } from '../../types/search';

interface ResultCardProps {
  result: SearchResult;
  onClick: (result: SearchResult) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onClick }) => {
  const formatDistance = (distance?: number): string => {
    if (!distance) return '';
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatPrice = (price?: number | string): string => {
    if (!price) return '';

    // Convert string to number if needed
    let numPrice: number;
    if (typeof price === 'string') {
      // Remove $ symbol and any non-numeric characters except decimal point
      const cleanPrice = price.replace(/[^\d.]/g, '');
      numPrice = parseFloat(cleanPrice);
    } else {
      numPrice = price;
    }

    // Check if it's a valid number
    if (isNaN(numPrice) || numPrice <= 0) return '';

    return `$${numPrice.toFixed(2)}`;
  };

  return (
    <TouchArea
      variant="card"
      onClick={() => onClick(result)}
      className="w-full p-6 space-y-4"
      aria-label={`View ${result.name} at ${result.store.name}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Item Name */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h3 className="text-xl font-semibold truncate text-heading">
              {result.name}
            </h3>
          </div>

          {/* Store Name */}
          <p className="text-lg font-medium mb-4 truncate text-subheading">
            {result.store.name}
          </p>

          {/* Distance and Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {result.distance && (
                <span className="flex items-center gap-2 text-body">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <span className="font-medium">{formatDistance(result.distance)}</span>
                </span>
              )}
            </div>

            {result.price && (
              <div className="text-right">
                <p className="text-2xl font-bold text-accent">
                  {formatPrice(result.price)}
                </p>
              </div>
            )}
          </div>

          {/* Stock Trust System */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <StockTrustBadge item={result} />
          </div>
        </div>

        {/* Item Image */}
        {result.imageUrl && (
          <div className="ml-4 flex-shrink-0">
            <LazyImage
              src={result.imageUrl}
              alt={result.name}
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
            />
          </div>
        )}
      </div>

      {/* Report Count Warning */}
      {result.reportCount > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {result.reportCount} user{result.reportCount > 1 ? 's' : ''} reported this item
          </p>
        </div>
      )}
    </TouchArea>
  );
};