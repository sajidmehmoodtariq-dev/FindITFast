import React, { useState, useEffect } from 'react';
import { 
  isPWA, 
  isPWAInstallSupported, 
  getPWADisplayMode, 
  getNetworkStatus,
  getCacheStorageEstimate,
  checkForUpdates 
} from '../utils/pwaUtils';

const PWATestPage: React.FC = () => {
  const [pwaInfo, setPwaInfo] = useState({
    isPWA: false,
    installSupported: false,
    displayMode: 'browser',
    networkStatus: { online: true },
    storageEstimate: null as any,
  });

  const [updateStatus, setUpdateStatus] = useState<string>('');

  useEffect(() => {
    const loadPWAInfo = async () => {
      const storageEstimate = await getCacheStorageEstimate();
      
      setPwaInfo({
        isPWA: isPWA(),
        installSupported: isPWAInstallSupported(),
        displayMode: getPWADisplayMode(),
        networkStatus: getNetworkStatus(),
        storageEstimate,
      });
    };

    loadPWAInfo();
  }, []);

  const handleCheckUpdates = async () => {
    setUpdateStatus('Checking for updates...');
    const result = await checkForUpdates();
    setUpdateStatus(result ? 'Update check completed' : 'Update check failed');
    
    setTimeout(() => setUpdateStatus(''), 3000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">PWA Status</h1>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Running as PWA:</span>
            <span className={`font-medium ${pwaInfo.isPWA ? 'text-green-600' : 'text-red-600'}`}>
              {pwaInfo.isPWA ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Install Supported:</span>
            <span className={`font-medium ${pwaInfo.installSupported ? 'text-green-600' : 'text-red-600'}`}>
              {pwaInfo.installSupported ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Display Mode:</span>
            <span className="font-medium text-blue-600">
              {pwaInfo.displayMode}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Network Status:</span>
            <span className={`font-medium ${pwaInfo.networkStatus.online ? 'text-green-600' : 'text-red-600'}`}>
              {pwaInfo.networkStatus.online ? 'Online' : 'Offline'}
            </span>
          </div>

          {pwaInfo.storageEstimate && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Storage Used:</span>
                <span className="font-medium text-blue-600">
                  {formatBytes(pwaInfo.storageEstimate.usage || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Storage Quota:</span>
                <span className="font-medium text-blue-600">
                  {formatBytes(pwaInfo.storageEstimate.quota || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">PWA Actions</h2>
        
        <div className="space-y-3">
          <button
            onClick={handleCheckUpdates}
            className="btn-primary w-full"
            disabled={!!updateStatus}
          >
            {updateStatus || 'Check for Updates'}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="btn-secondary w-full"
          >
            Reload App
          </button>

          <button
            onClick={() => {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.unregister();
                  window.location.reload();
                });
              }
            }}
            className="btn-secondary w-full text-red-600 border-red-300 hover:bg-red-50"
          >
            Unregister Service Worker
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Installation Instructions</h2>
        
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <h3 className="font-medium text-gray-900">Chrome/Edge (Android/Desktop):</h3>
            <p>Look for the install icon in the address bar or use the menu → "Install FinditFast"</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900">Safari (iOS):</h3>
            <p>Tap the share button → "Add to Home Screen"</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900">Firefox:</h3>
            <p>Look for the install prompt or use the menu → "Install"</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWATestPage;