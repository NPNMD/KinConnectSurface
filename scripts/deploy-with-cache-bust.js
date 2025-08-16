#!/usr/bin/env node

/**
 * Deployment script with cache busting for KinConnect
 * This script ensures that service workers and cached content are properly updated
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting KinConnect deployment with cache busting...\n');

// Step 1: Clean previous build
console.log('1️⃣ Cleaning previous build...');
try {
  execSync('npm run clean', { stdio: 'inherit' });
  console.log('✅ Build cleaned successfully\n');
} catch (error) {
  console.error('❌ Failed to clean build:', error.message);
  process.exit(1);
}

// Step 2: Update service worker with timestamp
console.log('2️⃣ Updating service worker with cache busting...');
try {
  const swPath = path.join(__dirname, '../client/public/sw.js');
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Update cache names with current timestamp
  const timestamp = Date.now();
  swContent = swContent.replace(
    /const CACHE_NAME = 'kinconnect-v' \+ Date\.now\(\);/,
    `const CACHE_NAME = 'kinconnect-v${timestamp}';`
  );
  swContent = swContent.replace(
    /const STATIC_CACHE_NAME = 'kinconnect-static-v' \+ Date\.now\(\);/,
    `const STATIC_CACHE_NAME = 'kinconnect-static-v${timestamp}';`
  );
  
  fs.writeFileSync(swPath, swContent);
  console.log(`✅ Service worker updated with timestamp: ${timestamp}\n`);
} catch (error) {
  console.error('❌ Failed to update service worker:', error.message);
  process.exit(1);
}

// Step 3: Build the application
console.log('3️⃣ Building application...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Application built successfully\n');
} catch (error) {
  console.error('❌ Failed to build application:', error.message);
  process.exit(1);
}

// Step 4: Deploy to Firebase
console.log('4️⃣ Deploying to Firebase...');
try {
  execSync('firebase deploy --only hosting,functions', { stdio: 'inherit' });
  console.log('✅ Deployed to Firebase successfully\n');
} catch (error) {
  console.error('❌ Failed to deploy to Firebase:', error.message);
  process.exit(1);
}

// Step 5: Restore service worker to dynamic version
console.log('5️⃣ Restoring service worker to dynamic version...');
try {
  const swPath = path.join(__dirname, '../client/public/sw.js');
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Restore dynamic cache names
  swContent = swContent.replace(
    /const CACHE_NAME = 'kinconnect-v\d+';/,
    "const CACHE_NAME = 'kinconnect-v' + Date.now();"
  );
  swContent = swContent.replace(
    /const STATIC_CACHE_NAME = 'kinconnect-static-v\d+';/,
    "const STATIC_CACHE_NAME = 'kinconnect-static-v' + Date.now();"
  );
  
  fs.writeFileSync(swPath, swContent);
  console.log('✅ Service worker restored to dynamic version\n');
} catch (error) {
  console.error('❌ Failed to restore service worker:', error.message);
  // Don't exit on this error as deployment was successful
}

console.log('🎉 Deployment completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Clear browser cache or use incognito mode to test');
console.log('2. Test invitation links: https://claritystream-uldp9.web.app/invitation/[token]');
console.log('3. Verify service worker update notifications work');
console.log('\n🔧 If users still see old content:');
console.log('- They should see an "App Update Available" notification');
console.log('- Clicking "Update Now" will refresh to the latest version');
console.log('- Or they can manually clear browser cache');