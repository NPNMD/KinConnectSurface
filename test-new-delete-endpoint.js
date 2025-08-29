// Test script to verify the new DELETE endpoint path is working
import fetch from 'node-fetch';

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api/api';

async function testNewDeleteEndpoint() {
    console.log('🧪 Testing NEW DELETE endpoint path...\n');
    
    const testAccessId = 'test_access_id_123';
    
    try {
        console.log('1. Testing DELETE /api/family-access/remove/:accessId endpoint...');
        const response = await fetch(`${API_BASE}/family-access/remove/${testAccessId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer fake_token_for_testing'
            }
        });
        const result = await response.json();
        
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(result, null, 2));
        
        if (response.status === 401 || response.status === 403) {
            console.log('✅ DELETE endpoint is working correctly (expected auth error for test token)');
        } else if (response.status === 404 && result.error === 'Family access record not found') {
            console.log('✅ DELETE endpoint is working correctly (expected 404 for test access ID)');
        } else if (response.status === 404 && result.error === 'Route not found') {
            console.log('❌ DELETE endpoint still not found - routing issue persists');
        } else {
            console.log('🤔 Unexpected response - endpoint may be working but with different behavior');
        }
        
    } catch (error) {
        console.error('❌ Error testing DELETE endpoint:', error.message);
    }
    
    console.log('\n2. Testing API health...');
    try {
        const healthResponse = await fetch(`${API_BASE}/health`);
        const healthResult = await healthResponse.json();
        
        if (healthResult.success) {
            console.log('✅ API is healthy');
        } else {
            console.log('❌ API health check failed');
        }
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
    }
    
    console.log('\n🎯 Summary:');
    console.log('- Changed DELETE endpoint from /api/family-access/:accessId to /api/family-access/remove/:accessId');
    console.log('- Updated client API to use new endpoint path');
    console.log('- Both functions and client have been deployed');
}

testNewDeleteEndpoint();