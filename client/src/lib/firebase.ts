import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { firebaseConfig } from '@shared/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);

// Initialize Firestore with ignoreUndefinedProperties setting
// This prevents errors when undefined values are accidentally sent to Firestore
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

// Initialize Firebase Storage
export const storage = getStorage(app);

// Log successful initialization
console.log('🔥 Firebase initialized successfully');
console.log('🔥 Project ID:', firebaseConfig.projectId);
console.log('🔥 Auth Domain:', firebaseConfig.authDomain);
console.log('🔥 Database ID: (default)');

// Check if we're in development and should use emulator
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  console.log('🔧 Connecting to Firebase emulators...');
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    console.warn('⚠️ Could not connect to Firebase emulators:', error);
  }
}

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure auth settings for better redirect handling
auth.useDeviceLanguage();

// Authentication functions
export const signInWithGoogle = async () => {
  try {
    // Check if there's already a pending redirect
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log('ℹ️ User already authenticated:', currentUser.email);
      return { success: true, user: currentUser };
    }

    // Try popup first, fallback to redirect if popup fails
    console.log('🔐 Starting Google sign-in with popup flow...');
    console.log('🔧 Auth instance configured for domain:', auth.app.options.authDomain);

    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Popup sign-in successful:', {
      user: result.user?.email,
      uid: result.user?.uid,
      displayName: result.user?.displayName
    });
    return { success: true, user: result.user };
  } catch (error: any) {
    console.error('❌ Popup sign-in failed:', error.code, error.message);

    // Check if this is a popup-related error that should trigger redirect
    if (error.code === 'auth/popup-blocked' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request') {

      console.log('🔄 Popup blocked or cancelled, falling back to redirect flow...');

      try {
        await signInWithRedirect(auth, googleProvider);
        console.log('✅ Redirect initiated successfully');
        return { success: true, user: null, redirectInitiated: true }; // User will be available after redirect
      } catch (redirectError: any) {
        console.error('❌ Redirect flow also failed:', redirectError.code, redirectError.message);
        return { success: false, error: redirectError };
      }
    } else {
      console.error('❌ Unexpected popup error:', error.code, error.message);
      return { success: false, error };
    }
  }
};

// Handle redirect result (call this on app initialization)
export const handleRedirectResult = async () => {
  try {
    console.log('🔄 Checking for redirect result...');
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('✅ Redirect result found:', {
        user: result.user?.email,
        uid: result.user?.uid,
        providerData: result.user?.providerData
      });

      // Ensure the user is authenticated
      if (result.user) {
        console.log('🔐 User authenticated successfully after redirect');
        return { success: true, user: result.user };
      } else {
        console.warn('⚠️ Redirect result found but no user data');
        return { success: false, error: new Error('No user data in redirect result') };
      }
    }
    console.log('ℹ️ No redirect result found (normal for direct page loads)');
    return { success: true, user: null };
  } catch (error: any) {
    console.error('❌ Error handling redirect result:', error);

    // Handle specific Firebase auth errors
    if (error.code === 'auth/popup-blocked') {
      console.warn('⚠️ Popup was blocked, user should try again');
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.warn('⚠️ Popup was closed by user');
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.warn('⚠️ Another popup is already open');
    } else if (error.code === 'auth/network-request-failed') {
      console.error('❌ Network error during authentication');
    } else {
      console.error('❌ Unexpected error code:', error.code);
      console.error('❌ Error message:', error.message);
    }

    return { success: false, error };
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error };
  }
};

// Email/Password Authentication Functions
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    console.log('📧 Starting email sign-up process...');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Send verification email
    await sendEmailVerification(result.user);
    console.log('✅ Sign-up successful, verification email sent to:', email);
    
    return {
      success: true,
      user: result.user,
      needsVerification: true
    };
  } catch (error: any) {
    console.error('❌ Email sign-up failed:', error.code, error.message);
    return { success: false, error };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    console.log('📧 Starting email sign-in process...');
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if email is verified
    if (!result.user.emailVerified) {
      console.warn('⚠️ Email not verified for user:', email);
      return {
        success: true,
        user: result.user,
        needsVerification: true
      };
    }
    
    console.log('✅ Email sign-in successful:', email);
    return { success: true, user: result.user };
  } catch (error: any) {
    console.error('❌ Email sign-in failed:', error.code, error.message);
    return { success: false, error };
  }
};

export const sendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: new Error('No user logged in') };
    }
    
    if (user.emailVerified) {
      return { success: true, alreadyVerified: true };
    }
    
    await sendEmailVerification(user);
    console.log('✅ Verification email sent to:', user.email);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error);
    return { success: false, error };
  }
};

export const resetPassword = async (email: string) => {
  try {
    console.log('🔑 Sending password reset email to:', email);
    await sendPasswordResetEmail(auth, email);
    console.log('✅ Password reset email sent');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Password reset failed:', error.code, error.message);
    return { success: false, error };
  }
};

export const checkEmailVerification = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  
  // Reload user to get latest verification status
  await user.reload();
  return user.emailVerified;
};

// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Get ID token for API calls with refresh and validation
export const getIdToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('🔐 No authenticated user found when requesting ID token');
      return null;
    }

    // Force refresh token if requested or if token is close to expiry
    const token = await user.getIdToken(forceRefresh);
    
    // Validate token format (basic check)
    if (!token || typeof token !== 'string' || token.length < 100) {
      console.error('🔐 Invalid token format received');
      return null;
    }

    // Check if token is expired by parsing the payload (basic validation)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < now) {
        console.warn('🔐 Token is expired, forcing refresh');
        return await user.getIdToken(true); // Force refresh
      }
      
      // If token expires within 5 minutes, proactively refresh
      if (payload.exp && payload.exp - now < 300) {
        console.log('🔐 Token expires soon, proactively refreshing');
        return await user.getIdToken(true);
      }
    } catch (parseError) {
      console.warn('🔐 Could not parse token payload for validation:', parseError);
      // Continue with token as-is if parsing fails
    }

    console.log('🔐 Valid token obtained for user:', user.email);
    return token;
  } catch (error: any) {
    console.error('🔐 Error getting ID token:', error);
    
    // Handle specific auth errors
    if (error.code === 'auth/user-token-expired') {
      console.log('🔐 Token expired, attempting refresh');
      try {
        const user = auth.currentUser;
        if (user) {
          return await user.getIdToken(true);
        }
      } catch (refreshError) {
        console.error('🔐 Failed to refresh expired token:', refreshError);
      }
    }
    
    return null;
  }
};

// Validate current authentication state
export const validateAuthState = async (): Promise<{ isValid: boolean; user: User | null; error?: string }> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { isValid: false, user: null, error: 'No authenticated user' };
    }

    // Try to get a fresh token to validate auth state
    const token = await getIdToken(false);
    if (!token) {
      return { isValid: false, user: null, error: 'Could not obtain valid token' };
    }

    return { isValid: true, user };
  } catch (error: any) {
    console.error('🔐 Auth state validation failed:', error);
    return { isValid: false, user: null, error: error.message || 'Authentication validation failed' };
  }
};
