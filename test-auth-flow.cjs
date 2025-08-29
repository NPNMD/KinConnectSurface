// Test script to debug the authentication flow
async function testAuthFlow() {
  try {
    console.log('🔍 Testing authentication flow...');
    
    // Test the API endpoint directly
    const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 API Response Status:', response.status);
    console.log('📡 API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.text();
    console.log('📡 API Response Body:', data);
    
  } catch (error) {
    console.error('❌ Error testing auth flow:', error);
  }
}

testAuthFlow();