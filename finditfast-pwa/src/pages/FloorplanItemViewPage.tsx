import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  
  const [storePlan, setStorePlan] = useState<StorePlan | null>(null);
  const [targetItem, setTargetItem] = useState<Item | null>(null);
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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
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

  useEffect(() => {
    const updateContainerSize = () => {
      if (!floorplanRef.current) return;

      const rect = floorplanRef.current.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height
      });
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    window.addEventListener('orientationchange', updateContainerSize);

    return () => {
      window.removeEventListener('resize', updateContainerSize);
      window.removeEventListener('orientationchange', updateContainerSize);
    };
  }, [storePlan, targetItem]);

  const floorplanFrame = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !imageSize.width || !imageSize.height) {
      return null;
    }

    const containerAspect = containerSize.width / containerSize.height;
    const imageAspect = imageSize.width / imageSize.height;

    if (imageAspect >= containerAspect) {
      const width = containerSize.width;
      const height = width / imageAspect;
      return {
        x: 0,
        y: (containerSize.height - height) / 2,
        width,
        height
      };
    }

    const height = containerSize.height;
    const width = height * imageAspect;
    return {
      x: (containerSize.width - width) / 2,
      y: 0,
      width,
      height
    };
  }, [containerSize, imageSize]);

  const handleImageLoad = () => {
    setImageError(false);
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth || 0,
        height: imageRef.current.naturalHeight || 0
      });
    }
    // Keep map anchored to top-left on mobile to avoid large empty space.
    setPosition({ x: 0, y: 0 });
    setScale(1);
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

  // Attach wheel listener as non-passive so preventDefault works
  useEffect(() => {
    const el = floorplanRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(prev => Math.max(0.5, Math.min(3, prev - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
      
      <MobileContent className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {targetItem && (
            <div className="shrink-0 rounded-3xl bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm ring-1 ring-slate-200/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Looking for:</span>
                  <span className="min-w-0 truncate text-base font-semibold text-slate-900">{targetItem.name}</span>
                </div>
                {isBlinking && (
                  <div className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Blinking
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            ref={floorplanRef}
            className="relative flex-1 min-h-[58vh] overflow-hidden rounded-[28px] bg-gray-100 shadow-sm ring-1 ring-black/5"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {!imageError ? (
              <div
                className="relative flex h-full w-full items-start justify-center"
                style={{
                  cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
              >
                <div
                  className="absolute"
                  style={{
                    left: `${floorplanFrame?.x ?? 0}px`,
                    top: `${floorplanFrame?.y ?? 0}px`,
                    width: `${floorplanFrame?.width ?? containerSize.width}px`,
                    height: `${floorplanFrame?.height ?? containerSize.height}px`,
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img
                    ref={imageRef}
                    src={floorplanImageUrl}
                    alt={`Floorplan for ${store.name}`}
                    className="h-full w-full select-none object-cover transition-transform duration-200"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    draggable={false}
                  />

                  {targetItem?.position && (
                    <div
                      className="absolute z-20 pointer-events-none"
                      style={{
                        left: `${targetItem.position.x}%`,
                        top: `${targetItem.position.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div className="relative">
                        {isBlinking && (
                          <>
                            <div className="absolute inset-0 h-12 w-12 rounded-full bg-green-500 opacity-75 animate-ping" style={{ transform: 'translate(-50%, -50%)' }} />
                            <div className="absolute inset-0 h-8 w-8 rounded-full bg-green-600 animate-pulse" style={{ transform: 'translate(-50%, -50%)' }} />
                          </>
                        )}
                        <div className="absolute flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-green-500 shadow-lg" style={{ transform: 'translate(-50%, -50%)' }}>
                          <span className="text-sm font-bold text-white">!</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/5 hover:bg-white"
                    aria-label="Zoom in"
                  >
                    <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/5 hover:bg-white"
                    aria-label="Zoom out"
                  >
                    <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                    </svg>
                  </button>
                  <button
                    onClick={handleResetView}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/5 hover:bg-white"
                    aria-label="Reset view"
                  >
                    <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto mb-4 h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600">Failed to load floorplan image</p>
                </div>
              </div>
            )}
          </div>

          {targetItem ? (
            <div className="sticky bottom-0 shrink-0 rounded-[28px] bg-white/95 px-4 py-3 shadow-lg ring-1 ring-slate-200/70 backdrop-blur-sm">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">Did you find this item?</p>
                <StockConfirmationButtons
                  item={targetItem}
                  userId={userId}
                  variant="map"
                  title=""
                  onConfirmed={(result) => {
                    const inStockFromType = result.type === 'RED' ? false : true;

                    setTargetItem((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        inStock: inStockFromType,
                        lastConfirmedAt: result.lastConfirmedAt,
                        weeklyGreenCount: result.weeklyGreenCount,
                        weeklyYellowCount: result.weeklyYellowCount,
                        recentRedCount24h: result.recentRedCount24h,
                        statusOverride: result.statusOverride
                      };
                    });
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleItemMissing}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Item Missing</span>
                  </button>

                  <button
                    onClick={() => navigate('/')}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-200"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Search</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 shrink-0 rounded-[28px] bg-white/95 px-4 py-3 shadow-lg ring-1 ring-slate-200/70 backdrop-blur-sm">
              <button
                onClick={() => navigate('/')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-200"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Search</span>
              </button>
            </div>
          )}
        </div>
      </MobileContent>
    </MobileLayout>
  );
};
