/**
 * Rapid Item Capture Component
 * Ultra-fast item upload: Photo → Location → Next (3 taps, ~3-4 seconds)
 * AI processes in background: extracts price, identifies category
 */

import React, { useState, useRef, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ItemService } from '../../services/firestoreService';
import { GroqService } from '../../services/groqService';
import { validateAndPrepareImage } from '../../utils/imageCompression';
import { validateImageFile } from '../../utilities/imageUtils';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';
import { useAuth } from '../../contexts/AuthContext';
import type { Store, StorePlan, Item } from '../../types';

interface RapidItemCaptureProps {
  store: Store;
  storePlans: StorePlan[];
  onClose: () => void;
  onItemAdded?: () => void;
}

interface CaptureItem {
  id: string;
  image: string; // base64
  imageFile: File;
  position: { x: number; y: number } | null;
  floorplanId: string | null;
  // AI-populated fields (processing in background)
  name?: string;
  category?: string;
  price?: string;
  description?: string;
  aiConfidence?: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  // User can edit before final save
  edited?: boolean;
}

type CaptureStep = 'photo' | 'location' | 'processing';

export const RapidItemCapture: React.FC<RapidItemCaptureProps> = ({
  store,
  storePlans,
  onClose,
  onItemAdded
}) => {
  const { user, ownerProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<CaptureStep>('photo');
  const [capturedItems, setCapturedItems] = useState<CaptureItem[]>([]);
  const [currentItem, setCurrentItem] = useState<CaptureItem | null>(null);
  const [activeStorePlan, setActiveStorePlan] = useState<StorePlan | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Image position for zoom/pan
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [blinkPosition, setBlinkPosition] = useState<{ x: number; y: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const floorplanRef = useRef<HTMLImageElement>(null);
  const processingQueueRef = useRef<string[]>([]);

  useEffect(() => {
    // Set first active store plan
    if (storePlans.length > 0 && !activeStorePlan) {
      setActiveStorePlan(storePlans[0]);
    }
  }, [storePlans]);

  // Background AI processing queue
  useEffect(() => {
    const processQueue = async () => {
      const pendingItems = capturedItems.filter(
        item => item.processingStatus === 'pending' && !processingQueueRef.current.includes(item.id)
      );

      for (const item of pendingItems) {
        processingQueueRef.current.push(item.id);
        processItemWithAI(item);
      }
    };

    processQueue();
  }, [capturedItems]);

  const processItemWithAI = async (item: CaptureItem) => {
    try {
      setCapturedItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? { ...i, processingStatus: 'processing' as const }
            : i
        )
      );

      console.log(`🤖 Processing item ${item.id} with Groq AI...`);
      const analysis = await GroqService.analyzeItemImage(item.image);

      setCapturedItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                name: analysis.itemName,
                category: analysis.category,
                price: analysis.price || undefined,
                description: analysis.description,
                aiConfidence: analysis.confidence,
                processingStatus: 'completed' as const,
              }
            : i
        )
      );

      console.log(`✅ Item ${item.id} processed:`, analysis);
    } catch (error) {
      console.error(`❌ Failed to process item ${item.id}:`, error);
      setCapturedItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                name: 'Unknown Item',
                category: 'Other',
                processingStatus: 'failed' as const,
              }
            : i
        )
      );
    } finally {
      processingQueueRef.current = processingQueueRef.current.filter(id => id !== item.id);
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);

      if (!validateImageFile(file, 5)) {
        setError('Please select a valid image file (max 5MB)');
        return;
      }

      // Compress image
      const imageResult = await validateAndPrepareImage(file, 'main');
      if (!imageResult.isValid) {
        setError(`Image validation failed: ${imageResult.errors.join(', ')}`);
        return;
      }

      // Create new capture item
      const newCaptureItem: CaptureItem = {
        id: `capture_${Date.now()}`,
        image: imageResult.base64,
        imageFile: imageResult.compressionResult.compressedFile!,
        position: null,
        floorplanId: null,
        processingStatus: 'pending',
      };

      setCurrentItem(newCaptureItem);
      setCurrentStep('location');

      // Clear file input for next photo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      setError('Failed to process image. Please try again.');
    }
  };

  const handleFloorplanClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!floorplanRef.current || !currentItem || !activeStorePlan) return;

    const rect = floorplanRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Calculate percentage position
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const naturalWidth = floorplanRef.current.naturalWidth;
    const naturalHeight = floorplanRef.current.naturalHeight;

    const naturalRatio = naturalWidth / naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (naturalRatio > containerRatio) {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / naturalRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * naturalRatio;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    }

    const imageX = clickX - offsetX;
    const imageY = clickY - offsetY;

    if (imageX < 0 || imageX > renderedWidth || imageY < 0 || imageY > renderedHeight) {
      return;
    }

    const centerX = renderedWidth / 2;
    const centerY = renderedHeight / 2;
    const originalX = (imageX - centerX - imagePosition.x) / zoomLevel + centerX;
    const originalY = (imageY - centerY - imagePosition.y) / zoomLevel + centerY;

    const percentageX = Math.max(0, Math.min(100, (originalX / renderedWidth) * 100));
    const percentageY = Math.max(0, Math.min(100, (originalY / renderedHeight) * 100));

    if (percentageX < 0 || percentageX > 100 || percentageY < 0 || percentageY > 100) {
      return;
    }

    const position = { x: percentageX, y: percentageY };

    // Update current item with position
    const updatedItem: CaptureItem = {
      ...currentItem,
      position,
      floorplanId: activeStorePlan.id,
    };

    // Add to captured items and trigger AI processing
    setCapturedItems(prev => [...prev, updatedItem]);

    // Show blink effect
    setBlinkPosition(position);
    setTimeout(() => setBlinkPosition(null), 1000);

    // Reset for next item
    setCurrentItem(null);
    setCurrentStep('photo');
    
    // Play success sound or haptic feedback
    console.log('✅ Item location captured, AI processing started');
  };

  const handleSaveAll = async () => {
    try {
      setSavingAll(true);
      setError(null);

      if (!user || !ownerProfile) {
        setError('You must be logged in as a store owner');
        return;
      }

      if (capturedItems.length === 0) {
        setError('No items to save');
        return;
      }

      // Wait for all AI processing to complete
      const stillProcessing = capturedItems.filter(
        item => item.processingStatus === 'processing' || item.processingStatus === 'pending'
      );

      if (stillProcessing.length > 0) {
        setError(`Waiting for ${stillProcessing.length} items to finish processing...`);
        // Wait a bit and try again
        setTimeout(() => {
          setError(null);
          handleSaveAll();
        }, 2000);
        return;
      }

      console.log(`💾 Saving ${capturedItems.length} items to Firestore...`);

      // Save all items to Firestore
      const savePromises = capturedItems.map(async (item) => {
        const itemData: any = {
          name: item.name || 'Unknown Item',
          category: item.category || 'Other',
          imageUrl: item.image,
          storeId: store.id,
          floorplanId: item.floorplanId!,
          position: item.position!,
          inStock: true,
          verified: true,
          verifiedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          reportCount: 0,
          hasImageData: true,
          imageMimeType: 'image/jpeg',
          imageSize: item.image.length,
        };

        // Only include optional fields if they have values (Firestore doesn't accept undefined)
        if (item.price) {
          itemData.price = item.price;
        }
        if (item.description) {
          itemData.description = item.description;
        }

        return ItemService.create(itemData as Omit<Item, 'id'>);
      });

      await Promise.all(savePromises);

      console.log(`✅ Successfully saved ${capturedItems.length} items`);
      alert(`Successfully added ${capturedItems.length} items!`);

      // Clear and close
      setCapturedItems([]);
      onItemAdded?.();
      onClose();
    } catch (error) {
      console.error('Error saving items:', error);
      setError('Failed to save items. Please try again.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleEditItem = (itemId: string, field: string, value: string) => {
    setCapturedItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, [field]: value, edited: true }
          : item
      )
    );
  };

  const handleDeleteCapturedItem = (itemId: string) => {
    setCapturedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const processingCount = capturedItems.filter(
    item => item.processingStatus === 'processing' || item.processingStatus === 'pending'
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">⚡ Rapid Item Capture</h2>
            <p className="text-sm text-blue-100">
              {currentStep === 'photo' ? '1. Take Photo' : '2. Tap Location'} • {capturedItems.length} items captured
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-600 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {processingCount > 0 && (
          <div className="mt-2 bg-blue-500 bg-opacity-50 rounded-lg p-2 flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span className="text-sm">Processing {processingCount} items with AI...</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentStep === 'photo' && (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />
            
            <button
              onClick={handleTakePhoto}
              className="w-32 h-32 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            >
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
            <p className="mt-6 text-xl font-semibold text-gray-700">Tap to take photo</p>
            <p className="mt-2 text-sm text-gray-500">AI will auto-detect item & price</p>
          </div>
        )}

        {currentStep === 'location' && activeStorePlan && (
          <div className="h-full flex flex-col">
            <div className="flex-1 relative overflow-hidden bg-gray-100">
              <img
                ref={floorplanRef}
                src={getStorePlanImageUrl(activeStorePlan)}
                alt="Floor plan"
                onClick={handleFloorplanClick}
                className="w-full h-full object-contain cursor-crosshair"
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                }}
              />
              
              {/* Blink effect */}
              {blinkPosition && (
                <div
                  className="absolute w-6 h-6 bg-green-500 rounded-full animate-ping"
                  style={{
                    left: `${blinkPosition.x}%`,
                    top: `${blinkPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
              
              {/* Show existing captured items */}
              {capturedItems.map(item => item.position && (
                <div
                  key={item.id}
                  className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg"
                  style={{
                    left: `${item.position.x}%`,
                    top: `${item.position.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
            </div>
            
            <div className="p-4 bg-white border-t">
              <p className="text-center text-lg font-semibold text-gray-700">
                Tap location on floor plan
              </p>
              <button
                onClick={() => {
                  setCurrentItem(null);
                  setCurrentStep('photo');
                }}
                className="mt-3 w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Captured Items List */}
      {capturedItems.length > 0 && currentStep === 'photo' && (
        <div className="border-t bg-white" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          <div className="p-4">
            <h3 className="font-bold text-lg mb-3">Captured Items ({capturedItems.length})</h3>
            <div className="space-y-2">
              {capturedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <img
                    src={item.image}
                    alt="Item"
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    {item.processingStatus === 'completed' ? (
                      <>
                        <input
                          type="text"
                          value={item.name || ''}
                          onChange={(e) => handleEditItem(item.id, 'name', e.target.value)}
                          className="w-full font-semibold text-sm border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1"
                          placeholder="Item name"
                        />
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={item.price || ''}
                            onChange={(e) => handleEditItem(item.id, 'price', e.target.value)}
                            className="w-20 text-xs border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1"
                            placeholder="Price"
                          />
                          <input
                            type="text"
                            value={item.category || ''}
                            onChange={(e) => handleEditItem(item.id, 'category', e.target.value)}
                            className="flex-1 text-xs border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1"
                            placeholder="Category"
                          />
                        </div>
                        {item.aiConfidence !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
                            AI Confidence: {(item.aiConfidence * 100).toFixed(0)}%
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        <span className="text-sm text-gray-600">
                          {item.processingStatus === 'pending' ? 'Queued...' : 'Processing...'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteCapturedItem(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleSaveAll}
              disabled={savingAll || processingCount > 0}
              className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-4 rounded-lg font-bold text-lg transition-colors"
            >
              {savingAll ? 'Saving...' : `Save All ${capturedItems.length} Items`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-t border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};
