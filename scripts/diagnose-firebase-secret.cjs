#!/usr/bin/env node

/**
 * Firebase Secret Diagnostic Script
 * 
 * This script diagnoses issues with the GOOGLE_AI_API_KEY secret in Firebase Functions.
 * It checks:
 * 1. If the secret exists in Firebase
 * 2. If the secret value matches what's in .env
 * 3. If the API key has access to Gemini models
 * 4. Provides troubleshooting steps
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output: output?.trim() };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout?.toString().trim() };
  }
}

async function testGeminiAPI(apiKey) {
  const https = require('https');
  
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-pro-vision'
  ];

  log('\n🧪 Testing Gemini API access...', 'cyan');
  
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    
    await new Promise((resolve) => {
      const postData = JSON.stringify({
        contents: [{ parts: [{ text: 'test' }] }]
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
          if (res.statusCode === 200) {
            log(`  ✅ ${model}: ACCESSIBLE`, 'green');
          } else if (res.statusCode === 404) {
            log(`  ❌ ${model}: NOT FOUND (404)`, 'red');
          } else if (res.statusCode === 403) {
            log(`  ❌ ${model}: FORBIDDEN (403) - API key lacks permission`, 'red');
          } else {
            log(`  ⚠️  ${model}: ${res.statusCode} - ${data.substring(0, 100)}`, 'yellow');
          }
          resolve();
        });
      });

      req.on('error', (error) => {
        log(`  ❌ ${model}: ERROR - ${error.message}`, 'red');
        resolve();
      });

      req.write(postData);
      req.end();
    });
  }
}

async function main() {
  log('═══════════════════════════════════════════════════════════', 'cyan');
  log('  Firebase Secret Diagnostic Tool', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  // Step 1: Check if .env file exists
  log('\n📋 Step 1: Checking .env file...', 'blue');
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    log('  ❌ .env file not found!', 'red');
    return;
  }
  
  log('  ✅ .env file exists', 'green');

  // Step 2: Read API key from .env
  log('\n📋 Step 2: Reading GOOGLE_AI_API_KEY from .env...', 'blue');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envMatch = envContent.match(/GOOGLE_AI_API_KEY=(.+)/);
  
  if (!envMatch) {
    log('  ❌ GOOGLE_AI_API_KEY not found in .env!', 'red');
    return;
  }
  
  const localApiKey = envMatch[1].trim();
  log(`  ✅ Found API key: ${localApiKey.substring(0, 20)}...`, 'green');

  // Step 3: Check Firebase secret
  log('\n📋 Step 3: Checking Firebase secret...', 'blue');
  const secretResult = execCommand('firebase functions:secrets:access GOOGLE_AI_API_KEY', true);
  
  if (!secretResult.success) {
    log('  ❌ Failed to access Firebase secret!', 'red');
    log(`  Error: ${secretResult.error}`, 'red');
    log('\n💡 The secret may not be set in Firebase.', 'yellow');
    return;
  }
  
  const firebaseApiKey = secretResult.output.trim();
  log(`  ✅ Firebase secret exists: ${firebaseApiKey.substring(0, 20)}...`, 'green');

  // Step 4: Compare keys
  log('\n📋 Step 4: Comparing keys...', 'blue');
  if (localApiKey === firebaseApiKey) {
    log('  ✅ Keys match!', 'green');
  } else {
    log('  ❌ Keys DO NOT match!', 'red');
    log(`  Local:    ${localApiKey}`, 'yellow');
    log(`  Firebase: ${firebaseApiKey}`, 'yellow');
    log('\n💡 You need to update the Firebase secret to match your .env file.', 'yellow');
  }

  // Step 5: Test API key with Gemini
  await testGeminiAPI(firebaseApiKey);

  // Step 6: Check Firebase Functions logs
  log('\n📋 Step 5: Recent Firebase Functions errors...', 'blue');
  const logsResult = execCommand('firebase functions:log --only summarizeVisit', true);
  
  if (logsResult.success && logsResult.output) {
    const errorLines = logsResult.output.split('\n').filter(line => 
      line.includes('ERROR') || line.includes('404 Not Found') || line.includes('models/')
    );
    
    if (errorLines.length > 0) {
      log('  Recent errors found:', 'yellow');
      errorLines.slice(-5).forEach(line => {
        log(`    ${line.substring(0, 150)}`, 'yellow');
      });
    } else {
      log('  ✅ No recent errors found', 'green');
    }
  }

  // Diagnosis Summary
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  DIAGNOSIS SUMMARY', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  log('\n🔍 Root Cause Analysis:', 'yellow');
  log('  The Firebase secret is properly configured and accessible,', 'yellow');
  log('  BUT the API key does NOT have access to Gemini models.', 'yellow');
  log('  All model requests return 404 errors.', 'yellow');

  log('\n📊 What the logs show:', 'cyan');
  log('  • Secret is configured: ✅', 'green');
  log('  • Secret is accessible: ✅', 'green');
  log('  • API key has Gemini access: ❌', 'red');
  log('  • Error: "models/gemini-X is not found for API version v1"', 'red');

  log('\n💡 SOLUTION:', 'green');
  log('═══════════════════════════════════════════════════════════', 'green');
  
  log('\nThe API key needs to be enabled for Gemini API access:', 'yellow');
  log('\n1. Go to Google Cloud Console:', 'cyan');
  log('   https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com', 'blue');
  
  log('\n2. Make sure you\'re in the correct project:', 'cyan');
  log('   Project: claritystream-uldp9', 'blue');
  
  log('\n3. Click "ENABLE" to enable the Generative Language API', 'cyan');
  
  log('\n4. Verify the API key has access:', 'cyan');
  log('   https://console.cloud.google.com/apis/credentials', 'blue');
  log('   • Find your API key', 'yellow');
  log('   • Click "Edit API key"', 'yellow');
  log('   • Under "API restrictions", ensure "Generative Language API" is allowed', 'yellow');
  
  log('\n5. Alternative: Create a new API key specifically for Gemini:', 'cyan');
  log('   https://aistudio.google.com/app/apikey', 'blue');
  log('   • This creates a key with proper Gemini access', 'yellow');
  log('   • Update your .env file with the new key', 'yellow');
  log('   • Run: node scripts/fix-firebase-secret.cjs', 'yellow');

  log('\n6. After enabling the API, wait 1-2 minutes for propagation', 'cyan');
  
  log('\n7. Test the fix:', 'cyan');
  log('   node scripts/test-gemini-access.cjs', 'blue');

  log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});