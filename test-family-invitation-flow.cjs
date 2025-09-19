const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

async function createTestInvitation() {
  try {
    console.log('🧪 Creating test family invitation...');
    
    // Generate a test invitation token
    const invitationToken = `test_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create test invitation in family_calendar_access collection
    const invitationData = {
      id: `test_invitation_${Date.now()}`,
      patientId: 'test-patient-123',
      familyMemberId: '', // Empty until accepted
      familyMemberName: 'Test Family Member',
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
      createdBy: 'test-user-456',
      createdAt: new Date(),
      updatedAt: new Date(),
      invitationToken,
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    // Create test user for the inviter
    const testUserData = {
      id: 'test-user-456',
      name: 'Dr. Test Patient',
      email: 'patient@test.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save both documents
    await db.collection('family_calendar_access').doc(invitationData.id).set(invitationData);
    await db.collection('users').doc('test-user-456').set(testUserData);
    
    console.log('✅ Test invitation created successfully!');
    console.log('🔗 Invitation Token:', invitationToken);
    console.log('🌐 Test URL:', `http://localhost:3000/family-invite/${invitationToken}`);
    console.log('📧 Family Member Email:', invitationData.familyMemberEmail);
    console.log('👤 Inviter:', testUserData.name);
    
    return {
      invitationToken,
      testUrl: `http://localhost:3000/family-invite/${invitationToken}`,
      invitationData,
      testUserData
    };
    
  } catch (error) {
    console.error('❌ Error creating test invitation:', error);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...');
    
    // Delete test invitation
    const invitationsQuery = await db.collection('family_calendar_access')
      .where('familyMemberEmail', '==', 'family@test.com')
      .get();
    
    const batch = db.batch();
    invitationsQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete test user
    batch.delete(db.collection('users').doc('test-user-456'));
    
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
    const testData = await createTestInvitation();
    
    console.log('\n🎯 TESTING INSTRUCTIONS:');
    console.log('1. Open the test URL in your browser (incognito mode recommended)');
    console.log('2. Verify the invitation details are displayed correctly');
    console.log('3. Click "Continue with Google" to test the authentication flow');
    console.log('4. Verify you get redirected to the AcceptInvitation page after auth');
    console.log('5. Test accepting the invitation');
    console.log('\n🧹 To cleanup test data, run: node test-family-invitation-flow.cjs --cleanup');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);