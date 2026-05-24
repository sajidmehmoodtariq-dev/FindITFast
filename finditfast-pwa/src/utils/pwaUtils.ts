// PWA utility functions

export interface PWAInstallPrompt extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Check if the app is running as a PWA
export const isPWA = (): boolean => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInWebAppiOS = (window.navigator as any).standalone === true;
  const isInWebAppChrome = window.matchMedia('(display-mode: minimal-ui)').matches;
  
  return isStandalone || isInWebAppiOS || isInWebAppChrome;
};

// Check if PWA installation is supported
export const isPWAInstallSupported = (): boolean => {
  return 'serviceWorker' in navigator;
};

// Get PWA display mode
export const getPWADisplayMode = (): string => {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  return 'browser';
};

// Register service worker with error handling
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  // In development mode, try to register the dev service worker
  const swPath = import.meta.env.DEV ? '/sw-dev.js' : '/sw.js';

  try {
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/'
    });
    
    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// Unregister service worker
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    return result;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
};

// Check for app updates
export const checkForUpdates = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return true;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return false;
  }
};

// Get network status
export const getNetworkStatus = (): {
  online: boolean;
  connection?: any;
} => {
  const online = navigator.onLine;
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    online,
    connection
  };
};

// Cache management utilities
export const clearAppCache = async (): Promise<void> => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
  }
};

// Get cache storage estimate
export const getCacheStorageEstimate = async (): Promise<StorageEstimate | null> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      return await navigator.storage.estimate();
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
      return null;
    }
  }
  return null;
};

// PWA analytics helper
export const trackPWAEvent = (_eventName: string, _properties?: Record<string, any>): void => {
  // Hook into Firebase Analytics here when needed
};

// Handle PWA installation
export const handlePWAInstall = async (deferredPrompt: PWAInstallPrompt): Promise<boolean> => {
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    trackPWAEvent('pwa_install_prompt_result', { outcome });
    
    return outcome === 'accepted';
  } catch (error) {
    console.error('PWA installation failed:', error);
    trackPWAEvent('pwa_install_error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
};

// Offline data management
export const saveOfflineData = async (key: string, data: any): Promise<void> => {
  try {
    const offlineData = {
      data,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem(`offline_${key}`, JSON.stringify(offlineData));
  } catch (error) {
    console.error('Failed to save offline data:', error);
  }
};

export const getOfflineData = async (key: string): Promise<any | null> => {
  try {
    const stored = localStorage.getItem(`offline_${key}`);
    if (!stored) return null;
    
    const offlineData = JSON.parse(stored);
    // Check if data is not too old (e.g., 7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (Date.now() - offlineData.timestamp > maxAge) {
      localStorage.removeItem(`offline_${key}`);
      return null;
    }
    
    return offlineData.data;
  } catch (error) {
    console.error('Failed to get offline data:', error);
    return null;
  }
};

export const clearOfflineData = (): void => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('offline_')) {
      localStorage.removeItem(key);
    }
  });
};

// PWA performance utilities
export const measurePWAPerformance = (): void => {
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      const metrics = {
        dom_content_loaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        load_complete: navigation.loadEventEnd - navigation.loadEventStart,
        first_paint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        is_pwa: isPWA(),
        display_mode: getPWADisplayMode()
      };
      
      trackPWAEvent('pwa_performance', metrics);
    });
  }
};

// Share API integration
export const shareContent = async (shareData: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      trackPWAEvent('content_shared', { method: 'native' });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Sharing failed:', error);
      }
    }
  }
  
  // Fallback to clipboard
  if (shareData.url && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareData.url);
      trackPWAEvent('content_shared', { method: 'clipboard' });
      return true;
    } catch (error) {
      console.error('Clipboard sharing failed:', error);
    }
  }
  
  return false;
};