import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchService } from '../../services/searchService';
import { ItemService, StoreService } from '../../services/firestoreService';

const createTimestamp = (isoDate: string) => ({
  seconds: Math.floor(new Date(isoDate).getTime() / 1000),
  nanoseconds: 0,
  toDate: () => new Date(isoDate),
  toMillis: () => new Date(isoDate).getTime(),
});

const itemFixtures = [
  {
    id: 'item-1',
    name: 'Lala Chips',
    category: 'Snacks',
    description: 'Crispy salted chips',
    storeId: 'store-1',
    imageUrl: 'https://example.com/item-1.jpg',
    verified: true,
    verifiedAt: createTimestamp('2026-04-09T10:00:00.000Z'),
    createdAt: createTimestamp('2026-04-01T10:00:00.000Z'),
    updatedAt: createTimestamp('2026-04-09T10:00:00.000Z'),
    reportCount: 0,
    lastConfirmedAt: null,
    weeklyGreenCount: 0,
    weeklyYellowCount: 0,
    recentRedCount24h: 0,
    statusOverride: null,
  },
  {
    id: 'item-2',
    name: 'Chocolate Bar',
    category: 'Lala Snacks',
    description: 'Sweet snack bar',
    storeId: 'store-1',
    imageUrl: 'https://example.com/item-2.jpg',
    verified: false,
    verifiedAt: createTimestamp('2026-04-07T10:00:00.000Z'),
    createdAt: createTimestamp('2026-04-01T10:00:00.000Z'),
    updatedAt: createTimestamp('2026-04-07T10:00:00.000Z'),
    reportCount: 1,
    lastConfirmedAt: null,
    weeklyGreenCount: 0,
    weeklyYellowCount: 0,
    recentRedCount24h: 0,
    statusOverride: null,
  },
  {
    id: 'item-3',
    name: 'Lalalal Item',
    category: 'Other',
    description: 'Unrelated',
    storeId: 'store-2',
    imageUrl: 'https://example.com/item-3.jpg',
    verified: true,
    verifiedAt: createTimestamp('2026-03-30T10:00:00.000Z'),
    createdAt: createTimestamp('2026-03-30T10:00:00.000Z'),
    updatedAt: createTimestamp('2026-03-30T10:00:00.000Z'),
    reportCount: 0,
    lastConfirmedAt: null,
    weeklyGreenCount: 0,
    weeklyYellowCount: 0,
    recentRedCount24h: 0,
    statusOverride: null,
  }
];

const storeFixtures = [
  {
    id: 'store-1',
    name: 'Main Store',
    address: '123 Main St',
    location: { latitude: 10, longitude: 20 },
    ownerId: 'owner-1',
    createdAt: createTimestamp('2026-04-01T10:00:00.000Z'),
    updatedAt: createTimestamp('2026-04-09T10:00:00.000Z'),
  },
  {
    id: 'store-2',
    name: 'Far Store',
    address: '999 Far St',
    location: { latitude: 11, longitude: 21 },
    ownerId: 'owner-2',
    createdAt: createTimestamp('2026-04-01T10:00:00.000Z'),
    updatedAt: createTimestamp('2026-04-09T10:00:00.000Z'),
  }
];

// Mock localStorage
const storageFactory = () => {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

const localStorageMock = storageFactory();
const sessionStorageMock = storageFactory();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock the Firestore services
vi.mock('../../services/firestoreService', () => ({
  ItemService: {
    getAll: vi.fn(() => Promise.resolve(itemFixtures)),
  },
  StoreService: {
    getAll: vi.fn(() => Promise.resolve(storeFixtures)),
  },
}));

vi.mock('../../services/analyticsService', () => ({
  trackSearch: vi.fn(() => Promise.resolve()),
}));

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchItems', () => {
    it('returns empty array for empty query', async () => {
      const results = await SearchService.searchItems('');
      expect(results).toEqual([]);
    });

    it('returns empty array for whitespace query', async () => {
      const results = await SearchService.searchItems('   ');
      expect(results).toEqual([]);
    });

    it('ranks exact and prefix matches ahead of weaker matches', async () => {
      const results = await SearchService.searchItems('lala');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Lala Chips');
      expect(results[0].store.id).toBe('store-1');
      expect(results.map(result => result.name)).toContain('Chocolate Bar');
    });

    it('reuses cached collection and result data on repeated searches', async () => {
      const firstResults = await SearchService.searchItems('lala');
      const secondResults = await SearchService.searchItems('lala');

      expect(secondResults.map(result => result.name)).toEqual(firstResults.map(result => result.name));
      expect(secondResults.map(result => result.store.id)).toEqual(firstResults.map(result => result.store.id));
      expect(ItemService.getAll).toHaveBeenCalledTimes(1);
      expect(StoreService.getAll).toHaveBeenCalledTimes(1);
      expect(sessionStorageMock.setItem).toHaveBeenCalled();
    });
  });
});