const https = require('https');

// Test the auth profile endpoint
async function testAuthProfile() {
    console.log('🔍 Testing auth profile endpoint...');
    
    const options = {
        hostname: 'us-central1-claritystream-uldp9.cloudfunctions.net',
        path: '/api/auth/profile',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token' // This will fail auth but should return 401/403, not 404
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📊 Status: ${res.statusCode}`);
                console.log(`📋 Headers:`, res.headers);
                
                try {
                    const response = JSON.parse(data);
                    console.log(`📄 Response:`, response);
                    
                    if (res.statusCode === 404) {
                        console.log('❌ Endpoint not found - this was the original issue');
                        resolve(false);
                    } else if (res.statusCode === 401 || res.statusCode === 403) {
                        console.log('✅ Endpoint exists and properly handles authentication');
                        resolve(true);
                    } else {
                        console.log(`⚠️ Unexpected status code: ${res.statusCode}`);
                        resolve(false);
                    }
                } catch (error) {
                    console.log('❌ Failed to parse response:', error);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request failed:', error);
            reject(error);
        });

        req.end();
    });
}

// Test CORS headers
async function testCorsHeaders() {
    console.log('\n🔍 Testing CORS headers...');
    
    const options = {
        hostname: 'us-central1-claritystream-uldp9.cloudfunctions.net',
        path: '/api/health',
        method: 'OPTIONS',
        headers: {
            'Origin': 'https://claritystream-uldp9.web.app',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log(`📊 Status: ${res.statusCode}`);
            console.log(`📋 CORS Headers:`, {
                'access-control-allow-origin': res.headers['access-control-allow-origin'],
                'access-control-allow-methods': res.headers['access-control-allow-methods'],
                'access-control-allow-headers': res.headers['access-control-allow-headers'],
                'access-control-allow-credentials': res.headers['access-control-allow-credentials']
            });
            
            const hasValidCors = res.headers['access-control-allow-origin'] && 
                               res.headers['access-control-allow-methods'] &&
                               res.headers['access-control-allow-headers'];
            
            if (hasValidCors) {
                console.log('✅ CORS headers are properly configured');
                resolve(true);
            } else {
                console.log('❌ CORS headers are missing or incomplete');
                resolve(false);
            }
        });

        req.on('error', (error) => {
            console.error('❌ Request failed:', error);
            reject(error);
        });

        req.end();
    });
}

// Test health endpoint
async function testHealthEndpoint() {
    console.log('\n🔍 Testing health endpoint...');
    
    const options = {
        hostname: 'us-central1-claritystream-uldp9.cloudfunctions.net',
        path: '/api/health',
        method: 'GET'
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📊 Status: ${res.statusCode}`);
                
                try {
                    const response = JSON.parse(data);
                    console.log(`📄 Response:`, response);
                    
                    if (res.statusCode === 200 && response.success) {
                        console.log('✅ Health endpoint is working');
                        resolve(true);
                    } else {
                        console.log('❌ Health endpoint failed');
                        resolve(false);
                    }
                } catch (error) {
                    console.log('❌ Failed to parse response:', error);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request failed:', error);
            reject(error);
        });

        req.end();
    });
}

// Run all tests
async function runTests() {
    console.log('🚀 Starting login fix verification tests...\n');
    
    try {
        const healthTest = await testHealthEndpoint();
        const authTest = await testAuthProfile();
        const corsTest = await testCorsHeaders();
        
        console.log('\n📊 Test Results Summary:');
        console.log(`Health Endpoint: ${healthTest ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Auth Profile Endpoint: ${authTest ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`CORS Configuration: ${corsTest ? '✅ PASS' : '❌ FAIL'}`);
        
        const allPassed = healthTest && authTest && corsTest;
        console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        if (allPassed) {
            console.log('\n🎉 Login functionality should now be working!');
            console.log('💡 Try logging in again in your browser.');
        } else {
            console.log('\n⚠️ Some issues remain. Check the failed tests above.');
        }
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the tests
runTests();