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
    const q = query.toLowerCase().trim();

    // Minimum relevance threshold - results scoring below this will be hidden
    const MIN_RELEVANCE = 25; // tuned: exact matches score >> threshold

    const scoreFor = (r: SearchResult): number => {
      let score = 0;
      const name = (r.name || '').toLowerCase();
      const category = (r.category || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();

      // Exact match (highest weight)
      if (name === q) score += 100;

      // Starts with (high)
      if (name.startsWith(q)) score += 60;

      // Partial contains in name (medium)
      if (name.includes(q) && !name.startsWith(q) && name !== q) score += 35;

      // Category match (lower)
      if (category && category.includes(q)) score += 20;

      // Description / OCR match (very low)
      if (desc && desc.includes(q)) score += 8;

      // Token matches: each token match in name adds small bonus
      const tokens = q.split(/\s+/).filter(Boolean);
      for (const t of tokens) {
        if (t.length <= 1) continue;
        if (name.split(/[^a-z0-9]+/).includes(t)) score += 6;
      }

      // Penalize items with many reports slightly
      score -= Math.min((r.reportCount || 0) * 2, 20);

      // Boost nearby items a little
      if (r.distance !== undefined && r.distance < 1) score += 5;

      return score;
    };

    // Attach computed score and filter by threshold
    const scored = results.map(r => ({ r, score: scoreFor(r) }))
      .filter(s => s.score >= MIN_RELEVANCE);

    // Sort by score desc, then distance asc, then verified then name
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // Prefer closer stores
      if (a.r.distance !== undefined && b.r.distance !== undefined) {
        if (a.r.distance !== b.r.distance) return a.r.distance - b.r.distance;
      } else if (a.r.distance !== undefined) {
        return -1;
      } else if (b.r.distance !== undefined) {
        return 1;
      }

      // Prefer verified items
      if (a.r.verified && !b.r.verified) return -1;
      if (!a.r.verified && b.r.verified) return 1;

      // Fallback alphabetical
      return a.r.name.localeCompare(b.r.name);
    });

    return scored.map(s => s.r);
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
