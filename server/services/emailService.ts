import sgMail from '@sendgrid/mail';
import type { MedicalEvent, FamilyCalendarAccess } from '@shared/types';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@kinconnect.app';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'KinConnect Medical Calendar';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized successfully');
} else {
  console.warn('⚠️ SendGrid API key not found. Email notifications will be disabled.');
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!SENDGRID_API_KEY;
  }

  // Send a single email
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled) {
      console.log('📧 Email service disabled - would have sent:', { to, subject });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const msg = {
        to,
        from: {
          email: SENDGRID_FROM_EMAIL,
          name: SENDGRID_FROM_NAME
        },
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${to}: ${subject}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error' 
      };
    }
  }

  // Send family calendar invitation
  async sendFamilyInvitation(
    invitation: {
      patientName: string;
      patientEmail: string;
      familyMemberName: string;
      familyMemberEmail: string;
      invitationToken: string;
      permissions: string[];
    }
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.getFamilyInvitationTemplate(invitation);
    
    return await this.sendEmail(
      invitation.familyMemberEmail,
      template.subject,
      template.html,
      template.text
    );
  }

  // Send appointment notification to family members
  async sendAppointmentNotification(
    event: MedicalEvent,
    recipients: Array<{
      name: string;
      email: string;
    }>,
    notificationType: 'created' | 'updated' | 'cancelled' | 'reminder' | 'responsibility_needed'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled) {
      console.log('📧 Email service disabled - would have sent appointment notification');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getAppointmentNotificationTemplate(event, notificationType);
      
      const messages = recipients.map(recipient => ({
        to: recipient.email,
        from: {
          email: SENDGRID_FROM_EMAIL,
          name: SENDGRID_FROM_NAME
        },
        subject: template.subject,
        html: template.html.replace('{{recipientName}}', recipient.name),
        text: template.text.replace('{{recipientName}}', recipient.name)
      }));

      await sgMail.send(messages);
      console.log(`✅ Appointment notifications sent to ${recipients.length} recipients`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send appointment notifications:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error' 
      };
    }
  }

  // Send responsibility claim notification
  async sendResponsibilityNotification(
    event: MedicalEvent,
    patientEmail: string,
    patientName: string,
    responsiblePersonName: string,
    notificationType: 'claimed' | 'confirmed' | 'declined'
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.getResponsibilityNotificationTemplate(
      event, 
      responsiblePersonName, 
      notificationType
    );
    
    return await this.sendEmail(
      patientEmail,
      template.subject,
      template.html.replace('{{patientName}}', patientName),
      template.text.replace('{{patientName}}', patientName)
    );
  }

  // Send test email
  async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
    const subject = 'KinConnect Email Service Test';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">KinConnect Email Service Test</h2>
        <p>This is a test email to verify that the SendGrid integration is working correctly.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, the email service is configured properly!</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated test email from KinConnect Medical Calendar.
        </p>
      </div>
    `;
    
    return await this.sendEmail(to, subject, html);
  }

  // ===== PRIVATE TEMPLATE METHODS =====

  private getFamilyInvitationTemplate(invitation: {
    patientName: string;
    patientEmail: string;
    familyMemberName: string;
    familyMemberEmail: string;
    invitationToken: string;
    permissions: string[];
  }): EmailTemplate {
    const acceptUrl = `${process.env.VITE_API_URL || 'https://claritystream-uldp9.web.app'}/invitation/${invitation.invitationToken}`;
    
    const subject = `${invitation.patientName} has invited you to access their medical calendar`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
          <p style="color: #666; margin: 5px 0;">Medical Calendar Invitation</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin-top: 0;">You're Invited!</h2>
          <p>Hi ${invitation.familyMemberName},</p>
          <p><strong>${invitation.patientName}</strong> has invited you to access their medical calendar on KinConnect.</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #1e293b;">What you can do:</h3>
          <ul style="color: #475569;">
            ${invitation.permissions.map(permission => `<li>${this.formatPermission(permission)}</li>`).join('')}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptUrl}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Accept Invitation
          </a>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
          <p>This invitation was sent to ${invitation.familyMemberEmail}. If you didn't expect this invitation, you can safely ignore this email.</p>
          <p>The invitation link will expire in 7 days.</p>
        </div>
      </div>
    `;
    
    const text = `
KinConnect Medical Calendar Invitation

Hi ${invitation.familyMemberName},

${invitation.patientName} has invited you to access their medical calendar on KinConnect.

What you can do:
${invitation.permissions.map(permission => `- ${this.formatPermission(permission)}`).join('\n')}

To accept this invitation, visit: ${acceptUrl}

This invitation was sent to ${invitation.familyMemberEmail}. If you didn't expect this invitation, you can safely ignore this email.

The invitation link will expire in 7 days.
    `;
    
    return { subject, html, text };
  }

  private getAppointmentNotificationTemplate(
    event: MedicalEvent,
    notificationType: 'created' | 'updated' | 'cancelled' | 'reminder' | 'responsibility_needed'
  ): EmailTemplate {
    const eventDate = new Date(event.startDateTime).toLocaleDateString();
    const eventTime = new Date(event.startDateTime).toLocaleTimeString();
    
    let subject: string;
    let title: string;
    let message: string;
    let actionRequired = false;
    
    switch (notificationType) {
      case 'created':
        subject = `New appointment scheduled: ${event.title}`;
        title = 'New Appointment Scheduled';
        message = `A new appointment has been scheduled for ${eventDate} at ${eventTime}.`;
        break;
      case 'updated':
        subject = `Appointment updated: ${event.title}`;
        title = 'Appointment Updated';
        message = `The appointment details have been updated. Please review the changes.`;
        break;
      case 'cancelled':
        subject = `Appointment cancelled: ${event.title}`;
        title = 'Appointment Cancelled';
        message = `The appointment scheduled for ${eventDate} has been cancelled.`;
        break;
      case 'reminder':
        subject = `Reminder: ${event.title} tomorrow`;
        title = 'Appointment Reminder';
        message = `This is a reminder that you have an appointment tomorrow (${eventDate}) at ${eventTime}.`;
        break;
      case 'responsibility_needed':
        subject = `Transportation needed: ${event.title}`;
        title = 'Transportation Assistance Needed';
        message = `Transportation assistance is needed for the appointment on ${eventDate} at ${eventTime}.`;
        actionRequired = true;
        break;
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
          <p style="color: #666; margin: 5px 0;">Medical Calendar</p>
        </div>
        
        <div style="background: ${actionRequired ? '#fef3c7' : '#f0f9ff'}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>
          <p>Hi {{recipientName}},</p>
          <p>${message}</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1e293b; margin-top: 0;">Appointment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Title:</td>
              <td style="padding: 8px 0; color: #1e293b;">${event.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Date:</td>
              <td style="padding: 8px 0; color: #1e293b;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Time:</td>
              <td style="padding: 8px 0; color: #1e293b;">${eventTime}</td>
            </tr>
            ${event.location ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Location:</td>
              <td style="padding: 8px 0; color: #1e293b;">${event.location}</td>
            </tr>
            ` : ''}
            ${event.providerName ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Provider:</td>
              <td style="padding: 8px 0; color: #1e293b;">${event.providerName}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        ${actionRequired ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.VITE_API_URL || 'http://localhost:3000'}/calendar" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Calendar & Claim Responsibility
          </a>
        </div>
        ` : ''}
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
          <p>This notification was sent from KinConnect Medical Calendar.</p>
        </div>
      </div>
    `;
    
    const text = `
KinConnect Medical Calendar - ${title}

Hi {{recipientName}},

${message}

Appointment Details:
- Title: ${event.title}
- Date: ${eventDate}
- Time: ${eventTime}
${event.location ? `- Location: ${event.location}` : ''}
${event.providerName ? `- Provider: ${event.providerName}` : ''}

${actionRequired ? `To view the calendar and claim responsibility, visit: ${process.env.VITE_API_URL || 'http://localhost:3000'}/calendar` : ''}

This notification was sent from KinConnect Medical Calendar.
    `;
    
    return { subject, html, text };
  }

  private getResponsibilityNotificationTemplate(
    event: MedicalEvent,
    responsiblePersonName: string,
    notificationType: 'claimed' | 'confirmed' | 'declined'
  ): EmailTemplate {
    const eventDate = new Date(event.startDateTime).toLocaleDateString();
    const eventTime = new Date(event.startDateTime).toLocaleTimeString();
    
    let subject: string;
    let title: string;
    let message: string;
    
    switch (notificationType) {
      case 'claimed':
        subject = `${responsiblePersonName} will provide transportation for ${event.title}`;
        title = 'Transportation Arranged';
        message = `${responsiblePersonName} has volunteered to provide transportation for your appointment.`;
        break;
      case 'confirmed':
        subject = `Transportation confirmed for ${event.title}`;
        title = 'Transportation Confirmed';
        message = `Transportation arrangements have been confirmed for your appointment.`;
        break;
      case 'declined':
        subject = `Transportation assistance still needed for ${event.title}`;
        title = 'Transportation Still Needed';
        message = `Transportation arrangements are still needed for your appointment.`;
        break;
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
          <p style="color: #666; margin: 5px 0;">Medical Calendar</p>
        </div>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>
          <p>Hi {{patientName}},</p>
          <p>${message}</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1e293b; margin-top: 0;">Appointment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Title:</td>
              <td style="padding: 8px 0; color: #1e293b;">${event.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Date:</td>
              <td style="padding: 8px 0; color: #1e293b;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Time:</td>
              <td style="padding: 8px 0; color: #1e293b;">${eventTime}</td>
            </tr>
            ${event.location ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Location:</td>
              <td style="padding: 8px 0; color: #1e293b;">${event.location}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
          <p>This notification was sent from KinConnect Medical Calendar.</p>
        </div>
      </div>
    `;
    
    const text = `
KinConnect Medical Calendar - ${title}

Hi {{patientName}},

${message}

Appointment Details:
- Title: ${event.title}
- Date: ${eventDate}
- Time: ${eventTime}
${event.location ? `- Location: ${event.location}` : ''}

This notification was sent from KinConnect Medical Calendar.
    `;
    
    return { subject, html, text };
  }

  // Helper methods
  private formatPermission(permission: string): string {
    const permissionMap: Record<string, string> = {
      'canView': 'View medical appointments and events',
      'canCreate': 'Create new appointments',
      'canEdit': 'Edit existing appointments',
      'canDelete': 'Delete appointments',
      'canClaimResponsibility': 'Claim transportation responsibilities',
      'canManageFamily': 'Manage family member access',
      'canViewMedicalDetails': 'View detailed medical information',
      'canReceiveNotifications': 'Receive email notifications'
    };
    
    return permissionMap[permission] || permission;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();