import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StorePlanService, ItemService } from '../../services/firestoreService';
import { StoreCard } from './StoreCard';
import { InventoryModal } from './InventoryModal';
import { FullScreenInventory } from './FullScreenInventory';
import { ensureStoreOwnerRecord } from '../../utilities/storeOwnerUtils';
import type { Store, StorePlan, Item } from '../../types';

interface StoreWithPlans {
  store: Store;
  plans: StorePlan[];
  items: Item[];
  itemCount: number;
  categories: string[];
}

export const EnhancedInventoryManager: React.FC = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreWithPlans[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<{
    store: Store;
    plan: StorePlan;
  } | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  useEffect(() => {
    loadOwnerStores();
  }, [user]);

  const loadOwnerStores = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Loading approved stores for user:', user.uid, user.email);

      // Ensure store owner record exists
      await ensureStoreOwnerRecord(user);

      // Get approved store requests (same logic as FloorplanManager)
      const requestsQuery = query(
        collection(db, 'storeRequests'),
        where('requestedBy', '==', user.uid),
        where('status', '==', 'approved')
      );
      
      const requestsSnapshot = await getDocs(requestsQuery);
      const approvedRequestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        approvedAt: doc.data().approvedAt?.toDate() || new Date(),
      }));

      console.log('Found approved requests:', approvedRequestsData.length);
      console.log('Approved requests data:', approvedRequestsData.map(r => ({ 
        id: r.id, 
        storeName: (r as any).storeName, 
        storeId: (r as any).storeId,
        status: (r as any).status 
      })));

      if (approvedRequestsData.length === 0) {
        console.log('No approved store requests found');
        setStores([]);
        return;
      }

      // The approved requests ARE the stores (storeRequests collection with status='approved')
      // No need to query a separate 'stores' collection
      const allStoresData = approvedRequestsData.map(request => {
        const requestData = request as any; // Type assertion for flexibility
        return {
          id: request.id,
          name: requestData.name || requestData.storeName,
          address: requestData.address || '',
          location: requestData.location || { latitude: 0, longitude: 0 },
          ownerId: requestData.ownerId || user.uid,
          createdAt: requestData.createdAt || new Date(),
          updatedAt: requestData.updatedAt || new Date(),
          floorplanUrl: requestData.floorplanUrl,
          floorplanData: requestData.floorplanData
        } as Store;
      });

      console.log('Found stores:', allStoresData.length);

      // Load all store plans for this owner
      let storePlansData: StorePlan[] = [];
      try {
        console.log('Attempting to load store plans...');
        const plansQuery = query(
          collection(db, 'storePlans'),
          where('ownerId', '==', user.uid)
        );
        const plansSnapshot = await getDocs(plansQuery);
        storePlansData = plansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StorePlan[];
        console.log('Store plans loaded successfully:', storePlansData.length);
      } catch (planError) {
        console.warn('Could not load store plans:', planError);
        storePlansData = [];
      }

      // Load stores, plans, and items for each approved request
      const storesWithData: StoreWithPlans[] = [];

      for (const request of approvedRequestsData) {
        try {
          const requestData = request as any;
          
          // Find the corresponding store - try multiple strategies
          let matchingStore = allStoresData.find(store => 
            store.id === requestData.storeId
          );
          
          if (!matchingStore) {
            // Fallback: try to match by name and owner
            matchingStore = allStoresData.find(store => 
              store.name === requestData.storeName && 
              store.ownerId === user.uid
            );
          }

          // If we still don't have a matching store, create a virtual one for display
          if (!matchingStore) {
            console.log(`Creating virtual store for request: ${requestData.storeName}`);
            matchingStore = {
              id: requestData.storeId || `virtual_${requestData.id}`,
              name: requestData.storeName,
              address: requestData.address,
              location: requestData.location || { latitude: 0, longitude: 0 },
              ownerId: user.uid,
              createdAt: requestData.approvedAt || new Date(),
              updatedAt: requestData.approvedAt || new Date()
            } as Store;
          }

          // Get store plans for this store
          const plans = storePlansData.filter(plan => 
            plan.storeId === matchingStore!.id || 
            plan.storeId === requestData.storeId ||
            plan.storeId === `temp_${requestData.id}`
          );

          // Get items for this store
          const items = await ItemService.getByStore(matchingStore.id);
          
          // Generate categories from items
          const categories = Array.from(new Set(
            items.map(item => {
              // Extract category from item name (first word)
              const firstWord = item.name.split(' ')[0].toLowerCase();
              return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
            })
          )).slice(0, 3); // Limit to 3 categories for display

          storesWithData.push({
            store: matchingStore,
            plans,
            items,
            itemCount: items.length,
            categories: categories.length > 0 ? categories : ['General']
          });

          console.log(`✅ Loaded store: ${matchingStore.name} with ${plans.length} plans and ${items.length} items`);

        } catch (storeError) {
          console.error(`Error loading store for request ${(request as any).id}:`, storeError);
        }
      }

      setStores(storesWithData);
      console.log('Total stores with data:', storesWithData.length);

    } catch (error) {
      console.error('Error loading owner stores:', error);
      setError('Failed to load stores. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInventory = (store: Store, plan: StorePlan) => {
    setSelectedInventory({ store, plan });
  };

  const handleManageItems = (store: Store) => {
    setSelectedStore(store);
  };

  const handleCloseInventory = () => {
    setSelectedInventory(null);
    // Reload data to reflect any changes
    loadOwnerStores();
  };

  const handleCloseFullScreenInventory = () => {
    setSelectedStore(null);
    // Reload data to reflect any changes
    loadOwnerStores();
  };

  const handleSetActivePlan = async (storeId: string, planId: string) => {
    try {
      // First, deactivate all plans for this store
      const storeData = stores.find(s => s.store.id === storeId);
      if (storeData) {
        for (const plan of storeData.plans) {
          if (plan.id !== planId && plan.isActive) {
            await updateDoc(doc(db, 'storePlans', plan.id), {
              isActive: false,
              updatedAt: new Date()
            });
          }
        }
      }

      // Activate the selected plan
      await updateDoc(doc(db, 'storePlans', planId), {
        isActive: true,
        updatedAt: new Date()
      });

      // Reload data
      await loadOwnerStores();
      
    } catch (error) {
      console.error('Error setting active plan:', error);
      setError('Failed to update active plan.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your items...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Items</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadOwnerStores}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Stores Available</h3>
          <p className="text-gray-600 mb-6">
            You don't have any approved stores yet. Request a store to get started with item management.
          </p>
          <button
            onClick={() => window.location.href = '/owner/dashboard?tab=request-store'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Request New Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Item Management</h1>
        <p className="text-gray-600">
          Manage items across your {stores.length} store{stores.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map((storeData) => (
          <StoreCard
            key={storeData.store.id}
            storeData={storeData}
            onOpenInventory={handleOpenInventory}
            onManageItems={handleManageItems}
            onSetActivePlan={handleSetActivePlan}
          />
        ))}
      </div>

      {/* Items Modal */}
      {selectedInventory && (
        <InventoryModal
          store={selectedInventory.store}
          storePlan={selectedInventory.plan}
          onClose={handleCloseInventory}
        />
      )}

      {/* Full Screen Items */}
      {selectedStore && (
        <FullScreenInventory
          store={selectedStore}
          storePlans={stores.find(s => s.store.id === selectedStore.id)?.plans || []}
          onClose={handleCloseFullScreenInventory}
        />
      )}
    </div>
  );
};
