const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://kinconnect-production-default-rtdb.firebaseio.com'
  });
}

const firestore = admin.firestore();

async function testInvitationAcceptanceFlow() {
  console.log('🧪 === INVITATION ACCEPTANCE FLOW DEBUG TEST ===');
  console.log('🧪 Testing complete end-to-end invitation acceptance with enhanced logging');
  
  try {
    // Test configuration
    const testConfig = {
      patientEmail: 'patient@test.com',
      familyMemberEmail: 'family@test.com',
      patientName: 'Test Patient',
      familyMemberName: 'Test Family Member',
      baseUrl: 'https://us-central1-kinconnect-production.cloudfunctions.net/api'
    };

    console.log('🧪 Test Configuration:', testConfig);

    // Step 1: Check if test users exist and clean up if needed
    console.log('\n📋 Step 1: Checking existing test data...');
    
    // Find any existing family_calendar_access records for our test emails
    const existingAccessQuery = await firestore.collection('family_calendar_access')
      .where('familyMemberEmail', '==', testConfig.familyMemberEmail)
      .get();
    
    console.log('📋 Found existing access records:', existingAccessQuery.docs.length);
    
    if (!existingAccessQuery.empty) {
      console.log('🧹 Cleaning up existing test data...');
      const batch = firestore.batch();
      existingAccessQuery.docs.forEach(doc => {
        console.log('🗑️ Deleting access record:', doc.id, doc.data());
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('✅ Cleanup completed');
    }

    // Step 2: Find or create test patient user
    console.log('\n👤 Step 2: Setting up test patient user...');
    
    let patientUserId = null;
    const patientQuery = await firestore.collection('users')
      .where('email', '==', testConfig.patientEmail)
      .limit(1)
      .get();
    
    if (!patientQuery.empty) {
      patientUserId = patientQuery.docs[0].id;
      console.log('👤 Found existing patient user:', patientUserId);
    } else {
      // Create test patient user
      const patientUserRef = await firestore.collection('users').add({
        email: testConfig.patientEmail,
        name: testConfig.patientName,
        userType: 'patient',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      patientUserId = patientUserRef.id;
      console.log('👤 Created new patient user:', patientUserId);
    }

    // Step 3: Create a test invitation
    console.log('\n📧 Step 3: Creating test invitation...');
    
    const invitationToken = `test_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const emailHash = Buffer.from(testConfig.familyMemberEmail).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const documentId = `${patientUserId}_${emailHash}`;

    const invitationData = {
      patientId: patientUserId,
      familyMemberId: '',
      familyMemberName: testConfig.familyMemberName,
      familyMemberEmail: testConfig.familyMemberEmail,
      permissions: {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canClaimResponsibility: true,
        canManageFamily: false,
        canViewMedicalDetails: false,
        canReceiveNotifications: true
      },
      accessLevel: 'limited',
      eventTypesAllowed: [],
      emergencyAccess: false,
      status: 'pending',
      invitedAt: admin.firestore.Timestamp.now(),
      createdBy: patientUserId,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      invitationToken,
      invitationExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
    };

    await firestore.collection('family_calendar_access').doc(documentId).set(invitationData);
    console.log('📧 Created invitation:', {
      documentId,
      invitationToken,
      patientId: patientUserId,
      familyMemberEmail: testConfig.familyMemberEmail
    });

    // Step 4: Find or create test family member user
    console.log('\n👥 Step 4: Setting up test family member user...');
    
    let familyMemberUserId = null;
    const familyMemberQuery = await firestore.collection('users')
      .where('email', '==', testConfig.familyMemberEmail)
      .limit(1)
      .get();
    
    if (!familyMemberQuery.empty) {
      familyMemberUserId = familyMemberQuery.docs[0].id;
      console.log('👥 Found existing family member user:', familyMemberUserId);
      
      // Check current state
      const currentData = familyMemberQuery.docs[0].data();
      console.log('👥 Current family member data:', {
        userType: currentData.userType,
        primaryPatientId: currentData.primaryPatientId,
        linkedPatientIds: currentData.linkedPatientIds,
        familyMemberIds: currentData.familyMemberIds
      });
    } else {
      // Create test family member user
      const familyMemberUserRef = await firestore.collection('users').add({
        email: testConfig.familyMemberEmail,
        name: testConfig.familyMemberName,
        userType: 'patient', // Start as patient, should be converted to family_member
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      familyMemberUserId = familyMemberUserRef.id;
      console.log('👥 Created new family member user:', familyMemberUserId);
    }

    // Step 5: Simulate invitation acceptance via API call
    console.log('\n🤝 Step 5: Simulating invitation acceptance...');
    
    // Create a custom Firebase token for the family member user
    const customToken = await admin.auth().createCustomToken(familyMemberUserId);
    console.log('🔑 Created custom token for family member user');

    // Make API call to accept invitation
    const fetch = require('node-fetch');
    
    const acceptResponse = await fetch(`${testConfig.baseUrl}/invitations/accept/${invitationToken}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customToken}`,
        'Content-Type': 'application/json'
      }
    });

    const acceptResult = await acceptResponse.json();
    console.log('🤝 Invitation acceptance response:', {
      status: acceptResponse.status,
      success: acceptResult.success,
      message: acceptResult.message,
      data: acceptResult.data,
      debug: acceptResult.debug,
      error: acceptResult.error
    });

    // Step 6: Verify the results
    console.log('\n🔍 Step 6: Verifying invitation acceptance results...');
    
    // Check family_calendar_access record
    const updatedAccessDoc = await firestore.collection('family_calendar_access').doc(documentId).get();
    const updatedAccessData = updatedAccessDoc.data();
    
    console.log('🔍 Updated family_calendar_access record:', {
      exists: updatedAccessDoc.exists,
      status: updatedAccessData?.status,
      familyMemberId: updatedAccessData?.familyMemberId,
      acceptedAt: updatedAccessData?.acceptedAt?.toDate()?.toISOString(),
      hasInvitationToken: !!updatedAccessData?.invitationToken
    });

    // Check family member user record
    const updatedFamilyMemberDoc = await firestore.collection('users').doc(familyMemberUserId).get();
    const updatedFamilyMemberData = updatedFamilyMemberDoc.data();
    
    console.log('🔍 Updated family member user record:', {
      exists: updatedFamilyMemberDoc.exists,
      userType: updatedFamilyMemberData?.userType,
      primaryPatientId: updatedFamilyMemberData?.primaryPatientId,
      linkedPatientIds: updatedFamilyMemberData?.linkedPatientIds,
      familyMemberIds: updatedFamilyMemberData?.familyMemberIds,
      lastInvitationAcceptedAt: updatedFamilyMemberData?.lastInvitationAcceptedAt?.toDate()?.toISOString(),
      lastInvitationAcceptedFrom: updatedFamilyMemberData?.lastInvitationAcceptedFrom
    });

    // Check patient user record
    const updatedPatientDoc = await firestore.collection('users').doc(patientUserId).get();
    const updatedPatientData = updatedPatientDoc.data();
    
    console.log('🔍 Updated patient user record:', {
      exists: updatedPatientDoc.exists,
      userType: updatedPatientData?.userType,
      familyMemberIds: updatedPatientData?.familyMemberIds,
      lastFamilyMemberAdded: updatedPatientData?.lastFamilyMemberAdded,
      lastFamilyMemberAddedAt: updatedPatientData?.lastFamilyMemberAddedAt?.toDate()?.toISOString()
    });

    // Step 7: Analyze results and identify issues
    console.log('\n📊 Step 7: Analysis and Issue Identification...');
    
    const issues = [];
    const successes = [];

    // Check if invitation was accepted
    if (acceptResult.success && updatedAccessData?.status === 'active') {
      successes.push('✅ Invitation was successfully accepted');
    } else {
      issues.push('❌ Invitation acceptance failed or status not updated');
    }

    // Check if family member ID was set
    if (updatedAccessData?.familyMemberId === familyMemberUserId) {
      successes.push('✅ Family member ID was correctly set in access record');
    } else {
      issues.push('❌ Family member ID not set in access record');
    }

    // Check if user type was updated
    if (updatedFamilyMemberData?.userType === 'family_member') {
      successes.push('✅ User type was correctly updated to family_member');
    } else {
      issues.push('❌ User type was not updated to family_member');
    }

    // Check if primaryPatientId was set - THIS IS THE KEY ISSUE
    if (updatedFamilyMemberData?.primaryPatientId === patientUserId) {
      successes.push('✅ primaryPatientId was correctly set');
    } else {
      issues.push('❌ CRITICAL: primaryPatientId was NOT set - this is the main issue!');
    }

    // Check if linkedPatientIds was updated
    if (updatedFamilyMemberData?.linkedPatientIds?.includes(patientUserId)) {
      successes.push('✅ linkedPatientIds was correctly updated');
    } else {
      issues.push('❌ linkedPatientIds was not updated');
    }

    // Check if patient's familyMemberIds was updated
    if (updatedPatientData?.familyMemberIds?.includes(familyMemberUserId)) {
      successes.push('✅ Patient familyMemberIds was correctly updated');
    } else {
      issues.push('❌ Patient familyMemberIds was not updated');
    }

    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('\n✅ SUCCESSES:');
    successes.forEach(success => console.log(success));
    
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(issue => console.log(issue));

    // Step 8: Provide diagnosis and recommendations
    console.log('\n🔬 Step 8: Diagnosis and Recommendations...');
    
    if (issues.some(issue => issue.includes('primaryPatientId'))) {
      console.log('\n🚨 ROOT CAUSE IDENTIFIED:');
      console.log('🚨 The primaryPatientId field is not being set during invitation acceptance.');
      console.log('🚨 This is likely due to one of the following:');
      console.log('   1. Transaction update is failing silently');
      console.log('   2. Firestore security rules are preventing the update');
      console.log('   3. The update operation is being overwritten by another operation');
      console.log('   4. The field is being set but immediately cleared by another process');
      
      console.log('\n💡 RECOMMENDED FIXES:');
      console.log('   1. Add explicit error handling for the user document update');
      console.log('   2. Use a separate transaction just for the user document update');
      console.log('   3. Add retry logic for the primaryPatientId update');
      console.log('   4. Check Firestore security rules for user document updates');
      console.log('   5. Add post-transaction verification and repair logic');
    }

    // Step 9: Test family access API
    console.log('\n🔍 Step 9: Testing family access API...');
    
    try {
      const familyAccessResponse = await fetch(`${testConfig.baseUrl}/family-access`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${customToken}`,
          'Content-Type': 'application/json'
        }
      });

      const familyAccessResult = await familyAccessResponse.json();
      console.log('🔍 Family access API response:', {
        status: familyAccessResponse.status,
        success: familyAccessResult.success,
        patientsCount: familyAccessResult.data?.patientsIHaveAccessTo?.length || 0,
        familyMembersCount: familyAccessResult.data?.familyMembersWithAccessToMe?.length || 0,
        totalConnections: familyAccessResult.data?.totalConnections || 0
      });

      if (familyAccessResult.data?.patientsIHaveAccessTo?.length > 0) {
        console.log('✅ Family member can access patient data via API');
      } else {
        console.log('❌ Family member cannot access patient data via API');
      }
    } catch (apiError) {
      console.error('❌ Error testing family access API:', apiError.message);
    }

    console.log('\n🧪 === TEST COMPLETED ===');
    
    return {
      success: issues.length === 0,
      issues,
      successes,
      testData: {
        patientUserId,
        familyMemberUserId,
        invitationToken,
        documentId
      }
    };

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('❌ Error stack:', error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Run the test
testInvitationAcceptanceFlow()
  .then(result => {
    console.log('\n🏁 Final Test Result:', result.success ? 'PASSED' : 'FAILED');
    if (!result.success) {
      console.log('🏁 Issues found:', result.issues?.length || 0);
      console.log('🏁 Error:', result.error);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });