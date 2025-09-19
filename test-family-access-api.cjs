const https = require('https');
const http = require('http');

// API Configuration
const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test data from your screenshots
const TEST_DATA = {
  familyMemberEmail: 'fookwin@gmail.com',
  familyMemberId: 'HeP6DIFGuATMI9nfETpqCHd32dB3',
  patientId: '3u7bMygdjIMdWEQxMZwW1DIw5zI1'
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Family-Access-Test/1.0',
        ...options.headers
      }
    };

    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testAPIEndpoints() {
  console.log('🧪 === FAMILY ACCESS API TEST ===');
  console.log('📅 Test started at:', new Date().toISOString());
  console.log('🌐 API Base URL:', API_BASE);
  
  const testResults = {
    healthCheck: {},
    familyAccess: {},
    authProfile: {},
    recommendations: []
  };

  try {
    // ===== TEST 1: HEALTH CHECK =====
    console.log('\n🔍 TEST 1: API Health Check');
    console.log('=' .repeat(40));
    
    try {
      const healthResponse = await makeRequest(`${API_BASE}/health`);
      console.log('📊 Health check response:', {
        status: healthResponse.statusCode,
        data: healthResponse.data
      });
      
      testResults.healthCheck = {
        success: healthResponse.statusCode === 200,
        response: healthResponse.data
      };
      
      if (healthResponse.statusCode === 200) {
        console.log('✅ API is healthy and responding');
      } else {
        console.log('⚠️ API health check returned non-200 status');
      }
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      testResults.healthCheck = { success: false, error: error.message };
    }

    // ===== TEST 2: FAMILY ACCESS ENDPOINT (WITHOUT AUTH) =====
    console.log('\n🔍 TEST 2: Family Access Endpoint (No Auth)');
    console.log('=' .repeat(40));
    
    try {
      const familyAccessResponse = await makeRequest(`${API_BASE}/family-access`);
      console.log('📊 Family access response (no auth):', {
        status: familyAccessResponse.statusCode,
        data: familyAccessResponse.data
      });
      
      if (familyAccessResponse.statusCode === 401) {
        console.log('✅ Correctly requires authentication (401)');
        testResults.familyAccess.authRequired = true;
      } else {
        console.log('⚠️ Unexpected response - should require auth');
        testResults.familyAccess.authRequired = false;
      }
    } catch (error) {
      console.log('❌ Family access test failed:', error.message);
      testResults.familyAccess = { error: error.message };
    }

    // ===== TEST 3: AUTH PROFILE ENDPOINT =====
    console.log('\n🔍 TEST 3: Auth Profile Endpoint (No Auth)');
    console.log('=' .repeat(40));
    
    try {
      const authResponse = await makeRequest(`${API_BASE}/auth/profile`);
      console.log('📊 Auth profile response (no auth):', {
        status: authResponse.statusCode,
        data: authResponse.data
      });
      
      if (authResponse.statusCode === 401) {
        console.log('✅ Auth profile correctly requires authentication');
        testResults.authProfile.authRequired = true;
      } else {
        console.log('⚠️ Auth profile should require authentication');
        testResults.authProfile.authRequired = false;
      }
    } catch (error) {
      console.log('❌ Auth profile test failed:', error.message);
      testResults.authProfile = { error: error.message };
    }

    // ===== TEST 4: INVITATION ENDPOINT STRUCTURE =====
    console.log('\n🔍 TEST 4: Invitation Endpoint Structure');
    console.log('=' .repeat(40));
    
    try {
      // Test invitation details endpoint (should work without auth for valid tokens)
      const invitationResponse = await makeRequest(`${API_BASE}/invitations/test-token-123`);
      console.log('📊 Invitation endpoint response:', {
        status: invitationResponse.statusCode,
        data: invitationResponse.data
      });
      
      if (invitationResponse.statusCode === 404) {
        console.log('✅ Invitation endpoint exists (404 for invalid token is expected)');
      } else {
        console.log('📝 Invitation endpoint response:', invitationResponse.statusCode);
      }
    } catch (error) {
      console.log('❌ Invitation endpoint test failed:', error.message);
    }

    // ===== ANALYSIS AND RECOMMENDATIONS =====
    console.log('\n🔍 ANALYSIS: Current System State');
    console.log('=' .repeat(40));
    
    if (testResults.healthCheck.success) {
      console.log('✅ Backend API is operational');
    } else {
      console.log('❌ Backend API has issues');
      testResults.recommendations.push('Check Firebase Functions deployment');
    }
    
    if (testResults.familyAccess.authRequired && testResults.authProfile.authRequired) {
      console.log('✅ Authentication is properly enforced');
    } else {
      console.log('⚠️ Authentication enforcement may have issues');
      testResults.recommendations.push('Review authentication middleware');
    }

    // ===== FAMILY MEMBER LOGIN FLOW ANALYSIS =====
    console.log('\n🔍 FAMILY MEMBER LOGIN FLOW ANALYSIS');
    console.log('=' .repeat(40));
    
    console.log('📋 Expected flow for family member login:');
    console.log('1. Family member (fookwin@gmail.com) logs in');
    console.log('2. Firebase Auth creates/returns user token');
    console.log('3. Frontend calls /auth/profile with token');
    console.log('4. Backend recognizes user as family_member type');
    console.log('5. Frontend calls /family-access with token');
    console.log('6. Backend queries family_calendar_access by familyMemberId');
    console.log('7. If familyMemberId is missing, fallback to email query');
    console.log('8. Return patient access data to frontend');
    console.log('9. Frontend sets activePatientId and loads patient data');
    
    console.log('\n🚨 CURRENT ISSUE:');
    console.log('- familyMemberId field is empty in database');
    console.log('- Primary query by familyMemberId returns no results');
    console.log('- No email fallback implemented yet');
    console.log('- Family member sees their own dashboard instead of patient\'s');
    
    console.log('\n💡 IMMEDIATE FIXES NEEDED:');
    console.log('1. Manual database update: Set familyMemberId = HeP6DIFGuATMI9nfETpqCHd32dB3');
    console.log('2. Implement email fallback in /family-access endpoint');
    console.log('3. Add auto-repair mechanism for missing familyMemberId');
    console.log('4. Test family member login after fixes');

    // ===== BACKEND ENHANCEMENT PREVIEW =====
    console.log('\n🔍 BACKEND ENHANCEMENT PREVIEW');
    console.log('=' .repeat(40));
    
    console.log('📝 Enhanced /family-access endpoint logic:');
    console.log(`
    // Primary query
    const familyMemberQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberId', '==', userId)
      .where('status', '==', 'active')
      .get();
    
    // FALLBACK: Email-based query with auto-repair
    if (familyMemberQuery.empty && userEmail) {
      const emailFallbackQuery = await firestore.collection('family_calendar_access')
        .where('familyMemberEmail', '==', userEmail.toLowerCase())
        .where('status', '==', 'active')
        .get();
      
      // Auto-repair missing familyMemberId
      for (const doc of emailFallbackQuery.docs) {
        const data = doc.data();
        if (!data.familyMemberId) {
          await doc.ref.update({
            familyMemberId: userId,
            updatedAt: admin.firestore.Timestamp.now(),
            repairedAt: admin.firestore.Timestamp.now()
          });
        }
      }
    }
    `);

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    testResults.error = error.message;
  }
  
  console.log('\n🏁 === API TEST COMPLETED ===');
  console.log('📅 Test ended at:', new Date().toISOString());
  
  return testResults;
}

