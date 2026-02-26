import React, { useState } from 'react';
import type { Item, Store } from '../../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
  store: Store;
  reportType: 'missing' | 'moved' | 'found' | 'confirm';
  onSubmit: (reportType: 'missing' | 'moved' | 'found' | 'confirm', comment?: string) => Promise<void>;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  item,
  store,
  reportType,
  onSubmit
}) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getModalConfig = () => {
    switch (reportType) {
      case 'missing':
        return {
          title: 'Report Item Missing',
          description: `Let us know that "${item.name}" is no longer available at this location.`,
          placeholder: 'Optional: Tell us more about what you found instead...',
          submitText: 'Report Missing',
          color: 'red'
        };
      case 'moved':
        return {
          title: 'Report Item Moved',
          description: `Let us know that "${item.name}" has been moved to a different location in the store.`,
          placeholder: 'Optional: Tell us where you found it instead...',
          submitText: 'Report Moved',
          color: 'orange'
        };
      case 'found':
        return {
          title: 'Confirm Item Found',
          description: `Great! Confirm that you found "${item.name}" at this location.`,
          placeholder: 'Optional: Any additional details...',
          submitText: 'Confirm Found',
          color: 'green'
        };
      case 'confirm':
        return {
          title: 'Confirm Location',
          description: `Confirm that "${item.name}" is correctly located at this position.`,
          placeholder: 'Optional: Any additional feedback...',
          submitText: 'Confirm Location',
          color: 'blue'
        };
    }
  };

  const config = getModalConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(reportType, comment.trim() || undefined);
      setComment('');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setComment('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4" role="dialog" aria-modal="true">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {config.title}
              </h3>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {/* Item Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-sm text-gray-600 truncate">{store.name}</p>
                  {item.price && (
                    <p className="text-sm font-medium text-green-600">${parseFloat(item.price).toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-700 mb-4">
              {config.description}
            </p>

            {/* Comment Field */}
            <div className="mb-6">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Comments
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={config.placeholder}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50
                  ${config.color === 'red' ? 'bg-red-600 hover:bg-red-700' : ''}
                  ${config.color === 'orange' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                  ${config.color === 'green' ? 'bg-green-600 hover:bg-green-700' : ''}
                  ${config.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                `}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  config.submitText
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};