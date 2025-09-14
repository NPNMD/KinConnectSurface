const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

async function testSpeechAPI() {
  try {
    console.log('🔍 Testing Google Cloud Speech-to-Text API...');

    // Try to import the Speech client
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();

    console.log('✅ Speech client created successfully');

    // Test with a simple audio buffer (silence)
    const testRequest = {
      audio: {
        content: Buffer.from('test').toString('base64'),
      },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
      },
    };

    // This will fail but tell us if the API is enabled
    try {
      await client.recognize(testRequest);
    } catch (error) {
      console.log('🔍 API Response (expected to fail with test data):', error.message);

      if (error.message.includes('API has not been used') || error.message.includes('not enabled')) {
        console.log('❌ Speech-to-Text API is NOT enabled');
        console.log('📋 Please enable it at: https://console.cloud.google.com/apis/library/speech.googleapis.com?project=claritystream-uldp9');
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        console.log('❌ Service account lacks permissions');
        console.log('📋 Please add "Cloud Speech Client" role to the Firebase service account');
      } else {
        console.log('✅ API is enabled but test data failed (this is expected)');
        console.log('🔍 Error details:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error testing Speech API:', error.message);

    if (error.message.includes('Could not load the default credentials')) {
      console.log('📋 Authentication issue - Firebase service account needs Speech API access');
    }
  }
}

testSpeechAPI();

