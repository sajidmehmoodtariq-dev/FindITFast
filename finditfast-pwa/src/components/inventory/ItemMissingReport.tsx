import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ReportService } from '../../services/firestoreService';
import type { SearchResult } from '../../types/search';

interface ItemMissingReportProps {
  searchResult: SearchResult;
  onClose: () => void;
  onReported: () => void;
}

export const ItemMissingReport: React.FC<ItemMissingReportProps> = ({
  searchResult,
  onClose,
  onReported
}) => {
  const [reportType, setReportType] = useState<'missing' | 'moved' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmitReport = async () => {
    if (!reportType) return;

    setIsSubmitting(true);
    try {
      // Create report
      await ReportService.create({
        itemId: searchResult.id,
        storeId: searchResult.storeId,
        type: reportType,
        timestamp: Timestamp.now(),
        location: navigator.geolocation ? undefined : undefined // Can add GPS if needed
      });

      // Update item report count
      if (reportType === 'missing') {
        // You might want to increment report count for missing items
        // await ItemService.incrementReportCount(searchResult.id);
      }

      setIsCompleted(true);
      setTimeout(() => {
        onReported();
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600 text-sm">
            Your report helps keep our listings accurate. We'll review the information soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Report Item Issue</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Item Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-3">
            {searchResult.imageUrl && (
              <img
                src={searchResult.imageUrl}
                alt={searchResult.name}
                className="w-10 h-10 object-cover rounded"
              />
            )}
            <div>
              <p className="font-medium text-gray-900 text-sm">{searchResult.name}</p>
              <p className="text-xs text-gray-600">{searchResult.store.name}</p>
            </div>
          </div>
        </div>

        {/* Report Options */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-gray-700">What's the issue?</h4>
          
          <button
            onClick={() => setReportType('missing')}
            className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
              reportType === 'missing'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full border-2 ${
                reportType === 'missing' ? 'border-red-500 bg-red-500' : 'border-gray-300'
              }`}>
                {reportType === 'missing' && (
                  <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Item is missing</p>
                <p className="text-xs text-gray-600">The item is not where it's shown on the map</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setReportType('moved')}
            className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
              reportType === 'moved'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full border-2 ${
                reportType === 'moved' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
              }`}>
                {reportType === 'moved' && (
                  <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Item has moved</p>
                <p className="text-xs text-gray-600">The item is in a different location</p>
              </div>
            </div>
          </button>
        </div>

        {/* Submit Button */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitReport}
            disabled={!reportType || isSubmitting}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors ${
              !reportType || isSubmitting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Reporting...</span>
              </div>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Your report helps keep FinditFast accurate for everyone
          </p>
        </div>
      </div>
    </div>
  );
};
