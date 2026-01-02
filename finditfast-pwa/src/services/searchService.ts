import { ItemService, StoreService } from './firestoreService';
// import { trackSearch } from './analyticsService';
// Import types are used in JSDoc comments and type annotations
import type { SearchResult } from '../types/search';

export class SearchService {

  /**
   * Search for items across all stores
   */
  static async searchItems(query: string, userLocation?: { latitude: number; longitude: number }): Promise<SearchResult[]> {
    console.log('🔍 [SEARCH SERVICE DEBUG] Starting search for:', query);
    
    if (!query.trim()) {
      console.log('❌ [SEARCH SERVICE DEBUG] Empty query, returning empty results');
      return [];
    }

    try {
      // Search for items using the existing search method
      console.log('📋 [SEARCH SERVICE DEBUG] Calling ItemService.search...');
      const items = await ItemService.search(query.toLowerCase());
      console.log('📋 [SEARCH SERVICE DEBUG] Items found by ItemService:', items.length);
      
      // Get all approved stores from storeRequests and transform to Store format
      console.log('🏪 [SEARCH SERVICE DEBUG] Getting approved stores...');
      const storeRequests = await StoreService.getAll();
      console.log('🏪 [SEARCH SERVICE DEBUG] Store requests found:', storeRequests.length);
      
      // Transform storeRequests to Store format and create lookup map
      const storeMap = new Map();
      storeRequests.forEach((storeRequest: any) => {
        const store = {
          id: storeRequest.id,
          name: storeRequest.storeName || storeRequest.name || 'Store',
          address: storeRequest.storeAddress || storeRequest.address || 'Address not available',
          location: storeRequest.storeLocation || storeRequest.location || { latitude: 0, longitude: 0 },
          ownerId: storeRequest.ownerId || 'unknown',
          createdAt: storeRequest.createdAt,
          updatedAt: storeRequest.updatedAt
        };
        storeMap.set(storeRequest.id, store);
      });
      
      console.log('🗺️ [SEARCH SERVICE DEBUG] Store map created with', storeMap.size, 'stores');

      // Combine items with their store information
      const searchResults: SearchResult[] = items
        .map(item => {
          // Handle virtual store IDs by removing the virtual_ prefix
          let storeId = item.storeId;
          if (storeId && storeId.startsWith('virtual_')) {
            storeId = storeId.replace('virtual_', '');
          }
          
          const store = storeMap.get(storeId);
          if (!store) {
            console.log('⚠️ [SEARCH SERVICE DEBUG] No store found for item:', {
              itemName: item.name,
              originalStoreId: item.storeId,
              cleanedStoreId: storeId,
              availableStoreIds: Array.from(storeMap.keys()).slice(0, 5)
            });
            return null;
          }

          console.log('✅ [SEARCH SERVICE DEBUG] Item matched with store:', {
            itemName: item.name,
            storeName: store.name,
            storeId: storeId
          });

          let distance;
          if (userLocation) {
            distance = this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              store.location.latitude,
              store.location.longitude
            );
          }
          
          const result: SearchResult = {
            ...item,
            store,
            distance
          };

          return result;
        })
        .filter((result): result is SearchResult => result !== null);
      
      console.log('🎯 [SEARCH SERVICE DEBUG] Final search results:', searchResults.length);

      // Rank and sort results
      const rankedResults = this.rankSearchResults(searchResults);
      console.log('📊 [SEARCH SERVICE DEBUG] Ranked results:', rankedResults.length);

      // Track search analytics
      try {
        // Temporarily disable analytics to debug search
        // trackSearch({
        //   searchQuery: query,
        //   resultsCount: rankedResults.length,
        //   location: userLocation
        // });
      } catch (error) {
        console.log('Analytics tracking failed:', error);
      }

      return rankedResults;
    } catch (error) {
      console.error('❌ [SEARCH SERVICE DEBUG] Search error:', error);
      throw new Error('Failed to search items. Please try again.');
    }
  }

  /**
   * Rank search results by relevance
   * Priority: Distance first (if location available), then verified items, then other factors
   */
  private static rankSearchResults(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => {
      // FIRST PRIORITY: Distance (if available) - nearest items first
      if (a.distance !== undefined && b.distance !== undefined) {
        const distanceDiff = a.distance - b.distance;
        if (Math.abs(distanceDiff) > 0.001) { // Only sort by distance if difference is significant
          return distanceDiff;
        }
      }

      // If one has distance and other doesn't, prioritize the one with distance
      if (a.distance !== undefined && b.distance === undefined) return -1;
      if (a.distance === undefined && b.distance !== undefined) return 1;

      // SECOND PRIORITY: verified items
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;

      // THIRD PRIORITY: fewer reports (more reliable)
      if (a.reportCount !== b.reportCount) {
        return a.reportCount - b.reportCount;
      }

      // FOURTH PRIORITY: more recent verification
      if (a.verified && b.verified) {
        const aTime = a.verifiedAt?.toDate?.()?.getTime() || 0;
        const bTime = b.verifiedAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime; // More recent first
      }

      // FINALLY: alphabetical by item name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Calculate distance between two points using Vincenty's formulae for maximum accuracy
   * Accurate to within millimeters for distances up to 20,000 km
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // WGS-84 ellipsoid parameters
    const a = 6378137; // Semi-major axis in meters
    const b = 6356752.314245; // Semi-minor axis in meters
    const f = 1 / 298.257223563; // Flattening

    const L = this.toRadians(lon2 - lon1);
    const U1 = Math.atan((1 - f) * Math.tan(this.toRadians(lat1)));
    const U2 = Math.atan((1 - f) * Math.tan(this.toRadians(lat2)));
    
    const sinU1 = Math.sin(U1);
    const cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2);
    const cosU2 = Math.cos(U2);
    
    let lambda = L;
    let lambdaP = 2 * Math.PI;
    let iterLimit = 100;
    let cosSqAlpha = 0;
    let sinSigma = 0;
    let cos2SigmaM = 0;
    let cosSigma = 0;
    let sigma = 0;
    
    while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
      const sinLambda = Math.sin(lambda);
      const cosLambda = Math.cos(lambda);
      
      sinSigma = Math.sqrt(
        (cosU2 * sinLambda) * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
      );
      
      if (sinSigma === 0) return 0; // Co-incident points
      
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
      sigma = Math.atan2(sinSigma, cosSigma);
      
      const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      
      cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
      if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // Equatorial line
      
      const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      
      lambdaP = lambda;
      lambda = L + (1 - C) * f * sinAlpha * (
        sigma + C * sinSigma * (
          cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)
        )
      );
    }
    
    if (iterLimit === 0) {
      // Fallback to Haversine if Vincenty fails to converge
      return this.haversineDistance(lat1, lon1, lat2, lon2);
    }
    
    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    
    const deltaSigma = B * sinSigma * (
      cos2SigmaM + B / 4 * (
        cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)
      )
    );
    
    const distance = b * A * (sigma - deltaSigma);
    
    // Convert from meters to kilometers and round to 3 decimal places for maximum precision
    return Math.round((distance / 1000) * 1000) / 1000;
  }

  /**
   * Fallback Haversine formula for cases where Vincenty fails to converge
   */
  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get user's current location
   */
  static async getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Error getting location:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }









  /**
   * Search with enhanced filtering and location awareness
   */
  static async searchWithFilters(
    query: string,
    options: {
      verifiedOnly?: boolean;
      maxDistance?: number;
      userLocation?: { latitude: number; longitude: number };
    } = {}
  ): Promise<SearchResult[]> {
    const { verifiedOnly = false, maxDistance, userLocation } = options;

    // Get base search results
    const results = await this.searchItems(query, userLocation);

    // Apply filters
    let filteredResults = results;

    if (verifiedOnly) {
      filteredResults = filteredResults.filter(result => result.verified);
    }

    if (maxDistance && userLocation) {
      filteredResults = filteredResults.filter(result => 
        result.distance === undefined || result.distance <= maxDistance
      );
    }

    return filteredResults;
  }
}