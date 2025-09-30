#!/usr/bin/env node

/**
 * Complete API Key Verification and Deployment Script
 * 
 * This script:
 * 1. Tests the Google AI API key for Gemini access
 * 2. Updates Firebase secret if key is valid
 * 3. Deploys the function
 * 4. Provides clear success/failure messages
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testGeminiAccess(apiKey) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const postData = JSON.stringify({
      contents: [{ 
        parts: [{ text: 'Say "Hello" in one word.' }] 
      }]
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (res.statusCode === 200) {
            const response = parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
            resolve({ 
              success: true, 
              statusCode: res.statusCode,
              response: response.trim()
            });
          } else {
            resolve({ 
              success: false, 
              statusCode: res.statusCode,
              error: parsed.error?.message || data.substring(0, 200)
            });
          }
        } catch (e) {
          resolve({ 
            success: false, 
            statusCode: res.statusCode,
            error: data.substring(0, 200)
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ 
        success: false, 
        error: error.message 
      });
    });

    req.write(postData);
    req.end();
  });
}

function updateFirebaseSecret(apiKey) {
  try {
    log('\n🔐 Updating Firebase secret...', 'blue');
    execSync(`firebase functions:secrets:set GOOGLE_AI_API_KEY --data-file=- <<< "${apiKey}"`, {
      stdio: 'inherit',
      shell: true
    });
    log('  ✅ Firebase secret updated successfully', 'green');
    return true;
  } catch (error) {
    log(`  ❌ Failed to update Firebase secret: ${error.message}`, 'red');
    return false;
  }
}

function deployFunction() {
  try {
    log('\n🚀 Deploying function to Firebase...', 'blue');
    execSync('firebase deploy --only functions:summarizeVisit', {
      stdio: 'inherit'
    });
    log('  ✅ Function deployed successfully', 'green');
    return true;
  } catch (error) {
    log(`  ❌ Deployment failed: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('═══════════════════════════════════════════════════════════', 'cyan');
  log(`${colors.bold}  Google AI API Key Verification & Deployment${colors.reset}`, 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  // Step 1: Read API key from .env
  log('\n📋 Step 1: Reading GOOGLE_AI_API_KEY from .env...', 'blue');
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    log('  ❌ .env file not found!', 'red');
    log('\n💡 Create a .env file with GOOGLE_AI_API_KEY=your_key_here', 'yellow');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envMatch = envContent.match(/GOOGLE_AI_API_KEY=(.+)/);
  
  if (!envMatch) {
    log('  ❌ GOOGLE_AI_API_KEY not found in .env!', 'red');
    log('\n💡 Add GOOGLE_AI_API_KEY=your_key_here to your .env file', 'yellow');
    return;
  }
  
  const apiKey = envMatch[1].trim();
  log(`  ✅ Found API key: ${apiKey.substring(0, 20)}...`, 'green');

  // Step 2: Verify key format
  log('\n🔍 Step 2: Verifying API key format...', 'blue');
  if (!apiKey.startsWith('AIza')) {
    log('  ❌ Invalid API key format!', 'red');
    log(`  Expected format: AIza...`, 'yellow');
    log(`  Your key starts with: ${apiKey.substring(0, 10)}...`, 'yellow');
    log('\n💡 Get a valid key from: https://aistudio.google.com/app/apikey', 'cyan');
    return;
  }
  log('  ✅ API key format is correct (starts with "AIza")', 'green');

  // Step 3: Test Gemini access
  log('\n🧪 Step 3: Testing Gemini API access...', 'blue');
  log('  Attempting to call gemini-1.5-flash model...', 'cyan');
  
  const result = await testGeminiAccess(apiKey);
  
  if (!result.success) {
    log('  ❌ API key does NOT have Gemini access!', 'red');
    log(`  Status: ${result.statusCode || 'Network Error'}`, 'red');
    log(`  Error: ${result.error}`, 'red');
    
    if (result.statusCode === 404) {
      log('\n═══════════════════════════════════════════════════════════', 'yellow');
      log('  ⚠️  PROBLEM IDENTIFIED', 'yellow');
      log('═══════════════════════════════════════════════════════════', 'yellow');
      log('\nYour API key is valid but does NOT have Gemini API access.', 'yellow');
      log('This typically means:', 'yellow');
      log('  • The key is from Google Cloud Console (not Google AI Studio)', 'yellow');
      log('  • Or the Generative Language API is not enabled', 'yellow');
      
      log('\n📋 TO FIX THIS:', 'cyan');
      log('  1. Go to: https://aistudio.google.com/app/apikey', 'blue');
      log('  2. Click "Create API key"', 'blue');
      log('  3. Select your project: claritystream-uldp9', 'blue');
      log('  4. Copy the NEW key (starts with "AIza")', 'blue');
      log('  5. Update .env file: GOOGLE_AI_API_KEY=<new_key>', 'blue');
      log('  6. Run this script again: node scripts/verify-api-key-and-deploy.cjs', 'blue');
    } else if (result.statusCode === 403) {
      log('\n💡 The API key lacks permission. Check API restrictions in:', 'yellow');
      log('  https://console.cloud.google.com/apis/credentials', 'blue');
    }
    return;
  }

  log('  ✅ SUCCESS! API key has Gemini access', 'green');
  log(`  Test response: "${result.response}"`, 'green');

  // Step 4: Update Firebase secret
  log('\n🔐 Step 4: Updating Firebase secret...', 'blue');
  const secretUpdated = updateFirebaseSecret(apiKey);
  
  if (!secretUpdated) {
    log('\n⚠️  Could not update Firebase secret automatically.', 'yellow');
    log('  Run manually: node scripts/fix-firebase-secret.cjs', 'blue');
    return;
  }

  // Step 5: Deploy function
  log('\n🚀 Step 5: Deploying function...', 'blue');
  const deployed = deployFunction();
  
  if (!deployed) {
    log('\n⚠️  Deployment failed. Try manually:', 'yellow');
    log('  firebase deploy --only functions:summarizeVisit', 'blue');
    return;
  }

  // Success summary
  log('\n═══════════════════════════════════════════════════════════', 'green');
  log(`${colors.bold}  ✅ ALL STEPS COMPLETED SUCCESSFULLY!${colors.reset}`, 'green');
  log('═══════════════════════════════════════════════════════════', 'green');
  log('\n✅ API key verified and has Gemini access', 'green');
  log('✅ Firebase secret updated', 'green');
  log('✅ Function deployed', 'green');
  log('\n🎉 Your visit summarization feature should now work!', 'cyan');
  log('\n📝 Next steps:', 'cyan');
  log('  • Test the feature in your app', 'blue');
  log('  • Check Firebase Functions logs if issues occur', 'blue');
  log('  • Monitor usage at: https://aistudio.google.com/app/apikey', 'blue');
  log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});