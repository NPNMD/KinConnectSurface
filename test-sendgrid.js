// Test script for SendGrid email service
// Run with: node test-sendgrid.js

import dotenv from 'dotenv';
import { emailService } from './server/services/emailService.js';

// Load environment variables
dotenv.config();

async function testSendGrid() {
  console.log('🧪 Testing SendGrid Email Service...\n');

  // Test email address (replace with your email for testing)
  const testEmail = 'mike.nguyen@twfg.com';

  try {
    console.log('1. Testing basic email sending...');
    const result = await emailService.sendTestEmail(testEmail);
    
    if (result.success) {
      console.log('✅ Test email sent successfully!');
    } else {
      console.log('❌ Test email failed:', result.error);
    }
    
    console.log('\n2. Testing family invitation email...');
    const invitationResult = await emailService.sendFamilyInvitation({
      patientName: 'John Doe',
      patientEmail: 'patient@example.com',
      familyMemberName: 'Jane Doe',
      familyMemberEmail: testEmail,
      invitationToken: 'test-token-123',
      permissions: ['canView', 'canClaimResponsibility', 'canReceiveNotifications']
    });
    
    if (invitationResult.success) {
      console.log('✅ Family invitation email sent successfully!');
    } else {
      console.log('❌ Family invitation email failed:', invitationResult.error);
    }
    
    console.log('\n3. Testing appointment notification...');
    const mockEvent = {
      id: 'test-event-123',
      title: 'Cardiology Appointment',
      startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      location: '123 Medical Center Dr',
      providerName: 'Dr. Smith',
      eventType: 'appointment',
      priority: 'medium',
      status: 'scheduled',
      requiresTransportation: true
    };
    
    const notificationResult = await emailService.sendAppointmentNotification(
      mockEvent,
      [{ name: 'Test User', email: testEmail }],
      'responsibility_needed'
    );
    
    if (notificationResult.success) {
      console.log('✅ Appointment notification sent successfully!');
    } else {
      console.log('❌ Appointment notification failed:', notificationResult.error);
    }
    
    console.log('\n🎉 SendGrid testing completed!');
    console.log('\n📧 Check your email inbox for the test messages.');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testSendGrid();