const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function testFamilyAccessComprehensive() {
  console.log('🧪 === COMPREHENSIVE FAMILY ACCESS TEST ===');
  console.log('📅 Test started at:', new Date().toISOString());
  
  const testResults = {
    databaseState: {},
    apiSimulation: {},
    repairNeeded: false,
    recommendations: []
  };

  try {
    // ===== PHASE 1: DATABASE STATE VERIFICATION =====
    console.log('\n🔍 PHASE 1: Database State Verification');
    console.log('=' .repeat(50));
    
    // Test 1: Find the family access record
    console.log('📋 Test 1: Finding family access record...');
    const familyAccessQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberEmail', '==', 'fookwin@gmail.com')
      .where('patientId', '==', '3u7bMygdjIMdWEQxMZwW1DIw5zI1')
      .get();
    
    if (familyAccessQuery.empty) {
      console.log('❌ No family access record found');
      testResults.databaseState.familyAccessRecord = 'NOT_FOUND';
      return testResults;
    }
    
    const familyAccessDoc = familyAccessQuery.docs[0];
    const familyAccessData = familyAccessDoc.data();
    
    console.log('✅ Family access record found:', familyAccessDoc.id);
    console.log('📊 Record details:', {
      id: familyAccessDoc.id,
      familyMemberId: familyAccessData.familyMemberId || 'MISSING',
      familyMemberEmail: familyAccessData.familyMemberEmail,
      patientId: familyAccessData.patientId,
      status: familyAccessData.status,
      accessLevel: familyAccessData.accessLevel,
      invitedAt: familyAccessData.invitedAt?.toDate(),
      acceptedAt: familyAccessData.acceptedAt?.toDate()
    });
    
    testResults.databaseState.familyAccessRecord = {
      id: familyAccessDoc.id,
      familyMemberId: familyAccessData.familyMemberId,
      status: familyAccessData.status,
      hasMissingFamilyMemberId: !familyAccessData.familyMemberId || familyAccessData.familyMemberId === ''
    };
    
    // Test 2: Verify user record exists
    console.log('\n📋 Test 2: Verifying user record...');
    const expectedUserId = 'HeP6DIFGuATMI9nfETpqCHd32dB3';
    const userDoc = await firestore.collection('users').doc(expectedUserId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ User record found:', expectedUserId);
      console.log('👤 User details:', {
        id: userDoc.id,
        email: userData.email,
        name: userData.name,
        userType: userData.userType,
        createdAt: userData.createdAt?.toDate(),
        updatedAt: userData.updatedAt?.toDate()
      });
      
      testResults.databaseState.userRecord = {
        exists: true,
        email: userData.email,
        userType: userData.userType,
        emailMatches: userData.email === 'fookwin@gmail.com'
      };
    } else {
      console.log('❌ User record not found:', expectedUserId);
      testResults.databaseState.userRecord = { exists: false };
    }
    
    // Test 3: Check patient record
    console.log('\n📋 Test 3: Verifying patient record...');
    const patientId = '3u7bMygdjIMdWEQxMZwW1DIw5zI1';
    const patientDoc = await firestore.collection('users').doc(patientId).get();
    
    if (patientDoc.exists) {
      const patientData = patientDoc.data();
      console.log('✅ Patient record found:', patientId);
      console.log('🏥 Patient details:', {
        id: patientDoc.id,
        email: patientData.email,
        name: patientData.name,
        userType: patientData.userType
      });
      
      testResults.databaseState.patientRecord = {
        exists: true,
        name: patientData.name,
        email: patientData.email
      };
    } else {
      console.log('❌ Patient record not found:', patientId);
      testResults.databaseState.patientRecord = { exists: false };
    }
    
    // ===== PHASE 2: API SIMULATION =====
    console.log('\n🔍 PHASE 2: API Behavior Simulation');
    console.log('=' .repeat(50));
    
    // Simulate the current /family-access endpoint logic
    console.log('📡 Simulating /family-access endpoint...');
    
    // Primary query (what currently happens)
    const primaryQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberId', '==', expectedUserId)
      .where('status', '==', 'active')
      .get();
    
    console.log('🔍 Primary query (familyMemberId match):', primaryQuery.docs.length, 'results');
    
    if (primaryQuery.empty) {
      console.log('⚠️ Primary query returned no results - this is the problem!');
      
      // Fallback query (what should happen)
      console.log('🔄 Testing email fallback query...');
      const fallbackQuery = await firestore.collection('family_calendar_access')
        .where('familyMemberEmail', '==', 'fookwin@gmail.com')
        .where('status', '==', 'active')
        .get();
      
      console.log('🔍 Fallback query (email match):', fallbackQuery.docs.length, 'results');
      
      if (!fallbackQuery.empty) {
        console.log('✅ Fallback query would find the record');
        testResults.apiSimulation.fallbackWorks = true;
        testResults.repairNeeded = true;
        testResults.recommendations.push('Implement email fallback in /family-access endpoint');
        testResults.recommendations.push('Auto-repair missing familyMemberId when found via email');
      } else {
        console.log('❌ Even fallback query failed');
        testResults.apiSimulation.fallbackWorks = false;
      }
    } else {
      console.log('✅ Primary query works - familyMemberId is properly set');
      testResults.apiSimulation.primaryWorks = true;
    }
    
    // ===== PHASE 3: REPAIR SIMULATION =====
    console.log('\n🔍 PHASE 3: Repair Strategy Simulation');
    console.log('=' .repeat(50));
    
    if (testResults.repairNeeded) {
      console.log('🔧 Simulating repair process...');
      
      // Show what the repair would do
      console.log('📝 Manual repair command:');
      console.log(`
        // Firebase Console or Admin SDK:
        db.collection('family_calendar_access').doc('${familyAccessDoc.id}').update({
          familyMemberId: '${expectedUserId}',
          updatedAt: admin.firestore.Timestamp.now(),
          repairedAt: admin.firestore.Timestamp.now(),
          repairReason: 'manual_fix_missing_family_member_id'
        });
      `);
      
      console.log('🔧 Automated repair (if implemented):');
      console.log('- Email fallback query finds record');
      console.log('- Auto-update familyMemberId field');
      console.log('- Log repair action for audit');
      console.log('- Return corrected data to frontend');
    }
    
    // ===== PHASE 4: FRONTEND IMPACT ANALYSIS =====
    console.log('\n🔍 PHASE 4: Frontend Impact Analysis');
    console.log('=' .repeat(50));
    
    console.log('🎭 FamilyContext behavior prediction:');
    
    if (testResults.repairNeeded) {
      console.log('❌ Current state: FamilyContext will fail');
      console.log('   - /family-access returns empty patientsIHaveAccessTo');
      console.log('   - User role set to "patient" instead of "family_member"');
      console.log('   - activePatientId set to user\'s own ID');
      console.log('   - Family member cannot access patient data');
      
      console.log('✅ After repair: FamilyContext will work');
      console.log('   - /family-access returns patient access data');
      console.log('   - User role set to "family_member"');
      console.log('   - activePatientId set to patient\'s ID');
      console.log('   - Family member can access patient data');
    } else {
      console.log('✅ Current state: FamilyContext should work correctly');
    }
    
    // ===== PHASE 5: RECOMMENDATIONS =====
    console.log('\n🔍 PHASE 5: Recommendations');
    console.log('=' .repeat(50));
    
    if (testResults.repairNeeded) {
      console.log('🚨 IMMEDIATE ACTION REQUIRED:');
      console.log('1. Manually update familyMemberId in database');
      console.log('2. Test family member login after fix');
      console.log('3. Implement email fallback in backend');
      console.log('4. Add auto-repair mechanism');
    } else {
      console.log('✅ No immediate action required');
      console.log('💡 Consider implementing preventive measures');
    }
    
    console.log('\n📋 LONG-TERM IMPROVEMENTS:');
    console.log('1. Enhanced invitation acceptance with verification');
    console.log('2. Email fallback in /family-access endpoint');
    console.log('3. Health check endpoint for data consistency');
    console.log('4. Frontend error recovery mechanisms');
    console.log('5. Admin monitoring dashboard');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    testResults.error = error.message;
  }
  
  console.log('\n🏁 === TEST COMPLETED ===');
  console.log('📅 Test ended at:', new Date().toISOString());
  
  return testResults;
}

