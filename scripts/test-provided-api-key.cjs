const https = require('https');

const API_KEY = 'AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY';

// Test models to verify
const MODELS_TO_TEST = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

function testModel(modelName) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: "Say 'test successful' if you can read this."
        }]
      }]
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
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 && response.candidates) {
            resolve({
              model: modelName,
              success: true,
              response: response.candidates[0]?.content?.parts[0]?.text || 'No text response'
            });
          } else {
            resolve({
              model: modelName,
              success: false,
              error: response.error?.message || 'Unknown error',
              statusCode: res.statusCode
            });
          }
        } catch (error) {
          resolve({
            model: modelName,
            success: false,
            error: error.message,
            rawData: data
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        model: modelName,
        success: false,
        error: error.message
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🔑 Testing API Key: AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY');
  console.log('📅 Created: July 14, 2025');
  console.log('🏷️  Label: GenAI Key\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    console.log(`\n🧪 Testing model: ${model}...`);
    const result = await testModel(model);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ SUCCESS - ${model}`);
      console.log(`   Response: ${result.response.substring(0, 100)}...`);
    } else {
      console.log(`❌ FAILED - ${model}`);
      console.log(`   Error: ${result.error}`);
      if (result.statusCode) {
        console.log(`   Status Code: ${result.statusCode}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 FINAL RESULTS:\n');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successCount}/${MODELS_TO_TEST.length}`);
  console.log(`❌ Failed: ${failCount}/${MODELS_TO_TEST.length}`);
  
  if (successCount > 0) {
    console.log('\n🎉 API KEY IS VALID AND WORKING!');
    console.log('\n✅ Working models:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.model}`);
    });
    
    if (failCount > 0) {
      console.log('\n⚠️  Failed models (may not be available):');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.model}: ${r.error}`);
      });
    }
    
    console.log('\n🚀 READY TO DEPLOY!');
    console.log('   Next steps:');
    console.log('   1. Update .env file');
    console.log('   2. Update Firebase secret');
    console.log('   3. Deploy functions');
    
    return true;
  } else {
    console.log('\n❌ API KEY FAILED ALL TESTS');
    console.log('\n📋 Action required:');
    console.log('   1. Go to Google AI Studio');
    console.log('   2. Click on the "GenAI Key" row (created July 14, 2025)');
    console.log('   3. Copy the FULL API key from that entry');
    console.log('   4. Provide the complete key');
    
    return false;
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});