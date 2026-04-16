import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

const SEARCH_DEDUPE_MS = 10 * 60 * 1000;
const DEVICE_ID_KEY = 'finditfast_device_id';
const SEARCH_WINDOW_KEY = 'finditfast_search_window_v1';

export interface SearchLog {
  userId?: string;
  storeId?: string;
  storeName?: string;
  searchQuery: string;
  resultsCount: number;
  timestamp: Date;
  userAgent?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  deviceId?: string;
  source?: 'search' | 'product_click' | 'confirmation';
}

export interface UserActivityLog {
  userId: string;
  action: 'login' | 'logout' | 'search' | 'view_store' | 'request_store' | 'upload_floorplan' | 'add_item';
  metadata?: any;
  timestamp: Date;
  userAgent?: string;
}

const normalizeSearchQuery = (searchQuery: string): string => {
  return searchQuery
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && !!window.localStorage;
};

const getDeviceId = (): string => {
  if (!canUseStorage()) {
    return 'unknown-device';
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
};

const getSearchWindowMap = (): Record<string, number> => {
  if (!canUseStorage()) {
    return {};
  }

  const raw = window.localStorage.getItem(SEARCH_WINDOW_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
};

const setSearchWindowMap = (value: Record<string, number>): void => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SEARCH_WINDOW_KEY, JSON.stringify(value));
};

const shouldLogSearch = (normalizedQuery: string, deviceId: string, dedupeWindowMs: number): boolean => {
  const searchWindowMap = getSearchWindowMap();
  const key = `${deviceId}:${normalizedQuery}`;
  const lastTimestamp = searchWindowMap[key] || 0;
  const now = Date.now();

  if (now - lastTimestamp < dedupeWindowMs) {
    return false;
  }

  searchWindowMap[key] = now;

  // Keep map from growing unbounded by pruning old entries.
  Object.keys(searchWindowMap).forEach((entryKey) => {
    if (now - searchWindowMap[entryKey] > 7 * 24 * 60 * 60 * 1000) {
      delete searchWindowMap[entryKey];
    }
  });

  setSearchWindowMap(searchWindowMap);
  return true;
};

const compactObject = <T extends Record<string, any>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
};

