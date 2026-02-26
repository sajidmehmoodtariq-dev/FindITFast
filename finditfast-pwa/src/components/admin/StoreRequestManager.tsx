import React, { useState, useEffect } from 'react';
import { StoreRequestService } from '../../services/storeRequestService';
import { StoreApprovalService } from '../../services/storeApprovalService';
import { DocumentViewer } from '../common/DocumentViewer';
import type { StoreRequest } from '../../types/permissions';
import type { Base64Document } from '../../utils/fileUtils';

export const StoreRequestManager: React.FC = () => {
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [viewingDocuments, setViewingDocuments] = useState<{
    documents: Base64Document[];
    storeName: string;
  } | null>(null);

  useEffect(() => {
    loadStoreRequests();
  }, []);

  const loadStoreRequests = async () => {
    try {
      setLoading(true);
      const allRequests = await StoreRequestService.getAllStoreRequests();
      setRequests(allRequests);
    } catch (err) {
      setError('Failed to load store requests');
      console.error('Error loading store requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, storeName: string) => {
    if (!confirm(`Approve store request for "${storeName}"?\n\nThis will mark the store as approved and ready for use.`)) return;

    try {
      setProcessingRequest(requestId);
      
      // Use the approval service to approve the existing store
      const result = await StoreApprovalService.approveStoreRequest(
        requestId, 
        'Store request approved by admin'
      );
      
      // Refresh the list
      await loadStoreRequests();
      
      // Show detailed success message
      const message = `✅ Store "${storeName}" approved successfully!\n\n` +
        `🏪 Store ID: ${result.storeId}\n` +
        `🔗 Owner Linked: ${result.linked ? 'Yes' : 'No'}\n` +
        `📋 Status: Store approved and ready for owner management`;
      
      alert(message);
    } catch (err: any) {
      alert(`Failed to approve store request: ${err?.message || 'Unknown error'}`);
      console.error('Error approving request:', err);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleReject = async (requestId: string, storeName: string) => {
    const reason = prompt(`Why are you rejecting the store request for "${storeName}"?`);
    if (reason === null) return; // User cancelled

    try {
      setProcessingRequest(requestId);
      
      // Use the approval service for rejection too
      await StoreApprovalService.rejectStoreRequest(
        requestId, 
        reason || 'Store request rejected by admin'
      );
      
      // Refresh the list
      await loadStoreRequests();
      
      alert(`Store request for "${storeName}" has been rejected.`);
    } catch (err: any) {
      alert(`Failed to reject store request: ${err?.message || 'Unknown error'}`);
      console.error('Error rejecting request:', err);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleViewDocuments = (request: any) => {
    if (request.documents && request.documents.length > 0) {
      setViewingDocuments({
        documents: request.documents,
        storeName: request.storeName
      });
    } else if (request.documentNames && request.documentNames.length > 0) {
      // For new metadata-only structure, show information that documents were uploaded
      alert(`${request.documentsCount} document(s) were uploaded with this request: ${request.documentNames.join(', ')}\n\nNote: Document viewing is only available for requests with the full document data.`);
    } else {
      alert('No documents available for this request.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-red-600 text-center">
          <p>{error}</p>
          <button 
            onClick={loadStoreRequests}
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Request Management</h2>
        <p className="text-gray-600">Review and approve store creation requests from users.</p>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="font-medium text-yellow-800">Pending</div>
            <div className="text-2xl font-bold text-yellow-900">{pendingRequests.length}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="font-medium text-green-800">Approved</div>
            <div className="text-2xl font-bold text-green-900">
              {requests.filter(r => r.status === 'approved').length}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="font-medium text-red-800">Rejected</div>
            <div className="text-2xl font-bold text-red-900">
              {requests.filter(r => r.status === 'rejected').length}
            </div>
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              ⏳ Pending Requests ({pendingRequests.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingRequests.map((request) => (
              <div key={request.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      {request.storeName}
                    </h4>
                    <p className="text-gray-600 mb-2">
                      📍 {request.address}
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      📅 Requested: {request.requestedAt.toLocaleDateString()} at {request.requestedAt.toLocaleTimeString()}
                    </p>
                    {request.notes && (
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-4">
                        💬 <strong>Notes:</strong> {request.notes}
                      </p>
                    )}
                    
                    {/* Documents Section */}
                    {((request as any).documentsCount > 0 || ((request as any).documents && (request as any).documents.length > 0)) && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            📎 Documents ({(request as any).documentsCount || (request as any).documents?.length || 0})
                          </span>
                          {(request as any).documents && (request as any).documents.length > 0 && (
                            <button
                              onClick={() => handleViewDocuments(request)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              View Documents
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {/* Show document names from new metadata structure */}
                          {(request as any).documentNames ? (
                            (request as any).documentNames.map((name: string, index: number) => (
                              <span key={index} className="inline-block mr-2 mb-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {name}
                              </span>
                            ))
                          ) : (
                            /* Fallback for old structure */
                            (request as any).documents?.map((doc: any, index: number) => (
                              <span key={index} className="inline-block mr-2 mb-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {doc.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Show documents count even if no documents array */}
                    {!(request as any).documents && (request as any).documentsCount > 0 && (
                      <div className="mb-4">
                        <span className="text-sm text-gray-600">
                          📎 {(request as any).documentsCount} document(s) uploaded (legacy format)
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApprove(request.id, request.storeName)}
                      disabled={processingRequest === request.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      {processingRequest === request.id ? '⏳' : '✅'} Approve
                    </button>
                    <button
                      onClick={() => handleReject(request.id, request.storeName)}
                      disabled={processingRequest === request.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      {processingRequest === request.id ? '⏳' : '❌'} Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Pending Requests */}
      {pendingRequests.length === 0 && (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <div className="text-gray-400 text-6xl mb-4">🎉</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-600">No pending store requests to review.</p>
        </div>
      )}

      {/* Processed Requests History */}
      {processedRequests.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              📋 Recent Decisions ({processedRequests.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {processedRequests.slice(0, 10).map((request) => (
              <div key={request.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getStatusIcon(request.status)}</span>
                      <h4 className="font-medium text-gray-900">{request.storeName}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">📍 {request.address}</p>
                    <p className="text-xs text-gray-500">
                      📅 {request.requestedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Document Viewer Modal */}
      {viewingDocuments && (
        <DocumentViewer
          documents={viewingDocuments.documents}
          title={`Documents for ${viewingDocuments.storeName}`}
          onClose={() => setViewingDocuments(null)}
        />
      )}
    </div>
  );
};
