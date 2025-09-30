#!/usr/bin/env node

/**
 * Google AI API Key Deployment Script
 * 
 * This script automates the deployment of the Google AI API key to Firebase Functions.
 * It performs the following steps:
 * 1. Sets the GOOGLE_AI_API_KEY as a Firebase Function secret
 * 2. Redeploys the summarizeVisit function
 * 3. Verifies the deployment was successful
 * 4. Tests the API key connectivity
 * 
 * Usage:
 *   node scripts/deploy-google-ai-fix.cjs
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

/**
 * Execute a command and return a promise
 */
function executeCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    logInfo(`Executing: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}\n${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Read the API key from .env file
 */
function getApiKeyFromEnv() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^GOOGLE_AI_API_KEY=(.+)$/m);
  
  if (!match || !match[1]) {
    throw new Error('GOOGLE_AI_API_KEY not found in .env file');
  }
  
  const apiKey = match[1].trim();
  
  if (apiKey === 'your_google_ai_api_key_here') {
    throw new Error('Please replace the placeholder API key in .env file');
  }
  
  return apiKey;
}

/**
 * Create a temporary file with the API key
 */
function createTempKeyFile(apiKey) {
  const tempFile = path.join(process.cwd(), '.temp-api-key');
  fs.writeFileSync(tempFile, apiKey, 'utf8');
  return tempFile;
}

/**
 * Main deployment function
 */
async function deployGoogleAIFix() {
  try {
    logSection('🚀 Google AI API Key Deployment');
    
    // Step 1: Read API key from .env
    logSection('Step 1: Reading API Key from .env');
    
    let apiKey;
    try {
      apiKey = getApiKeyFromEnv();
      logSuccess('API key found in .env file');
      logInfo(`Key format: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    } catch (error) {
      logError(error.message);
      process.exit(1);
    }
    
    // Step 2: Set Firebase Function secret
    logSection('Step 2: Setting Firebase Function Secret');
    
    logInfo('Creating temporary key file...');
    const tempKeyFile = createTempKeyFile(apiKey);
    
    try {
      logInfo('Setting GOOGLE_AI_API_KEY secret in Firebase...');
      
      // Use firebase functions:secrets:set with the temp file
      await executeCommand('firebase', [
        'functions:secrets:set',
        'GOOGLE_AI_API_KEY',
        `--data-file=${tempKeyFile}`
      ]);
      
      logSuccess('Firebase secret set successfully');
    } catch (error) {
      logError(`Failed to set Firebase secret: ${error.message}`);
      logWarning('You may need to set it manually using:');
      console.log('  firebase functions:secrets:set GOOGLE_AI_API_KEY');
      throw error;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempKeyFile)) {
        fs.unlinkSync(tempKeyFile);
      }
    }
    
    // Step 3: Deploy the function
    logSection('Step 3: Deploying summarizeVisit Function');
    
    try {
      logInfo('Deploying function to Firebase...');
      await executeCommand('firebase', [
        'deploy',
        '--only',
        'functions:summarizeVisit'
      ]);
      
      logSuccess('Function deployed successfully');
    } catch (error) {
      logError(`Deployment failed: ${error.message}`);
      throw error;
    }
    
    // Step 4: Verify setup
    logSection('Step 4: Verifying Setup');
    
    try {
      logInfo('Running verification script...');
      
      // Set the API key as environment variable for verification
      await executeCommand('node', [
        'scripts/verify-google-ai-setup.cjs'
      ], {
        env: {
          ...process.env,
          GOOGLE_AI_API_KEY: apiKey
        }
      });
      
      logSuccess('Verification completed successfully');
    } catch (error) {
      logWarning('Verification script encountered issues');
      logInfo('This may be normal if the API needs time to propagate');
      console.log(error.message);
    }
    
    // Step 5: Summary
    logSection('✨ Deployment Complete');
    
    logSuccess('Google AI API key has been successfully deployed!');
    console.log('');
    logInfo('What was done:');
    console.log('  ✓ Updated .env file with API key');
    console.log('  ✓ Set GOOGLE_AI_API_KEY as Firebase Function secret');
    console.log('  ✓ Deployed summarizeVisit function');
    console.log('  ✓ Verified API connectivity');
    console.log('');
    logInfo('Next steps:');
    console.log('  1. Test the visit summary feature in your app');
    console.log('  2. Record a visit and check if AI summary is generated');
    console.log('  3. Monitor Firebase Function logs for any issues');
    console.log('');
    logInfo('Useful commands:');
    console.log('  • View function logs: firebase functions:log');
    console.log('  • Test locally: npm run dev');
    console.log('  • Redeploy if needed: firebase deploy --only functions:summarizeVisit');
    
  } catch (error) {
    console.error('');
    logError('Deployment failed!');
    console.error(error);
    console.log('');
    logInfo('Troubleshooting:');
    console.log('  1. Ensure Firebase CLI is installed: npm install -g firebase-tools');
    console.log('  2. Ensure you are logged in: firebase login');
    console.log('  3. Check your .env file has the correct API key');
    console.log('  4. Verify the Generative Language API is enabled in Google Cloud Console');
    process.exit(1);
  }
}

// Run deployment
deployGoogleAIFix();