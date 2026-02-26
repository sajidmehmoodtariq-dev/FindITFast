import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the auth context
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const TestComponent = () => <div>Protected Content</div>;

const renderWithRouter = (component: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {component}
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
  } as any;

  const mockOwnerProfile = {
    id: 'owner-1',
    name: 'John Doe',
    email: 'test@example.com',
    phone: '1234567890',
    storeName: 'Test Store',
    storeId: 'store-1',
    firebaseUid: 'test-uid',
    createdAt: new Date() as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner when loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      ownerProfile: null,
      loading: true,
      signOut: vi.fn(),
      refreshOwnerProfile: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to auth page when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      ownerProfile: null,
      loading: false,
      signOut: vi.fn(),
      refreshOwnerProfile: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );

    // Since we're using MemoryRouter, we can't test actual navigation
    // but we can verify the component doesn't render the protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated and owner not required', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      ownerProfile: null,
      loading: false,
      signOut: vi.fn(),
      refreshOwnerProfile: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute requireOwner={false}>
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render children when authenticated with owner profile', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      ownerProfile: mockOwnerProfile,
      loading: false,
      signOut: vi.fn(),
      refreshOwnerProfile: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute requireOwner={true}>
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show error when owner required but profile not found', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      ownerProfile: null,
      loading: false,
      signOut: vi.fn(),
      refreshOwnerProfile: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute requireOwner={true}>
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByText('Owner Profile Not Found')).toBeInTheDocument();
    expect(screen.getByText(/Your account is not associated with a store owner profile/)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should show back to authentication button when owner profile not found', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      ownerProfile: null,
      loading: false,
      signOut: vi.fn(),
      refreshOwnerProfile: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute requireOwner={true}>
        <TestComponent />
      </ProtectedRoute>
    );

    const backButton = screen.getByText('Back to Authentication');
    expect(backButton).toBeInTheDocument();
    expect(backButton.tagName).toBe('BUTTON');
  });
});