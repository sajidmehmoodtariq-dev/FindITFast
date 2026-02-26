import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ItemService, StorePlanService } from '../../services/firestoreService';
import { fileToBase64, validateImageFile, compressImage } from '../../utilities/imageUtils';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';
import type { Store, Item, StorePlan } from '../../types';

interface FullScreenInventoryProps {
  store: Store;
  onClose: () => void;
}

interface NewItemForm {
  name: string;
  price: string;
  category: string;
  description: string;
  image: string | null;
  position: { x: number; y: number } | null;
  floorplanId: string | null;
}

type AddItemStep = 'items-list' | 'select-location' | 'item-form';

export const FullScreenInventory: React.FC<FullScreenInventoryProps> = ({ store, onClose }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [, setStorePlans] = useState<StorePlan[]>([]);
  const [activeStorePlan, setActiveStorePlan] = useState<StorePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<AddItemStep>('items-list');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const floorplanRef = useRef<HTMLImageElement>(null);
  
  const [newItem, setNewItem] = useState<NewItemForm>({
    name: '',
    price: '',
    category: '',
    description: '',
    image: null,
    position: null,
    floorplanId: null
  });
  
  // File size tracking state
  const [imageSizeInfo, setImageSizeInfo] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);

  // Load items and store plans on component mount
  useEffect(() => {
    loadData();
  }, [store.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load items and store plans in parallel
      const [storeItems, plans] = await Promise.all([
        ItemService.getByStore(store.id),
        StorePlanService.getByStore(store.id)
      ]);
      
      setItems(storeItems);
      setStorePlans(plans);
      
      // Set active store plan
      const activePlan = plans.find(plan => plan.isActive) || plans[0];
      setActiveStorePlan(activePlan || null);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewItem = () => {
    if (!activeStorePlan) {
      alert('Please upload a floorplan first to add items with locations.');
      return;
    }
    setCurrentStep('select-location');
  };

  const handleFloorplanClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (currentStep !== 'select-location' || !floorplanRef.current || !activeStorePlan) return;

    const rect = floorplanRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setNewItem(prev => ({
      ...prev,
      position: { x, y },
      floorplanId: activeStorePlan.id
    }));

    setCurrentStep('item-form');
  };

  const resetNewItem = () => {
    setNewItem({
      name: '',
      price: '',
      category: '',
      description: '',
      image: null,
      position: null,
      floorplanId: null
    });
    setImageSizeInfo(null);
    setCurrentStep('items-list');
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      alert('Please enter item name');
      return;
    }

    if (!newItem.position || !newItem.floorplanId) {
      alert('Please select a location on the floorplan first.');
      return;
    }

    try {
      // Clean price by removing $ and non-numeric characters except decimal point
      const cleanPrice = newItem.price ? newItem.price.replace(/[^\d.]/g, '') : undefined;

      const itemData = {
        name: newItem.name.trim(),
        price: cleanPrice || undefined,
        category: newItem.category.trim() || 'General',
        description: newItem.description.trim() || undefined,
        imageUrl: newItem.image || undefined,
        storeId: store.id,
        floorplanId: newItem.floorplanId,
        position: newItem.position,
        verified: true,
        verifiedAt: Timestamp.now(),
        reportCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await ItemService.create(itemData as any);
      
      // Reset form and reload items
      resetNewItem();
      await loadData();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error adding item. Please try again.');
    }
  };

  const handleImageUpload = async (file: File, _type: 'item' | 'price') => {
    try {
      console.log('🖼️ [DEBUG] handleImageUpload called with file:', file.name, 'size:', file.size);
      
      if (!validateImageFile(file, 5)) {
        alert('Please select a valid image file (max 5MB)');
        return;
      }

      const originalSize = file.size;
      console.log(`📁 [ITEM IMAGE] Original size:`, (originalSize / 1024 / 1024).toFixed(2), 'MB');

      // Compress the image
      const compressedFile = await compressImage(file, 800, 800, 0.7);
      const compressedSize = compressedFile.size;
      
      console.log(`🗜️ [ITEM IMAGE] Compressed size:`, (compressedSize / 1024 / 1024).toFixed(2), 'MB');
      console.log(`📊 [ITEM IMAGE] Compression ratio:`, ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%');
      
      // Convert to base64
      const base64 = await fileToBase64(compressedFile);
      
      setNewItem(prev => ({ 
        ...prev, 
        image: base64
      }));
      
      const sizeInfo = { originalSize, compressedSize };
      console.log('📋 [DEBUG] Setting imageSizeInfo:', sizeInfo);
      setImageSizeInfo(sizeInfo);
      
      console.log('✅ [DEBUG] Image upload complete, should show size info now');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    }
  };

  // Filter items based on search and category
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(items.map(item => item.category || 'General')));

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={currentStep === 'items-list' ? onClose : () => setCurrentStep('items-list')}
              className="p-2 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">{store.name}</h1>
              <p className="text-indigo-200 text-sm">
                {currentStep === 'items-list' && 'Item Management'}
                {currentStep === 'select-location' && 'Select Item Location'}
                {currentStep === 'item-form' && 'Add New Item'}
              </p>
            </div>
          </div>
          
          {currentStep === 'items-list' && (
            <button
              onClick={handleAddNewItem}
              className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
            >
              + Add Item
            </button>
          )}
        </div>

        {/* Search and Filter - only show on items list */}
        {currentStep === 'items-list' && (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg text-gray-900 placeholder-gray-500"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex space-x-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${
                  filterCategory === 'all' 
                    ? 'bg-white text-indigo-600' 
                    : 'bg-indigo-500 text-white hover:bg-indigo-400'
                }`}
              >
                All ({items.length})
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${
                    filterCategory === category 
                      ? 'bg-white text-indigo-600' 
                      : 'bg-indigo-500 text-white hover:bg-indigo-400'
                  }`}
                >
                  {category} ({items.filter(item => item.category === category).length})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading items...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Items List View */}
            {currentStep === 'items-list' && (
              <div className="h-full overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-8">
                    <div className="text-center">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
                      <p className="text-gray-600 mb-4">
                        {searchQuery || filterCategory !== 'all' 
                          ? 'No items match your search criteria'
                          : 'Start adding items to your store'
                        }
                      </p>
                      <button
                        onClick={handleAddNewItem}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Add First Item
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="p-4">
                          <div className="flex items-start space-x-4">
                            {/* Item Image */}
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900 line-clamp-2">{item.name}</h3>
                                  {item.category && (
                                    <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full mt-1">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                {item.price && (
                                  <div className="text-right ml-4">
                                    <p className="text-lg font-bold text-green-600">${parseFloat(item.price).toFixed(2)}</p>
                                  </div>
                                )}
                              </div>
                              
                              {item.description && (
                                <p className="text-gray-600 text-sm mt-2 line-clamp-2">{item.description}</p>
                              )}
                              
                              {/* Action Buttons */}
                              <div className="flex items-center space-x-3 mt-3">
                                <button
                                  onClick={() => setSelectedItem(item)}
                                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                >
                                  View Details
                                </button>
                                <span className="text-gray-300">•</span>
                                <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Select Location View */}
            {currentStep === 'select-location' && activeStorePlan && (
              <div className="h-full flex flex-col bg-gray-50">
                <div className="p-4 bg-blue-50 border-b border-blue-200">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-blue-800 text-sm font-medium">
                      Click on the floorplan where you want to place the new item
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 p-4 overflow-auto">
                  <div className="flex justify-center">
                    <div className="relative inline-block border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white">
                      <img
                        ref={floorplanRef}
                        src={getStorePlanImageUrl(activeStorePlan)}
                        alt={`${store.name} floorplan`}
                        className="max-w-full max-h-[calc(100vh-200px)] cursor-crosshair"
                        onClick={handleFloorplanClick}
                      />
                      
                      {/* Show existing item pins */}
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 opacity-50"
                          style={{ 
                            left: `${(item.position as any)?.x || 0}%`, 
                            top: `${(item.position as any)?.y || 0}%` 
                          }}
                        >
                          <div className="w-6 h-6 bg-gray-400 rounded-full border-2 border-white shadow-md"></div>
                        </div>
                      ))}
                      
                      {/* Show selected position */}
                      {newItem.position && (
                        <div
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                          style={{ 
                            left: `${newItem.position.x}%`, 
                            top: `${newItem.position.y}%` 
                          }}
                        >
                          <div className="w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-lg"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Item Form View */}
            {currentStep === 'item-form' && (
              <div className="h-full overflow-y-auto">
                <div className="max-w-lg mx-auto p-6">
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Add New Item</h2>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>

                      <div className="space-y-6">
                        {/* Item Name */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Item Name *
                          </label>
                          <input
                            type="text"
                            value={newItem.name}
                            onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter item name"
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                          />
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Price
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
                              className="w-full p-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-gray-400 text-sm">AUD</span>
                            </div>
                          </div>
                        </div>

                        {/* Category */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Category
                          </label>
                          <input
                            type="text"
                            value={newItem.category}
                            onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="e.g., Electronics, Clothing"
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Description
                          </label>
                          <textarea
                            value={newItem.description}
                            onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Item description..."
                            rows={4}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none"
                          />
                        </div>

                        {/* Item Image */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Item Image
                          </label>
                          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
                            {newItem.image ? (
                              <div className="space-y-3">
                                <img
                                  src={newItem.image}
                                  alt="Item preview"
                                  className="max-w-full h-32 object-contain mx-auto rounded-lg"
                                />
                                {imageSizeInfo && (
                                  <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded-lg">
                                    <div className="flex justify-between">
                                      <span>Original:</span>
                                      <span className="font-medium">{(imageSizeInfo.originalSize / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Compressed:</span>
                                      <span className="font-medium text-green-600">{(imageSizeInfo.compressedSize / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Saved:</span>
                                      <span className="font-medium text-blue-600">{((1 - imageSizeInfo.compressedSize / imageSizeInfo.originalSize) * 100).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    setNewItem(prev => ({ ...prev, image: null }));
                                    setImageSizeInfo(null);
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Remove Image
                                </button>
                              </div>
                            ) : (
                              <div>
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-gray-600 mb-2">Upload item image</p>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'item')}
                                  className="hidden"
                                  id="item-image-upload"
                                />
                                <label
                                  htmlFor="item-image-upload"
                                  className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors inline-block"
                                >
                                  Choose Image
                                </label>
                                
                                {/* File Size Information - Debug: imageSizeInfo should show here when set */}
                                {imageSizeInfo && (
                                  <div className="mt-3 space-y-1">
                                    <div className="flex justify-between items-center text-sm text-gray-600">
                                      <span>Original size:</span>
                                      <span className="font-medium">{(imageSizeInfo.originalSize / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-gray-600">
                                      <span>Compressed size:</span>
                                      <span className="font-medium text-green-600">{(imageSizeInfo.compressedSize / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-gray-500">
                                      <span>Compression ratio:</span>
                                      <span className="font-medium text-blue-600">
                                        {((1 - imageSizeInfo.compressedSize / imageSizeInfo.originalSize) * 100).toFixed(1)}% smaller
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-3 pt-4">
                          <button
                            onClick={resetNewItem}
                            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddItem}
                            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!newItem.name.trim()}
                          >
                            Add Item
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Item Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Item Details</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {selectedItem.imageUrl && (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="w-full h-48 object-cover rounded-xl"
                  />
                )}
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{selectedItem.name}</h4>
                  {selectedItem.category && (
                    <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                      {selectedItem.category}
                    </span>
                  )}
                </div>

                {selectedItem.price && (
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="text-2xl font-bold text-green-600">${parseFloat(selectedItem.price).toFixed(2)}</p>
                  </div>
                )}

                {selectedItem.description && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Description</p>
                    <p className="text-gray-900">{selectedItem.description}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Added {selectedItem.createdAt instanceof Date 
                      ? selectedItem.createdAt.toLocaleDateString() 
                      : 'Unknown date'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
