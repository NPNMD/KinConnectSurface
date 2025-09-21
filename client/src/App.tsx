import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { FamilyProvider } from '@/contexts/FamilyContext';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import PatientProfile from '@/pages/PatientProfile';
import Medications from '@/pages/Medications';
import CalendarPage from '@/pages/CalendarPage';
import InvitePatient from '@/pages/InvitePatient';
import AcceptInvitation from '@/pages/AcceptInvitation';
import FamilyMemberAuth from '@/pages/FamilyMemberAuth';
import TestFamilyInviteFlow from '@/pages/TestFamilyInviteFlow';
import VisitSummaryDetail from '@/pages/VisitSummaryDetail';
import VisitSummaries from '@/pages/VisitSummaries';
import LoadingSpinner from '@/components/LoadingSpinner';
import ServiceWorkerUpdate from '@/components/ServiceWorkerUpdate';
import { registerServiceWorker } from '@/utils/serviceWorker';
import '@/utils/clearCache'; // Import for development helpers

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('🛡️ ProtectedRoute check:', { isAuthenticated, isLoading });

  if (isLoading) {
    console.log('🔄 ProtectedRoute: Showing loading spinner');
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    console.log('🚫 ProtectedRoute: Not authenticated, redirecting to /');
    return <Navigate to="/" replace />;
  }

  console.log('✅ ProtectedRoute: Authenticated, showing protected content');
  return <>{children}</>;
}

// Public route component (redirects if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, firebaseUser } = useAuth();

  console.log('🌐 PublicRoute check:', {
    isAuthenticated,
    isLoading,
    hasFirebaseUser: !!firebaseUser,
    firebaseUserEmail: firebaseUser?.email
  });

  if (isLoading) {
    console.log('🔄 PublicRoute: Showing loading spinner');
    return <LoadingSpinner />;
  }

  if (isAuthenticated && firebaseUser) {
    console.log('✅ PublicRoute: Authenticated, redirecting to /dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('👤 PublicRoute: Not authenticated, showing public content');
  return <>{children}</>;
}

// Legacy invitation redirect component
function LegacyInvitationRedirect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  if (token) {
    // Redirect to new invitation format
    return <Navigate to={`/invitation/${token}`} replace />;
  }
  
  // If no token, redirect to home
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={
        <PublicRoute>
          <Landing />
        </PublicRoute>
      } />
      
      {/* Development test routes - bypass authentication */}
      <Route path="/test-dashboard" element={<Dashboard />} />
      <Route path="/test-medications" element={<Medications />} />
      <Route path="/test-landing" element={<Landing />} />
      <Route path="/test-family-invite-flow" element={<TestFamilyInviteFlow />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <PatientProfile />
        </ProtectedRoute>
      } />
      
      <Route path="/medications" element={
        <ProtectedRoute>
          <Medications />
        </ProtectedRoute>
      } />
      
      <Route path="/calendar" element={
        <ProtectedRoute>
          <CalendarPage />
        </ProtectedRoute>
      } />
      
      <Route path="/family/invite" element={
        <ProtectedRoute>
          <InvitePatient />
        </ProtectedRoute>
      } />
      
      {/* Visit Summary Routes */}
      <Route path="/visit-summaries" element={
        <ProtectedRoute>
          <VisitSummaries />
        </ProtectedRoute>
      } />
      
      <Route path="/visit-summary/:summaryId" element={
        <ProtectedRoute>
          <VisitSummaryDetail />
        </ProtectedRoute>
      } />
      
      {/* Family member invitation routes */}
      <Route path="/family-invite/:invitationId" element={<FamilyMemberAuth />} />
      <Route path="/invitation/:invitationId" element={<AcceptInvitation />} />
      
      {/* Legacy invitation route - redirect to new format */}
      <Route path="/accept-invitation" element={<LegacyInvitationRedirect />} />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Register service worker on app startup
    registerServiceWorker().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FamilyProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <AppRoutes />
              <ServiceWorkerUpdate />
            </div>
          </Router>
        </FamilyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
