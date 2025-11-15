import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  // Debug environment variable loading
  console.log('🔍 Checking Firebase service account credentials...');
  console.log('🔍 FIREBASE_SERVICE_ACCOUNT_KEY exists:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log('🔍 FIREBASE_SERVICE_ACCOUNT_KEY length:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0);
  
  let serviceAccount = null;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log('✅ Service account JSON parsed successfully');
      console.log('🔍 Service account project_id:', serviceAccount.project_id);
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', error);
      console.log('🔍 First 100 chars of key:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY.substring(0, 100));
    }
  }

  if (serviceAccount) {
    // Production: use service account
    try {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: 'claritystream-uldp9',
        storageBucket: 'claritystream-uldp9.firebasestorage.app',
      });
      console.log('✅ Firebase Admin initialized with service account credentials');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase with service account:', error);
      // Fallback to development mode
      initializeApp({
        projectId: 'claritystream-uldp9',
        storageBucket: 'claritystream-uldp9.firebasestorage.app',
      });
      console.log('⚠️  Falling back to development mode');
    }
  } else {
    // Development: Create a minimal Firebase app for auth verification only
    // We'll use a mock database service for development
    try {
      initializeApp({
        projectId: 'claritystream-uldp9',
        storageBucket: 'claritystream-uldp9.firebasestorage.app',
      });
      console.log('✅ Firebase Admin initialized for auth verification only');
      console.log('⚠️  Using mock database service for development');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      console.log('💡 For full functionality, set up Firebase service account credentials');
    }
  }
}

// Export Firebase Admin services
export const adminAuth = getAuth();

// For development, we'll export a mock database if Firestore fails
let adminDb: any;
let adminStorage: any;

try {
  adminDb = getFirestore();
  // Enable ignoreUndefinedProperties to prevent Firestore errors
  adminDb.settings({ ignoreUndefinedProperties: true });
  adminStorage = getStorage();
  console.log('✅ Firestore settings configured: ignoreUndefinedProperties enabled');
} catch (error) {
  console.log('⚠️  Firestore connection failed, using mock database for development');
  // Create a mock database service for development
  adminDb = createMockFirestore();
  adminStorage = null;
}

export { adminDb, adminStorage };

// Mock Firestore implementation for development
function createMockFirestore() {
  const mockData: { [collection: string]: { [id: string]: any } } = {};
  
  return {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
          id: docId,
          set: async (data: any) => {
            if (!mockData[name]) mockData[name] = {};
            mockData[name][docId] = { ...data, id: docId };
            console.log(`📝 Mock DB: Set document ${docId} in collection ${name}`);
            return Promise.resolve();
          },
          get: async () => {
            const data = mockData[name]?.[docId];
            return Promise.resolve({
              exists: !!data,
              data: () => data,
              id: docId
            });
          },
          update: async (updates: any) => {
            if (mockData[name]?.[docId]) {
              mockData[name][docId] = { ...mockData[name][docId], ...updates };
              console.log(`📝 Mock DB: Updated document ${docId} in collection ${name}`);
            }
            return Promise.resolve();
          },
          delete: async () => {
            if (mockData[name]?.[docId]) {
              delete mockData[name][docId];
              console.log(`🗑️ Mock DB: Deleted document ${docId} from collection ${name}`);
            }
            return Promise.resolve();
          }
        };
      },
      where: (field: string, operator: string, value: any) => ({
        limit: (limitNum: number) => ({
          get: async () => {
            const docs = Object.values(mockData[name] || {})
              .filter((doc: any) => {
                if (operator === '==') return doc[field] === value;
                if (operator === 'array-contains') return doc[field]?.includes(value);
                return false;
              })
              .slice(0, limitNum)
              .map((data: any) => ({
                data: () => data,
                id: data.id
              }));
            
            return Promise.resolve({
              empty: docs.length === 0,
              docs
            });
          }
        }),
        get: async () => {
          const docs = Object.values(mockData[name] || {})
            .filter((doc: any) => {
              if (operator === '==') return doc[field] === value;
              if (operator === 'array-contains') return doc[field]?.includes(value);
              if (operator === '>=') return doc[field] >= value;
              if (operator === '<=') return doc[field] <= value;
              return false;
            })
            .map((data: any) => ({
              data: () => data,
              id: data.id
            }));
          
          return Promise.resolve({
            empty: docs.length === 0,
            docs
          });
        }
      }),
      orderBy: (field: string, direction: string = 'asc') => ({
        limit: (limitNum: number) => ({
          offset: (offsetNum: number) => ({
            get: async () => {
              const docs = Object.values(mockData[name] || {})
                .sort((a: any, b: any) => {
                  if (direction === 'desc') return b[field] > a[field] ? 1 : -1;
                  return a[field] > b[field] ? 1 : -1;
                })
                .slice(offsetNum, offsetNum + limitNum)
                .map((data: any) => ({
                  data: () => data,
                  id: data.id
                }));
              
              return Promise.resolve({ docs });
            }
          })
        })
      })
    })
  };
}

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
