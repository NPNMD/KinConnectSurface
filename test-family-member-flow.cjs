#!/usr/bin/env node

/**
 * End-to-End Family Member Flow Test
 *
 * This script tests the complete family member invitation and access flow:
 * 1. Patient sends invitation
 * 2. Family member accepts invitation
 * 3. Family member logs in and gets proper profile with patientId
 * 4. Family member can access patient data
 * 5. Family member cannot send invitations or record visits
 */

const axios = require('axios');
const { URLSearchParams } = require('url');

// Configuration
const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test users (these need to exist in your Firebase auth)
const TEST_PATIENT = {
  email: 'test.patient@example.com',
  name: 'Test Patient',
  uid: 'test_patient_uid_123' // Replace with real UID
};

const TEST_FAMILY_MEMBER = {
  email: 'test.family@example.com',
  name: 'Test Family Member',
  uid: 'test_family_uid_456' // Replace with real UID
};

// Mock Firebase tokens (these would be obtained from Firebase auth in real usage)
// You'll need to replace these with real Firebase ID tokens
const PATIENT_TOKEN = 'YOUR_PATIENT_FIREBASE_ID_TOKEN';
const FAMILY_MEMBER_TOKEN = 'YOUR_FAMILY_MEMBER_FIREBASE_ID_TOKEN';

// Test state
let invitationToken = null;
let invitationId = null;

async function makeRequest(method, endpoint, data = null, token = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  try {
    const response = await axios({
      method,
      url,
      headers,
      data,
      timeout: 30000
    });
    return { status: response.status, data: response.data };
  } catch (error) {
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data,
        error: true
      };
    } else {
      return {
        status: 0,
        data: { error: error.message },
        error: true
      };
    }
  }
}

async function testPatientSendsInvitation() {
  console.log('\n📧 Test 1: Patient sends family invitation');

  if (PATIENT_TOKEN === 'YOUR_PATIENT_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No patient token configured');
    return false;
  }

  const response = await makeRequest('POST', '/invitations/send', {
    email: TEST_FAMILY_MEMBER.email,
    patientName: TEST_FAMILY_MEMBER.name
  }, PATIENT_TOKEN);

  if (response.status === 200 && response.data.success) {
    console.log('✅ Invitation sent successfully');
    console.log('📝 Invitation details:', response.data.data);
    return true;
  } else {
    console.log('❌ Failed to send invitation:', response.data);
    return false;
  }
}

async function testGetInvitationDetails() {
  console.log('\n📋 Test 2: Get invitation details (without auth)');

  // This would typically come from the email link, but for testing we'll assume we have the token
  const testToken = 'test_invitation_token'; // Replace with real token from step 1

  const response = await makeRequest('GET', `/invitations/${testToken}`);

  if (response.status === 200 && response.data.success) {
    console.log('✅ Invitation details retrieved');
    console.log('📝 Details:', response.data.data);
    invitationToken = testToken;
    return true;
  } else {
    console.log('❌ Failed to get invitation details:', response.data);
    return false;
  }
}

async function testFamilyMemberAcceptsInvitation() {
  console.log('\n🤝 Test 3: Family member accepts invitation');

  if (FAMILY_MEMBER_TOKEN === 'YOUR_FAMILY_MEMBER_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No family member token configured');
    return false;
  }

  if (!invitationToken) {
    console.log('⚠️  Skipping - No invitation token available');
    return false;
  }

  const response = await makeRequest('POST', `/invitations/accept/${invitationToken}`, {}, FAMILY_MEMBER_TOKEN);

  if (response.status === 200 && response.data.success) {
    console.log('✅ Invitation accepted successfully');
    console.log('📝 Result:', response.data.data);
    return true;
  } else {
    console.log('❌ Failed to accept invitation:', response.data);
    return false;
  }
}

async function testFamilyMemberProfile() {
  console.log('\n👤 Test 4: Family member gets profile with patientId');

  if (FAMILY_MEMBER_TOKEN === 'YOUR_FAMILY_MEMBER_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No family member token configured');
    return false;
  }

  const response = await makeRequest('GET', '/auth/profile', null, FAMILY_MEMBER_TOKEN);

  if (response.status === 200 && response.data.success) {
    console.log('✅ Profile retrieved');
    console.log('📝 Profile:', {
      userType: response.data.data.userType,
      primaryPatientId: response.data.data.primaryPatientId,
      hasLinkedPatientIds: Array.isArray(response.data.data.linkedPatientIds)
    });

    if (response.data.data.userType === 'family_member' && response.data.data.primaryPatientId) {
      console.log('✅ Family member has correct patient linkage');
      return true;
    } else {
      console.log('❌ Family member profile missing patient linkage');
      return false;
    }
  } else {
    console.log('❌ Failed to get profile:', response.data);
    return false;
  }
}

