import React, { useState, useRef, useEffect } from 'react';
import { uploadBytes, ref as storageRef, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '../../services/firebase';
import { ItemService } from '../../services/firestoreService';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';

import type { StorePlan, Item } from '../../types';

interface InventoryManagerProps {
  storePlan: StorePlan;
  storeId: string;
  onClose: () => void;
  onItemAdded?: () => void;
}

interface PinLocation {
  x: number;
  y: number;
  id: string;
}

interface ItemForm {
  name: string;
  price: string;
  itemImage: File | null;
  priceImage: File | null;
  x: number;
  y: number;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  storePlan,
  storeId,
  onClose,
  onItemAdded
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [newPin, setNewPin] = useState<PinLocation | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>({
    name: '',
    price: '',
    itemImage: null,
    priceImage: null,
    x: 0,
    y: 0
  });

  const imageRef = useRef<HTMLImageElement>(null);
  const itemImageInputRef = useRef<HTMLInputElement>(null);
  const priceImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
  }, [storePlan.id]);

  const loadItems = async () => {
    try {
      const storeItems = await ItemService.getByStore(storeId);
      // Filter items that belong to this specific floorplan
      const planItems = storeItems.filter(item => item.floorplanId === storePlan.id);
      setItems(planItems);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const pinId = `pin_${Date.now()}`;
    setNewPin({ x, y, id: pinId });
    setItemForm(prev => ({ ...prev, x, y }));
    setShowItemForm(true);
  };

  const handleFileSelect = (file: File, type: 'item' | 'price') => {
    if (type === 'item') {
      setItemForm(prev => ({ ...prev, itemImage: file }));
    } else {
      setItemForm(prev => ({ ...prev, priceImage: file }));
    }
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const compressedFile = await compressImage(file);
    const imageRef = storageRef(storage, path);
    const snapshot = await uploadBytes(imageRef, compressedFile);
    return await getDownloadURL(snapshot.ref);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.itemImage) {
      setError('Please provide item name and image');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const itemId = `item_${Date.now()}`;
      
      // Upload images
      const itemImagePath = `stores/${storeId}/items/${itemId}/item.jpg`;
      const itemImageUrl = await uploadImage(itemForm.itemImage, itemImagePath);

      let priceImageUrl = null;
      if (itemForm.priceImage) {
        const priceImagePath = `stores/${storeId}/items/${itemId}/price.jpg`;
        priceImageUrl = await uploadImage(itemForm.priceImage, priceImagePath);
      }

      // Create item data
      const itemData: Partial<Item> = {
        id: itemId,
        name: itemForm.name.trim(),
        price: itemForm.price ? itemForm.price.replace(/[^\d.]/g, '') : undefined,
        imageUrl: itemImageUrl,
        priceImageUrl: priceImageUrl || undefined,
        storeId,
        floorplanId: storePlan.id,
        position: {
          x: itemForm.x,
          y: itemForm.y
        },
        verified: true, // Owner-added items are verified
        verifiedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        reportCount: 0
      };

      // Save to Firestore
      await ItemService.create(itemData as Item);

      // Reset form and refresh items
      setItemForm({
        name: '',
        price: '',
        itemImage: null,
        priceImage: null,
        x: 0,
        y: 0
      });
      setNewPin(null);
      setShowItemForm(false);
      await loadItems();
      onItemAdded?.();

    } catch (error) {
      console.error('Error saving item:', error);
      setError('Failed to save item. Please try again.');
    } finally {
      setIsLoading(false);
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

  const cancelAddItem = () => {
    setNewPin(null);
    setShowItemForm(false);
    setItemForm({
      name: '',
      price: '',
      itemImage: null,
      priceImage: null,
      x: 0,
      y: 0
    });
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Manage Items - {storePlan.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Floorplan Area */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                Click on the floorplan to add items
              </h3>
              <p className="text-sm text-gray-600">
                Current items: {items.length}
              </p>
            </div>

            {/* Floorplan with Items */}
            <div className="relative inline-block border border-gray-300 rounded-lg overflow-hidden">
              <img
                ref={imageRef}
                src={getStorePlanImageUrl(storePlan)}
                alt={storePlan.name}
                className="max-w-full max-h-96 cursor-crosshair"
                onClick={handleImageClick}
              />

              {/* Existing Items */}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{
                    left: `${item.position?.x}%`,
                    top: `${item.position?.y}%`
                  }}
                >
                  <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  
                  {/* Item tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {item.name}
                    {item.price && ` - ${item.price}`}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* New Pin */}
              {newPin && (
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${newPin.x}%`,
                    top: `${newPin.y}%`
                  }}
                >
                  <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Item Form Sidebar */}
          {showItemForm && (
            <div className="w-80 border-l border-gray-200 p-4 overflow-auto">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Add New Item</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Item Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Lynx Deodorant"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      value={itemForm.price || '$'}
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
                        setItemForm(prev => ({ ...prev, price: formattedValue }));
                      }}
                      placeholder="$0.00"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    ref={itemImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file, 'item');
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => itemImageInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:border-blue-500 transition-colors"
                  >
                    {itemForm.itemImage ? (
                      <div className="text-sm text-green-600">
                        ✓ {itemForm.itemImage.name}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Click to upload item photo
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
                    ref={priceImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file, 'price');
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => priceImageInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:border-blue-500 transition-colors"
                  >
                    {itemForm.priceImage ? (
                      <div className="text-sm text-green-600">
                        ✓ {itemForm.priceImage.name}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Click to upload price tag photo
                      </div>
                    )}
                  </button>
                </div>

                {/* Position Info */}
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="text-sm text-gray-600">
                    Position: {itemForm.x.toFixed(1)}%, {itemForm.y.toFixed(1)}%
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={cancelAddItem}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveItem}
                    disabled={isLoading || !itemForm.name.trim() || !itemForm.itemImage}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Saving...' : 'Save Item'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        {!showItemForm && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              <strong>Instructions:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Click anywhere on the floorplan to add a new item</li>
                <li>• Green pins show existing items (hover for details)</li>
                <li>• Upload clear photos for better customer experience</li>
                <li>• Items will be visible to customers searching your store</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
