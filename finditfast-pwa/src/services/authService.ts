import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User, UserCredential } from 'firebase/auth';
import { auth } from './firebase';
import { StoreOwnerService } from './firestoreService';
import { generateUniqueOwnerId } from '../utils/idGenerator';
import type { StoreOwner } from '../types';

export interface OwnerRegistrationData {
  name: string;
  email: string;
  phone: string;
}

export interface AuthError {
  code: string;
  message: string;
}

export class AuthService {
  /**
   * Register a new store owner
   */
  static async registerOwner(data: OwnerRegistrationData, password: string): Promise<UserCredential> {
    try {
      const normalizedEmail = data.email.trim().toLowerCase();

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      
      // Generate custom short owner ID
      const customOwnerId = await generateUniqueOwnerId();
      
      // Create store owner profile in Firestore with custom ID as document ID
      const ownerData: Omit<StoreOwner, 'id'> = {
        firebaseUid: userCredential.user.uid,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        storeId: '', // Will be set when store is created
        createdAt: new Date() as any,
      };
      
      // Use the custom owner ID as the document ID
      await StoreOwnerService.createWithId(customOwnerId, ownerData);
      
      return userCredential;
    } catch (error: any) {
      console.error('Error registering owner:', error);
      throw this.formatAuthError(error);
    }
  }

  /**
   * Sign in store owner
   */
  static async signInOwner(email: string, password: string): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (error: any) {
      console.error('Error signing in owner:', error);
      throw this.formatAuthError(error);
    }
  }

  /**
   * Send a password reset email.
   */
  static async sendResetPasswordEmail(email: string): Promise<void> {
    try {
      await firebaseSendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (error: any) {
      console.error('Error sending reset password email:', error);
      throw this.formatAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  static async signOutOwner(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw this.formatAuthError(error);
    }
  }

  /**
   * Get current authenticated user
   */
  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Listen to authentication state changes
   */
  static onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Get store owner profile for current user
   */
  static async getCurrentOwnerProfile(): Promise<StoreOwner | null> {
    const user = this.getCurrentUser();
    if (!user) return null;

    try {
      const owners = await StoreOwnerService.getByFirebaseUid(user.uid);
      return owners[0] ?? null;
    } catch (error) {
      console.error('Error getting owner profile:', error);
      return null;
    }
  }

  /**
   * Format Firebase Auth errors for user display
   */
  private static formatAuthError(error: any): AuthError {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
    };

    return {
      code: error.code || 'auth/unknown-error',
      message: errorMessages[error.code] || 'An unexpected error occurred. Please try again.',
    };
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
  }

  /**
   * Validate phone format (basic validation)
   */
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): boolean {
    return password.length >= 6;
  }
}