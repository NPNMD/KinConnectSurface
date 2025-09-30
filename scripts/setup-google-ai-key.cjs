#!/usr/bin/env node

/**
 * Interactive Google AI API Key Setup Script
 * 
 * This script helps you:
 * 1. Enter and validate your Google AI API key
 * 2. Test the key to ensure it works
 * 3. Add it to your .env file
 * 4. Provide instructions for Firebase deployment
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logHeader(message) {
  console.log();
  log(`${'='.repeat(60)}`, colors.bright);
  log(message, colors.bright);
  log(`${'='.repeat(60)}`, colors.bright);
  console.log();
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function validateApiKey(key) {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'API key cannot be empty' };
  }
  
  const trimmedKey = key.trim();
  
  if (trimmedKey === 'your_google_ai_api_key_here') {
    return { valid: false, error: 'Please replace the placeholder with your actual API key' };
  }
  
  if (!trimmedKey.startsWith('AIza')) {
    return { valid: false, error: 'Google AI API keys should start with "AIza"' };
  }
  
  if (trimmedKey.length < 30) {
    return { valid: false, error: 'API key seems too short. Google AI keys are typically 39 characters' };
  }
  
  return { valid: true, key: trimmedKey };
}

function testApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    const testPrompt = 'Say "Hello" in one word.';
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: testPrompt
        }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.candidates && response.candidates.length > 0) {
              resolve({ success: true, response: data });
            } else {
              reject(new Error('API returned unexpected response format'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        } else if (res.statusCode === 400) {
          reject(new Error('Invalid API key or malformed request'));
        } else if (res.statusCode === 403) {
          reject(new Error('API key is valid but Generative Language API is not enabled'));
        } else if (res.statusCode === 429) {
          reject(new Error('Rate limit exceeded. Please try again in a moment'));
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Network error: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

function updateEnvFile(apiKey) {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found in current directory');
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if GOOGLE_AI_API_KEY already exists
  const keyPattern = /^GOOGLE_AI_API_KEY=.*$/m;
  
  if (keyPattern.test(envContent)) {
    // Replace existing key
    envContent = envContent.replace(keyPattern, `GOOGLE_AI_API_KEY=${apiKey}`);
    logInfo('Updated existing GOOGLE_AI_API_KEY in .env file');
  } else {
    logWarning('GOOGLE_AI_API_KEY not found in .env file');
    return false;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  return true;
}

async function main() {
  try {
    logHeader('Google AI API Key Setup for KinConnect');
    
    log('This script will help you set up your Google AI (Gemini) API key for', colors.cyan);
    log('generating AI-powered visit summaries in KinConnect.', colors.cyan);
    console.log();
    
    // Step 1: Get API Key
    logInfo('Step 1: Obtain your Google AI API Key');
    console.log();
    log('If you don\'t have an API key yet:', colors.yellow);
    log('  1. Visit: https://aistudio.google.com/', colors.yellow);
    log('  2. Sign in with your Google account', colors.yellow);
    log('  3. Click "Get API Key" in the left sidebar', colors.yellow);
    log('  4. Create a new API key or use an existing one', colors.yellow);
    log('  5. Make sure the "Generative Language API" is enabled', colors.yellow);
    console.log();
    
    const apiKey = await question('Enter your Google AI API key: ');
    console.log();
    
    // Step 2: Validate API Key
    logInfo('Step 2: Validating API key format...');
    const validation = validateApiKey(apiKey);
    
    if (!validation.valid) {
      logError(`Validation failed: ${validation.error}`);
      rl.close();
      process.exit(1);
    }
    
    logSuccess('API key format is valid');
    console.log();
    
    // Step 3: Test API Key
    logInfo('Step 3: Testing API key with Google AI...');
    log('Making a test request to verify the key works...', colors.cyan);
    
    try {
      await testApiKey(validation.key);
      logSuccess('API key test successful! The key is working correctly.');
    } catch (error) {
      logError(`API key test failed: ${error.message}`);
      console.log();
      logWarning('Common issues:');
      log('  • The Generative Language API may not be enabled', colors.yellow);
      log('  • The API key may be invalid or revoked', colors.yellow);
      log('  • There may be billing issues with your Google Cloud project', colors.yellow);
      console.log();
      
      const continueAnyway = await question('Do you want to continue anyway? (y/N): ');
      if (continueAnyway.toLowerCase() !== 'y') {
        log('Setup cancelled.', colors.yellow);
        rl.close();
        process.exit(1);
      }
    }
    console.log();
    
    // Step 4: Update .env file
    logInfo('Step 4: Updating .env file...');
    
    try {
      const updated = updateEnvFile(validation.key);
      if (updated) {
        logSuccess('Successfully updated .env file with your API key');
      } else {
        logError('Could not find GOOGLE_AI_API_KEY in .env file');
        log('Please manually add this line to your .env file:', colors.yellow);
        log(`GOOGLE_AI_API_KEY=${validation.key}`, colors.bright);
      }
    } catch (error) {
      logError(`Failed to update .env file: ${error.message}`);
      log('Please manually add this line to your .env file:', colors.yellow);
      log(`GOOGLE_AI_API_KEY=${validation.key}`, colors.bright);
    }
    console.log();
    
    // Step 5: Firebase Setup Instructions
    logHeader('Next Steps: Firebase Configuration');
    
    log('Your API key has been added to the local .env file.', colors.green);
    log('Now you need to set it as a Firebase Function secret:', colors.cyan);
    console.log();
    
    log('Run this command:', colors.bright);
    log('  firebase functions:secrets:set GOOGLE_AI_API_KEY', colors.yellow);
    console.log();
    
    log('When prompted, paste your API key:', colors.cyan);
    log(`  ${validation.key}`, colors.bright);
    console.log();
    
    log('After setting the secret, redeploy the function:', colors.bright);
    log('  firebase deploy --only functions:summarizeVisit', colors.yellow);
    console.log();
    
    logInfo('Additional Information:');
    log('  • The API key is used by the summarizeVisit Cloud Function', colors.cyan);
    log('  • It generates AI summaries of patient visit recordings', colors.cyan);
    log('  • The key is stored securely as a Firebase secret', colors.cyan);
    log('  • Local development uses the .env file', colors.cyan);
    console.log();
    
    logSuccess('Setup complete! Follow the Firebase commands above to finish.');
    
  } catch (error) {
    console.error();
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main();