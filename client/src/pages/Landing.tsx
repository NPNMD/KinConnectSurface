// React import not needed with JSX transform
import { signInWithGoogle } from '@/lib/firebase';
import { Heart, Users, Shield, Clock } from 'lucide-react';

export default function Landing() {
  console.log('🏠 Landing page rendered at:', new Date().toISOString());

  const handleGoogleSignIn = async () => {
    try {
      console.log('🔐 Starting Google sign-in process...');
      const result = await signInWithGoogle();

      if (!result.success) {
        console.error('❌ Sign in failed:', result.error);
        alert('Sign in failed. Please try again or contact support.');
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
      alert('An unexpected error occurred during sign in. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/20 to-secondary-light/20">
      {/* Navigation */}
      <nav className="px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-gray-900">FamMedicalCare</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
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

          <div className="space-y-6">
            <button
              onClick={handleGoogleSignIn}
              className="bg-white hover:bg-gray-50 text-gray-900 font-semibold py-4 px-8 rounded-lg shadow-lg border border-gray-200 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Get Started with Google</span>
              </div>
            </button>
            
            <div className="text-center">
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                <strong>New user?</strong> This will create your account automatically.<br/>
                <strong>Returning user?</strong> This will sign you in to your existing account.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
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
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600">
          <p>&copy; 2024 FamMedicalCare. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
