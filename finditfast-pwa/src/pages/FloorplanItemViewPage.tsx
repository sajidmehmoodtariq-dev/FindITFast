import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { StorePlanService, ItemService, StoreService } from '../services/firestoreService';
import { MobileLayout, MobileContent, MobileHeader } from '../components/common/MobileLayout';
import { StockConfirmationButtons } from '../components/StockConfirmationButtons';
import { useAuth } from '../contexts/AuthContext';
import { getStorePlanImageUrl } from '../utils/storePlanCompatibility';
import type { StorePlan, Item, Store } from '../types';

export const FloorplanItemViewPage: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const itemId = searchParams.get('itemId');
  
  console.log('🎯 FloorplanItemViewPage: Component rendered with:', { storeId, itemId });
  
  const [storePlan, setStorePlan] = useState<StorePlan | null>(null);
  const [targetItem, setTargetItem] = useState<Item | null>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  
  // Floorplan zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Blinking animation state
  const [isBlinking, setIsBlinking] = useState(true);
  const [anonymousId, setAnonymousId] = useState<string>('');
  
  const floorplanRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let devId = localStorage.getItem('deviceId');
    if (!devId) {
      devId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', devId);
    }
    setAnonymousId(devId);
  }, []);

  const userId = user?.uid ?? anonymousId;

  useEffect(() => {
    const loadFloorplanData = async () => {
      if (!storeId) {
        setError('Store ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load store information
        console.log('📦 Loading store data for:', storeId);
        const storeData = await StoreService.getById(storeId);
        if (!storeData) {
          console.error('❌ Store not found:', storeId);
          setError('Store not found');
          setIsLoading(false);
          return;
        }
        console.log('✅ Store data loaded:', storeData.name);
        setStore(storeData);

        // Load active store plan
        console.log('🗺️ Loading store plans for:', storeId);
        const storePlans = await StorePlanService.getByStore(storeId);
        console.log('📋 Store plans found:', storePlans.length);
        const activePlan = storePlans.find(plan => plan.isActive);
        
        if (!activePlan) {
          console.error('❌ No active floorplan found for store:', storeId);
          setError('This store does not have a floorplan available for viewing. Please contact the store for assistance.');
          setIsLoading(false);
          return;
        }
        console.log('✅ Active plan found:', activePlan.name, 'size:', activePlan.size);
        setStorePlan(activePlan);

        // Load all items for the store to show on floorplan
        console.log('📦 Loading items for store:', storeId);
        const storeItems = await ItemService.getByStore(storeId);
        console.log('📦 Items loaded:', storeItems.length, 'items');
        console.log('📦 Items with positions:', storeItems.map(item => ({
          id: item.id,
          name: item.name,
          position: item.position,
          hasPosition: !!(item.position?.x !== undefined && item.position?.y !== undefined)
        })));
        setAllItems(storeItems);

        // Load specific target item if provided
        if (itemId) {
          console.log('🎯 Loading target item:', itemId);
          const item = await ItemService.getById(itemId);
          if (item) {
            console.log('✅ Target item loaded:', item.name, 'position:', item.position);
            setTargetItem(item);
          } else {
            console.error('❌ Target item not found:', itemId);
          }
        }

      } catch (err) {
        console.error('Error loading floorplan data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load store floorplan';
        
        // Handle specific error cases
        if (errorMessage.includes('Store owner profile not found')) {
          setError('This store floorplan is not available for public viewing. Please contact the store for assistance.');
        } else if (errorMessage.includes('Permission denied') || errorMessage.includes('not authenticated')) {
          setError('Unable to access store floorplan. This might be a private store.');
        } else {
          setError('Failed to load store floorplan. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadFloorplanData();
  }, [storeId, itemId]);

  useEffect(() => {
    // Stop blinking after 10 seconds
    const timer = setTimeout(() => {
      setIsBlinking(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleImageLoad = () => {
    setImageError(false);
    // Center the floorplan initially
    if (floorplanRef.current && imageRef.current) {
      const containerRect = floorplanRef.current.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();
      
      if (containerRect.width > imageRect.width && containerRect.height > imageRect.height) {
        // Image fits in container, center it
        const centerX = (containerRect.width - imageRect.width) / 2;
        const centerY = (containerRect.height - imageRect.height) / 2;
        setPosition({ x: centerX, y: centerY });
      }
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Pan and zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newScale = Math.max(0.5, Math.min(3, scale - e.deltaY * 0.001));
    setScale(newScale);
  };

  const handleZoomIn = () => {
    setScale(Math.min(3, scale * 1.2));
  };

  const handleZoomOut = () => {
    setScale(Math.max(0.5, scale / 1.2));
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleItemMissing = async () => {
    if (!targetItem || !storeId) return;

    // Navigate to the report page with item and store information
    navigate(`/report/${targetItem.id}/${storeId}`);
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading store floorplan...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !storePlan || !store) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto p-6">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Floorplan Not Available</h3>
            <p className="text-gray-600 mb-4">{error || 'The store floorplan could not be loaded.'}</p>
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

  const floorplanImageUrl = getStorePlanImageUrl(storePlan);

  return (
    <MobileLayout>
      <MobileHeader 
        title={store.name} 
        showBack={true} 
        onBack={() => navigate('/')}
      />
      
      <MobileContent>
        <div className="relative min-h-full bg-gray-50 overflow-hidden">
          {/* Target Item Info Banner - Minimized */}
          {targetItem && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-blue-600 text-white px-4 py-2 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs opacity-90">Looking for:</span>
                  <span className="font-medium text-sm">{targetItem.name}</span>
                </div>
                {isBlinking && (
                  <div className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                    <span className="animate-pulse">● Blinking</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floorplan Container */}
          <div 
            ref={floorplanRef}
            className={`relative w-full h-full overflow-hidden ${targetItem ? 'pt-12' : ''}`}
            style={{ minHeight: 'calc(100vh - 140px)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Floorplan Image */}
            {!imageError ? (
              <div
                className="relative w-full h-full flex items-center justify-center"
                style={{
                  cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
              >
                {/* Image container with zoom and pan - EXACT COPY from FullScreenInventory */}
                <div 
                  className="relative w-full h-full"
                  style={{
                    transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                    transformOrigin: 'center'
                  }}
                >
                  <img
                    ref={imageRef}
                    src={floorplanImageUrl}
                    alt={`Floorplan for ${store.name}`}
                    className="max-w-full max-h-[calc(100vh-200px)] transition-transform duration-200"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    draggable={false}
                  />
                  
                  {/* Show existing item pins - EXACT COPY from FullScreenInventory */}
                  {allItems.map((item) => {
                    if (!item.position) return null;
                    
                    console.log('🖼️ Rendering pin for:', item.name, 'at position:', item.position);
                    
                    const isTargetItem = targetItem?.id === item.id;
                    
                    return (
                      <div
                        key={item.id}
                        className="absolute z-20 pointer-events-none"
                        style={{ 
                          left: `${item.position.x}%`, 
                          top: `${item.position.y}%`,
                          transform: `translate(-50%, -50%)`
                        }}
                      >
                        {isTargetItem ? (
                          // Target item with blinking effect
                          <div className="relative">
                            {isBlinking && (
                              <>
                                {/* Pulsing ring effect */}
                                <div className="absolute inset-0 w-12 h-12 bg-green-500 rounded-full animate-ping opacity-75" 
                                     style={{ transform: `translate(-50%, -50%)` }}></div>
                                <div className="absolute inset-0 w-8 h-8 bg-green-600 rounded-full animate-pulse"
                                     style={{ transform: `translate(-50%, -50%)` }}></div>
                              </>
                            )}
                            {/* Center dot */}
                            <div className="absolute w-12 h-12 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                                 style={{ transform: `translate(-50%, -50%)` }}>
                              <span className="text-white text-sm font-bold">!</span>
                            </div>
                          </div>
                        ) : (
                          // Regular item pin
                          <div className="w-6 h-6 bg-blue-400 rounded-full border-2 border-white shadow-md"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600">Failed to load floorplan image</p>
                </div>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-20 right-4 flex flex-col space-y-2">
            <button
              onClick={handleZoomIn}
              className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              onClick={handleZoomOut}
              className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
            <button
              onClick={handleResetView}
              className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          {targetItem && (
            <div className="absolute bottom-20 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 pb-3 pt-2">
              <p className="text-sm font-semibold text-gray-800">Did you find this item</p>
              <StockConfirmationButtons
                item={targetItem}
                userId={userId}
                variant="map"
                title=""
              />
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 flex space-x-3">
            {targetItem && (
              <button
                onClick={handleItemMissing}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Item Missing
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-700 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Search
            </button>
          </div>


        </div>
      </MobileContent>
    </MobileLayout>
  );
};
