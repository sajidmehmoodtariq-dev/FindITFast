import React, { useState, useRef, useCallback } from 'react';
import { validateImageFile, fileToBase64 } from '../../utilities/imageUtils';
import { validateAndPrepareImage } from '../../utils/imageCompression';
import { ItemService } from '../../services/firestoreService';
import { ItemStorageService } from '../../services/storageService';
import { ItemVerificationService } from '../../services/itemVerificationService';
import type { Item } from '../../types';

interface ItemManagerProps {
  storeId: string;
  floorplanUrl: string;
  existingItems?: Item[];
  onItemAdded: (item: Item) => void;
  onError: (error: string) => void;
}

interface ItemPosition {
  x: number;
  y: number;
}

interface ItemFormData {
  name: string;
  price?: number;
  priceDisplay: string; // For displaying formatted price with $
  itemImage: File | null;
  priceImage: File | null;
}

export const ItemManager: React.FC<ItemManagerProps> = ({
  storeId,
  floorplanUrl,
  existingItems = [],
  onItemAdded,
  onError,
}) => {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<ItemPosition | null>(null);
  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    price: undefined,
    priceDisplay: '$',
    itemImage: null,
    priceImage: null,
  });
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);
  const [priceImagePreview, setPriceImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const floorplanRef = useRef<HTMLImageElement>(null);
  const itemImageInputRef = useRef<HTMLInputElement>(null);
  const priceImageInputRef = useRef<HTMLInputElement>(null);

  // Handle floorplan tap to add item location
  const handleFloorplanClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (!floorplanRef.current) return;

    const rect = floorplanRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100; // Convert to percentage
    const y = ((event.clientY - rect.top) / rect.height) * 100; // Convert to percentage

    setSelectedPosition({ x, y });
    setIsAddingItem(true);
  }, []);

  // Handle item image selection
  const handleItemImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file, 5)) {
      onError('Please select a valid image file (JPEG, PNG, WebP) under 5MB');
      return;
    }

    try {
      const preview = await fileToBase64(file);
      setFormData(prev => ({ ...prev, itemImage: file }));
      setItemImagePreview(preview);
    } catch (err) {
      onError('Failed to process item image');
      console.error('Item image processing error:', err);
    }
  };

  // Handle price tag image selection
  const handlePriceImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file, 5)) {
      onError('Please select a valid image file (JPEG, PNG, WebP) under 5MB');
      return;
    }

    try {
      const preview = await fileToBase64(file);
      setFormData(prev => ({ ...prev, priceImage: file }));
      setPriceImagePreview(preview);
    } catch (err) {
      onError('Failed to process price tag image');
      console.error('Price image processing error:', err);
    }
  };

  // Handle form input changes
  const handleInputChange = (field: keyof ItemFormData, value: string | number) => {
    if (field === 'priceDisplay') {
      // Handle price display formatting
      const stringValue = String(value);
      
      // Remove all non-digit and non-decimal characters except for the first character if it's $
      let cleaned = stringValue.replace(/[^\d.]/g, '');
      
      // Ensure only one decimal point
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
      }
      
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length > 2) {
        cleaned = parts[0] + '.' + parts[1].substring(0, 2);
      }
      
      // Format with $ sign
      const formattedValue = cleaned ? `$${cleaned}` : '$';
      
      setFormData(prev => ({
        ...prev,
        priceDisplay: formattedValue,
        price: cleaned ? Number(cleaned) : undefined
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: field === 'price' ? (value === '' ? undefined : Number(value)) : value
      }));
    }
  };

  // Validate form data
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      onError('Item name is required');
      return false;
    }

    const words = formData.name.trim().split(/\s+/);
    if (words.length > 2) {
      onError('Item name must be maximum 2 words');
      return false;
    }

    if (!formData.itemImage) {
      onError('Item photo is required');
      return false;
    }

    return true;
  };

  // Submit new item
  const handleSubmit = async () => {
    if (!selectedPosition || !validateForm()) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Compress and validate item image
      const itemValidation = await validateAndPrepareImage(formData.itemImage!, 'main');
      
      if (!itemValidation.isValid) {
        throw new Error(`Item image processing failed: ${itemValidation.errors.join(', ')}`);
      }
      
      console.log('🖼️ Item image compressed:', {
        originalSize: `${(itemValidation.compressionResult.originalSize / 1024).toFixed(2)} KB`,
        compressedSize: `${(itemValidation.compressionResult.compressedSize / 1024).toFixed(2)} KB`,
        compressionRatio: `${itemValidation.compressionResult.compressionRatio.toFixed(1)}%`
      });
      
      setUploadProgress(50);

      let priceImageUrl: string | undefined;
      
      // Compress and upload price image if provided
      if (formData.priceImage) {
        const priceValidation = await validateAndPrepareImage(formData.priceImage, 'thumbnail');
        
        if (!priceValidation.isValid) {
          throw new Error(`Price image processing failed: ${priceValidation.errors.join(', ')}`);
        }
        
        console.log('🏷️ Price image compressed:', {
          originalSize: `${(priceValidation.compressionResult.originalSize / 1024).toFixed(2)} KB`,
          compressedSize: `${(priceValidation.compressionResult.compressedSize / 1024).toFixed(2)} KB`,
          compressionRatio: `${priceValidation.compressionResult.compressionRatio.toFixed(1)}%`
        });
        
        priceImageUrl = await ItemStorageService.uploadPriceImage(
          priceValidation.compressionResult.compressedFile,
          storeId,
          (progress) => setUploadProgress(50 + progress * 0.5) // Second 50% of progress
        );
      } else {
        setUploadProgress(100);
      }

      // Create item data (without verification fields - service will add them)
      const itemData: Omit<Item, 'id' | 'verified' | 'verifiedAt' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.toLowerCase().trim(),
        storeId,
        imageUrl: itemValidation.base64, // Use compressed base64 instead of storage URL
        priceImageUrl,
        position: selectedPosition,
        price: formData.price?.toString(),
        reportCount: 0,
        lastConfirmedAt: null,
        weeklyGreenCount: 0,
        weeklyYellowCount: 0,
        recentRedCount24h: 0,
        statusOverride: null,
      };

      // Save to Firestore with automatic verification
      const itemId = await ItemVerificationService.createVerifiedItem(itemData);
      
      // Get the created item to return complete data
      const createdItem = await ItemService.getById(itemId);
      if (!createdItem) {
        throw new Error('Failed to retrieve created item');
      }

      // Notify parent component
      onItemAdded(createdItem);

      // Reset form
      resetForm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add item';
      onError(errorMessage);
      console.error('Item creation error:', err);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Reset form and close modal
  const resetForm = () => {
    setIsAddingItem(false);
    setSelectedPosition(null);
    setFormData({
      name: '',
      price: undefined,
      priceDisplay: '$',
      itemImage: null,
      priceImage: null,
    });
    setItemImagePreview(null);
    setPriceImagePreview(null);
    setUploadProgress(0);

    // Clear file inputs
    if (itemImageInputRef.current) itemImageInputRef.current.value = '';
    if (priceImageInputRef.current) priceImageInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Item Management
      </h3>

      {/* Instructions */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-700 font-medium">How to add items:</p>
            <p className="text-sm text-blue-600 mt-1">
              Tap anywhere on your store floorplan below to add an item at that location. 
              You'll be prompted to upload a photo and enter item details.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Floorplan */}
      <div className="relative mb-6">
        <div className="relative inline-block">
          <img
            ref={floorplanRef}
            src={floorplanUrl}
            alt="Store floorplan - tap to add items"
            className="w-full max-w-2xl h-auto rounded-lg border-2 border-dashed border-gray-300 cursor-crosshair hover:border-blue-400 transition-colors"
            onClick={handleFloorplanClick}
          />
          
          {/* Existing item pins */}
          {existingItems.filter(item => item.position).map((item) => (
            <div
              key={item.id}
              className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:bg-red-600 transition-colors"
              style={{
                left: `${item.position!.x}%`,
                top: `${item.position!.y}%`,
              }}
              title={item.name}
            />
          ))}

          {/* Selected position indicator */}
          {selectedPosition && (
            <div
              className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
              style={{
                left: `${selectedPosition.x}%`,
                top: `${selectedPosition.y}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* Item count display */}
      <div className="mb-4 text-sm text-gray-600">
        Current items: {existingItems.length}
      </div>

      {/* Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Add New Item
              </h4>

              {/* Item Name Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name (max 2 words) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Dove Shampoo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                />
              </div>

              {/* Price Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.priceDisplay}
                    onChange={(e) => handleInputChange('priceDisplay', e.target.value)}
                    placeholder="$0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-sm">AUD</span>
                  </div>
                </div>
              </div>

              {/* Item Image Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Photo *
                </label>
                <input
                  ref={itemImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleItemImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => itemImageInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {formData.itemImage ? 'Change Photo' : 'Select Photo'}
                </button>
                {itemImagePreview && (
                  <div className="mt-2">
                    <img
                      src={itemImagePreview}
                      alt="Item preview"
                      className="w-20 h-20 object-cover rounded border"
                    />
                  </div>
                )}
              </div>

              {/* Price Tag Image Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Tag Photo (optional)
                </label>
                <input
                  ref={priceImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePriceImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => priceImageInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {formData.priceImage ? 'Change Price Tag' : 'Select Price Tag'}
                </button>
                {priceImagePreview && (
                  <div className="mt-2">
                    <img
                      src={priceImagePreview}
                      alt="Price tag preview"
                      className="w-20 h-20 object-cover rounded border"
                    />
                  </div>
                )}
              </div>

              {/* Upload Progress */}
              {isSubmitting && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.name.trim() || !formData.itemImage}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  {isSubmitting ? 'Adding Item...' : 'Add Item'}
                </button>

                <button
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={itemImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleItemImageSelect}
        className="hidden"
      />
      <input
        ref={priceImageInputRef}
        type="file"
        accept="image/*"
        onChange={handlePriceImageSelect}
        className="hidden"
      />
    </div>
  );
};