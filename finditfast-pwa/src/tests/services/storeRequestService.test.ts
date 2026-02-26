import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreRequestService } from '../../services/storeRequestService';
import type { CreateStoreRequestData } from '../../services/storeRequestService';

// Mock Firebase
vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe('StoreRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStoreRequestData', () => {
    it('should return no errors for valid data', () => {
      const validData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
        notes: 'Test notes',
      };

      const errors = StoreRequestService.validateStoreRequestData(validData);
      expect(errors).toEqual([]);
    });

    it('should return error for missing store name', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: '',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toContain('Store name is required');
    });

    it('should return error for short store name', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: 'A',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toContain('Store name must be at least 2 characters long');
    });

    it('should return error for missing address', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toContain('Store address is required');
    });

    it('should return error for short address', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '123',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toContain('Please provide a complete address');
    });

    it('should return error for invalid location coordinates', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
        location: {
          latitude: 'invalid' as any,
          longitude: -74.0060,
        },
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toContain('Invalid location coordinates');
    });

    it('should return multiple errors for multiple issues', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: '',
        address: '',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toHaveLength(2);
      expect(errors).toContain('Store name is required');
      expect(errors).toContain('Store address is required');
    });

    it('should handle whitespace-only values', () => {
      const invalidData: CreateStoreRequestData = {
        storeName: '   ',
        address: '   ',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(invalidData);
      expect(errors).toContain('Store name is required');
      expect(errors).toContain('Store address is required');
    });

    it('should accept data without location', () => {
      const validData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
      };

      const errors = StoreRequestService.validateStoreRequestData(validData);
      expect(errors).toEqual([]);
    });
  });

  describe('createStoreRequest', () => {
    it('should create store request with valid data', async () => {
      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockResolvedValue({ id: 'request123' });

      const requestData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
      };

      const result = await StoreRequestService.createStoreRequest(requestData);
      expect(result).toBe('request123');
      expect(addDoc).toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockRejectedValue(new Error('Firestore error'));

      const requestData: CreateStoreRequestData = {
        storeName: 'Test Store',
        address: '123 Main St, City, State',
        requestedBy: 'user123',
      };

      await expect(StoreRequestService.createStoreRequest(requestData))
        .rejects.toThrow('Failed to submit store request. Please try again.');
    });
  });

  describe('updateStoreRequestStatus', () => {
    it('should update request status', async () => {
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as any).mockResolvedValue(undefined);

      await StoreRequestService.updateStoreRequestStatus('request123', 'approved', 'Looks good');
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      const { updateDoc } = await import('firebase/firestore');
      (updateDoc as any).mockRejectedValue(new Error('Firestore error'));

      await expect(StoreRequestService.updateStoreRequestStatus('request123', 'approved'))
        .rejects.toThrow('Failed to update store request status.');
    });
  });
});