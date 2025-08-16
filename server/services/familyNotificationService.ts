import { adminDb } from '../firebase-admin';
import { notificationService } from './notificationService';
import { pushNotificationService } from './pushNotificationService';
import { smsNotificationService } from './smsNotificationService';
import { notificationScheduler } from './notificationScheduler';

const db = adminDb;

export interface FamilyMember {
  id: string;
  userId?: string;
  patientId: string;
  name: string;
  email?: string;
  phone?: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'caregiver' | 'other';
  permissions: FamilyPermission[];
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
    emergencyOnly: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    reminderTiming: number[]; // minutes before appointment
  };
  pushTokens: string[];
  isEmergencyContact: boolean;
  canDrive: boolean;
  availability: {
    monday: { available: boolean; hours?: string };
    tuesday: { available: boolean; hours?: string };
    wednesday: { available: boolean; hours?: string };
    thursday: { available: boolean; hours?: string };
    friday: { available: boolean; hours?: string };
    saturday: { available: boolean; hours?: string };
    sunday: { available: boolean; hours?: string };
  };
  invitationStatus: 'pending' | 'accepted' | 'declined';
  invitedAt: Date;
  joinedAt?: Date;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FamilyPermission = 
  | 'view_appointments' 
  | 'edit_appointments' 
  | 'receive_notifications' 
  | 'emergency_contact' 
  | 'transportation_coordinator'
  | 'medication_manager'
  | 'document_access';

