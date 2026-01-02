import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchService } from '../../services/searchService';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock the Firestore services
vi.mock('../../services/firestoreService', () => ({
  ItemService: {
    search: vi.fn(() => Promise.resolve([])),
  },
  StoreService: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
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
  });
});