export const analyticsService = {
  // Log search activity
  logSearch: async (
    searchData: Omit<SearchLog, 'timestamp' | 'deviceId'>,
    options?: { dedupeWindowMs?: number; source?: 'search' | 'product_click' | 'confirmation' }
  ): Promise<{ logged: boolean }> => {
    try {
      const normalizedQuery = normalizeSearchQuery(searchData.searchQuery);
      if (!normalizedQuery) {
        return { logged: false };
      }

      const dedupeWindowMs = options?.dedupeWindowMs ?? SEARCH_DEDUPE_MS;
      const deviceId = getDeviceId();
      const source = options?.source || 'search';
      const shouldLog = shouldLogSearch(`${source}:${normalizedQuery}`, deviceId, dedupeWindowMs);

      if (!shouldLog) {
        return { logged: false };
      }

      const payload = compactObject({
        ...searchData,
        searchQuery: normalizedQuery,
        timestamp: new Date(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        deviceId,
        source
      });

      if (payload.location && typeof payload.location === 'object') {
        const compactedLocation = compactObject(payload.location as { latitude?: number; longitude?: number });
        if (compactedLocation.latitude !== undefined && compactedLocation.longitude !== undefined) {
          payload.location = compactedLocation as { latitude: number; longitude: number };
        } else {
          delete payload.location;
        }
      }

      await addDoc(collection(db, 'searchLogs'), payload);

      return { logged: true };
    } catch (error) {
      console.error('Error logging search:', error);
      return { logged: false };
    }
  },

  // Log user activity
  logUserActivity: async (activityData: Omit<UserActivityLog, 'timestamp'>) => {
    try {
      await addDoc(collection(db, 'userActivity'), {
        ...activityData,
        timestamp: new Date(),
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  },

  // Get search analytics
  getSearchAnalytics: async (storeId?: string, days = 30) => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let searchQuery = query(
        collection(db, 'searchLogs'),
        where('timestamp', '>=', startDate),
        orderBy('timestamp', 'desc')
      );

      if (storeId) {
        searchQuery = query(
          collection(db, 'searchLogs'),
          where('storeId', '==', storeId),
          where('timestamp', '>=', startDate),
          orderBy('timestamp', 'desc')
        );
      }

      const snapshot = await getDocs(searchQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      })) as (SearchLog & { id: string })[];
    } catch (error) {
      console.error('Error getting search analytics:', error);
      return [];
    }
  },

  // Get user activity analytics
  getUserActivityAnalytics: async (userId?: string, days = 30) => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let activityQuery = query(
        collection(db, 'userActivity'),
        where('timestamp', '>=', startDate),
        orderBy('timestamp', 'desc')
      );

      if (userId) {
        activityQuery = query(
          collection(db, 'userActivity'),
          where('userId', '==', userId),
          where('timestamp', '>=', startDate),
          orderBy('timestamp', 'desc')
        );
      }

      const snapshot = await getDocs(activityQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      })) as (UserActivityLog & { id: string })[];
    } catch (error) {
      console.error('Error getting user activity:', error);
      return [];
    }
  },

  // Get popular search terms
  getPopularSearchTerms: async (limit_count = 20) => {
    try {
      const searchQuery = query(
        collection(db, 'searchLogs'),
        orderBy('timestamp', 'desc'),
        limit(1000) // Get recent searches to analyze
      );

      const snapshot = await getDocs(searchQuery);
      const searches = snapshot.docs.map(doc => doc.data().searchQuery);
      
      // Count frequency of search terms
      const termCounts: { [key: string]: number } = {};
      searches.forEach((query: string) => {
        const terms = query.toLowerCase().split(/\s+/);
        terms.forEach((term: string) => {
          if (term.length > 2) { // Only count terms longer than 2 characters
            termCounts[term] = (termCounts[term] || 0) + 1;
          }
        });
      });

      return Object.entries(termCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit_count)
        .map(([term, count]) => ({ term, count }));
    } catch (error) {
      console.error('Error getting popular search terms:', error);
      return [];
    }
  },

  // Get store performance metrics
  getStorePerformance: async (storeId: string) => {
    try {
      const searches = await analyticsService.getSearchAnalytics(storeId);
      const activities = await analyticsService.getUserActivityAnalytics();
      
      const storeActivities = activities.filter(activity => 
        activity.metadata?.storeId === storeId || 
        activity.metadata?.storeName === storeId
      );

      return {
        totalSearches: searches.length,
        uniqueSearchers: new Set(searches.map(s => s.userId).filter(Boolean)).size,
        avgResultsPerSearch: searches.length > 0 
          ? searches.reduce((sum, s) => sum + (s.resultsCount || 0), 0) / searches.length 
          : 0,
        totalViews: storeActivities.filter(a => a.action === 'view_store').length,
        popularSearchTerms: searches.reduce((terms: { [key: string]: number }, search) => {
          const term = search.searchQuery.toLowerCase();
          terms[term] = (terms[term] || 0) + 1;
          return terms;
        }, {})
      };
    } catch (error) {
      console.error('Error getting store performance:', error);
      return null;
    }
  }
};

// Helper function to track page views
export const trackPageView = (userId: string, page: string, metadata?: any) => {
  analyticsService.logUserActivity({
    userId,
    action: 'view_store', // You can extend this for different page types
    metadata: {
      page,
      ...metadata
    }
  });
};

// Helper function to track searches
export const trackSearch = (
  searchData: {
    userId?: string;
    storeId?: string;
    storeName?: string;
    searchQuery: string;
    resultsCount: number;
    location?: { latitude: number; longitude: number };
  },
  options?: { dedupeWindowMs?: number; source?: 'search' | 'product_click' | 'confirmation' }
) => {
  return analyticsService.logSearch(searchData, options);
};

export default analyticsService;
