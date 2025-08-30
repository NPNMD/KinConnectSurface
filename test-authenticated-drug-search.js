// Test script to check actual API responses with authentication
const https = require('https');

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// You'll need to get this token from your browser's network tab
// Look for the Authorization header in any API request
const AUTH_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjkyZTg4M2NjNDY...'; // Replace with actual token

async function testAuthenticatedDrugSearch(query) {
    return new Promise((resolve) => {
        const url = `${API_BASE}/drugs/search?q=${encodeURIComponent(query)}&limit=10`;
        console.log(`\n🔍 Testing authenticated search: "${query}"`);
        console.log(`URL: ${url}`);

        const options = {
            headers: {
                'Authorization': AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        };

        const req = https.get(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📊 Status: ${res.statusCode}`);

                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        console.log(`✅ 200 - Search successful!`);
                        console.log(`📄 Response:`, JSON.stringify(parsed, null, 2));
                        
                        if (parsed.data && parsed.data.length > 0) {
                            console.log(`📋 Found ${parsed.data.length} results:`);
                            parsed.data.forEach((drug, index) => {
                                console.log(`   ${index + 1}. ${drug.name} (${drug.tty}) - RXCUI: ${drug.rxcui}`);
                            });
                        } else {
                            console.log(`⚠️ No results found in response`);
                        }
                        
                        resolve({ 
                            query, 
                            status: res.statusCode, 
                            success: true, 
                            data: parsed
                        });
                    } catch (e) {
                        console.log(`❌ JSON Parse Error:`, e.message);
                        console.log(`📄 Raw response:`, data);
                        resolve({ query, status: res.statusCode, success: false, error: 'Parse error' });
                    }
                } else {
                    console.log(`⚠️ ${res.statusCode} - Error response`);
                    console.log(`📄 Response:`, data);
                    resolve({ query, status: res.statusCode, success: false, data: data });
                }
            });
        });

        req.on('error', (err) => {
            console.error(`❌ Request failed:`, err.message);
            resolve({ query, status: 0, success: false, error: err.message });
        });

        req.setTimeout(15000, () => {
            console.log(`⏰ Request timed out`);
            req.destroy();
            resolve({ query, status: 0, success: false, error: 'timeout' });
        });
    });
}

// Test the problematic searches
async function runAuthenticatedTests() {
    console.log('🧪 Testing Authenticated Drug Search API');
    console.log('=======================================');
    console.log('⚠️  IMPORTANT: You need to replace AUTH_TOKEN with a real token from your browser');
    console.log('    1. Open browser dev tools');
    console.log('    2. Go to Network tab');
    console.log('    3. Make a drug search in your app');
    console.log('    4. Copy the Authorization header value');
    console.log('    5. Replace AUTH_TOKEN in this script\n');

    if (AUTH_TOKEN === 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjkyZTg4M2NjNDY...') {
        console.log('❌ Please update AUTH_TOKEN with a real token first!');
        return;
    }

    const testQueries = ['metf', 'metformin', 'ibuprofen', 'advil'];
    
    for (const query of testQueries) {
        await testAuthenticatedDrugSearch(query);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

runAuthenticatedDrugSearch().catch(console.error);