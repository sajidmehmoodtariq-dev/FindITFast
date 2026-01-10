/**
 * Report Problem Modal Component
 * Allows users to report issues: item not found, out of stock, or incorrect price
 */

import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ReportService } from '../../services/firestoreService';
import type { Item, Store } from '../../types';

interface ReportProblemModalProps {
  item: Item;
  store: Store;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

type ReportType = 'not_found' | 'out_of_stock' | 'price_incorrect';

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  item,
  store,
  onClose,
  onReportSubmitted
}) => {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [correctPrice, setCorrectPrice] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reportOptions = [
    {
      type: 'not_found' as ReportType,
      title: 'Item Not Found',
      description: 'Item is not at the marked location',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
        </svg>
      ),
      color: 'red'
    },
    {
      type: 'out_of_stock' as ReportType,
      title: 'Out of Stock',
      description: 'Item is currently unavailable',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      color: 'orange'
    },
    {
      type: 'price_incorrect' as ReportType,
      title: 'Price Incorrect',
      description: 'Displayed price is wrong',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
        </svg>
      ),
      color: 'blue'
    }
  ];

  const handleSubmit = async () => {
    if (!selectedType) {
      setError('Please select a problem type');
      return;
    }

    if (selectedType === 'price_incorrect' && !correctPrice.trim()) {
      setError('Please enter the correct price');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const reportData: any = {
        itemId: item.id,
        storeId: store.id,
        type: selectedType,
        timestamp: Timestamp.now(),
        status: 'pending',
        metadata: {
          itemName: item.name,
        }
      };

      // Only add optional fields if they have values (Firestore doesn't accept undefined)
      if (comments.trim()) {
        reportData.metadata.comments = comments.trim();
      }

      if (selectedType === 'price_incorrect' && correctPrice.trim()) {
        reportData.metadata.correctPrice = correctPrice.trim();
      }

      await ReportService.create(reportData);

      setSuccess(true);
      setTimeout(() => {
        onReportSubmitted?.();
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error submitting report:', error);
      setError('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black bg-opacity-50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Report a Problem</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          /* Success State */
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Report Submitted!</h3>
            <p className="text-gray-600">Thank you for helping improve our data.</p>
          </div>
        ) : (
          /* Report Form */
          <div className="p-6 space-y-6">
            {/* Item Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">{store.name}</p>
                  {item.price && (
                    <p className="text-sm font-medium text-blue-600 mt-1">
                      ${parseFloat(item.price).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Problem Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What's the problem?
              </label>
              <div className="space-y-2">
                {reportOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => setSelectedType(option.type)}
                    className={`w-full flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                      selectedType === option.type
                        ? `border-${option.color}-500 bg-${option.color}-50`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`flex-shrink-0 ${
                      selectedType === option.type
                        ? `text-${option.color}-600`
                        : 'text-gray-400'
                    }`}>
                      {option.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-gray-900">{option.title}</h4>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                    {selectedType === option.type && (
                      <svg className={`w-5 h-5 text-${option.color}-600`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Correct Price Input (for price incorrect reports) */}
            {selectedType === 'price_incorrect' && (
              <div>
                <label htmlFor="correctPrice" className="block text-sm font-medium text-gray-700 mb-2">
                  What is the correct price?
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    id="correctPrice"
                    type="text"
                    value={correctPrice}
                    onChange={(e) => setCorrectPrice(e.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Comments (Optional) */}
            <div>
              <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                Additional comments (optional)
              </label>
              <textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Tell us more about the issue..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedType || submitting}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
