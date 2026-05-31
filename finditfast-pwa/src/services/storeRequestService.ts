import {
  collection,
  addDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import type { StoreRequest, Store } from '../types/index';

export interface CreateStoreRequestData {
  storeName: string;
  address: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  requestedBy: string; // Making this required to ensure it's always set
  ownerId?: string; // For backward compatibility
  ownerName?: string;
  ownerEmail?: string;
  notes?: string;
}

export class StoreRequestService {
  private static readonly COLLECTION_NAME = 'storeRequests';

  /**
   * Submit a new store request and automatically create the store
   */
  static async createStoreRequest(data: CreateStoreRequestData): Promise<string> {
    try {
      // Generate unique store ID
      const storeId = `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the store request data
      const requestData = {
        ...data,
        storeId, // Include the generated storeId
        requestedAt: Timestamp.now(),
        status: 'pending' as const,
      };

      // Create the actual store record immediately
      const storeData: Omit<Store, 'id'> = {
        name: data.storeName,
        address: data.address,
        location: data.location || {
          latitude: 0,
          longitude: 0 // Default coordinates - can be updated later
        },
        ownerId: data.requestedBy,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };

      // Create both the store request and the actual store
      const [requestDocRef] = await Promise.all([
        addDoc(collection(db, this.COLLECTION_NAME), requestData),
        setDoc(doc(db, 'stores', storeId), storeData)
      ]);

      console.log(`✅ Store created with ID: ${storeId} for request: ${requestDocRef.id}`);
      return requestDocRef.id;
    } catch (error) {
      console.error('Error creating store request and store:', error);
      throw new Error('Failed to submit store request. Please try again.');
    }
  }

  /**
   * Get all store requests (admin function)
   */
  static async getAllStoreRequests(): Promise<StoreRequest[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('requestedAt', 'desc')
      );
      // Always fetch from server so admins see requests submitted after their last visit
      const querySnapshot = await getDocsFromServer(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date(),
      })) as StoreRequest[];
    } catch (error) {
      console.error('Error fetching store requests:', error);
      throw new Error('Failed to fetch store requests.');
    }
  }

  static subscribeToAllStoreRequests(
    onUpdate: (requests: StoreRequest[]) => void,
    onError: (err: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('requestedAt', 'desc')
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        })) as StoreRequest[];
        onUpdate(requests);
      },
      (error) => {
        console.error('Store request subscription error:', error);
        onError(new Error('Failed to receive store request updates.'));
      }
    );
  }

  /**
   * Get store requests by user (if authenticated)
   */
  static async getStoreRequestsByUser(userId: string): Promise<StoreRequest[]> {
    try {
      // First try with the composite index query (requestedBy + orderBy)
      try {
        const q = query(
          collection(db, this.COLLECTION_NAME),
          where('requestedBy', '==', userId),
          orderBy('requestedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        })) as StoreRequest[];
      } catch (indexError) {
        // If index error occurs, fall back to a simpler query without sorting
        // This will work while the index is being built
        console.warn('Using fallback query while index builds:', indexError);
        
        const fallbackQuery = query(
          collection(db, this.COLLECTION_NAME),
          where('requestedBy', '==', userId)
        );
        
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const results = fallbackSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        })) as StoreRequest[];
        
        // Sort client-side instead
        return results.sort((a, b) => 
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        );
      }
    } catch (error) {
      console.error('Error fetching user store requests:', error);
      throw new Error('Failed to fetch your store requests.');
    }
  }

  /**
   * Update store request status (admin function)
   */
  static async updateStoreRequestStatus(
    requestId: string, 
    status: 'pending' | 'approved' | 'rejected',
    notes?: string
  ): Promise<void> {
    try {
      const requestRef = doc(db, this.COLLECTION_NAME, requestId);
      const updateData: any = { status };
      
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      await updateDoc(requestRef, updateData);
    } catch (error) {
      console.error('Error updating store request status:', error);
      throw new Error('Failed to update store request status.');
    }
  }

  /**
   * Validate store request data
   */
  static validateStoreRequestData(data: CreateStoreRequestData): string[] {
    const errors: string[] = [];

    if (!data.storeName?.trim()) {
      errors.push('Store name is required');
    } else if (data.storeName.trim().length < 2) {
      errors.push('Store name must be at least 2 characters long');
    }

    if (!data.address?.trim()) {
      errors.push('Store address is required');
    } else if (data.address.trim().length < 5) {
      errors.push('Please provide a complete address');
    }

    if (data.location) {
      if (typeof data.location.latitude !== 'number' || 
          typeof data.location.longitude !== 'number') {
        errors.push('Invalid location coordinates');
      }
    }

    return errors;
  }
}