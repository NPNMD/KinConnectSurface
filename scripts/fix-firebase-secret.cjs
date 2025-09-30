#!/usr/bin/env node

/**
 * Fix Firebase Secret Script
 * 
 * This script properly sets the GOOGLE_AI_API_KEY secret in Firebase Functions:
 * 1. Reads the key from .env
 * 2. Sets it using Firebase CLI
 * 3. Verifies it was set correctly
 * 4. Provides instructions for redeployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function main() {
  log('═══════════════════════════════════════════════════════════', 'cyan');
  log('  Fix Firebase Secret Tool', 'cyan');
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

  // Step 2: Check current Firebase secret
  log('\n📋 Step 2: Checking current Firebase secret...', 'blue');
  const currentSecretResult = execCommand('firebase functions:secrets:access GOOGLE_AI_API_KEY', true);
  
  if (currentSecretResult.success) {
    const currentKey = currentSecretResult.output.trim();
    log(`  ℹ️  Current secret: ${currentKey.substring(0, 20)}...`, 'cyan');
    
    if (currentKey === apiKey) {
      log('  ✅ Secret already matches .env file!', 'green');
      log('\n💡 The secret is correct. The issue is likely API access.', 'yellow');
      log('   Run: node scripts/diagnose-firebase-secret.cjs', 'yellow');
      return;
    } else {
      log('  ⚠️  Secret does not match .env file', 'yellow');
    }
  } else {
    log('  ℹ️  Secret not currently set', 'cyan');
  }

  // Step 3: Confirm update
  log('\n⚠️  WARNING: This will update the Firebase secret', 'yellow');
  log('   This requires redeploying functions to take effect.', 'yellow');
  
  const answer = await askQuestion('\nDo you want to continue? (yes/no): ');
  
  if (answer !== 'yes' && answer !== 'y') {
    log('\n❌ Operation cancelled', 'red');
    return;
  }

  // Step 4: Set the secret
  log('\n📋 Step 3: Setting Firebase secret...', 'blue');
  log('  This will prompt you to paste the API key...', 'cyan');
  
  // Create a temporary file with the API key
  const tempFile = path.join(process.cwd(), '.temp-api-key');
  fs.writeFileSync(tempFile, apiKey);
  
  try {
    const setResult = execCommand(`firebase functions:secrets:set GOOGLE_AI_API_KEY < ${tempFile}`, false);
    
    if (setResult.success) {
      log('  ✅ Secret set successfully!', 'green');
    } else {
      log('  ❌ Failed to set secret', 'red');
      log(`  Error: ${setResult.error}`, 'red');
      return;
    }
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  // Step 5: Verify the secret
  log('\n📋 Step 4: Verifying secret was set correctly...', 'blue');
  const verifyResult = execCommand('firebase functions:secrets:access GOOGLE_AI_API_KEY', true);
  
  if (verifyResult.success) {
    const newKey = verifyResult.output.trim();
    if (newKey === apiKey) {
      log('  ✅ Secret verified successfully!', 'green');
    } else {
      log('  ⚠️  Secret was set but does not match expected value', 'yellow');
      log(`  Expected: ${apiKey.substring(0, 20)}...`, 'yellow');
      log(`  Got:      ${newKey.substring(0, 20)}...`, 'yellow');
    }
  } else {
    log('  ⚠️  Could not verify secret', 'yellow');
  }

  // Step 6: Instructions for redeployment
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  NEXT STEPS', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  log('\n✅ Secret has been updated in Firebase!', 'green');
  log('\n⚠️  IMPORTANT: You must redeploy functions for changes to take effect:', 'yellow');
  
  log('\n1. Deploy the affected functions:', 'cyan');
  log('   firebase deploy --only functions:summarizeVisit', 'blue');
  
  log('\n2. Or deploy all functions:', 'cyan');
  log('   firebase deploy --only functions', 'blue');
  
  log('\n3. After deployment, test the fix:', 'cyan');
  log('   node scripts/test-gemini-access.cjs', 'blue');
  
  log('\n4. Monitor the logs:', 'cyan');
  log('   firebase functions:log --only summarizeVisit', 'blue');

  log('\n💡 If you still see 404 errors after deployment:', 'yellow');
  log('   The API key may not have Gemini API access enabled.', 'yellow');
  log('   Run: node scripts/diagnose-firebase-secret.cjs', 'yellow');

  log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});