// Production test script for family invitation emails
// Run with: node test-production-invitations.js

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const TEST_EMAIL = 'mike.nguyen@twfg.com'; // Replace with your test email

async function testProductionInvitations() {
  console.log('🧪 Testing Production Family Invitation System...\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  
  try {
    // First, we need to authenticate to get a valid token
    console.log('1. Testing invitation endpoint availability...');
    
    // Test the endpoint without auth first to see if it's accessible
    const healthCheck = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
    if (!healthCheck) {
      console.log('❌ API server not accessible. Make sure the server is running.');
      return;
    }
    
    console.log('✅ API server is accessible');
    
    // Test direct email service functionality
    console.log('\n2. Testing direct email service...');
    
    // Import the email service directly for testing
    const { emailService } = await import('./server/services/emailService.js');
    
    // Test basic email functionality
    const testEmailResult = await emailService.sendTestEmail(TEST_EMAIL);
    if (testEmailResult.success) {
      console.log('✅ Basic email service working');
    } else {
      console.log('❌ Basic email service failed:', testEmailResult.error);
      return;
    }
    
    // Test family invitation email directly
    console.log('\n3. Testing family invitation email template...');
    
    const mockInvitation = {
      patientName: 'John Doe (Test Patient)',
      patientEmail: 'patient@example.com',
      familyMemberName: 'Test Family Member',
      familyMemberEmail: TEST_EMAIL,
      invitationToken: `test-token-${Date.now()}`,
      permissions: ['canView', 'canClaimResponsibility', 'canReceiveNotifications']
    };
    
    const invitationResult = await emailService.sendFamilyInvitation(mockInvitation);
    if (invitationResult.success) {
      console.log('✅ Family invitation email sent successfully!');
      console.log(`📧 Invitation sent to: ${TEST_EMAIL}`);
      console.log(`🔗 Invitation token: ${mockInvitation.invitationToken}`);
    } else {
      console.log('❌ Family invitation email failed:', invitationResult.error);
      return;
    }
    
    // Test appointment notification
    console.log('\n4. Testing appointment notification email...');
    
    const mockEvent = {
      id: `test-event-${Date.now()}`,
      title: 'Cardiology Consultation (Test)',
      startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      location: '123 Medical Center Dr, Suite 200',
      providerName: 'Dr. Sarah Johnson',
      eventType: 'appointment',
      priority: 'high',
      status: 'scheduled',
      requiresTransportation: true
    };
    
    const notificationResult = await emailService.sendAppointmentNotification(
      mockEvent,
      [{ name: 'Test Family Member', email: TEST_EMAIL }],
      'responsibility_needed'
    );
    
    if (notificationResult.success) {
      console.log('✅ Appointment notification sent successfully!');
    } else {
      console.log('❌ Appointment notification failed:', notificationResult.error);
    }
    
    // Test responsibility notification
    console.log('\n5. Testing responsibility notification email...');
    
    const responsibilityResult = await emailService.sendResponsibilityNotification(
      mockEvent,
      TEST_EMAIL,
      'John Doe',
      'Test Family Member',
      'claimed'
    );
    
    if (responsibilityResult.success) {
      console.log('✅ Responsibility notification sent successfully!');
    } else {
      console.log('❌ Responsibility notification failed:', responsibilityResult.error);
    }
    
    console.log('\n🎉 Production email testing completed!');
    console.log('\n📧 Check your email inbox for the following test messages:');
    console.log('   1. Basic test email');
    console.log('   2. Family invitation email');
    console.log('   3. Appointment notification (transportation needed)');
    console.log('   4. Responsibility notification (claimed)');
    
    console.log('\n📋 Email Service Status:');
    console.log(`   - SendGrid API Key: ${process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   - From Email: ${process.env.SENDGRID_FROM_EMAIL || 'Not configured'}`);
    console.log(`   - From Name: ${process.env.SENDGRID_FROM_NAME || 'Not configured'}`);
    
  } catch (error) {
    console.error('❌ Production test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Additional function to test the API endpoint directly (requires authentication)
async function testAPIEndpoint() {
  console.log('\n🔐 Testing API Endpoint (requires authentication)...');
  
  // Note: This would require a valid Firebase auth token
  // For now, we'll just test the endpoint structure
  
  const testPayload = {
    email: TEST_EMAIL,
    patientName: 'Test Patient (API Test)'
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/invitations/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer <firebase-token>' // Would need real auth token
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`API Response Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('⚠️ Authentication required (expected for production)');
    } else {
      const result = await response.json();
      console.log('API Response:', result);
    }
    
  } catch (error) {
    console.log('❌ API endpoint test failed:', error.message);
  }
}

// Run the tests
console.log('Starting production email tests...\n');
testProductionInvitations().then(() => {
  return testAPIEndpoint();
}).then(() => {
  console.log('\n✅ All tests completed!');
}).catch(error => {
  console.error('❌ Test suite failed:', error);
});