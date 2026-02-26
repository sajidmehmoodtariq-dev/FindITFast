import React, { useState } from 'react';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';
import type { SearchResult } from '../../types/search';
import type { StorePlan } from '../../types';

interface ItemLocationViewerProps {
  searchResult: SearchResult;
  storePlan?: StorePlan;
  onItemMissing: () => void;
  onUserUpload: () => void;
}

export const ItemLocationViewer: React.FC<ItemLocationViewerProps> = ({
  searchResult,
  storePlan,
  onItemMissing,
  onUserUpload
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Calculate verification status
  const getVerificationStatus = () => {
    if (!searchResult.verified || !searchResult.verifiedAt) {
      return null;
    }

    const verifiedDate = searchResult.verifiedAt.toDate();
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      days: daysDiff,
      isRecent: daysDiff <= 7
    };
  };

  const verificationStatus = getVerificationStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 border-b">
        <h1 className="text-lg font-semibold text-gray-900">Item Location</h1>
        <p className="text-sm text-gray-600">{searchResult.store.name}</p>
      </div>

      {/* Floorplan Section */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-medium text-gray-900 mb-1">Store Layout</h2>
            <p className="text-sm text-gray-600">Tap and pinch to zoom</p>
          </div>

          {/* Floorplan Display */}
          <div className="relative bg-gray-100 min-h-64">
            {storePlan ? (
              <div className="relative w-full h-80 overflow-hidden">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
                
                {!imageError ? (
                  <img
                    src={getStorePlanImageUrl(storePlan)}
                    alt="Store floorplan"
                    className="w-full h-full object-contain cursor-zoom-in"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    style={{
                      touchAction: 'pinch-zoom',
                      maxWidth: 'none',
                      maxHeight: 'none'
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 text-sm">Floorplan unavailable</p>
                    </div>
                  </div>
                )}

                {/* Item Pin */}
                {!imageError && searchResult.position && (
                  <div
                    className="absolute w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{
                      left: `${searchResult.position.x}%`,
                      top: `${searchResult.position.y}%`
                    }}
                  >
                    <div className="absolute -inset-2 bg-red-500 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute inset-0 bg-red-500 rounded-full"></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Store Map Available</h3>
                  <p className="text-gray-600 text-sm max-w-xs mx-auto">
                    The store owner hasn't uploaded a floorplan yet. You can still search for the item in the store.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Item Information */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-start space-x-4">
            {/* Item Image */}
            {searchResult.imageUrl && (
              <div className="flex-shrink-0">
                <img
                  src={searchResult.imageUrl}
                  alt={searchResult.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-medium text-gray-900">{searchResult.name}</h3>
                {verificationStatus && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className={`text-xs ${verificationStatus.isRecent ? 'text-green-600' : 'text-gray-500'}`}>
                      Verified {verificationStatus.days === 0 ? 'today' : `${verificationStatus.days} days ago`}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-2">{searchResult.store.name}</p>
              
              {searchResult.price && (
                <p className="text-lg font-semibold text-green-600">${parseFloat(searchResult.price).toFixed(2)}</p>
              )}
              
              {searchResult.distance && (
                <p className="text-sm text-gray-500">{searchResult.distance.toFixed(1)} km away</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-8 space-y-3">
        {/* Item Missing Button */}
        <button
          onClick={onItemMissing}
          className="w-full bg-orange-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>Item Missing</span>
        </button>

        {/* User Upload Button */}
        <button
          onClick={onUserUpload}
          className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>Upload Item Photo</span>
        </button>
      </div>
    </div>
  );
};
