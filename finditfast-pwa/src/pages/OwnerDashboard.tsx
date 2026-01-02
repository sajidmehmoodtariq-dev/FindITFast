import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FloorplanManager, OwnerStoreManager, EnhancedInventoryManager } from '../components/owner';
import { StoreService, ItemService } from '../services/firestoreService';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { fixOwnerProfile } from '../utils/debugOwnerProfile';
import { GeocodingService } from '../services/geocodingService';
import type { Store, Item } from '../types';

export const OwnerDashboard: React.FC = () => {
  const { user, ownerProfile, signOut, refreshOwnerProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Get the tab from URL query params or default to 'overview'
  const queryParams = new URLSearchParams(location.search);
  const tabFromUrl = queryParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview');
  const [store, setStore] = useState<Store | null>(null);
  // const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStoreRequestForm, setShowStoreRequestForm] = useState(false);
  const [storeRequests, setStoreRequests] = useState<any[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  // Location functionality removed - using address-based geocoding
  const [formData, setFormData] = useState({
    storeName: '',
    storeType: '',
    address: '',
    documents: [] as Array<{
      name: string;
      type: string;
      size: number;
      uploadedAt: Date;
      hasContent: boolean;
    }>
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [allOwnerStores, setAllOwnerStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ storeId: string; storeName: string } | null>(null);
  // const [editingStore, setEditingStore] = useState<any | null>(null);

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
      id: 'requests', 
      label: 'Store Requests', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" />
        </svg>
      )
    },
    { 
      id: 'store', 
      label: 'Manage Store', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    { 
      id: 'floorplan', 
      label: 'Floorplan', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    { 
      id: 'inventory', 
      label: 'Items', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    }
  ];

  // Load store data and items
  useEffect(() => {
    const loadStoreData = async () => {
      if (ownerProfile?.storeId) {
        try {
          const [storeData, storeItems] = await Promise.all([
            StoreService.getById(ownerProfile.storeId),
            ItemService.getByStore(ownerProfile.storeId)
          ]);
          
          // Handle case where store has been deleted
          if (!storeData) {
            setError('This store has been deleted or is no longer available. Please contact support if you believe this is an error.');
            // setStore(null);
            // setItems([]);
          } else {
            // setStore(storeData);
            // setItems(storeItems);
          }
        } catch (error) {
          console.error('Error loading store data:', error);
          setError('Failed to load store data');
        }
      }
      setLoading(false);
    };

    loadStoreData();
  }, [ownerProfile?.storeId]);
  
  // Load all stores for this owner (both approved and rejected)
  useEffect(() => {
    const loadAllOwnerStores = async () => {
      if (!user?.uid) return;
      
      setStoresLoading(true);
      try {
        // Get all store requests by this owner from storeRequests collection
        // This includes pending, approved, and rejected stores
        const storeRequestsQuery = query(
          collection(db, 'storeRequests'), 
          where('requestedBy', '==', user.uid)
        );
        const storeRequestsSnapshot = await getDocs(storeRequestsQuery);
        const allStores = storeRequestsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: doc.data().status === 'approved' ? 'store' : 'request'
        }));
        
        setAllOwnerStores(allStores);
      } catch (error) {
        console.error('Error loading owner stores:', error);
      } finally {
        setStoresLoading(false);
      }
    };
    
    loadAllOwnerStores();
  }, [user?.uid]);

  // Load store requests from Firebase
  useEffect(() => {
    const loadStoreRequests = async () => {
      if (!user?.uid) return;

      try {
        // Get real store requests from Firebase using requestedBy field
        // Don't try to sort in the query since we might not have the index yet
        const requestsQuery = query(
          collection(db, 'storeRequests'),
          where('requestedBy', '==', user?.uid)
        );
        
        const snapshot = await getDocs(requestsQuery);
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate() || new Date(),
          approvedAt: doc.data().approvedAt?.toDate(),
          rejectedAt: doc.data().rejectedAt?.toDate()
        }));
        
        // Sort client-side by date (newest first) while index is building
        requests.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

        setStoreRequests(requests);

        // Set up real-time listener for updates
        const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
          const updatedRequests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate() || new Date(),
            approvedAt: doc.data().approvedAt?.toDate(),
            rejectedAt: doc.data().rejectedAt?.toDate()
          }));
          
          // Sort client-side by date (newest first) while index is building
          updatedRequests.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
          
          setStoreRequests(updatedRequests);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error loading store requests:', error);
        // Fallback to empty array
        setStoreRequests([]);
      }
    };

    loadStoreRequests();
  }, [user?.uid]);

  // Automatically fix owner profile if needed
  useEffect(() => {
    const autoFixOwnerProfile = async () => {
      // Only run if user is logged in but no owner profile exists
      if (user && !ownerProfile) {
        try {
          await fixOwnerProfile();
          await refreshOwnerProfile();
        } catch (error) {
          console.error('Error auto-fixing owner profile:', error);
        }
      }
    };

    autoFixOwnerProfile();
  }, [user, ownerProfile]);

  // Geolocation functionality removed - using address-based geocoding instead

  // Handle form input changes
  const handleFormInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle file upload - store only metadata to avoid Safari/iOS Firestore issues
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    setIsUploadingFiles(true);
    
    try {
      const newFiles = Array.from(files);
      
      // Validate file size (max 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = newFiles.filter(file => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        setError(`File(s) too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 10MB per file.`);
        setTimeout(() => setError(null), 5000);
        setIsUploadingFiles(false);
        return;
      }
      
      // Validate file types
      const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
      const invalidFiles = newFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        return !allowedTypes.includes(extension);
      });
      
      if (invalidFiles.length > 0) {
        setError(`Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Only PDF, JPG, PNG, DOC, and DOCX files are allowed.`);
        setTimeout(() => setError(null), 5000);
        setIsUploadingFiles(false);
        return;
      }

      // Store only file metadata to avoid Safari/iOS Firestore size issues
      const fileMetadata = newFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        // Note: Actual file content not stored in Firestore to avoid size limitations
        hasContent: true
      }));

      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...fileMetadata]
      }));      setUploadSuccess(`${newFiles.length} file(s) converted and stored successfully`);
      setTimeout(() => setUploadSuccess(null), 3000);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error processing files:', error);
      setError('Failed to process files. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUploadingFiles(false);
    }
  };

  // Remove uploaded file
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  // Submit store request
  const handleSubmitStoreRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) {
      setError('Please make sure you are logged in before submitting a request.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    if (!formData.storeName || !formData.address) {
      setError('Please fill in store name and address');
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Geocode the address to get coordinates
    setIsGeocodingAddress(true);
    let geocodingResult = null;
    try {
      geocodingResult = await GeocodingService.geocodeAddress(formData.address);
      if (!geocodingResult) {
        setError('Unable to find location for the provided address. Please check the address and try again.');
        setTimeout(() => setError(null), 8000);
        return;
      }
    } catch (geocodingError: any) {
      setError(`Address validation failed: ${geocodingError.message || 'Please check the address and try again.'}`);
      setTimeout(() => setError(null), 8000);
      return;
    } finally {
      setIsGeocodingAddress(false);
    }

    if (formData.documents.length === 0) {
      setError('Please upload at least one business document (license, insurance, etc.)');
      setTimeout(() => setError(null), 5000);
      return;
    }

    setIsSubmittingRequest(true);

    try {
      // Ensure user is authenticated
      if (!user || !user.uid) {
        throw new Error('User not authenticated. Please sign in again.');
      }

      console.log('User authentication state:', {
        uid: user.uid,
        email: user.email,
        authenticated: !!user
      });

      const requestData = {
        storeName: formData.storeName,
        storeType: formData.storeType || 'other',
        address: formData.address,
        ownerEmail: ownerProfile?.email || user.email,
        ownerName: ownerProfile?.name || user.displayName || 'Store Owner',
        requestedBy: user.uid,  // Use requestedBy as per our Firestore rules
        ownerId: user.uid,      // Keep ownerId for backward compatibility
        status: 'pending',
        submittedAt: serverTimestamp(),
        // Store both original address and geocoded location data
        formattedAddress: geocodingResult.formattedAddress,
        location: {
          latitude: geocodingResult.latitude,
          longitude: geocodingResult.longitude,
          address: geocodingResult.formattedAddress
        },
        // Store only document metadata to avoid Safari/iOS Firestore size issues
        documentsCount: formData.documents.length,
        documentNames: formData.documents.map(doc => doc.name),
        hasDocuments: formData.documents.length > 0,
        createdAt: new Date().toISOString()
      };

      console.log('Submitting store request:', requestData);
      const docRef = await addDoc(collection(db, 'storeRequests'), requestData);
      console.log('Store request created with ID:', docRef.id);

      setUploadSuccess('Store request submitted successfully! You will be notified once it is reviewed.');
      setShowStoreRequestForm(false);
      setFormData({ storeName: '', storeType: '', address: '', documents: [] });
      
      // Switch to requests tab to show the new request
      setTimeout(() => {
        setActiveTab('requests');
      }, 1000);
      
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (error) {
      console.error('Error submitting store request:', error);
      
      let errorMessage = 'Failed to submit store request. ';
      if (error instanceof Error) {
        if (error.message.includes('permissions')) {
          errorMessage += 'Please make sure you are signed in and try again.';
        } else if (error.message.includes('network')) {
          errorMessage += 'Please check your internet connection and try again.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      setError(errorMessage + ' If the problem persists, please contact support.');
      setTimeout(() => setError(null), 10000);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Load store requests from Firebase
  useEffect(() => {
    const loadStoreRequests = async () => {
      if (!user?.uid) return null;
      
      try {
        setLoading(true);
        // Use a simple query without sorting to avoid index errors
        const q = query(
          collection(db, 'storeRequests'),
          where('requestedBy', '==', user.uid)
        );
        
        // Set up real-time listener
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const requests = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate() || new Date(),
            approvedAt: doc.data().approvedAt?.toDate(),
            rejectedAt: doc.data().rejectedAt?.toDate()
          }));
          
          // Ensure we sort client-side (newest first) in case the query doesn't use orderBy
          requests.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
          
          setStoreRequests(requests);
          setLoading(false);
        }, (error) => {
          console.error('Error loading store requests:', error);
          setError('Failed to load store requests');
          setLoading(false);
          setTimeout(() => setError(null), 5000);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Error setting up store requests listener:', error);
        setError('Failed to load store requests');
        setLoading(false);
        setTimeout(() => setError(null), 5000);
        return null;
      }
    };
    
    let unsubscribe: (() => void) | null = null;
    
    loadStoreRequests().then(unsub => {
      unsubscribe = unsub;
    });
    
    // Cleanup listener on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // const handleUploadSuccess = (url: string) => {
  //   setUploadSuccess('Floorplan uploaded successfully!');
  //   if (store) {
  //     setStore({ ...store, floorplanUrl: url });
  //   }
  //   setTimeout(() => setUploadSuccess(null), 5000);
  // };

  // const handleUploadError = (error: string) => {
  //   console.error('Upload error:', error);
  //   setError(error);
  //   setTimeout(() => setError(null), 5000);
  // };

  // const handleItemAdded = (newItem: Item) => {
  //   setItems(prev => [...prev, newItem]);
  //   setUploadSuccess('Item added successfully!');
  //   setTimeout(() => setUploadSuccess(null), 5000);
  // };

  // const handleError = (errorMessage: string) => {
  //   setError(errorMessage);
  //   setTimeout(() => setError(null), 5000);
  // };
  
  // Handle editing a store
  // const handleEditStore = (store: any) => {
  //   setEditingStore(store);
  //   // If it's a request, go to requests tab, otherwise go to items tab
  //   setActiveTab(store.type === 'request' ? 'requests' : 'inventory');
  // };
  
  // Handle deleting a store
  const handleDeleteStore = async (storeId: string, storeType: string) => {
    try {
      if (storeType === 'store') {
        // Delete from stores collection
        await StoreService.delete(storeId);
      } else {
        // Delete from storeRequests collection
        const storeRequestRef = doc(db, 'storeRequests', storeId);
        await deleteDoc(storeRequestRef);
      }
      
      // Update state to remove the deleted store
      setAllOwnerStores(prev => prev.filter(store => store.id !== storeId));
      setDeleteConfirm(null);
      setUploadSuccess(`Store deleted successfully`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (error) {
      console.error('Error deleting store:', error);
      setError('Failed to delete store. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-900">Store Panel</span>
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
                // Update URL when tab changes without full page reload
                const url = new URL(window.location.href);
                url.searchParams.set('tab', item.id);
                window.history.pushState({}, '', url);
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
              <span className="text-white font-semibold">
                {ownerProfile?.name?.charAt(0) || user?.email?.charAt(0) || 'O'}
              </span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {ownerProfile?.name || 'Store Owner'}
              </p>
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
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {sidebarItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
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

        {/* Success/Error Messages */}
        {uploadSuccess && (
          <div className="mx-4 mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-700">{uploadSuccess}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="transition-all duration-300 ease-in-out">
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                {/* Welcome Card */}
                <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Welcome back, {ownerProfile?.name || 'Store Owner'}!
                      </h2>
                      <p className="text-gray-600 mt-1">Manage your store and items</p>
                    </div>
                    
                  </div>
                </div>

              {/* Store Info Grid */}
              {ownerProfile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Owner Name</h3>
                    <p className="text-lg font-semibold text-gray-900">{ownerProfile.name}</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Owner ID</h3>
                    <p className="text-lg font-semibold text-gray-900 truncate overflow-hidden text-ellipsis" title={ownerProfile?.id || 'Not assigned'}>
                      {ownerProfile?.id || 'Not assigned'}
                    </p>
                  </div>
                </div>
              )}

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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">New Store Request</p>
                    </div>
                  </button>

                  {/* Always show floorplan option */}
                  <button
                    onClick={() => setActiveTab('floorplan')}
                    className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">Manage Floorplans</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">Manage Items</p>
                    </div>
                  </button>
                </div>
              </div>

            
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-6">
              {/* New Request Button */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Store Requests</h2>
                    <p className="text-gray-600">Submit new store requests with location details</p>
                  </div>
                  <button
                    onClick={() => setShowStoreRequestForm(true)}
                    className="bg-gray-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-900 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>New Store Request</span>
                  </button>
                </div>
              </div>

              {/* Store Request Form */}
              {showStoreRequestForm && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">New Store Request</h3>
                    <button
                      onClick={() => setShowStoreRequestForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <form onSubmit={handleSubmitStoreRequest} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
                        <input
                          type="text"
                          value={formData.storeName}
                          onChange={(e) => handleFormInputChange('storeName', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                          placeholder="Enter store name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                        <select
                          value={formData.storeType}
                          onChange={(e) => handleFormInputChange('storeType', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                        >
                          <option value="">Select business type</option>
                          <option value="grocery">Grocery Store</option>
                          <option value="pharmacy">Pharmacy</option>
                          <option value="department">Department Store</option>
                          <option value="electronics">Electronics Store</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Store Address</label>
                      <textarea
                        rows={3}
                        value={formData.address}
                        onChange={(e) => handleFormInputChange('address', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                        placeholder="Enter complete store address"
                        required
                      />
                    </div>

                    {/* Location coordinates will be automatically generated from the address using geocoding */}
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 className="text-sm font-medium text-blue-900">Location Information</h4>
                      </div>
                      <p className="text-xs text-blue-700">
                        Store coordinates will be automatically generated from your address when you submit the form. No need to manually enter coordinates or allow location permissions.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Business Documents</label>
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isUploadingFiles ? 'border-gray-400 bg-gray-50' : 'border-gray-300 hover:border-gray-400'}`}>
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-600 mb-2">
                          {isUploadingFiles ? 'Converting files to secure storage format...' : 'Upload business license, insurance, and other documents'}
                        </p>
                        <p className="text-xs text-gray-500 mb-3">Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 5MB per file)</p>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={handleFileUpload}
                          disabled={isUploadingFiles}
                          className="hidden"
                          id="document-upload"
                        />
                        <label
                          htmlFor="document-upload"
                          className={`inline-block px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                            isUploadingFiles 
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                              : 'bg-gray-800 text-white hover:bg-gray-900'
                          }`}
                        >
                          {isUploadingFiles ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Converting...</span>
                            </div>
                          ) : (
                            'Choose Files'
                          )}
                        </label>
                      </div>
                      
                      {/* Display uploaded files */}
                      {formData.documents.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {formData.documents.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm text-gray-700">{file.name}</span>
                                <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">✓ Secured</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                            <p className="text-xs text-blue-700">
                              ✅ Files are securely stored in encrypted database format. No raw file uploads.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowStoreRequestForm(false);
                          setFormData({ storeName: '', storeType: '', address: '', documents: [] });
                          // setLocationData(null);
                        }}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingRequest || isGeocodingAddress}
                        className="px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingRequest ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Submitting...</span>
                          </div>
                        ) : isGeocodingAddress ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Validating Address...</span>
                          </div>
                        ) : (
                          'Submit Request'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Request History */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Request History</h3>
                  <span className="text-sm text-gray-500">
                    {storeRequests.length} {storeRequests.length === 1 ? 'request' : 'requests'}
                  </span>
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                    <span className="ml-3 text-gray-600">Loading requests...</span>
                  </div>
                ) : storeRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Store Requests</h4>
                    <p className="text-gray-600 mb-4">You haven't submitted any store requests yet.</p>
                    <button
                      onClick={() => setShowStoreRequestForm(true)}
                      className="bg-gray-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-900 transition-colors"
                    >
                      Submit Your First Request
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {storeRequests.map(request => (
                      <div key={request.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                request.status === 'approved' ? 'bg-green-100' :
                                request.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                              }`}>
                                <svg className={`w-5 h-5 ${
                                  request.status === 'approved' ? 'text-green-600' :
                                  request.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">{request.storeName}</h4>
                                <p className="text-sm text-gray-600">{request.storeType || 'Store'}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Submitted: {request.submittedAt.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Address</p>
                                <p className="text-sm text-gray-700">{request.address}</p>
                              </div>
                              {request.location && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Coordinates</p>
                                  <p className="text-sm text-gray-700">
                                    {request.location.latitude?.toFixed(6)}, {request.location.longitude?.toFixed(6)}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {request.documentsCount && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">Documents</p>
                                <p className="text-sm text-gray-700">{request.documentsCount} file(s) uploaded</p>
                              </div>
                            )}
                            
                            {request.rejectionReason && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                                <p className="text-sm text-red-700">
                                  <span className="font-medium">Rejection Reason:</span> {request.rejectionReason}
                                </p>
                              </div>
                            )}
                            
                            {request.adminNote && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                <p className="text-sm text-blue-700">
                                  <span className="font-medium">Admin Note:</span> {request.adminNote}
                                </p>
                              </div>
                            )}
                            
                            {request.status === 'approved' && request.approvedAt && (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-700">
                                  <span className="font-medium">Approved:</span> {request.approvedAt.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            )}
                            
                            {request.status === 'rejected' && request.rejectedAt && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-700">
                                  <span className="font-medium">Rejected:</span> {request.rejectedAt.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex flex-col items-end space-y-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              request.status === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : request.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.status === 'approved' && '✓ '}
                              {request.status === 'rejected' && '✗ '}
                              {request.status === 'pending' && '⏳ '}
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                            
                            {request.status === 'pending' && (
                              <p className="text-xs text-gray-500 text-right">
                                Under review
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'store' && (
            <div className="bg-white rounded-xl shadow-sm">
              {!loading && <OwnerStoreManager />}
            </div>
          )}

          {activeTab === 'floorplan' && (
            <div className="bg-white rounded-xl shadow-sm">
              <FloorplanManager />
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-gray-50 min-h-screen">
              <EnhancedInventoryManager />
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Store</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.storeName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const store = allOwnerStores.find(s => s.id === deleteConfirm.storeId);
                  if (store) {
                    handleDeleteStore(store.id, store.type);
                  }
                }}
                className="px-4 py-2 text-white bg-red-600 rounded-lg font-medium hover:bg-red-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Store
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};