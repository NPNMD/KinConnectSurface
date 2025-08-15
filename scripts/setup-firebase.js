#!/usr/bin/env node

/**
 * Firebase Setup Helper Script
 *
 * This script helps you set up Firebase service account credentials
 * for production Firestore access.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔥 Firebase Setup Helper for KinConnect\n');

console.log('To set up Firebase service account credentials for production:');
console.log('');
console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
console.log('2. Select your project: claritystream-uldp9');
console.log('3. Click the gear icon ⚙️ > Project Settings');
console.log('4. Go to the "Service Accounts" tab');
console.log('5. Click "Generate new private key"');
console.log('6. Download the JSON file');
console.log('7. Copy the entire JSON content');
console.log('8. Add it to your .env file as FIREBASE_SERVICE_ACCOUNT_KEY');
console.log('');

// Check if .env file exists
const envPath = path.join(path.dirname(__dirname), '.env');
const envExamplePath = path.join(path.dirname(__dirname), '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  
  if (fs.existsSync(envExamplePath)) {
    console.log('📋 Copying .env.example to .env...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from .env.example');
  } else {
    console.log('❌ .env.example file not found either!');
    process.exit(1);
  }
} else {
  console.log('✅ .env file found');
}

// Check if Firebase service account key is already set
const envContent = fs.readFileSync(envPath, 'utf8');
const hasFirebaseKey = envContent.includes('FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account"');

if (hasFirebaseKey) {
  console.log('✅ Firebase service account key appears to be already configured');
  console.log('');
  console.log('To test the connection, restart your server:');
  console.log('  npm run dev');
  console.log('');
  console.log('You should see:');
  console.log('  ✅ Firebase Admin initialized with service account credentials');
  console.log('  🚀 KinConnect server running on port 5000');
} else {
  console.log('⚠️  Firebase service account key not found in .env file');
  console.log('');
  console.log('After downloading the service account JSON file, add this line to your .env:');
  console.log('');
  console.log('FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"claritystream-uldp9",...}');
  console.log('');
  console.log('Replace the ... with the actual JSON content from the downloaded file.');
  console.log('');
  console.log('⚠️  IMPORTANT: Make sure the JSON is on a single line with no line breaks!');
}

console.log('');
console.log('📖 For detailed instructions, see: FIREBASE_SETUP.md');
console.log('');
console.log('🔒 Security reminder:');
console.log('   - Never commit service account keys to version control');
console.log('   - The .env file is already in .gitignore');
console.log('   - Use environment variables in production');