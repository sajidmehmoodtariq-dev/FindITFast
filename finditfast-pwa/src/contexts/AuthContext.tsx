import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from '../services/authService';
import type { User } from 'firebase/auth';
import type { StoreOwner } from '../types';

interface AuthContextType {
  user: User | null;
  ownerProfile: StoreOwner | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshOwnerProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<StoreOwner | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOwnerProfile = async () => {
    if (user) {
      try {
        console.log('🔍 AuthContext: Fetching owner profile for user:', user.email, user.uid);
        const profile = await AuthService.getCurrentOwnerProfile();
        console.log('✅ AuthContext: Owner profile result:', profile ? `Found: ${profile.id}` : 'Not found');
        setOwnerProfile(profile);
      } catch (error) {
        console.error('❌ AuthContext: Error fetching owner profile:', error);
        // Don't clear ownerProfile immediately - user may still have valid session
        // Only clear if it's a critical auth error
        if (error instanceof Error && error.message.includes('permission-denied')) {
          setOwnerProfile(null);
        }
      }
    } else {
      setOwnerProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      setUser(user);

      if (user) {
        setLoading(false);
        // Fetch profile asynchronously — don't block the auth handler
        refreshOwnerProfile();
      } else {
        setOwnerProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      await AuthService.signOutOwner();
      setUser(null);
      setOwnerProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    ownerProfile,
    loading,
    signOut,
    refreshOwnerProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};