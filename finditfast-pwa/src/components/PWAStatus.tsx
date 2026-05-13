import React, { useState, useEffect } from 'react';

const PWAStatus: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    const handleSWUpdate = () => {
      setUpdateAvailable(true);
      setShowUpdatePrompt(true);
    };

    // Check for service worker registration and updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                handleSWUpdate();
              }
            });
          }
        });
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          handleSWUpdate();
        }
      });
    }

    return () => {
      // Cleanup service worker listeners
    };
  }, []);

  const handleUpdateApp = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
    setShowUpdatePrompt(false);
  };

  const dismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  return (
    <>
      {/* Update available prompt */}
      {showUpdatePrompt && updateAvailable && (
        <div className="fixed bottom-4 left-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Update Available</h3>
              <p className="text-xs opacity-90 mt-1">
                A new version of FinditFast is ready
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={dismissUpdate}
                className="px-3 py-1 text-xs bg-green-700 rounded hover:bg-green-800 transition-colors"
              >
                Later
              </button>
              <button
                onClick={handleUpdateApp}
                className="px-3 py-1 text-xs bg-white text-green-600 rounded hover:bg-gray-100 transition-colors font-medium"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAStatus;