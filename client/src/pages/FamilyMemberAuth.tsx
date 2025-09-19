import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle } from '@/lib/firebase';
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

export default function FamilyMemberAuth() {
  const { invitationId: invitationToken } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, firebaseUser, isLoading: authLoading } = useAuth();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invitationToken) {
      fetchInvitation();
    }
  }, [invitationToken]);

  // Redirect to AcceptInvitation page once authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading && invitationToken) {
      console.log('✅ User authenticated, redirecting to accept invitation page');
      navigate(`/invitation/${invitationToken}`, { replace: true });
    }
  }, [isAuthenticated, authLoading, invitationToken, navigate]);

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

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);

    try {
      console.log('🔐 Starting Google sign-in for family member invitation...');
      const result = await signInWithGoogle();

      if (!result.success) {
        console.error('❌ Sign in failed:', result.error);
        setError('Sign in failed. Please try again or contact support.');
      } else if (result.redirectInitiated) {
        console.log('✅ Redirect sign-in initiated - user will be redirected to Google');
        // Don't show success message for redirect flow as user will leave the page
      } else if (result.user) {
        console.log('✅ Sign in completed successfully:', result.user.email);
        // User is now signed in - useEffect will handle redirect
      } else {
        console.log('✅ Sign in initiated successfully');
      }
    } catch (error) {
      console.error('❌ Sign in error:', error);
      setError('An unexpected error occurred during sign in. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  if (authLoading || loading) {
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
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
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
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to KinConnect!
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              {invitation?.inviterName} has invited you to join their family care network.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-medium">
                You're being invited to help coordinate care for {invitation?.patientName}
              </p>
            </div>
          </div>

          {/* Invitation Preview */}
          {invitation && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invitation Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invited by:</span>
                  <span className="font-medium text-gray-900">{invitation.inviterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient:</span>
                  <span className="font-medium text-gray-900">{invitation.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expires:</span>
                  <span className="font-medium text-gray-900">
                    {invitation.expiresAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Authentication Section */}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Sign in to accept this invitation
            </h2>
            <p className="text-gray-600 mb-8">
              Create your KinConnect account or sign in to your existing account to join the care network.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="bg-white hover:bg-gray-50 text-gray-900 font-semibold py-4 px-8 rounded-lg shadow-lg border border-gray-200 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="flex items-center space-x-3">
                {signingIn ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>
                  {signingIn ? 'Signing in...' : 'Continue with Google'}
                </span>
              </div>
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                <strong>New to KinConnect?</strong> This will create your account automatically.<br/>
                <strong>Already have an account?</strong> This will sign you in securely.
              </p>
            </div>
          </div>
        </div>

        {/* What happens next section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens after you sign in?</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <p>You'll be automatically redirected to review the invitation details</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">2</span>
              </div>
              <p>You can choose to accept or decline the invitation</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">3</span>
              </div>
              <p>Once accepted, you'll join {invitation?.inviterName}'s care network</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">4</span>
              </div>
              <p>Access {invitation?.patientName}'s dashboard to coordinate their care</p>
            </div>
          </div>
        </div>

        {/* Security notice */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-green-800 font-medium">Secure & Private</p>
              <p className="text-green-700 text-sm">
                Your invitation is encrypted and secure. Only you can access this invitation with this special link.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}