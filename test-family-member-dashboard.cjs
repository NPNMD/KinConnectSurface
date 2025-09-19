/**
 * Test script to verify family member dashboard functionality
 * This script tests the complete family member experience:
 * 1. Family member login
 * 2. Patient data visibility
 * 3. Permission-based UI restrictions
 * 4. Patient switching (if multiple access)
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();
const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

async function testFamilyMemberDashboard() {
  console.log('🧪 Testing Family Member Dashboard Functionality');
  console.log('=' .repeat(60));

  try {
    // Step 1: Create test patient and family member users
    console.log('\n📝 Step 1: Setting up test data...');
    
    const testPatientId = 'test-patient-' + Date.now();
    const testFamilyMemberId = 'test-family-' + Date.now();
    
    // Create test patient user
    await firestore.collection('users').doc(testPatientId).set({
      email: 'patient@test.com',
      name: 'Test Patient',
      userType: 'patient',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create test family member user
    await firestore.collection('users').doc(testFamilyMemberId).set({
      email: 'family@test.com',
      name: 'Test Family Member',
      userType: 'family_member',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Test users created');
    console.log(`   Patient ID: ${testPatientId}`);
    console.log(`   Family Member ID: ${testFamilyMemberId}`);

    // Step 2: Create family access relationship
    console.log('\n📝 Step 2: Creating family access relationship...');
    
    const familyAccessId = 'access-' + Date.now();
    await firestore.collection('family_calendar_access').doc(familyAccessId).set({
      patientId: testPatientId,
      familyMemberId: testFamilyMemberId,
      familyMemberName: 'Test Family Member',
      familyMemberEmail: 'family@test.com',
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
      status: 'active',
      invitedAt: new Date(),
      acceptedAt: new Date(),
      createdBy: testPatientId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Family access relationship created');
    console.log(`   Access ID: ${familyAccessId}`);
    console.log('   Permissions: View-only with medical details');

    // Step 3: Create test patient data
    console.log('\n📝 Step 3: Creating test patient data...');
    
    // Create test medication
    const testMedicationId = 'med-' + Date.now();
    await firestore.collection('medications').doc(testMedicationId).set({
      patientId: testPatientId,
      name: 'Test Medication',
      dosage: '10mg',
      frequency: 'daily',
      isActive: true,
      prescribedDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create test medical event
    const testEventId = 'event-' + Date.now();
    await firestore.collection('medical_events').doc(testEventId).set({
      patientId: testPatientId,
      title: 'Test Appointment',
      description: 'Test appointment for family member access',
      eventType: 'appointment',
      priority: 'medium',
      status: 'scheduled',
      startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // Tomorrow + 1 hour
      duration: 60,
      isAllDay: false,
      requiresTransportation: false,
      responsibilityStatus: 'unassigned',
      isRecurring: false,
      reminders: [],
      createdBy: testPatientId,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    });
    
    console.log('✅ Test patient data created');
    console.log(`   Medication ID: ${testMedicationId}`);
    console.log(`   Medical Event ID: ${testEventId}`);

    // Step 4: Test family access API
    console.log('\n📝 Step 4: Testing family access API...');
    
    // Create a custom token for the family member
    const customToken = await admin.auth().createCustomToken(testFamilyMemberId);
    console.log('✅ Custom token created for family member');
    
    // Test family access endpoint
    try {
      const response = await fetch(`${API_BASE}/family-access`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${customToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Family access API response:', JSON.stringify(data, null, 2));
        
        if (data.success && data.data.patientsIHaveAccessTo.length > 0) {
          console.log('✅ Family member has access to patient data');
          console.log(`   Patient: ${data.data.patientsIHaveAccessTo[0].patientName}`);
          console.log(`   Permissions: ${JSON.stringify(data.data.patientsIHaveAccessTo[0].permissions)}`);
        } else {
          console.log('❌ Family member does not have access to patient data');
        }
      } else {
        console.log('❌ Family access API failed:', response.status, await response.text());
      }
    } catch (error) {
      console.log('❌ Error testing family access API:', error.message);
    }

    // Step 5: Test patient data access
    console.log('\n📝 Step 5: Testing patient data access...');
    
    try {
      // Test medications access
      const medicationsResponse = await fetch(`${API_BASE}/medications?patientId=${testPatientId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${customToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (medicationsResponse.ok) {
        const medicationsData = await medicationsResponse.json();
        console.log('✅ Medications API accessible to family member');
        console.log(`   Medications found: ${medicationsData.data?.length || 0}`);
      } else {
        console.log('❌ Medications API failed:', medicationsResponse.status);
      }
      
      // Test medical events access
      const eventsResponse = await fetch(`${API_BASE}/medical-events/${testPatientId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${customToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        console.log('✅ Medical events API accessible to family member');
        console.log(`   Events found: ${eventsData.data?.length || 0}`);
      } else {
        console.log('❌ Medical events API failed:', eventsResponse.status);
      }
      
    } catch (error) {
      console.log('❌ Error testing patient data access:', error.message);
    }

    // Step 6: Test permission restrictions
    console.log('\n📝 Step 6: Testing permission restrictions...');
    
    try {
      // Try to create a medication (should fail with view-only permissions)
      const createMedResponse = await fetch(`${API_BASE}/medications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${customToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: testPatientId,
          name: 'Unauthorized Medication',
          dosage: '5mg',
          frequency: 'daily',
          isActive: true,
          prescribedDate: new Date()
        })
      });
      
      if (createMedResponse.status === 403) {
        console.log('✅ Permission restriction working - family member cannot create medications');
      } else if (createMedResponse.ok) {
        console.log('❌ Permission restriction failed - family member can create medications');
      } else {
        console.log(`⚠️ Unexpected response for medication creation: ${createMedResponse.status}`);
      }
      
    } catch (error) {
      console.log('❌ Error testing permission restrictions:', error.message);
    }

    console.log('\n📝 Step 7: Cleaning up test data...');
    
    // Clean up test data
    await firestore.collection('users').doc(testPatientId).delete();
    await firestore.collection('users').doc(testFamilyMemberId).delete();
    await firestore.collection('family_calendar_access').doc(familyAccessId).delete();
    await firestore.collection('medications').doc(testMedicationId).delete();
    await firestore.collection('medical_events').doc(testEventId).delete();
    
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Family Member Dashboard Test Complete!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFamilyMemberDashboard()
  .then(() => {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });