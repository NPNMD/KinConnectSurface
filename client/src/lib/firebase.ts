import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseConfig } from '@shared/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);

// Initialize Firestore - use default database since we're using "(default)"
export const db = getFirestore(app);

// Log successful initialization
console.log('🔥 Firebase initialized successfully');
console.log('🔥 Project ID:', firebaseConfig.projectId);
console.log('🔥 Auth Domain:', firebaseConfig.authDomain);
console.log('🔥 Database ID: (default)');

// Check if we're in development and should use emulator
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  console.log('🔧 Connecting to Firestore emulator...');
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    console.warn('⚠️ Could not connect to Firestore emulator:', error);
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

// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Get ID token for API calls
export const getIdToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
};
