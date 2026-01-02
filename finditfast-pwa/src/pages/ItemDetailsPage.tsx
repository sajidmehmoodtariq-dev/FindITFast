import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemService, StoreService } from '../services/firestoreService';
import { MobileLayout, MobileContent, MobileHeader } from '../components/common/MobileLayout';
import { LazyImage } from '../components/performance/LazyLoading';
import type { SearchResult } from '../types/search';

export const ItemDetailsPage: React.FC = () => {
  const { itemId, storeId } = useParams<{ itemId: string; storeId: string }>();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadItemDetails = async () => {
      if (!itemId || !storeId) {
        setError('Invalid item or store ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get item and store details
        const [itemData, storeData] = await Promise.all([
          ItemService.getById(itemId),
          StoreService.getById(storeId)
        ]);

        if (!itemData || !storeData) {
          setError('Item or store not found');
          setIsLoading(false);
          return;
        }

        // Create SearchResult object
        const searchResult: SearchResult = {
          ...itemData,
          store: storeData
        };

        setItem(searchResult);
      } catch (err) {
        console.error('Error loading item details:', err);
        setError('Failed to load item information');
      } finally {
        setIsLoading(false);
      }
    };

    loadItemDetails();
  }, [itemId, storeId]);

  const handleDirections = () => {
    if (!item?.store) return;
    
    // Use coordinates for more accurate navigation
    if (item.store.location?.latitude && item.store.location?.longitude) {
      const lat = item.store.location.latitude;
      const lng = item.store.location.longitude;
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      console.log('🗺️ Opening directions to coordinates:', { lat, lng, storeName: item.store.name });
      window.open(mapsUrl, '_blank');
    } else if (item.store.address) {
      // Fallback to address if coordinates are not available
      const destination = encodeURIComponent(item.store.address);
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
      console.log('🗺️ Opening directions to address:', item.store.address);
      window.open(mapsUrl, '_blank');
    } else {
      console.error('❌ No location data available for store:', item.store.name);
    }
  };

  const handleArrivedAtStore = () => {
    if (!item) return;
    navigate(`/store/${item.store.id}/floorplan/item?itemId=${item.id}&itemName=${encodeURIComponent(item.name)}`);
  };

  const formatPrice = (price?: string): string => {
    if (!price) return '';
    return price.startsWith('$') ? price : `$${price}`;
  };

  const formatVerificationStatus = (verified: boolean, verifiedAt: unknown): string => {
    if (!verified || !verifiedAt) return '';
    
    try {
      const verifiedDate = (verifiedAt as { toDate?: () => Date })?.toDate?.() || new Date(verifiedAt as string | number | Date);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - verifiedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Verified 1 day ago';
      return `Verified ${diffDays} days ago`;
    } catch {
      return 'Verified';
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading item details...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !item) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto p-6">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Item Not Found</h3>
            <p className="text-gray-600 mb-4">{error || 'The requested item could not be found.'}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Search
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <MobileHeader 
        title="Item Details" 
        showBack={true} 
        onBack={() => navigate('/')} 
      />
      
      <MobileContent>
        <div className="min-h-full bg-gray-50">
          {/* Item Image */}
          {item.imageUrl && (
            <div className="relative">
              <LazyImage
                src={item.imageUrl}
                alt={item.name}
                width={400}
                height={300}
                className="w-full h-64 object-cover"
              />
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {item.verified && (
                  <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center shadow-lg">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </div>
                )}
                {item.inStock === false ? (
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center shadow-lg">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Out of Stock
                  </div>
                ) : (
                  <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center shadow-lg">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    In Stock
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Item Information */}
          <div className="px-4 py-6 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{item.name}</h1>
                  {item.description && (
                    <p className="text-gray-600 mb-3">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.category && (
                      <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                        {item.category}
                      </span>
                    )}
                    {item.inStock === false ? (
                      <span className="inline-flex items-center bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Out of Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        In Stock
                      </span>
                    )}
                  </div>
                </div>
                
                {item.price && (
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                )}
              </div>

              {/* Verification Status */}
              {item.verified && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    {formatVerificationStatus(item.verified, item.verifiedAt)}
                  </p>
                </div>
              )}

              {/* Report Warning */}
              {item.reportCount > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center p-3 bg-amber-50 rounded-lg">
                    <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-amber-800">
                      {item.reportCount} user{item.reportCount > 1 ? 's' : ''} reported issues with this item's location
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Store Information */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.store.name}</h3>
                  <p className="text-gray-600">{item.store.address}</p>
                </div>
              </div>

              {/* Distance */}
              {item.distance && (
                <div className="flex items-center mb-4">
                  <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-600">
                    {item.distance < 1 
                      ? `${Math.round(item.distance * 1000)}m away`
                      : `${item.distance.toFixed(1)}km away`
                    }
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleDirections}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Get Directions in Maps
                </button>

                <button
                  onClick={handleArrivedAtStore}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  I Have Arrived
                </button>
              </div>
            </div>

            {/* Price Image (if available) */}
            {item.priceImageUrl && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Tag</h3>
                <LazyImage
                  src={item.priceImageUrl}
                  alt={`Price for ${item.name}`}
                  width={300}
                  height={200}
                  className="w-full h-48 object-contain bg-gray-50 rounded-lg border"
                />
              </div>
            )}
          </div>
        </div>
      </MobileContent>
    </MobileLayout>
  );
};
