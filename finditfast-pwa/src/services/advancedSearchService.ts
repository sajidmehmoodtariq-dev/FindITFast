import { ItemService, FirestoreService } from './firestoreService';
import { Timestamp, where } from 'firebase/firestore';
import type { SearchResult } from '../types/search';
import type { Store } from '../types';

export class AdvancedSearchService {
  private static readonly SEARCH_HISTORY_KEY = 'finditfast_search_history';
  private static readonly MAX_HISTORY_ITEMS = 10;
  private static readonly SEARCH_CACHE_KEY = 'finditfast_search_cache';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Enhanced search with fuzzy matching and location-based sorting
   */
  static async searchItems(query: string, userLocation?: { latitude: number; longitude: number }): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    try {
      // TEMPORARILY DISABLE CACHE TO ENSURE FRESH DATA
      localStorage.removeItem(this.SEARCH_CACHE_KEY);
      
      // Get cached results first to improve performance
      const cachedResults = this.getCachedResults(query);
      if (cachedResults) {
        return this.sortByLocation(cachedResults, userLocation);
      }

      // Step 1: Get all approved stores from storeRequests collection
      const approvedStores = await FirestoreService.getCollection('storeRequests', [where('status', '==', 'approved')]);
      
      // Log the actual store data for debugging
      if (approvedStores.length > 0) {
        // Store data available for processing
      } else {
        // Fallback: check if any store requests exist
        const allStoreRequests = await FirestoreService.getCollection('storeRequests');
        if (allStoreRequests.length > 0) {
          // Store requests exist but none are approved
        }
      }

      // Step 2: Get all items that match the search query
      const allItems = await ItemService.search(query);

      // Step 3: Create store lookup map for approved stores only
      const approvedStoreMap = new Map(approvedStores.map((store: any) => [store.id, store]));
      
      // Step 4: Filter items to only those in approved stores and calculate distances
      const results: SearchResult[] = [];
      
      for (const item of allItems) {
        // Clean store ID (remove virtual_ prefix if present)
        let storeId = item.storeId;
        if (storeId && storeId.startsWith('virtual_')) {
          storeId = storeId.replace('virtual_', '');
        }
        
        // Check if item's store is approved
        const approvedStore = approvedStoreMap.get(storeId);
        if (!approvedStore) {
          continue;
        }

        // Convert storeRequest to Store format for consistency
        const storeData: Store = {
          id: approvedStore.id,
          name: approvedStore.storeName || approvedStore.name || 'Store',
          address: approvedStore.storeAddress || approvedStore.address || 'Address not available',
          location: approvedStore.storeLocation || approvedStore.location || { latitude: 0, longitude: 0 },
          ownerId: approvedStore.ownerId || 'unknown',
          createdAt: approvedStore.createdAt || Timestamp.now(),
          updatedAt: approvedStore.updatedAt || Timestamp.now()
        };

        // Create search result
        const result: SearchResult = {
          ...item,
          store: storeData
        };

        // Calculate distance if user location is provided
        if (userLocation && storeData.location?.latitude && storeData.location?.longitude) {
          result.distance = this.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            storeData.location.latitude,
            storeData.location.longitude
          );
        }

        results.push(result);
      }

      // Step 5: Sort by distance (nearest first)
      const sortedResults = this.sortByLocation(results, userLocation);

      // Cache results for better performance
      this.cacheResults(query, sortedResults);

      // Save search to history
      this.saveSearchToHistory(query);

      return sortedResults;
      
    } catch (error) {
      console.error('🚨 Advanced search error:', error);
      
      // Fallback to simple search if advanced search fails
      try {
        return await this.fallbackSearch(query, userLocation);
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        throw new Error('Search is temporarily unavailable. Please try again.');
      }
    }
  }

  /**
   * Get search history from localStorage
   */
  static getSearchHistory(): string[] {
    try {
      const history = localStorage.getItem(this.SEARCH_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }

  /**
   * Save search query to history
   */
  private static saveSearchToHistory(query: string): void {
    try {
      const history = this.getSearchHistory();
      const updatedHistory = [query, ...history.filter(item => item !== query)].slice(0, this.MAX_HISTORY_ITEMS);
      
      localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.warn('Failed to save search to history:', error);
    }
  }

  /**
   * Clear search history
   */
  static clearSearchHistory(): void {
    try {
      localStorage.removeItem(this.SEARCH_HISTORY_KEY);
    } catch (error) {
      console.warn('Failed to clear search history:', error);
    }
  }

  // Additional private methods would go here...
  // I'm including just the essential methods for now to fix the immediate import issue

  private static sortByLocation(results: SearchResult[], userLocation?: { latitude: number; longitude: number }): SearchResult[] {
    if (!userLocation) {
      return results;
    }

    return results.map(result => {
      const store = result.store;
      if (store?.location?.latitude && store?.location?.longitude) {
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          store.location.latitude,
          store.location.longitude
        );
        return { ...result, distance };
      }
      return result;
    }).sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private static async fallbackSearch(query: string, userLocation?: { latitude: number; longitude: number }): Promise<SearchResult[]> {
    try {
      const [items, approvedStores] = await Promise.all([
        ItemService.search(query),
        FirestoreService.getCollection('storeRequests', [where('status', '==', 'approved')])
      ]);
      const storeMap = new Map(approvedStores.map((store: any) => [store.id, store]));

      const results = items
        .map((item: any) => {
          // Handle both regular and virtual store IDs
          let storeId = item.storeId;
          if (storeId && storeId.startsWith('virtual_')) {
            storeId = storeId.replace('virtual_', '');
          }
          
          const store = storeMap.get(storeId);
          
          // Skip items without approved stores
          if (!store) {
            return null;
          }

          // Convert storeRequest to Store format
          const storeData: Store = {
            id: store.id,
            name: store.storeName || store.name || 'Store',
            address: store.storeAddress || store.address || 'Address not available',
            location: store.storeLocation || store.location || { latitude: 0, longitude: 0 },
            ownerId: store.ownerId || 'unknown',
            createdAt: store.createdAt || Timestamp.now(),
            updatedAt: store.updatedAt || Timestamp.now()
          };

          const result: SearchResult = {
            ...item,
            store: storeData
          };

          if (userLocation && storeData.location?.latitude && storeData.location?.longitude) {
            result.distance = this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              storeData.location.latitude,
              storeData.location.longitude
            );
          }

          return result;
        })
        .filter((result: any): result is SearchResult => result !== null);

      return this.sortByLocation(results, userLocation);
    } catch (error) {
      console.error('Fallback search failed:', error);
      return [];
    }
  }

  private static cacheResults(query: string, results: SearchResult[]): void {
    try {
      const cacheData = {
        query: query.toLowerCase().trim(),
        results,
        timestamp: Date.now()
      };
      localStorage.setItem(this.SEARCH_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache search results:', error);
    }
  }

  private static getCachedResults(query: string): SearchResult[] | null {
    try {
      const cached = localStorage.getItem(this.SEARCH_CACHE_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const isExpired = Date.now() - cacheData.timestamp > this.CACHE_DURATION;
      const isDifferentQuery = cacheData.query !== query.toLowerCase().trim();

      if (isExpired || isDifferentQuery) {
        localStorage.removeItem(this.SEARCH_CACHE_KEY);
        return null;
      }

      return cacheData.results;
    } catch (error) {
      console.warn('Failed to get cached results:', error);
      return null;
    }
  }
}