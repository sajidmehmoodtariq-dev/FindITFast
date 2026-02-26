import React, { useState } from 'react';
import type { SearchResult } from '../../types/search';

interface ArrivedAtStoreProps {
  searchResult: SearchResult;
  onArrived: () => void;
  onDirections: () => void;
}

export const ArrivedAtStore: React.FC<ArrivedAtStoreProps> = ({
  searchResult,
  onArrived,
}) => {
  const [isNavigating, setIsNavigating] = useState(false);

  const handleDirections = () => {
    setIsNavigating(true);
    // Open Google Maps with directions
    const destination = encodeURIComponent(searchResult.store.address);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(mapsUrl, '_blank');
    
    // Reset navigation state after a brief delay
    setTimeout(() => setIsNavigating(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 border-b">
        <h1 className="text-lg font-semibold text-gray-900">Navigate to Store</h1>
      </div>

      {/* Store Information */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="text-center mb-6">
            {/* Store Icon */}
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {searchResult.store.name}
            </h2>
            
            <p className="text-gray-600 mb-1">{searchResult.store.address}</p>
            
            {searchResult.distance && (
              <p className="text-sm text-blue-600 font-medium">
                {searchResult.distance.toFixed(1)} km away
              </p>
            )}
          </div>

          {/* Item Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Looking for:</h3>
            <div className="flex items-center space-x-3">
              {searchResult.imageUrl && (
                <img
                  src={searchResult.imageUrl}
                  alt={searchResult.name}
                  className="w-12 h-12 object-cover rounded-lg"
                />
              )}
              <div>
                <p className="font-medium text-gray-900">{searchResult.name}</p>
                {searchResult.price && (
                  <p className="text-sm text-green-600">${parseFloat(searchResult.price).toFixed(2)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Directions Button */}
          <button
            onClick={handleDirections}
            disabled={isNavigating}
            className={`w-full py-4 px-6 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center space-x-3 mb-4 ${
              isNavigating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isNavigating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Opening Google Maps...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
                <span>Get Directions</span>
              </>
            )}
          </button>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Instructions</h4>
                <p className="text-sm text-blue-700">
                  Use Google Maps to reach the store. When you arrive, return to this app and tap "I've Arrived" to see the item location on the store floorplan.
                </p>
              </div>
            </div>
          </div>

          {/* Arrived Button */}
          <button
            onClick={onArrived}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>I've Arrived at the Store</span>
          </button>
        </div>
      </div>

      {/* Additional Info */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-gray-900 mb-3">What happens next?</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">1</span>
              <p>Navigate to the store using Google Maps</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">2</span>
              <p>When you arrive, tap "I've Arrived" above</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">3</span>
              <p>View the store floorplan with the exact item location</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
