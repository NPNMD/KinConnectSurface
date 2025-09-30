const https = require('https');

const API_KEY = 'AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY';
const MODELS_TO_TEST = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash'
];

console.log('🔑 Testing Google AI API Key');
console.log('Key:', API_KEY);
console.log('Bound to: claritystream-uldp9@appspot.gserviceaccount.com');
console.log('='.repeat(60));

function testModel(modelName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: 'Say "Hello, API key test successful!" if you can read this.'
        }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
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
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 && response.candidates) {
            const text = response.candidates[0]?.content?.parts[0]?.text || 'No text';
            resolve({
              success: true,
              model: modelName,
              statusCode: res.statusCode,
              response: text
            });
          } else {
            resolve({
              success: false,
              model: modelName,
              statusCode: res.statusCode,
              error: response.error?.message || 'Unknown error',
              fullResponse: data
            });
          }
        } catch (error) {
          resolve({
            success: false,
            model: modelName,
            statusCode: res.statusCode,
            error: error.message,
            rawData: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        model: modelName,
        error: error.message
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('\n📋 Testing Gemini Models:\n');
  
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    console.log(`Testing ${model}...`);
    try {
      const result = await testModel(model);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${model}: SUCCESS`);
        console.log(`   Response: ${result.response.substring(0, 100)}...`);
      } else {
        console.log(`❌ ${model}: FAILED`);
        console.log(`   Status: ${result.statusCode}`);
        console.log(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ${model}: ERROR`);
      console.log(`   ${error.error || error.message}`);
      results.push(error);
    }
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('\n📊 SUMMARY:\n');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (successCount > 0) {
    console.log('\n✅ API KEY IS VALID AND WORKING!');
    console.log('   The key has access to Gemini models.');
    console.log('   You can proceed with deployment.');
    return true;
  } else {
    console.log('\n❌ API KEY FAILED ALL TESTS');
    console.log('   The key may not have Gemini API access.');
    console.log('   Please check the key permissions.');
    return false;
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});