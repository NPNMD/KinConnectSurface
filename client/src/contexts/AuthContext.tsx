import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChange, handleRedirectResult } from '@/lib/firebase';
import type { User } from '@shared/types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Debug: Log initial state
  console.log('🔍 AuthContext initialized:', { isLoading, hasFirebaseUser: !!firebaseUser });

  const refreshUser = async () => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();

      // Fetch user data from our API
      const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          console.log('✅ User profile loaded successfully:', data.data.email);
          setUser(data.data);
        } else {
          console.warn('⚠️ API returned success=false or no data:', data);
          // Don't set user to null here - keep existing user state
        }
      } else {
        console.warn('⚠️ API call failed with status:', response.status);
        // Don't set user to null here - keep existing user state
      }
    } catch (error) {
      console.error('❌ Error refreshing user profile (keeping existing auth state):', error);
      // Don't set user to null here - keep existing user state
      // The user is still authenticated via Firebase, just the profile fetch failed
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Handle redirect result first (for Google sign-in redirect flow)
    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing auth context...');
        const redirectResult = await handleRedirectResult();

        if (redirectResult.success && redirectResult.user) {
          console.log('✅ Redirect result processed successfully:', {
            email: redirectResult.user.email,
            uid: redirectResult.user.uid
          });
        } else if (!redirectResult.success) {
          console.error('❌ Failed to process redirect result:', redirectResult.error);
        }
      } catch (error) {
        console.error('❌ Error during auth initialization:', error);
      }
    };

    initializeAuth();

    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (!isMounted) return;

      console.log('🔐 Auth state changed:', {
        hasUser: !!firebaseUser,
        email: firebaseUser?.email,
        uid: firebaseUser?.uid,
        displayName: firebaseUser?.displayName,
        timestamp: new Date().toISOString()
      });

      setFirebaseUser(firebaseUser);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Separate effect to handle user refresh when firebaseUser changes
  useEffect(() => {
    if (firebaseUser) {
      refreshUser();
    } else {
      setUser(null);
    }
  }, [firebaseUser]);

  // Fix: Consider user authenticated if Firebase user exists, even if API call failed
  const isAuthenticated = !!firebaseUser;

  const value: AuthContextType = {
    firebaseUser,
    user,
    isLoading,
    isAuthenticated,
    refreshUser,
  };

  // Debug logging for authentication state
  console.log('🔍 AuthContext state:', {
    hasFirebaseUser: !!firebaseUser,
    hasUser: !!user,
    isLoading,
    isAuthenticated,
    firebaseUserEmail: firebaseUser?.email,
    firebaseUserUid: firebaseUser?.uid,
    timestamp: new Date().toISOString()
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
