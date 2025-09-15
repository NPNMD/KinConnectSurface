import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
  createdAt: Date;
  expiresAt: Date;
}

export default function AcceptInvitation() {
  const { invitationId: invitationToken } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, firebaseUser } = useAuth();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (invitationToken) {
      fetchInvitation();
    }
  }, [invitationToken]);

  const fetchInvitation = async () => {
    try {
      if (!invitationToken) return;
      const result = await apiClient.get<{ success: boolean; data: any }>(
        API_ENDPOINTS.INVITATION_DETAILS(invitationToken)
      );

      setInvitation({
        ...result.data,
        createdAt: new Date(result.data.createdAt),
        expiresAt: new Date(result.data.expiresAt),
      });
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
      const result = await apiClient.post<{ success: boolean; data: any; message?: string }>(
        API_ENDPOINTS.ACCEPT_INVITATION(invitationToken)
      );

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Family!</h1>
          <p className="text-gray-600 mb-6">
            You've successfully joined {invitation?.inviterName}'s care network. 
            Redirecting to your dashboard...
          </p>
          <LoadingSpinner />
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
                onClick={() => navigate('/')}
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
                  onClick={() => navigate('/')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={accepting}
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
              <p>Access your personalized dashboard to manage your health information</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}