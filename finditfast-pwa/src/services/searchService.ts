import { ItemService, StoreService } from './firestoreService';
import { trackSearch } from './analyticsService';
// Import types are used in JSDoc comments and type annotations
import type { SearchResult } from '../types/search';
import type { Item, Store } from '../types';

type RankedSearchResult = SearchResult & {
  relevanceScore: number;
};

type CacheEntry<T> = {
  version: number;
  timestamp: number;
  data: T;
};

type TimestampLike = {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
  toMillis: () => number;
};

export class SearchService {
  private static readonly CACHE_VERSION = 1;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly RESULT_CACHE_TTL_MS = 2 * 60 * 1000;
  private static readonly MAX_RESULTS = 20;

  private static readonly ITEMS_CACHE_KEY = 'finditfast_search_items_v1';
  private static readonly STORES_CACHE_KEY = 'finditfast_search_stores_v1';
  private static readonly RESULT_CACHE_KEY = 'finditfast_search_results_v1';

  private static readonly storagePriority: Array<'sessionStorage' | 'localStorage'> = [
    'sessionStorage',
    'localStorage'
  ];

  /**
   * Search for items across all stores
   */
  static async searchItems(query: string, userLocation?: { latitude: number; longitude: number }): Promise<SearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query);

    if (!normalizedQuery) {
      return [];
    }

    try {
      const locationKey = this.getLocationKey(userLocation);
      const resultCacheKey = `${this.RESULT_CACHE_KEY}:${normalizedQuery}:${locationKey}`;
      const cachedResults = this.getCachedValue<SearchResult[]>(resultCacheKey, this.RESULT_CACHE_TTL_MS);

      if (cachedResults) {
        this.trackSearchSafely(query, cachedResults.length, userLocation);
        return cachedResults;
      }

      const [items, stores] = await Promise.all([
        this.getCachedCollection<Item>(this.ITEMS_CACHE_KEY, () => ItemService.getAll()),
        this.getCachedCollection<Store>(this.STORES_CACHE_KEY, () => StoreService.getAll())
      ]);

      const searchTerms = this.tokenizeQuery(normalizedQuery);
      const storeMap = new Map<string, Store>();

      stores.forEach((store) => {
        storeMap.set(this.normalizeStoreId(store.id), store);
      });

      const rankedResults: RankedSearchResult[] = [];

      for (const item of items) {
        if (item.deleted) {
          continue;
        }

        const store = storeMap.get(this.normalizeStoreId(item.storeId));
        if (!store) {
          continue;
        }

        const relevanceScore = this.calculateRelevanceScore(item, normalizedQuery, searchTerms);
        if (relevanceScore <= 0) {
          continue;
        }

        const distance = userLocation && this.hasValidCoordinates(store.location)
          ? this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              store.location.latitude,
              store.location.longitude
            )
          : undefined;

        rankedResults.push({
          ...item,
          store,
          ...(distance !== undefined ? { distance } : {}),
          relevanceScore
        });
      }

      const sortedResults = this.rankSearchResults(rankedResults);
      const finalResults = sortedResults.slice(0, this.MAX_RESULTS).map(({ relevanceScore, ...result }) => result);

      this.setCachedValue(resultCacheKey, finalResults);
      this.trackSearchSafely(query, finalResults.length, userLocation);

      return finalResults;
    } catch (error) {
      console.error('❌ [SEARCH SERVICE DEBUG] Search error:', error);
      throw new Error('Failed to search items. Please try again.');
    }
  }

  /**
   * Rank search results by relevance
   * Priority: Distance first (if location available), then relevance score, then other factors
   */
  private static rankSearchResults(results: RankedSearchResult[]): RankedSearchResult[] {
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

      // SECOND PRIORITY: relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      // THIRD PRIORITY: verified items
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;

      // FOURTH PRIORITY: fewer reports (more reliable)
      if (a.reportCount !== b.reportCount) {
        return a.reportCount - b.reportCount;
      }

      // FIFTH PRIORITY: more recent verification
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

  private static normalizeQuery(query: string): string {
    return this.normalizeText(query);
  }

  private static normalizeText(value: string | undefined | null): string {
    if (!value) {
      return '';
    }

    return value
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static tokenizeQuery(query: string): string[] {
    return query.split(' ').map(term => term.trim()).filter(Boolean);
  }

  private static normalizeStoreId(storeId?: string): string {
    if (!storeId) {
      return '';
    }

    return storeId.replace(/^(temp_|virtual_)/, '');
  }

  private static hasValidCoordinates(location?: { latitude: number; longitude: number }): boolean {
    return !!location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  }

  private static calculateRelevanceScore(item: Item, normalizedQuery: string, searchTerms: string[]): number {
    const name = this.normalizeText(item.name);
    const category = this.normalizeText(item.category);
    const description = this.normalizeText(item.description);
    const combined = [name, category, description].filter(Boolean).join(' ');

    if (!combined) {
      return 0;
    }

    let score = 0;

    if (name === normalizedQuery) {
      score += 5000;
    }

    if (name.startsWith(normalizedQuery)) {
      score += 2500;
    }

    if (combined.includes(normalizedQuery)) {
      score += 900;
    }

    const matchedTerms = searchTerms.filter(term => combined.includes(term));
    if (matchedTerms.length > 0) {
      score += matchedTerms.length * 250;
      score += Math.round((matchedTerms.length / searchTerms.length) * 300);
    }

    if (category.includes(normalizedQuery)) {
      score += 180;
    }

    if (description.includes(normalizedQuery)) {
      score += 90;
    }

    if (item.verified) {
      score += 150;
    }

    if (typeof item.reportCount === 'number') {
      score += Math.max(0, 100 - item.reportCount * 15);
    }

    const verifiedMillis = this.getTimestampMillis(item.verifiedAt);
    if (verifiedMillis) {
      const daysSinceVerification = Math.max(0, (Date.now() - verifiedMillis) / 86400000);
      score += Math.max(0, 75 - Math.floor(daysSinceVerification));
    }

    return score;
  }

  private static getTimestampMillis(value: unknown): number | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };

    if (typeof candidate.toMillis === 'function') {
      return candidate.toMillis();
    }

    if (typeof candidate.toDate === 'function') {
      return candidate.toDate().getTime();
    }

    if (typeof candidate.seconds === 'number') {
      return candidate.seconds * 1000 + Math.floor((candidate.nanoseconds || 0) / 1_000_000);
    }

    return null;
  }

  private static getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    for (const storageName of this.storagePriority) {
      try {
        const storage = window[storageName];
        const testKey = '__finditfast_storage_test__';
        storage.setItem(testKey, '1');
        storage.removeItem(testKey);
        return storage;
      } catch {
        continue;
      }
    }

    return null;
  }

  private static getCachedValue<T>(key: string, ttlMs: number): T | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    try {
      const rawValue = storage.getItem(key);
      if (!rawValue) {
        return null;
      }

      const cached = this.deserialize<CacheEntry<T>>(rawValue);
      if (!cached || cached.version !== this.CACHE_VERSION) {
        storage.removeItem(key);
        return null;
      }

      if (Date.now() - cached.timestamp > ttlMs) {
        storage.removeItem(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.warn('Failed to read search cache:', error);
      return null;
    }
  }

  private static setCachedValue<T>(key: string, data: T): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      const cacheEntry: CacheEntry<T> = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data
      };

      storage.setItem(key, this.serialize(cacheEntry));
    } catch (error) {
      console.warn('Failed to write search cache:', error);
    }
  }

  private static async getCachedCollection<T>(key: string, fetcher: () => Promise<T[]>): Promise<T[]> {
    const cached = this.getCachedValue<T[]>(key, this.CACHE_TTL_MS);
    if (cached) {
      return cached;
    }

    const data = await fetcher();
    this.setCachedValue(key, data);
    return data;
  }

  private static trackSearchSafely(query: string, resultsCount: number, userLocation?: { latitude: number; longitude: number }): void {
    const trackPromise = Promise.resolve(trackSearch({
      searchQuery: query,
      resultsCount,
      location: userLocation
    }));

    trackPromise.catch((error: unknown) => {
      console.log('Analytics tracking failed:', error);
    });
  }

  private static getLocationKey(userLocation?: { latitude: number; longitude: number }): string {
    if (!userLocation) {
      return 'noloc';
    }

    return `${userLocation.latitude.toFixed(3)}_${userLocation.longitude.toFixed(3)}`;
  }

  private static serialize<T>(value: T): string {
    return JSON.stringify(value, (_key, currentValue) => {
      if (this.isTimestampLike(currentValue)) {
        return {
          __cacheType: 'timestamp',
          seconds: currentValue.seconds,
          nanoseconds: currentValue.nanoseconds
        };
      }

      if (currentValue instanceof Date) {
        return {
          __cacheType: 'date',
          value: currentValue.toISOString()
        };
      }

      return currentValue;
    });
  }

  private static deserialize<T>(value: string): T {
    return JSON.parse(value, (_key, currentValue) => {
      if (currentValue && typeof currentValue === 'object' && currentValue.__cacheType === 'timestamp') {
        return this.createTimestampLike(currentValue.seconds, currentValue.nanoseconds);
      }

      if (currentValue && typeof currentValue === 'object' && currentValue.__cacheType === 'date') {
        return new Date(currentValue.value);
      }

      return currentValue;
    }) as T;
  }

  private static isTimestampLike(value: unknown): value is { seconds: number; nanoseconds: number } {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as {
      seconds?: unknown;
      nanoseconds?: unknown;
      toDate?: unknown;
      toMillis?: unknown;
    };

    return (
      typeof candidate.seconds === 'number' &&
      typeof candidate.nanoseconds === 'number' &&
      typeof candidate.toDate !== 'function' &&
      typeof candidate.toMillis !== 'function'
    );
  }

  private static createTimestampLike(seconds: number, nanoseconds: number): TimestampLike {
    return {
      seconds,
      nanoseconds,
      toDate: () => new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000)),
      toMillis: () => seconds * 1000 + Math.floor(nanoseconds / 1_000_000)
    };
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