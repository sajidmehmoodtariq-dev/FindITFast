import React, { useState } from 'react';
import type { Item, Store } from '../../types';
import { ReportButton, FeedbackModal, ConfirmationToast } from '../feedback';
import { reportService } from '../../services/reportService';

interface ItemInfoProps {
  item: Item;
  store: Store;
  className?: string;
}

export const ItemInfo: React.FC<ItemInfoProps> = ({ item, store, className = '' }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    reportType: 'missing' | 'moved' | 'found' | 'confirm';
  }>({
    isOpen: false,
    reportType: 'missing'
  });
  
  const [toast, setToast] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isVisible: false,
    message: '',
    type: 'success'
  });
  // Calculate days since verification
  const getDaysSinceVerification = (verifiedAt: any): number => {
    if (!verifiedAt) return 0;
    
    const verifiedDate = verifiedAt.toDate ? verifiedAt.toDate() : new Date(verifiedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - verifiedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatPrice = (price?: string): string => {
    if (!price) return '';
    const num = parseFloat(price);
    return isNaN(num) ? `$${price}` : `$${num.toFixed(2)}`;
  };

  const daysSinceVerification = getDaysSinceVerification(item.verifiedAt);

  const handleReportClick = (reportType: 'missing' | 'moved' | 'found' | 'confirm') => {
    setModalState({
      isOpen: true,
      reportType
    });
  };

  const handleModalClose = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleReportSubmit = async (reportType: 'missing' | 'moved' | 'found' | 'confirm', comment?: string) => {
    try {
      const location = await reportService.getUserLocation();
      
      // Use the enhanced report processing that includes auto-flagging
      await reportService.processReportAndFlag({
        itemId: item.id,
        storeId: store.id,
        type: reportType,
        comment,
        location
      });

      // Show success message
      const messages = {
        missing: 'Thank you! We\'ve recorded that this item is missing.',
        moved: 'Thank you! We\'ve recorded that this item has moved.',
        found: 'Thank you! We\'ve confirmed this item was found.',
        confirm: 'Thank you! We\'ve confirmed this item location.'
      };

      setToast({
        isVisible: true,
        message: messages[reportType],
        type: 'success'
      });

    } catch (error) {
      console.error('Error submitting report:', error);
      setToast({
        isVisible: true,
        message: 'Failed to submit report. Please try again.',
        type: 'error'
      });
    }
  };

  const handleToastClose = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  return (
    <>
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      {/* Item Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {item.name}
          </h3>
          {item.price && (
            <p className="text-xl font-bold text-green-600 mt-1">
              {formatPrice(item.price)}
            </p>
          )}
        </div>
        
        {/* Item Image */}
        {item.imageUrl && (
          <div className="ml-4 flex-shrink-0">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-16 h-16 rounded-lg object-cover border border-gray-200"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {/* Verification Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.verified ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg 
                    className="w-3 h-3 text-white" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-700">
                  Verified
                </span>
              </div>
              <span className="text-sm text-gray-500">
                Last confirmed {daysSinceVerification === 0 
                  ? 'today' 
                  : daysSinceVerification === 1 
                    ? '1 day ago'
                    : `${daysSinceVerification} days ago`
                }
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                <svg 
                  className="w-3 h-3 text-white" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </div>
              <span className="text-sm font-medium text-yellow-700">
                Unverified
              </span>
            </div>
          )}
        </div>

        {/* Report Count (if any) */}
        {item.reportCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-orange-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{item.reportCount} report{item.reportCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Price Image (if available) */}
      {item.priceImageUrl && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600 mb-2">Price tag:</p>
          <img
            src={item.priceImageUrl}
            alt={`Price tag for ${item.name}`}
            className="w-full max-w-xs rounded-lg border border-gray-200"
            loading="lazy"
          />
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Last updated: {item.updatedAt && typeof item.updatedAt === 'object' && 'toDate' in item.updatedAt ? 
            item.updatedAt.toDate().toLocaleDateString() : 
            new Date(item.updatedAt as any).toLocaleDateString()
          }
        </p>
      </div>

      {/* Reporting Buttons */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-3">Help us keep this information accurate:</p>
        <div className="grid grid-cols-2 gap-2">
          <ReportButton
            type="missing"
            onClick={() => handleReportClick('missing')}
            className="text-xs"
          />
          <ReportButton
            type="moved"
            onClick={() => handleReportClick('moved')}
            className="text-xs"
          />
          <ReportButton
            type="found"
            onClick={() => handleReportClick('found')}
            className="text-xs"
          />
          <ReportButton
            type="confirm"
            onClick={() => handleReportClick('confirm')}
            className="text-xs"
          />
        </div>
      </div>
    </div>

    {/* Modal */}
    <FeedbackModal
      isOpen={modalState.isOpen}
      onClose={handleModalClose}
      item={item}
      store={store}
      reportType={modalState.reportType}
      onSubmit={handleReportSubmit}
    />

    {/* Toast */}
    <ConfirmationToast
      isVisible={toast.isVisible}
      message={toast.message}
      type={toast.type}
      onClose={handleToastClose}
    />
  </>
);
};