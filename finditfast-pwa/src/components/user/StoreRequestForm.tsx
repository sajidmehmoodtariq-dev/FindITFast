import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StoreRequestService } from '../../services/storeRequestService';
import { GeocodingService } from '../../services/geocodingService';
import type { CreateStoreRequestData } from '../../services/storeRequestService';

interface StoreRequestFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FormData {
  storeName: string;
  address: string;
  notes?: string;
}

export const StoreRequestForm: React.FC<StoreRequestFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    storeName: '',
    address: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // Geocoding functionality integrated into form submission

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage('');

    if (!user?.uid) {
      setErrors(['Please sign in to submit a store request.']);
      return;
    }

    // Create validation data with requestedBy
    const validationData: CreateStoreRequestData = {
      ...formData,
      requestedBy: user.uid,
    };

    const validationErrors = StoreRequestService.validateStoreRequestData(validationData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Geocode the address to get coordinates
    setIsGeocodingAddress(true);
    let geocodingResult = null;
    try {
      geocodingResult = await GeocodingService.geocodeAddress(formData.address);
      if (!geocodingResult) {
        setErrors(['Unable to find location for the provided address. Please check the address and try again.']);
        return;
      }
    } catch (geocodingError: any) {
      setErrors([`Address validation failed: ${geocodingError.message || 'Please check the address and try again.'}`]);
      return;
    } finally {
      setIsGeocodingAddress(false);
    }

    setIsSubmitting(true);

    try {
      const requestData: CreateStoreRequestData = {
        ...formData,
        requestedBy: user.uid,
        // Add geocoded location data
        location: {
          latitude: geocodingResult.latitude,
          longitude: geocodingResult.longitude
        },
      };

      await StoreRequestService.createStoreRequest(requestData);
      setSuccessMessage('Store request submitted and store created successfully! Your store is now live and awaiting admin approval for full activation.');
      
      // Reset form
      setFormData({
        storeName: '',
        address: '',
        notes: '',
      });

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 2000);

    } catch (error: any) {
      setErrors([error.message || 'Failed to submit store request. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Request Submitted!</h3>
          <p className="mt-2 text-sm text-gray-600">{successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Request a New Store</h2>
        <p className="mt-2 text-sm text-gray-600">
          Can't find a store you're looking for? Let us know and we'll try to add it!
        </p>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <ul className="text-sm text-red-700 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="storeName" className="block text-sm font-medium text-gray-700">
            Store Name *
          </label>
          <input
            type="text"
            id="storeName"
            name="storeName"
            value={formData.storeName}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., SuperMart Downtown"
            required
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Store Address *
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="123 Main St, City, State"
            required
          />
        </div>

        {/* Location coordinates will be automatically generated from the address using geocoding */}
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center mb-2">
            <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-sm font-medium text-blue-900">Location Information</h4>
          </div>
          <p className="text-xs text-blue-700">
            Store coordinates will be automatically generated from your address when you submit the form. No need to manually enter coordinates or allow location permissions.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Additional Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional information about the store..."
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || isGeocodingAddress}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isSubmitting ? 'Submitting...' : isGeocodingAddress ? 'Validating Address...' : 'Submit Request'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};