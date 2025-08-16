// Direct SendGrid API test to verify email delivery
// Run with: node test-direct-sendgrid.js

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testDirectSendGrid() {
  console.log('🧪 Testing Direct SendGrid API Call...\n');
  
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'mike.nguyen@twfg.com';
  const testEmail = 'fookwin@gmail.com'; // The email that should receive the invitation
  
  console.log(`📧 Sending test email to: ${testEmail}`);
  console.log(`📤 From: ${fromEmail}`);
  console.log(`🔑 API Key: ${apiKey ? 'Configured' : 'Missing'}`);
  
  if (!apiKey) {
    console.log('❌ SendGrid API key not found in environment variables');
    return;
  }
  
  try {
    const emailData = {
      personalizations: [{
        to: [{ email: testEmail }],
        subject: 'KinConnect Family Invitation - Direct Test'
      }],
      from: { 
        email: fromEmail, 
        name: 'KinConnect Medical Calendar' 
      },
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
              <p style="color: #666; margin: 5px 0;">Medical Calendar Invitation - Direct Test</p>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e293b; margin-top: 0;">Direct SendGrid Test</h2>
              <p>This is a direct test of the SendGrid API to verify email delivery.</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              <p>If you received this email, SendGrid is working correctly!</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #1e293b;">Test Details:</h3>
              <ul style="color: #475569;">
                <li>Direct API call to SendGrid</li>
                <li>Same configuration as production</li>
                <li>Testing email delivery to ${testEmail}</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold;">
                ✅ SendGrid Working!
              </div>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
              <p>This is a test email from KinConnect Medical Calendar system.</p>
            </div>
          </div>
        `
      }]
    };
    
    console.log('\n📤 Sending email via SendGrid API...');
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    if (response.status === 202) {
      console.log('✅ Email sent successfully via direct SendGrid API!');
      console.log(`📧 Check ${testEmail} for the test email`);
      console.log('\n🎯 This confirms SendGrid is working correctly.');
      console.log('🔧 The issue is in the Firebase Functions configuration.');
    } else {
      const errorText = await response.text();
      console.log('❌ SendGrid API error:');
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ Direct SendGrid test failed:', error.message);
  }
}

// Run the test
testDirectSendGrid()
  .then(() => {
    console.log('\n✅ Direct SendGrid test completed!');
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
  });