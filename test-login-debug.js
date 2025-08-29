const { initializeApp } = require('firebase/app');
const { getAuth, GoogleAuthProvider } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');

// Test Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWSNgfOEVh_Q86YWHdiCA8QaYHVUDK4ZY",
  authDomain: "claritystream-uldp9.firebaseapp.com",
  databaseURL: "https://claritystream-uldp9-default-rtdb.firebaseio.com/",
  projectId: "claritystream-uldp9",
  storageBucket: "claritystream-uldp9.firebasestorage.app",
  messagingSenderId: "64645622155",
  appId: "1:64645622155:web:1f8ecfebe7c881a9c8a78e"
};

console.log('🔧 Testing Firebase configuration...');

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');

  // Initialize Auth
  const auth = getAuth(app);
  console.log('✅ Firebase Auth initialized successfully');

  // Test Firestore with default database
  const db = getFirestore(app);
  console.log('✅ Firestore initialized successfully with default database');

  // Test Google Auth Provider
  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('profile');
  googleProvider.addScope('email');
  console.log('✅ Google Auth Provider configured successfully');

  console.log('\n🎉 All Firebase services initialized successfully!');
  console.log('📋 Configuration Summary:');
  console.log('   - Project ID:', firebaseConfig.projectId);
  console.log('   - Auth Domain:', firebaseConfig.authDomain);
  console.log('   - Database: (default)');

} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  console.error('❌ Error details:', error.message);
  console.error('❌ Error code:', error.code);
}