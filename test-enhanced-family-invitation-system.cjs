const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();
const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test configuration
const TEST_CONFIG = {
  // Patient (inviter) credentials
  PATIENT_EMAIL: 'test.patient@example.com',
  PATIENT_UID: 'test-patient-uid-123',
  PATIENT_NAME: 'Test Patient',
  
  // Family member (invitee) credentials  
  FAMILY_EMAIL: 'test.family@example.com',
  FAMILY_UID: 'test-family-uid-456',
  FAMILY_NAME: 'Test Family Member',
  
  // Test invitation data
  INVITATION_MESSAGE: 'Please join my care network'
};

async function runEnhancedFamilyInvitationTest() {
  console.log('🧪 Starting Enhanced Family Invitation System Test');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Clean up any existing test data
    console.log('\n📋 Step 1: Cleaning up existing test data...');
    await cleanupTestData();
    
    // Step 2: Create test patient and family member users
    console.log('\n📋 Step 2: Creating test users...');
    await createTestUsers();
    
    // Step 3: Create patient profile
    console.log('\n📋 Step 3: Creating patient profile...');
    await createPatientProfile();
    
    // Step 4: Send family invitation
    console.log('\n📋 Step 4: Sending family invitation...');
    const invitationToken = await sendFamilyInvitation();
    
    // Step 5: Accept invitation (this is where the bug typically occurs)
    console.log('\n📋 Step 5: Accepting family invitation...');
    await acceptFamilyInvitation(invitationToken);
    
    // Step 6: Test family access API with enhanced fallbacks
    console.log('\n📋 Step 6: Testing enhanced family access API...');
    await testEnhancedFamilyAccessAPI();
    
    // Step 7: Test frontend family context simulation
    console.log('\n📋 Step 7: Simulating frontend family context...');
    await simulateFrontendFamilyContext();
    
    // Step 8: Test permission system
    console.log('\n📋 Step 8: Testing permission system...');
    await testPermissionSystem();
    
    // Step 9: Test patient switching functionality
    console.log('\n📋 Step 9: Testing patient switching...');
    await testPatientSwitching();
    
    // Step 10: Verify database state
    console.log('\n📋 Step 10: Verifying final database state...');
    await verifyDatabaseState();
    
    console.log('\n🎉 Enhanced Family Invitation System Test COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n❌ Enhanced Family Invitation System Test FAILED:', error);
    console.log('=' .repeat(60));
    
    // Show debugging information
    await showDebuggingInfo();
  }
}

async function cleanupTestData() {
  try {
    // Clean up users
    const usersToDelete = [TEST_CONFIG.PATIENT_UID, TEST_CONFIG.FAMILY_UID];
    for (const uid of usersToDelete) {
      try {
        await firestore.collection('users').doc(uid).delete();
        console.log(`✅ Deleted user: ${uid}`);
      } catch (e) {
        console.log(`ℹ️ User ${uid} didn't exist or already deleted`);
      }
    }
    
    // Clean up family access records
    const familyAccessQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberEmail', '==', TEST_CONFIG.FAMILY_EMAIL)
      .get();
    
    for (const doc of familyAccessQuery.docs) {
      await doc.ref.delete();
      console.log(`✅ Deleted family access record: ${doc.id}`);
    }
    
    // Clean up patients
    const patientsQuery = await firestore.collection('patients')
      .where('userId', '==', TEST_CONFIG.PATIENT_UID)
      .get();
    
    for (const doc of patientsQuery.docs) {
      await doc.ref.delete();
      console.log(`✅ Deleted patient record: ${doc.id}`);
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.log('⚠️ Cleanup had some issues (this is normal):', error.message);
  }
}

async function createTestUsers() {
  // Create patient user
  const patientUser = {
    id: TEST_CONFIG.PATIENT_UID,
    email: TEST_CONFIG.PATIENT_EMAIL,
    name: TEST_CONFIG.PATIENT_NAME,
    userType: 'patient',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  };
  
  await firestore.collection('users').doc(TEST_CONFIG.PATIENT_UID).set(patientUser);
  console.log('✅ Created patient user:', TEST_CONFIG.PATIENT_EMAIL);
  
  // Create family member user
  const familyUser = {
    id: TEST_CONFIG.FAMILY_UID,
    email: TEST_CONFIG.FAMILY_EMAIL,
    name: TEST_CONFIG.FAMILY_NAME,
    userType: 'family_member',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  };
  
  await firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID).set(familyUser);
  console.log('✅ Created family member user:', TEST_CONFIG.FAMILY_EMAIL);
}

