const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin with service account
const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

async function testSpeechToTextAPI() {
  try {
    console.log('🧪 Testing Speech-to-Text API directly...');
    
    // Import Google Speech-to-Text
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();
    
    console.log('✅ Speech client initialized');
    
    // Test 1: Check if client can connect
    try {
      const projectId = await client.getProjectId();
      console.log('🏗️ Connected to project:', projectId);
    } catch (error) {
      console.error('❌ Failed to get project ID:', error.message);
      return;
    }
    
    // Test 2: Test with minimal audio (silence)
    console.log('\n🔧 Test 2: Testing with silence...');
    const silenceBuffer = Buffer.alloc(1024, 0);
    
    const silenceRequest = {
      audio: { content: silenceBuffer },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_long',
        useEnhanced: true,
      },
    };
    
    try {
      const [silenceResponse] = await client.recognize(silenceRequest);
      console.log('✅ Silence test response:', {
        resultsCount: silenceResponse.results?.length || 0,
        hasTranscription: !!(silenceResponse.results?.[0]?.alternatives?.[0]?.transcript)
      });
    } catch (error) {
      console.error('❌ Silence test failed:', error.message);
    }
    
    // Test 3: Test with different configurations
    console.log('\n🔧 Test 3: Testing different configurations...');
    const configs = [
      {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        model: 'latest_long'
      },
      {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 16000,
        model: 'latest_short'
      },
      {
        encoding: 'OGG_OPUS',
        sampleRateHertz: 48000,
        model: 'latest_long'
      }
    ];
    
    for (const config of configs) {
      console.log(`\n🔧 Testing config:`, config);
      
      try {
        const request = {
          audio: { content: silenceBuffer },
          config: {
            ...config,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            useEnhanced: true
          }
        };
        
        const [response] = await client.recognize(request);
        console.log(`✅ Config works:`, {
          resultsCount: response.results?.length || 0,
          hasTranscription: !!(response.results?.[0]?.alternatives?.[0]?.transcript)
        });
        
      } catch (error) {
        console.log(`❌ Config failed:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Speech-to-Text test failed:', error);
  }
}

async function testTranscriptionEndpoint() {
  try {
    console.log('\n🧪 Testing transcription endpoint...');
    
    // Get a valid Firebase token (you'll need to copy this from browser console)
    console.log('⚠️ To test the endpoint, you need a valid Firebase token from the browser console');
    console.log('1. Open browser console on your app');
    console.log('2. Run: await firebase.auth().currentUser.getIdToken()');
    console.log('3. Copy the token and replace "YOUR_TOKEN_HERE" below');
    
    const testToken = 'YOUR_TOKEN_HERE'; // Replace with actual token
    
    if (testToken === 'YOUR_TOKEN_HERE') {
      console.log('⏭️ Skipping endpoint test - no token provided');
      return;
    }
    
    // Create test audio data
    const testAudioData = Buffer.from('test audio data').toString('base64');
    
    const apiUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/audio/transcribe';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({
        audioData: testAudioData,
        patientId: 'test-patient-id',
        audioQuality: 'test'
      })
    });
    
    console.log('📊 Endpoint response status:', response.status, response.statusText);
    
    const responseData = await response.json();
    console.log('📊 Endpoint response data:', JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error('❌ Endpoint test failed:', error);
  }
}

async function checkGoogleCloudSetup() {
  try {
    console.log('\n🔧 Checking Google Cloud setup...');
    
    // Check if Speech-to-Text client can be created
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();
    
    console.log('✅ Speech client created successfully');
    
    // Check project access
    try {
      const projectId = await client.getProjectId();
      console.log('✅ Project ID accessible:', projectId);
      
      // Check if we can make a simple API call
      const testRequest = {
        audio: { content: Buffer.alloc(100, 0) },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US'
        }
      };
      
      const [testResponse] = await client.recognize(testRequest);
      console.log('✅ API call successful - Speech-to-Text is working');
      
    } catch (error) {
      console.error('❌ API access error:', error.message);
      console.error('❌ This might indicate:');
      console.error('   - Speech-to-Text API not enabled');
      console.error('   - Insufficient permissions');
      console.error('   - Billing not set up');
      console.error('   - Service account key issues');
    }
    
  } catch (error) {
    console.error('❌ Google Cloud setup check failed:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive Speech-to-Text debugging...');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🏗️ Project: claritystream-uldp9');
  
  await checkGoogleCloudSetup();
  await testSpeechToTextAPI();
  await testTranscriptionEndpoint();
  
  console.log('\n📋 Summary:');
  console.log('1. Check the logs above for any errors');
  console.log('2. If Speech-to-Text API is working, the issue is likely audio quality');
  console.log('3. If API calls fail, check Google Cloud console for:');
  console.log('   - Speech-to-Text API enabled');
  console.log('   - Billing account active');
  console.log('   - Service account permissions');
  console.log('4. Check Google Cloud Logs for real-time debugging:');
  console.log('   https://console.cloud.google.com/logs/query?project=claritystream-uldp9');
  
  console.log('\n🏁 Tests completed');
}

runAllTests().catch(console.error);