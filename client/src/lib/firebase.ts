import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@shared/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Authentication functions
export const signInWithGoogle = async () => {
  try {
    console.log('🔍 Firebase: Starting Google sign-in with popup...');
    
    // Try popup first, fallback to redirect if needed
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Firebase: Popup sign-in successful:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      });
      return { success: true, user: result.user };
    } catch (popupError: any) {
      console.warn('⚠️ Firebase: Popup failed, trying redirect...', popupError);
      
      // Fallback to redirect if popup fails
      await signInWithRedirect(auth, googleProvider);
      console.log('✅ Firebase: Redirect initiated successfully');
      return { success: true, user: null }; // User will be available after redirect
    }
  } catch (error: any) {
    console.error('❌ Firebase: Google sign-in failed:', error);
    return { success: false, error };
  }
};

// Handle redirect result (call this on app initialization)
export const handleRedirectResult = async () => {
  try {
    console.log('🔍 Firebase: Checking for redirect result...');
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('✅ Firebase: Redirect result found:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      });
      return { success: true, user: result.user };
    }
    console.log('🔍 Firebase: No redirect result found');
    return { success: true, user: null };
  } catch (error) {
    console.error('❌ Firebase: Error handling redirect result:', error);
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
