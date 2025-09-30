const https = require('https');

const API_KEY = 'AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY';

// Test with the actual available models
const MODELS_TO_TEST = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash'
];

function testModel(modelName) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: "Respond with exactly: 'API key working perfectly!'"
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
            error: error.message
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
  console.log('🎉 TESTING WORKING API KEY');
  console.log('🔑 Key: AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    console.log(`\n🧪 Testing ${model}...`);
    const result = await testModel(model);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ SUCCESS!`);
      console.log(`   Response: ${result.response}`);
    } else {
      console.log(`❌ FAILED`);
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 FINAL RESULTS:\n');
  
  const successCount = results.filter(r => r.success).length;
  
  console.log(`✅ Successful: ${successCount}/${MODELS_TO_TEST.length}`);
  
  if (successCount === MODELS_TO_TEST.length) {
    console.log('\n🎉🎉🎉 ALL TESTS PASSED! 🎉🎉🎉');
    console.log('\n✅ API key is fully functional!');
    console.log('✅ Ready to deploy to production!');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed');
    return false;
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
});