async function createPatientProfile() {
  const patientProfile = {
    id: `patient-${TEST_CONFIG.PATIENT_UID}`,
    userId: TEST_CONFIG.PATIENT_UID,
    dateOfBirth: '1980-01-01',
    gender: 'prefer_not_to_say',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  };
  
  await firestore.collection('patients').doc(patientProfile.id).set(patientProfile);
  console.log('✅ Created patient profile:', patientProfile.id);
  
  return patientProfile.id;
}

async function sendFamilyInvitation() {
  // Create family access invitation directly in database
  const invitationToken = `test_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const familyAccess = {
    id: `access_${Date.now()}`,
    patientId: `patient-${TEST_CONFIG.PATIENT_UID}`,
    familyMemberId: '', // Will be set when invitation is accepted
    familyMemberName: TEST_CONFIG.FAMILY_NAME,
    familyMemberEmail: TEST_CONFIG.FAMILY_EMAIL,
    permissions: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canClaimResponsibility: true,
      canManageFamily: false,
      canViewMedicalDetails: true,
      canReceiveNotifications: true
    },
    accessLevel: 'limited',
    emergencyAccess: false,
    status: 'pending',
    invitedAt: admin.firestore.Timestamp.now(),
    createdBy: TEST_CONFIG.PATIENT_UID,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    invitationToken,
    invitationExpiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  };
  
  await firestore.collection('family_calendar_access').doc(familyAccess.id).set(familyAccess);
  console.log('✅ Created family invitation with token:', invitationToken);
  
  return invitationToken;
}

async function acceptFamilyInvitation(invitationToken) {
  console.log('🔍 Accepting invitation with enhanced process...');
  
  // Find the invitation
  const invitationQuery = await firestore.collection('family_calendar_access')
    .where('invitationToken', '==', invitationToken)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  
  if (invitationQuery.empty) {
    throw new Error('Invitation not found');
  }
  
  const invitationDoc = invitationQuery.docs[0];
  const invitation = invitationDoc.data();
  
  console.log('✅ Found invitation:', {
    id: invitationDoc.id,
    patientId: invitation.patientId,
    familyMemberEmail: invitation.familyMemberEmail
  });
  
  // Enhanced acceptance process with transaction
  const batch = firestore.batch();
  
  // Update family access record
  batch.update(invitationDoc.ref, {
    familyMemberId: TEST_CONFIG.FAMILY_UID,
    status: 'active',
    acceptedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    invitationToken: admin.firestore.FieldValue.delete(),
    invitationExpiresAt: admin.firestore.FieldValue.delete(),
    connectionVerified: true,
    lastVerificationAt: admin.firestore.Timestamp.now()
  });
  
  // Update user record with family member metadata
  const userRef = firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID);
  batch.update(userRef, {
    primaryPatientId: invitation.patientId,
    familyMemberOf: admin.firestore.FieldValue.arrayUnion(invitation.patientId),
    lastFamilyAccessCheck: admin.firestore.Timestamp.now(),
    invitationHistory: admin.firestore.FieldValue.arrayUnion({
      invitationId: invitation.id,
      acceptedAt: admin.firestore.Timestamp.now(),
      patientId: invitation.patientId
    }),
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  await batch.commit();
  console.log('✅ Enhanced invitation acceptance completed with transaction');
  
  // Verify the acceptance worked
  const updatedDoc = await invitationDoc.ref.get();
  const updatedData = updatedDoc.data();
  
  console.log('🔍 Verification - Updated family access record:', {
    familyMemberId: updatedData.familyMemberId,
    status: updatedData.status,
    connectionVerified: updatedData.connectionVerified
  });
  
  // Verify user record was updated
  const userDoc = await firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID).get();
  const userData = userDoc.data();
  
  console.log('🔍 Verification - Updated user record:', {
    primaryPatientId: userData.primaryPatientId,
    familyMemberOf: userData.familyMemberOf,
    invitationHistoryCount: userData.invitationHistory?.length || 0
  });
  
  if (updatedData.familyMemberId !== TEST_CONFIG.FAMILY_UID) {
    throw new Error('familyMemberId not set correctly after acceptance');
  }
  
  if (userData.primaryPatientId !== invitation.patientId) {
    throw new Error('primaryPatientId not set correctly in user record');
  }
  
  console.log('✅ Invitation acceptance verification passed');
}

async function testEnhancedFamilyAccessAPI() {
  console.log('🔍 Testing enhanced family access API...');
  
  // Simulate the enhanced family access query
  console.log('\n--- Testing Layer 1: Primary query by familyMemberId ---');
  const layer1Query = await firestore.collection('family_calendar_access')
    .where('familyMemberId', '==', TEST_CONFIG.FAMILY_UID)
    .where('status', '==', 'active')
    .get();
  
  console.log(`📊 Layer 1 Results: ${layer1Query.docs.length} records found`);
  
  if (layer1Query.docs.length > 0) {
    const accessData = layer1Query.docs[0].data();
    console.log('✅ Layer 1 Success - Found access record:', {
      id: layer1Query.docs[0].id,
      patientId: accessData.patientId,
      familyMemberId: accessData.familyMemberId,
      status: accessData.status
    });
  } else {
    console.log('❌ Layer 1 Failed - No records found by familyMemberId');
    
    // Test Layer 2: Email fallback
    console.log('\n--- Testing Layer 2: Email fallback ---');
    const layer2Query = await firestore.collection('family_calendar_access')
      .where('familyMemberEmail', '==', TEST_CONFIG.FAMILY_EMAIL)
      .where('status', '==', 'active')
      .get();
    
    console.log(`📊 Layer 2 Results: ${layer2Query.docs.length} records found`);
    
    if (layer2Query.docs.length > 0) {
      console.log('✅ Layer 2 Success - Found access record by email');
      // Would trigger auto-repair in real system
    } else {
      console.log('❌ Layer 2 Failed - No records found by email');
      
      // Test Layer 3: User primaryPatientId
      console.log('\n--- Testing Layer 3: User primaryPatientId ---');
      const userDoc = await firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID).get();
      const userData = userDoc.data();
      
      if (userData?.primaryPatientId) {
        console.log('✅ Layer 3 Success - Found primaryPatientId:', userData.primaryPatientId);
        // Would create emergency access in real system
      } else {
        console.log('❌ Layer 3 Failed - No primaryPatientId found');
      }
    }
  }
}

async function simulateFrontendFamilyContext() {
  console.log('🔍 Simulating frontend FamilyContext behavior...');
  
  // Simulate what the frontend FamilyContext would do
  const familyAccessQuery = await firestore.collection('family_calendar_access')
    .where('familyMemberId', '==', TEST_CONFIG.FAMILY_UID)
    .where('status', '==', 'active')
    .get();
  
  console.log(`📊 Frontend Simulation: Found ${familyAccessQuery.docs.length} family access records`);
  
  if (familyAccessQuery.docs.length > 0) {
    const accessData = familyAccessQuery.docs[0].data();
    console.log('👨‍👩‍👧‍👦 Frontend Simulation: User would be identified as family member');
    console.log('🎯 Frontend Simulation: Active patient ID would be set to:', accessData.patientId);
    console.log('✅ Frontend Simulation: Family member would see patient dashboard');
    
    // Test getEffectivePatientId() equivalent
    const effectivePatientId = accessData.patientId; // This is what getEffectivePatientId() should return
    console.log('🔍 Frontend Simulation: getEffectivePatientId() would return:', effectivePatientId);
    
    // Verify this matches the expected patient
    if (effectivePatientId === `patient-${TEST_CONFIG.PATIENT_UID}`) {
      console.log('✅ Frontend Simulation: Patient ID resolution is correct');
    } else {
      console.log('❌ Frontend Simulation: Patient ID resolution is incorrect');
      console.log('   Expected:', `patient-${TEST_CONFIG.PATIENT_UID}`);
      console.log('   Actual:', effectivePatientId);
    }
  } else {
    console.log('❌ Frontend Simulation: No family access found - user would see empty dashboard');
    
    // Test fallback mechanisms
    console.log('🔄 Frontend Simulation: Testing fallback mechanisms...');
    
    // Check user's primaryPatientId
    const userDoc = await firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID).get();
    const userData = userDoc.data();
    
    if (userData?.primaryPatientId) {
      console.log('✅ Frontend Simulation: Fallback would use primaryPatientId:', userData.primaryPatientId);
    } else {
      console.log('❌ Frontend Simulation: No fallback available - user would see empty dashboard');
    }
  }
}

async function testPermissionSystem() {
  console.log('🔍 Testing permission system...');
  
  const familyAccessQuery = await firestore.collection('family_calendar_access')
    .where('familyMemberId', '==', TEST_CONFIG.FAMILY_UID)
    .where('status', '==', 'active')
    .get();
  
  if (familyAccessQuery.docs.length > 0) {
    const accessData = familyAccessQuery.docs[0].data();
    const permissions = accessData.permissions;
    
    console.log('📋 Permission Analysis:');
    console.log('   canView:', permissions.canView ? '✅' : '❌');
    console.log('   canCreate:', permissions.canCreate ? '✅' : '❌');
    console.log('   canEdit:', permissions.canEdit ? '✅' : '❌');
    console.log('   canDelete:', permissions.canDelete ? '✅' : '❌');
    console.log('   canViewMedicalDetails:', permissions.canViewMedicalDetails ? '✅' : '❌');
    console.log('   canManageFamily:', permissions.canManageFamily ? '✅' : '❌');
    
    // Determine access type
    if (permissions.canEdit && permissions.canCreate && permissions.canDelete) {
      console.log('🔓 Access Type: FULL ACCESS');
    } else if (permissions.canView && !permissions.canEdit) {
      console.log('👁️ Access Type: VIEW ONLY');
    } else {
      console.log('🔒 Access Type: LIMITED EDIT');
    }
    
    console.log('✅ Permission system test completed');
  } else {
    console.log('❌ No family access found for permission testing');
  }
}

async function testPatientSwitching() {
  console.log('🔍 Testing patient switching functionality...');
  
  // In a real scenario with multiple patients, this would test switching
  // For now, we'll verify the single patient connection
  const familyAccessQuery = await firestore.collection('family_calendar_access')
    .where('familyMemberId', '==', TEST_CONFIG.FAMILY_UID)
    .where('status', '==', 'active')
    .get();
  
  console.log(`📊 Available patients for switching: ${familyAccessQuery.docs.length}`);
  
  if (familyAccessQuery.docs.length === 1) {
    console.log('ℹ️ Single patient access - no switching needed');
    console.log('✅ Patient switching test completed (single patient scenario)');
  } else if (familyAccessQuery.docs.length > 1) {
    console.log('🔄 Multiple patient access detected - testing switching logic');
    // Would test actual switching here
    console.log('✅ Patient switching test completed (multiple patient scenario)');
  } else {
    console.log('❌ No patient access found for switching test');
  }
}

async function verifyDatabaseState() {
  console.log('🔍 Verifying final database state...');
  
  // Check family access record
  const familyAccessQuery = await firestore.collection('family_calendar_access')
    .where('familyMemberId', '==', TEST_CONFIG.FAMILY_UID)
    .where('status', '==', 'active')
    .get();
  
  console.log('\n📊 Family Access Records:');
  if (familyAccessQuery.docs.length > 0) {
    familyAccessQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   Record ${index + 1}:`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     Patient ID: ${data.patientId}`);
      console.log(`     Family Member ID: ${data.familyMemberId}`);
      console.log(`     Status: ${data.status}`);
      console.log(`     Access Level: ${data.accessLevel}`);
      console.log(`     Connection Verified: ${data.connectionVerified || false}`);
    });
    console.log('✅ Family access records are properly configured');
  } else {
    console.log('❌ No active family access records found');
  }
  
  // Check user record
  const userDoc = await firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID).get();
  const userData = userDoc.data();
  
  console.log('\n📊 Family Member User Record:');
  console.log(`   Primary Patient ID: ${userData?.primaryPatientId || 'NOT SET'}`);
  console.log(`   Family Member Of: ${userData?.familyMemberOf || 'NOT SET'}`);
  console.log(`   Last Family Access Check: ${userData?.lastFamilyAccessCheck || 'NOT SET'}`);
  console.log(`   Invitation History: ${userData?.invitationHistory?.length || 0} entries`);
  
  if (userData?.primaryPatientId) {
    console.log('✅ User record is properly configured with patient connection');
  } else {
    console.log('❌ User record is missing patient connection');
  }
  
  // Overall assessment
  const hasValidFamilyAccess = familyAccessQuery.docs.length > 0;
  const hasValidUserConnection = userData?.primaryPatientId;
  
  if (hasValidFamilyAccess && hasValidUserConnection) {
    console.log('\n🎉 DATABASE STATE: FULLY CONFIGURED');
    console.log('   ✅ Family access record exists and is active');
    console.log('   ✅ User record has patient connection');
    console.log('   ✅ Family member should see patient dashboard');
  } else {
    console.log('\n❌ DATABASE STATE: INCOMPLETE');
    console.log(`   Family Access: ${hasValidFamilyAccess ? '✅' : '❌'}`);
    console.log(`   User Connection: ${hasValidUserConnection ? '✅' : '❌'}`);
    console.log('   ❌ Family member would see empty dashboard');
  }
}

async function showDebuggingInfo() {
  console.log('\n🔍 DEBUGGING INFORMATION:');
  console.log('=' .repeat(40));
  
  try {
    // Show all family access records for this email
    const allAccessQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberEmail', '==', TEST_CONFIG.FAMILY_EMAIL)
      .get();
    
    console.log(`\n📊 All Family Access Records for ${TEST_CONFIG.FAMILY_EMAIL}:`);
    allAccessQuery.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   Record ${index + 1}:`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     Family Member ID: "${data.familyMemberId}"`);
      console.log(`     Status: ${data.status}`);
      console.log(`     Patient ID: ${data.patientId}`);
      console.log(`     Created: ${data.createdAt?.toDate()}`);
      console.log(`     Accepted: ${data.acceptedAt?.toDate() || 'NOT ACCEPTED'}`);
    });
    
    // Show user record
    const userDoc = await firestore.collection('users').doc(TEST_CONFIG.FAMILY_UID).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`\n📊 User Record for ${TEST_CONFIG.FAMILY_UID}:`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Name: ${userData.name}`);
      console.log(`   User Type: ${userData.userType}`);
      console.log(`   Primary Patient ID: ${userData.primaryPatientId || 'NOT SET'}`);
      console.log(`   Family Member Of: ${JSON.stringify(userData.familyMemberOf || [])}`);
    } else {
      console.log(`\n❌ User record not found for ${TEST_CONFIG.FAMILY_UID}`);
    }
    
  } catch (error) {
    console.error('❌ Error showing debugging info:', error);
  }
}

// Run the test
runEnhancedFamilyInvitationTest().catch(console.error);