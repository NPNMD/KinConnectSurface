// Simple test script to verify healthcare providers API
import fetch from 'node-fetch';

async function testHealthcareAPI() {
  try {
    console.log('Testing healthcare providers API...');
    
    // Test the API endpoint (this will fail without auth, but we can see if the endpoint responds)
    const response = await fetch('http://localhost:3001/api/healthcare-providers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 401) {
      console.log('✅ API endpoint is responding (401 Unauthorized is expected without auth token)');
    } else {
      const text = await response.text();
      console.log('Response body:', text);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testHealthcareAPI();