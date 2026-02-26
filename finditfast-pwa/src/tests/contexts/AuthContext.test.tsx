import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/authService';

// Mock AuthService
vi.mock('../../services/authService', () => ({
  AuthService: {
    onAuthStateChange: vi.fn(),
    getCurrentOwnerProfile: vi.fn(),
    signOutOwner: vi.fn(),
  },
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { user, ownerProfile, loading, signOut } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="owner">{ownerProfile ? ownerProfile.name : 'No owner'}</div>
      <button onClick={signOut} data-testid="signout">Sign Out</button>
    </div>
  );
};

describe('AuthContext', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
  };

  const mockOwnerProfile = {
    id: 'owner-1',
    firebaseUid: 'test-uid',
    name: 'John Doe',
    email: 'test@example.com',
    phone: '1234567890',
    storeName: 'Test Store',
    storeId: 'store-1',
    createdAt: new Date() as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide loading state initially', () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(AuthService.onAuthStateChange).mockReturnValue(mockUnsubscribe);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should provide user and owner profile when authenticated', async () => {
    const mockUnsubscribe = vi.fn();
    let authCallback: (user: any) => void;
    
    vi.mocked(AuthService.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return mockUnsubscribe;
    });
    
    vi.mocked(AuthService.getCurrentOwnerProfile).mockResolvedValue(mockOwnerProfile);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate user authentication
    authCallback!(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('owner')).toHaveTextContent('John Doe');
    });
  });

  it('should handle no user state', async () => {
    const mockUnsubscribe = vi.fn();
    let authCallback: (user: any) => void;
    
    vi.mocked(AuthService.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return mockUnsubscribe;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate no user
    authCallback!(null);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(screen.getByTestId('owner')).toHaveTextContent('No owner');
    });
  });

  it('should handle sign out', async () => {
    const mockUnsubscribe = vi.fn();
    let authCallback: (user: any) => void;
    
    vi.mocked(AuthService.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return mockUnsubscribe;
    });
    
    vi.mocked(AuthService.getCurrentOwnerProfile).mockResolvedValue(mockOwnerProfile);
    vi.mocked(AuthService.signOutOwner).mockResolvedValue();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate user authentication
    authCallback!(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Click sign out
    const signOutButton = screen.getByTestId('signout');
    signOutButton.click();

    await waitFor(() => {
      expect(AuthService.signOutOwner).toHaveBeenCalled();
    });
  });

  it('should handle owner profile fetch error', async () => {
    const mockUnsubscribe = vi.fn();
    let authCallback: (user: any) => void;
    
    vi.mocked(AuthService.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      return mockUnsubscribe;
    });
    
    vi.mocked(AuthService.getCurrentOwnerProfile).mockRejectedValue(new Error('Profile fetch failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate user authentication
    authCallback!(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('owner')).toHaveTextContent('No owner');
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching owner profile:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should throw error when useAuth is used outside provider', () => {
    const TestComponentOutsideProvider = () => {
      useAuth();
      return <div>Test</div>;
    };

    expect(() => {
      render(<TestComponentOutsideProvider />);
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});