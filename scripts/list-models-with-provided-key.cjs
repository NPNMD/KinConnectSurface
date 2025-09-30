const https = require('https');

const API_KEY = 'AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY';

function listModels() {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  console.log('🔑 API Key: AIzaSyAXoU5jdF4kjF4iBZbSzXw--wWIxnPjpHY');
  console.log('📋 Listing available models...\n');
  
  try {
    const response = await listModels();
    
    if (response.error) {
      console.log('❌ Error:', response.error.message);
      console.log('   Status:', response.error.status);
      console.log('\n⚠️  This API key may not have access to Gemini models.');
      console.log('   Please verify the key has the correct permissions.');
      return;
    }
    
    if (!response.models || response.models.length === 0) {
      console.log('❌ No models available with this API key');
      console.log('\n⚠️  This key may not have Gemini API access enabled.');
      return;
    }
    
    console.log(`✅ Found ${response.models.length} available models:\n`);
    
    const geminiModels = [];
    
    response.models.forEach((model, index) => {
      const name = model.name.replace('models/', '');
      const supportsGenerate = model.supportedGenerationMethods?.includes('generateContent');
      
      console.log(`${index + 1}. ${name}`);
      console.log(`   Display Name: ${model.displayName || 'N/A'}`);
      console.log(`   Description: ${model.description || 'N/A'}`);
      console.log(`   Supports generateContent: ${supportsGenerate ? '✅' : '❌'}`);
      
      if (supportsGenerate) {
        geminiModels.push(name);
      }
      
      console.log('');
    });
    
    if (geminiModels.length > 0) {
      console.log('=' .repeat(60));
      console.log('\n🎉 MODELS THAT SUPPORT TEXT GENERATION:\n');
      geminiModels.forEach(model => {
        console.log(`   ✅ ${model}`);
      });
      console.log('\n🚀 This API key is VALID and READY TO USE!');
    } else {
      console.log('=' .repeat(60));
      console.log('\n⚠️  No models support text generation with this key.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();