// ===== REPAIR FUNCTION =====
async function performManualRepair() {
  console.log('🔧 === PERFORMING MANUAL REPAIR ===');
  
  try {
    // Find the record to repair
    const familyAccessQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberEmail', '==', 'fookwin@gmail.com')
      .where('patientId', '==', '3u7bMygdjIMdWEQxMZwW1DIw5zI1')
      .get();
    
    if (familyAccessQuery.empty) {
      console.log('❌ No record found to repair');
      return false;
    }
    
    const doc = familyAccessQuery.docs[0];
    const data = doc.data();
    
    if (data.familyMemberId && data.familyMemberId !== '') {
      console.log('✅ Record already has familyMemberId:', data.familyMemberId);
      return true;
    }
    
    console.log('🔧 Updating familyMemberId...');
    
    await doc.ref.update({
      familyMemberId: 'HeP6DIFGuATMI9nfETpqCHd32dB3',
      updatedAt: admin.firestore.Timestamp.now(),
      repairedAt: admin.firestore.Timestamp.now(),
      repairReason: 'manual_fix_missing_family_member_id'
    });
    
    console.log('✅ Repair completed successfully');
    
    // Verify the repair
    const verifyDoc = await doc.ref.get();
    const verifyData = verifyDoc.data();
    
    console.log('🔍 Verification:', {
      familyMemberId: verifyData.familyMemberId,
      repairedAt: verifyData.repairedAt?.toDate()
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Repair failed:', error);
    return false;
  }
}

// ===== MAIN EXECUTION =====
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--repair')) {
    console.log('🔧 Running in REPAIR mode');
    const repairSuccess = await performManualRepair();
    
    if (repairSuccess) {
      console.log('\n🧪 Running post-repair test...');
      await testFamilyAccessComprehensive();
    }
  } else {
    console.log('🧪 Running in TEST mode');
    console.log('💡 Use --repair flag to perform manual repair');
    await testFamilyAccessComprehensive();
  }
}

// Run the test
main().then(() => {
  console.log('\n🎯 Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Script failed:', error);
  process.exit(1);
});