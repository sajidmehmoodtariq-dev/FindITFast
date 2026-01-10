import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Store, Item, StoreOwner, Report, StorePlan } from '../types';

// Generic Firestore operations
export class FirestoreService {
  /**
   * Get all documents from a collection
   */
  static async getCollection<T>(collectionName: string, constraints: QueryConstraint[] = []): Promise<T[]> {
    try {
      const collectionRef = collection(db, collectionName);
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get a single document by ID
   */
  static async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Add a new document to a collection
   */
  static async addDocument<T>(collectionName: string, data: Omit<T, 'id'>): Promise<string> {
    try {
      const collectionRef = collection(db, collectionName);
      const docRef = await addDoc(collectionRef, data);
      return docRef.id;
    } catch (error) {
      console.error(`Error adding document to ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing document
   */
  static async updateDocument(collectionName: string, id: string, data: Partial<any>): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(collectionName: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  }
}

// Specific service methods for each collection
export const StoreService = {
  getAll: async (): Promise<Store[]> => {
    console.log('🏪 [STORE SERVICE DEBUG] Getting approved stores...');
    // Get approved stores and filter out deleted ones client-side
    const allApprovedStores = await FirestoreService.getCollection<Store & { deleted?: boolean }>('storeRequests', [where('status', '==', 'approved')]);
    console.log('🏪 [STORE SERVICE DEBUG] Found approved stores before filtering:', allApprovedStores.length);
    
    // Filter out deleted stores client-side
    const activeStores = allApprovedStores.filter(store => !store.deleted);
    console.log('🏪 [STORE SERVICE DEBUG] Active stores after filtering:', activeStores.length);
    
    return activeStores;
  },
  getById: async (id: string): Promise<Store | null> => {
    const store = await FirestoreService.getDocument<Store & { deleted?: boolean }>('storeRequests', id);
    // Return null if store is deleted or doesn't exist
    if (!store || store.deleted) {
      return null;
    }
    return store;
  },
  getByOwner: async (ownerId: string): Promise<Store[]> => {
    const allOwnerStores = await FirestoreService.getCollection<Store & { deleted?: boolean }>('storeRequests', [
      where('ownerId', '==', ownerId), 
      where('status', '==', 'approved')
    ]);
    // Filter out deleted stores client-side
    return allOwnerStores.filter(store => !store.deleted);
  },
  getNearby: async (_latitude: number, _longitude: number, _radiusKm: number = 50): Promise<Store[]> => {
    // Note: For production, consider using GeoFirestore for more accurate geospatial queries
    // This is a simplified implementation that gets approved stores
    const allApprovedStores = await FirestoreService.getCollection<Store & { deleted?: boolean }>('storeRequests', [
      where('status', '==', 'approved')
    ]);
    // Filter out deleted stores client-side
    return allApprovedStores.filter(store => !store.deleted);
  },
  create: (store: Omit<Store, 'id'>) => FirestoreService.addDocument<Store>('storeRequests', store),
  update: async (id: string, data: Partial<Store>) => {
    // Handle temporary store IDs that may not exist yet
    if (id.startsWith('temp_')) {
      try {
        const docRef = doc(db, 'storeRequests', id);
        await setDoc(docRef, data, { merge: true });
      } catch (error) {
        console.error(`Error creating/updating temp store document:`, error);
        throw error;
      }
    } else {
      return FirestoreService.updateDocument('storeRequests', id, data);
    }
  },
  delete: (id: string) => FirestoreService.deleteDocument('storeRequests', id),
};

export const ItemService = {
  getAll: () => FirestoreService.getCollection<Item>('items'),
  getById: (id: string) => FirestoreService.getDocument<Item>('items', id),
  getByStore: async (storeId: string) => {
    // Try to get items with the exact storeId first
    let items = await FirestoreService.getCollection<Item>('items', [where('storeId', '==', storeId)]);
    
    // If no items found, try with common prefixes (temp_, virtual_)
    if (items.length === 0) {
      const prefixedIds = [`temp_${storeId}`, `virtual_${storeId}`];
      
      for (const prefixedId of prefixedIds) {
        const prefixedItems = await FirestoreService.getCollection<Item>('items', [where('storeId', '==', prefixedId)]);
        
        if (prefixedItems.length > 0) {
          items = prefixedItems;
          break;
        }
      }
    }
    
    // Also try searching for items that reference this store with cleaned storeId
    if (items.length === 0) {
      // Handle cases where items have storeId with prefix but we're searching with clean ID
      const allItems = await FirestoreService.getCollection<Item>('items');
      const matchingItems = allItems.filter(item => {
        if (!item.storeId) return false;
        
        // Remove common prefixes from item's storeId and compare
        const cleanedStoreId = item.storeId.replace(/^(temp_|virtual_)/, '');
        return cleanedStoreId === storeId;
      });
      
      if (matchingItems.length > 0) {
        items = matchingItems;
      }
    }
    
    return items;
  },
  search: async (searchTerm: string) => {
    console.log('🔍 [SEARCH DEBUG] Starting search for:', searchTerm);
    
    // Get all items for fuzzy search (Firestore doesn't support full-text search)
    const allItems = await FirestoreService.getCollection<Item>('items');
    console.log('📋 [SEARCH DEBUG] Total items in database:', allItems.length);
    
    if (allItems.length > 0) {
      console.log('📋 [SEARCH DEBUG] Sample items:', allItems.slice(0, 3).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        storeId: item.storeId,
        deleted: item.deleted
      })));
    }
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Filter items that contain the search term in name or description
    const matchingItems = allItems.filter(item => {
      // Skip deleted items
      if (item.deleted) {
        return false;
      }
      
      const nameMatch = item.name?.toLowerCase().includes(searchLower);
      const descMatch = item.description?.toLowerCase().includes(searchLower);
      const categoryMatch = item.category?.toLowerCase().includes(searchLower);
      const matches = nameMatch || descMatch || categoryMatch;
      
      if (matches) {
        console.log('✅ [SEARCH DEBUG] Found matching item:', {
          name: item.name,
          category: item.category,
          storeId: item.storeId,
          nameMatch,
          descMatch,
          categoryMatch
        });
      }
      
      return matches;
    });
    
    console.log('🎯 [SEARCH DEBUG] Matching items found:', matchingItems.length);

    // Sort by relevance: exact matches first, then verified items, then by name
    return matchingItems.sort((a, b) => {
      const aNameExact = a.name?.toLowerCase() === searchLower;
      const bNameExact = b.name?.toLowerCase() === searchLower;
      const aNameStart = a.name?.toLowerCase().startsWith(searchLower);
      const bNameStart = b.name?.toLowerCase().startsWith(searchLower);
      
      // Exact name match gets highest priority
      if (aNameExact && !bNameExact) return -1;
      if (!aNameExact && bNameExact) return 1;
      
      // Name starts with search term gets second priority
      if (aNameStart && !bNameStart) return -1;
      if (!aNameStart && bNameStart) return 1;
      
      // Verified items get third priority
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      
      // Finally sort alphabetically
      return (a.name || '').localeCompare(b.name || '');
    }).slice(0, 20); // Limit to 20 results
  },
  searchVerified: (searchTerm: string) =>
    FirestoreService.getCollection<Item>('items', [
      where('name', '>=', searchTerm.toLowerCase()),
      where('name', '<=', searchTerm.toLowerCase() + '\uf8ff'),
      where('verified', '==', true),
      orderBy('name'),
      orderBy('verifiedAt', 'desc'),
      limit(20)
    ]),
  incrementReportCount: async (id: string) => {
    const item = await FirestoreService.getDocument<Item>('items', id);
    if (item) {
      await FirestoreService.updateDocument('items', id, {
        reportCount: (item.reportCount || 0) + 1,
        updatedAt: new Date()
      });
    }
  },
  create: (item: Omit<Item, 'id'>) => FirestoreService.addDocument<Item>('items', item),
  update: (id: string, data: Partial<Item>) => FirestoreService.updateDocument('items', id, data),
  delete: (id: string) => FirestoreService.deleteDocument('items', id),
};

export const StoreOwnerService = {
  getAll: () => FirestoreService.getCollection<StoreOwner>('storeOwners'),
  getById: (id: string) => FirestoreService.getDocument<StoreOwner>('storeOwners', id),
  create: (owner: Omit<StoreOwner, 'id'>) => FirestoreService.addDocument<StoreOwner>('storeOwners', owner),
  createWithId: async (id: string, owner: Omit<StoreOwner, 'id'>): Promise<void> => {
    try {
      const docRef = doc(db, 'storeOwners', id);
      await setDoc(docRef, owner);
    } catch (error) {
      console.error('Error creating store owner with ID:', error);
      throw error;
    }
  },
  update: (id: string, data: Partial<StoreOwner>) => FirestoreService.updateDocument('storeOwners', id, data),
  delete: (id: string) => FirestoreService.deleteDocument('storeOwners', id),
};

export const ReportService = {
  getAll: () => FirestoreService.getCollection<Report>('reports'),
  getById: (id: string) => FirestoreService.getDocument<Report>('reports', id),
  getByItem: (itemId: string) =>
    FirestoreService.getCollection<Report>('reports', [
      where('itemId', '==', itemId),
      orderBy('timestamp', 'desc')
    ]),
  getByStore: (storeId: string) =>
    FirestoreService.getCollection<Report>('reports', [
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    ]),
  getRecentReports: (days: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return FirestoreService.getCollection<Report>('reports', [
      where('timestamp', '>=', cutoffDate),
      orderBy('timestamp', 'desc'),
      limit(50)
    ]);
  },
  getByStoreOwner: async (ownerId: string) => {
    try {
      console.log('🔍 Fetching reports for owner:', ownerId);
      
      // Get all stores owned by this user from BOTH collections
      const storeQueries = [
        // From stores collection (active stores)
        FirestoreService.getCollection<Store>('stores', [
          where('ownerId', '==', ownerId)
        ]),
        // From storeRequests collection (approved stores) - using ownerId
        FirestoreService.getCollection<Store>('storeRequests', [
          where('ownerId', '==', ownerId), 
          where('status', '==', 'approved')
        ]),
        // From storeRequests collection (approved stores) - using requestedBy
        FirestoreService.getCollection<Store>('storeRequests', [
          where('requestedBy', '==', ownerId), 
          where('status', '==', 'approved')
        ]),
        // Fallback: Get all approved stores and filter by ownerId client-side
        FirestoreService.getCollection<Store>('storeRequests', [
          where('status', '==', 'approved')
        ])
      ];
      
      // Execute all queries in parallel
      const storeResults = await Promise.all(storeQueries);
      
      // Combine and deduplicate stores - filter to only include stores owned by this user
      const allStores = storeResults.flat().filter((store: any) => 
        store.ownerId === ownerId || store.requestedBy === ownerId
      );
      const uniqueStores = allStores.filter((store, index, arr) => 
        arr.findIndex(s => s.id === store.id) === index
      );
      
      console.log(`📦 Found ${uniqueStores.length} stores for owner`);
      
      if (uniqueStores.length === 0) {
        console.log('⚠️ No stores found for owner');
        return [];
      }
      
      const storeIds = uniqueStores.map(store => store.id);
      console.log('🏪 Store IDs:', storeIds);
      
      // Get reports for all stores - handle both exact and prefixed store IDs
      const allReports: Report[] = [];
      
      for (const storeId of storeIds) {
        // Try exact store ID first
        let reports = await FirestoreService.getCollection<Report>('reports', [
          where('storeId', '==', storeId),
          orderBy('timestamp', 'desc')
        ]);
        
        console.log(`📊 Found ${reports.length} reports for store ${storeId}`);
        
        // If no reports found, try with prefixes
        if (reports.length === 0) {
          const prefixedIds = [`temp_${storeId}`, `virtual_${storeId}`];
          
          for (const prefixedId of prefixedIds) {
            const prefixedReports = await FirestoreService.getCollection<Report>('reports', [
              where('storeId', '==', prefixedId),
              orderBy('timestamp', 'desc')
            ]);
            
            console.log(`📊 Found ${prefixedReports.length} reports for prefixed store ${prefixedId}`);
            
            if (prefixedReports.length > 0) {
              reports = prefixedReports;
              break;
            }
          }
        }
        
        allReports.push(...reports);
      }
      
      console.log(`✅ Total reports found: ${allReports.length}`);
      
      // Sort all reports by timestamp
      const sortedReports = allReports.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.()?.getTime() || 0;
        const timeB = b.timestamp?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
      
      return sortedReports;
      
    } catch (error) {
      console.error('❌ Error getting reports for store owner:', error);
      return [];
    }
  },
  updateStatus: (id: string, status: 'pending' | 'resolved' | 'dismissed') =>
    FirestoreService.updateDocument('reports', id, { status }),
  create: (report: Omit<Report, 'id'>) => FirestoreService.addDocument<Report>('reports', report),
  update: (id: string, data: Partial<Report>) => FirestoreService.updateDocument('reports', id, data),
  delete: (id: string) => FirestoreService.deleteDocument('reports', id),
};

export const StorePlanService = {
  getAll: () => FirestoreService.getCollection<StorePlan>('storePlans'),
  getById: (id: string) => FirestoreService.getDocument<StorePlan>('storePlans', id),
  getByStore: async (storeId: string) => {
    // Try to get store plans with the exact storeId first
    let plans = await FirestoreService.getCollection<StorePlan>('storePlans', [
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc')
    ]);
    
    // If no plans found, try with common prefixes (temp_, virtual_)
    if (plans.length === 0) {
      const prefixedIds = [`temp_${storeId}`, `virtual_${storeId}`];
      
      for (const prefixedId of prefixedIds) {
        const prefixedPlans = await FirestoreService.getCollection<StorePlan>('storePlans', [
          where('storeId', '==', prefixedId),
          orderBy('createdAt', 'desc')
        ]);
        
        if (prefixedPlans.length > 0) {
          plans = prefixedPlans;
          break;
        }
      }
    }
    
    return plans;
  },
  getByOwner: (ownerId: string) =>
    FirestoreService.getCollection<StorePlan>('storePlans', [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    ]),
  getActiveByStore: async (storeId: string) => {
    // Try to get active store plans with the exact storeId first
    let plans = await FirestoreService.getCollection<StorePlan>('storePlans', [
      where('storeId', '==', storeId),
      where('isActive', '==', true),
      limit(1)
    ]);
    
    // If no plans found, try with common prefixes (temp_, virtual_)
    if (plans.length === 0) {
      const prefixedIds = [`temp_${storeId}`, `virtual_${storeId}`];
      
      for (const prefixedId of prefixedIds) {
        const prefixedPlans = await FirestoreService.getCollection<StorePlan>('storePlans', [
          where('storeId', '==', prefixedId),
          where('isActive', '==', true),
          limit(1)
        ]);
        
        if (prefixedPlans.length > 0) {
          plans = prefixedPlans;
          break;
        }
      }
    }
    
    return plans;
  },
  create: async (storePlan: Omit<StorePlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const now = new Date();
    const docData = {
      ...storePlan,
      uploadedAt: now, // Convert Date to Timestamp for Firestore
      createdAt: now,
      updatedAt: now,
    };
    return FirestoreService.addDocument<any>('storePlans', docData);
  },
  update: (id: string, data: Partial<StorePlan>) => {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    return FirestoreService.updateDocument('storePlans', id, updateData);
  },
  delete: (id: string) => FirestoreService.deleteDocument('storePlans', id),
  setActiveStorePlan: async (storeId: string, storePlanId: string): Promise<void> => {
    // First, deactivate all store plans for this store
    const existingPlans = await StorePlanService.getByStore(storeId);
    const updatePromises = existingPlans.map(plan => 
      StorePlanService.update(plan.id, { isActive: false })
    );
    await Promise.all(updatePromises);
    
    // Then activate the selected plan
    await StorePlanService.update(storePlanId, { isActive: true });
  },
};

// Main service export for convenience
export const firestoreService = {
  getStore: StoreService.getById,
  getStores: StoreService.getAll,
  getItem: ItemService.getById,
  getItems: ItemService.getAll,
  searchItems: ItemService.search,
  getStoreItems: ItemService.getByStore,
  createReport: ReportService.create,
  getReports: ReportService.getAll,
};