const fetch = require('node-fetch');

async function testMedicationDelete() {
    try {
        console.log('🧪 Testing medication DELETE endpoint...');
        
        // First, let's test with a non-existent medication ID to verify the endpoint exists
        const testUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/medications/test-id-123';
        
        console.log('🔗 Testing URL:', testUrl);
        
        const response = await fetch(testUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer fake-token-for-testing'
            }
        });
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response status text:', response.statusText);
        
        const responseData = await response.json();
        console.log('📊 Response data:', JSON.stringify(responseData, null, 2));
        
        // We expect either:
        // - 401 (Unauthorized) if auth fails first
        // - 404 (Not Found) if the medication doesn't exist
        // - NOT 404 with "Route not found" (which was the original issue)
        
        if (response.status === 401) {
            console.log('✅ Endpoint exists! Got 401 Unauthorized (expected for fake token)');
        } else if (response.status === 404 && responseData.error !== 'Route not found') {
            console.log('✅ Endpoint exists! Got 404 for non-existent medication (expected)');
        } else if (response.status === 404 && responseData.error === 'Route not found') {
            console.log('❌ Endpoint still not found - deployment may not be complete');
        } else {
            console.log('🤔 Unexpected response:', response.status, responseData);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testMedicationDelete();