import { Resend } from 'resend';
import { getInvitationEmailHtml } from './templates/invitation';
import { getWelcomeEmailHtml } from './templates/welcome';
import { getReminderEmailHtml } from './templates/reminder';

export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'onboarding@resend.dev';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('RESEND_API_KEY not found in environment variables');
    }
  }

  async sendInvitation({
    to,
    patientName,
    inviterName,
    invitationLink,
    message,
  }: {
    to: string;
    patientName: string;
    inviterName: string;
    invitationLink: string;
    message?: string;
  }) {
    if (!this.resend) {
      console.warn('Email service not initialized (missing API key)');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = getInvitationEmailHtml({
        patientName,
        inviterName,
        invitationLink,
        message,
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `${inviterName} invited you to join KinConnect`,
        html,
      });

      if (error) {
        console.error('Resend API Error:', error);
        throw new Error(error.message);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail({
    to,
    name,
  }: {
    to: string;
    name: string;
  }) {
    if (!this.resend) {
      console.warn('Email service not initialized (missing API key)');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = getWelcomeEmailHtml(name);

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Welcome to KinConnect!',
        html,
      });

      if (error) {
        console.error('Resend API Error:', error);
        throw new Error(error.message);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendReminderEmail({
    to,
    name,
    medicationName,
    dosage,
    time,
    instructions,
  }: {
    to: string;
    name: string;
    medicationName: string;
    dosage: string;
    time: string;
    instructions?: string;
  }) {
    if (!this.resend) {
      console.warn('Email service not initialized (missing API key)');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = getReminderEmailHtml({
        name,
        medicationName,
        dosage,
        time,
        instructions
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `Medication Reminder: ${medicationName}`,
        html,
      });

      if (error) {
        console.error('Resend API Error:', error);
        throw new Error(error.message);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
