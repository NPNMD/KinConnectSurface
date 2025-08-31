const https = require('https');

// Test script to investigate the database issue with duplicate medication events
async function investigateDatabaseIssue() {
  try {
    console.log('🔍 Investigating database issue with duplicate medication events...');
    
    // First, let's check what medication events exist for the user
    const userId = '3u7bMygdjIMdWEQxMZwW1DIw5zl1'; // From the logs
    
    // Test the medication calendar events endpoint
    const eventsUrl = `https://us-central1-claritystream-uldp9.cloudfunctions.net/api/medication-calendar/events`;
    
    console.log('🔗 Testing medication events API:', eventsUrl);
    
    // Test without authentication to see the structure
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(eventsUrl, options, (res) => {
      console.log('📡 Response status:', res.statusCode);
      console.log('📡 Response headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📡 Response body:', data);
        
        if (res.statusCode === 401) {
          console.log('✅ Expected 401 - endpoint exists and requires auth');
        } else if (res.statusCode === 500) {
          console.log('❌ 500 error on events endpoint too');
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
    });
    
    req.end();
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Test the specific event that's failing
async function testSpecificEvent() {
  try {
    console.log('\n🔍 Testing specific event that\'s failing...');
    
    const eventId = 'Kik7MbDHP5tutkbdQKgW'; // From the logs
    const eventUrl = `https://us-central1-claritystream-uldp9.cloudfunctions.net/api/medication-calendar/events/${eventId}`;
    
    console.log('🔗 Testing specific event URL:', eventUrl);
    
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(eventUrl, options, (res) => {
      console.log('📡 Event response status:', res.statusCode);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📡 Event response body:', data);
        
        if (res.statusCode === 401) {
          console.log('✅ Event endpoint exists and requires auth');
        } else if (res.statusCode === 404) {
          console.log('❌ Event not found - may have been deleted or corrupted');
        } else if (res.statusCode === 500) {
          console.log('❌ 500 error on specific event - database issue');
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Event request error:', error);
    });
    
    req.end();
    
  } catch (error) {
    console.error('❌ Event test failed:', error);
  }
}

// Run the investigation
console.log('🚀 Starting database investigation...');
investigateDatabaseIssue();

setTimeout(() => {
  testSpecificEvent();
}, 2000);

setTimeout(() => {
  console.log('🏁 Investigation completed');
  process.exit(0);
}, 6000);