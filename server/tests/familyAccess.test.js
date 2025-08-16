// Simple test file to verify family access system functionality
// This is a basic test to ensure our services are working correctly

import { familyAccessService } from '../services/familyAccessService.js';

// Test data
const testPatientId = 'test-patient-123';
const testFamilyMemberEmail = 'family@example.com';
const testFamilyMemberName = 'John Family';
const testInvitedBy = 'test-patient-123';

const testPermissions = {
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canClaimResponsibility: true,
  canManageFamily: false,
  canViewMedicalDetails: true,
  canReceiveNotifications: true
};

async function runTests() {
  console.log('🧪 Starting Family Access System Tests...\n');

  try {
    // Test 1: Create Family Invitation
    console.log('Test 1: Creating family invitation...');
    const invitationResult = await familyAccessService.createFamilyInvitation(
      testPatientId,
      testFamilyMemberEmail,
      testFamilyMemberName,
      testPermissions,
      'limited',
      testInvitedBy,
      ['appointment', 'follow_up']
    );

    if (invitationResult.success) {
      console.log('✅ Family invitation created successfully');
      console.log(`   Invitation Token: ${invitationResult.data.invitationToken}`);
    } else {
      console.log('❌ Failed to create family invitation:', invitationResult.error);
      return;
    }

    // Test 2: Get Family Access by Patient ID
    console.log('\nTest 2: Getting family access by patient ID...');
    const familyAccessResult = await familyAccessService.getFamilyAccessByPatientId(testPatientId);

    if (familyAccessResult.success) {
      console.log('✅ Retrieved family access records successfully');
      console.log(`   Found ${familyAccessResult.data.length} access record(s)`);
    } else {
      console.log('❌ Failed to get family access:', familyAccessResult.error);
    }

    // Test 3: Check Permission (should fail since invitation not accepted)
    console.log('\nTest 3: Checking permission before invitation acceptance...');
    const permissionCheck = await familyAccessService.checkPermission(
      testPatientId,
      'test-family-member-456',
      'canView'
    );

    if (!permissionCheck.hasPermission) {
      console.log('✅ Permission correctly denied for non-family member');
    } else {
      console.log('❌ Permission incorrectly granted');
    }

    // Test 4: Emergency Access
    console.log('\nTest 4: Granting emergency access...');
    const emergencyResult = await familyAccessService.grantEmergencyAccess(
      testPatientId,
      'emergency-family-member-789',
      testInvitedBy,
      2 // 2 hours
    );

    if (emergencyResult.success) {
      console.log('✅ Emergency access granted successfully');
      console.log(`   Access Level: ${emergencyResult.data.accessLevel}`);
      console.log(`   Emergency Access: ${emergencyResult.data.emergencyAccess}`);
    } else {
      console.log('❌ Failed to grant emergency access:', emergencyResult.error);
    }

    // Test 5: Cleanup Expired Access
    console.log('\nTest 5: Running cleanup for expired access...');
    await familyAccessService.cleanupExpiredAccess();
    console.log('✅ Cleanup completed successfully');

    console.log('\n🎉 All Family Access System Tests Completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run tests if this file is executed directly
runTests();

export { runTests };