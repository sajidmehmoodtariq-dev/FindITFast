import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StorePlanService } from '../../services/firestoreService';
import { FloorplanUpload } from './FloorplanUpload';
import { InventoryManager } from './InventoryManager';
import { ensureStoreOwnerRecord } from '../../utilities/storeOwnerUtils';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';
import type { Store, StorePlan } from '../../types';

interface ApprovedStoreRequest {
  id: string;
  storeName: string;
  storeType?: string;
  address: string;
  status: 'approved';
  approvedAt: Date;
  storeId?: string; // Reference to the actual store if created
}

export const FloorplanManager: React.FC = () => {
  const { user } = useAuth();
  const [approvedRequests, setApprovedRequests] = useState<ApprovedStoreRequest[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storePlans, setStorePlans] = useState<StorePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null);
  const [inventoryManagerOpen, setInventoryManagerOpen] = useState<{storePlan: StorePlan, storeId: string} | null>(null);

  useEffect(() => {
    loadApprovedStores();
  }, [user]);

  const loadApprovedStores = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Loading approved stores for user:', user.uid, user.email);

      // First, ensure the user has a store owner record
      const hasStoreOwnerRecord = await ensureStoreOwnerRecord(user);
      if (!hasStoreOwnerRecord) {
        console.warn('Could not create store owner record');
      }

      // Get approved store requests
      const requestsQuery = query(
        collection(db, 'storeRequests'),
        where('requestedBy', '==', user.uid),
        where('status', '==', 'approved')
      );
      
      const requestsSnapshot = await getDocs(requestsQuery);
      const approvedRequestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        approvedAt: doc.data().approvedAt?.toDate() || new Date(),
      })) as ApprovedStoreRequest[];

      console.log('Found approved requests:', approvedRequestsData.length);
      console.log('Approved requests data:', approvedRequestsData.map(r => ({ 
        id: r.id, 
        storeName: r.storeName, 
        storeId: (r as any).storeId,
        status: r.status 
      })));
      
      // Also log the full first request to see all fields
      if (approvedRequestsData.length > 0) {
        console.log('First approved request (full data):', approvedRequestsData[0]);
      }
      
      setApprovedRequests(approvedRequestsData);

      // The approved requests ARE the stores (storeRequests collection with status='approved')
      // No need to query a separate 'stores' collection
      if (approvedRequestsData.length > 0) {
        const storesData = approvedRequestsData.map(request => {
          const requestData = request as any; // Type assertion for flexibility
          return {
            id: request.id,
            name: requestData.name || requestData.storeName,
            address: requestData.address || '',
            location: requestData.location || { latitude: 0, longitude: 0 },
            ownerId: requestData.ownerId || user.uid,
            createdAt: requestData.createdAt || new Date(),
            updatedAt: requestData.updatedAt || new Date(),
            floorplanUrl: requestData.floorplanUrl,
            floorplanData: requestData.floorplanData
          } as Store;
        });

        console.log('Found stores:', storesData.length);
        setStores(storesData);

        // Try to get store plans, with better error handling
        try {
          console.log('Attempting to load store plans...');
          const storePlansData = await StorePlanService.getByOwner(user.uid);
          console.log('Store plans loaded successfully:', storePlansData.length);
          console.log('Store plans data:', storePlansData);
          setStorePlans(storePlansData);
        } catch (planError) {
          console.warn('Could not load store plans:', planError);
          // Don't fail the entire load if store plans can't be accessed
          // This might happen if the user doesn't have proper store owner permissions
          setStorePlans([]);
        }
      }

    } catch (err) {
      console.error('Error loading approved stores:', err);
      setError('Failed to load your approved stores');
    } finally {
      setLoading(false);
    }
  };

  const getStoreForRequest = (requestId: string): Store | undefined => {
    // Try to match store by name and owner
    const request = approvedRequests.find(req => req.id === requestId);
    if (!request) return undefined;
    
    return stores.find(store => 
      store.name === request.storeName && 
      store.ownerId === user?.uid
    );
  };

  const getStorePlansForStore = (storeId: string): StorePlan[] => {
    const plans = storePlans.filter(plan => plan.storeId === storeId);
    console.log(`🔍 Getting store plans for store ${storeId}:`, plans.length);
    console.log('Available store plans:', storePlans.map(p => ({ id: p.id, storeId: p.storeId, ownerId: p.ownerId })));
    return plans;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
          <span className="ml-3 text-gray-600">Loading your stores...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Stores</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadApprovedStores}
            className="bg-gray-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-900 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (approvedRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Approved Stores</h3>
          <p className="text-gray-600 mb-4">
            You need to have approved store requests before you can upload floorplans.
          </p>
          <button
            onClick={() => window.location.href = '/owner/dashboard?tab=requests'}
            className="bg-gray-800 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-900 transition-colors"
          >
            Submit Store Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Store Selection */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Floorplan Management</h2>
            <p className="text-gray-600">Upload and manage floorplans for your approved stores</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={loadApprovedStores}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-500">Approved Stores</p>
              <p className="text-2xl font-bold text-gray-900">{approvedRequests.length}</p>
            </div>
          </div>
        </div>

        {/* Store Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvedRequests.map((request) => {
            const store = getStoreForRequest(request.id);
            const storeStorePlans = store ? getStorePlansForStore(store.id) : getStorePlansForStore(`temp_${request.id}`);
            const hasFloorplan = store?.floorplanUrl || store?.floorplanData || storeStorePlans.length > 0;
            const floorplanCount = storeStorePlans.length;
            const isExpanded = selectedStore === request.id;
            
            return (
              <div
                key={request.id}
                className={`border rounded-xl transition-all ${
                  isExpanded
                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* Store Card Header (Always Visible) */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedStore(selectedStore === request.id ? null : request.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{request.storeName}</h3>
                      <p className="text-sm text-gray-600">{request.storeType || 'Store'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        📍 {request.address.length > 40 ? request.address.substring(0, 40) + '...' : request.address}
                      </p>
                    </div>
                    <div className="ml-3 flex flex-col items-end">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-2">
                        ✅ Approved
                      </span>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        hasFloorplan 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {hasFloorplan ? 
                          (floorplanCount > 0 ? `🏗️ ${floorplanCount} Floorplan${floorplanCount > 1 ? 's' : ''}` : '🏗️ Floorplan Ready') 
                          : '📋 Needs Floorplan'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Store Preview Thumbnail */}
                  {hasFloorplan && (
                    <div className="mt-3">
                      {(() => {
                        // Determine which floorplan to show
                        let floorplanUrl = '';
                        let floorplanName = '';
                        
                        if (storeStorePlans.length > 0) {
                          // Use active floorplan or the most recent one
                          const activeFloorplan = storeStorePlans.find(fp => fp.isActive) || storeStorePlans[storeStorePlans.length - 1];
                          floorplanUrl = getStorePlanImageUrl(activeFloorplan);
                          floorplanName = activeFloorplan.name;
                        } else if (store?.floorplanData) {
                          // Legacy store floorplan data
                          floorplanUrl = (store.floorplanData as any).base64 || '';
                          floorplanName = store.floorplanData.name;
                        } else if (store?.floorplanUrl) {
                          floorplanUrl = store.floorplanUrl;
                          floorplanName = 'Floorplan';
                        }
                        
                        return floorplanUrl ? (
                          <div className="relative">
                            <img
                              src={floorplanUrl}
                              alt={`${request.storeName} floorplan`}
                              className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent card toggle
                                // Open full-size image in new tab
                                const newWindow = window.open();
                                if (newWindow) {
                                  newWindow.document.write(`
                                    <html>
                                      <head><title>${floorplanName} - ${request.storeName}</title></head>
                                      <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f0f0;">
                                        <img src="${floorplanUrl}" alt="${floorplanName}" style="max-width:100%; max-height:100%; object-fit:contain;" />
                                      </body>
                                    </html>
                                  `);
                                }
                              }}
                              title="Click to view full size"
                            />
                            <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                              Click to enlarge
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                  
                  {/* Expand/Collapse Indicator */}
                  <div className="flex items-center justify-center mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">
                        {isExpanded ? 'Hide' : 'Manage'} Floorplans
                      </span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Content (Floorplan Management) */}
                {isExpanded && (
                  <div className="border-t border-blue-200 bg-white rounded-b-xl">
                    {/* Upload Section */}
                    <div className="p-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">
                        {storeStorePlans.length > 0 ? 'Add New Floorplan' : 'Upload First Floorplan'}
                      </h4>
                      <FloorplanUpload
                        storeId={(request as any).storeId || store?.id || `temp_${request.id}`}
                        onUploadSuccess={() => {
                          // Refresh all data
                          loadApprovedStores();
                        }}
                        onUploadError={(error) => {
                          console.error('Upload error:', error);
                          setError(error);
                          setTimeout(() => setError(null), 5000);
                        }}
                      />
                    </div>

                    {/* Existing Floorplans */}
                    {storeStorePlans.length > 0 ? (
                      <div className="p-4 pt-0">
                        <h4 className="text-md font-semibold text-gray-900 mb-3">
                          Existing Floorplans ({storeStorePlans.length})
                        </h4>
                        <div className="space-y-3">
                          {storeStorePlans
                            .sort((a, b) => new Date(b.createdAt.toDate()).getTime() - new Date(a.createdAt.toDate()).getTime())
                            .map((floorplan) => (
                            <div 
                              key={floorplan.id} 
                              className={`border rounded-lg p-3 ${floorplan.isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
                            >
                              <div className="flex items-start space-x-3">
                                {/* Floorplan Thumbnail */}
                                <img
                                  src={getStorePlanImageUrl(floorplan)}
                                  alt={floorplan.name}
                                  className={`w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-75 transition-opacity ${floorplan.isActive ? 'border-blue-300' : 'border-gray-300'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Open full-size image in new tab
                                    const newWindow = window.open();
                                    if (newWindow) {
                                      newWindow.document.write(`
                                        <html>
                                          <head><title>${floorplan.name}</title></head>
                                          <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f0f0;">
                                            <img src="${getStorePlanImageUrl(floorplan)}" alt="${floorplan.name}" style="max-width:100%; max-height:100%; object-fit:contain;" />
                                          </body>
                                        </html>
                                      `);
                                    }
                                  }}
                                  title="Click to view full size"
                                />
                                
                                {/* Floorplan Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-medium text-gray-700 truncate">
                                      {floorplan.name}
                                    </h5>
                                    {floorplan.isActive && (
                                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full ml-2">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <p>Uploaded: {new Date(floorplan.createdAt.toDate()).toLocaleDateString()}</p>
                                    {floorplan.updatedAt && (
                                      <p>Updated: {new Date(floorplan.updatedAt.toDate()).toLocaleDateString()}</p>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex flex-col space-y-1">
                                  {!floorplan.isActive && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          setActivatingPlan(floorplan.id!);
                                          const storeId = (request as any).storeId || store?.id || `temp_${request.id}`;
                                          await StorePlanService.setActiveStorePlan(storeId, floorplan.id!);
                                          loadApprovedStores(); // Refresh all data
                                        } catch (error) {
                                          console.error('Error activating floorplan:', error);
                                          setError('Failed to activate floorplan');
                                          setTimeout(() => setError(null), 5000);
                                        } finally {
                                          setActivatingPlan(null);
                                        }
                                      }}
                                      disabled={activatingPlan === floorplan.id}
                                      className={`px-2 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${
                                        activatingPlan === floorplan.id
                                          ? 'bg-blue-50 text-blue-400 cursor-not-allowed'
                                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                      }`}
                                      title="Set as active floorplan"
                                    >
                                      {activatingPlan === floorplan.id ? (
                                        <>
                                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          <span>Setting...</span>
                                        </>
                                      ) : (
                                        <span>Set Active</span>
                                      )}
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`Are you sure you want to delete "${floorplan.name}"?`)) {
                                        try {
                                          await StorePlanService.delete(floorplan.id!);
                                          loadApprovedStores(); // Refresh all data
                                        } catch (error) {
                                          console.error('Error deleting floorplan:', error);
                                          setError('Failed to delete floorplan');
                                          setTimeout(() => setError(null), 5000);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded hover:bg-red-200 transition-colors"
                                    title="Delete floorplan"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 pt-0">
                        <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <h5 className="text-sm font-medium text-gray-900 mb-1">No Floorplans Yet</h5>
                          <p className="text-xs text-gray-600">
                            Upload your first floorplan above to get started
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-1">How to manage floorplans:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Click on any store card above to expand floorplan management</li>
              <li>• Use "Take Photo" to capture floorplan with your camera</li>
              <li>• Use "Choose from Gallery" to upload an existing image</li>
              <li>• Upload multiple floorplans for different areas/floors</li>
              <li>• Click "Set Active" to change which floorplan is primary</li>
              <li>• Click "Delete" to remove unwanted floorplans</li>
              <li>• Click any floorplan image to view full-size</li>
              <li>• Images are stored securely as base64 data</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Items Manager Modal */}
      {inventoryManagerOpen && (
        <InventoryManager
          storePlan={inventoryManagerOpen.storePlan}
          storeId={inventoryManagerOpen.storeId}
          onClose={() => setInventoryManagerOpen(null)}
          onItemAdded={() => {
            // Could refresh data or show success message
            console.log('Item added successfully');
          }}
        />
      )}
    </div>
  );
};
