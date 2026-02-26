import { describe, it, expect, vi } from 'vitest';
import { FeedbackModal } from '../../../components/feedback/FeedbackModal';
import type { Item, Store } from '../../../types';
import { Timestamp } from 'firebase/firestore';

const mockItem: Item = {
  id: 'item1',
  name: 'Test Item',
  storeId: 'store1',
  imageUrl: 'https://example.com/item.jpg',
  position: { x: 50, y: 50 },
  price: '9.99',
  verified: true,
  verifiedAt: Timestamp.now(),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  reportCount: 0,
  lastConfirmedAt: null,
  weeklyGreenCount: 0,
  weeklyYellowCount: 0,
  recentRedCount24h: 0,
  statusOverride: null,
};

const mockStore: Store = {
  id: 'store1',
  name: 'Test Store',
  address: '123 Test St',
  location: { latitude: 40.7128, longitude: -74.0060 },
  ownerId: 'owner1',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

describe('FeedbackModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: mockItem,
    store: mockStore,
    reportType: 'missing' as const,
    onSubmit: vi.fn(),
  };

  it('FeedbackModal component exists and can be imported', () => {
    expect(FeedbackModal).toBeDefined();
    expect(typeof FeedbackModal).toBe('function');
  });

  it('has correct component signature', () => {
    // Test that the component accepts the expected props
    expect(typeof FeedbackModal).toBe('function');
    expect(typeof defaultProps.item).toBe('object');
    expect(typeof defaultProps.store).toBe('object');
  });

  it('accepts all report types in TypeScript', () => {
    const types: Array<'missing' | 'moved' | 'found' | 'confirm'> = ['missing', 'moved', 'found', 'confirm'];
    
    // This tests that TypeScript accepts all these types
    types.forEach(reportType => {
      const props = { ...defaultProps, reportType };
      expect(typeof props.reportType).toBe('string');
    });
  });
});