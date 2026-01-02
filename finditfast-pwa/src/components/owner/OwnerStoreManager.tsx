import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StoreService } from '../../services/firestoreService';
import { StoreRequestService } from '../../services/storeRequestService';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { fileToBase64 } from '../../utils/fileUtils';
import type { Store, StoreRequest } from '../../types';

export const OwnerStoreManager: React.FC = () => {
  const { user, ownerProfile } = useAuth();
  const [ownedStores, setOwnedStores] = useState<Store[]>([]);
  const [storeRequests, setStoreRequests] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allOwnerStores, setAllOwnerStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ storeId: string; storeName: string } | null>(null);
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    storeName: '',
    address: '',
    latitude: '',
    longitude: '',
    documents: [] as any[]
  });

  useEffect(() => {
    loadOwnerData();
    loadAllOwnerStores();
  }, [user, ownerProfile]);

  const loadOwnerData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load stores owned by this user
      const stores = await StoreService.getAll();
      const userStores = stores.filter(store => store.ownerId === user.uid);
      setOwnedStores(userStores);

      // Load store requests made by this user
      const requests = await StoreRequestService.getStoreRequestsByUser(user.uid);
      console.log('Store requests loaded:', requests);
      setStoreRequests(requests);

    } catch (err: any) {
      setError(err?.message || 'Failed to load store data');
      console.error('Error loading owner data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load all stores and store requests for this owner
  const loadAllOwnerStores = async () => {
    if (!user?.uid) return;
    
    setStoresLoading(true);
    try {
      // Get all store requests by this owner
      // Get all store requests by this owner from storeRequests collection
      // This includes pending, approved, and rejected stores
      const storeRequestsQuery = query(
        collection(db, 'storeRequests'), 
        where('requestedBy', '==', user.uid)
      );
      const storeRequestsSnapshot = await getDocs(storeRequestsQuery);
      const allStores = storeRequestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: doc.data().status === 'approved' ? 'store' : 'request'
      }));
      
      setAllOwnerStores(allStores);
    } catch (error) {
      console.error('Error loading owner stores:', error);
      setError('Failed to load all stores data');
    } finally {
      setStoresLoading(false);
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };
  
  // Handle editing a store
  const handleEditStore = (store: any) => {
    setEditingStore(store);
    setEditFormData({
      name: store.name || store.storeName || '',
      storeName: store.storeName || store.name || '',
      address: store.address || '',
      latitude: store.latitude ? store.latitude.toString() : '',
      longitude: store.longitude ? store.longitude.toString() : '',
      documents: store.documents || []
    });
  };

  // Handle saving store edits
  const handleSaveEdit = async () => {
    if (!editingStore) return;

    setSavingEdit(true);
    try {
      const updateData = {
        name: editFormData.name,
        storeName: editFormData.storeName,
        address: editFormData.address,
        latitude: editFormData.latitude ? parseFloat(editFormData.latitude) : null,
        longitude: editFormData.longitude ? parseFloat(editFormData.longitude) : null,
        documents: editFormData.documents,
        updatedAt: Timestamp.now()
      };

      if (editingStore.type === 'store') {
        // Update store in stores collection
        const storeRef = doc(db, 'stores', editingStore.id);
        await updateDoc(storeRef, updateData);
      } else {
        // Update store request in storeRequests collection
        const requestRef = doc(db, 'storeRequests', editingStore.id);
        await updateDoc(requestRef, updateData);
      }

      // Update local state
      setAllOwnerStores(prev => prev.map(store => 
        store.id === editingStore.id 
          ? { ...store, ...updateData }
          : store
      ));

      if (editingStore.type === 'store') {
        setOwnedStores(prev => prev.map(store => 
          store.id === editingStore.id 
            ? { ...store, ...updateData }
            : store
        ));
      } else {
        setStoreRequests(prev => prev.map(req => 
          req.id === editingStore.id 
            ? { ...req, ...updateData }
            : req
        ));
      }

      setEditingStore(null);
      setSuccessMessage(`${editingStore.type === 'store' ? 'Store' : 'Store request'} updated successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reload data to ensure consistency
      loadOwnerData();
      loadAllOwnerStores();
    } catch (error: any) {
      console.error('Error updating store:', error);
      
      let errorMessage = 'Failed to update store. ';
      if (error?.code) {
        switch (error.code) {
          case 'permission-denied':
            errorMessage += 'You do not have permission to edit this item.';
            break;
          case 'not-found':
            errorMessage += 'The item was not found.';
            break;
          case 'unavailable':
            errorMessage += 'Service is temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage += `Error: ${error.message || 'Unknown error occurred'}`;
        }
      } else {
        errorMessage += 'Please try again.';
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle file uploads for documents
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploadingFiles(true);
    try {
      const newDocuments = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File "${file.name}" is larger than 5MB`);
        }
        
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File type "${file.type}" is not supported`);
        }

        // Convert to base64
        const base64Data = await fileToBase64(file);
        
        newDocuments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
          uploadedAt: new Date().toISOString()
        });
      }

      // Add to existing documents
      setEditFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...newDocuments]
      }));

    } catch (error: any) {
      setError(error.message || 'Failed to upload files');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploadingFiles(false);
    }
  };

  // Handle removing a document
  const handleRemoveDocument = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  // Handle getting current location for edit form
  const handleGetCurrentLocationEdit = async () => {
    setIsGettingLocation(true);
    
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      // Use a more aggressive approach to bypass browser permission caching issues
      let position: GeolocationPosition;
      
      // Try with watchPosition first (sometimes works when getCurrentPosition fails)
      let watchId: number | null = null;
      
      try {
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            reject(new Error('Location request timed out'));
          }, 3000); // Very short timeout for watch

          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              clearTimeout(timeoutId);
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
              }
              resolve(pos);
            },
            (err) => {
              clearTimeout(timeoutId);
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
              }
              reject(err);
            },
            {
              enableHighAccuracy: false,
              timeout: 2000,
              maximumAge: 0
            }
          );
        });
      } catch (watchError: any) {
        console.log('watchPosition failed, trying getCurrentPosition:', watchError);
        
        // If watchPosition fails, try getCurrentPosition as fallback
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Location request timed out after all attempts'));
          }, 5000);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeoutId);
              resolve(pos);
            },
            (err) => {
              clearTimeout(timeoutId);
              reject(err);
            },
            {
              enableHighAccuracy: false,
              timeout: 4000,
              maximumAge: 60000 // Allow slightly cached location as last resort
            }
          );
        });
      }

      const { latitude, longitude } = position.coords;
      
      // Validate coordinates
      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid location data received. Please try again.');
      }

      // Update the edit form data
      setEditFormData(prev => ({
        ...prev,
        latitude: latitude.toString(),
        longitude: longitude.toString()
      }));

    } catch (error: any) {
      console.error('Geolocation error in edit:', error);
      
      let errorMessage = 'Failed to get current location. ';
      
      if (error.code) {
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Location access is blocked by your browser. Please:\n\n' +
                          '• Click the lock icon (🔒) in your address bar\n' +
                          '• Set Location to "Allow"\n' +
                          '• Refresh the page and try again\n\n' +
                          'Or enter coordinates manually.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage += 'Location services are currently unavailable.';
            break;
          case 3: // TIMEOUT
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'Please enter coordinates manually.';
        }
      } else {
        errorMessage += 'Please enter coordinates manually.';
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
    } finally {
      setIsGettingLocation(false);
    }
  };
  
  // Handle deleting a store
  const handleDeleteStore = async (storeId: string, storeType: string) => {
    setDeletingStoreId(storeId);
    try {
      if (storeType === 'store') {
        // Delete from stores collection
        await StoreService.delete(storeId);
      } else {
        // Delete from storeRequests collection
        const storeRequestRef = doc(db, 'storeRequests', storeId);
        await deleteDoc(storeRequestRef);
      }
      
      // Update state to remove the deleted store
      setAllOwnerStores(prev => prev.filter(store => store.id !== storeId));
      // Also update the other state arrays
      if (storeType === 'store') {
        setOwnedStores(prev => prev.filter(store => store.id !== storeId));
      } else {
        setStoreRequests(prev => prev.filter(req => req.id !== storeId));
      }
      
      setDeleteConfirm(null);
      setSuccessMessage(`${storeType === 'store' ? 'Store' : 'Store request'} deleted successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Reload data after deletion
      loadOwnerData();
      loadAllOwnerStores();
    } catch (error: any) {
      console.error('Error deleting store:', error);
      
      let errorMessage = 'Failed to delete store. ';
      if (error?.code) {
        switch (error.code) {
          case 'permission-denied':
            errorMessage += 'You do not have permission to delete this item.';
            break;
          case 'not-found':
            errorMessage += 'The item was not found or has already been deleted.';
            break;
          case 'unavailable':
            errorMessage += 'Service is temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage += `Error: ${error.message || 'Unknown error occurred'}`;
        }
      } else {
        errorMessage += 'Please try again.';
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
    } finally {
      setDeletingStoreId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-red-600 text-center">
          <p>{error}</p>
          <button 
            onClick={() => { loadOwnerData(); loadAllOwnerStores(); }}
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      
      {/* All Stores Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">All My Stores</h2>
            <p className="text-gray-600">All your stores and store requests</p>
          </div>
          <div className="text-sm text-gray-500">
            {storesLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              <span>{allOwnerStores.length} stores found</span>
            )}
          </div>
        </div>
        
        {/* Stores List */}
        <div className="space-y-4">
          {allOwnerStores.length === 0 && !storesLoading ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-gray-600">You don't have any stores yet. Create a store request to get started.</p>
              <button 
                onClick={() => window.location.href = "/owner/dashboard?tab=requests"}
                className="mt-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900"
              >
                Create Store Request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allOwnerStores.map(store => (
                <div key={store.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-gray-900 truncate" title={store.name || store.storeName}>
                        {store.name || store.storeName || 'Unnamed Store'}
                      </h3>
                      <p className={`text-sm ${store.status === 'approved' ? 'text-green-600' : store.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {store.type === 'store' ? 'Active Store' : `Request: ${store.status || 'pending'}`}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditStore(store)}
                        className="flex items-center p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                        title="Edit store"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="text-xs font-medium">Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ storeId: store.id, storeName: store.name || store.storeName || 'this store' })}
                        className="flex items-center p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                        title="Delete store"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="text-xs font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Location:</span><br />
                      <span className="truncate block" title={store.address || 'Not specified'}>
                        {store.address || 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span><br />
                      <span>{store.createdAt ? (typeof store.createdAt === 'object' ? new Date(store.createdAt.seconds * 1000).toLocaleDateString() : new Date(store.createdAt).toLocaleDateString()) : 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Stores */}
      {ownedStores.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              🏪 Your Active Stores ({ownedStores.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {ownedStores.map((store) => (
              <div key={store.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      {store.name}
                    </h4>
                    <p className="text-gray-600 mb-2">
                      📍 {store.address}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      🆔 Store ID: {store.id}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      📅 Created: {store.createdAt && typeof store.createdAt === 'object' && 'toDate' in store.createdAt 
                        ? store.createdAt.toDate().toLocaleDateString() 
                        : store.createdAt 
                        ? new Date(store.createdAt).toLocaleDateString() 
                        : 'Unknown'}
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        store.floorplanUrl 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {store.floorplanUrl ? '✅ Floorplan Uploaded' : '📋 Floorplan Needed'}
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store Requests Status */}
    

      
      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Store</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.storeName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingStoreId === deleteConfirm.storeId}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const store = allOwnerStores.find(s => s.id === deleteConfirm.storeId);
                  if (store) {
                    handleDeleteStore(store.id, store.type);
                  }
                }}
                disabled={deletingStoreId === deleteConfirm.storeId}
                className="px-4 py-2 text-white bg-red-600 rounded-lg font-medium hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingStoreId === deleteConfirm.storeId ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Store
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Store Dialog */}
      {editingStore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit {editingStore.type === 'store' ? 'Store' : 'Store Request'}
                </h3>
                <button
                  onClick={() => setEditingStore(null)}
                  disabled={savingEdit}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Store Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={editingStore.type === 'store' ? editFormData.name : editFormData.storeName}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      [editingStore.type === 'store' ? 'name' : 'storeName']: e.target.value
                    }))}
                    disabled={savingEdit}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter store name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Address
                  </label>
                  <textarea
                    rows={3}
                    value={editFormData.address}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                    disabled={savingEdit}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter store address"
                  />
                </div>

                {/* Location Coordinates */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Location Coordinates</label>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocationEdit}
                      disabled={savingEdit || isGettingLocation}
                      className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      {isGettingLocation ? (
                        <>
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Getting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>Get Location</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={editFormData.latitude}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, latitude: e.target.value }))}
                        disabled={savingEdit}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                        placeholder="Latitude"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={editFormData.longitude}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, longitude: e.target.value }))}
                        disabled={savingEdit}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                        placeholder="Longitude"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Business Documents</h4>
                
                {/* Current Documents */}
                {editFormData.documents.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Current Documents</h5>
                    <div className="space-y-2">
                      {editFormData.documents.map((doc: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {doc.type?.includes('pdf') ? (
                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                              <p className="text-xs text-gray-500">
                                {doc.size ? (doc.size / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveDocument(index)}
                            disabled={savingEdit}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload New Documents */}
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isUploadingFiles ? 'border-gray-400 bg-gray-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600 mb-2">
                    {isUploadingFiles ? 'Converting files to secure storage format...' : 'Upload additional business documents'}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 5MB per file)</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    disabled={savingEdit || isUploadingFiles}
                    className="hidden"
                    id="edit-documents-upload"
                  />
                  <label
                    htmlFor="edit-documents-upload"
                    className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium ${
                      savingEdit || isUploadingFiles
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    {isUploadingFiles ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Documents
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-4 pt-6 px-6 pb-6 border-t border-gray-200">
              <button
                onClick={() => setEditingStore(null)}
                disabled={savingEdit}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || isUploadingFiles}
                className="px-6 py-3 text-white bg-blue-600 rounded-xl font-medium hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEdit ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
