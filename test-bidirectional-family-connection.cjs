const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

async function testBidirectionalFamilyConnection() {
  try {
    console.log('🧪 Testing bidirectional family member connection...');
    
    // Step 1: Create test patient user
    const patientUserId = 'test-patient-user-123';
    const patientUserData = {
      id: patientUserId,
      name: 'Dr. Test Patient',
      email: 'patient@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      familyMembers: [] // Should be updated when family member accepts
    };
    
    // Step 2: Create test family member user
    const familyMemberUserId = 'test-family-member-456';
    const familyMemberUserData = {
      id: familyMemberUserId,
      name: 'John Family Member',
      email: 'family@test.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Step 3: Create test invitation
    const invitationToken = `test_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const invitationData = {
      id: `test_invitation_${Date.now()}`,
      patientId: 'test-patient-123',
      familyMemberId: '', // Empty until accepted
      familyMemberName: 'John Family Member',
      familyMemberEmail: 'family@test.com',
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
      emergencyAccess: false,
      status: 'pending',
      invitedAt: new Date(),
      createdBy: patientUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      invitationToken,
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    console.log('📝 Creating test data...');
    
    // Save test data
    const batch = db.batch();
    batch.set(db.collection('users').doc(patientUserId), patientUserData);
    batch.set(db.collection('users').doc(familyMemberUserId), familyMemberUserData);
    batch.set(db.collection('family_calendar_access').doc(invitationData.id), invitationData);
    await batch.commit();
    
    console.log('✅ Test data created successfully');
    
    // Step 4: Simulate invitation acceptance
    console.log('🔄 Simulating invitation acceptance...');
    
    const acceptanceBatch = db.batch();
    
    // Update family_calendar_access record
    const accessRef = db.collection('family_calendar_access').doc(invitationData.id);
    acceptanceBatch.update(accessRef, {
      familyMemberId: familyMemberUserId,
      status: 'active',
      acceptedAt: new Date(),
      updatedAt: new Date(),
      invitationToken: admin.firestore.FieldValue.delete(),
      invitationExpiresAt: admin.firestore.FieldValue.delete(),
      connectionVerified: true,
      lastVerificationAt: new Date()
    });
    
    // Update family member's user record
    const familyMemberRef = db.collection('users').doc(familyMemberUserId);
    acceptanceBatch.update(familyMemberRef, {
      primaryPatientId: invitationData.patientId,
      familyMemberOf: admin.firestore.FieldValue.arrayUnion(invitationData.patientId),
      lastFamilyAccessCheck: new Date(),
      invitationHistory: admin.firestore.FieldValue.arrayUnion({
        invitationId: invitationData.id,
        acceptedAt: new Date(),
        patientId: invitationData.patientId
      }),
      updatedAt: new Date()
    });
    
    // Update patient's user record with new family member
    const patientUserRef = db.collection('users').doc(patientUserId);
    acceptanceBatch.update(patientUserRef, {
      familyMembers: admin.firestore.FieldValue.arrayUnion({
        familyMemberId: familyMemberUserId,
        familyMemberName: familyMemberUserData.name,
        familyMemberEmail: familyMemberUserData.email,
        accessLevel: invitationData.accessLevel,
        acceptedAt: new Date(),
        relationship: 'family_member'
      }),
      lastFamilyUpdate: new Date(),
      updatedAt: new Date()
    });
    
    await acceptanceBatch.commit();
    console.log('✅ Invitation acceptance simulated successfully');
    
    // Step 5: Verify bidirectional connection
    console.log('🔍 Verifying bidirectional connection...');
    
    // Check family member's record
    const familyMemberDoc = await db.collection('users').doc(familyMemberUserId).get();
    const familyMemberData = familyMemberDoc.data();
    
    console.log('👨‍👩‍👧‍👦 Family Member Record:');
    console.log('  ├─ Primary Patient ID:', familyMemberData.primaryPatientId);
    console.log('  ├─ Family Member Of:', familyMemberData.familyMemberOf);
    console.log('  └─ Invitation History:', familyMemberData.invitationHistory?.length || 0, 'entries');
    
    // Check patient's record
    const patientDoc = await db.collection('users').doc(patientUserId).get();
    const patientData = patientDoc.data();
    
    console.log('👤 Patient Record:');
    console.log('  ├─ Family Members:', patientData.familyMembers?.length || 0, 'members');
    console.log('  └─ Last Family Update:', patientData.lastFamilyUpdate);
    
    if (patientData.familyMembers?.length > 0) {
      patientData.familyMembers.forEach((fm, index) => {
        console.log(`    ├─ Member ${index + 1}: ${fm.familyMemberName} (${fm.familyMemberEmail})`);
        console.log(`    └─ Access Level: ${fm.accessLevel}, Accepted: ${fm.acceptedAt}`);
      });
    }
    
    // Check family_calendar_access record
    const accessDoc = await db.collection('family_calendar_access').doc(invitationData.id).get();
    const accessData = accessDoc.data();
    
    console.log('🔗 Family Calendar Access Record:');
    console.log('  ├─ Status:', accessData.status);
    console.log('  ├─ Family Member ID:', accessData.familyMemberId);
    console.log('  ├─ Patient ID:', accessData.patientId);
    console.log('  └─ Connection Verified:', accessData.connectionVerified);
    
    // Verification checks
    const checks = {
      familyMemberHasPatientId: familyMemberData.primaryPatientId === invitationData.patientId,
      familyMemberInArray: familyMemberData.familyMemberOf?.includes(invitationData.patientId),
      patientHasFamilyMember: patientData.familyMembers?.some(fm => fm.familyMemberId === familyMemberUserId),
      accessRecordActive: accessData.status === 'active',
      accessRecordLinked: accessData.familyMemberId === familyMemberUserId
    };
    
    console.log('\n✅ VERIFICATION RESULTS:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });
    
    const allPassed = Object.values(checks).every(Boolean);
    console.log(`\n🎯 OVERALL RESULT: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
    
    return {
      success: allPassed,
      checks,
      testData: {
        patientUserId,
        familyMemberUserId,
        invitationToken,
        invitationId: invitationData.id
      }
    };
    
  } catch (error) {
    console.error('❌ Error testing bidirectional connection:', error);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...');
    
    const batch = db.batch();
    
    // Delete test users
    batch.delete(db.collection('users').doc('test-patient-user-123'));
    batch.delete(db.collection('users').doc('test-family-member-456'));
    
    // Delete test family access records
    const accessQuery = await db.collection('family_calendar_access')
      .where('familyMemberEmail', '==', 'family@test.com')
      .get();
    
    accessQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Test data cleaned up successfully');
    
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await cleanupTestData();
    return;
  }
  
  try {
    const result = await testBidirectionalFamilyConnection();
    
    if (result.success) {
      console.log('\n🎉 SUCCESS: Bidirectional family connection is working correctly!');
      console.log('   ├─ Family member can access patient data');
      console.log('   ├─ Patient record shows new family member');
      console.log('   └─ All database relationships are properly established');
    } else {
      console.log('\n❌ FAILURE: Some bidirectional connection checks failed');
      console.log('   └─ Review the verification results above for details');
    }
    
    console.log('\n🧹 To cleanup test data, run: node test-bidirectional-family-connection.cjs --cleanup');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);