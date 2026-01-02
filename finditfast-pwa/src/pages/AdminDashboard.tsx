import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword, sendEmailVerification, verifyBeforeUpdateEmail } from 'firebase/auth';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalStores: 0,
    totalItems: 0,
    pendingRequests: 0,
    storeOwners: 0
  });
  const [loading, setLoading] = useState(true);
  const [storeOwners, setStoreOwners] = useState<any[]>([]);
  const [storeRequests, setStoreRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ storeId: string; storeName: string } | null>(null);
  const [deleteOwnerConfirm, setDeleteOwnerConfirm] = useState<{ ownerId: string; ownerName: string; ownerEmail: string } | null>(null);
  // App banner text state
  const [homeBannerText, setHomeBannerText] = useState<string>('');
  const [savingBanner, setSavingBanner] = useState<boolean>(false);
  const [bannerStatus, setBannerStatus] = useState<{success: boolean; message: string} | null>(null);
  
  // Download base64 document function
  const downloadBase64Document = (doc: any) => {
    try {
      // Create a blob from the base64 data
      const byteCharacters = atob(doc.base64.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: doc.type });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document. Please try again.');
    }
  };
  
  // Email and password update states
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{ type: 'email' | 'password', success: boolean, message: string } | null>(null);
  
  // Analytics types
  interface StoreGrowthData {
    month: string;
    approved: number;
    pending: number;
    rejected: number;
    total: number;
  }

  interface RequestTrendData {
    name: string;
    value: number;
    color: string;
  }

  interface StoreDistributionData {
    location: string;
    count: number;
  }

  interface UserActivityData {
    owner: string;
    stores: number;
  }

  interface PopularStoreData {
    storeName: string;
    items: number;
    views: number;
  }

  interface TimeMetrics {
    avgApprovalTime: number;
    avgResponseTime: number;
    totalSearches: number;
    activeUsers: number;
  }

  interface AnalyticsData {
    storeGrowth: StoreGrowthData[];
    requestTrends: RequestTrendData[];
    storeDistribution: StoreDistributionData[];
    userActivity: UserActivityData[];
    popularStores: PopularStoreData[];
    timeMetrics: TimeMetrics;
  }

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    storeGrowth: [],
    requestTrends: [],
    storeDistribution: [],
    userActivity: [],
    popularStores: [],
    timeMetrics: {
      avgApprovalTime: 0,
      avgResponseTime: 0,
      totalSearches: 0,
      activeUsers: 0
    }
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Load analytics data
  const loadAnalyticsData = async () => {
    if (!isAppAdmin) return;
    
    try {
      setAnalyticsLoading(true);
      
      // Get all store requests for trends
      const requestsQuery = query(collection(db, 'storeRequests'));
      const requestsSnapshot = await getDocs(requestsQuery);
      const allRequests = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          approvedAt: data.approvedAt?.toDate() || null,
          rejectedAt: data.rejectedAt?.toDate() || null,
          status: data.status || 'pending',
          storeAddress: data.address || data.storeAddress || '',
          storeName: data.storeName || '',
          ownerEmail: data.ownerEmail || '',
          requestedBy: data.requestedBy || data.ownerEmail || ''
        };
      });

      // Get all items from approved stores
      const itemsQuery = query(collection(db, 'items'));
      const itemsSnapshot = await getDocs(itemsQuery);
      const allItems = itemsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          storeId: data.storeId || data.store || '',
          store: data.store || data.storeId || ''
        };
      });

      // Get search logs if they exist (you might need to create this collection)
      let searchLogs: any[] = [];
      try {
        const searchQuery = query(collection(db, 'searchLogs'));
        const searchSnapshot = await getDocs(searchQuery);
        searchLogs = searchSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
      } catch (error) {
        console.log('No search logs collection found');
      }

      // Get user activity logs if they exist
      let userLogs: any[] = [];
      try {
        const userQuery = query(collection(db, 'userActivity'));
        const userSnapshot = await getDocs(userQuery);
        userLogs = userSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
      } catch (error) {
        console.log('No user activity collection found');
      }
      
      // Calculate store growth over time (last 6 months)
      const now = new Date();
      const storeGrowth = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthRequests = allRequests.filter(req => 
          req.submittedAt >= monthStart && req.submittedAt <= monthEnd
        );
        
        const approved = monthRequests.filter(req => req.status === 'approved').length;
        const pending = monthRequests.filter(req => req.status === 'pending').length;
        const rejected = monthRequests.filter(req => req.status === 'rejected').length;
        
        storeGrowth.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          approved,
          pending,
          rejected,
          total: monthRequests.length
        });
      }
      
      // Calculate request trends
      const requestTrends = [
        { name: 'Approved', value: allRequests.filter(req => req.status === 'approved').length, color: '#10B981' },
        { name: 'Pending', value: allRequests.filter(req => req.status === 'pending').length, color: '#F59E0B' },
        { name: 'Rejected', value: allRequests.filter(req => req.status === 'rejected').length, color: '#EF4444' }
      ];
      
      // Calculate store distribution by location (top 10) - using actual addresses
      const locationCounts: Record<string, number> = {};
      allRequests.filter(req => req.status === 'approved').forEach(req => {
        const fullAddress = req.storeAddress || 'Unknown Location';
        // Extract city/area from address (assuming format: "Street, City, State/Country")
        const addressParts = fullAddress.split(',').map((part: string) => part.trim());
        const location = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : addressParts[0] || 'Unknown';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      });
      
      const storeDistribution = Object.entries(locationCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([location, count]) => ({ location, count: count as number }));
      
      // Calculate user activity (stores per owner) - using actual owners
      const ownerCounts: Record<string, number> = {};
      allRequests.filter(req => req.status === 'approved').forEach(req => {
        const owner = req.ownerEmail || req.requestedBy || 'Unknown';
        ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
      });
      
      const userActivity = Object.entries(ownerCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 8)
        .map(([owner, stores]) => ({ owner, stores: stores as number }));
      
      // Calculate popular stores using actual item counts per store
      const approvedStores = allRequests.filter(req => req.status === 'approved');
      const storeItemCounts: Record<string, number> = {};
      
      // Count items per store
      allItems.forEach(item => {
        const storeId = item.storeId || item.store || 'unknown';
        storeItemCounts[storeId] = (storeItemCounts[storeId] || 0) + 1;
      });

      // Count searches per store (if search logs available)
      const storeSearchCounts: Record<string, number> = {};
      searchLogs.forEach(search => {
        const storeId = search.storeId || search.store || 'unknown';
        storeSearchCounts[storeId] = (storeSearchCounts[storeId] || 0) + 1;
      });
      
      const popularStores = approvedStores
        .map(store => {
          const storeKey = store.id || store.storeName;
          const itemCount = storeItemCounts[storeKey] || storeItemCounts[store.storeName] || 0;
          const searchCount = storeSearchCounts[storeKey] || storeSearchCounts[store.storeName] || 0;
          
          return {
            storeName: store.storeName,
            items: itemCount,
            views: searchCount,
          };
        })
        .sort((a, b) => b.items - a.items)
        .slice(0, 8);
      
      // Calculate time metrics using actual data
      const approvedRequests = allRequests.filter(req => req.status === 'approved' && req.approvedAt);
      const avgApprovalTime = approvedRequests.length > 0 
        ? approvedRequests.reduce((sum, req) => {
            const timeDiff = req.approvedAt.getTime() - req.submittedAt.getTime();
            return sum + timeDiff / (1000 * 60 * 60 * 24); // days
          }, 0) / approvedRequests.length
        : 0;

      // Calculate average response time (time between submission and any status change)
      const respondedRequests = allRequests.filter(req => 
        (req.status === 'approved' && req.approvedAt) || 
        (req.status === 'rejected' && req.rejectedAt)
      );
      
      const avgResponseTime = respondedRequests.length > 0
        ? respondedRequests.reduce((sum, req) => {
            const responseDate = req.approvedAt || req.rejectedAt;
            const timeDiff = responseDate.getTime() - req.submittedAt.getTime();
            return sum + timeDiff / (1000 * 60 * 60 * 24); // days
          }, 0) / respondedRequests.length
        : 0;

      // Get unique users count (actual active users)
      const uniqueUsers = new Set();
      allRequests.forEach(req => {
        if (req.requestedBy) uniqueUsers.add(req.requestedBy);
        if (req.ownerEmail) uniqueUsers.add(req.ownerEmail);
      });
      userLogs.forEach(log => {
        if (log.userId) uniqueUsers.add(log.userId);
      });
      searchLogs.forEach(log => {
        if (log.userId) uniqueUsers.add(log.userId);
      });
      
      const timeMetrics = {
        avgApprovalTime: Math.round(avgApprovalTime * 10) / 10,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        totalSearches: searchLogs.length,
        activeUsers: uniqueUsers.size
      };
      
      setAnalyticsData({
        storeGrowth,
        requestTrends,
        storeDistribution,
        userActivity,
        popularStores,
        timeMetrics
      });
      
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/admin/auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  // Handle email update
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail || !user.email) return;
    
    try {
      setEmailUpdateLoading(true);
      setUpdateStatus(null);
      
      // Firebase requires recent authentication before updating email
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Use verifyBeforeUpdateEmail instead of updateEmail
      // This sends a verification email to the new address first
      await verifyBeforeUpdateEmail(user, newEmail);
      
      // Clear form and show success message
      setNewEmail('');
      setEmailCurrentPassword('');
      setUpdateStatus({
        type: 'email',
        success: true,
        message: 'Verification email sent to your new address. Please check your email to complete the update.'
      });
      
    } catch (error: any) {
      console.error('Error updating email:', error);
      
      let errorMessage = 'Failed to update email. Please try again.';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use by another account.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before updating your email.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email verification required. Please check your email to complete the verification process.';
      }
      
      setUpdateStatus({
        type: 'email',
        success: false,
        message: errorMessage
      });
    } finally {
      setEmailUpdateLoading(false);
    }
  };
  
  // Handle password update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPassword || newPassword !== confirmPassword || !user.email) return;
    
    try {
      setPasswordUpdateLoading(true);
      setUpdateStatus(null);
      
      // Firebase requires recent authentication before updating password
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(user.email, passwordCurrentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      // Clear form and show success message
      setNewPassword('');
      setConfirmPassword('');
      setPasswordCurrentPassword('');
      setUpdateStatus({
        type: 'password',
        success: true,
        message: 'Password updated successfully!'
      });
      
    } catch (error: any) {
      console.error('Error updating password:', error);
      
      let errorMessage = 'Failed to update password. Please try again.';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before updating your password.';
      }
      
      setUpdateStatus({
        type: 'password',
        success: false,
        message: errorMessage
      });
    } finally {
      setPasswordUpdateLoading(false);
    }
  };

  // Load all stores - following same pattern as loadStoreOwners
  const loadStores = async () => {
    if (!isAppAdmin) return;
    
    try {
      setStoresLoading(true);
      console.log('🔍 [ADMIN STORES DEBUG] Starting to load stores for admin dashboard...');
      console.log('📊 [ADMIN STORES DEBUG] Following same pattern as store owners section...');
      
      // Get ALL store requests (same as loadStoreOwners) and then filter
      console.log('📋 [ADMIN STORES DEBUG] Fetching ALL store requests from storeRequests collection...');
      const requestsSnapshot = await getDocs(collection(db, 'storeRequests'));
      console.log(`� [ADMIN STORES DEBUG] Found ${requestsSnapshot.size} total store requests in 'storeRequests' collection`);
      
      // Map all requests with proper date conversion (same as loadStoreOwners)
      const allRequestsData = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          approvedAt: data.approvedAt?.toDate(),
          rejectedAt: data.rejectedAt?.toDate()
        };
      });
      
      // Count by status for debugging
      const statusCounts = {
        approved: allRequestsData.filter(req => req.status === 'approved').length,
        pending: allRequestsData.filter(req => req.status === 'pending').length,
        rejected: allRequestsData.filter(req => req.status === 'rejected').length,
        other: allRequestsData.filter(req => !['approved', 'pending', 'rejected'].includes(req.status)).length
      };
      console.log('� [ADMIN STORES DEBUG] Store requests by status:', statusCounts);
      
      // Filter for approved stores only and exclude deleted ones
      const approvedStores = allRequestsData.filter(request => {
        const isApproved = request.status === 'approved';
        const isDeleted = request.deleted;
        
        if (!isApproved) return false;
        if (isDeleted) {
          console.log(`⚠️ [ADMIN STORES DEBUG] Filtering out deleted approved store: ${request.id} (${request.storeName})`);
          return false;
        }
        
        console.log(`✅ [ADMIN STORES DEBUG] Including approved store: ${request.id} (${request.storeName})`);
        return true;
      });
      
      console.log(`📊 [ADMIN STORES DEBUG] After filtering: ${approvedStores.length} approved non-deleted stores`);
      
      // Map to store format with proper field mapping
      const storesData = approvedStores.map(request => {
        console.log(`🔄 [ADMIN STORES DEBUG] Mapping store request ${request.id}:`, {
          id: request.id,
          storeName: request.storeName,
          storeAddress: request.storeAddress || request.address,
          requestedBy: request.requestedBy,
          ownerEmail: request.ownerEmail,
          status: request.status,
          approvedAt: request.approvedAt,
          submittedAt: request.submittedAt
        });
        
        return {
          id: request.id,
          ...request,
          // Map store request fields to consistent store fields
          name: request.storeName,
          ownerId: request.requestedBy,
          ownerEmail: request.ownerEmail,
          coordinates: request.storeCoordinates || request.coordinates,
          address: request.storeAddress || request.address,
          createdAt: request.submittedAt || new Date(),
          approvedAt: request.approvedAt || null,
          hasFloorplan: request.hasFloorplan || false
        };
      });
      
      // Sort by approval date (most recent first)
      const sortedStores = storesData.sort((a, b) => {
        const dateA = a.approvedAt || a.createdAt;
        const dateB = b.approvedAt || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('🎯 [ADMIN STORES DEBUG] Final store loading summary:');
      console.log(`   • Total store requests in database: ${requestsSnapshot.size}`);
      console.log(`   • Approved requests: ${statusCounts.approved}`);
      console.log(`   • Pending requests: ${statusCounts.pending}`);
      console.log(`   • Rejected requests: ${statusCounts.rejected}`);
      console.log(`   • Final stores to display: ${sortedStores.length}`);
      console.log('   • Data source: storeRequests collection (same as store owners section)');
      console.log('   • Filter: status === "approved" AND deleted !== true');
      
      setStores(sortedStores);
    } catch (error) {
      console.error('❌ [ADMIN STORES DEBUG] Error loading stores:', error);
    } finally {
      setStoresLoading(false);
    }
  };

  // Delete store owner and all related data (HARD DELETE)
  const handleDeleteStoreOwner = async (ownerId: string) => {
    if (!isAppAdmin || !deleteOwnerConfirm) return;
    
    try {
      setActionLoading(`delete_owner_${ownerId}`);
      
      console.log('🗑️ Starting HARD deletion of store owner:', ownerId);
      
      // Get all store requests by this owner (using requestedBy field)
      const storeRequestsQuery = query(
        collection(db, 'storeRequests'),
        where('requestedBy', '==', ownerId)
      );
      const storeRequestsSnapshot = await getDocs(storeRequestsQuery);
      console.log(`📋 Found ${storeRequestsSnapshot.size} store requests to DELETE`);
      
      // Collect all store IDs for deleting related items
      const storeIds = new Set<string>();
      
      // Add store IDs from store requests (all stores are in storeRequests collection)
      storeRequestsSnapshot.docs.forEach(doc => {
        storeIds.add(doc.id); // The document ID is the store ID
        const data = doc.data();
        if (data.storeId) storeIds.add(data.storeId);
        if (data.storeName) storeIds.add(data.storeName); // Sometimes items reference by name
        if (data.name) storeIds.add(data.name); // Sometimes items reference by name
      });
      
      console.log(`🔍 Will DELETE items from stores:`, Array.from(storeIds));
      
      // Get all items from these stores
      let itemsToDelete: any[] = [];
      for (const storeId of storeIds) {
        try {
          // Try with storeId field
          const itemsQuery1 = query(
            collection(db, 'items'),
            where('storeId', '==', storeId)
          );
          const itemsSnapshot1 = await getDocs(itemsQuery1);
          itemsToDelete = itemsToDelete.concat(itemsSnapshot1.docs);
          
          // Try with store field (alternative field name)
          const itemsQuery2 = query(
            collection(db, 'items'),
            where('store', '==', storeId)
          );
          const itemsSnapshot2 = await getDocs(itemsQuery2);
          itemsToDelete = itemsToDelete.concat(itemsSnapshot2.docs);
        } catch (error) {
          console.warn(`⚠️ Error querying items for store ${storeId}:`, error);
        }
      }
      
      // Remove duplicates based on document ID
      const uniqueItems = itemsToDelete.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );
      console.log(`📦 Found ${uniqueItems.length} items to DELETE`);
      
      // HARD DELETE all items
      for (const itemDoc of uniqueItems) {
        try {
          await deleteDoc(doc(db, 'items', itemDoc.id));
          console.log(`✅ DELETED item: ${itemDoc.id}`);
        } catch (error) {
          console.warn(`⚠️ Error deleting item ${itemDoc.id}:`, error);
        }
      }
      
      
      // HARD DELETE all store requests
      for (const requestDoc of storeRequestsSnapshot.docs) {
        try {
          await deleteDoc(doc(db, 'storeRequests', requestDoc.id));
          console.log(`✅ DELETED store request: ${requestDoc.id}`);
        } catch (error) {
          console.warn(`⚠️ Error deleting store request ${requestDoc.id}:`, error);
        }
      }
      
      // HARD DELETE the store owner from storeOwners collection (if exists)
      try {
        const storeOwnerQuery = query(
          collection(db, 'storeOwners'),
          where('firebaseUid', '==', ownerId)
        );
        const storeOwnerSnapshot = await getDocs(storeOwnerQuery);
        
        for (const ownerDoc of storeOwnerSnapshot.docs) {
          await deleteDoc(doc(db, 'storeOwners', ownerDoc.id));
          console.log(`✅ DELETED store owner: ${ownerDoc.id}`);
        }
        console.log(`👤 DELETED ${storeOwnerSnapshot.size} store owner records`);
      } catch (error) {
        console.warn('⚠️ Error deleting store owner record:', error);
      }
      
      // Remove from local state
      setStoreOwners(prev => prev.filter(owner => owner.ownerId !== ownerId));
      setDeleteOwnerConfirm(null);
      
      // Update stats
      setStats(prev => ({ 
        ...prev, 
        storeOwners: prev.storeOwners - 1,
        totalStores: prev.totalStores - storeRequestsSnapshot.size,
        totalItems: prev.totalItems - uniqueItems.length
      }));
      
      console.log('✅ Store owner and all related data PERMANENTLY DELETED');
      
    } catch (error) {
      console.error('❌ Error deleting store owner:', error);
      alert('Failed to delete store owner. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete store (HARD DELETE)
  const handleDeleteStore = async (storeId: string) => {
    if (!isAppAdmin || !deleteConfirm) return;
    
    try {
      setActionLoading(`delete_${storeId}`);
      
      console.log('🗑️ Starting HARD deletion of store:', storeId);
      
      // HARD DELETE the store request
      await deleteDoc(doc(db, 'storeRequests', storeId));
      console.log(`✅ DELETED store request: ${storeId}`);
      
      // Remove from local state
      setStores(prev => prev.filter(store => store.id !== storeId));
      setDeleteConfirm(null);
      
      // Update stats
      setStats(prev => ({ ...prev, totalStores: prev.totalStores - 1 }));
      
      console.log('✅ Store PERMANENTLY DELETED');
      
    } catch (error) {
      console.error('❌ Error deleting store:', error);
      alert('Failed to delete store. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setActionLoading(requestId + '_approve');
    try {
      await updateDoc(doc(db, 'storeRequests', requestId), {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: user?.uid
      });
      
      // Find the approved request and move it to recent actions
      const approvedRequest = pendingRequests.find(req => req.id === requestId);
      if (approvedRequest) {
        const updatedRequest = { 
          ...approvedRequest, 
          status: 'approved', 
          approvedAt: new Date() 
        };
        setRecentActions(prev => [updatedRequest, ...prev.slice(0, 4)]);
      }
      
      // Refresh the data
      const updatedRequests = pendingRequests.filter(req => req.id !== requestId);
      setPendingRequests(updatedRequests);
      
      // Update stats based on actual count
      setStats(prev => ({ 
        ...prev, 
        pendingRequests: updatedRequests.length
      }));
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(requestId + '_reject');
    try {
      await updateDoc(doc(db, 'storeRequests', requestId), {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: user?.uid
      });
      
      // Find the rejected request and move it to recent actions
      const rejectedRequest = pendingRequests.find(req => req.id === requestId);
      if (rejectedRequest) {
        const updatedRequest = { 
          ...rejectedRequest, 
          status: 'rejected', 
          rejectedAt: new Date() 
        };
        setRecentActions(prev => [updatedRequest, ...prev.slice(0, 4)]);
      }
      
      // Refresh the data
      const updatedRequests = pendingRequests.filter(req => req.id !== requestId);
      setPendingRequests(updatedRequests);
      
      // Update stats based on actual count
      setStats(prev => ({
        ...prev,
        pendingRequests: updatedRequests.length
      }));
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setActionLoading(null);
    }
  };  const isAppAdmin = user?.email === 'admin@finditfast.com';

  // Sidebar navigation items
  const sidebarItems = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      id: 'announcement', 
      label: 'Home Banner', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h10M11 9h7M11 13h10M3 9h4m-4 4h7m-7 4h10" />
        </svg>
      )
    },
    { 
      id: 'requests', 
      label: 'Store Requests', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    { 
      id: 'stores', 
      label: 'Manage Stores', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    { 
      id: 'owners', 
      label: 'Store Owners', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  // Load real stats from Firebase
  useEffect(() => {
    const loadStats = async () => {
      if (!isAppAdmin) return;
      
      try {
        setLoading(true);
        console.log('📊 [ADMIN STATS DEBUG] Loading dashboard statistics...');

        // Get all approved stores (excluding deleted ones) - same logic as loadStores
        console.log('🏪 [ADMIN STATS DEBUG] Counting approved stores from storeRequests...');
        const storesQuery = query(
          collection(db, 'storeRequests'),
          where('status', '==', 'approved')
        );
        const storesSnapshot = await getDocs(storesQuery);
        console.log(`📋 [ADMIN STATS DEBUG] Found ${storesSnapshot.size} approved store requests`);
        
        // Filter out deleted stores client-side
        const totalStores = storesSnapshot.docs.filter(doc => {
          const isDeleted = doc.data().deleted;
          if (isDeleted) {
            console.log(`⚠️ [ADMIN STATS DEBUG] Excluding deleted store from count: ${doc.id}`);
          }
          return !isDeleted;
        }).length;
        console.log(`✅ [ADMIN STATS DEBUG] Total active stores: ${totalStores}`);

        // Get all items
        console.log('📦 [ADMIN STATS DEBUG] Counting total items...');
        const itemsQuery = query(collection(db, 'items'));
        const itemsSnapshot = await getDocs(itemsQuery);
        const totalItems = itemsSnapshot.size;
        console.log(`📦 [ADMIN STATS DEBUG] Total items: ${totalItems}`);

        // Get pending store requests
        console.log('⏳ [ADMIN STATS DEBUG] Counting pending requests...');
        const requestsQuery = query(
          collection(db, 'storeRequests'),
          where('status', '==', 'pending')
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const pendingRequests = requestsSnapshot.size;
        console.log(`⏳ [ADMIN STATS DEBUG] Pending requests: ${pendingRequests}`);

        // Get store owners
        console.log('👥 [ADMIN STATS DEBUG] Counting store owners...');
        const ownersQuery = query(collection(db, 'storeOwners'));
        const ownersSnapshot = await getDocs(ownersQuery);
        const storeOwners = ownersSnapshot.size;
        console.log(`👥 [ADMIN STATS DEBUG] Store owners: ${storeOwners}`);

        console.log('🎯 [ADMIN STATS DEBUG] Final statistics:', {
          totalStores,
          totalItems,
          pendingRequests,
          storeOwners
        });

        setStats({
          totalStores,
          totalItems,
          pendingRequests,
          storeOwners
        });
      } catch (error) {
        console.error('Error loading stats:', error);
        // Fallback to 0 values on error
        setStats({
          totalStores: 0,
          totalItems: 0,
          pendingRequests: 0,
          storeOwners: 0
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Load store owners data
    const loadStoreOwners = async () => {
      if (!isAppAdmin) return;
      
      try {
        setOwnersLoading(true);
        
        // Get all store requests to associate with owners
        const requestsSnapshot = await getDocs(collection(db, 'storeRequests'));
        const requestsData = requestsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            approvedAt: data.approvedAt?.toDate(),
            rejectedAt: data.rejectedAt?.toDate()
          };
        });
        
        setStoreRequests(requestsData);
        
        // Filter pending requests for the requests tab
        const pending = requestsData.filter(request => (request as any).status === 'pending');
        setPendingRequests(pending);
        
        // Get recent actions (approved/rejected requests)
        const recentActions = requestsData
          .filter(request => (request as any).status === 'approved' || (request as any).status === 'rejected')
          .sort((a, b) => {
            const aDate = (a as any).approvedAt || (a as any).rejectedAt || new Date(0);
            const bDate = (b as any).approvedAt || (b as any).rejectedAt || new Date(0);
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          })
          .slice(0, 5); // Show only last 5 actions
        
        setRecentActions(recentActions);
        
        // Group requests by owner and create owner summary
        const ownerMap = new Map();
        
        requestsData.forEach(request => {
          const ownerId = (request as any).ownerId;
          if (!ownerId) return;
          
          if (!ownerMap.has(ownerId)) {
            ownerMap.set(ownerId, {
              ownerId,
              ownerName: (request as any).ownerName || 'Unknown Owner',
              ownerEmail: (request as any).ownerEmail || '',
              requests: [],
              approvedStores: 0,
              pendingRequests: 0,
              rejectedRequests: 0,
              totalRequests: 0
            });
          }
          
          const owner = ownerMap.get(ownerId);
          owner.requests.push(request);
          owner.totalRequests++;
          
          if ((request as any).status === 'approved') {
            owner.approvedStores++;
          } else if ((request as any).status === 'pending') {
            owner.pendingRequests++;
          } else if ((request as any).status === 'rejected') {
            owner.rejectedRequests++;
          }
        });
        
        const ownersArray = Array.from(ownerMap.values()).sort((a, b) => 
          b.totalRequests - a.totalRequests
        );
        
        setStoreOwners(ownersArray);
      } catch (error) {
        console.error('Error loading store owners:', error);
      } finally {
        setOwnersLoading(false);
      }
    };

    loadStoreOwners();

    // Load stores when stores tab is selected
    if (activeTab === 'stores') {
      loadStores();
    }

    // Set up real-time listener for pending requests
    if (isAppAdmin) {
      const unsubscribeRequests = onSnapshot(
        query(collection(db, 'storeRequests'), where('status', '==', 'pending')),
        (snapshot) => {
          setStats(prev => ({ ...prev, pendingRequests: snapshot.size }));
        },
        (error) => {
          console.error('Error in real-time listener:', error);
        }
      );

      return () => {
        unsubscribeRequests();
      };
    }
  }, [isAppAdmin]);

  // Load stores when stores tab is active
  useEffect(() => {
    if (activeTab === 'stores' && isAppAdmin) {
      loadStores();
    } else if (activeTab === 'analytics' && isAppAdmin) {
      loadAnalyticsData();
    }
  }, [activeTab, isAppAdmin]);

  // Simulate loading stats
  useEffect(() => {
    // In a real app, load actual stats from Firebase
    setStats({
      totalStores: 12,
      totalItems: 847,
      pendingRequests: 3,
      storeOwners: 8
    });
  }, []);

  // Load existing appConfig public doc for banner text
  useEffect(() => {
    if (!isAppAdmin) return;
    
    // Set up real-time listener for appConfig changes
    const configRef = doc(db, 'appConfig', 'public');
    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log('📢 AppConfig loaded:', data);
            if (typeof data.homeBannerText === 'string' && data.homeBannerText.trim()) {
              setHomeBannerText(data.homeBannerText.trim());
            } else {
              setHomeBannerText('');
            }
          } else {
            console.log('📢 AppConfig document does not exist yet');
            setHomeBannerText('');
          }
        } catch (error) {
          console.error('❌ Error loading appConfig:', error);
          setHomeBannerText('');
        }
      },
      (error) => {
        console.error('❌ Error in appConfig listener:', error);
        setHomeBannerText('');
      }
    );

    return () => unsubscribe();
  }, [isAppAdmin]);

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAppAdmin) return;
    
    if (!homeBannerText.trim()) {
      setBannerStatus({ success: false, message: 'Please enter some text for the banner.' });
      return;
    }
    
    try {
      setSavingBanner(true);
      setBannerStatus(null);
      console.log('💾 Saving banner text:', homeBannerText);
      
      const ref = doc(db, 'appConfig', 'public');
      await setDoc(ref, { 
        homeBannerText: homeBannerText.trim(),
        updatedAt: new Date(),
        updatedBy: user?.uid || 'admin'
      }, { merge: true });
      
      console.log('✅ Banner text saved successfully');
      setBannerStatus({ success: true, message: 'Banner text saved.' });
      
      // Clear status after 3 seconds
      setTimeout(() => setBannerStatus(null), 3000);
      
    } catch (err) {
      console.error('❌ Error saving banner text:', err);
      setBannerStatus({ success: false, message: 'Failed to save banner text. Try again.' });
      
      // Clear error status after 5 seconds
      setTimeout(() => setBannerStatus(null), 5000);
    } finally {
      setSavingBanner(false);
    }
  };

  // Only allow access to actual app admin
  if (!isAppAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-800 mb-4">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Only app administrators can access this dashboard.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/owner/dashboard')}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Go to Store Owner Dashboard
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Close the request details modal
  const handleCloseModal = () => {
    setSelectedRequest(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedRequest.storeName} - Request Details
                </h3>
                <button 
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Store Information */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Store Information</h4>
                    <p className="text-base font-medium text-gray-900">{selectedRequest.storeName}</p>
                    <p className="text-sm text-gray-700">{selectedRequest.storeDescription}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Store Address</h4>
                    <p className="text-base text-gray-900">{selectedRequest.storeAddress}</p>
                    {selectedRequest.coordinates && (
                      <p className="text-xs text-gray-500">
                        Coordinates: {selectedRequest.coordinates.lat?.toFixed(6)}, {selectedRequest.coordinates.lng?.toFixed(6)}
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Submission Date</h4>
                    <p className="text-base text-gray-900">{new Date(selectedRequest.submittedAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Status: <span className="font-medium text-yellow-600">Pending Review</span></p>
                  </div>
                </div>
                
                {/* Owner Information */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Owner Information</h4>
                    <p className="text-base font-medium text-gray-900">{selectedRequest.ownerName}</p>
                    <p className="text-sm text-gray-700">{selectedRequest.ownerEmail}</p>
                    <p className="text-sm text-gray-700">{selectedRequest.ownerPhone || "No phone provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Owner ID</h4>
                    <p className="text-xs text-gray-700 break-all">{selectedRequest.ownerId}</p>
                  </div>
                  
                  {selectedRequest.ownerNotes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Additional Notes</h4>
                      <p className="text-sm text-gray-700">{selectedRequest.ownerNotes}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Uploaded Documents */}
              {(selectedRequest as any).documents && (selectedRequest as any).documents.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Uploaded Documents</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedRequest as any).documents.map((document: any, index: number) => (
                      <div key={index} className="flex flex-col p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="flex items-center mb-2">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                            {document.name.toLowerCase().endsWith('.pdf') ? (
                              <svg className="w-7 h-7 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                                <path d="M3 8a2 2 0 012-2h2.5a1 1 0 010 2H5v4a1 1 0 01-2 0V8z" />
                              </svg>
                            ) : document.name.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? (
                              <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                              </svg>
                            ) : document.name.toLowerCase().match(/\.(doc|docx)$/) ? (
                              <svg className="w-7 h-7 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
                            <p className="text-xs text-gray-500">{(document.size / 1024).toFixed(1)} KB • Uploaded with request</p>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadBase64Document(document)}
                          className="mt-2 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Document
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button 
                onClick={handleCloseModal} 
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  handleApproveRequest(selectedRequest.id);
                  handleCloseModal();
                }}
                disabled={!!actionLoading}
                className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {actionLoading === `${selectedRequest.id}_approve` ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Approving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve Request
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  handleRejectRequest(selectedRequest.id);
                  handleCloseModal();
                }}
                disabled={!!actionLoading}
                className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {actionLoading === `${selectedRequest.id}_reject` ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Store Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Delete Store</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  Are you sure you want to <span className="font-bold text-red-600">permanently delete</span> <span className="font-medium">"{deleteConfirm.storeName}"</span>? 
                </p>
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-bold">
                    🔥 WARNING: This will permanently remove the store from the database and cannot be undone!
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteStore(deleteConfirm.storeId)}
                  disabled={!!actionLoading}
                  className={`px-4 py-2 rounded-lg text-white font-medium ${
                    actionLoading === `delete_${deleteConfirm.storeId}`
                      ? 'bg-red-400 cursor-wait'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading === `delete_${deleteConfirm.storeId}` ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </div>
                  ) : (
                    'Permanently Delete Store'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Store Owner Confirmation Modal */}
      {deleteOwnerConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-medium text-gray-900">Delete Store Owner</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6 space-y-3">
                <p className="text-sm text-gray-700">
                  Are you sure you want to <span className="font-bold text-red-600">permanently delete</span> <span className="font-medium">"{deleteOwnerConfirm.ownerName}"</span>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-medium mb-2">⚠️ This will PERMANENTLY remove:</p>
                  <ul className="text-sm text-red-700 space-y-1 ml-4">
                    <li>• The store owner account ({deleteOwnerConfirm.ownerEmail})</li>
                    <li>• All stores owned by this user</li>
                    <li>• All store requests submitted by this user</li>
                    <li>• All store items in their stores</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-bold">
                    🔥 WARNING: This is a HARD DELETE operation. The data cannot be recovered!
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteOwnerConfirm(null)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteStoreOwner(deleteOwnerConfirm.ownerId)}
                  disabled={!!actionLoading}
                  className={`px-4 py-2 rounded-lg text-white font-medium ${
                    actionLoading === `delete_owner_${deleteOwnerConfirm.ownerId}`
                      ? 'bg-red-400 cursor-wait'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading === `delete_owner_${deleteOwnerConfirm.ownerId}` ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Permanently Deleting...
                    </div>
                  ) : (
                    'Permanently Delete Owner'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-900">Admin Panel</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center px-4 py-3 text-left rounded-xl font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Profile Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">A</span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">App Admin</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full bg-gray-800 text-white py-2 px-4 rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {sidebarItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Navigation Arrows */}
              <div className="hidden md:flex items-center space-x-2">
                <button
                  onClick={() => {
                    const currentIndex = sidebarItems.findIndex(item => item.id === activeTab);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : sidebarItems.length - 1;
                    setActiveTab(sidebarItems[prevIndex].id);
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                  title="Previous section"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const currentIndex = sidebarItems.findIndex(item => item.id === activeTab);
                    const nextIndex = currentIndex < sidebarItems.length - 1 ? currentIndex + 1 : 0;
                    setActiveTab(sidebarItems[nextIndex].id);
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                  title="Next section"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => navigate('/')}
                className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                View App
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="transition-all duration-300 ease-in-out transform">
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {loading ? (
                            <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                          ) : (
                            stats.totalStores
                          )}
                        </p>
                        <p className="text-sm text-gray-600">Total Stores</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {loading ? (
                            <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                          ) : (
                            stats.totalItems
                          )}
                        </p>
                        <p className="text-sm text-gray-600">Total Items</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {loading ? (
                            <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                          ) : (
                            <span className={stats.pendingRequests > 0 ? 'text-yellow-600' : ''}>
                              {stats.pendingRequests}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">Pending Requests</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {loading ? (
                            <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                          ) : (
                            stats.storeOwners
                          )}
                        </p>
                        <p className="text-sm text-gray-600">Store Owners</p>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">Review Requests</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('stores')}
                    className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">Manage Stores</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">View Analytics</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-6">
              {/* Pending Requests */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Pending Store Requests</h2>
                    <p className="text-gray-600">Review and approve new store registrations</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {stats.pendingRequests} Pending
                    </span>
                  </div>
                </div>

                {/* Real Pending Requests */}
                <div className="space-y-4">
                  {pendingRequests.length > 0 ? (
                    pendingRequests.map(request => (
                      <div key={request.id} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{(request as any).storeName}</h3>
                                <p className="text-sm text-gray-600">by {(request as any).ownerName}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-500">Contact Information</p>
                                <p className="text-sm text-gray-900">{(request as any).ownerEmail}</p>
                                <p className="text-sm text-gray-900">{(request as any).ownerPhone || 'No phone provided'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Location</p>
                                <p className="text-sm text-gray-900">{(request as any).storeAddress}</p>
                                {(request as any).coordinates && (
                                  <p className="text-xs text-gray-500">
                                    {(request as any).coordinates.lat?.toFixed(4)}, {(request as any).coordinates.lng?.toFixed(4)}
                                  </p>
                                )}
                              </div>
                            </div>

                            {(request as any).uploadedFiles && (request as any).uploadedFiles.length > 0 && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-2">Submitted Documents</p>
                                <div className="flex flex-wrap gap-2">
                                  {(request as any).uploadedFiles.map((file: any, index: number) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                      📄 {file.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-xs text-gray-500">
                              Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="ml-6 flex flex-col space-y-2">
                            <button 
                              onClick={() => handleApproveRequest(request.id)}
                              disabled={!!actionLoading}
                              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                actionLoading === `${request.id}_approve`
                                  ? 'bg-green-400 text-white cursor-wait'
                                  : actionLoading
                                  ? 'bg-green-300 text-white cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {actionLoading === `${request.id}_approve` ? 'Approving...' : 'Approve'}
                            </button>
                            <button 
                              onClick={() => handleRejectRequest(request.id)}
                              disabled={!!actionLoading}
                              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                actionLoading === `${request.id}_reject`
                                  ? 'bg-red-400 text-white cursor-wait'
                                  : actionLoading
                                  ? 'bg-red-300 text-white cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              {actionLoading === `${request.id}_reject` ? 'Rejecting...' : 'Reject'}
                            </button>
                            <button 
                              onClick={() => setSelectedRequest(request)}
                              disabled={!!actionLoading}
                              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                actionLoading
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-lg mb-2">No pending requests</div>
                      <div className="text-sm">All store requests have been processed</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Actions */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Actions</h3>
                <div className="space-y-3">
                  {recentActions.length > 0 ? (
                    recentActions.map((request, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${(request as any).status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {(request as any).status === 'approved' ? 'Approved' : 'Rejected'} "{(request as any).storeName}"
                            </p>
                            {(request as any).rejectionReason && (
                              <p className="text-xs text-gray-500">Reason: {(request as any).rejectionReason}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {new Date((request as any).approvedAt || (request as any).rejectedAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">by Admin</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No recent actions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stores' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Store Management</h2>
                    <p className="text-gray-600">Manage all accepted stores and their details</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={loadStores}
                      disabled={storesLoading}
                      className="flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      <svg className={`w-4 h-4 mr-2 ${storesLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {stores.length} Stores
                    </span>
                  </div>
                </div>
              </div>

              {/* Stores List */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                {storesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading stores...</span>
                  </div>
                ) : stores.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Stores Found</h4>
                    <p className="text-gray-600">No stores have been created yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stores.map(store => (
                      <div key={store.id} className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0">
                          <div className="flex-1 lg:min-w-0">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-gray-900 truncate">{store.name}</h3>
                                <p className="text-sm text-gray-600 truncate">Store ID: {store.id}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Address</p>
                                <p className="text-sm text-gray-900">{store.address}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Owner ID</p>
                                <p className="text-xs text-gray-700 break-all">{store.ownerId}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Created</p>
                                <p className="text-sm text-gray-900">{store.createdAt.toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Floorplan</p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  store.floorplanUrl 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {store.floorplanUrl ? '✅ Uploaded' : '📋 Missing'}
                                </span>
                              </div>
                            </div>

                            {store.location && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-1">Coordinates</p>
                                <p className="text-sm text-gray-700">
                                  {store.location.latitude?.toFixed(6)}, {store.location.longitude?.toFixed(6)}
                                </p>
                              </div>
                            )}

                            {store.requestInfo && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-700">
                                  <span className="font-medium">Original Request:</span> Submitted on {' '}
                                  {store.requestInfo.submittedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Action buttons - responsive layout */}
                          <div className="lg:ml-6 flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 flex-shrink-0">
                            {store.floorplanUrl && (
                              <a
                                href={store.floorplanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                              >
                                <svg className="w-4 h-4 mr-1 lg:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span className="hidden sm:inline">View Floorplan</span>
                                <span className="sm:hidden">View</span>
                              </a>
                            )}
                            
                            <button
                              onClick={() => setDeleteConfirm({ storeId: store.id, storeName: store.name })}
                              disabled={!!actionLoading}
                              className={`flex items-center justify-center px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
                                actionLoading
                                  ? 'bg-red-300 text-white cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              <svg className="w-4 h-4 mr-1 lg:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className="hidden sm:inline">Delete Store</span>
                              <span className="sm:hidden">Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'owners' && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Store Owners</h2>
                  <p className="text-gray-600">Manage store owners and their related data</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {storeOwners.length} Owners
                </span>
              </div>
              {ownersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : storeOwners.length > 0 ? (
                <div className="space-y-4">
                  {storeOwners.map((owner) => (
                    <div key={owner.ownerId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{owner.ownerName}</h3>
                          <p className="text-gray-600">{owner.ownerEmail}</p>
                          <p className="text-xs text-gray-400 mt-1">ID: {owner.ownerId}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Total Requests</div>
                            <div className="text-xl font-bold text-gray-900">{owner.totalRequests}</div>
                          </div>
                          <button
                            onClick={() => setDeleteOwnerConfirm({ 
                              ownerId: owner.ownerId, 
                              ownerName: owner.ownerName, 
                              ownerEmail: owner.ownerEmail 
                            })}
                            disabled={!!actionLoading}
                            className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                              actionLoading
                                ? 'bg-red-300 text-white cursor-not-allowed'
                                : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                            title="Delete store owner and all related stores"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Owner
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center p-2 bg-green-50 rounded-lg">
                          <div className="text-lg font-semibold text-green-700">{owner.approvedStores}</div>
                          <div className="text-sm text-green-600">Approved</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded-lg">
                          <div className="text-lg font-semibold text-yellow-700">{owner.pendingRequests}</div>
                          <div className="text-sm text-yellow-600">Pending</div>
                        </div>
                        <div className="text-center p-2 bg-red-50 rounded-lg">
                          <div className="text-lg font-semibold text-red-700">{owner.rejectedRequests}</div>
                          <div className="text-sm text-red-600">Rejected</div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                          Latest Request: {owner.requests.length > 0 ? 
                            new Date(Math.max(...owner.requests.map((r: any) => new Date(r.submittedAt).getTime()))).toLocaleDateString() :
                            'No requests'
                          }
                        </div>
                        {owner.approvedStores > 0 && (
                          <div className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                            🔥 PERMANENT DELETE: Will remove {owner.approvedStores} store{owner.approvedStores !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-lg mb-2">No store owners found</div>
                  <div className="text-sm">Store owners will appear here when they submit store requests</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Analytics Header */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h2>
                  <button
                    onClick={loadAnalyticsData}
                    disabled={analyticsLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
                  >
                    <svg className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh Data</span>
                  </button>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-blue-600 text-sm font-medium">Avg Approval Time</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {analyticsData.timeMetrics.avgApprovalTime}d
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {analyticsData.timeMetrics.avgApprovalTime > 0 ? 'Per request' : 'No data yet'}
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-green-600 text-sm font-medium">Active Users</div>
                    <div className="text-2xl font-bold text-green-900">
                      {analyticsData.timeMetrics.activeUsers}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Unique users
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-purple-600 text-sm font-medium">Total Searches</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {analyticsData.timeMetrics.totalSearches.toLocaleString()}
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      All time searches
                    </div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="text-orange-600 text-sm font-medium">Response Time</div>
                    <div className="text-2xl font-bold text-orange-900">
                      {analyticsData.timeMetrics.avgResponseTime}d
                    </div>
                    <div className="text-xs text-orange-600 mt-1">
                      {analyticsData.timeMetrics.avgResponseTime > 0 ? 'Average response' : 'No data yet'}
                    </div>
                  </div>
                </div>

                {/* Additional Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="text-indigo-600 text-sm font-medium">Total Items</div>
                    <div className="text-xl font-bold text-indigo-900">
                      {stats.totalItems.toLocaleString()}
                    </div>
                    <div className="text-xs text-indigo-600 mt-1">
                      Across all stores
                    </div>
                  </div>
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                    <div className="text-pink-600 text-sm font-medium">Store Owners</div>
                    <div className="text-xl font-bold text-pink-900">
                      {stats.storeOwners}
                    </div>
                    <div className="text-xs text-pink-600 mt-1">
                      Registered owners
                    </div>
                  </div>
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                    <div className="text-cyan-600 text-sm font-medium">Approval Rate</div>
                    <div className="text-xl font-bold text-cyan-900">
                      {(() => {
                        const total = analyticsData.requestTrends.reduce((sum, trend) => sum + trend.value, 0);
                        const approved = analyticsData.requestTrends.find(trend => trend.name === 'Approved')?.value || 0;
                        const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
                        return `${rate}%`;
                      })()}
                    </div>
                    <div className="text-xs text-cyan-600 mt-1">
                      Store requests
                    </div>
                  </div>
                </div>
              </div>

              {/* Store Growth Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Store Growth Over Time</h3>
                  <div className="text-sm text-gray-500">
                    Last 6 months
                  </div>
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                  </div>
                ) : analyticsData.storeGrowth.length > 0 ? (
                  <div className="h-64 overflow-x-auto">
                    <div className="flex items-end space-x-4 h-full min-w-[600px] px-4">
                      {analyticsData.storeGrowth.map((month, index) => {
                        const maxTotal = Math.max(...analyticsData.storeGrowth.map(m => m.total));
                        const heightMultiplier = maxTotal > 0 ? 200 / maxTotal : 0;
                        
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div className="flex flex-col items-center space-y-1 mb-3" style={{ height: '200px' }}>
                              <div className="flex flex-col justify-end h-full">
                                {/* Approved bars */}
                                {month.approved > 0 && (
                                  <div 
                                    className="w-12 bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600"
                                    style={{ height: `${Math.max(month.approved * heightMultiplier, 4)}px` }}
                                    title={`Approved: ${month.approved}`}
                                  ></div>
                                )}
                                {/* Pending bars */}
                                {month.pending > 0 && (
                                  <div 
                                    className="w-12 bg-yellow-500 transition-all duration-300 hover:bg-yellow-600"
                                    style={{ height: `${Math.max(month.pending * heightMultiplier, 4)}px` }}
                                    title={`Pending: ${month.pending}`}
                                  ></div>
                                )}
                                {/* Rejected bars */}
                                {month.rejected > 0 && (
                                  <div 
                                    className="w-12 bg-red-500 rounded-b transition-all duration-300 hover:bg-red-600"
                                    style={{ height: `${Math.max(month.rejected * heightMultiplier, 4)}px` }}
                                    title={`Rejected: ${month.rejected}`}
                                  ></div>
                                )}
                                {month.total === 0 && (
                                  <div className="w-12 h-1 bg-gray-200 rounded"></div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600 text-center transform -rotate-45 origin-center w-16">
                              {month.month}
                            </div>
                            <div className="text-sm font-medium text-gray-900 mt-2">
                              {month.total}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="text-sm text-gray-600">Approved</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span className="text-sm text-gray-600">Pending</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-sm text-gray-600">Rejected</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p>No store growth data available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Request Status Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Request Status Distribution</h3>
                    <div className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                      All Time
                    </div>
                  </div>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                    </div>
                  ) : analyticsData.requestTrends.some(trend => trend.value > 0) ? (
                    <div className="flex flex-col md:flex-row items-center justify-center h-48">
                      <div className="relative w-36 h-36">
                        {/* Enhanced donut chart with hover effects */}
                        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="2.5"
                          />
                          {analyticsData.requestTrends.map((item, index) => {
                            const total = analyticsData.requestTrends.reduce((sum, trend) => sum + trend.value, 0);
                            const percentage = total > 0 ? (item.value / total) * 100 : 0;
                            const strokeDasharray = `${percentage} ${100 - percentage}`;
                            const rotation = analyticsData.requestTrends.slice(0, index).reduce((sum, trend) => 
                              sum + (trend.value / total) * 100, 0
                            );
                            
                            return (
                              <path
                                key={index}
                                d="M18 2.0845
                                  a 15.9155 15.9155 0 0 1 0 31.831
                                  a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={item.color}
                                strokeWidth="3"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={-rotation}
                                className="transition-all duration-500 hover:opacity-90"
                                style={{
                                  filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))"
                                }}
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-xl font-bold text-gray-900">
                              {analyticsData.requestTrends.reduce((sum, trend) => sum + trend.value, 0)}
                            </div>
                            <div className="text-xs text-gray-600">Total</div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-6 space-y-3 mt-4 md:mt-0">
                        {analyticsData.requestTrends.map((item, index) => {
                          const total = analyticsData.requestTrends.reduce((sum, trend) => sum + trend.value, 0);
                          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                          
                          return (
                            <div key={index} className="flex items-center space-x-2">
                              <div 
                                className="w-4 h-4 rounded-full shadow-sm" 
                                style={{ backgroundColor: item.color }}
                              ></div>
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <div className="flex items-center">
                                <span className="text-sm font-bold text-gray-900">{item.value}</span>
                                <span className="text-xs text-gray-500 ml-1">({percentage}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>No request data available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Store Distribution */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Store Distribution by Location</h3>
                    <div className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                      Top {analyticsData.storeDistribution.length}
                    </div>
                  </div>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                    </div>
                  ) : analyticsData.storeDistribution.length > 0 ? (
                    <div className="space-y-4 h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {analyticsData.storeDistribution.map((location: {location: string, count: number}, index) => {
                        const maxCount = Math.max(...analyticsData.storeDistribution.map((l: {count: number}) => l.count));
                        const percentage = maxCount > 0 ? (location.count / maxCount) * 100 : 0;
                        
                        return (
                          <div key={index} className="flex items-center space-x-3 group">
                            <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium text-white ${index < 3 ? 'bg-blue-600' : 'bg-blue-400'}`}>
                              {index + 1}
                            </div>
                            <div className="w-24 text-sm font-medium text-gray-800 truncate">
                              {location.location}
                            </div>
                            <div className="flex-1">
                              <div className="bg-gray-100 rounded-full h-2.5">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-500 shadow-sm group-hover:from-blue-600 group-hover:to-blue-700"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-10 text-right text-sm font-semibold text-gray-900">
                              {location.count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No location data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom scrollbar styles */}
              <style dangerouslySetInnerHTML={{
                __html: `
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #d1d5db;
                    border-radius: 10px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                  }
                `
              }} />

              {/* User Activity and Popular Stores */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Activity */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Most Active Store Owners</h3>
                    <div className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full font-medium">
                      Top {analyticsData.userActivity.length}
                    </div>
                  </div>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                    </div>
                  ) : analyticsData.userActivity.length > 0 ? (
                    <div className="space-y-3 h-48 overflow-y-auto custom-scrollbar pr-2">
                      {analyticsData.userActivity.map((user: {owner: string, stores: number}, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 rounded-lg px-2 transition-all duration-200">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                              {user.owner.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-32">
                                {user.owner.split('@')[0]}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center">
                                <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {user.stores} store{user.stores !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="bg-purple-100 text-purple-800 text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center">{user.stores}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No user activity data available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Popular Stores */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Popular Stores</h3>
                    <div className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                      By Item Count
                    </div>
                  </div>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                    </div>
                  ) : analyticsData.popularStores.length > 0 ? (
                    <div className="space-y-3 h-48 overflow-y-auto custom-scrollbar pr-2">
                      {analyticsData.popularStores.map((store, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 rounded-lg px-2 transition-all duration-200">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                              {store.storeName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-32">
                                {store.storeName}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center space-x-2">
                                <span className="flex items-center">
                                  <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                  </svg>
                                  {store.items}
                                </span>
                                <span className="flex items-center">
                                  <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  {store.views}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                            Recent
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-gray-500">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <p>No store activity data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Trends and Forecasting */}
              <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Growth Trends & Projections</h3>
                  <div className="flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Based on current approval rate
                  </div>
                </div>
                
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Current Period */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-sm font-medium text-gray-500 mb-1">Current Quarter</div>
                      <div className="flex items-end">
                        <div className="text-2xl font-bold text-gray-900">
                          {analyticsData.storeGrowth.slice(-3).reduce((sum, month: {approved: number}) => sum + month.approved, 0)}
                        </div>
                        <div className="text-sm text-gray-500 ml-2 mb-1">stores</div>
                      </div>
                      
                      <div className="mt-3 flex items-center">
                        {(() => {
                          // Calculate quarter-over-quarter growth
                          const currentQuarter = analyticsData.storeGrowth.slice(-3).reduce((sum, month: {approved: number}) => sum + month.approved, 0);
                          const previousQuarter = analyticsData.storeGrowth.slice(-6, -3).reduce((sum, month: {approved: number}) => sum + month.approved, 0);
                          const growth = previousQuarter > 0 
                            ? ((currentQuarter - previousQuarter) / previousQuarter) * 100 
                            : currentQuarter > 0 ? 100 : 0;
                          
                          if (growth > 0) {
                            return (
                              <>
                                <div className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                  +{Math.round(growth)}%
                                </div>
                                <div className="text-green-600 ml-2">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                  </svg>
                                </div>
                              </>
                            );
                          } else if (growth < 0) {
                            return (
                              <>
                                <div className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                  {Math.round(growth)}%
                                </div>
                                <div className="text-red-600 ml-2">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                                  </svg>
                                </div>
                              </>
                            );
                          } else {
                            return (
                              <div className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded-full">
                                Stable
                              </div>
                            );
                          }
                        })()}
                        <div className="text-xs text-gray-500 ml-2">vs last quarter</div>
                      </div>
                    </div>
                    
                    {/* Projected Growth */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-sm font-medium text-blue-600 mb-1">Projected Next Quarter</div>
                      {(() => {
                        // Simple projection based on growth rate
                        const recentMonths = analyticsData.storeGrowth.slice(-3);
                        const totalRecent = recentMonths.reduce((sum, month: {approved: number}) => sum + month.approved, 0);
                        const avgMonthly = totalRecent / Math.max(recentMonths.length, 1);
                        const projected = Math.round(avgMonthly * 3 * 1.1); // 10% growth assumption
                        
                        return (
                          <>
                            <div className="flex items-end">
                              <div className="text-2xl font-bold text-blue-900">{projected}</div>
                              <div className="text-sm text-blue-600 ml-2 mb-1">stores</div>
                            </div>
                            
                            <div className="mt-3 flex items-center">
                              <div className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                Est. +{totalRecent > 0 ? Math.round(((projected - totalRecent) / totalRecent) * 100) : 0}%
                              </div>
                              <div className="text-xs text-blue-600 ml-2">growth trend</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    
                    {/* Annual Forecast */}
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="text-sm font-medium text-purple-600 mb-1">Annual Forecast</div>
                      {(() => {
                        // Calculate annual growth
                        const totalApproved = analyticsData.storeGrowth.reduce((sum, month: {approved: number}) => sum + month.approved, 0);
                        const monthsWithData = analyticsData.storeGrowth.filter(month => month.total > 0).length;
                        const avgMonthlyGrowth = monthsWithData > 0 ? totalApproved / monthsWithData : 0;
                        const annualForecast = Math.round(avgMonthlyGrowth * 12);
                        
                        return (
                          <>
                            <div className="flex items-end">
                              <div className="text-2xl font-bold text-purple-900">{annualForecast}</div>
                              <div className="text-sm text-purple-600 ml-2 mb-1">stores/year</div>
                            </div>
                            
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                                  {avgMonthlyGrowth.toFixed(1)}/mo
                                </div>
                                <div className="text-xs text-purple-600 ml-2">avg</div>
                              </div>
                              
                              <div className="text-xs text-purple-600">
                                Based on {monthsWithData} months data
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'announcement' && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Home Banner</h2>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <form onSubmit={handleSaveBanner} className="space-y-3">
                  <label className="block text-sm text-gray-700" htmlFor="home-banner-text-ann">
                    Text shown on the home page banner
                  </label>
                  <textarea
                    id="home-banner-text-ann"
                    value={homeBannerText}
                    onChange={(e) => setHomeBannerText(e.target.value)}
                    placeholder="Enter announcement text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">All users will see this when no search is active.</p>
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={savingBanner}
                        className={`px-4 py-2 text-white rounded-lg font-medium ${savingBanner ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {savingBanner ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                  {bannerStatus && (
                    <div className={`p-2 rounded text-sm ${bannerStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {bannerStatus.message}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
              
              {/* User Account Settings */}
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Account Settings</h3>
                
                {/* Email Update Form */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Update Email Address</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Changing your email requires verification. A verification link will be sent to your new email address.
                  </p>
                  <form onSubmit={handleUpdateEmail} className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1" htmlFor="current-email">
                        Current Email
                      </label>
                      <input
                        type="text"
                        id="current-email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1" htmlFor="new-email">
                        New Email
                      </label>
                      <input
                        type="email"
                        id="new-email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1" htmlFor="current-password-email">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current-password-email"
                        value={emailCurrentPassword}
                        onChange={(e) => setEmailCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter password to confirm change"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={emailUpdateLoading || !newEmail || !emailCurrentPassword}
                      className={`w-full px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center ${
                        emailUpdateLoading || !newEmail || !emailCurrentPassword
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {emailUpdateLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </>
                      ) : (
                        'Update Email'
                      )}
                    </button>
                    
                    {updateStatus && updateStatus.type === 'email' && (
                      <div className={`p-3 rounded-lg text-sm ${
                        updateStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {updateStatus.message}
                      </div>
                    )}
                  </form>
                </div>
                
                {/* Password Update Form */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-2">Change Password</h4>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1" htmlFor="current-password">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current-password"
                        value={passwordCurrentPassword}
                        onChange={(e) => setPasswordCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1" htmlFor="new-password">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1" htmlFor="confirm-password">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      disabled={passwordUpdateLoading || !newPassword || !confirmPassword || !passwordCurrentPassword || newPassword !== confirmPassword}
                      className={`w-full px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center ${
                        passwordUpdateLoading || !newPassword || !confirmPassword || !passwordCurrentPassword || newPassword !== confirmPassword
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {passwordUpdateLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </button>
                    
                    {updateStatus && updateStatus.type === 'password' && (
                      <div className={`p-3 rounded-lg text-sm ${
                        updateStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {updateStatus.message}
                      </div>
                    )}
                  </form>
                </div>
              </div>

            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
};
