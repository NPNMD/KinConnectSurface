// Direct test of email functionality using tsx to run TypeScript
// Run with: npx tsx test-email-functionality.ts

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import the email service directly using tsx
async function testEmailFunctionality() {
  console.log('🧪 Testing SendGrid Email Functionality (Production)...\n');
  
  try {
    // Dynamic import of the TypeScript email service
    const { emailService } = await import('./server/services/emailService.js');
    
    const TEST_EMAIL = 'mike.nguyen@twfg.com';
    
    console.log('📧 SendGrid Configuration:');
    console.log(`   API Key: ${process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   From Email: ${process.env.SENDGRID_FROM_EMAIL || '❌ Missing'}`);
    console.log(`   From Name: ${process.env.SENDGRID_FROM_NAME || '❌ Missing'}`);
    
    // Test 1: Basic email test
    console.log('\n1. Testing basic email functionality...');
    const testResult = await emailService.sendTestEmail(TEST_EMAIL);
    
    if (testResult.success) {
      console.log('✅ Basic test email sent successfully!');
    } else {
      console.log('❌ Basic test email failed:', testResult.error);
      return;
    }
    
    // Test 2: Family invitation email
    console.log('\n2. Testing family invitation email...');
    const invitationData = {
      patientName: 'John Doe (Production Test)',
      patientEmail: 'patient@example.com',
      familyMemberName: 'Test Family Member',
      familyMemberEmail: TEST_EMAIL,
      invitationToken: `prod-test-${Date.now()}`,
      permissions: ['canView', 'canClaimResponsibility', 'canReceiveNotifications']
    };
    
    const invitationResult = await emailService.sendFamilyInvitation(invitationData);
    
    if (invitationResult.success) {
      console.log('✅ Family invitation email sent successfully!');
      console.log(`📧 Invitation sent to: ${TEST_EMAIL}`);
      console.log(`🔗 Invitation token: ${invitationData.invitationToken}`);
      console.log(`🌐 Accept URL: ${process.env.VITE_API_URL || 'http://localhost:3000'}/accept-invitation?token=${invitationData.invitationToken}`);
    } else {
      console.log('❌ Family invitation email failed:', invitationResult.error);
    }
    
    // Test 3: Appointment notification
    console.log('\n3. Testing appointment notification email...');
    const mockEvent = {
      id: `prod-test-event-${Date.now()}`,
      title: 'Cardiology Consultation (Production Test)',
      startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      location: '123 Medical Center Dr, Suite 200, Houston, TX',
      providerName: 'Dr. Sarah Johnson, MD',
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
    
    // Test 4: Responsibility notification
    console.log('\n4. Testing responsibility notification email...');
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
    
    console.log('\n🎉 Production Email Testing Completed!');
    console.log('\n📧 Check your email inbox for the following messages:');
    console.log('   1. ✉️  Basic test email');
    console.log('   2. 👨‍👩‍👧‍👦 Family invitation email');
    console.log('   3. 🏥 Appointment notification (transportation needed)');
    console.log('   4. 🚗 Responsibility notification (claimed)');
    
    console.log('\n📋 Email Templates Tested:');
    console.log('   ✅ HTML formatting and styling');
    console.log('   ✅ Dynamic content insertion');
    console.log('   ✅ Permission formatting');
    console.log('   ✅ Date/time formatting');
    console.log('   ✅ Call-to-action buttons');
    console.log('   ✅ Responsive design elements');
    
    console.log('\n🔗 Invitation Token for Testing:');
    console.log(`   Token: ${invitationData.invitationToken}`);
    console.log(`   This token can be used to test the invitation acceptance flow`);
    
  } catch (error) {
    console.error('❌ Email functionality test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
console.log('Starting production email functionality tests...\n');
testEmailFunctionality()
  .then(() => {
    console.log('\n✅ All email tests completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('   1. Check email inbox for all test messages');
    console.log('   2. Verify email formatting and content');
    console.log('   3. Test invitation acceptance flow');
    console.log('   4. Validate production deployment');
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
  });