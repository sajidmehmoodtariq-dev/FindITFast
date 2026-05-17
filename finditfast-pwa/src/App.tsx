import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage';
import { ItemDetailsPage } from './pages/ItemDetailsPage';
import { FloorplanItemViewPage } from './pages/FloorplanItemViewPage';
import { ReportItemPage } from './pages/ReportItemPage';
import { InventoryPage } from './pages/InventoryPage';
import { StoreDetailsPage } from './pages/StoreDetailsPage';
import { FloorplanPage } from './pages/FloorplanPage';
import { StoreRequestPage } from './pages/StoreRequestPage';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth';
import { registerServiceWorker } from './utils/pwaUtils';
import { CacheOptimizer } from './utilities/performanceUtils';

// Lazy-load admin and owner pages — not needed for regular users
const OwnerAuthPage = lazy(() => import('./pages/OwnerAuthPage').then(m => ({ default: m.OwnerAuthPage })));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then(m => ({ default: m.OwnerDashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAuthPage = lazy(() => import('./pages/AdminAuthPage').then(m => ({ default: m.AdminAuthPage })));

function App() {
  useEffect(() => {
    // Fire background tasks without blocking the UI
    registerServiceWorker().catch(console.warn);
    CacheOptimizer.clearOldCaches().catch(console.warn);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<SearchPage />} />
          <Route path="/item/:itemId/store/:storeId" element={<ItemDetailsPage />} />
          <Route path="/store/:storeId/floorplan/item" element={<FloorplanItemViewPage />} />
          <Route path="/report/:itemId/:storeId" element={<ReportItemPage />} />
          <Route path="/inventory/:itemId/:storeId" element={<InventoryPage />} />
          <Route path="/store/:storeId" element={<StoreDetailsPage />} />
          <Route path="/store/:storeId/floorplan" element={<FloorplanPage />} />
          <Route path="/request-store" element={<StoreRequestPage />} />

          {/* Owner authentication — lazy loaded */}
          <Route path="/owner/auth" element={<Suspense fallback={null}><OwnerAuthPage /></Suspense>} />

          {/* Admin authentication — lazy loaded */}
          <Route path="/admin/auth" element={<Suspense fallback={null}><AdminAuthPage /></Suspense>} />

          {/* Protected owner routes — lazy loaded */}
          <Route
            path="/owner/dashboard"
            element={
              <ProtectedRoute requireOwner={true}>
                <Suspense fallback={null}><OwnerDashboard /></Suspense>
              </ProtectedRoute>
            }
          />

          {/* Admin routes — lazy loaded */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowAdmin={true}>
                <Suspense fallback={null}><AdminDashboard /></Suspense>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
