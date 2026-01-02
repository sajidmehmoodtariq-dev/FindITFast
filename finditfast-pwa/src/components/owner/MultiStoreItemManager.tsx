import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ItemManager as SingleStoreItemManager } from './ItemManager';
import type { Store } from '../../types';

export const MultiStoreItemManager: React.FC = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  useEffect(() => {
    loadUserStores();
  }, [user]);

  const loadUserStores = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Get all approved stores owned by this user that have floorplans
      const storesQuery = query(
        collection(db, 'storeRequests'),
        where('ownerId', '==', user.uid),
        where('status', '==', 'approved')
      );
      
      const storesSnapshot = await getDocs(storesQuery);
      const storesData = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Store[];

      // Filter stores that have floorplans
      const storesWithFloorplans = storesData.filter(store => store.floorplanUrl);
      
      setStores(storesWithFloorplans);
      
      // Auto-select first store if only one exists
      if (storesWithFloorplans.length === 1) {
        setSelectedStore(storesWithFloorplans[0].id);
      }

    } catch (err) {
      console.error('Error loading stores:', err);
      setError('Failed to load your stores');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
          <span className="ml-3 text-gray-600">Loading your stores...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Stores</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadUserStores}
            className="bg-gray-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-900 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Floorplan Required</h3>
          <p className="text-gray-600 mb-4">
            Upload floorplans for your approved stores before managing items.
          </p>
          <button
            onClick={() => window.location.href = '/owner/dashboard?tab=floorplan'}
            className="bg-gray-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-900 transition-colors"
          >
            Upload Floorplans
          </button>
        </div>
      </div>
    );
  }

  // If only one store, show the item manager directly
  if (stores.length === 1 && selectedStore) {
    const store = stores[0];
    return (
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Item Management</h2>
          <p className="text-gray-600">Managing items for: <span className="font-medium">{store.name}</span></p>
        </div>
        <SingleStoreItemManager
          storeId={store.id}
          floorplanUrl={store.floorplanUrl!}
          existingItems={[]}
          onItemAdded={(item) => console.log('Item added:', item)}
          onError={(error) => console.error('Item error:', error)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store Selection */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Item Management</h2>
            <p className="text-gray-600">Select a store to manage its items</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Stores with Floorplans</p>
            <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
          </div>
        </div>

        {/* Store Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div
              key={store.id}
              className={`border rounded-xl p-4 transition-all cursor-pointer ${
                selectedStore === store.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => setSelectedStore(selectedStore === store.id ? null : store.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{store.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {store.address?.length > 40 ? store.address.substring(0, 40) + '...' : store.address || 'Address not available'}
                  </p>
                </div>
                <div className="ml-3 flex flex-col items-end">
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-2">
                    🏗️ Ready
                  </div>
                </div>
              </div>
              
              {/* Store Floorplan Preview */}
              {store.floorplanUrl && (
                <div className="mt-3">
                  <img
                    src={store.floorplanUrl}
                    alt={`${store.name} floorplan`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                </div>
              )}
              
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created: {new Date().toLocaleDateString()}</span>
                  <span>Store ID: {store.id.substring(0, 8)}...</span>
                </div>
              </div>
              
              {selectedStore === store.id && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-600 font-medium">
                    Manage items for this store below ↓
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Item Manager for Selected Store */}
      {selectedStore && (
        <div className="bg-white rounded-xl shadow-sm">
          {(() => {
            const store = stores.find(s => s.id === selectedStore);
            if (!store) return null;
            
            return (
              <div>
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Managing Items: {store.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    📍 {store.address || 'Address not available'}
                  </p>
                </div>
                
                <SingleStoreItemManager
                  storeId={store.id}
                  floorplanUrl={store.floorplanUrl!}
                  existingItems={[]}
                  onItemAdded={(item) => {
                    console.log('Item added:', item);
                    // You can add a success message here if needed
                  }}
                  onError={(error) => {
                    console.error('Item error:', error);
                    // You can add error handling here if needed
                  }}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-1">How to manage items:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Click on any store card above to select it</li>
              <li>• Use the item manager below to add products to your store</li>
              <li>• Click on the floorplan to place items in specific locations</li>
              <li>• Upload clear product images for better customer experience</li>
              <li>• Add accurate prices and descriptions for each item</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
