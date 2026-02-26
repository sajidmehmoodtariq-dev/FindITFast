import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Auth
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
}));

// Mock Firebase service
vi.mock('../../services/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Mock Firestore service
const mockStoreOwnerCreate = vi.fn();
const mockStoreOwnerGetAll = vi.fn();

vi.mock('../../services/firestoreService', () => ({
  StoreOwnerService: {
    create: mockStoreOwnerCreate,
    getAll: mockStoreOwnerGetAll,
  },
}));

// Import after mocking
import { AuthService, type OwnerRegistrationData } from '../../services/authService';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email validation', () => {
    it('should validate correct email formats', () => {
      expect(AuthService.isValidEmail('test@example.com')).toBe(true);
      expect(AuthService.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(AuthService.isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(AuthService.isValidEmail('invalid-email')).toBe(false);
      expect(AuthService.isValidEmail('test@')).toBe(false);
      expect(AuthService.isValidEmail('@example.com')).toBe(false);
      expect(AuthService.isValidEmail('test.example.com')).toBe(false);
      expect(AuthService.isValidEmail('')).toBe(false);
    });
  });

  describe('Phone validation', () => {
    it('should validate correct phone formats', () => {
      expect(AuthService.isValidPhone('1234567890')).toBe(true);
      expect(AuthService.isValidPhone('+1 234 567 8900')).toBe(true);
      expect(AuthService.isValidPhone('(123) 456-7890')).toBe(true);
      expect(AuthService.isValidPhone('+44 20 7946 0958')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(AuthService.isValidPhone('123')).toBe(false);
      expect(AuthService.isValidPhone('abc123def')).toBe(false);
      expect(AuthService.isValidPhone('')).toBe(false);
    });
  });

  describe('Password validation', () => {
    it('should validate password length', () => {
      expect(AuthService.isValidPassword('123456')).toBe(true);
      expect(AuthService.isValidPassword('password123')).toBe(true);
      expect(AuthService.isValidPassword('12345')).toBe(false);
      expect(AuthService.isValidPassword('')).toBe(false);
    });
  });

  describe('Error formatting', () => {
    it('should format known Firebase auth errors', () => {
      const mockError = { code: 'auth/email-already-in-use' };
      const formattedError = (AuthService as any).formatAuthError(mockError);
      
      expect(formattedError.code).toBe('auth/email-already-in-use');
      expect(formattedError.message).toBe('An account with this email already exists.');
    });

    it('should handle unknown errors', () => {
      const mockError = { code: 'auth/unknown-error' };
      const formattedError = (AuthService as any).formatAuthError(mockError);
      
      expect(formattedError.code).toBe('auth/unknown-error');
      expect(formattedError.message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle errors without codes', () => {
      const mockError = { message: 'Some error' };
      const formattedError = (AuthService as any).formatAuthError(mockError);
      
      expect(formattedError.code).toBe('auth/unknown-error');
      expect(formattedError.message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('Registration', () => {
    it('should register a new owner successfully', async () => {
      const mockUserCredential = { user: { uid: 'test-uid', email: 'test@example.com' } };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue(mockUserCredential as any);
      mockStoreOwnerCreate.mockResolvedValue('owner-id');

      const registrationData: OwnerRegistrationData = {
        name: 'John Doe',
        email: 'test@example.com',
        phone: '1234567890',
      };

      const result = await AuthService.registerOwner(registrationData, 'password123');

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      );
      expect(mockStoreOwnerCreate).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'test@example.com',
        phone: '1234567890',
        storeId: '',
        createdAt: expect.any(Date),
      });
      expect(result).toBe(mockUserCredential);
    });

    it('should handle registration errors', async () => {
      const mockError = { code: 'auth/email-already-in-use' };
      
      mockCreateUserWithEmailAndPassword.mockRejectedValue(mockError);

      const registrationData: OwnerRegistrationData = {
        name: 'John Doe',
        email: 'test@example.com',
        phone: '1234567890',
      };

      await expect(AuthService.registerOwner(registrationData, 'password123'))
        .rejects.toEqual({
          code: 'auth/email-already-in-use',
          message: 'An account with this email already exists.',
        });
    });
  });

  describe('Sign in', () => {
    it('should sign in owner successfully', async () => {
      const mockUserCredential = { user: { uid: 'test-uid', email: 'test@example.com' } };
      
      mockSignInWithEmailAndPassword.mockResolvedValue(mockUserCredential as any);

      const result = await AuthService.signInOwner('test@example.com', 'password123');

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      );
      expect(result).toBe(mockUserCredential);
    });

    it('should handle sign in errors', async () => {
      const mockError = { code: 'auth/wrong-password' };
      
      mockSignInWithEmailAndPassword.mockRejectedValue(mockError);

      await expect(AuthService.signInOwner('test@example.com', 'wrongpassword'))
        .rejects.toEqual({
          code: 'auth/wrong-password',
          message: 'Incorrect password. Please try again.',
        });
    });
  });

  describe('Sign out', () => {
    it('should sign out successfully', async () => {
      mockSignOut.mockResolvedValue(undefined);

      await AuthService.signOutOwner();

      expect(mockSignOut).toHaveBeenCalledWith(expect.anything());
    });

    it('should handle sign out errors', async () => {
      const mockError = { code: 'auth/network-request-failed' };
      
      mockSignOut.mockRejectedValue(mockError);

      await expect(AuthService.signOutOwner())
        .rejects.toEqual({
          code: 'auth/network-request-failed',
          message: 'Network error. Please check your connection.',
        });
    });
  });
});