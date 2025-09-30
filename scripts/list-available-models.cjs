const https = require('https');

const API_KEY = 'AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY';

console.log('🔍 Listing Available Models');
console.log('Key:', API_KEY);
console.log('='.repeat(60));

function listModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models?key=${API_KEY}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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
          
          if (res.statusCode === 200) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              models: response.models || []
            });
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: response.error?.message || 'Unknown error',
              fullResponse: data
            });
          }
        } catch (error) {
          resolve({
            success: false,
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
        error: error.message
      });
    });

    req.end();
  });
}

async function run() {
  console.log('\n📋 Fetching available models...\n');
  
  try {
    const result = await listModels();
    
    if (result.success) {
      console.log(`✅ Successfully retrieved models (Status: ${result.statusCode})\n`);
      
      if (result.models.length === 0) {
        console.log('⚠️  No models available with this API key');
        console.log('   This key may not have Gemini API access enabled.');
        return false;
      }
      
      console.log(`Found ${result.models.length} models:\n`);
      
      const geminiModels = [];
      const otherModels = [];
      
      result.models.forEach(model => {
        const modelInfo = {
          name: model.name,
          displayName: model.displayName,
          supportedMethods: model.supportedGenerationMethods || []
        };
        
        if (model.name.includes('gemini')) {
          geminiModels.push(modelInfo);
        } else {
          otherModels.push(modelInfo);
        }
      });
      
      if (geminiModels.length > 0) {
        console.log('🤖 Gemini Models:');
        geminiModels.forEach(model => {
          console.log(`   ✓ ${model.name}`);
          console.log(`     Display: ${model.displayName}`);
          console.log(`     Methods: ${model.supportedMethods.join(', ')}`);
          console.log('');
        });
      } else {
        console.log('❌ No Gemini models found!');
      }
      
      if (otherModels.length > 0) {
        console.log('\n📦 Other Models:');
        otherModels.forEach(model => {
          console.log(`   • ${model.name}`);
          console.log(`     Display: ${model.displayName}`);
          console.log(`     Methods: ${model.supportedMethods.join(', ')}`);
          console.log('');
        });
      }
      
      console.log('='.repeat(60));
      
      if (geminiModels.length > 0) {
        console.log('\n✅ API KEY HAS GEMINI ACCESS!');
        console.log(`   Found ${geminiModels.length} Gemini model(s)`);
        return true;
      } else {
        console.log('\n❌ API KEY DOES NOT HAVE GEMINI ACCESS');
        console.log('   No Gemini models available');
        return false;
      }
      
    } else {
      console.log(`❌ Failed to retrieve models (Status: ${result.statusCode})`);
      console.log(`   Error: ${result.error}`);
      if (result.fullResponse) {
        console.log(`   Response: ${result.fullResponse}`);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.error || error.message);
    return false;
  }
}

run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});