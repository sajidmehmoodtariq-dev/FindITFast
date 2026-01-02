import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ItemService, StorePlanService } from '../../services/firestoreService';
import { validateAndPrepareImage } from '../../utils/imageCompression';
import { validateImageFile } from '../../utilities/imageUtils';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';
import { useAuth } from '../../contexts/AuthContext';
import type { Store, Item, StorePlan } from '../../types';

interface FullScreenInventoryProps {
  store: Store;
  storePlans?: StorePlan[];
  onClose: () => void;
}

interface NewItemForm {
  name: string;
  price: string;
  category: string;
  description: string;
  image: string | null;
  imageFile: File | null;
  position: { x: number; y: number } | null;
  floorplanId: string | null;
}

type AddItemStep = 'items-list' | 'select-location' | 'item-form';

export const FullScreenInventory: React.FC<FullScreenInventoryProps> = ({ store, storePlans: propStorePlans, onClose }) => {
  const { user, ownerProfile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [storePlans, setStorePlans] = useState<StorePlan[]>([]);
  const [activeStorePlan, setActiveStorePlan] = useState<StorePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AddItemStep>('items-list');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Zoom functionality for floorplan
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  
  // Location selection state
  const [blinkPosition, setBlinkPosition] = useState<{ x: number; y: number } | null>(null);
  const [showNextButton, setShowNextButton] = useState(false);
  
  // File size tracking
  const [imageSizeInfo, setImageSizeInfo] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);
  
  const floorplanRef = useRef<HTMLImageElement>(null);
  
  const [newItem, setNewItem] = useState<NewItemForm>({
    name: '',
    price: '',
    category: '',
    description: '',
    image: null,
    imageFile: null,
    position: null,
    floorplanId: null
  });

  // Load items and store plans on component mount
  useEffect(() => {
    loadData();
  }, [store.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load items for this store
      const storeItems = await ItemService.getByStore(store.id);
      console.log('Loaded items:', storeItems);
      setItems(storeItems);
      
      // Use passed store plans or load them
      let plans = propStorePlans || [];
      if (!plans || plans.length === 0) {
        try {
          plans = await StorePlanService.getByStore(store.id);
          console.log('Loaded store plans:', plans);
        } catch (error) {
          console.error('Error loading store plans:', error);
          plans = [];
        }
      }
      
      setStorePlans(plans);
      
      // Set active store plan
      const activePlan = plans.find(plan => plan.isActive) || plans[0];
      console.log('Active plan selected:', activePlan);
      setActiveStorePlan(activePlan || null);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Zoom functionality functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleAddNewItem = () => {
    console.log('Store plans:', storePlans);
    console.log('Active store plan:', activeStorePlan);
    
    if (storePlans.length === 0) {
      alert('No floorplans found for this store. Please upload a floorplan first in the Floorplan Manager.');
      return;
    }
    
    if (!activeStorePlan) {
      alert('No active floorplan found. Please set an active floorplan first.');
      return;
    }
    
    setCurrentStep('select-location');
  };

  const handleFloorplanClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (currentStep !== 'select-location' || !floorplanRef.current || !activeStorePlan) return;

    const imgElement = floorplanRef.current;
    
    // Get precise bounding rectangle
    const rect = imgElement.getBoundingClientRect();
    
    // Get exact click coordinates with sub-pixel precision
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Get natural image dimensions
    const naturalWidth = imgElement.naturalWidth;
    const naturalHeight = imgElement.naturalHeight;
    const naturalRatio = naturalWidth / naturalHeight;
    
    // Get container dimensions
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const containerRatio = containerWidth / containerHeight;
    
    // Calculate exact rendered dimensions (object-fit: contain)
    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX: number;
    let offsetY: number;
    
    if (naturalRatio > containerRatio) {
      // Image is wider - constrained by container width
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / naturalRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      // Image is taller - constrained by container height
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * naturalRatio;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    }
    
    // Calculate position within the rendered image
    const imageX = clickX - offsetX;
    const imageY = clickY - offsetY;
    
    // Strict bounds validation
    if (imageX < 0 || imageX > renderedWidth || imageY < 0 || imageY > renderedHeight) {
      return; // Click is outside the actual image
    }
    
    // Apply reverse zoom and pan transformations with high precision
    const centerX = renderedWidth / 2;
    const centerY = renderedHeight / 2;
    
    // Calculate position in original image space (before zoom/pan)
    const originalX = (imageX - centerX - imagePosition.x) / zoomLevel + centerX;
    const originalY = (imageY - centerY - imagePosition.y) / zoomLevel + centerY;
    
    // Convert to percentage coordinates with maximum precision
    const percentageX = Math.max(0, Math.min(100, (originalX / renderedWidth) * 100));
    const percentageY = Math.max(0, Math.min(100, (originalY / renderedHeight) * 100));
    
    // Final validation
    if (percentageX < 0 || percentageX > 100 || percentageY < 0 || percentageY > 100) {
      return;
    }
    
    const position = { x: percentageX, y: percentageY };

    setNewItem(prev => ({
      ...prev,
      position,
      floorplanId: activeStorePlan.id
    }));

    // Show blinking effect and next button
    setBlinkPosition(position);
    setShowNextButton(true);

    // Clear blink effect after 2 seconds
    setTimeout(() => {
      setBlinkPosition(null);
    }, 2000);
  };

  const resetNewItem = () => {
    setNewItem({
      name: '',
      price: '',
      category: '',
      description: '',
      image: null,
      imageFile: null,
      position: null,
      floorplanId: null
    });
    setImageSizeInfo(null);
    setCurrentStep('items-list');
    setShowNextButton(false);
    setBlinkPosition(null);
    setError(null);
  };

  const handleNextFromLocation = () => {
    setCurrentStep('item-form');
    setShowNextButton(false);
    setBlinkPosition(null);
    setError(null);
  };

  const handleBackFromLocation = () => {
    resetNewItem();
  };

  const handleBackFromForm = () => {
    setNewItem(prev => ({ ...prev, position: null, floorplanId: null }));
    setCurrentStep('select-location');
    setShowNextButton(false);
    setBlinkPosition(null);
  };

  const handleImageUpload = async (file: File) => {
    try {
      if (!validateImageFile(file, 5)) {
        alert('Please select a valid image file (max 5MB)');
        return;
      }

      const originalSize = file.size;

      // Validate and prepare the image
      const imageResult = await validateAndPrepareImage(file, 'main');
      
      if (!imageResult.isValid) {
        alert(`Image validation failed: ${imageResult.errors.join(', ')}`);
        return;
      }

      const compressedSize = imageResult.compressionResult.compressedFile?.size || imageResult.compressionResult.compressedSize || 0;
      
      // Store both preview and File object for later compression
      setNewItem(prev => ({ 
        ...prev, 
        image: imageResult.base64,
        imageFile: imageResult.compressionResult.compressedFile
      }));

      // Set file size information
      setImageSizeInfo({ originalSize, compressedSize });
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleSubmitItem = async () => {
    try {
      setError(null);
      
      if (!newItem.name || !newItem.position || !newItem.floorplanId) {
        setError('Please fill in all required fields and select a location.');
        return;
      }

      // Check authentication
      if (!user) {
        setError('You must be logged in to add items.');
        return;
      }

      if (!ownerProfile) {
        setError('Store owner profile not found. Please ensure you are logged in as a store owner.');
        return;
      }

      // Verify the store belongs to the current user
      if (store.ownerId !== user.uid) {
        setError('You can only add items to your own stores.');
        return;
      }

      setSubmittingItem(true);

      console.log('Authentication check:', {
        user: user?.uid,
        ownerProfile: ownerProfile?.id,
        storeOwnerId: store.ownerId,
        storeId: store.id
      });

      let imageUrl = '';
      
      // Process image if provided (compress and convert to base64)
      if (newItem.image && newItem.imageFile) {
        const itemValidation = await validateAndPrepareImage(newItem.imageFile, 'main');
        
        if (!itemValidation.isValid) {
          throw new Error(`Item image processing failed: ${itemValidation.errors.join(', ')}`);
        }
        
        console.log('🖼️ Item image compressed:', {
          originalSize: `${(itemValidation.compressionResult.originalSize / 1024).toFixed(2)} KB`,
          compressedSize: `${(itemValidation.compressionResult.compressedSize / 1024).toFixed(2)} KB`,
          compressionRatio: `${itemValidation.compressionResult.compressionRatio.toFixed(1)}%`
        });
        
        // Use base64 instead of Firebase Storage upload to avoid CORS issues
        imageUrl = itemValidation.base64;
      }

      // Clean price by removing $ and non-numeric characters except decimal point
      const cleanPrice = newItem.price ? newItem.price.replace(/[^\d.]/g, '') : undefined;

      const itemData = {
        name: newItem.name,
        price: cleanPrice || undefined,
        category: newItem.category || undefined,
        description: newItem.description || undefined,
        imageUrl: imageUrl,
        storeId: store.id,
        floorplanId: newItem.floorplanId,
        position: newItem.position,
        verified: true,
        verifiedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        reportCount: 0,
        // Metadata fields for Safari/iOS compatibility
        hasImageData: !!imageUrl,
        imageMimeType: newItem.image ? 'image/jpeg' : undefined,
        imageSize: newItem.image ? newItem.image.length : undefined,
      };

      console.log('Creating item with data:', itemData);
      const itemId = await ItemService.create(itemData as Omit<Item, 'id'>);
      console.log('Item created successfully with ID:', itemId);
      
      // Reload data
      await loadData();
      
      // Reset form
      resetNewItem();
      
      setError(null);
      alert('Item added successfully!');
      
    } catch (error) {
      console.error('Error adding item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to add item: ${errorMessage}`);
    } finally {
      setSubmittingItem(false);
    }
  };

  // Filter items based on search and category
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = filterCategory === 'all' || 
                           (item.category && item.category.toLowerCase() === filterCategory.toLowerCase());
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(items.map(item => item.category).filter(Boolean)));
  
  // Sample categories to show in dropdown
  const sampleCategories = [
    'Electronics', 'Clothing', 'Food & Beverages', 'Books', 'Home & Garden',
    'Sports & Outdoors', 'Health & Beauty', 'Toys & Games', 'Tools & Hardware',
    'Office Supplies', 'Automotive', 'Jewelry & Accessories'
  ];
  
  // Combine existing categories with sample categories
  const allCategories = Array.from(new Set([...categories, ...sampleCategories])).sort();

  return (
    <div className="fixed inset-0 bg-white bg-opacity-95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={currentStep === 'items-list' ? onClose : 
                      currentStep === 'select-location' ? handleBackFromLocation : handleBackFromForm}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold">{store.name}</h1>
              <p className="text-indigo-200 text-sm">
                {currentStep === 'items-list' && 'Item Management'}
                {currentStep === 'select-location' && 'Select Item Location'}
                {currentStep === 'item-form' && 'Add New Item'}
              </p>
            </div>
          </div>
          {currentStep === 'items-list' && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
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
              <div className="h-full flex flex-col">
                {/* Search and Filter Bar */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search items..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Categories</option>
                      {allCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddNewItem}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="flex-1 overflow-auto p-4">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Items Found</h3>
                      <p className="text-gray-600 mb-6">
                        {searchQuery || filterCategory !== 'all' 
                          ? 'No items match your search criteria.' 
                          : 'Start by adding your first item to this store.'}
                      </p>
                      <button
                        onClick={handleAddNewItem}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors"
                      >
                        Add First Item
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-200"
                        >
                          {item.imageUrl && (
                            <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">{item.name}</h4>
                          {item.category && (
                            <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-md mb-2">
                              {item.category}
                            </span>
                          )}
                          {item.price && (
                            <p className="text-lg font-bold text-green-600 mb-2">${parseFloat(item.price).toFixed(2)}</p>
                          )}
                          {item.description && (
                            <p className="text-sm text-gray-600 line-clamp-3 mb-3">{item.description}</p>
                          )}
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
                          >
                            View Details
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                      Click anywhere on the floorplan to place your item. Use mouse wheel to zoom and drag to pan.
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 p-4 overflow-auto">
                  <div className="flex justify-center">
                    <div className="relative inline-block border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white">
                      
                      {/* Zoom Controls */}
                      <div className="absolute top-4 left-4 z-20 flex flex-col bg-white bg-opacity-90 rounded-lg shadow-lg border">
                        <button
                          onClick={handleZoomIn}
                          className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
                          title="Zoom In"
                        >
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                        <button
                          onClick={handleZoomOut}
                          className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
                          title="Zoom Out"
                        >
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                          </svg>
                        </button>
                        <button
                          onClick={handleResetZoom}
                          className="p-3 hover:bg-gray-100 transition-colors"
                          title="Reset Zoom"
                        >
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>

                      {/* Zoom Level Indicator */}
                      {zoomLevel !== 1 && (
                        <div className="absolute top-4 right-4 z-20">
                          <div className="bg-blue-500 text-white text-sm px-3 py-1 rounded-md shadow-lg">
                            {Math.round(zoomLevel * 100)}%
                          </div>
                        </div>
                      )}

                      {/* Zoomable Floorplan Container */}
                      <div 
                        className="relative w-full h-full overflow-hidden"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ 
                          cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'crosshair'
                        }}
                      >
                        {/* Image container with zoom and pan */}
                        <div 
                          className="relative w-full h-full"
                          style={{
                            transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                            transformOrigin: 'center'
                          }}
                        >
                          <img
                            ref={floorplanRef}
                            src={getStorePlanImageUrl(activeStorePlan)}
                            alt={`${store.name} floorplan`}
                            className="max-w-full max-h-[calc(100vh-200px)] transition-transform duration-200"
                            onClick={handleFloorplanClick}
                            draggable={false}
                          />
                          
                          {/* Show existing item pins */}
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="absolute z-20 pointer-events-none opacity-50"
                              style={{ 
                                left: `${(item.position as any)?.x || 0}%`, 
                                top: `${(item.position as any)?.y || 0}%`,
                                transform: `translate(-50%, -50%)`
                              }}
                            >
                              <div className="w-6 h-6 bg-gray-400 rounded-full border-2 border-white shadow-md"></div>
                            </div>
                          ))}
                          
                          {/* Show blinking effect at click location */}
                          {blinkPosition && (
                            <div
                              className="absolute z-30 pointer-events-none"
                              style={{ 
                                left: `${blinkPosition.x}%`, 
                                top: `${blinkPosition.y}%`,
                                transform: `translate(-50%, -50%)`
                              }}
                            >
                              <div className="relative">
                                {/* Pulsing ring effect */}
                                <div className="absolute inset-0 w-12 h-12 bg-blue-500 rounded-full animate-ping opacity-75" 
                                     style={{ transform: `translate(-50%, -50%)` }}></div>
                                <div className="absolute inset-0 w-8 h-8 bg-blue-600 rounded-full animate-pulse"
                                     style={{ transform: `translate(-50%, -50%)` }}></div>
                                {/* Center dot */}
                                <div className="absolute w-12 h-12 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                                     style={{ transform: `translate(-50%, -50%)` }}>
                                  <div className="w-4 h-4 bg-white rounded-full"></div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Show selected position */}
                          {newItem.position && !blinkPosition && (
                            <div
                              className="absolute z-30 pointer-events-none animate-pulse"
                              style={{ 
                                left: `${newItem.position.x}%`, 
                                top: `${newItem.position.y}%`,
                                transform: `translate(-50%, -50%)`
                              }}
                            >
                              <div className="w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Button - Fixed at bottom with proper spacing */}
                {showNextButton && newItem.position && (
                  <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-30">
                    <div className="mb-4"> {/* Add margin to prevent overlap */}
                      <button
                        onClick={handleNextFromLocation}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-3 font-semibold text-lg"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Next: Add Item Details</span>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Item Form View */}
            {currentStep === 'item-form' && (
              <div className="h-full overflow-auto">
                <div className="max-w-2xl mx-auto p-6">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Add New Item</h2>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>

                    <form className="space-y-6">
                      {/* Error Display */}
                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-red-800 font-medium">{error}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Item Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Item Name *
                        </label>
                        <input
                          type="text"
                          value={newItem.name}
                          onChange={(e) => {
                            setNewItem(prev => ({ ...prev, name: e.target.value }));
                            if (error) setError(null);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Enter item name"
                          required
                        />
                      </div>

                      {/* Price and Category Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="$0.00"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-gray-400 text-sm">AUD</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                          </label>
                          <input
                            type="text"
                            list="categories"
                            value={newItem.category}
                            onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Select or type a category"
                          />
                          <datalist id="categories">
                            {allCategories.map((category) => (
                              <option key={category} value={category} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={newItem.description}
                          onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Describe the item..."
                        />
                      </div>

                      {/* Image Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Item Image
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          {newItem.image ? (
                            <div className="space-y-4">
                              <img
                                src={newItem.image}
                                alt="Item preview"
                                className="max-w-full max-h-48 mx-auto rounded-lg"
                              />
                              {imageSizeInfo && (
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>Original size: {(imageSizeInfo.originalSize / 1024).toFixed(1)} KB</div>
                                  <div>Compressed size: {(imageSizeInfo.compressedSize / 1024).toFixed(1)} KB</div>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setNewItem(prev => ({ ...prev, image: null, imageFile: null }));
                                  setImageSizeInfo(null);
                                }}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                Remove Image
                              </button>
                            </div>
                          ) : (
                            <div>
                              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-gray-600 mb-2">Upload item image</p>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file);
                                }}
                                className="hidden"
                                id="item-image"
                              />
                              <label
                                htmlFor="item-image"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors"
                              >
                                Choose Image
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Location Info */}
                      {newItem.position && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-green-800 font-medium">Location selected on floorplan</span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex space-x-4 pt-6">
                        <button
                          type="button"
                          onClick={handleBackFromForm}
                          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Change Location
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitItem}
                          disabled={submittingItem}
                          className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
                        >
                          {submittingItem ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Adding Item...
                            </>
                          ) : (
                            'Add Item'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Item Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Item Details</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {selectedItem.imageUrl && (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}

                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{selectedItem.name}</h4>
                  {selectedItem.category && (
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-md">
                      {selectedItem.category}
                    </span>
                  )}
                </div>

                {selectedItem.price && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Price</p>
                    <p className="text-2xl font-bold text-green-600">${parseFloat(selectedItem.price || '0').toFixed(2)}</p>
                  </div>
                )}

                {selectedItem.description && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Description</p>
                    <p className="text-gray-900">{selectedItem.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