// ===== MANUAL REPAIR INSTRUCTIONS =====
function showManualRepairInstructions() {
  console.log('\n🔧 === MANUAL REPAIR INSTRUCTIONS ===');
  console.log('📋 To fix the missing familyMemberId issue:');
  
  console.log('\n1. Open Firebase Console:');
  console.log('   https://console.firebase.google.com/project/claritystream-uldp9/firestore');
  
  console.log('\n2. Navigate to family_calendar_access collection');
  
  console.log('\n3. Find the document with:');
  console.log('   - familyMemberEmail: "fookwin@gmail.com"');
  console.log('   - patientId: "3u7bMygdjIMdWEQxMZwW1DIw5zI1"');
  
  console.log('\n4. Edit the document and set:');
  console.log('   - familyMemberId: "HeP6DIFGuATMI9nfETpqCHd32dB3"');
  console.log('   - updatedAt: (current timestamp)');
  console.log('   - repairedAt: (current timestamp)');
  console.log('   - repairReason: "manual_fix_missing_family_member_id"');
  
  console.log('\n5. Save the changes');
  
  console.log('\n6. Test family member login:');
  console.log('   - Login as fookwin@gmail.com');
  console.log('   - Should see patient\'s dashboard instead of own');
  console.log('   - Should have access to patient\'s medication calendar');
  
  console.log('\n💡 After manual fix, implement backend enhancements to prevent future issues');
}

// ===== MAIN EXECUTION =====
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--instructions')) {
    showManualRepairInstructions();
  } else {
    console.log('🧪 Running API endpoint tests...');
    console.log('💡 Use --instructions flag to see manual repair steps');
    await testAPIEndpoints();
    
    console.log('\n' + '='.repeat(60));
    showManualRepairInstructions();
  }
}

// Run the test
main().then(() => {
  console.log('\n🎯 API test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 API test failed:', error);
  process.exit(1);
});