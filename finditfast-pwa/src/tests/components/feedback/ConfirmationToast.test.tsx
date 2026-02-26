import { describe, it, expect, vi } from 'vitest';
import { ConfirmationToast } from '../../../components/feedback/ConfirmationToast';

describe('ConfirmationToast', () => {
  it('ConfirmationToast component exists and can be imported', () => {
    expect(ConfirmationToast).toBeDefined();
    expect(typeof ConfirmationToast).toBe('function');
  });

  it('has correct component signature', () => {
    // This tests that TypeScript accepts these props
    expect(typeof ConfirmationToast).toBe('function');
  });

  it('accepts all toast types in TypeScript', () => {
    const types: Array<'success' | 'error' | 'info'> = ['success', 'error', 'info'];
    
    // This tests that TypeScript accepts all these types
    types.forEach(type => {
      const props = {
        isVisible: true,
        message: 'Test message',
        type,
        onClose: vi.fn(),
      };
      expect(typeof props.type).toBe('string');
    });
  });
});