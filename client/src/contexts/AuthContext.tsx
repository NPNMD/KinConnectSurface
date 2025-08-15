import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  const refreshUser = async () => {
    if (!firebaseUser) {
      console.log('🔍 AuthContext: No firebaseUser, setting user to null');
      setUser(null);
      return;
    }

    try {
      console.log('🔍 AuthContext: Firebase user found:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified
      });

      const token = await firebaseUser.getIdToken();
      console.log('🔍 AuthContext: Got Firebase ID token, length:', token.length);

      // Fetch user data from our API
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('🔍 AuthContext: Profile API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 AuthContext: Profile API response data:', data);
        if (data.success && data.data) {
          console.log('✅ AuthContext: Setting user data:', data.data);
          setUser(data.data);
        } else {
          console.warn('⚠️ AuthContext: API response successful but no user data:', data);
          setUser(null);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ AuthContext: Profile API failed:', response.status, errorText);
        setUser(null);
      }
    } catch (error) {
      console.error('💥 AuthContext: Error refreshing user:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    // Handle redirect result first (for Google sign-in redirect flow)
    const initializeAuth = async () => {
      try {
        await handleRedirectResult();
      } catch (error) {
        console.error('Error handling redirect result:', error);
      }
    };

    initializeAuth();

    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      console.log('🔍 AuthContext: Auth state changed:', firebaseUser ? 'User signed in' : 'User signed out');
      setFirebaseUser(firebaseUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Separate effect to handle user refresh when firebaseUser changes
  useEffect(() => {
    if (firebaseUser) {
      console.log('🔍 AuthContext: Calling refreshUser for signed in user');
      refreshUser();
    } else {
      console.log('🔍 AuthContext: No user, setting to null');
      setUser(null);
    }
  }, [firebaseUser]);

  const value: AuthContextType = {
    firebaseUser,
    user,
    isLoading,
    isAuthenticated: !!user,
    refreshUser,
  };

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
