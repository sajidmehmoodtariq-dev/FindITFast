import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService, FloorplanService, ItemImageService } from '../../services/storageService';

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

// Mock image compression utility
vi.mock('../../utilities/imageUtils', () => ({
  compressImage: vi.fn(),
}));

// Mock Firebase config
vi.mock('../../services/firebase', () => ({
  storage: {},
}));

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should be defined', () => {
      expect(StorageService.uploadFile).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof StorageService.uploadFile).toBe('function');
    });
  });

  describe('uploadCompressedImage', () => {
    it('should be defined', () => {
      expect(StorageService.uploadCompressedImage).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof StorageService.uploadCompressedImage).toBe('function');
    });
  });

  describe('deleteFile', () => {
    it('should be defined', () => {
      expect(StorageService.deleteFile).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof StorageService.deleteFile).toBe('function');
    });
  });

  describe('getDownloadURL', () => {
    it('should be defined', () => {
      expect(StorageService.getDownloadURL).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof StorageService.getDownloadURL).toBe('function');
    });
  });
});

describe('FloorplanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upload', () => {
    it('should be defined', () => {
      expect(FloorplanService.upload).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof FloorplanService.upload).toBe('function');
    });
  });

  describe('delete', () => {
    it('should be defined', () => {
      expect(FloorplanService.delete).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof FloorplanService.delete).toBe('function');
    });
  });
});

describe('ItemImageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upload', () => {
    it('should be defined', () => {
      expect(ItemImageService.upload).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof ItemImageService.upload).toBe('function');
    });
  });

  describe('uploadPriceImage', () => {
    it('should be defined', () => {
      expect(ItemImageService.uploadPriceImage).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof ItemImageService.uploadPriceImage).toBe('function');
    });
  });

  describe('delete', () => {
    it('should be defined', () => {
      expect(ItemImageService.delete).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof ItemImageService.delete).toBe('function');
    });
  });

  describe('deletePriceImage', () => {
    it('should be defined', () => {
      expect(ItemImageService.deletePriceImage).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof ItemImageService.deletePriceImage).toBe('function');
    });
  });
});