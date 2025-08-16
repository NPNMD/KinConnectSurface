import { adminDb } from '../firebase-admin';
import { notificationService } from './notificationService';
import { pushNotificationService } from './pushNotificationService';
import { smsNotificationService } from './smsNotificationService';

const db = adminDb;

export interface ScheduledNotification {
  id: string;
  userId: string;
  type: 'appointment_reminder' | 'transportation_request' | 'transportation_confirmation' | 
        'emergency_alert' | 'family_coordination' | 'medication_reminder' | 'custom';
  channels: ('email' | 'push' | 'sms' | 'in_app')[];
  scheduledTime: Date;
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  errorMessage?: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    dayOfMonth?: number;
    monthOfYear?: number;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: { [key: string]: any };
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  eventType: string;
  conditions: {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
    value: any;
  }[];
  actions: {
    type: 'send_notification';
    channels: ('email' | 'push' | 'sms' | 'in_app')[];
    template: string;
    delay?: number; // minutes
    recipients: 'patient' | 'family' | 'caregivers' | 'all' | string[];
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderSchedule {
  appointmentId: string;
  patientId: string;
  reminders: {
    timeBeforeAppointment: number; // minutes
    channels: ('email' | 'push' | 'sms' | 'in_app')[];
    template: string;
    sent: boolean;
    scheduledNotificationId?: string;
  }[];
}

export class NotificationScheduler {
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private checkIntervalMs: number = 60000; // Check every minute

  constructor() {
    this.startScheduler();
  }

  /**
   * Start the notification scheduler
   */
  startScheduler(): void {
    if (this.isRunning) {
      console.log('⚠️  Notification scheduler is already running');
      return;
    }

    console.log('🚀 Starting notification scheduler...');
    this.isRunning = true;
    
    this.schedulerInterval = setInterval(async () => {
      await this.processScheduledNotifications();
    }, this.checkIntervalMs);

    console.log('✅ Notification scheduler started');
  }

  /**
   * Stop the notification scheduler
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Notification scheduler stopped');
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const scheduledNotification: ScheduledNotification = {
        ...notification,
        id: notificationId,
        createdAt: now,
        updatedAt: now
      };

      await db.collection('scheduled_notifications').doc(notificationId).set(scheduledNotification);
      
      console.log(`📅 Notification scheduled: ${notificationId} for ${notification.scheduledTime}`);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await db.collection('scheduled_notifications').doc(notificationId).update({
        status: 'cancelled',
        updatedAt: new Date()
      });
      
      console.log(`❌ Notification cancelled: ${notificationId}`);
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
      throw error;
    }
  }

  /**
   * Schedule appointment reminders
   */
  async scheduleAppointmentReminders(
    appointmentId: string,
    appointmentData: {
      patientId: string;
      patientName: string;
      doctorName: string;
      appointmentTime: Date;
      location: string;
      appointmentType: string;
      familyMembers: Array<{
        userId: string;
        name: string;
        email?: string;
        phone?: string;
        pushTokens?: string[];
        notificationPreferences: {
          email: boolean;
          push: boolean;
          sms: boolean;
          reminderTimes: number[]; // minutes before appointment
        };
      }>;
    }
  ): Promise<string[]> {
    const scheduledNotificationIds: string[] = [];

    // Default reminder times if not specified
    const defaultReminderTimes = [1440, 60, 15]; // 24 hours, 1 hour, 15 minutes

    for (const familyMember of appointmentData.familyMembers) {
      const reminderTimes = familyMember.notificationPreferences.reminderTimes.length > 0 
        ? familyMember.notificationPreferences.reminderTimes 
        : defaultReminderTimes;

      for (const minutesBefore of reminderTimes) {
        const reminderTime = new Date(appointmentData.appointmentTime.getTime() - (minutesBefore * 60 * 1000));
        
        // Only schedule if reminder time is in the future
        if (reminderTime > new Date()) {
          const channels: ('email' | 'push' | 'sms' | 'in_app')[] = [];
          
          if (familyMember.notificationPreferences.email && familyMember.email) {
            channels.push('email');
          }
          if (familyMember.notificationPreferences.push && familyMember.pushTokens?.length) {
            channels.push('push');
          }
          if (familyMember.notificationPreferences.sms && familyMember.phone) {
            channels.push('sms');
          }
          channels.push('in_app'); // Always include in-app

          if (channels.length > 0) {
            const notificationId = await this.scheduleNotification({
              userId: familyMember.userId,
              type: 'appointment_reminder',
              channels,
              scheduledTime: reminderTime,
              payload: {
                appointmentId,
                patientName: appointmentData.patientName,
                doctorName: appointmentData.doctorName,
                appointmentTime: appointmentData.appointmentTime,
                location: appointmentData.location,
                appointmentType: appointmentData.appointmentType,
                familyMember,
                minutesBefore
              },
              status: 'pending',
              retryCount: 0,
              maxRetries: 3,
              priority: minutesBefore <= 60 ? 'high' : 'normal',
              metadata: {
                appointmentId,
                patientId: appointmentData.patientId,
                reminderType: 'appointment',
                minutesBefore
              }
            });

            scheduledNotificationIds.push(notificationId);
          }
        }
      }
    }

    console.log(`📅 Scheduled ${scheduledNotificationIds.length} appointment reminders for appointment ${appointmentId}`);
    return scheduledNotificationIds;
  }

  /**
   * Schedule transportation coordination notifications
   */
  async scheduleTransportationNotifications(
    appointmentId: string,
    transportationData: {
      patientId: string;
      patientName: string;
      appointmentTime: Date;
      pickupLocation: string;
      destination: string;
      familyMembers: Array<{
        userId: string;
        name: string;
        email?: string;
        phone?: string;
        pushTokens?: string[];
        canDrive: boolean;
      }>;
    }
  ): Promise<string[]> {
    const scheduledNotificationIds: string[] = [];

    // Schedule initial transportation request (24 hours before)
    const requestTime = new Date(transportationData.appointmentTime.getTime() - (24 * 60 * 60 * 1000));
    
    if (requestTime > new Date()) {
      const driverCandidates = transportationData.familyMembers.filter(member => member.canDrive);
      
      for (const candidate of driverCandidates) {
        const channels: ('email' | 'push' | 'sms' | 'in_app')[] = ['in_app'];
        
        if (candidate.email) channels.push('email');
        if (candidate.pushTokens?.length) channels.push('push');
        if (candidate.phone) channels.push('sms');

        const notificationId = await this.scheduleNotification({
          userId: candidate.userId,
          type: 'transportation_request',
          channels,
          scheduledTime: requestTime,
          payload: {
            appointmentId,
            patientName: transportationData.patientName,
            appointmentTime: transportationData.appointmentTime,
            pickupLocation: transportationData.pickupLocation,
            destination: transportationData.destination,
            candidate
          },
          status: 'pending',
          retryCount: 0,
          maxRetries: 2,
          priority: 'normal',
          metadata: {
            appointmentId,
            patientId: transportationData.patientId,
            notificationType: 'transportation_request'
          }
        });

        scheduledNotificationIds.push(notificationId);
      }
    }

    // Schedule follow-up reminder (12 hours before if no driver assigned)
    const followUpTime = new Date(transportationData.appointmentTime.getTime() - (12 * 60 * 60 * 1000));
    
    if (followUpTime > new Date()) {
      const notificationId = await this.scheduleNotification({
        userId: 'system', // System notification to check driver status
        type: 'transportation_request',
        channels: ['in_app'],
        scheduledTime: followUpTime,
        payload: {
          appointmentId,
          action: 'check_driver_status',
          transportationData
        },
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        priority: 'high',
        metadata: {
          appointmentId,
          patientId: transportationData.patientId,
          notificationType: 'transportation_followup'
        }
      });

      scheduledNotificationIds.push(notificationId);
    }

    console.log(`🚗 Scheduled ${scheduledNotificationIds.length} transportation notifications for appointment ${appointmentId}`);
    return scheduledNotificationIds;
  }

  /**
   * Process scheduled notifications that are due
   */
  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const query = db.collection('scheduled_notifications')
        .where('status', '==', 'pending')
        .where('scheduledTime', '<=', now)
        .limit(50);

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return; // No notifications to process
      }

      console.log(`📬 Processing ${snapshot.docs.length} scheduled notifications`);

      for (const doc of snapshot.docs) {
        const notification = doc.data() as ScheduledNotification;
        await this.sendScheduledNotification(notification);
      }
    } catch (error) {
      console.error('❌ Error processing scheduled notifications:', error);
    }
  }

  /**
   * Send a scheduled notification
   */
  private async sendScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      console.log(`📤 Sending notification: ${notification.id}`);

      // Update status to prevent duplicate processing
      await db.collection('scheduled_notifications').doc(notification.id).update({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date()
      });

      // Send through each requested channel
      const sendPromises: Promise<any>[] = [];

      for (const channel of notification.channels) {
        switch (channel) {
          case 'email':
            if (notification.payload.familyMember?.email) {
              sendPromises.push(this.sendEmailNotification(notification));
            }
            break;
          
          case 'push':
            if (notification.payload.familyMember?.pushTokens?.length) {
              sendPromises.push(this.sendPushNotification(notification));
            }
            break;
          
          case 'sms':
            if (notification.payload.familyMember?.phone) {
              sendPromises.push(this.sendSMSNotification(notification));
            }
            break;
          
          case 'in_app':
            sendPromises.push(this.sendInAppNotification(notification));
            break;
        }
      }

      // Wait for all notifications to be sent
      await Promise.allSettled(sendPromises);

      // Handle recurring notifications
      if (notification.recurring) {
        await this.scheduleRecurringNotification(notification);
      }

      console.log(`✅ Notification sent successfully: ${notification.id}`);
    } catch (error) {
      console.error(`❌ Error sending notification ${notification.id}:`, error);
      
      // Update notification with error and retry if possible
      const retryCount = notification.retryCount + 1;
      const shouldRetry = retryCount <= notification.maxRetries;

      await db.collection('scheduled_notifications').doc(notification.id).update({
        status: shouldRetry ? 'pending' : 'failed',
        retryCount,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
        ...(shouldRetry && {
          scheduledTime: new Date(Date.now() + (retryCount * 5 * 60 * 1000)) // Retry in 5, 10, 15 minutes
        })
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: ScheduledNotification): Promise<void> {
    const { payload } = notification;
    
    switch (notification.type) {
      case 'appointment_reminder':
        await notificationService.sendNotification({
          userId: payload.familyMember.userId,
          patientId: payload.patientId || '',
          type: 'appointment_reminder',
          channel: 'email',
          recipient: payload.familyMember.email,
          subject: `Appointment Reminder: ${payload.appointmentTitle}`,
          message: `Hello ${payload.familyMember.name}, this is a reminder that ${payload.patientName} has an appointment with Dr. ${payload.doctorName} at ${new Date(payload.appointmentTime).toLocaleString()}.`,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          priority: 'medium'
        });
        break;
      
      case 'transportation_request':
        await notificationService.sendNotification({
          userId: payload.familyMember.userId,
          patientId: payload.patientId || '',
          type: 'transportation_needed',
          channel: 'email',
          recipient: payload.familyMember.email,
          subject: `Transportation Help Needed: ${payload.patientName}`,
          message: `Hello ${payload.familyMember.name}, ${payload.patientName} needs transportation to their appointment at ${new Date(payload.appointmentTime).toLocaleString()}.`,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          priority: 'high'
        });
        break;
      
      // Add other notification types as needed
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: ScheduledNotification): Promise<void> {
    const { payload } = notification;
    
    switch (notification.type) {
      case 'appointment_reminder':
        await pushNotificationService.sendAppointmentReminder(
          payload.familyMember.pushTokens,
          {
            patientName: payload.patientName,
            doctorName: payload.doctorName,
            appointmentTime: new Date(payload.appointmentTime),
            location: payload.location,
            appointmentType: payload.appointmentType
          }
        );
        break;
      
      case 'transportation_request':
        await pushNotificationService.sendTransportationNotification(
          payload.familyMember.pushTokens,
          {
            patientName: payload.patientName,
            appointmentTime: new Date(payload.appointmentTime),
            pickupLocation: payload.pickupLocation,
            destination: payload.destination,
            isRequest: true
          }
        );
        break;
      
      // Add other notification types as needed
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(notification: ScheduledNotification): Promise<void> {
    const { payload } = notification;
    
    switch (notification.type) {
      case 'appointment_reminder':
        await smsNotificationService.sendAppointmentReminderSMS(
          [payload.familyMember.phone],
          {
            patientName: payload.patientName,
            doctorName: payload.doctorName,
            appointmentTime: new Date(payload.appointmentTime),
            location: payload.location,
            appointmentType: payload.appointmentType
          }
        );
        break;
      
      case 'transportation_request':
        await smsNotificationService.sendTransportationSMS(
          [payload.familyMember.phone],
          {
            patientName: payload.patientName,
            appointmentTime: new Date(payload.appointmentTime),
            pickupLocation: payload.pickupLocation,
            destination: payload.destination,
            isRequest: true
          }
        );
        break;
      
      // Add other notification types as needed
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(notification: ScheduledNotification): Promise<void> {
    // Store in-app notification in database for user to see when they open the app
    const inAppNotification = {
      userId: notification.userId,
      type: notification.type,
      title: this.getNotificationTitle(notification),
      message: this.getNotificationMessage(notification),
      data: notification.payload,
      read: false,
      createdAt: new Date(),
      priority: notification.priority
    };

    await db.collection('in_app_notifications').add(inAppNotification);
  }

  /**
   * Schedule recurring notification
   */
  private async scheduleRecurringNotification(notification: ScheduledNotification): Promise<void> {
    if (!notification.recurring) return;

    const { recurring } = notification;
    let nextScheduledTime: Date;

    switch (recurring.frequency) {
      case 'daily':
        nextScheduledTime = new Date(notification.scheduledTime.getTime() + (recurring.interval * 24 * 60 * 60 * 1000));
        break;
      
      case 'weekly':
        nextScheduledTime = new Date(notification.scheduledTime.getTime() + (recurring.interval * 7 * 24 * 60 * 60 * 1000));
        break;
      
      case 'monthly':
        nextScheduledTime = new Date(notification.scheduledTime);
        nextScheduledTime.setMonth(nextScheduledTime.getMonth() + recurring.interval);
        break;
      
      case 'yearly':
        nextScheduledTime = new Date(notification.scheduledTime);
        nextScheduledTime.setFullYear(nextScheduledTime.getFullYear() + recurring.interval);
        break;
      
      default:
        return;
    }

    // Check if we should continue recurring
    if (recurring.endDate && nextScheduledTime > recurring.endDate) {
      return;
    }

    // Schedule the next occurrence
    await this.scheduleNotification({
      ...notification,
      scheduledTime: nextScheduledTime,
      status: 'pending',
      retryCount: 0
    });
  }

  /**
   * Get notification title based on type
   */
  private getNotificationTitle(notification: ScheduledNotification): string {
    switch (notification.type) {
      case 'appointment_reminder':
        return '🏥 Appointment Reminder';
      case 'transportation_request':
        return '🚗 Transportation Needed';
      case 'transportation_confirmation':
        return '✅ Transportation Confirmed';
      case 'emergency_alert':
        return '🚨 Emergency Alert';
      case 'family_coordination':
        return '👨‍👩‍👧‍👦 Family Update';
      case 'medication_reminder':
        return '💊 Medication Reminder';
      default:
        return '📬 Notification';
    }
  }

  /**
   * Get notification message based on type
   */
  private getNotificationMessage(notification: ScheduledNotification): string {
    const { payload } = notification;
    
    switch (notification.type) {
      case 'appointment_reminder':
        return `${payload.patientName} has an appointment with Dr. ${payload.doctorName} at ${new Date(payload.appointmentTime).toLocaleString()}`;
      
      case 'transportation_request':
        return `${payload.patientName} needs transportation to their appointment`;
      
      case 'transportation_confirmation':
        return `Transportation confirmed for ${payload.patientName}`;
      
      default:
        return 'You have a new notification';
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      let query = db.collection('scheduled_notifications');
      
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      
      if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      }
      
      if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      const snapshot = await query.get();
      const notifications = snapshot.docs.map((doc: any) => doc.data());

      const stats = {
        total: notifications.length,
        sent: notifications.filter((n: any) => n.status === 'sent').length,
        pending: notifications.filter((n: any) => n.status === 'pending').length,
        failed: notifications.filter((n: any) => n.status === 'failed').length,
        cancelled: notifications.filter((n: any) => n.status === 'cancelled').length,
        byType: {} as { [key: string]: number },
        byChannel: {} as { [key: string]: number },
        byPriority: {} as { [key: string]: number }
      };

      // Count by type
      notifications.forEach((n: any) => {
        stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
        stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
        
        n.channels.forEach((channel: string) => {
          stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
        });
      });

      return stats;
    } catch (error) {
      console.error('❌ Error getting notification stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationScheduler = new NotificationScheduler();