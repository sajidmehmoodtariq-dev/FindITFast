import React, { useState, useRef, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ItemService } from '../../services/firestoreService';
import { fileToBase64, validateImageFile, compressImage } from '../../utilities/imageUtils';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';
import { sanitizeForSafari, logSafariDebug, logSafariError } from '../../utils/safariCompatibility';
import type { Store, StorePlan, Item } from '../../types';

interface InventoryModalProps {
  store: Store;
  storePlan: StorePlan;
  onClose: () => void;
}

interface ItemPin {
  id: string;
  x: number;
  y: number;
  item: Item;
}

interface NewItemForm {
  name: string;
  price: string;
  itemImage: string | null; // Base64
  priceImage: string | null; // Base64
  x: number;
  y: number;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  store,
  storePlan,
  onClose
}) => {
  const [items, setItems] = useState<ItemPin[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPin, setNewPin] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newItem, setNewItem] = useState<NewItemForm>({
    name: '',
    price: '',
    itemImage: null,
    priceImage: null,
    x: 0,
    y: 0
  });
  
  // File size tracking state
  const [itemImageSizeInfo, setItemImageSizeInfo] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);
  
  const [priceImageSizeInfo, setPriceImageSizeInfo] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);

  const floorplanRef = useRef<HTMLImageElement>(null);
  const itemImageRef = useRef<HTMLInputElement>(null);
  const priceImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
  }, [storePlan.id]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get items for this specific floorplan
      const itemsQuery = query(
        collection(db, 'items'),
        where('storeId', '==', store.id),
        where('floorplanId', '==', storePlan.id)
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      const itemsData = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];

      // Convert to pins
      const pins: ItemPin[] = itemsData.map(item => ({
        id: item.id,
        x: item.position?.x ?? 0,
        y: item.position?.y ?? 0,
        item
      }));

      setItems(pins);
    } catch (error) {
      console.error('Error loading items:', error);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleFloorplanClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!floorplanRef.current || showAddForm) return;

    const rect = floorplanRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setNewPin({ x, y });
    setNewItem(prev => ({ ...prev, x, y }));
    setShowAddForm(true);
  };

  const handleImageUpload = async (file: File, type: 'item' | 'price') => {
    try {
      logSafariDebug('Starting image upload', { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type,
        uploadType: type
      });

      // Validate file
      if (!validateImageFile(file, 5)) { // 5MB limit
        throw new Error('Invalid image file. Please select a valid image under 5MB.');
      }

      const originalSize = file.size;
      console.log(`📁 [${type.toUpperCase()} IMAGE] Original size:`, (originalSize / 1024 / 1024).toFixed(2), 'MB');

      // Compress image
      const compressedFile = await compressImage(file, 800, 800, 0.7);
      const compressedSize = compressedFile.size;
      
      console.log(`🗜️ [${type.toUpperCase()} IMAGE] Compressed size:`, (compressedSize / 1024 / 1024).toFixed(2), 'MB');
      console.log(`📊 [${type.toUpperCase()} IMAGE] Compression ratio:`, ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%');
      
      // Convert to base64
      const base64 = await fileToBase64(compressedFile);
      logSafariDebug('Base64 conversion successful', { 
        base64Length: base64.length,
        isValidDataUrl: base64.startsWith('data:')
      });
      
      if (type === 'item') {
        setNewItem(prev => ({ ...prev, itemImage: base64 }));
        setItemImageSizeInfo({ originalSize, compressedSize });
      } else {
        setNewItem(prev => ({ ...prev, priceImage: base64 }));
        setPriceImageSizeInfo({ originalSize, compressedSize });
      }
      
      logSafariDebug('Image upload completed successfully');
    } catch (error) {
      logSafariError('Error processing image', error, { 
        fileName: file.name, 
        fileSize: file.size, 
        uploadType: type 
      });
      setError(`Failed to process ${type} image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSaveItem = async () => {
    try {
      setSaving(true);
      setError(null);

      logSafariDebug('Starting item save process', {
        itemName: newItem.name,
        hasImage: !!newItem.itemImage,
        position: { x: newItem.x, y: newItem.y }
      });

      // Validation
      if (!newItem.name.trim()) {
        throw new Error('Item name is required');
      }
      if (!newItem.itemImage) {
        throw new Error('Item image is required');
      }

      // Create item data with metadata instead of base64 for Safari/iOS compatibility
      // Clean price by removing $ and non-numeric characters except decimal point
      const cleanPrice = newItem.price ? newItem.price.replace(/[^\d.]/g, '') : null;

      const rawItemData = {
        name: newItem.name.trim(),
        price: cleanPrice || null,
        imageUrl: '', // Empty URL since we're not storing base64
        priceImageUrl: newItem.priceImage ? '' : undefined, // Empty URL if price image exists
        storeId: store.id,
        floorplanId: storePlan.id,
        position: {
          x: Number(newItem.x), // Ensure numeric types for Safari
          y: Number(newItem.y)  // Ensure numeric types for Safari
        },
        verified: true,
        verifiedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        reportCount: 0,
        // Metadata fields for Safari/iOS compatibility
        hasImageData: !!newItem.itemImage,
        imageMimeType: newItem.itemImage ? 'image/jpeg' : undefined, // Assume JPEG for now
        imageSize: newItem.itemImage ? newItem.itemImage.length : undefined,
        hasPriceImage: !!newItem.priceImage,
        priceImageMimeType: newItem.priceImage ? 'image/jpeg' : undefined,
        priceImageSize: newItem.priceImage ? newItem.priceImage.length : undefined,
      };

      // Sanitize data for Safari compatibility
      const itemData = sanitizeForSafari(rawItemData);
      
      logSafariDebug('Item data prepared and sanitized', itemData);

      // Save to Firestore
      const itemId = await ItemService.create(itemData as Omit<Item, 'id'>);
      
      logSafariDebug('Item saved successfully', { itemId });

      // Reset form
      setNewItem({
        name: '',
        price: '',
        itemImage: null,
        priceImage: null,
        x: 0,
        y: 0
      });
      setItemImageSizeInfo(null);
      setPriceImageSizeInfo(null);
      setNewPin(null);
      setShowAddForm(false);

      // Reload items
      await loadItems();
      
      logSafariDebug('Item save process completed successfully');

    } catch (error) {
      logSafariError('Error saving item', error, {
        itemName: newItem.name,
        hasImage: !!newItem.itemImage,
        position: { x: newItem.x, y: newItem.y }
      });
      setError(error instanceof Error ? error.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await ItemService.delete(itemId);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item');
    }
  };

  const closeModal = () => {
    setShowAddForm(false);
    setNewPin(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{store.name}</h2>
            <p className="text-gray-600">Item Management - {storePlan.name}</p>
          </div>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Floorplan Section */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="relative">
              {/* Instructions */}
              {!showAddForm && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Click anywhere on the floorplan</strong> to add a new item at that location.
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Floorplan Container */}
              <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                <img
                  ref={floorplanRef}
                  src={getStorePlanImageUrl(storePlan)}
                  alt={`${store.name} floorplan`}
                  className="w-full h-auto cursor-crosshair"
                  onClick={handleFloorplanClick}
                  style={{ minHeight: '400px', maxHeight: '600px', objectFit: 'contain' }}
                />

                {/* Existing Item Pins */}
                {items.map((pin) => (
                  <div
                    key={pin.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    {/* Pin */}
                    <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg cursor-pointer hover:bg-red-600 transition-colors">
                      <div className="w-full h-full rounded-full bg-white"></div>
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {pin.item.name}
                      {pin.item.price && ` - ${pin.item.price}`}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black border-opacity-90"></div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteItem(pin.id)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* New Pin Preview */}
                {newPin && (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                    style={{ left: `${newPin.x}%`, top: `${newPin.y}%` }}
                  >
                    <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg">
                      <div className="w-full h-full rounded-full bg-white"></div>
                    </div>
                  </div>
                )}

                {/* Loading Overlay */}
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading items...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">{items.length}</div>
                  <div className="text-sm text-gray-600">Total Items</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {items.filter(item => item.item.verified).length}
                  </div>
                  <div className="text-sm text-gray-600">Verified</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-600">
                    {new Set(items.map(item => item.item.name.split(' ')[0])).size}
                  </div>
                  <div className="text-sm text-gray-600">Categories</div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="w-96 border-l p-6 overflow-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Item</h3>
              
              <div className="space-y-4">
                {/* Item Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Dove Soap"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    maxLength={50}
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newItem.price || '$'}
                      onChange={(e) => {
                        const value = e.target.value;
                        let cleaned = value.replace(/[^\d.]/g, '');
                        const parts = cleaned.split('.');
                        if (parts.length > 2) {
                          cleaned = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (parts[1] && parts[1].length > 2) {
                          cleaned = parts[0] + '.' + parts[1].substring(0, 2);
                        }
                        const formattedValue = cleaned ? `$${cleaned}` : '$';
                        setNewItem(prev => ({ ...prev, price: formattedValue }));
                      }}
                      placeholder="$0.00"
                      className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-sm">AUD</span>
                    </div>
                  </div>
                </div>

                {/* Item Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Photo *
                  </label>
                  <input
                    ref={itemImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'item')}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => itemImageRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-md hover:border-indigo-500 transition-colors"
                  >
                    {newItem.itemImage ? (
                      <div className="text-center">
                        <img
                          src={newItem.itemImage}
                          alt="Item preview"
                          className="w-16 h-16 object-cover rounded mx-auto mb-2"
                        />
                        <p className="text-sm text-green-600">Photo uploaded</p>
                        {itemImageSizeInfo && (
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            <div className="flex justify-between">
                              <span>Original:</span>
                              <span className="font-medium">{(itemImageSizeInfo.originalSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Compressed:</span>
                              <span className="font-medium text-green-600">{(itemImageSizeInfo.compressedSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Saved:</span>
                              <span className="font-medium text-blue-600">{((1 - itemImageSizeInfo.compressedSize / itemImageSizeInfo.originalSize) * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <p className="text-sm">Upload item photo</p>
                      </div>
                    )}
                  </button>
                </div>

                {/* Price Tag Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price Tag Photo (optional)
                  </label>
                  <input
                    ref={priceImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'price')}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => priceImageRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-md hover:border-indigo-500 transition-colors"
                  >
                    {newItem.priceImage ? (
                      <div className="text-center">
                        <img
                          src={newItem.priceImage}
                          alt="Price tag preview"
                          className="w-16 h-16 object-cover rounded mx-auto mb-2"
                        />
                        <p className="text-sm text-green-600">Price photo uploaded</p>
                        {priceImageSizeInfo && (
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            <div className="flex justify-between">
                              <span>Original:</span>
                              <span className="font-medium">{(priceImageSizeInfo.originalSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Compressed:</span>
                              <span className="font-medium text-green-600">{(priceImageSizeInfo.compressedSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Saved:</span>
                              <span className="font-medium text-blue-600">{((1 - priceImageSizeInfo.compressedSize / priceImageSizeInfo.originalSize) * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <p className="text-sm">Upload price tag</p>
                      </div>
                    )}
                  </button>
                </div>

                {/* Position Info */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-600">
                    <strong>Position:</strong> {newPin?.x.toFixed(1)}%, {newPin?.y.toFixed(1)}%
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPin(null);
                      setNewItem({
                        name: '',
                        price: '',
                        itemImage: null,
                        priceImage: null,
                        x: 0,
                        y: 0
                      });
                      setItemImageSizeInfo(null);
                      setPriceImageSizeInfo(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveItem}
                    disabled={saving || !newItem.name.trim() || !newItem.itemImage}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Item'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
