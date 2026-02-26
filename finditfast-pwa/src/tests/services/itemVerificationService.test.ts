import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ItemVerificationService } from '../../services/itemVerificationService';
import { ItemService } from '../../services/firestoreService';
import type { Item } from '../../types';

// Mock ItemService
vi.mock('../../services/firestoreService', () => ({
  ItemService: {
    getById: vi.fn(),
    getByStore: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const mockItemService = vi.mocked(ItemService);

// Mock item data
const mockItem: Item = {
  id: 'test-item-id',
  name: 'test item',
  storeId: 'test-store-id',
  imageUrl: 'https://example.com/item.jpg',
  position: { x: 25, y: 30 },
  price: '4.99',
  verified: true,
  verifiedAt: new Date('2024-01-01') as any,
  createdAt: new Date('2024-01-01') as any,
  updatedAt: new Date('2024-01-01') as any,
  reportCount: 0,
  lastConfirmedAt: null,
  weeklyGreenCount: 0,
  weeklyYellowCount: 0,
  recentRedCount24h: 0,
  statusOverride: null,
};

describe('ItemVerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('verifyItem', () => {
    it('should mark an item as verified with current timestamp', async () => {
      await ItemVerificationService.verifyItem('test-item-id');

      expect(mockItemService.update).toHaveBeenCalledWith('test-item-id', {
        verified: true,
        verifiedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      });
    });
  });

  describe('unverifyItem', () => {
    it('should mark an item as unverified', async () => {
      await ItemVerificationService.unverifyItem('test-item-id');

      expect(mockItemService.update).toHaveBeenCalledWith('test-item-id', {
        verified: false,
        updatedAt: new Date('2024-01-15'),
      });
    });
  });

  describe('createVerifiedItem', () => {
    it('should create an item with automatic verification', async () => {
      const itemData = {
        name: 'new item',
        storeId: 'test-store-id',
        imageUrl: 'https://example.com/new-item.jpg',
        position: { x: 50, y: 60 },
        reportCount: 0,
        lastConfirmedAt: null,
        weeklyGreenCount: 0,
        weeklyYellowCount: 0,
        recentRedCount24h: 0,
        statusOverride: null,
      };

      mockItemService.create.mockResolvedValue('new-item-id');

      const result = await ItemVerificationService.createVerifiedItem(itemData);

      expect(mockItemService.create).toHaveBeenCalledWith({
        ...itemData,
        verified: true,
        verifiedAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      });
      expect(result).toBe('new-item-id');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return verification data for existing item', async () => {
      mockItemService.getById.mockResolvedValue(mockItem);

      const result = await ItemVerificationService.getVerificationStatus('test-item-id');

      expect(result).toEqual({
        verified: true,
        verifiedAt: mockItem.verifiedAt,
        updatedAt: mockItem.updatedAt,
      });
    });

    it('should return null for non-existent item', async () => {
      mockItemService.getById.mockResolvedValue(null);

      const result = await ItemVerificationService.getVerificationStatus('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('shouldRequireReVerification', () => {
    it('should return true for verified items with high report count', () => {
      const itemWithReports = { ...mockItem, reportCount: 5 };
      
      const result = ItemVerificationService.shouldRequireReVerification(itemWithReports, 3);
      
      expect(result).toBe(true);
    });

    it('should return false for verified items with low report count', () => {
      const itemWithFewReports = { ...mockItem, reportCount: 1 };
      
      const result = ItemVerificationService.shouldRequireReVerification(itemWithFewReports, 3);
      
      expect(result).toBe(false);
    });

    it('should return false for unverified items regardless of report count', () => {
      const unverifiedItem = { ...mockItem, verified: false, reportCount: 5 };
      
      const result = ItemVerificationService.shouldRequireReVerification(unverifiedItem, 3);
      
      expect(result).toBe(false);
    });
  });

  describe('getItemsNeedingReview', () => {
    it('should return items that need re-verification', async () => {
      const items = [
        { ...mockItem, id: 'item-1', reportCount: 5 }, // Needs review
        { ...mockItem, id: 'item-2', reportCount: 1 }, // OK
        { ...mockItem, id: 'item-3', verified: false, reportCount: 5 }, // Unverified
      ];

      mockItemService.getByStore.mockResolvedValue(items);

      const result = await ItemVerificationService.getItemsNeedingReview('test-store-id', 3);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
    });
  });

  describe('getVerificationStats', () => {
    it('should return correct verification statistics', async () => {
      const items = [
        { ...mockItem, id: 'item-1', verified: true, reportCount: 1 },
        { ...mockItem, id: 'item-2', verified: true, reportCount: 5 }, // Needs review
        { ...mockItem, id: 'item-3', verified: false, reportCount: 0 },
        { ...mockItem, id: 'item-4', verified: true, reportCount: 0 },
      ];

      mockItemService.getByStore.mockResolvedValue(items);

      const result = await ItemVerificationService.getVerificationStats('test-store-id');

      expect(result).toEqual({
        total: 4,
        verified: 3,
        unverified: 1,
        needsReview: 1,
      });
    });
  });

  describe('isVerificationExpired', () => {
    it('should return true for expired verification', () => {
      // Item verified 45 days ago
      const expiredItem = {
        ...mockItem,
        verifiedAt: { toDate: () => new Date('2023-12-01') } as any,
      };

      const result = ItemVerificationService.isVerificationExpired(expiredItem, 30);

      expect(result).toBe(true);
    });

    it('should return false for recent verification', () => {
      // Item verified 15 days ago
      const recentItem = {
        ...mockItem,
        verifiedAt: { toDate: () => new Date('2023-12-31') } as any,
      };

      const result = ItemVerificationService.isVerificationExpired(recentItem, 30);

      expect(result).toBe(false);
    });

    it('should return false for unverified items', () => {
      const unverifiedItem = { ...mockItem, verified: false };

      const result = ItemVerificationService.isVerificationExpired(unverifiedItem, 30);

      expect(result).toBe(false);
    });
  });

  describe('getExpiredVerifications', () => {
    it('should return items with expired verification', async () => {
      const items = [
        {
          ...mockItem,
          id: 'item-1',
          verifiedAt: { toDate: () => new Date('2023-12-01') } as any, // Expired
        },
        {
          ...mockItem,
          id: 'item-2',
          verifiedAt: { toDate: () => new Date('2023-12-31') } as any, // Recent
        },
        {
          ...mockItem,
          id: 'item-3',
          verified: false, // Unverified
        },
      ];

      mockItemService.getByStore.mockResolvedValue(items);

      const result = await ItemVerificationService.getExpiredVerifications('test-store-id', 30);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
    });
  });

  describe('batchVerifyItems', () => {
    it('should verify multiple items at once', async () => {
      const itemIds = ['item-1', 'item-2', 'item-3'];

      await ItemVerificationService.batchVerifyItems(itemIds);

      expect(mockItemService.update).toHaveBeenCalledTimes(3);
      itemIds.forEach(itemId => {
        expect(mockItemService.update).toHaveBeenCalledWith(itemId, {
          verified: true,
          verifiedAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
        });
      });
    });
  });

  describe('refreshVerification', () => {
    it('should update verification timestamp', async () => {
      await ItemVerificationService.refreshVerification('test-item-id');

      expect(mockItemService.update).toHaveBeenCalledWith('test-item-id', {
        verifiedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      });
    });
  });
});