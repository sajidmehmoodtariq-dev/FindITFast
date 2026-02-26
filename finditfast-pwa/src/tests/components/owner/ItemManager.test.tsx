import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItemManager } from '../../../components/owner/ItemManager';

// Mock services
vi.mock('../../../services/firestoreService', () => ({
  ItemService: {
    create: vi.fn(),
  },
}));

vi.mock('../../../services/storageService', () => ({
  ItemStorageService: {
    uploadItemImage: vi.fn(),
    uploadPriceImage: vi.fn(),
  },
}));

vi.mock('../../../utilities/imageUtils', () => ({
  validateImageFile: vi.fn(),
  fileToBase64: vi.fn(),
  compressImage: vi.fn(),
}));

describe('ItemManager', () => {
  const mockProps = {
    storeId: 'test-store-id',
    floorplanUrl: 'https://example.com/floorplan.jpg',
    existingItems: [],
    onItemAdded: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with floorplan and instructions', () => {
    render(<ItemManager {...mockProps} />);
    
    expect(screen.getByText('Item Management')).toBeInTheDocument();
    expect(screen.getByText('How to add items:')).toBeInTheDocument();
    expect(screen.getByAltText('Store floorplan - tap to add items')).toBeInTheDocument();
    expect(screen.getByText('Current items: 0')).toBeInTheDocument();
  });

});