/**
 * Test script to verify the today-buckets endpoint fix
 * Tests the endpoint after the Firestore index has been created
 */

const https = require('https');

const API_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';
const TEST_PATIENT_ID = 'PPJdgtyeB4ZV6vr7WqeCgba1aZO2';
const TEST_DATE = '2025-10-03';

// You'll need to provide a valid auth token
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

async function testTodayBucketsEndpoint() {
  console.log('🧪 Testing today-buckets endpoint after index deployment...\n');
  
  if (!AUTH_TOKEN) {
    console.error('❌ ERROR: TEST_AUTH_TOKEN environment variable not set');
    console.log('Please set it with: set TEST_AUTH_TOKEN=your_firebase_auth_token');
    process.exit(1);
  }
  
  const endpoint = `/medication-calendar/events/today-buckets?date=${TEST_DATE}&patientId=${TEST_PATIENT_ID}`;
  const url = `${API_URL}${endpoint}`;
  
  console.log('📍 Testing endpoint:', endpoint);
  console.log('🔗 Full URL:', url);
  console.log('👤 Patient ID:', TEST_PATIENT_ID);
  console.log('📅 Date:', TEST_DATE);
  console.log('');
  
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    const startTime = Date.now();
    
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        console.log('📊 Response Status:', res.statusCode);
        console.log('⏱️  Response Time:', responseTime + 'ms');
        console.log('');
        
        try {
          const jsonData = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log('✅ SUCCESS: Endpoint is working!');
            console.log('');
            console.log('📦 Response Data:');
            console.log(JSON.stringify(jsonData, null, 2));
            console.log('');
            
            if (jsonData.data) {
              const buckets = jsonData.data;
              console.log('📊 Bucket Summary:');
              console.log('  - Now:', buckets.now?.length || 0, 'medications');
              console.log('  - Due Soon:', buckets.dueSoon?.length || 0, 'medications');
              console.log('  - Morning:', buckets.morning?.length || 0, 'medications');
              console.log('  - Noon:', buckets.noon?.length || 0, 'medications');
              console.log('  - Evening:', buckets.evening?.length || 0, 'medications');
              console.log('  - Bedtime:', buckets.bedtime?.length || 0, 'medications');
              console.log('  - Overdue:', buckets.overdue?.length || 0, 'medications');
              console.log('  - Completed:', buckets.completed?.length || 0, 'medications');
            }
            
            resolve(jsonData);
          } else if (res.statusCode === 500) {
            console.log('❌ STILL FAILING: 500 Internal Server Error');
            console.log('');
            console.log('Response:', JSON.stringify(jsonData, null, 2));
            console.log('');
            console.log('⚠️  The index may still be building. Firestore indexes can take 5-10 minutes to build.');
            console.log('💡 Check index status at: https://console.firebase.google.com/project/claritystream-uldp9/firestore/indexes');
            reject(new Error('Endpoint still returning 500 - index may still be building'));
          } else {
            console.log('⚠️  Unexpected status code:', res.statusCode);
            console.log('Response:', JSON.stringify(jsonData, null, 2));
            reject(new Error(`Unexpected status: ${res.statusCode}`));
          }
        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError);
          console.log('Raw response:', data);
          reject(parseError);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    req.end();
  });
}

async function waitAndTest() {
  console.log('⏳ Waiting 2 minutes for Firestore index to build...');
  console.log('');
  
  // Wait 2 minutes
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  console.log('✅ Wait complete. Testing endpoint now...\n');
  
  try {
    await testTodayBucketsEndpoint();
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 If the index is still building, wait a few more minutes and run:');
    console.log('   node scripts/test-today-buckets-fix.cjs');
    process.exit(1);
  }
}

// Check if we should skip the wait (for manual testing)
const skipWait = process.argv.includes('--no-wait');

if (skipWait) {
  console.log('⚡ Skipping wait, testing immediately...\n');
  testTodayBucketsEndpoint()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
} else {
  waitAndTest();
}