export interface FamilyNotificationContext {
  patientId: string;
  patientName: string;
  eventId?: string;
  eventType?: 'appointment' | 'medication' | 'emergency' | 'transportation' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  requiresAction?: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  patientId: string;
  eventType: string;
  conditions: {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }[];
  recipients: {
    type: 'all_family' | 'emergency_contacts' | 'specific_members' | 'by_permission';
    memberIds?: string[];
    permissions?: FamilyPermission[];
    excludeIds?: string[];
  };
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  timing: {
    immediate: boolean;
    delays?: number[]; // minutes
  };
  template: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class FamilyNotificationService {
  /**
   * Get all family members for a patient
   */
  async getFamilyMembers(patientId: string): Promise<FamilyMember[]> {
    try {
      const snapshot = await db.collection('familyMembers')
        .where('patientId', '==', patientId)
        .where('invitationStatus', '==', 'accepted')
        .get();

      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as FamilyMember));
    } catch (error) {
      console.error('Error getting family members:', error);
      return [];
    }
  }

  /**
   * Get family members with specific permission
   */
  async getFamilyMembersWithPermission(
    patientId: string, 
    permission: FamilyPermission
  ): Promise<FamilyMember[]> {
    try {
      const snapshot = await db.collection('familyMembers')
        .where('patientId', '==', patientId)
        .where('permissions', 'array-contains', permission)
        .where('invitationStatus', '==', 'accepted')
        .get();

      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as FamilyMember));
    } catch (error) {
      console.error('Error getting family members with permission:', error);
      return [];
    }
  }

  /**
   * Get emergency contacts for a patient
   */
  async getEmergencyContacts(patientId: string): Promise<FamilyMember[]> {
    try {
      const snapshot = await db.collection('familyMembers')
        .where('patientId', '==', patientId)
        .where('isEmergencyContact', '==', true)
        .where('invitationStatus', '==', 'accepted')
        .get();

      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as FamilyMember));
    } catch (error) {
      console.error('Error getting emergency contacts:', error);
      return [];
    }
  }

  /**
   * Send notification to all family members
   */
  async notifyAllFamilyMembers(
    context: FamilyNotificationContext,
    message: {
      subject: string;
      body: string;
      template?: string;
      variables?: Record<string, any>;
    },
    options?: {
      excludeIds?: string[];
      onlyEmergencyContacts?: boolean;
      requiredPermission?: FamilyPermission;
    }
  ): Promise<void> {
    try {
      let familyMembers = await this.getFamilyMembers(context.patientId);

      // Apply filters
      if (options?.onlyEmergencyContacts) {
        familyMembers = familyMembers.filter(member => member.isEmergencyContact);
      }

      if (options?.requiredPermission) {
        familyMembers = familyMembers.filter(member => 
          member.permissions.includes(options.requiredPermission!)
        );
      }

      if (options?.excludeIds) {
        familyMembers = familyMembers.filter(member => 
          !options.excludeIds!.includes(member.id)
        );
      }

      // Filter by emergency-only preference for non-emergency notifications
      if (context.priority !== 'emergency') {
        familyMembers = familyMembers.filter(member => 
          !member.notificationPreferences.emergencyOnly
        );
      }

      // Send notifications to each family member
      const notificationPromises = familyMembers.map(member => 
        this.sendNotificationToFamilyMember(member, context, message)
      );

      await Promise.allSettled(notificationPromises);
      
      console.log(`📬 Sent notifications to ${familyMembers.length} family members for patient ${context.patientId}`);
    } catch (error) {
      console.error('Error notifying family members:', error);
      throw error;
    }
  }

  /**
   * Send notification to a specific family member
   */
  async sendNotificationToFamilyMember(
    familyMember: FamilyMember,
    context: FamilyNotificationContext,
    message: {
      subject: string;
      body: string;
      template?: string;
      variables?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Check quiet hours (except for emergencies)
      if (context.priority !== 'emergency' && this.isInQuietHours(familyMember)) {
        console.log(`⏰ Delaying notification for ${familyMember.name} due to quiet hours`);
        await this.scheduleNotificationAfterQuietHours(familyMember, context, message);
        return;
      }

      // Determine which channels to use
      const channels = this.getActiveChannelsForMember(familyMember, context.priority);
      
      // Send through each active channel
      const sendPromises: Promise<any>[] = [];

      for (const channel of channels) {
        switch (channel) {
          case 'email':
            if (familyMember.email) {
              sendPromises.push(this.sendEmailToFamilyMember(familyMember, context, message));
            }
            break;
          
          case 'sms':
            if (familyMember.phone) {
              sendPromises.push(this.sendSMSToFamilyMember(familyMember, context, message));
            }
            break;
          
          case 'push':
            if (familyMember.pushTokens.length > 0) {
              sendPromises.push(this.sendPushToFamilyMember(familyMember, context, message));
            }
            break;
          
          case 'in_app':
            sendPromises.push(this.sendInAppToFamilyMember(familyMember, context, message));
            break;
        }
      }

      await Promise.allSettled(sendPromises);
      
      // Update last contact time
      await this.updateLastContactTime(familyMember.id);
      
    } catch (error) {
      console.error(`Error sending notification to family member ${familyMember.id}:`, error);
      throw error;
    }
  }

  /**
   * Send appointment reminder to family members
   */
  async sendAppointmentReminder(
    patientId: string,
    appointmentData: {
      id: string;
      patientName: string;
      doctorName: string;
      appointmentTime: Date;
      location: string;
      appointmentType: string;
      requiresTransportation?: boolean;
      preparationInstructions?: string;
    },
    minutesBefore: number
  ): Promise<void> {
    const timeString = appointmentData.appointmentTime.toLocaleString();
    const reminderType = minutesBefore >= 1440 ? 'advance' : 
                        minutesBefore >= 60 ? 'day-of' : 'immediate';

    const context: FamilyNotificationContext = {
      patientId,
      patientName: appointmentData.patientName,
      eventId: appointmentData.id,
      eventType: 'appointment',
      priority: minutesBefore <= 60 ? 'high' : 'medium',
      requiresAction: appointmentData.requiresTransportation,
      actionUrl: appointmentData.requiresTransportation ? 
        `/transportation/claim/${appointmentData.id}` : undefined,
      metadata: { minutesBefore, reminderType }
    };

    const message = {
      subject: `Appointment Reminder: ${appointmentData.patientName} - ${appointmentData.appointmentType}`,
      body: `${appointmentData.patientName} has an appointment with Dr. ${appointmentData.doctorName} on ${timeString} at ${appointmentData.location}.`,
      template: 'appointment_reminder',
      variables: {
        patientName: appointmentData.patientName,
        doctorName: appointmentData.doctorName,
        appointmentTime: timeString,
        location: appointmentData.location,
        appointmentType: appointmentData.appointmentType,
        minutesBefore: minutesBefore.toString(),
        requiresTransportation: appointmentData.requiresTransportation,
        preparationInstructions: appointmentData.preparationInstructions
      }
    };

    await this.notifyAllFamilyMembers(context, message, {
      requiredPermission: 'receive_notifications'
    });
  }

  /**
   * Send transportation coordination request
   */
  async sendTransportationRequest(
    patientId: string,
    transportationData: {
      appointmentId: string;
      patientName: string;
      appointmentTime: Date;
      pickupLocation: string;
      destination: string;
      appointmentType: string;
      notes?: string;
    }
  ): Promise<void> {
    const context: FamilyNotificationContext = {
      patientId,
      patientName: transportationData.patientName,
      eventId: transportationData.appointmentId,
      eventType: 'transportation',
      priority: 'high',
      requiresAction: true,
      actionUrl: `/transportation/claim/${transportationData.appointmentId}`,
      metadata: { type: 'request' }
    };

    const message = {
      subject: `Transportation Needed: ${transportationData.patientName}`,
      body: `${transportationData.patientName} needs transportation to their ${transportationData.appointmentType} appointment on ${transportationData.appointmentTime.toLocaleString()}.`,
      template: 'transportation_request',
      variables: {
        patientName: transportationData.patientName,
        appointmentTime: transportationData.appointmentTime.toLocaleString(),
        pickupLocation: transportationData.pickupLocation,
        destination: transportationData.destination,
        appointmentType: transportationData.appointmentType,
        notes: transportationData.notes
      }
    };

    // Only notify family members who can drive
    const familyMembers = await this.getFamilyMembers(patientId);
    const driversWithPermission = familyMembers.filter(member => 
      member.canDrive && 
      member.permissions.includes('transportation_coordinator')
    );

    for (const driver of driversWithPermission) {
      await this.sendNotificationToFamilyMember(driver, context, message);
    }
  }

  /**
   * Send transportation confirmation
   */
  async sendTransportationConfirmation(
    patientId: string,
    transportationData: {
      appointmentId: string;
      patientName: string;
      driverName: string;
      driverPhone?: string;
      appointmentTime: Date;
      pickupLocation: string;
      destination: string;
    }
  ): Promise<void> {
    const context: FamilyNotificationContext = {
      patientId,
      patientName: transportationData.patientName,
      eventId: transportationData.appointmentId,
      eventType: 'transportation',
      priority: 'medium',
      metadata: { type: 'confirmation' }
    };

    const message = {
      subject: `Transportation Confirmed: ${transportationData.patientName}`,
      body: `${transportationData.driverName} will provide transportation for ${transportationData.patientName}'s appointment on ${transportationData.appointmentTime.toLocaleString()}.`,
      template: 'transportation_confirmation',
      variables: {
        patientName: transportationData.patientName,
        driverName: transportationData.driverName,
        driverPhone: transportationData.driverPhone,
        appointmentTime: transportationData.appointmentTime.toLocaleString(),
        pickupLocation: transportationData.pickupLocation,
        destination: transportationData.destination
      }
    };

    await this.notifyAllFamilyMembers(context, message, {
      requiredPermission: 'receive_notifications'
    });
  }

  /**
   * Send emergency alert to family members
   */
  async sendEmergencyAlert(
    patientId: string,
    emergencyData: {
      patientName: string;
      emergencyType: string;
      location: string;
      contactNumber: string;
      reportedBy: string;
      additionalInfo?: string;
    }
  ): Promise<void> {
    const context: FamilyNotificationContext = {
      patientId,
      patientName: emergencyData.patientName,
      eventType: 'emergency',
      priority: 'emergency',
      requiresAction: true,
      metadata: { emergencyType: emergencyData.emergencyType }
    };

    const message = {
      subject: `🚨 EMERGENCY ALERT: ${emergencyData.patientName}`,
      body: `Emergency situation: ${emergencyData.emergencyType}. ${emergencyData.patientName} is at ${emergencyData.location}. Contact: ${emergencyData.contactNumber}`,
      template: 'emergency_alert',
      variables: {
        patientName: emergencyData.patientName,
        emergencyType: emergencyData.emergencyType,
        location: emergencyData.location,
        contactNumber: emergencyData.contactNumber,
        reportedBy: emergencyData.reportedBy,
        additionalInfo: emergencyData.additionalInfo,
        timestamp: new Date().toLocaleString()
      }
    };

    // Send to all emergency contacts immediately
    await this.notifyAllFamilyMembers(context, message, {
      onlyEmergencyContacts: true
    });

    // Also send to all family members (emergency overrides quiet hours and preferences)
    await this.notifyAllFamilyMembers(context, message);
  }

  /**
   * Send medication reminder to responsible family members
   */
  async sendMedicationReminder(
    patientId: string,
    medicationData: {
      patientName: string;
      medicationName: string;
      dosage: string;
      timeToTake: string;
      instructions?: string;
      missedDoses?: number;
    }
  ): Promise<void> {
    const context: FamilyNotificationContext = {
      patientId,
      patientName: medicationData.patientName,
      eventType: 'medication',
      priority: medicationData.missedDoses && medicationData.missedDoses > 0 ? 'high' : 'medium',
      metadata: { medicationName: medicationData.medicationName }
    };

    const message = {
      subject: `Medication Reminder: ${medicationData.patientName}`,
      body: `Time for ${medicationData.patientName} to take ${medicationData.medicationName} (${medicationData.dosage}) at ${medicationData.timeToTake}.`,
      template: 'medication_reminder',
      variables: {
        patientName: medicationData.patientName,
        medicationName: medicationData.medicationName,
        dosage: medicationData.dosage,
        timeToTake: medicationData.timeToTake,
        instructions: medicationData.instructions,
        missedDoses: medicationData.missedDoses?.toString()
      }
    };

    await this.notifyAllFamilyMembers(context, message, {
      requiredPermission: 'medication_manager'
    });
  }

  /**
   * Send general family coordination message
   */
  async sendFamilyCoordinationMessage(
    patientId: string,
    coordinationData: {
      senderName: string;
      senderRole: string;
      message: string;
      priority: 'low' | 'medium' | 'high';
      requiresResponse?: boolean;
      relatedEventId?: string;
    }
  ): Promise<void> {
    const context: FamilyNotificationContext = {
      patientId,
      patientName: '', // Will be filled by the service
      eventId: coordinationData.relatedEventId,
      eventType: 'general',
      priority: coordinationData.priority,
      requiresAction: coordinationData.requiresResponse,
      metadata: { 
        senderName: coordinationData.senderName,
        senderRole: coordinationData.senderRole
      }
    };

    const message = {
      subject: `Family Update: ${coordinationData.senderName}`,
      body: coordinationData.message,
      template: 'family_coordination',
      variables: {
        senderName: coordinationData.senderName,
        senderRole: coordinationData.senderRole,
        message: coordinationData.message,
        requiresResponse: coordinationData.requiresResponse,
        timestamp: new Date().toLocaleString()
      }
    };

    await this.notifyAllFamilyMembers(context, message, {
      requiredPermission: 'receive_notifications'
    });
  }

  // Helper methods

  private isInQuietHours(familyMember: FamilyMember): boolean {
    if (!familyMember.notificationPreferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = familyMember.notificationPreferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = familyMember.notificationPreferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private getActiveChannelsForMember(
    familyMember: FamilyMember, 
    priority: string
  ): ('email' | 'sms' | 'push' | 'in_app')[] {
    const prefs = familyMember.notificationPreferences;
    const channels: ('email' | 'sms' | 'push' | 'in_app')[] = [];

    // Emergency notifications use all available channels
    if (priority === 'emergency') {
      if (familyMember.email) channels.push('email');
      if (familyMember.phone) channels.push('sms');
      if (familyMember.pushTokens.length > 0) channels.push('push');
      channels.push('in_app');
      return channels;
    }

    // Regular notifications respect preferences
    if (prefs.email && familyMember.email) channels.push('email');
    if (prefs.sms && familyMember.phone) channels.push('sms');
    if (prefs.push && familyMember.pushTokens.length > 0) channels.push('push');
    if (prefs.inApp) channels.push('in_app');

    return channels.length > 0 ? channels : ['in_app']; // Always have at least in-app
  }

  private async scheduleNotificationAfterQuietHours(
    familyMember: FamilyMember,
    context: FamilyNotificationContext,
    message: any
  ): Promise<void> {
    // Calculate when quiet hours end
    const now = new Date();
    const [endHour, endMin] = familyMember.notificationPreferences.quietHours.end.split(':').map(Number);
    
    const endTime = new Date(now);
    endTime.setHours(endHour, endMin, 0, 0);
    
    // If end time is before current time, it's tomorrow
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1);
    }

    // Schedule notification for when quiet hours end
    await notificationScheduler.scheduleNotification({
      userId: familyMember.userId || familyMember.id,
      type: context.eventType as any,
      channels: this.getActiveChannelsForMember(familyMember, context.priority),
      scheduledTime: endTime,
      payload: {
        familyMember,
        context,
        message
      },
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      priority: context.priority as any
    });
  }

  private async sendEmailToFamilyMember(
    familyMember: FamilyMember,
    context: FamilyNotificationContext,
    message: any
  ): Promise<void> {
    await notificationService.sendNotification({
      userId: familyMember.userId || familyMember.id,
      patientId: context.patientId,
      eventId: context.eventId,
      type: context.eventType as any,
      channel: 'email',
      recipient: familyMember.email!,
      subject: message.subject,
      message: message.body,
      templateId: message.template,
      templateVariables: message.variables,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      priority: context.priority as any
    });
  }

  private async sendSMSToFamilyMember(
    familyMember: FamilyMember,
    context: FamilyNotificationContext,
    message: any
  ): Promise<void> {
    // Use the SMS service directly for family notifications
    await smsNotificationService.sendSMS({
      to: familyMember.phone!,
      message: `${message.subject}\n\n${message.body}`
    });
  }

  private async sendPushToFamilyMember(
    familyMember: FamilyMember,
    context: FamilyNotificationContext,
    message: any
  ): Promise<void> {
    await pushNotificationService.sendToTokens(
      familyMember.pushTokens,
      {
        title: message.subject,
        body: message.body,
        data: {
          type: context.eventType || 'general',
          patientId: context.patientId,
          eventId: context.eventId || '',
          priority: context.priority,
          requiresAction: context.requiresAction?.toString() || 'false',
          actionUrl: context.actionUrl || ''
        },
        priority: context.priority === 'emergency' || context.priority === 'urgent' ? 'high' : 'normal'
      }
    );
  }

  private async sendInAppToFamilyMember(
    familyMember: FamilyMember,
    context: FamilyNotificationContext,
    message: any
  ): Promise<void> {
    const inAppNotification = {
      userId: familyMember.userId || familyMember.id,
      patientId: context.patientId,
      type: context.eventType || 'general',
      title: message.subject,
      message: message.body,
      data: context.metadata || {},
      priority: context.priority,
      requiresAction: context.requiresAction || false,
      actionUrl: context.actionUrl,
      read: false,
      createdAt: new Date()
    };

    await db.collection('inAppNotifications').add(inAppNotification);
  }

  private async updateLastContactTime(familyMemberId: string): Promise<void> {
    try {
      await db.collection('familyMembers').doc(familyMemberId).update({
        lastActiveAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating last contact time:', error);
    }
  }

  /**
   * Get notification statistics for a family member
   */
  async getFamilyMemberNotificationStats(
    familyMemberId: string,
    days: number = 30
  ): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await db.collection('notificationLogs')
        .where('userId', '==', familyMemberId)
        .where('createdAt', '>=', startDate)
        .get();

      const notifications = snapshot.docs.map((doc: any) => doc.data());

      return {
        total: notifications.length,
        sent: notifications.filter((n: any) => n.status === 'sent' || n.status === 'delivered').length,
        failed: notifications.filter((n: any) => n.status === 'failed').length,
        byType: this.groupBy(notifications, 'type'),
        byChannel: this.groupBy(notifications, 'channel'),
        byPriority: this.groupBy(notifications, 'priority')
      };
    } catch (error) {
      console.error('Error getting family member notification stats:', error);
      return { total: 0, sent: 0, failed: 0, byType: {}, byChannel: {}, byPriority: {} };
    }
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((result, item) => {
      const group = item[key];
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }
}

// Export singleton instance
export const familyNotificationService = new FamilyNotificationService();