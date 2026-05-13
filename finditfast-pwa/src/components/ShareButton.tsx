import React, { useState } from 'react';
import { shareContent } from '../utils/pwaUtils';

interface ShareButtonProps {
  storeId?: string;
  storeName?: string;
  itemName?: string;
  itemLocation?: string;
  className?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({
  storeId,
  storeName,
  itemName,
  itemLocation,
  className = ''
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    
    try {
      let shareData: {
        title: string;
        text: string;
        url: string;
      };

      if (itemName && storeName) {
        // Sharing specific item
        shareData = {
          title: `${itemName} at ${storeName}`,
          text: `Found "${itemName}" at ${storeName}${itemLocation ? ` in ${itemLocation}` : ''} using FinditFast!`,
          url: `${window.location.origin}${storeId ? `/store/${storeId}` : ''}`
        };
      } else if (storeName) {
        // Sharing store
        shareData = {
          title: `${storeName} on FinditFast`,
          text: `Check out ${storeName} on FinditFast - find items quickly with interactive floorplans!`,
          url: `${window.location.origin}${storeId ? `/store/${storeId}` : ''}`
        };
      } else {
        // Sharing app
        shareData = {
          title: 'FinditFast - Store Item Locator',
          text: 'Find items quickly in stores with interactive floorplans. Navigate to stores and locate products instantly!',
          url: window.location.origin
        };
      }

      const success = await shareContent(shareData);
      
      if (success) {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Sharing failed:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={`inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
        shareSuccess ? 'bg-green-50 border-green-300 text-green-700' : ''
      } ${isSharing ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {isSharing ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Sharing...
        </>
      ) : shareSuccess ? (
        <>
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Shared!
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Share
        </>
      )}
    </button>
  );
};

export default ShareButton;
