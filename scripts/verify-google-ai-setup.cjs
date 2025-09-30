#!/usr/bin/env node

/**
 * Google AI API Setup Verification Script
 * 
 * This script verifies that the Google AI (Gemini) API is properly configured
 * for use in Firebase Functions. It checks:
 * 1. If the GOOGLE_AI_API_KEY is set
 * 2. If the API key is valid
 * 3. Which Gemini models are available
 * 4. If the Generative Language API is enabled
 * 
 * Usage:
 *   node scripts/verify-google-ai-setup.js
 * 
 * Or with a specific API key:
 *   GOOGLE_AI_API_KEY=your_key_here node scripts/verify-google-ai-setup.js
 */

const https = require('https');

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

// Available Gemini models to test
const GEMINI_MODELS = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro-001',
  'gemini-pro'
];

/**
 * Make HTTPS request to Google AI API
 */
function makeRequest(url, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Test if a specific model is available
 */
async function testModel(modelName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: 'Test prompt: respond with OK'
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50
      }
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ 
            statusCode: res.statusCode, 
            data: parsed,
            available: res.statusCode === 200 && parsed.candidates
          });
        } catch (e) {
          resolve({ 
            statusCode: res.statusCode, 
            data: data,
            available: false
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main verification function
 */
async function verifyGoogleAISetup() {
  logSection('🔍 Google AI API Setup Verification');
  
  // Step 1: Check if API key is set
  logSection('Step 1: Checking API Key');
  
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    logError('GOOGLE_AI_API_KEY environment variable is not set');
    logInfo('To set it, run:');
    console.log('  export GOOGLE_AI_API_KEY=your_api_key_here');
    console.log('  # Or for Firebase Functions:');
    console.log('  firebase functions:secrets:set GOOGLE_AI_API_KEY');
    logInfo('\nGet your API key from: https://aistudio.google.com/');
    process.exit(1);
  }
  
  logSuccess('GOOGLE_AI_API_KEY is set');
  logInfo(`Key format: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  
  // Step 2: Validate API key format
  logSection('Step 2: Validating API Key Format');
  
  if (!apiKey.startsWith('AIza')) {
    logWarning('API key does not start with "AIza" - this may not be a valid Google AI API key');
  } else {
    logSuccess('API key format looks correct');
  }
  
  // Step 3: Test API connectivity
  logSection('Step 3: Testing API Connectivity');
  
  try {
    logInfo('Testing connection to Google AI API...');
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await makeRequest(testUrl, apiKey);
    
    if (response.statusCode === 200) {
      logSuccess('Successfully connected to Google AI API');
      
      if (response.data.models && Array.isArray(response.data.models)) {
        logInfo(`Found ${response.data.models.length} available models`);
      }
    } else if (response.statusCode === 403) {
      logError('API key is invalid or API is not enabled');
      logInfo('Please check:');
      console.log('  1. Your API key is correct');
      console.log('  2. The Generative Language API is enabled in Google Cloud Console');
      console.log('  3. Visit: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
      process.exit(1);
    } else if (response.statusCode === 429) {
      logError('Rate limit exceeded');
      logInfo('You have exceeded the API rate limit. Please wait and try again.');
      process.exit(1);
    } else {
      logError(`API request failed with status code: ${response.statusCode}`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    logError(`Failed to connect to Google AI API: ${error.message}`);
    process.exit(1);
  }
  
  // Step 4: Test model availability
  logSection('Step 4: Testing Model Availability');
  
  logInfo('Testing which Gemini models are available...\n');
  
  const availableModels = [];
  const unavailableModels = [];
  
  for (const modelName of GEMINI_MODELS) {
    try {
      process.stdout.write(`  Testing ${modelName}... `);
      const result = await testModel(modelName, apiKey);
      
      if (result.available) {
        console.log(colors.green + '✅ Available' + colors.reset);
        availableModels.push(modelName);
      } else {
        console.log(colors.red + '❌ Not available' + colors.reset);
        unavailableModels.push(modelName);
        
        if (result.data.error) {
          console.log(`    Error: ${result.data.error.message}`);
        }
      }
    } catch (error) {
      console.log(colors.red + '❌ Error' + colors.reset);
      console.log(`    ${error.message}`);
      unavailableModels.push(modelName);
    }
  }
  
  // Step 5: Summary
  logSection('📊 Verification Summary');
  
  if (availableModels.length > 0) {
    logSuccess(`${availableModels.length} model(s) available:`);
    availableModels.forEach(model => {
      console.log(`  • ${model}`);
    });
  } else {
    logError('No models are available');
    logInfo('This likely means the Generative Language API is not enabled.');
    logInfo('Enable it at: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
  }
  
  if (unavailableModels.length > 0) {
    console.log('');
    logWarning(`${unavailableModels.length} model(s) not available:`);
    unavailableModels.forEach(model => {
      console.log(`  • ${model}`);
    });
  }
  
  // Step 6: Recommendations
  logSection('💡 Recommendations');
  
  if (availableModels.length > 0) {
    logSuccess('Your Google AI API is properly configured!');
    console.log('');
    logInfo('Recommended model for production: ' + availableModels[0]);
    console.log('');
    logInfo('Next steps:');
    console.log('  1. Set the API key as a Firebase Function secret:');
    console.log('     firebase functions:secrets:set GOOGLE_AI_API_KEY');
    console.log('  2. Deploy your functions:');
    console.log('     firebase deploy --only functions');
    console.log('  3. Test the visit summary feature in your app');
  } else {
    logError('Setup is incomplete');
    console.log('');
    logInfo('Required actions:');
    console.log('  1. Enable the Generative Language API:');
    console.log('     https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
    console.log('  2. Wait 5-10 minutes for the API to be fully enabled');
    console.log('  3. Run this verification script again');
  }
  
  logSection('✨ Verification Complete');
  
  process.exit(availableModels.length > 0 ? 0 : 1);
}

// Run verification
verifyGoogleAISetup().catch(error => {
  console.error('');
  logError('Verification failed with error:');
  console.error(error);
  process.exit(1);
});