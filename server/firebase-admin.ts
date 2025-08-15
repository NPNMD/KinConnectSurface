import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  // For development, we'll use a minimal configuration
  // In production, you would use proper service account credentials
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccount) {
    // Production: use service account
    initializeApp({
      credential: cert(serviceAccount),
      projectId: 'claritystream-uldp9',
      storageBucket: 'claritystream-uldp9.firebasestorage.app',
    });
    console.log('✅ Firebase Admin initialized with service account credentials');
  } else {
    // Development: use application default credentials
    try {
      initializeApp({
        projectId: 'claritystream-uldp9',
        storageBucket: 'claritystream-uldp9.firebasestorage.app',
      });
      console.log('✅ Firebase Admin initialized with Application Default Credentials');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      console.log('💡 Try running: firebase login --reauth');
    }
  }
}

// Export Firebase Admin services
export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminStorage = getStorage();

// Helper function to verify Firebase ID token
export async function verifyIdToken(idToken: string) {
  try {
    console.log('🔍 Firebase Admin: Verifying ID token...');
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    console.log('✅ Firebase Admin: Token verified successfully');
    console.log('🔍 Firebase Admin: Decoded token claims:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      email_verified: decodedToken.email_verified,
      auth_time: decodedToken.auth_time,
      firebase: decodedToken.firebase
    });
    return decodedToken;
  } catch (error) {
    console.error('❌ Firebase Admin: Error verifying ID token:', error);
    return null;
  }
}

// Helper function to get user by ID
export async function getUserById(uid: string) {
  try {
    const userRecord = await adminAuth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}
