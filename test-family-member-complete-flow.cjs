/**
 * Comprehensive test to verify family member can access patient data
 * Tests the complete flow from family access to medications and dashboard
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'claritystream-uldp9'
      });
      console.log('✅ Firebase initialized with service account');
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'claritystream-uldp9'
      });
      console.log('✅ Firebase initialized with application default');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.log('💡 This test requires Firebase access to verify the complete flow');
    process.exit(1);
  }
}

const db = admin.firestore();

async function testCompleteFamilyMemberFlow() {
  console.log('🧪 TESTING COMPLETE FAMILY MEMBER FLOW');
  console.log('=' .repeat(60));
  
  const familyMemberUserId = 'HAuaPeYBHadpEFSRiwILfud6bwD3';
  const familyMemberEmail = 'fookwin@gmail.com';
  
  try {
    // Step 1: Verify family member user exists
    console.log('\n📋 1. VERIFYING FAMILY MEMBER USER');
    console.log('-'.repeat(50));
    
    const userDoc = await db.collection('users').doc(familyMemberUserId).get();
    if (!userDoc.exists) {
      console.log('❌ Family member user not found!');
      return;
    }
    
    const userData = userDoc.data();
    console.log('✅ Family member user found:');
    console.log(`   ID: ${userData.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Name: ${userData.name}`);
    console.log(`   Type: ${userData.userType}`);
    
    // Step 2: Check family access connection
    console.log('\n🔗 2. CHECKING FAMILY ACCESS CONNECTION');
    console.log('-'.repeat(50));
    
    const familyAccessQuery = await db.collection('family_calendar_access')
      .where('familyMemberId', '==', familyMemberUserId)
      .where('status', '==', 'active')
      .get();
    
    console.log(`📊 Active family access records: ${familyAccessQuery.size}`);
    
    if (familyAccessQuery.empty) {
      console.log('❌ No active family access found!');
      console.log('   This explains why medications and dashboard are empty.');
      console.log('   The family member has no patient connections.');
      
      // Check for any records by email
      const emailQuery = await db.collection('family_calendar_access')
        .where('familyMemberEmail', '==', familyMemberEmail)
        .get();
      
      console.log(`\n📊 Records by email: ${emailQuery.size}`);
      
      if (!emailQuery.empty) {
        console.log('\n🚨 FOUND ORPHANED RECORDS BY EMAIL:');
        emailQuery.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`\n   Record ${index + 1}:`);
          console.log(`   ├─ ID: ${doc.id}`);
          console.log(`   ├─ Patient ID: ${data.patientId}`);
          console.log(`   ├─ Family Member ID: ${data.familyMemberId || 'NOT SET ❌'}`);
          console.log(`   ├─ Status: ${data.status}`);
          console.log(`   ├─ Invited At: ${data.invitedAt?.toDate?.() || data.invitedAt}`);
          console.log(`   └─ Accepted At: ${data.acceptedAt?.toDate?.() || data.acceptedAt || 'NOT SET ❌'}`);
        });
        
        console.log('\n💡 SOLUTION: Run the repair script to fix these orphaned records:');
        console.log('   node repair-family-member-patient-connection.cjs');
      } else {
        console.log('\n❌ No records found by email either!');
        console.log('   This suggests the invitation was never created or was deleted.');
      }
      
      return;
    }
    
    // Step 3: Analyze the family access records
    console.log('\n✅ 3. ANALYZING FAMILY ACCESS RECORDS');
    console.log('-'.repeat(50));
    
    const patientIds = [];
    
    familyAccessQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      patientIds.push(data.patientId);
      
      console.log(`\n   Access Record ${index + 1}:`);
      console.log(`   ├─ ID: ${doc.id}`);
      console.log(`   ├─ Patient ID: ${data.patientId}`);
      console.log(`   ├─ Access Level: ${data.accessLevel}`);
      console.log(`   ├─ Status: ${data.status}`);
      console.log(`   ├─ Accepted At: ${data.acceptedAt?.toDate?.() || data.acceptedAt}`);
      console.log(`   └─ Permissions:`);
      console.log(`      ├─ Can View: ${data.permissions?.canView}`);
      console.log(`      ├─ Can Create: ${data.permissions?.canCreate}`);
      console.log(`      ├─ Can Edit: ${data.permissions?.canEdit}`);
      console.log(`      └─ Can View Medical: ${data.permissions?.canViewMedicalDetails}`);
    });
    
    // Step 4: Check patient data accessibility
    console.log('\n👤 4. CHECKING PATIENT DATA ACCESSIBILITY');
    console.log('-'.repeat(50));
    
    for (let i = 0; i < patientIds.length; i++) {
      const patientId = patientIds[i];
      console.log(`\n   Checking Patient ${i + 1}: ${patientId}`);
      
      // Check if patient user exists
      const patientUserDoc = await db.collection('users').doc(patientId).get();
      if (patientUserDoc.exists) {
        const patientUserData = patientUserDoc.data();
        console.log(`   ├─ Patient User: ${patientUserData.name} (${patientUserData.email})`);
        console.log(`   ├─ User Type: ${patientUserData.userType}`);
      } else {
        console.log(`   ├─ ❌ Patient user not found!`);
        continue;
      }
      
      // Check if patient profile exists
      const patientQuery = await db.collection('patients')
        .where('userId', '==', patientId)
        .limit(1)
        .get();
      
      if (!patientQuery.empty) {
        const patientData = patientQuery.docs[0].data();
        console.log(`   ├─ Patient Profile: Found (ID: ${patientQuery.docs[0].id})`);
      } else {
        console.log(`   ├─ ⚠️  Patient profile not found`);
      }
      
      // Check medications for this patient
      const medicationsQuery = await db.collection('medications')
        .where('patientId', '==', patientId)
        .limit(5)
        .get();
      
      console.log(`   ├─ Medications: ${medicationsQuery.size} found`);
      
      if (!medicationsQuery.empty) {
        medicationsQuery.docs.forEach((doc, medIndex) => {
          const medData = doc.data();
          console.log(`   │  └─ ${medIndex + 1}. ${medData.name} (${medData.dosage})`);
        });
      }
      
      // Check medical events for this patient
      const eventsQuery = await db.collection('medical_events')
        .where('patientId', '==', patientId)
        .limit(3)
        .get();
      
      console.log(`   ├─ Medical Events: ${eventsQuery.size} found`);
      
      // Check medication calendar events
      const medCalendarQuery = await db.collection('medication_calendar_events')
        .where('patientId', '==', patientId)
        .limit(3)
        .get();
      
      console.log(`   └─ Medication Calendar Events: ${medCalendarQuery.size} found`);
    }
    
    // Step 5: Simulate FamilyContext.getEffectivePatientId() logic
    console.log('\n🎯 5. SIMULATING FAMILY CONTEXT LOGIC');
    console.log('-'.repeat(50));
    
    console.log('\n   FamilyContext.getEffectivePatientId() logic:');
    console.log('   ├─ User Role: family_member');
    console.log('   ├─ Active Patient ID: Should be first patient from family access');
    
    if (patientIds.length > 0) {
      const effectivePatientId = patientIds[0]; // First patient
      console.log(`   ├─ Effective Patient ID: ${effectivePatientId}`);
      console.log('   └─ ✅ This ID should be used for all API calls');
      
      console.log('\n   API Endpoints that would be called:');
      console.log(`   ├─ Medications: /medications?patientId=${effectivePatientId}`);
      console.log(`   ├─ Visit Summaries: /visit-summaries/${effectivePatientId}`);
      console.log(`   ├─ Medical Events: /medical-events/${effectivePatientId}`);
      console.log(`   └─ Medication Calendar: /medication-calendar/events?patientId=${effectivePatientId}`);
    } else {
      console.log('   └─ ❌ No effective patient ID - APIs will fail');
    }
    
    // Step 6: Summary and recommendations
    console.log('\n📋 6. FLOW ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    if (familyAccessQuery.size > 0) {
      console.log('\n✅ FAMILY ACCESS WORKING:');
      console.log('   ├─ Family member has active access to patient(s)');
      console.log('   ├─ getEffectivePatientId() will return patient ID');
      console.log('   ├─ Dashboard and Medications pages should show patient data');
      console.log('   └─ All API calls should work with patient context');
      
      console.log('\n🧪 NEXT STEPS TO VERIFY:');
      console.log('   1. Login as family member in the app');
      console.log('   2. Check if dashboard shows patient data');
      console.log('   3. Check if medications page shows patient medications');
      console.log('   4. Verify patient switcher shows available patients');
    } else {
      console.log('\n❌ FAMILY ACCESS BROKEN:');
      console.log('   ├─ Family member has no active access to any patients');
      console.log('   ├─ getEffectivePatientId() will return null');
      console.log('   ├─ Dashboard and Medications pages will be empty');
      console.log('   └─ All API calls will fail or return empty data');
      
      console.log('\n🔧 REQUIRED FIXES:');
      console.log('   1. Run repair script to fix orphaned family access records');
      console.log('   2. Verify family_calendar_access collection has proper records');
      console.log('   3. Test that FamilyContext can load patient connections');
      console.log('   4. Verify API endpoints work with patient context');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCompleteFamilyMemberFlow()
  .then(() => {
    console.log('\n✅ Complete flow test finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Complete flow test failed:', error);
    process.exit(1);
  });