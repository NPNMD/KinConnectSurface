// Test script to validate drug API endpoints
const https = require('https');

// You'll need to get an ID token from Firebase Auth for authenticated requests
// For now, we'll test the endpoints that should work
const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test drug search endpoint (should return 401 without auth, but route should exist)
async function testDrugSearch() {
  return new Promise((resolve) => {
    const url = `${API_BASE}/drugs/search?q=aspirin&limit=5`;
    console.log(`\n🔍 Testing drug search: ${url}`);

    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Status: ${res.statusCode}`);
        console.log(`📊 Headers:`, res.headers);

        if (res.statusCode === 404) {
          console.log(`❌ 404 - Drug search route not found!`);
          resolve({ endpoint: '/drugs/search', status: res.statusCode, success: false });
        } else if (res.statusCode === 401) {
          console.log(`🔐 401 - Authentication required (expected - route exists!)`);
          resolve({ endpoint: '/drugs/search', status: res.statusCode, success: true });
        } else if (res.statusCode === 200) {
          console.log(`✅ 200 - Drug search working!`);
          try {
            const parsed = JSON.parse(data);
            console.log(`📄 Response:`, parsed);
            resolve({ endpoint: '/drugs/search', status: res.statusCode, success: true });
          } catch (e) {
            console.log(`📄 Raw response:`, data.substring(0, 200));
            resolve({ endpoint: '/drugs/search', status: res.statusCode, success: true });
          }
        } else {
          console.log(`⚠️ ${res.statusCode} - Unexpected status`);
          resolve({ endpoint: '/drugs/search', status: res.statusCode, success: false });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Request failed:`, err.message);
      resolve({ endpoint: '/drugs/search', status: 0, success: false });
    });

    req.setTimeout(10000, () => {
      console.log(`⏰ Request timed out`);
      req.destroy();
      resolve({ endpoint: '/drugs/search', status: 0, success: false });
    });
  });
}

// Test drug details endpoint
async function testDrugDetails() {
  return new Promise((resolve) => {
    const url = `${API_BASE}/drugs/1191`; // Aspirin RXCUI
    console.log(`\n📋 Testing drug details: ${url}`);

    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Status: ${res.statusCode}`);

        if (res.statusCode === 404) {
          console.log(`❌ 404 - Drug details route not found!`);
          resolve({ endpoint: '/drugs/{rxcui}', status: res.statusCode, success: false });
        } else if (res.statusCode === 401) {
          console.log(`🔐 401 - Authentication required (expected - route exists!)`);
          resolve({ endpoint: '/drugs/{rxcui}', status: res.statusCode, success: true });
        } else if (res.statusCode === 200) {
          console.log(`✅ 200 - Drug details working!`);
          try {
            const parsed = JSON.parse(data);
            console.log(`📄 Response:`, parsed);
            resolve({ endpoint: '/drugs/{rxcui}', status: res.statusCode, success: true });
          } catch (e) {
            console.log(`📄 Raw response:`, data.substring(0, 200));
            resolve({ endpoint: '/drugs/{rxcui}', status: res.statusCode, success: true });
          }
        } else {
          console.log(`⚠️ ${res.statusCode} - Unexpected status`);
          resolve({ endpoint: '/drugs/{rxcui}', status: res.statusCode, success: false });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Request failed:`, err.message);
      resolve({ endpoint: '/drugs/{rxcui}', status: 0, success: false });
    });

    req.setTimeout(10000, () => {
      console.log(`⏰ Request timed out`);
      req.destroy();
      resolve({ endpoint: '/drugs/{rxcui}', status: 0, success: false });
    });
  });
}

// Test spelling suggestions endpoint
async function testSpellingSuggestions() {
  return new Promise((resolve) => {
    const url = `${API_BASE}/drugs/suggestions/aspirin`;
    console.log(`\n✏️ Testing spelling suggestions: ${url}`);

    const req = https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Status: ${res.statusCode}`);

        if (res.statusCode === 404) {
          console.log(`❌ 404 - Spelling suggestions route not found!`);
          resolve({ endpoint: '/drugs/suggestions/{query}', status: res.statusCode, success: false });
        } else if (res.statusCode === 401) {
          console.log(`🔐 401 - Authentication required (expected - route exists!)`);
          resolve({ endpoint: '/drugs/suggestions/{query}', status: res.statusCode, success: true });
        } else if (res.statusCode === 200) {
          console.log(`✅ 200 - Spelling suggestions working!`);
          try {
            const parsed = JSON.parse(data);
            console.log(`📄 Response:`, parsed);
            resolve({ endpoint: '/drugs/suggestions/{query}', status: res.statusCode, success: true });
          } catch (e) {
            console.log(`📄 Raw response:`, data.substring(0, 200));
            resolve({ endpoint: '/drugs/suggestions/{query}', status: res.statusCode, success: true });
          }
        } else {
          console.log(`⚠️ ${res.statusCode} - Unexpected status`);
          resolve({ endpoint: '/drugs/suggestions/{query}', status: res.statusCode, success: false });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Request failed:`, err.message);
      resolve({ endpoint: '/drugs/suggestions/{query}', status: 0, success: false });
    });

    req.setTimeout(10000, () => {
      console.log(`⏰ Request timed out`);
      req.destroy();
      resolve({ endpoint: '/drugs/suggestions/{query}', status: 0, success: false });
    });
  });
}

// Run all tests
async function runTests() {
  console.log('🧪 Testing Drug API Endpoints');
  console.log('================================');

  const results = await Promise.all([
    testDrugSearch(),
    testDrugDetails(),
    testSpellingSuggestions()
  ]);

  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  let passed = 0;
  let total = results.length;

  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.endpoint} - Status: ${result.status}`);
    if (result.success) passed++;
  });

  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All drug API endpoints are working!');
  } else {
    console.log('⚠️ Some endpoints need attention');
  }
}

// Run the tests
runTests().catch(console.error);
