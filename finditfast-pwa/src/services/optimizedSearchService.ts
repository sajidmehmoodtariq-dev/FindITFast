/**
 * Enhanced search service with performance optimizations
 */

import { firestoreService } from './firestoreService';
import { GeolocationService } from './geolocationService';
import { MemoCache, RequestDeduplicator } from '../utilities/performanceUtils';
import type { SearchResult } from '../types/search';
import type { LocationCoordinates } from './geolocationService';

class OptimizedSearchService {
  private cache = new MemoCache<[string, LocationCoordinates?], SearchResult[]>(5 * 60 * 1000, 50); // 5 minutes cache
  private deduplicator = new RequestDeduplicator();

  /**
   * Enhanced search with caching and request deduplication
   */
  async searchItems(query: string, userLocation?: LocationCoordinates): Promise<SearchResult[]> {
    const cacheKey: [string, LocationCoordinates?] = [query.toLowerCase().trim(), userLocation];
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests
    const dedupeKey = `search-${query}-${userLocation?.latitude || 0}-${userLocation?.longitude || 0}`;
    
    return this.deduplicator.dedupe(dedupeKey, async () => {
      const results = await this.performSearch(query, userLocation);
      this.cache.set(cacheKey, results);
      return results;
    });
  }

  private async performSearch(query: string, userLocation?: LocationCoordinates): Promise<SearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Get items from Firestore
      const items = await firestoreService.searchItems(query.toLowerCase());
      
      // Convert to search results with store information
      const results: SearchResult[] = [];
      
      for (const item of items) {
        try {
          const store = await firestoreService.getStore(item.storeId);
          if (!store) continue;

          // Calculate distance if user location is available
          let distance: number | undefined;
          if (userLocation && store.location) {
            distance = GeolocationService.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              store.location.latitude,
              store.location.longitude
            );
          }

          results.push({
            id: item.id,
            name: item.name,
            price: item.price,
            verified: item.verified || false,
            verifiedAt: item.verifiedAt,
            reportCount: item.reportCount || 0,
            imageUrl: item.imageUrl,
            storeId: item.storeId,
            position: item.position,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastConfirmedAt: item.lastConfirmedAt ?? null,
            weeklyGreenCount: item.weeklyGreenCount ?? 0,
            weeklyYellowCount: item.weeklyYellowCount ?? 0,
            recentRedCount24h: item.recentRedCount24h ?? 0,
            statusOverride: item.statusOverride ?? null,
            distance,
            store
          });
        } catch (error) {
          console.warn(`Failed to process item ${item.id}:`, error);
          continue;
        }
      }

      // Sort results by relevance and distance
      return this.sortSearchResults(results, query);
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Search failed. Please try again.');
    }
  }

  private sortSearchResults(results: SearchResult[], query: string): SearchResult[] {
    return results.sort((a, b) => {
      // Prioritize verified items
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;

      // Prioritize exact matches
      const aExactMatch = a.name.toLowerCase() === query.toLowerCase();
      const bExactMatch = b.name.toLowerCase() === query.toLowerCase();
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // Prioritize items that start with the query
      const aStartsWith = a.name.toLowerCase().startsWith(query.toLowerCase());
      const bStartsWith = b.name.toLowerCase().startsWith(query.toLowerCase());
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Sort by distance if available
      if (a.distance && b.distance) {
        return a.distance - b.distance;
      }
      if (a.distance && !b.distance) return -1;
      if (!a.distance && b.distance) return 1;

      // Finally, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Preload popular searches for better perceived performance
   */
  async preloadPopularSearches(): Promise<void> {
    const popularQueries = ['milk', 'bread', 'eggs', 'water', 'coffee'];
    
    // Preload in background without user location
    popularQueries.forEach(query => {
      setTimeout(() => {
        this.searchItems(query).catch(() => {
          // Ignore preload errors
        });
      }, Math.random() * 2000); // Stagger requests
    });
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
    this.deduplicator.clear();
  }

  /**
   * Get cached search suggestions based on previous searches
   */
  getSearchSuggestions(partialQuery: string): string[] {
    // This could be enhanced with a more sophisticated suggestion system
    const commonSearches = [
      'milk', 'bread', 'eggs', 'water', 'coffee', 'cheese', 'butter',
      'yogurt', 'cereal', 'juice', 'bananas', 'apples', 'chicken',
      'rice', 'pasta', 'tomatoes', 'onions', 'potatoes'
    ];

    return commonSearches
      .filter(search => search.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, 5);
  }
}

export const optimizedSearchService = new OptimizedSearchService();
