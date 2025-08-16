import { adminDb, adminAuth } from '../firebase-admin';
import { emailService } from './emailService';

const db = adminDb;
import type { 
  MedicalEvent, 
  FamilyMember, 
  MedicalEventStatus,
  FamilyPermission 
} from '../../shared/types';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app';
  subject?: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  patientId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  reminderTiming: number[]; // minutes before appointment
  emergencyNotifications: boolean;
  familyNotifications: boolean;
  transportationNotifications: boolean;
  medicationReminders: boolean;
  appointmentConfirmations: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLog {
  id: string;
  userId: string;
  patientId: string;
  eventId?: string;
  type: 'appointment_reminder' | 'transportation_needed' | 'family_responsibility' | 'emergency' | 'medication' | 'confirmation' | 'status_change';
  channel: 'email' | 'sms' | 'push' | 'in_app';
  recipient: string; // email, phone, or user ID
  subject?: string;
  message: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  scheduledFor?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledNotification {
  id: string;
  userId: string;
  patientId: string;
  eventId: string;
  type: 'appointment_reminder' | 'transportation_reminder' | 'preparation_reminder' | 'insurance_reminder';
  scheduledFor: Date;
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  templateId: string;
  templateVariables: Record<string, any>;
  isActive: boolean;
  isSent: boolean;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class NotificationService {
  private templates: Map<string, NotificationTemplate> = new Map();
  private scheduledNotifications: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.startNotificationScheduler();
  }

  // Initialize default notification templates
  private initializeDefaultTemplates() {
    const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Appointment Reminder 24h',
        type: 'email',
        subject: 'Appointment Reminder: {{appointmentTitle}} Tomorrow',
        htmlTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Appointment Reminder</h2>
            <p>Hello {{patientName}},</p>
            <p>This is a reminder that you have an appointment scheduled for tomorrow:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937;">{{appointmentTitle}}</h3>
              <p style="margin: 5px 0;"><strong>Date:</strong> {{appointmentDate}}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> {{appointmentTime}}</p>
              <p style="margin: 5px 0;"><strong>Provider:</strong> {{providerName}}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> {{location}}</p>
            </div>
            {{#if preparationInstructions}}
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #92400e;">Preparation Instructions:</h4>
              <p style="margin: 0;">{{preparationInstructions}}</p>
            </div>
            {{/if}}
            {{#if requiresTransportation}}
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">Transportation Needed</h4>
              <p style="margin: 0;">This appointment requires transportation assistance. Please coordinate with your family members.</p>
            </div>
            {{/if}}
            <p>If you need to reschedule or have any questions, please contact your healthcare provider.</p>
            <p>Best regards,<br>KinConnect Team</p>
          </div>
        `,
        textTemplate: `
          Appointment Reminder
          
          Hello {{patientName}},
          
          This is a reminder that you have an appointment scheduled for tomorrow:
          
          {{appointmentTitle}}
          Date: {{appointmentDate}}
          Time: {{appointmentTime}}
          Provider: {{providerName}}
          Location: {{location}}
          
          {{#if preparationInstructions}}
          Preparation Instructions:
          {{preparationInstructions}}
          {{/if}}
          
          {{#if requiresTransportation}}
          Transportation Needed: This appointment requires transportation assistance. Please coordinate with your family members.
          {{/if}}
          
          If you need to reschedule or have any questions, please contact your healthcare provider.
          
          Best regards,
          KinConnect Team
        `,
        variables: ['patientName', 'appointmentTitle', 'appointmentDate', 'appointmentTime', 'providerName', 'location', 'preparationInstructions', 'requiresTransportation'],
        isActive: true
      },
      {
        name: 'Transportation Responsibility Needed',
        type: 'email',
        subject: 'Transportation Help Needed: {{appointmentTitle}}',
        htmlTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Transportation Help Needed</h2>
            <p>Hello {{familyMemberName}},</p>
            <p>{{patientName}} has an upcoming appointment that requires transportation assistance:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937;">{{appointmentTitle}}</h3>
              <p style="margin: 5px 0;"><strong>Date:</strong> {{appointmentDate}}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> {{appointmentTime}}</p>
              <p style="margin: 5px 0;"><strong>Provider:</strong> {{providerName}}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> {{location}}</p>
            </div>
            {{#if transportationNotes}}
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #92400e;">Transportation Notes:</h4>
              <p style="margin: 0;">{{transportationNotes}}</p>
            </div>
            {{/if}}
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{claimResponsibilityUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Claim Responsibility</a>
            </div>
            <p>If you can help with transportation, please click the button above to claim responsibility.</p>
            <p>Thank you for helping coordinate {{patientName}}'s care!</p>
            <p>Best regards,<br>KinConnect Team</p>
          </div>
        `,
        textTemplate: `
          Transportation Help Needed
          
          Hello {{familyMemberName}},
          
          {{patientName}} has an upcoming appointment that requires transportation assistance:
          
          {{appointmentTitle}}
          Date: {{appointmentDate}}
          Time: {{appointmentTime}}
          Provider: {{providerName}}
          Location: {{location}}
          
          {{#if transportationNotes}}
          Transportation Notes: {{transportationNotes}}
          {{/if}}
          
          If you can help with transportation, please visit: {{claimResponsibilityUrl}}
          
          Thank you for helping coordinate {{patientName}}'s care!
          
          Best regards,
          KinConnect Team
        `,
        variables: ['familyMemberName', 'patientName', 'appointmentTitle', 'appointmentDate', 'appointmentTime', 'providerName', 'location', 'transportationNotes', 'claimResponsibilityUrl'],
        isActive: true
      },
      {
        name: 'Emergency Notification',
        type: 'email',
        subject: 'URGENT: Emergency Medical Situation - {{patientName}}',
        htmlTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: white;">🚨 EMERGENCY NOTIFICATION</h2>
            </div>
            <div style="background: #fef2f2; padding: 20px; border-radius: 0 0 8px 8px;">
              <p><strong>Emergency Contact:</strong> {{emergencyContactName}},</p>
              <p>This is an urgent notification regarding {{patientName}}:</p>
              <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #dc2626;">
                <p style="margin: 0; font-weight: bold;">{{emergencyMessage}}</p>
              </div>
              {{#if location}}
              <p><strong>Location:</strong> {{location}}</p>
              {{/if}}
              {{#if contactNumber}}
              <p><strong>Contact Number:</strong> {{contactNumber}}</p>
              {{/if}}
              <p style="color: #dc2626; font-weight: bold;">Please respond immediately or contact emergency services if needed.</p>
            </div>
          </div>
        `,
        textTemplate: `
          🚨 EMERGENCY NOTIFICATION
          
          Emergency Contact: {{emergencyContactName}},
          
          This is an urgent notification regarding {{patientName}}:
          
          {{emergencyMessage}}
          
          {{#if location}}
          Location: {{location}}
          {{/if}}
          
          {{#if contactNumber}}
          Contact Number: {{contactNumber}}
          {{/if}}
          
          Please respond immediately or contact emergency services if needed.
        `,
        variables: ['emergencyContactName', 'patientName', 'emergencyMessage', 'location', 'contactNumber'],
        isActive: true
      }
    ];

    defaultTemplates.forEach(template => {
      const id = template.name.toLowerCase().replace(/\s+/g, '_');
      this.templates.set(id, {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
  }

  // Start the notification scheduler
  private startNotificationScheduler() {
    // Check for scheduled notifications every minute
    setInterval(async () => {
      await this.processScheduledNotifications();
    }, 60000);
  }

  // Get user notification preferences
  async getUserPreferences(userId: string, patientId: string): Promise<NotificationPreferences | null> {
    try {
      const doc = await db.collection('notificationPreferences')
        .where('userId', '==', userId)
        .where('patientId', '==', patientId)
        .limit(1)
        .get();

      if (doc.empty) {
        return null;
      }

      return doc.docs[0].data() as NotificationPreferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  // Update user notification preferences
  async updateUserPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const docRef = db.collection('notificationPreferences').doc(`${preferences.userId}_${preferences.patientId}`);
      await docRef.set({
        ...preferences,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // Schedule appointment reminders
  async scheduleAppointmentReminders(event: MedicalEvent): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(event.createdBy, event.patientId);
      const reminderTimes = preferences?.reminderTiming || [1440, 120]; // 24 hours and 2 hours by default

      for (const minutesBefore of reminderTimes) {
        const scheduledFor = new Date(event.startDateTime.getTime() - minutesBefore * 60 * 1000);
        
        // Don't schedule reminders in the past
        if (scheduledFor <= new Date()) continue;

        const scheduledNotification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: event.createdBy,
          patientId: event.patientId,
          eventId: event.id,
          type: 'appointment_reminder',
          scheduledFor,
          channels: this.getActiveChannels(preferences),
          templateId: 'appointment_reminder_24h',
          templateVariables: {
            patientName: 'Patient', // Would be fetched from patient data
            appointmentTitle: event.title,
            appointmentDate: event.startDateTime.toLocaleDateString(),
            appointmentTime: event.startDateTime.toLocaleTimeString(),
            providerName: event.providerName || 'Healthcare Provider',
            location: event.location || 'Medical Facility',
            preparationInstructions: event.preparationInstructions,
            requiresTransportation: event.requiresTransportation
          },
          isActive: true,
          isSent: false
        };

        await this.createScheduledNotification(scheduledNotification);
      }

      // Schedule transportation reminders if needed
      if (event.requiresTransportation && !event.responsiblePersonId) {
        await this.scheduleTransportationReminders(event);
      }
    } catch (error) {
      console.error('Error scheduling appointment reminders:', error);
      throw error;
    }
  }

  // Schedule transportation responsibility reminders
  async scheduleTransportationReminders(event: MedicalEvent): Promise<void> {
    try {
      // Get family members who can receive transportation notifications
      const familyMembers = await this.getFamilyMembersWithPermission(event.patientId, 'receive_notifications');

      for (const familyMember of familyMembers) {
        const scheduledFor = new Date(event.startDateTime.getTime() - 72 * 60 * 60 * 1000); // 3 days before
        
        if (scheduledFor <= new Date()) continue;

        const scheduledNotification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: familyMember.userId || familyMember.id,
          patientId: event.patientId,
          eventId: event.id,
          type: 'transportation_reminder',
          scheduledFor,
          channels: ['email'], // Transportation reminders primarily via email
          templateId: 'transportation_responsibility_needed',
          templateVariables: {
            familyMemberName: familyMember.name,
            patientName: 'Patient', // Would be fetched from patient data
            appointmentTitle: event.title,
            appointmentDate: event.startDateTime.toLocaleDateString(),
            appointmentTime: event.startDateTime.toLocaleTimeString(),
            providerName: event.providerName || 'Healthcare Provider',
            location: event.location || 'Medical Facility',
            transportationNotes: event.transportationNotes,
            claimResponsibilityUrl: `${process.env.CLIENT_URL}/dashboard/family/claim-responsibility/${event.id}`
          },
          isActive: true,
          isSent: false
        };

        await this.createScheduledNotification(scheduledNotification);
      }
    } catch (error) {
      console.error('Error scheduling transportation reminders:', error);
      throw error;
    }
  }

  // Send emergency notification
  async sendEmergencyNotification(
    patientId: string,
    message: string,
    location?: string,
    contactNumber?: string
  ): Promise<void> {
    try {
      // Get emergency contacts
      const emergencyContacts = await this.getEmergencyContacts(patientId);

      for (const contact of emergencyContacts) {
        const notificationLog: Omit<NotificationLog, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: contact.userId || contact.id,
          patientId,
          type: 'emergency',
          channel: 'email',
          recipient: contact.email,
          subject: `URGENT: Emergency Medical Situation - Patient`,
          message,
          templateId: 'emergency_notification',
          templateVariables: {
            emergencyContactName: contact.name,
            patientName: 'Patient', // Would be fetched from patient data
            emergencyMessage: message,
            location,
            contactNumber
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          priority: 'emergency'
        };

        await this.sendNotification(notificationLog);
      }
    } catch (error) {
      console.error('Error sending emergency notification:', error);
      throw error;
    }
  }

  // Send immediate notification
  async sendNotification(notification: Omit<NotificationLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = db.collection('notificationLogs').doc().id;
      const notificationWithId: NotificationLog = {
        ...notification,
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await db.collection('notificationLogs').doc(id).set(notificationWithId);

      // Send based on channel
      switch (notification.channel) {
        case 'email':
          await this.sendEmailNotification(notificationWithId);
          break;
        case 'sms':
          await this.sendSMSNotification(notificationWithId);
          break;
        case 'push':
          await this.sendPushNotification(notificationWithId);
          break;
        case 'in_app':
          await this.sendInAppNotification(notificationWithId);
          break;
      }

      return id;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Process scheduled notifications
  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const scheduledNotifications = await db.collection('scheduledNotifications')
        .where('scheduledFor', '<=', now)
        .where('isActive', '==', true)
        .where('isSent', '==', false)
        .get();

      for (const doc of scheduledNotifications.docs) {
        const notification = doc.data() as ScheduledNotification;
        
        for (const channel of notification.channels) {
          const notificationLog: Omit<NotificationLog, 'id' | 'createdAt' | 'updatedAt'> = {
            userId: notification.userId,
            patientId: notification.patientId,
            eventId: notification.eventId,
            type: notification.type === 'transportation_reminder' ? 'transportation_needed' :
                  notification.type === 'preparation_reminder' ? 'appointment_reminder' :
                  notification.type === 'insurance_reminder' ? 'appointment_reminder' :
                  notification.type as any,
            channel,
            recipient: await this.getRecipientForChannel(notification.userId, channel),
            subject: this.generateSubject(notification.templateId, notification.templateVariables),
            message: this.generateMessage(notification.templateId, notification.templateVariables, channel),
            templateId: notification.templateId,
            templateVariables: notification.templateVariables,
            status: 'pending',
            retryCount: 0,
            maxRetries: 3,
            priority: this.getPriorityForType(notification.type)
          };

          await this.sendNotification(notificationLog);
        }

        // Mark as sent
        await doc.ref.update({
          isSent: true,
          sentAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    }
  }

  // Helper methods
  private async createScheduledNotification(notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = db.collection('scheduledNotifications').doc().id;
    const notificationWithId: ScheduledNotification = {
      ...notification,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('scheduledNotifications').doc(id).set(notificationWithId);
    return id;
  }

  private getActiveChannels(preferences: NotificationPreferences | null): ('email' | 'sms' | 'push' | 'in_app')[] {
    if (!preferences) return ['email']; // Default to email

    const channels: ('email' | 'sms' | 'push' | 'in_app')[] = [];
    if (preferences.emailNotifications) channels.push('email');
    if (preferences.smsNotifications) channels.push('sms');
    if (preferences.pushNotifications) channels.push('push');
    if (preferences.inAppNotifications) channels.push('in_app');

    return channels.length > 0 ? channels : ['email'];
  }

  private async getFamilyMembersWithPermission(patientId: string, permission: FamilyPermission): Promise<FamilyMember[]> {
    try {
      const snapshot = await db.collection('familyMembers')
        .where('patientId', '==', patientId)
        .where('permissions', 'array-contains', permission)
        .where('invitationStatus', '==', 'accepted')
        .get();

      return snapshot.docs.map((doc: any) => doc.data() as FamilyMember);
    } catch (error) {
      console.error('Error getting family members:', error);
      return [];
    }
  }

  private async getEmergencyContacts(patientId: string): Promise<FamilyMember[]> {
    try {
      const snapshot = await db.collection('familyMembers')
        .where('patientId', '==', patientId)
        .where('isEmergencyContact', '==', true)
        .where('invitationStatus', '==', 'accepted')
        .get();

      return snapshot.docs.map((doc: any) => doc.data() as FamilyMember);
    } catch (error) {
      console.error('Error getting emergency contacts:', error);
      return [];
    }
  }

  private async getRecipientForChannel(userId: string, channel: 'email' | 'sms' | 'push' | 'in_app'): Promise<string> {
    // This would fetch user contact info from the database
    // For now, return placeholder
    switch (channel) {
      case 'email':
        return 'user@example.com';
      case 'sms':
        return '+1234567890';
      case 'push':
      case 'in_app':
        return userId;
      default:
        return userId;
    }
  }

  private generateSubject(templateId: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template || !template.subject) return 'Notification';

    return this.replaceVariables(template.subject, variables);
  }

  private generateMessage(templateId: string, variables: Record<string, any>, channel: 'email' | 'sms' | 'push' | 'in_app'): string {
    const template = this.templates.get(templateId);
    if (!template) return 'Notification message';

    const messageTemplate = channel === 'email' ? template.htmlTemplate : template.textTemplate;
    return this.replaceVariables(messageTemplate, variables);
  }

  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // Simple variable replacement (in production, use a proper template engine like Handlebars)
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    });

    // Handle conditional blocks (simplified)
    result = result.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (match, condition, content) => {
      return variables[condition] ? content : '';
    });

    return result;
  }

  private getPriorityForType(type: ScheduledNotification['type']): NotificationLog['priority'] {
    switch (type) {
      case 'appointment_reminder':
        return 'medium';
      case 'transportation_reminder':
        return 'high';
      case 'preparation_reminder':
        return 'medium';
      case 'insurance_reminder':
        return 'medium';
      default:
        return 'medium';
    }
  }

  // Channel-specific sending methods
  private async sendEmailNotification(notification: NotificationLog): Promise<void> {
    try {
      await emailService.sendEmail(
        notification.recipient,
        notification.subject || 'Notification',
        notification.message,
        notification.message.replace(/<[^>]*>/g, '') // Strip HTML for text version
      );

      await this.updateNotificationStatus(notification.id, 'sent');
    } catch (error) {
      console.error('Error sending email notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', (error as Error).message);
    }
  }

  private async sendSMSNotification(notification: NotificationLog): Promise<void> {
    try {
      // SMS implementation would go here (Twilio, AWS SNS, etc.)
      console.log('SMS notification would be sent:', notification);
      await this.updateNotificationStatus(notification.id, 'sent');
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', (error as Error).message);
    }
  }

  private async sendPushNotification(notification: NotificationLog): Promise<void> {
    try {
      // Push notification implementation would go here (Firebase Cloud Messaging, etc.)
      console.log('Push notification would be sent:', notification);
      await this.updateNotificationStatus(notification.id, 'sent');
    } catch (error) {
      console.error('Error sending push notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', (error as Error).message);
    }
  }

  private async sendInAppNotification(notification: NotificationLog): Promise<void> {
    try {
      // Store in-app notification in database for real-time display
      await db.collection('inAppNotifications').add({
        userId: notification.userId,
        patientId: notification.patientId,
        type: notification.type,
        title: notification.subject,
        message: notification.message,
        isRead: false,
        createdAt: new Date()
      });

      await this.updateNotificationStatus(notification.id, 'sent');
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      await this.updateNotificationStatus(notification.id, 'failed', (error as Error).message);
    }
  }

  private async updateNotificationStatus(
    notificationId: string, 
    status: NotificationLog['status'], 
    failureReason?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'sent') {
        updateData.sentAt = new Date();
      } else if (status === 'failed' && failureReason) {
        updateData.failureReason = failureReason;
      }

      await db.collection('notificationLogs').doc(notificationId).update(updateData);
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }

  // Public API methods
  async getNotificationHistory(userId: string, patientId: string, limit = 50): Promise<NotificationLog[]> {
    try {
      const snapshot = await db.collection('notificationLogs')
        .where('userId', '==', userId)
        .where('patientId', '==', patientId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => doc.data() as NotificationLog);
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  async getNotificationAnalytics(patientId: string, days = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await db.collection('notificationLogs')
        .where('patientId', '==', patientId)
        .where('createdAt', '>=', startDate)
        .get();

      const notifications = snapshot.docs.map((doc: any) => doc.data() as NotificationLog);

      return {
        total: notifications.length,
        sent: notifications.filter((n: any) => n.status === 'sent').length,
        failed: notifications.filter((n: any) => n.status === 'failed').length,
        byType: this.groupBy(notifications, 'type'),
        byChannel: this.groupBy(notifications, 'channel'),
        byPriority: this.groupBy(notifications, 'priority')
      };
    } catch (error) {
      console.error('Error getting notification analytics:', error);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        byType: {},
        byChannel: {},
        byPriority: {}
      };
    }
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((result, item) => {
      const group = item[key];
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }

  // Cancel scheduled notifications for an event
  async cancelScheduledNotifications(eventId: string): Promise<void> {
    try {
      const snapshot = await db.collection('scheduledNotifications')
        .where('eventId', '==', eventId)
        .where('isSent', '==', false)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.update(doc.ref, { isActive: false, updatedAt: new Date() });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error canceling scheduled notifications:', error);
      throw error;
    }
  }

  // Update event and reschedule notifications
  async updateEventNotifications(event: MedicalEvent): Promise<void> {
    try {
      // Cancel existing notifications
      await this.cancelScheduledNotifications(event.id);
      
      // Schedule new notifications
      await this.scheduleAppointmentReminders(event);
    } catch (error) {
      console.error('Error updating event notifications:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
        