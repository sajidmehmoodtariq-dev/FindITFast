import React, { useState, useRef } from 'react';
import { FloorplanImage } from './FloorplanImage';
import { ItemPin } from './ItemPin';
import { ItemInfo } from './ItemInfo';
import { usePermissions } from '../../hooks/usePermissions';
import type { Store, Item } from '../../types';

interface FloorplanViewerProps {
  store: Store;
  items: Item[];
  selectedItemId?: string;
  onItemSelect?: (item: Item) => void;
  onLocationSelect?: (position: { x: number; y: number }) => void;
  mode?: string; // 'relocate' mode for item repositioning
  className?: string;
}

export const FloorplanViewer: React.FC<FloorplanViewerProps> = ({
  store,
  items,
  selectedItemId,
  onItemSelect,
  onLocationSelect,
  mode,
  className = ''
}) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { canEditStoreItems, isUser } = usePermissions();



  const handleImageLoad = () => {
    setIsImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsImageLoaded(false);
    setImageError(true);
  };

  const handleItemClick = (item: Item) => {
    onItemSelect?.(item);
  };

  const handleFloorplanClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'relocate' && onLocationSelect && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      onLocationSelect({ x, y });
    }
  };

  // Filter items that belong to this store (handle prefix mismatches)
  const storeItems = items.filter(item => {
    if (!item.storeId) return false;
    
    // Direct match
    if (item.storeId === store.id) return true;
    
    // Handle prefix mismatches - remove common prefixes and compare
    const cleanedItemStoreId = item.storeId.replace(/^(temp_|virtual_)/, '');
    const cleanedStoreId = store.id.replace(/^(temp_|virtual_)/, '');
    
    return cleanedItemStoreId === cleanedStoreId;
  });

  if (!store.floorplanUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg min-h-64 ${className}`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Floorplan Available</h3>
          <p className="text-gray-600">
            This store hasn't uploaded a floorplan yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Relocate Mode Instructions */}
      {mode === 'relocate' && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">!</div>
            <div>
              <h3 className="font-semibold text-blue-900">Select New Location</h3>
              <p className="text-sm text-blue-700">The current item location is blinking. Tap anywhere on the floorplan to move it to a new location.</p>
            </div>
          </div>
        </div>
      )}

      {/* Floorplan Container */}
      <div 
        ref={containerRef}
        className={`relative w-full aspect-[4/3] min-h-64 max-h-96 ${mode === 'relocate' ? 'cursor-crosshair' : ''}`}
        onClick={handleFloorplanClick}
      >
        <FloorplanImage
          src={store.floorplanUrl}
          alt={`${store.name} floorplan`}
          className="w-full h-full"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />

        {/* Item Pins Overlay */}
        {isImageLoaded && !imageError && storeItems.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative w-full h-full pointer-events-auto">
                {storeItems.map((item) => (
                    <ItemPin
                      key={item.id}
                      item={item}
                      onClick={handleItemClick}
                      isSelected={item.id === selectedItemId}
                      allowInteraction={canEditStoreItems(store.id) || isUser}
                      isBlinking={mode === 'relocate' && item.id === selectedItemId}
                    />
                  ))}
              </div>
            </div>
          )}

        {/* Items Count Badge */}
        {isImageLoaded && !imageError && storeItems.length > 0 && (
          <div className="absolute top-4 left-4 bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full shadow-lg">
            {storeItems.filter(item => item.position?.x !== undefined && item.position?.y !== undefined).length} of {storeItems.length} item{storeItems.length !== 1 ? 's' : ''} located
          </div>
        )}

        {/* Items Found But Not Positioned Message */}
        {isImageLoaded && !imageError && storeItems.length > 0 && 
         storeItems.filter(item => item.position?.x !== undefined && item.position?.y !== undefined).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white bg-opacity-90 rounded-lg p-6 text-center shadow-lg max-w-sm">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Items need positioning</p>
              <p className="text-sm text-gray-500 mt-1">
                {storeItems.length} item{storeItems.length !== 1 ? 's' : ''} found but not yet positioned on the floorplan
              </p>
              <p className="text-xs text-gray-400 mt-2">Store owners can add item locations</p>
            </div>
          </div>
        )}

        {/* No Items Message */}
        {isImageLoaded && !imageError && storeItems.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white bg-opacity-90 rounded-lg p-6 text-center shadow-lg">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">No items located yet</p>
              <p className="text-sm text-gray-500 mt-1">Items will appear as red pins when added</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {isImageLoaded && !imageError && storeItems.length > 0 && !selectedItemId && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full border border-red-600"></div>
                <span className="text-gray-700">Item location</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full border border-white"></div>
                <span className="text-gray-700">Verified</span>
              </div>
            </div>
            <div className="text-gray-500">
              Tap pins for details
            </div>
          </div>
        </div>
      )}

      {/* Selected Item Information */}
      {selectedItemId && (
        <div className="mt-4">
          {(() => {
            const selectedItem = storeItems.find(item => item.id === selectedItemId);
            return selectedItem ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">Item Details</h4>
                  <button
                    onClick={() => onItemSelect?.(selectedItem)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Close
                  </button>
                </div>
                <ItemInfo item={selectedItem} store={store} />
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
};