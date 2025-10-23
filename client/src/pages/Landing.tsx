import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithGoogle, signUpWithEmail, signInWithEmail } from '@/lib/firebase';
import { Heart, Users, Shield, Clock, Mail, Lock } from 'lucide-react';
import { showError } from '@/utils/toast';

export default function Landing() {
  console.log('🏠 Landing page rendered at:', new Date().toISOString());

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      console.log('🔐 Starting Google sign-in process...');
      const result = await signInWithGoogle();

      if (!result.success) {
        console.error('❌ Sign in failed:', result.error);
        showError('Sign in failed. Please try again or contact support.');
      } else if (result.redirectInitiated) {
        console.log('✅ Redirect sign-in initiated - user will be redirected to Google');
        // Don't show success message for redirect flow as user will leave the page
      } else if (result.user) {
        console.log('✅ Sign in completed successfully:', result.user.email);
        // User is now signed in via popup
      } else {
        console.log('✅ Sign in initiated successfully');
      }
    } catch (error) {
      console.error('❌ Sign in error:', error);
      showError('An unexpected error occurred during sign in. Please try again.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = authMode === 'signup'
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);

      if (result.success) {
        if (result.needsVerification) {
          // User will be shown verification prompt by AuthContext
          console.log('✅ Authentication successful, email verification needed');
        } else {
          console.log('✅ Authentication successful:', result.user?.email);
        }
      } else {
        // Handle specific error codes
        const errorCode = (result.error as any)?.code;
        switch (errorCode) {
          case 'auth/email-already-in-use':
            setError('This email is already registered. Please sign in instead.');
            break;
          case 'auth/weak-password':
            setError('Password should be at least 6 characters.');
            break;
          case 'auth/invalid-email':
            setError('Please enter a valid email address.');
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            setError('Invalid email or password.');
            break;
          case 'auth/too-many-requests':
            setError('Too many failed attempts. Please try again later.');
            break;
          default:
            setError('Authentication failed. Please try again.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/20 to-secondary-light/20">
      {/* Navigation */}
      <nav className="px-6 py-4" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-gray-900">FamMedicalCare</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main id="main-content" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Care, Connected
            <span className="text-primary block">for Your Family</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Streamline your family's healthcare journey with our comprehensive platform.
            Manage medications, appointments, and coordinate care for your loved ones
            all in one secure place.
          </p>

          <div className="max-w-md mx-auto">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-4 px-8 rounded-lg shadow-lg border border-gray-200 transition-all duration-200 hover:shadow-xl mb-6"
              aria-label="Sign in with Google"
            >
              <div className="flex items-center justify-center space-x-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </div>
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-br from-primary-light/20 to-secondary-light/20 text-gray-600">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <form onSubmit={handleEmailAuth} className="space-y-4" aria-label={authMode === 'signup' ? 'Sign up form' : 'Sign in form'}>
                {/* Error Message */}
                {error && (
                  <div
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
                    role="alert"
                    aria-live="polite"
                  >
                    {error}
                  </div>
                )}

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="you@example.com"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="••••••••"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Forgot Password Link */}
                {authMode === 'signin' && (
                  <div className="text-right">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary hover:text-primary-dark"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isLoading ? 'Please wait' : authMode === 'signup' ? 'Create account' : 'Sign in'}
                >
                  {isLoading ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
                </button>

                {/* Toggle Auth Mode */}
                <div className="text-center text-sm">
                  <span className="text-gray-600">
                    {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                      setError('');
                    }}
                    className="text-primary hover:text-primary-dark font-medium"
                    aria-label={authMode === 'signin' ? 'Switch to sign up' : 'Switch to sign in'}
                  >
                    {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </div>
              </form>
            </div>

            {/* Info Text */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                By continuing, you agree to our{' '}
                <Link to="/terms" className="text-primary hover:text-primary-dark">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary hover:text-primary-dark">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20" aria-label="Key features">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-primary">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Patient Care</h3>
            <p className="text-gray-600">Comprehensive patient profiles with medical history, conditions, and allergies.</p>
          </div>

          <div className="text-center">
            <div className="bg-secondary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-secondary">
              <Users className="w-8 h-8 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Family Coordination</h3>
            <p className="text-gray-600">Connect family members and caregivers for seamless care coordination.</p>
          </div>

          <div className="text-center">
            <div className="bg-accent/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-accent">
              <Clock className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Appointment Management</h3>
            <p className="text-gray-600">Track appointments, medications, and care tasks in one centralized location.</p>
          </div>

          <div className="text-center">
            <div className="bg-gold/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-gold">
              <Shield className="w-8 h-8 text-gold" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure & Private</h3>
            <p className="text-gray-600">HIPAA-compliant platform with enterprise-grade security and privacy controls.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8" role="contentinfo">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex justify-center space-x-6 mb-4">
            <Link to="/privacy" className="text-primary hover:text-primary-dark transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-primary hover:text-primary-dark transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-gray-600">&copy; 2024 FamMedicalCare. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
