#!/usr/bin/env node

/**
 * Test Gemini API Access
 * 
 * This script tests if the GOOGLE_AI_API_KEY has proper access to Gemini models.
 * It tries multiple model variants to find which ones are accessible.
 */

const https = require('https');
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

function testModel(apiKey, model) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    
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
              model, 
              status: 'success', 
              statusCode: res.statusCode,
              response: response.trim()
            });
          } else {
            resolve({ 
              model, 
              status: 'error', 
              statusCode: res.statusCode,
              error: parsed.error?.message || data.substring(0, 100)
            });
          }
        } catch (e) {
          resolve({ 
            model, 
            status: 'error', 
            statusCode: res.statusCode,
            error: data.substring(0, 100)
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ 
        model, 
        status: 'error', 
        error: error.message 
      });
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  log('═══════════════════════════════════════════════════════════', 'cyan');
  log('  Gemini API Access Test', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  // Read API key from .env
  log('\n📋 Reading GOOGLE_AI_API_KEY from .env...', 'blue');
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    log('  ❌ .env file not found!', 'red');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envMatch = envContent.match(/GOOGLE_AI_API_KEY=(.+)/);
  
  if (!envMatch) {
    log('  ❌ GOOGLE_AI_API_KEY not found in .env!', 'red');
    return;
  }
  
  const apiKey = envMatch[1].trim();
  log(`  ✅ Found API key: ${apiKey.substring(0, 20)}...`, 'green');

  // Test various model names
  const modelsToTest = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro-001',
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-1.0-pro',
    'gemini-1.0-pro-latest',
  ];

  log('\n🧪 Testing Gemini models...', 'cyan');
  log('  This may take a moment...\n', 'cyan');

  const results = [];
  for (const model of modelsToTest) {
    const result = await testModel(apiKey, model);
    results.push(result);
    
    if (result.status === 'success') {
      log(`  ✅ ${model.padEnd(30)} - ACCESSIBLE (Response: "${result.response}")`, 'green');
    } else if (result.statusCode === 404) {
      log(`  ❌ ${model.padEnd(30)} - NOT FOUND (404)`, 'red');
    } else if (result.statusCode === 403) {
      log(`  ❌ ${model.padEnd(30)} - FORBIDDEN (403)`, 'red');
    } else if (result.statusCode === 400) {
      log(`  ⚠️  ${model.padEnd(30)} - BAD REQUEST (400)`, 'yellow');
    } else {
      log(`  ❌ ${model.padEnd(30)} - ERROR: ${result.error?.substring(0, 50)}`, 'red');
    }
  }

  // Summary
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  TEST SUMMARY', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  const successfulModels = results.filter(r => r.status === 'success');
  const notFoundModels = results.filter(r => r.statusCode === 404);
  const forbiddenModels = results.filter(r => r.statusCode === 403);

  log(`\n✅ Accessible models: ${successfulModels.length}`, successfulModels.length > 0 ? 'green' : 'red');
  if (successfulModels.length > 0) {
    successfulModels.forEach(m => log(`   • ${m.model}`, 'green'));
  }

  log(`\n❌ Not found (404): ${notFoundModels.length}`, notFoundModels.length > 0 ? 'yellow' : 'green');
  if (notFoundModels.length > 0 && notFoundModels.length <= 5) {
    notFoundModels.forEach(m => log(`   • ${m.model}`, 'yellow'));
  }

  log(`\n❌ Forbidden (403): ${forbiddenModels.length}`, forbiddenModels.length > 0 ? 'red' : 'green');
  if (forbiddenModels.length > 0) {
    forbiddenModels.forEach(m => log(`   • ${m.model}`, 'red'));
  }

  // Recommendations
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  RECOMMENDATIONS', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  if (successfulModels.length > 0) {
    log('\n✅ SUCCESS! Your API key has access to Gemini models.', 'green');
    log('\n💡 Update your code to use one of these working models:', 'cyan');
    successfulModels.forEach(m => log(`   • ${m.model}`, 'blue'));
    
    log('\n📝 Next steps:', 'cyan');
    log('   1. Update functions/src/workers/aiSummarizationWorker.ts', 'blue');
    log(`   2. Change MODEL_PRIORITY to use: "${successfulModels[0].model}"`, 'blue');
    log('   3. Redeploy: firebase deploy --only functions:summarizeVisit', 'blue');
  } else if (notFoundModels.length === modelsToTest.length) {
    log('\n❌ PROBLEM: All models returned 404 errors.', 'red');
    log('\n💡 This means the API key does NOT have Gemini API access.', 'yellow');
    log('\n📋 To fix this:', 'cyan');
    log('   1. Go to: https://aistudio.google.com/app/apikey', 'blue');
    log('   2. Create a NEW API key (this ensures Gemini access)', 'blue');
    log('   3. Update your .env file with the new key', 'blue');
    log('   4. Run: node scripts/fix-firebase-secret.cjs', 'blue');
    log('   5. Redeploy: firebase deploy --only functions:summarizeVisit', 'blue');
  } else if (forbiddenModels.length > 0) {
    log('\n❌ PROBLEM: API key lacks permission for these models.', 'red');
    log('\n💡 Check API key restrictions:', 'yellow');
    log('   1. Go to: https://console.cloud.google.com/apis/credentials', 'blue');
    log('   2. Find your API key and click "Edit"', 'blue');
    log('   3. Under "API restrictions", ensure "Generative Language API" is allowed', 'blue');
  } else {
    log('\n⚠️  Mixed results. Some models work, others don\'t.', 'yellow');
    log('   Use the working models listed above.', 'yellow');
  }

  log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});