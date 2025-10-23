import { useState } from 'react';
import { sendVerificationEmail, signOutUser } from '@/lib/firebase';
import { Mail, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

interface EmailVerificationPromptProps {
  email: string;
  onVerified?: () => void;
}

export default function EmailVerificationPrompt({ email, onVerified }: EmailVerificationPromptProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleResendEmail = async () => {
    setIsResending(true);
    setError('');
    setResendSuccess(false);

    try {
      const result = await sendVerificationEmail();
      
      if (result.success) {
        if (result.alreadyVerified) {
          setResendSuccess(true);
          // User is already verified, trigger callback
          if (onVerified) {
            setTimeout(() => onVerified(), 1000);
          }
        } else {
          setResendSuccess(true);
        }
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/20 to-secondary-light/20 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Icon */}
        <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-yellow-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Verify Your Email
        </h1>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6">
          We've sent a verification email to <strong>{email}</strong>. 
          Please check your inbox and click the verification link to continue.
        </p>

        {/* Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Can't find the email?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the correct email</li>
                <li>Wait a few minutes for the email to arrive</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {resendSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            ✓ Verification email sent successfully!
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleResendEmail}
            disabled={isResending}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isResending ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5 mr-2" />
                Resend Verification Email
              </>
            )}
          </button>

          <button
            onClick={handleSignOut}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Need help?{' '}
            <a href="mailto:support@fammedicalcare.com" className="text-primary hover:text-primary-dark">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}