import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout, MobileContent } from '../components/common/MobileLayout';
import { Timestamp } from 'firebase/firestore';
import { ItemService, ReportService } from '../services/firestoreService';
import type { Item } from '../types';
import {
  validateAndPrepareImage,
  fileToBase64,
  isWithinFirestoreLimits,
  type CompressionResult
} from '../utils/imageCompression';

interface CameraState {
  isSupported: boolean;
  canUseGetUserMedia: boolean;
  hasCaptureFallback: boolean;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
}

const CAMERA_START_TIMEOUT_MS = 8000;

export const ReportItemPage: React.FC = () => {
  const { itemId, storeId } = useParams<{ itemId: string; storeId: string }>();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [reportData, setReportData] = useState({
    itemImage: null as string | null, // base64 string
    itemImagePreview: null as string | null,
    compressionResult: null as CompressionResult | null,
    hasNewLocation: false, // Track if location has been selected
    newLocation: null as { x: number; y: number } | null
  });

  const [showFloorplanModal, setShowFloorplanModal] = useState(false);
  
  const [camera, setCamera] = useState<CameraState>({
    isSupported: false,
    canUseGetUserMedia: false,
    hasCaptureFallback: false,
    permissionState: 'unknown',
    isActive: false,
    stream: null,
    error: null
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [currentCapture, setCurrentCapture] = useState<'item' | 'location' | null>(null);

  // Load item data
  useEffect(() => {
    const loadItem = async () => {
      if (!itemId) return;
      
      try {
        const itemData = await ItemService.getById(itemId);
        setItem(itemData);
      } catch (error) {
        console.error('Failed to load item:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [itemId]);

  // Check camera support
  useEffect(() => {
    const checkCameraSupport = () => {
      const isMobileDevice =
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        navigator.maxTouchPoints > 1;
      const canUseGetUserMedia = !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      );
      const hasCaptureFallback = isMobileDevice;

      setCamera(prev => ({
        ...prev,
        isSupported: canUseGetUserMedia || hasCaptureFallback,
        canUseGetUserMedia,
        hasCaptureFallback
      }));
    };

    checkCameraSupport();
  }, []);

  useEffect(() => {
    streamRef.current = camera.stream;
  }, [camera.stream]);

  const checkCameraPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
    try {
      if (!('permissions' in navigator) || !navigator.permissions?.query) {
        return 'unknown';
      }

      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const state = (status.state as 'granted' | 'denied' | 'prompt') || 'unknown';
      setCamera(prev => ({ ...prev, permissionState: state }));
      return state;
    } catch {
      return 'unknown';
    }
  }, []);

  const processCapturedFile = useCallback(async (file: File) => {
    setProcessingImage(true);
    setCamera(prev => ({ ...prev, error: null }));

    if (!itemId || !storeId) {
      setCamera(prev => ({
        ...prev,
        error: 'Missing item or store information. Please go back and try again.'
      }));
      setProcessingImage(false);
      return;
    }

    try {
      const validation = await validateAndPrepareImage(file, 'main');
      let reportImageBase64: string;

      if (!validation.isValid) {
        // Fallback path for formats/browser combinations that fail compression (e.g. some "recently used" photos).
        const fallbackBase64 = await fileToBase64(file);
        if (!isWithinFirestoreLimits(fallbackBase64)) {
          throw new Error(validation.errors.join(', ') || 'Selected image is too large to upload.');
        }

        reportImageBase64 = fallbackBase64;

        if (reportData.itemImagePreview) {
          URL.revokeObjectURL(reportData.itemImagePreview);
        }

        const fallbackPreviewUrl = URL.createObjectURL(file);
        setReportData(prev => ({
          ...prev,
          itemImage: fallbackBase64,
          itemImagePreview: fallbackPreviewUrl,
          compressionResult: null
        }));
      } else {
        reportImageBase64 = validation.base64;

        if (reportData.itemImagePreview) {
          URL.revokeObjectURL(reportData.itemImagePreview);
        }

        const previewUrl = URL.createObjectURL(validation.compressionResult.compressedFile);

        setReportData(prev => ({
          ...prev,
          itemImage: validation.base64,
          itemImagePreview: previewUrl,
          compressionResult: validation.compressionResult
        }));
      }

      await ReportService.create({
        itemId,
        storeId,
        type: 'missing',
        timestamp: Timestamp.now(),
        status: 'pending',
        metadata: {
          ...(item?.name ? { itemName: item.name } : {}),
          itemImageBase64: reportImageBase64,
          reportType: 'customer_item_photo'
        }
      });
    } catch (error) {
      console.error('Failed to process and update item image:', error);
      const message = error instanceof Error
        ? error.message
        : 'Failed to process selected photo. Please take a new photo and try again.';
      setCamera(prev => ({
        ...prev,
        error: `Photo upload failed: ${message}`
      }));
    } finally {
      setProcessingImage(false);
    }
  }, [itemId, reportData.itemImagePreview]);

  // Start camera
  const startCamera = useCallback(async (captureType: 'item' | 'location') => {
    if (!camera.isSupported) {
      setCamera(prev => ({
        ...prev,
        error: 'Camera is not supported on this device or browser.',
        isActive: false,
        stream: null
      }));
      return;
    }

    try {
      setStartingCamera(true);
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        // Mobile fallback: still camera-only via capture input.
        if (camera.hasCaptureFallback && mobileCameraInputRef.current) {
          setCamera(prev => ({ ...prev, error: null, isActive: false }));
          mobileCameraInputRef.current.click();
          return;
        }

        setCamera(prev => ({
          ...prev,
          error: 'Camera requires HTTPS or browser support. Please open the app in Safari/Chrome over HTTPS.',
          isActive: false,
          stream: null
        }));
        return;
      }

      const permission = await checkCameraPermission();
      if (permission === 'denied') {
        setCamera(prev => ({
          ...prev,
          permissionState: 'denied',
          error: 'Camera permission is blocked in browser settings. Enable camera for this site, then tap Retry.',
          isActive: false,
          stream: null
        }));
        return;
      }

      setCamera(prev => ({ ...prev, error: null }));
      setCurrentCapture(captureType);

      const getUserMediaWithTimeout = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
        return await Promise.race([
          navigator.mediaDevices.getUserMedia(constraints),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Camera startup timed out')), CAMERA_START_TIMEOUT_MS);
          })
        ]);
      };
      
      const preferredConstraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      let stream: MediaStream;
      try {
        stream = await getUserMediaWithTimeout(preferredConstraints);
      } catch (preferredError) {
        // Desktop/laptop fallback where facingMode constraint can fail.
        stream = await getUserMediaWithTimeout({ video: true });
      }
      
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.playsInline = true;

        // Ensure playback starts once metadata is ready on mobile browsers.
        const playWhenReady = async () => {
          try {
            await videoElement.play();
          } catch (playError) {
            console.warn('Video playback did not start immediately:', playError);
          }
        };

        if (videoElement.readyState >= 1) {
          void playWhenReady();
        } else {
          videoElement.onloadedmetadata = () => {
            void playWhenReady();
          };
        }
      }

      setCamera(prev => ({
        ...prev,
        isActive: true,
        stream,
        error: null
      }));
    } catch (error) {
      console.warn('Camera access failed:', error);

      let message = 'Failed to access camera. Please check permissions.';
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          message = 'Camera permission denied. Enable camera access in browser/site settings, then tap Retry.';
          setCamera(prev => ({ ...prev, permissionState: 'denied' }));
        } else if (error.name === 'NotFoundError') {
          message = 'No camera was detected on this device.';
        } else if (error.name === 'NotReadableError') {
          message = 'Camera is already in use by another app or tab. Close it and tap Retry.';
        }
      } else if (error instanceof Error && error.message === 'Camera startup timed out') {
        message = 'Camera did not open in time. Please tap Retry.';
      }

      setCamera(prev => ({
        ...prev,
        error: message,
        isActive: false
      }));
      setCurrentCapture(null);
    } finally {
      setStartingCamera(false);
    }
  }, [camera.isSupported, camera.hasCaptureFallback, checkCameraPermission]);

  // Stop camera
  const stopCamera = useCallback(() => {
    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    streamRef.current = null;
    
    setCamera(prev => ({
      ...prev,
      isActive: false,
      stream: null
    }));
    setCurrentCapture(null);
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !currentCapture) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob for compression
    canvas.toBlob(async (blob) => {
      if (!blob || currentCapture !== 'item') return;
      
      try {
        const file = new File([blob], 'camera_image.jpg', { type: 'image/jpeg' });
        await processCapturedFile(file);
      } catch (error) {
        console.error('Failed to process and update item image from camera:', error);
        alert('Failed to update item image. Please try again.');
      } finally {
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  }, [currentCapture, stopCamera, processCapturedFile]);

  const handleMobileCameraCapture = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processCapturedFile(file);

    // Reset input so selecting the same photo again still triggers onChange.
    event.target.value = '';
  }, [processCapturedFile]);

  const handleUseCameraClick = useCallback(() => {
    setCamera(prev => ({ ...prev, error: null }));
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
      startCamera('item');
      return;
    }

    if (mobileCameraInputRef.current) {
      setStartingCamera(true);
      mobileCameraInputRef.current.click();
      setTimeout(() => setStartingCamera(false), 500);
      return;
    }

    setCamera(prev => ({
      ...prev,
      error: 'Camera is not available in this browser. Please try Safari or Chrome on a device with a camera.'
    }));
  }, [startCamera]);

  const handleRetryCamera = useCallback(async () => {
    const permission = await checkCameraPermission();
    if (permission === 'denied') {
      setCamera(prev => ({
        ...prev,
        permissionState: 'denied',
        error: 'Camera is still blocked. Please allow camera in site/browser settings first, then tap Retry.'
      }));
      return;
    }

    handleUseCameraClick();
  }, [checkCameraPermission, handleUseCameraClick]);

  // Handle location selection from floorplan modal
  const handleLocationSelect = useCallback(async (position: { x: number; y: number }) => {
    if (!itemId) return;
    
    setUpdatingLocation(true);
    
    try {
      // Note: Authentication bypassed for demo/debugging purposes
      // Firestore rules temporarily allow public item updates
      console.log('🔧 Bypassing authentication - using public access rules');
      
      // Update item position in database
      await ItemService.update(itemId, {
        position: position
      });
      
      setReportData(prev => ({
        ...prev,
        hasNewLocation: true,
        newLocation: position
      }));
      
      setShowFloorplanModal(false);
      console.log('📍 Location updated successfully:', position);
    } catch (error: any) {
      console.error('Failed to update location:', error);
      alert(`Failed to update location: ${error?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setUpdatingLocation(false);
    }
  }, [itemId]);



  // Go to home
  const handleGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Cleanup camera only on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Cleanup preview URLs on change/unmount
  useEffect(() => {
    return () => {
      if (reportData.itemImagePreview) {
        URL.revokeObjectURL(reportData.itemImagePreview);
      }
    };
  }, [reportData.itemImagePreview]);

  if (loading) {
    return (
      <MobileLayout>
        <MobileContent>
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading item details...</p>
            </div>
          </div>
        </MobileContent>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <MobileContent>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Missing Item</h1>
            {item && (
              <div className="flex items-center space-x-4">
                {item.imageUrl && (
                  <img 
                    src={item.imageUrl} 
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{item.name}</h2>
                  <p className="text-gray-600">{item.category}</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera View */}
          {camera.isActive && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">
                  Take {currentCapture === 'item' ? 'Item' : 'Location'} Photo
                </h3>
              </div>
              
              <div className="relative mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg"
                  style={{ maxHeight: '400px' }}
                />
              </div>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={capturePhoto}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  📸 Capture Photo
                </button>
                <button
                  onClick={stopCamera}
                  className="bg-gray-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Item Photo Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📱 Item Photo</h3>
            <p className="text-gray-600 mb-4">Take a photo of an item that has been moved</p>
            
            {reportData.itemImagePreview ? (
              <div className="mb-4">
                <img 
                  src={reportData.itemImagePreview} 
                  alt="Item preview"
                  className="w-full max-w-md mx-auto rounded-lg shadow"
                />
                {reportData.compressionResult && (
                  <div className="mt-2 text-sm text-gray-600 text-center">
                    <p>✅ Image optimized: {(reportData.compressionResult.compressedSize / 1024).toFixed(1)} KB</p>
                    <p>Compression: {reportData.compressionResult.compressionRatio.toFixed(1)}% smaller</p>
                  </div>
                )}
              </div>
            ) : null}
            
            <div className="flex flex-col space-y-3">
              {processingImage ? (
                <div className="px-6 py-3 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Processing image...
                </div>
              ) : startingCamera ? (
                <div className="px-6 py-3 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Opening camera...
                </div>
              ) : (
                <>
                  <button
                    onClick={handleUseCameraClick}
                    disabled={camera.isActive || startingCamera}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    📷 Use Camera
                  </button>
                </>
              )}

              {camera.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-red-600 text-sm flex-1">{camera.error}</p>
                    <button
                      type="button"
                      onClick={handleRetryCamera}
                      className="text-sm font-medium text-red-700 hover:text-red-800 underline shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                  {camera.permissionState === 'denied' && (
                    <p className="text-xs text-red-700 mt-2">
                      Tip: click the lock icon in your browser address bar and allow camera for this site.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Location Selection Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📍 New Location</h3>
            <p className="text-gray-600 mb-4">Select the new location on the floorplan</p>
            
            {reportData.hasNewLocation ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800 font-medium">New location selected</span>
                </div>
              </div>
            ) : null}
            
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => setShowFloorplanModal(true)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  reportData.hasNewLocation 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {reportData.hasNewLocation ? (
                  <>✅ Location Selected - Click to Change</>
                ) : (
                  <>🗺️ Select New Location on Floorplan</>
                )}
              </button>
            </div>
          </div>

          {/* Go to Home Button */}
          <div className="pb-safe">
            <button
              onClick={handleGoHome}
              className="w-full bg-green-600 text-white px-6 py-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              🏠 Go to Home
            </button>
          </div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Mobile fallback camera capture (still camera-only via capture attribute) */}
          <input
            ref={mobileCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleMobileCameraCapture}
            className="hidden"
          />
        </div>
      </MobileContent>

      {/* Floorplan Modal */}
      {showFloorplanModal && item && (
        <FloorplanModal
          storeId={item.storeId}
          itemId={itemId!}
          onLocationSelect={handleLocationSelect}
          onClose={() => setShowFloorplanModal(false)}
          isUpdating={updatingLocation}
        />
      )}
    </MobileLayout>
  );
};

// Floorplan Modal Component
interface FloorplanModalProps {
  storeId: string;
  itemId: string;
  onLocationSelect: (position: { x: number; y: number }) => void;
  onClose: () => void;
  isUpdating?: boolean;
}

const FloorplanModal: React.FC<FloorplanModalProps> = ({
  storeId,
  itemId,
  onLocationSelect,
  onClose,
  isUpdating = false
}) => {
  const [store, setStore] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLocation, setPendingLocation] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔍 FloorplanModal: Starting to load data for storeId:', storeId);
        const { firestoreService } = await import('../services/firestoreService');
        
        // Load store data
        console.log('🏪 FloorplanModal: Loading store data...');
        let storeData = await firestoreService.getStore(storeId);
        console.log('🏪 FloorplanModal: Store data from storeRequests:', storeData);
        
        if (!storeData) {
          console.log('🏪 FloorplanModal: No data in storeRequests, trying stores collection...');
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../services/firebase');
          const storeDocRef = doc(db, 'stores', storeId);
          const storeSnapshot = await getDoc(storeDocRef);
          
          if (storeSnapshot.exists()) {
            storeData = { id: storeSnapshot.id, ...storeSnapshot.data() } as any;
            console.log('🏪 FloorplanModal: Store data from stores collection:', storeData);
        } else {
          console.log('🏪 FloorplanModal: No store data found in either collection');
        }
      }
      
      // Check for active floorplan from storePlans collection (regardless of store data)
      let floorplanUrl = null;
      
      if (storeData) {
        floorplanUrl = storeData.floorplanUrl || (storeData as any).floorPlanUrl;
      }
      
      // If no direct floorplanUrl, check storePlans collection
      console.log('🗂️ FloorplanModal: Checking storePlans collection for floorplanUrl...');
      if (!floorplanUrl) {
            try {
              const { StorePlanService } = await import('../services/firestoreService');
              
              // Try multiple store ID variations including prefixes
              const cleanStoreId = storeId.replace(/^(temp_|virtual_)/, ''); // Remove prefix if exists
              const storeIdVariations = [
                storeId, 
                `temp_${storeId}`, 
                `virtual_${storeId}`,
                cleanStoreId,
                `temp_${cleanStoreId}`,
                `virtual_${cleanStoreId}`
              ];
              let activeStorePlans: any[] = [];
              
              console.log('🔍 FloorplanModal: Original storeId:', storeId);
              console.log('🔍 FloorplanModal: Clean storeId:', cleanStoreId);
              console.log('🔍 FloorplanModal: Trying store ID variations:', storeIdVariations);
              
              // First, get ALL storePlans to see what's actually in the database
              try {
                const allStorePlans = await StorePlanService.getAll();
                console.log('🔍 FloorplanModal: ALL StorePlans in database:', allStorePlans.length);
                console.log('📋 FloorplanModal: All StorePlans details:', allStorePlans.map(sp => ({ 
                  id: sp.id, 
                  storeId: sp.storeId, 
                  isActive: sp.isActive,
                  hasBase64: !!(sp as any).base64,
                  base64Length: (sp as any).base64?.length || 0
                })));
              } catch (allPlansError) {
                console.error('❌ FloorplanModal: Error getting all storePlans:', allPlansError);
              }
              
              for (const storeIdVariant of storeIdVariations) {
                console.log('� FloorplanModal: Checking storeId variant:', storeIdVariant);
                try {
                  activeStorePlans = await StorePlanService.getActiveByStore(storeIdVariant);
                  console.log(`📋 FloorplanModal: Plans found for ${storeIdVariant}:`, activeStorePlans.length);
                  
                  if (activeStorePlans.length > 0) {
                    console.log('✅ FloorplanModal: Found active store plans for:', storeIdVariant);
                    console.log('📄 FloorplanModal: Plan details:', activeStorePlans.map(p => ({
                      id: p.id,
                      storeId: p.storeId,
                      isActive: p.isActive,
                      hasBase64: !!(p as any).base64,
                      base64Length: (p as any).base64?.length || 0
                    })));
                    break;
                  }
                } catch (variantError) {
                  console.error(`❌ FloorplanModal: Error checking variant ${storeIdVariant}:`, variantError);
                }
              }
              
              console.log('🗺️ FloorplanModal: Active store plans found:', activeStorePlans.length);
              
              // If no plans found, let's check ALL plans in the collection for debugging
              if (activeStorePlans.length === 0) {
                console.log('🔍 FloorplanModal: No active plans found, checking ALL store plans...');
                try {
                  const allPlans = await StorePlanService.getAll();
                  console.log('📋 FloorplanModal: ALL store plans in collection:', allPlans.map(p => ({
                    id: p.id,
                    storeId: p.storeId,
                    isActive: p.isActive,
                    name: p.name,
                    hasBase64: !!(p as any).base64
                  })));
                } catch (allPlansError) {
                  console.error('❌ FloorplanModal: Error getting all plans:', allPlansError);
                }
              }
              
              if (activeStorePlans.length > 0) {
                const activePlan = activeStorePlans[0];
                console.log('🗺️ FloorplanModal: Active plan data:', {
                  id: activePlan.id,
                  hasImageData: activePlan.hasImageData,
                  fileName: activePlan.fileName
                });
                
                // Check if base64 data is available directly in the document
                console.log('🔍 FloorplanModal: Checking activePlan for base64 data:', {
                  hasBase64Property: 'base64' in activePlan,
                  base64Value: (activePlan as any).base64 ? 'EXISTS' : 'NULL/UNDEFINED',
                  base64Length: (activePlan as any).base64?.length || 0,
                  allProperties: Object.keys(activePlan)
                });
                
                if ((activePlan as any).base64) {
                  const base64Data = (activePlan as any).base64;
                  // Check if base64 data already has data URL prefix
                  if (base64Data.startsWith('data:')) {
                    floorplanUrl = base64Data;
                    console.log('✅ FloorplanModal: Using existing base64 data URL, length:', floorplanUrl.length);
                  } else {
                    floorplanUrl = `data:${activePlan.type || 'image/jpeg'};base64,${base64Data}`;
                    console.log('✅ FloorplanModal: Created floorplan URL from base64 data, length:', floorplanUrl.length);
                  }
                } else if (activePlan.hasImageData) {
                  // Fallback to storage if base64 is not available
                  const { getStorage, ref, getDownloadURL } = await import('firebase/storage');
                  const storage = getStorage();
                  const imageRef = ref(storage, `storePlans/${activePlan.id}/${activePlan.fileName}`);
                  
                  try {
                    floorplanUrl = await getDownloadURL(imageRef);
                    console.log('🗺️ FloorplanModal: Got floorplan URL from storage:', floorplanUrl);
                  } catch (storageError) {
                    console.error('🗺️ FloorplanModal: Failed to get floorplan from storage:', storageError);
                  }
                }
              }
            } catch (error) {
              console.error('🗺️ FloorplanModal: Failed to load store plans:', error);
            }
          }
          
          // Create store object (even if storeData is null, we might have floorplanUrl from storePlans)
          console.log('🏪 FloorplanModal: Creating store object. StoreData exists:', !!storeData, 'FloorplanUrl exists:', !!floorplanUrl);
          
          if (storeData || floorplanUrl) {
            const mappedStore = {
              id: storeData?.id || storeId,
              name: (storeData as any)?.storeName || (storeData as any)?.name || 'Store',
              address: storeData?.address || 'Unknown address',
              location: storeData?.location || { latitude: 0, longitude: 0 },
              floorplanUrl: floorplanUrl,
              ownerId: storeData?.ownerId || (storeData as any)?.ownerEmail || '',
              createdAt: storeData?.createdAt,
              updatedAt: storeData?.updatedAt
            };
            
            console.log('🗺️ FloorplanModal: Final mapped store:', {
              id: mappedStore.id,
              name: mappedStore.name,
              hasFloorplanUrl: !!mappedStore.floorplanUrl,
              floorplanUrl: mappedStore.floorplanUrl ? 'FOUND' : 'NOT_FOUND'
            });
            
            setStore(mappedStore);
          } else {
            console.log('❌ FloorplanModal: No store data and no floorplan found');
            setStore(null);
          }

        // Load items
        const storeItems = await firestoreService.getStoreItems(storeId);
        setItems(storeItems);
      } catch (error) {
        console.error('Failed to load floorplan data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [storeId]);

  const handleLocationClick = (position: { x: number; y: number }) => {
    setPendingLocation(position);
  };

  const handleConfirmLocation = async () => {
    if (!pendingLocation) return;
    await onLocationSelect(pendingLocation);
    setPendingLocation(null);
  };

  const handleCancelSelection = () => {
    setPendingLocation(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading floorplan...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Select New Location</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border-b">
          <p className="text-blue-800 text-sm">
            <strong>Current item location is highlighted.</strong> Tap the floorplan to select a new point, then confirm it below.
          </p>
        </div>

        {/* Floorplan */}
        <div className="p-4 overflow-auto max-h-96">
          {store ? (
            <FloorplanModalViewer
              store={store}
              items={items}
              selectedItemId={itemId}
              onLocationClick={handleLocationClick}
              pendingLocation={pendingLocation}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              No floorplan available for this store.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="space-y-3">
            {pendingLocation ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-blue-900">New location selected</p>
                    <p className="text-blue-700">
                      Selected point: {pendingLocation.x.toFixed(1)}%, {pendingLocation.y.toFixed(1)}%
                    </p>
                  </div>
                  <span className="text-xs font-medium text-blue-700 bg-white px-2 py-1 rounded-full border border-blue-200">Pending</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
                Tap the floorplan to select a new location.
              </div>
            )}

            <div className="flex gap-3">
            {isUpdating ? (
              <div className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Processing location...
              </div>
            ) : (
              <>
                <button
                  onClick={pendingLocation ? handleCancelSelection : onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {pendingLocation ? 'Clear Selection' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmLocation}
                  disabled={!pendingLocation}
                  className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm Location
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simplified FloorplanViewer for the modal
interface FloorplanModalViewerProps {
  store: any;
  items: any[];
  selectedItemId: string;
  onLocationClick: (position: { x: number; y: number }) => void;
  pendingLocation: { x: number; y: number } | null;
}

const FloorplanModalViewer: React.FC<FloorplanModalViewerProps> = ({
  store,
  items,
  selectedItemId,
  onLocationClick,
  pendingLocation
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  console.log('🖼️ FloorplanModalViewer: Received store:', {
    id: store.id,
    name: store.name,
    hasFloorplanUrl: !!store.floorplanUrl,
    floorplanUrlLength: store.floorplanUrl?.length || 0,
    floorplanUrlType: store.floorplanUrl?.startsWith('data:') ? 'base64' : store.floorplanUrl?.startsWith('http') ? 'url' : 'unknown'
  });

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      onLocationClick({ x, y });
    }
  };

  if (!store.floorplanUrl) {
    console.log('❌ FloorplanModalViewer: No floorplanUrl found, showing fallback message');
    return (
      <div className="text-center py-8 text-gray-500">
        This store hasn't uploaded a floorplan yet.
      </div>
    );
  }

  console.log('✅ FloorplanModalViewer: Rendering floorplan image');

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-crosshair"
      onClick={handleClick}
    >
      <img
        src={store.floorplanUrl}
        alt="Store floorplan"
        className="w-full h-full object-contain"
      />
      
      {/* Show current item position with blinking effect */}
      {items
        .filter(item => item.id === selectedItemId && item.position?.x !== undefined && item.position?.y !== undefined)
        .map((item) => (
          <div
            key={item.id}
            className="absolute w-8 h-8 bg-red-500 border-2 border-white rounded-full animate-pulse shadow-lg transform -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: `${item.position.x}%`,
              top: `${item.position.y}%`
            }}
          >
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-full h-full bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ))
      }

      {pendingLocation && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: `${pendingLocation.x}%`,
            top: `${pendingLocation.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 w-10 h-10 rounded-full bg-blue-500 animate-ping opacity-70" />
            <div className="absolute inset-0 w-8 h-8 rounded-full bg-blue-600 border-4 border-white shadow-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">•</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
