#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Visit Recording Architecture...');

async function deployVisitRecording() {
  try {
    // Step 1: Install new dependencies
    console.log('📦 Installing new dependencies...');
    try {
      execSync('cd functions && npm install @google-cloud/pubsub @google-cloud/storage', { stdio: 'inherit' });
      console.log('✅ Dependencies installed');
    } catch (error) {
      console.error('❌ Failed to install dependencies:', error.message);
      throw error;
    }

    // Step 2: Build functions
    console.log('🔨 Building functions...');
    try {
      execSync('cd functions && npm run build', { stdio: 'inherit' });
      console.log('✅ Functions built successfully');
    } catch (error) {
      console.error('❌ Failed to build functions:', error.message);
      throw error;
    }

    // Step 3: Deploy Firestore rules
    console.log('🔐 Deploying Firestore rules...');
    try {
      execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
      console.log('✅ Firestore rules deployed');
    } catch (error) {
      console.error('❌ Failed to deploy Firestore rules:', error.message);
      throw error;
    }

    // Step 4: Deploy Storage rules
    console.log('📁 Deploying Storage rules...');
    try {
      execSync('firebase deploy --only storage', { stdio: 'inherit' });
      console.log('✅ Storage rules deployed');
    } catch (error) {
      console.error('❌ Failed to deploy Storage rules:', error.message);
      throw error;
    }

    // Step 5: Set up Pub/Sub topics
    console.log('📡 Setting up Pub/Sub topics...');
    try {
      execSync('node scripts/setup-visit-recording.js', { stdio: 'inherit' });
      console.log('✅ Pub/Sub topics created');
    } catch (error) {
      console.error('❌ Failed to setup Pub/Sub topics:', error.message);
      // Don't fail deployment for this
      console.warn('⚠️ Continuing deployment without Pub/Sub setup');
    }

    // Step 6: Deploy functions
    console.log('☁️ Deploying Cloud Functions...');
    try {
      execSync('firebase deploy --only functions', { stdio: 'inherit' });
      console.log('✅ Functions deployed successfully');
    } catch (error) {
      console.error('❌ Failed to deploy functions:', error.message);
      throw error;
    }

    // Step 7: Deploy Firestore indexes
    console.log('📊 Deploying Firestore indexes...');
    try {
      execSync('firebase deploy --only firestore:indexes', { stdio: 'inherit' });
      console.log('✅ Firestore indexes deployed');
    } catch (error) {
      console.warn('⚠️ Firestore indexes deployment failed (this is normal for first deployment):', error.message);
    }

    console.log('\n🎉 Visit Recording Architecture Deployed Successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test the recording flow in your application');
    console.log('2. Monitor Cloud Function logs for any issues');
    console.log('3. Check Pub/Sub topics in Google Cloud Console');
    console.log('4. Verify Storage and Firestore rules are working');
    console.log('\n🔗 Useful Commands:');
    console.log('- View function logs: firebase functions:log');
    console.log('- Test locally: firebase emulators:start');
    console.log('- Monitor costs: gcloud billing budgets list');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Firebase project configuration');
    console.log('2. Verify Google Cloud APIs are enabled');
    console.log('3. Ensure you have proper IAM permissions');
    console.log('4. Check the error logs above for specific issues');
    process.exit(1);
  }
}

// Run deployment
deployVisitRecording();