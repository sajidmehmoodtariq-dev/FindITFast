import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminService } from '../../services/adminService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOwner?: boolean;
  allowAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireOwner = false,
  allowAdmin = false  
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAdminAccess = async () => {
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);
      const adminAccess = await AdminService.isAdminUid(user.uid);
      if (active) {
        setIsAdmin(adminAccess);
        setCheckingAdmin(false);
      }
    };

    checkAdminAccess();

    return () => {
      active = false;
    };
  }, [user]);

  // Show loading spinner while checking authentication
  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth page if not authenticated
  if (!user) {
    // Redirect to appropriate auth page based on route
    const redirectTo = location.pathname.startsWith('/admin') ? '/admin/auth' : '/owner/auth';
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If admin access is allowed and user is admin, allow access
  if (allowAdmin) {
    if (isAdmin) {
      return <>{children}</>;
    }
    return <Navigate to="/owner/dashboard" replace />;
  }

  // Owner routes should not be accessible to app admins
  if (requireOwner && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // For owner routes, allow access if user is authenticated and not admin
  if (requireOwner) {
    return <>{children}</>;
  }

  return <>{children}</>;
};