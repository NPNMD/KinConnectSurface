import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, CheckCircle, XCircle, Clock, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiClient, API_ENDPOINTS } from '@/lib/api';

interface InvitationData {
  id: string;
  inviterName: string;
  inviterEmail: string;
  patientName: string;
  patientEmail: string;
  message: string;
  status: string;
  accessLevel?: 'full' | 'view_only' | 'limited' | 'emergency_only';
  createdAt: Date;
  expiresAt: Date;
}

export default function AcceptInvitation() {
  const { invitationId: invitationToken } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, firebaseUser } = useAuth();
  const { refreshFamilyAccess, activePatientId } = useFamily();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [waitingForContext, setWaitingForContext] = useState(false);

  useEffect(() => {
    if (invitationToken) {
      fetchInvitation();
    }
  }, [invitationToken]);

  // Handle navigation when success state is true and patient context is ready
  useEffect(() => {
    if (success && !waitingForContext) {
      console.log('🚀 AcceptInvitation: Success confirmed, navigating to dashboard in 1.5s');
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success, waitingForContext, navigate]);

  // Monitor activePatientId changes after invitation acceptance
  useEffect(() => {
    if (waitingForContext && activePatientId) {
      const pendingPatientId = sessionStorage.getItem('pendingPatientId');
      
      // Check if the activePatientId matches our expected patient
      if (pendingPatientId && activePatientId === pendingPatientId) {
        console.log('✅ AcceptInvitation: Patient context verified, activePatientId set:', activePatientId);
        setWaitingForContext(false);
        sessionStorage.removeItem('pendingPatientId');
      } else if (activePatientId) {
        // Even if it doesn't match exactly, if we have an activePatientId, proceed
        console.log('✅ AcceptInvitation: Patient context ready with activePatientId:', activePatientId);
        setWaitingForContext(false);
        sessionStorage.removeItem('pendingPatientId');
      }
    }
  }, [activePatientId, waitingForContext]);

  const fetchInvitation = async () => {
    try {
      if (!invitationToken) return;
      const result = await apiClient.get<{ success: boolean; data: any }>(
        API_ENDPOINTS.INVITATION_DETAILS(invitationToken)
      );

      const invitationData = {
        ...result.data,
        createdAt: new Date(result.data.createdAt),
        expiresAt: new Date(result.data.expiresAt),
      };

      // Check if invitation is expired
      if (new Date() > invitationData.expiresAt) {
        setError('This invitation has expired');
        setInvitation(invitationData);
        setLoading(false);
        return;
      }

      // Check if invitation is already accepted
      if (invitationData.status === 'active') {
        setError('This invitation has already been accepted');
        setInvitation(invitationData);
        setLoading(false);
        return;
      }

      // Check if invitation is declined
      if (invitationData.status === 'declined') {
        setError('This invitation has been declined');
        setInvitation(invitationData);
        setLoading(false);
        return;
      }

      setInvitation(invitationData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!isAuthenticated || !firebaseUser) {
      setError('Please sign in to accept this invitation');
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      if (!invitationToken) return;
      
      console.log('🔍 AcceptInvitation: Starting invitation acceptance process');
      
      const result = await apiClient.post<{ success: boolean; data: any; message?: string }>(
        API_ENDPOINTS.ACCEPT_INVITATION(invitationToken)
      );

      console.log('✅ AcceptInvitation: Invitation accepted, refreshing family access');
      
      // Store patient ID in sessionStorage for FamilyContext to use
      if (result.data?.patientId) {
        sessionStorage.setItem('pendingPatientId', result.data.patientId);
        console.log('💾 AcceptInvitation: Stored patient ID in sessionStorage:', result.data.patientId);
      }
      
      // Set waiting state before refreshing
      setWaitingForContext(true);
      
      // Refresh family access to get the new patient relationship
      await refreshFamilyAccess();
      
      console.log('🔍 AcceptInvitation: Family access refreshed, waiting for patient context');
      
      // Set success state - navigation will be handled by useEffect
      setSuccess(true);
      
      // Also trigger a refresh for any patients who might be viewing their family list
      window.dispatchEvent(new CustomEvent('familyMemberAdded', {
        detail: {
          familyMemberId: firebaseUser.uid,
          familyMemberName: firebaseUser.displayName || firebaseUser.email,
          familyMemberEmail: firebaseUser.email,
          invitationId: invitationToken
        }
      }));
      
      // Set timeout to stop waiting after 5 seconds
      setTimeout(() => {
        if (waitingForContext) {
          console.warn('⚠️ AcceptInvitation: Patient context timeout, proceeding anyway');
          setWaitingForContext(false);
        }
      }, 5000);
      
    } catch (err: any) {
      console.error('❌ AcceptInvitation: Error accepting invitation:', err);
      setError(err?.message || 'Failed to accept invitation');
      setSuccess(false);
      setWaitingForContext(false);
      // Clean up sessionStorage on error
      sessionStorage.removeItem('pendingPatientId');
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineInvitation = async () => {
    if (!isAuthenticated || !firebaseUser) {
      setError('Please sign in to decline this invitation');
      return;
    }

    setDeclining(true);
    setError(null);

    try {
      if (!invitation?.id) return;
      
      console.log('🔍 AcceptInvitation: Declining invitation');
      
      await apiClient.post(
        `/invitations/${invitation.id}/decline`,
        { reason: declineReason.trim() || undefined }
      );

      console.log('✅ AcceptInvitation: Invitation declined successfully');
      
      setDeclined(true);
      setShowDeclineDialog(false);
      
      // Navigate to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (err: any) {
      console.error('❌ AcceptInvitation: Error declining invitation:', err);
      setError(err?.message || 'Failed to decline invitation');
      setShowDeclineDialog(false);
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go to KinConnect
          </button>
        </div>
      </div>
    );
  }

  // Handle expired invitation
  if (invitation && new Date() > invitation.expiresAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h1>
          <p className="text-gray-600 mb-4">
            This invitation from {invitation.inviterName} expired on {invitation.expiresAt.toLocaleDateString()}.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please contact {invitation.inviterName} to request a new invitation.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go to KinConnect
          </button>
        </div>
      </div>
    );
  }

  // Handle already accepted invitation
  if (invitation && invitation.status === 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Accepted</h1>
          <p className="text-gray-600 mb-4">
            You've already accepted this invitation from {invitation.inviterName}.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Redirecting to dashboard...
          </p>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Handle declined invitation
  if (declined || (invitation && invitation.status === 'declined')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <XCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Declined</h1>
          <p className="text-gray-600 mb-6">
            You've declined the invitation from {invitation?.inviterName}.
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to home page...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Family!</h1>
          <p className="text-gray-600 mb-4">
            You've successfully joined {invitation?.inviterName}'s care network.
          </p>
          {waitingForContext ? (
            <>
              <p className="text-sm text-gray-500 mb-6">
                Setting up your access to {invitation?.patientName}'s dashboard...
              </p>
              <LoadingSpinner />
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Redirecting to dashboard...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <Heart className="w-8 h-8 text-primary-600" />
            <span className="text-2xl font-bold text-gray-900">KinConnect</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              You're Invited to Join KinConnect!
            </h1>
            <p className="text-gray-600">
              {invitation?.inviterName} has invited you to join their family care network.
            </p>
          </div>

          {/* Invitation Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invited by
                </label>
                <p className="text-gray-900">{invitation?.inviterName}</p>
                <p className="text-sm text-gray-600">{invitation?.inviterEmail}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name
                </label>
                <p className="text-gray-900">{invitation?.patientName}</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invitation Date
                </label>
                <p className="text-gray-900">
                  {invitation?.createdAt.toLocaleDateString()} at {invitation?.createdAt.toLocaleTimeString()}
                </p>
              </div>

              {/* Access Level Display */}
              {invitation?.accessLevel && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Level Being Granted
                  </label>
                  <div className={`inline-flex items-center px-3 py-2 rounded-lg ${
                    invitation.accessLevel === 'full'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    <Shield className="w-4 h-4 mr-2" />
                    <span className="font-medium">
                      {invitation.accessLevel === 'full' ? 'Full Access' :
                       invitation.accessLevel === 'view_only' ? 'View Only' :
                       invitation.accessLevel === 'limited' ? 'Limited Access' :
                       'Emergency Only'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {invitation.accessLevel === 'full'
                      ? 'You will have complete control over appointments and medical information'
                      : invitation.accessLevel === 'view_only'
                      ? 'You will have read-only access to appointments with ability to claim transportation responsibilities'
                      : invitation.accessLevel === 'limited'
                      ? 'You will have limited access to view and create appointments'
                      : 'You will only receive emergency notifications'}
                  </p>
                </div>
              )}

              {invitation?.message && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Message
                  </label>
                  <p className="text-gray-900 italic">"{invitation.message}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Expiration Warning */}
          <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg mb-6">
            <Clock className="w-5 h-5" />
            <span className="text-sm">
              This invitation expires on {invitation?.expiresAt.toLocaleDateString()}
            </span>
          </div>

          {/* Authentication Check */}
          {!isAuthenticated ? (
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                Please sign in to accept this invitation and join the care network.
              </p>
              <button
                onClick={() => navigate(`/family-invite/${invitationToken}`)}
                className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 font-medium"
              >
                Sign In to Accept
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                By accepting this invitation, you'll be able to coordinate care and share 
                important health information with {invitation?.inviterName}'s family.
              </p>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                  {error}
                </div>
              )}

              <div className="flex space-x-4 justify-center">
                <button
                  onClick={() => setShowDeclineDialog(true)}
                  disabled={accepting || declining}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={accepting || declining}
                  className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {accepting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Accepting...</span>
                    </>
                  ) : (
                    'Accept Invitation'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Information Section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <p>You'll be added to {invitation?.inviterName}'s family care network</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">2</span>
              </div>
              <p>You can share and coordinate medical information securely</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">3</span>
              </div>
              <p>Access {invitation?.patientName}'s dashboard to view and manage their health information</p>
            </div>
          </div>
        </div>

        {/* Decline Confirmation Dialog */}
        {showDeclineDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900">Decline Invitation?</h3>
              </div>
              
              <p className="text-gray-600 mb-4">
                Are you sure you want to decline this invitation from {invitation?.inviterName}?
                They will be notified of your decision.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Let them know why you're declining..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  disabled={declining}
                />
              </div>

              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeclineDialog(false);
                    setDeclineReason('');
                  }}
                  disabled={declining}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeclineInvitation}
                  disabled={declining}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
                >
                  {declining ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Declining...</span>
                    </>
                  ) : (
                    'Confirm Decline'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}