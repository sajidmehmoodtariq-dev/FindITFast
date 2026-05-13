import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For development/testing - show install prompt after a delay if not already installed
    const timer = setTimeout(() => {
      if (!isStandalone && !isInWebAppiOS && !deferredPrompt) {
        setShowInstallPrompt(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          // User accepted
        } else {
          // User dismissed
        }
        
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      } catch (error) {
        console.error('Error during PWA installation:', error);
      }
    } else {
      // Show manual installation instructions
      const instructions = `Install FinditFast as an App:

📱 MOBILE:
• Chrome/Edge: Menu → "Add to Home Screen"
• Safari (iOS): Share → "Add to Home Screen"

💻 DESKTOP:
• Chrome: Look for install icon (⬇) in address bar
• Edge: Menu → Apps → "Install this site as an app"
• Firefox: Address bar install button

✨ Benefits:
• Works offline
• Faster loading
• Native app feel
• No browser bars`;

      alert(instructions);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
  };

  // Don't show if already installed
  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-gray-700 to-gray-800 text-white p-4 rounded-lg shadow-lg z-50 border border-gray-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">Install FinditFast</h3>
            <p className="text-xs opacity-90 mt-1 leading-tight">
              Get faster access and work offline
            </p>
          </div>
        </div>
        <div className="flex gap-2 ml-4 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-all duration-200 font-medium"
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 text-xs bg-white text-gray-700 rounded hover:bg-gray-100 transition-all duration-200 font-medium shadow-sm"
          >
            {deferredPrompt ? 'Install' : 'How to Install'}
          </button>
        </div>
      </div>
      
      {/* Progress indicator */}
      <div className="mt-3">
        <div className="flex items-center text-xs opacity-75">
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>Offline capable</span>
          </div>
          <div className="mx-2">•</div>
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>Fast loading</span>
          </div>
          <div className="mx-2">•</div>
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>Home screen access</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;