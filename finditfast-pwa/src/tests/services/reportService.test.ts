import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportService, ReportServiceClass } from '../../services/reportService';
import { ReportService, ItemService } from '../../services/firestoreService';
import { Timestamp } from 'firebase/firestore';

// Mock the firestore services
vi.mock('../../services/firestoreService', () => ({
  ReportService: {
    create: vi.fn(),
    getByItem: vi.fn(),
    getByStore: vi.fn(),
    getRecentReports: vi.fn(),
  },
  ItemService: {
    incrementReportCount: vi.fn(),
  },
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};
Object.defineProperty(global, 'navigator', {
  value: {
    geolocation: mockGeolocation,
  },
  writable: true,
});

describe('ReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitReport', () => {
    it('creates a report successfully', async () => {
      const mockReportId = 'report123';
      vi.mocked(ReportService.create).mockResolvedValue(mockReportId);

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'missing' as const,
        comment: 'Test comment',
        userId: 'user1',
      };

      const result = await reportService.submitReport(reportData);

      expect(result).toBe(mockReportId);
      expect(ReportService.create).toHaveBeenCalledWith({
        itemId: 'item1',
        storeId: 'store1',
        type: 'missing',
        timestamp: expect.any(Timestamp),
        userId: 'user1',
        location: undefined,
      });
    });

    it('increments report count for negative reports', async () => {
      const mockReportId = 'report123';
      vi.mocked(ReportService.create).mockResolvedValue(mockReportId);

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'missing' as const,
      };

      await reportService.submitReport(reportData);

      expect(ItemService.incrementReportCount).toHaveBeenCalledWith('item1');
    });

    it('increments report count for moved reports', async () => {
      const mockReportId = 'report123';
      vi.mocked(ReportService.create).mockResolvedValue(mockReportId);

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'moved' as const,
      };

      await reportService.submitReport(reportData);

      expect(ItemService.incrementReportCount).toHaveBeenCalledWith('item1');
    });

    it('does not increment report count for positive reports', async () => {
      const mockReportId = 'report123';
      vi.mocked(ReportService.create).mockResolvedValue(mockReportId);

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'found' as const,
      };

      await reportService.submitReport(reportData);

      expect(ItemService.incrementReportCount).not.toHaveBeenCalled();
    });

    it('throws error when report creation fails', async () => {
      vi.mocked(ReportService.create).mockRejectedValue(new Error('Database error'));

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'missing' as const,
      };

      await expect(reportService.submitReport(reportData)).rejects.toThrow(
        'Failed to submit report. Please try again.'
      );
    });
  });

  describe('getItemReports', () => {
    it('returns reports for an item', async () => {
      const mockReports = [
        { id: 'report1', itemId: 'item1', type: 'missing' },
        { id: 'report2', itemId: 'item1', type: 'found' },
      ];
      vi.mocked(ReportService.getByItem).mockResolvedValue(mockReports as any);

      const result = await reportService.getItemReports('item1');

      expect(result).toEqual(mockReports);
      expect(ReportService.getByItem).toHaveBeenCalledWith('item1');
    });

    it('throws error when getting reports fails', async () => {
      vi.mocked(ReportService.getByItem).mockRejectedValue(new Error('Database error'));

      await expect(reportService.getItemReports('item1')).rejects.toThrow(
        'Failed to load reports.'
      );
    });
  });

  describe('getItemReportStats', () => {
    it('calculates report statistics correctly', async () => {
      const mockReports = [
        { id: 'report1', type: 'missing' },
        { id: 'report2', type: 'missing' },
        { id: 'report3', type: 'moved' },
        { id: 'report4', type: 'found' },
        { id: 'report5', type: 'confirm' },
      ];
      vi.mocked(ReportService.getByItem).mockResolvedValue(mockReports as any);

      const result = await ReportServiceClass.getItemReportStats('item1');

      expect(result).toEqual({
        total: 5,
        missing: 2,
        moved: 1,
        found: 1,
        confirmed: 1,
      });
    });

    it('returns zero stats for no reports', async () => {
      vi.mocked(ReportService.getByItem).mockResolvedValue([]);

      const result = await ReportServiceClass.getItemReportStats('item1');

      expect(result).toEqual({
        total: 0,
        missing: 0,
        moved: 0,
        found: 0,
        confirmed: 0,
      });
    });
  });

  describe('shouldFlagItem', () => {
    it('flags item with many negative reports', async () => {
      const mockReports = [
        { id: 'report1', type: 'missing' },
        { id: 'report2', type: 'missing' },
        { id: 'report3', type: 'missing' },
        { id: 'report4', type: 'moved' },
      ];
      vi.mocked(ReportService.getByItem).mockResolvedValue(mockReports as any);

      const result = await ReportServiceClass.shouldFlagItem('item1');

      expect(result).toBe(true);
    });

    it('does not flag item with few negative reports', async () => {
      const mockReports = [
        { id: 'report1', type: 'missing' },
        { id: 'report2', type: 'found' },
      ];
      vi.mocked(ReportService.getByItem).mockResolvedValue(mockReports as any);

      const result = await ReportServiceClass.shouldFlagItem('item1');

      expect(result).toBe(false);
    });

    it('does not flag item with more positive than negative reports', async () => {
      const mockReports = [
        { id: 'report1', type: 'missing' },
        { id: 'report2', type: 'missing' },
        { id: 'report3', type: 'missing' },
        { id: 'report4', type: 'found' },
        { id: 'report5', type: 'found' },
        { id: 'report6', type: 'found' },
        { id: 'report7', type: 'found' },
      ];
      vi.mocked(ReportService.getByItem).mockResolvedValue(mockReports as any);

      const result = await ReportServiceClass.shouldFlagItem('item1');

      expect(result).toBe(false);
    });
  });

  describe('flagItemForReview', () => {
    it('logs flagging action', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await ReportServiceClass.flagItemForReview('item1', 'Test reason');

      expect(consoleSpy).toHaveBeenCalledWith('Item item1 flagged for admin review: Test reason');
      
      consoleSpy.mockRestore();
    });

    it('uses default reason when none provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await ReportServiceClass.flagItemForReview('item1');

      expect(consoleSpy).toHaveBeenCalledWith('Item item1 flagged for admin review: Multiple negative reports');
      
      consoleSpy.mockRestore();
    });
  });

  describe('processReportAndFlag', () => {
    it('submits report and flags item when needed', async () => {
      const mockReportId = 'report123';
      vi.mocked(ReportService.create).mockResolvedValue(mockReportId);
      vi.mocked(ReportService.getByItem).mockResolvedValue([
        { id: 'report1', type: 'missing' },
        { id: 'report2', type: 'missing' },
        { id: 'report3', type: 'missing' },
      ] as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'missing' as const,
      };

      const result = await ReportServiceClass.processReportAndFlag(reportData);

      expect(result).toBe(mockReportId);
      expect(ItemService.incrementReportCount).toHaveBeenCalledWith('item1');
      expect(consoleSpy).toHaveBeenCalledWith('Item item1 flagged for admin review: Multiple missing reports received');
      
      consoleSpy.mockRestore();
    });

    it('submits report without flagging for positive reports', async () => {
      const mockReportId = 'report123';
      vi.mocked(ReportService.create).mockResolvedValue(mockReportId);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const reportData = {
        itemId: 'item1',
        storeId: 'store1',
        type: 'found' as const,
      };

      const result = await ReportServiceClass.processReportAndFlag(reportData);

      expect(result).toBe(mockReportId);
      expect(ItemService.incrementReportCount).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getUserLocation', () => {
    it('returns location when geolocation is successful', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      };
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const result = await ReportServiceClass.getUserLocation();

      expect(result).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
      });
    });

    it('returns undefined when geolocation fails', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
        error(new Error('Location denied'));
      });

      const result = await ReportServiceClass.getUserLocation();

      expect(result).toBeUndefined();
    });

    it('returns undefined when geolocation is not available', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      const result = await ReportServiceClass.getUserLocation();

      expect(result).toBeUndefined();
    });
  });
});