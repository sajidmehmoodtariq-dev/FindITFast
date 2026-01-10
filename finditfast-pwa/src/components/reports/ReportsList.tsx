import React, { useState, useEffect, useCallback } from 'react';
import { ReportService } from '../../services/firestoreService';
import type { Report } from '../../types';

interface ReportsListProps {
  storeOwnerId: string;
}

interface ReportWithDetails extends Report {
  itemName?: string;
  storeName?: string;
}

export const ReportsList: React.FC<ReportsListProps> = ({ storeOwnerId }) => {
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading reports for store owner:', storeOwnerId);
      
      if (!storeOwnerId) {
        console.warn('⚠️ No store owner ID provided');
        setReports([]);
        return;
      }
      
      // Get all reports for stores owned by this user
      const allReports = await ReportService.getByStoreOwner(storeOwnerId);
      console.log('📊 Reports loaded:', allReports.length);
      
      setReports(allReports);
      
      // If no reports found, optionally show demo data
      if (allReports.length === 0) {
        console.log('ℹ️ No reports found for this owner');
      }
    } catch (error) {
      console.error('❌ Failed to load reports:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error details:', errorMessage);
      
      // For demo purposes, show some sample data when real data fails to load
      if (errorMessage?.includes('permission') || errorMessage?.includes('offline') || errorMessage?.includes('404')) {
        console.log('🎭 Connection issue detected, showing empty state');
        setReports([]);
      } else {
        setReports([]);
      }
    } finally {
      setLoading(false);
    }
  }, [storeOwnerId]);

  // Demo reports for demonstration purposes
  const getDemoReports = (): ReportWithDetails[] => [
    {
      id: 'demo-1',
      itemId: 'apple-watch-ultra',
      storeId: 'temp_IS19PLGyB8cQUuvITsmk',
      type: 'missing',
      timestamp: { toDate: () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } as any, // 2 days ago
      status: 'pending',
      itemName: 'Apple watch ultra',
      storeName: 'Electronics Plus',
      metadata: {
        itemName: 'Apple watch ultra',
        comments: 'Item was not found at the indicated location on the store map'
      }
    } as ReportWithDetails,
    {
      id: 'demo-2',
      itemId: 'bluetooth-headphones',
      storeId: 'temp_IS19PLGyB8cQUuvITsmk',
      type: 'moved',
      timestamp: { toDate: () => new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) } as any, // 1 day ago
      status: 'pending',
      itemName: 'Bluetooth Headphones',
      storeName: 'Electronics Plus',
      metadata: {
        itemName: 'Bluetooth Headphones',
        comments: 'Item location has changed - found in different aisle'
      }
    } as ReportWithDetails,
    {
      id: 'demo-3',
      itemId: 'phone-charger',
      storeId: 'temp_IS19PLGyB8cQUuvITsmk',
      type: 'found',
      timestamp: { toDate: () => new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } as any, // 3 days ago
      status: 'resolved',
      itemName: 'Phone Charger',
      storeName: 'Electronics Plus',
      metadata: {
        itemName: 'Phone Charger',
        comments: 'Item was found after being marked as missing'
      }
    } as ReportWithDetails,
    {
      id: 'demo-4',
      itemId: 'laptop-stand',
      storeId: 'temp_IS19PLGyB8cQUuvITsmk',
      type: 'missing',
      timestamp: { toDate: () => new Date(Date.now() - 4 * 60 * 60 * 1000) } as any, // 4 hours ago
      status: 'pending',
      itemName: 'Laptop Stand',
      storeName: 'Electronics Plus',
      metadata: {
        itemName: 'Laptop Stand',
        comments: 'Multiple customers unable to locate this item'
      }
    } as ReportWithDetails
  ];

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleReportStatusUpdate = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await ReportService.updateStatus(reportId, status);
      await loadReports(); // Refresh the list
    } catch (error) {
      console.error('Failed to update report status:', error);
      alert('Failed to update report status');
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-gray-100 text-gray-600';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'missing': return '❌';
      case 'moved': return '📦';
      case 'found': return '✅';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-5xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Reports Yet</h3>
        <p className="text-gray-600">Customer reports will appear here when submitted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Customer Reports ({reports.length})
        </h3>
        <div className="flex space-x-2 text-sm">
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
            {reports.filter(r => r.status === 'pending' || !r.status).length} Pending
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
            {reports.filter(r => r.status === 'resolved').length} Resolved
          </span>
        </div>
      </div>

      {/* Reports List */}
      <div className="grid gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedReport(report)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">{getTypeIcon(report.type)}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {report.itemName || report.metadata?.itemName || `Item ${report.itemId.slice(-6)}`}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report
                    </p>
                  </div>
                </div>
                
                {report.metadata?.comments && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {report.metadata.comments}
                  </p>
                )}
                
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>
                    {report.timestamp?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                  </span>
                  <span>•</span>
                  <span>ID: {report.id.slice(-6)}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                  {report.status || 'Pending'}
                </span>
                
                {/* Thumbnail images */}
                <div className="flex space-x-1">
                  {report.metadata?.itemImageBase64 && typeof report.metadata.itemImageBase64 === 'string' && (
                    <img
                      src={report.metadata.itemImageBase64 as string}
                      alt="Item"
                      className="w-12 h-12 object-cover rounded border"
                    />
                  )}
                  {report.metadata?.locationImageBase64 && typeof report.metadata.locationImageBase64 === 'string' && (
                    <img
                      src={report.metadata.locationImageBase64 as string}
                      alt="Location"
                      className="w-12 h-12 object-cover rounded border"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {getTypeIcon(selectedReport.type)} {selectedReport.metadata?.itemName || 'Item Report'}
                  </h3>
                  <p className="text-gray-600">
                    {selectedReport.type.charAt(0).toUpperCase() + selectedReport.type.slice(1)} Report
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Images */}
              {(selectedReport.metadata?.itemImageBase64 || selectedReport.metadata?.locationImageBase64) && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Photos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedReport.metadata?.itemImageBase64 && typeof selectedReport.metadata.itemImageBase64 === 'string' && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Item Photo</p>
                        <img
                          src={selectedReport.metadata.itemImageBase64 as string}
                          alt="Item"
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                    {selectedReport.metadata?.locationImageBase64 && typeof selectedReport.metadata.locationImageBase64 === 'string' && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Location Photo</p>
                        <img
                          src={selectedReport.metadata.locationImageBase64 as string}
                          alt="Location"
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments */}
              {selectedReport.metadata?.comments && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Customer Comments</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {selectedReport.metadata.comments}
                  </p>
                </div>
              )}

              {/* Report Details */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Report Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(selectedReport.status)}`}>
                      {selectedReport.status || 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Reported:</span>
                    <span className="ml-2 text-gray-900">
                      {selectedReport.timestamp?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Report ID:</span>
                    <span className="ml-2 font-mono text-gray-900">{selectedReport.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Item ID:</span>
                    <span className="ml-2 font-mono text-gray-900">{selectedReport.itemId}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {(!selectedReport.status || selectedReport.status === 'pending') && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      handleReportStatusUpdate(selectedReport.id, 'resolved');
                      setSelectedReport(null);
                    }}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✅ Mark as Resolved
                  </button>
                  <button
                    onClick={() => {
                      handleReportStatusUpdate(selectedReport.id, 'dismissed');
                      setSelectedReport(null);
                    }}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    🗑️ Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