async function testFamilyMemberAccess() {
  console.log('\n🔐 Test 5: Family member gets family access data');

  if (FAMILY_MEMBER_TOKEN === 'YOUR_FAMILY_MEMBER_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No family member token configured');
    return false;
  }

  const response = await makeRequest('GET', '/family-access', null, FAMILY_MEMBER_TOKEN);

  if (response.status === 200 && response.data.success) {
    console.log('✅ Family access retrieved');
    console.log('📝 Access data:', {
      patientsIHaveAccessTo: response.data.data.patientsIHaveAccessTo?.length || 0,
      totalConnections: response.data.data.totalConnections || 0
    });

    if (response.data.data.patientsIHaveAccessTo?.length > 0) {
      console.log('✅ Family member has access to patients');
      return true;
    } else {
      console.log('❌ Family member has no patient access');
      return false;
    }
  } else {
    console.log('❌ Failed to get family access:', response.data);
    return false;
  }
}

async function testFamilyMemberCannotSendInvitations() {
  console.log('\n🚫 Test 6: Family member cannot send invitations');

  if (FAMILY_MEMBER_TOKEN === 'YOUR_FAMILY_MEMBER_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No family member token configured');
    return false;
  }

  const response = await makeRequest('POST', '/invitations/send', {
    email: 'another.family@example.com',
    patientName: 'Another Family Member'
  }, FAMILY_MEMBER_TOKEN);

  if (response.status === 403 && response.data.error === 'Only patients can invite family members') {
    console.log('✅ Family member correctly blocked from sending invitations');
    return true;
  } else {
    console.log('❌ Family member was not blocked from sending invitations:', response.data);
    return false;
  }
}

async function testFamilyMemberCannotRecordVisits() {
  console.log('\n🚫 Test 7: Family member cannot record visit summaries');

  if (FAMILY_MEMBER_TOKEN === 'YOUR_FAMILY_MEMBER_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No family member token configured');
    return false;
  }

  // Get patient's ID from family access
  const accessResponse = await makeRequest('GET', '/family-access', null, FAMILY_MEMBER_TOKEN);
  if (!accessResponse.data.success || !accessResponse.data.data.patientsIHaveAccessTo?.length) {
    console.log('⚠️  Skipping - Cannot determine patient ID');
    return false;
  }

  const patientId = accessResponse.data.data.patientsIHaveAccessTo[0].patientId;

  const response = await makeRequest('POST', '/visit-summaries', {
    patientId,
    doctorSummary: 'Test visit summary from family member',
    visitDate: new Date().toISOString()
  }, FAMILY_MEMBER_TOKEN);

  if (response.status === 403 && response.data.error === 'Only the patient can record visit summaries') {
    console.log('✅ Family member correctly blocked from recording visits');
    return true;
  } else {
    console.log('❌ Family member was not blocked from recording visits:', response.data);
    return false;
  }
}

async function testPatientCanRecordVisits() {
  console.log('\n✅ Test 8: Patient can record visit summaries');

  if (PATIENT_TOKEN === 'YOUR_PATIENT_FIREBASE_ID_TOKEN') {
    console.log('⚠️  Skipping - No patient token configured');
    return false;
  }

  const response = await makeRequest('POST', '/visit-summaries', {
    patientId: TEST_PATIENT.uid,
    doctorSummary: 'Test visit summary from patient',
    visitDate: new Date().toISOString()
  }, PATIENT_TOKEN);

  if (response.status === 200 && response.data.success) {
    console.log('✅ Patient can record visit summaries');
    return true;
  } else {
    console.log('❌ Patient cannot record visit summaries:', response.data);
    return false;
  }
}

async function runTests() {
  console.log('🧪 === FAMILY MEMBER END-TO-END FLOW TEST ===');
  console.log('Testing the complete family invitation and access flow...\n');

  const results = [];

  // Note: Tests 1, 3, 6, 7, 8 require real Firebase tokens to be configured
  // Tests 2, 4, 5 can work with mock data

  console.log('⚠️  IMPORTANT: Configure real Firebase ID tokens in the script for full testing');
  console.log('   Replace PATIENT_TOKEN and FAMILY_MEMBER_TOKEN with actual Firebase ID tokens\n');

  results.push(await testPatientSendsInvitation());
  results.push(await testGetInvitationDetails());
  results.push(await testFamilyMemberAcceptsInvitation());
  results.push(await testFamilyMemberProfile());
  results.push(await testFamilyMemberAccess());
  results.push(await testFamilyMemberCannotSendInvitations());
  results.push(await testFamilyMemberCannotRecordVisits());
  results.push(await testPatientCanRecordVisits());

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\n📊 TEST RESULTS: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All tests passed! Family member flow is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Review the output above for details.');
    console.log('💡 Common issues:');
    console.log('   - Firebase tokens not configured');
    console.log('   - Test users don\'t exist in Firebase Auth');
    console.log('   - Database state not set up correctly');
  }

  console.log('\n🏁 End-to-end testing completed!');
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Family Member End-to-End Flow Test

Usage:
  node test-family-member-flow.cjs

This script tests:
1. Patient sends family invitation
2. Family member accepts invitation
3. Family member profile includes patientId
4. Family member can access patient data
5. Family member cannot send invitations
6. Family member cannot record visits
7. Patient can record visits

Setup required:
1. Replace PATIENT_TOKEN and FAMILY_MEMBER_TOKEN with real Firebase ID tokens
2. Ensure test users exist in Firebase Auth
3. Run the backfill script first: node scripts/backfill-family-links.cjs

Note: This test requires a working Firebase setup and real authentication tokens.
  `);
  process.exit(0);
}

runTests().catch(console.error);
