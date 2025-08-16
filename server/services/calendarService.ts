import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '@shared/firebase';
import { emailService } from './emailService';
import type {
  MedicalEvent,
  NewMedicalEvent,
  FamilyCalendarAccess,
  NewFamilyCalendarAccess,
  CalendarViewSettings,
  NewCalendarViewSettings,
  ApiResponse,
  MedicalEventType,
  MedicalEventStatus,
  MedicalEventPriority
} from '@shared/types';

export class CalendarService {
  private medicalEventsCollection = adminDb.collection(COLLECTIONS.MEDICAL_EVENTS);
  private familyAccessCollection = adminDb.collection(COLLECTIONS.FAMILY_CALENDAR_ACCESS);
  private viewSettingsCollection = adminDb.collection(COLLECTIONS.CALENDAR_VIEW_SETTINGS);
  private familyNotificationsCollection = adminDb.collection(COLLECTIONS.FAMILY_NOTIFICATIONS);
  private appointmentResponsibilitiesCollection = adminDb.collection(COLLECTIONS.APPOINTMENT_RESPONSIBILITIES);

  // ===== MEDICAL EVENTS CRUD =====

  // Get medical events for a patient with filtering
  async getMedicalEventsByPatientId(
    patientId: string, 
    filters: {
      startDate?: string;
      endDate?: string;
      eventType?: string;
      status?: string;
      priority?: string;
      providerId?: string;
      facilityId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ApiResponse<MedicalEvent[]>> {
    try {
      let query = this.medicalEventsCollection
        .where('patientId', '==', patientId);

      // Apply date range filter
      if (filters.startDate) {
        query = query.where('startDateTime', '>=', new Date(filters.startDate));
      }
      if (filters.endDate) {
        query = query.where('startDateTime', '<=', new Date(filters.endDate));
      }

      // Apply other filters
      if (filters.eventType) {
        query = query.where('eventType', '==', filters.eventType);
      }
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.priority) {
        query = query.where('priority', '==', filters.priority);
      }
      if (filters.providerId) {
        query = query.where('providerId', '==', filters.providerId);
      }
      if (filters.facilityId) {
        query = query.where('facilityId', '==', filters.facilityId);
      }

      // Apply ordering and pagination
      query = query.orderBy('startDateTime', 'asc');
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const snapshot = await query.get();
      const events = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicalEvent));

      return { success: true, data: events };
    } catch (error) {
      console.error('Error getting medical events:', error);
      return { success: false, error: 'Failed to retrieve medical events' };
    }
  }

  // Get a specific medical event by ID with access control
  async getMedicalEventById(eventId: string, userId: string): Promise<ApiResponse<MedicalEvent>> {
    try {
      const eventDoc = await this.medicalEventsCollection.doc(eventId).get();
      
      if (!eventDoc.exists) {
        return { success: false, error: 'Medical event not found' };
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() } as MedicalEvent;

      // Check access permissions
      const hasAccess = await this.checkEventAccess(eventData, userId);
      if (!hasAccess) {
        return { success: false, error: 'Access denied' };
      }

      return { success: true, data: eventData };
    } catch (error) {
      console.error('Error getting medical event:', error);
      return { success: false, error: 'Failed to retrieve medical event' };
    }
  }

  // Create a new medical event
  async createMedicalEvent(eventData: NewMedicalEvent): Promise<ApiResponse<MedicalEvent>> {
    try {
      const eventRef = this.medicalEventsCollection.doc();
      
      // Generate unique reminder IDs
      const remindersWithIds = eventData.reminders.map(reminder => ({
        ...reminder,
        id: reminder.id || `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));

      const newEvent: MedicalEvent = {
        id: eventRef.id,
        ...eventData,
        reminders: remindersWithIds,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        // Set default values for optional fields
        familyNotificationsSent: [],
        syncErrors: [],
        attachments: []
      };

      await eventRef.set(newEvent);

      // Send family notifications if required
      if (newEvent.requiresTransportation && newEvent.responsibilityStatus === 'unassigned') {
        await this.sendFamilyNotifications(newEvent, 'responsibility_needed');
      }

      return { success: true, data: newEvent };
    } catch (error) {
      console.error('Error creating medical event:', error);
      return { success: false, error: 'Failed to create medical event' };
    }
  }

  // Update an existing medical event
  async updateMedicalEvent(
    eventId: string, 
    updates: Partial<MedicalEvent>, 
    userId: string
  ): Promise<ApiResponse<MedicalEvent>> {
    try {
      // First check if event exists and user has access
      const existingEvent = await this.getMedicalEventById(eventId, userId);
      if (!existingEvent.success) {
        return existingEvent;
      }

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      await this.medicalEventsCollection.doc(eventId).update(updateData);
      
      // Get updated event
      const updatedEvent = await this.getMedicalEventById(eventId, userId);
      if (!updatedEvent.success) {
        throw new Error('Failed to get updated event');
      }

      return { success: true, data: updatedEvent.data! };
    } catch (error) {
      console.error('Error updating medical event:', error);
      return { success: false, error: 'Failed to update medical event' };
    }
  }

  // Delete a medical event
  async deleteMedicalEvent(eventId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      // First check if event exists and user has access
      const existingEvent = await this.getMedicalEventById(eventId, userId);
      if (!existingEvent.success) {
        return { success: false, error: existingEvent.error };
      }

      await this.medicalEventsCollection.doc(eventId).delete();

      // Also delete related appointment responsibilities
      const responsibilitiesQuery = await this.appointmentResponsibilitiesCollection
        .where('appointmentId', '==', eventId)
        .get();
      
      const batch = adminDb.batch();
      responsibilitiesQuery.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error('Error deleting medical event:', error);
      return { success: false, error: 'Failed to delete medical event' };
    }
  }

  // ===== FAMILY RESPONSIBILITY MANAGEMENT =====

  // Claim responsibility for an appointment
  async claimEventResponsibility(
    eventId: string, 
    userId: string, 
    transportationNotes?: string
  ): Promise<ApiResponse<MedicalEvent>> {
    try {
      const eventDoc = await this.medicalEventsCollection.doc(eventId).get();
      
      if (!eventDoc.exists) {
        return { success: false, error: 'Medical event not found' };
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() } as MedicalEvent;

      // Check if user has family access to claim responsibility
      const hasAccess = await this.checkFamilyAccess(eventData.patientId, userId, 'canClaimResponsibility');
      if (!hasAccess) {
        return { success: false, error: 'Access denied - cannot claim responsibility' };
      }

      // Update the event with responsibility claim
      const updateData = {
        responsiblePersonId: userId,
        responsibilityStatus: 'claimed' as const,
        responsibilityClaimedAt: new Date(),
        transportationNotes: transportationNotes || '',
        updatedAt: new Date(),
        version: (eventData.version || 0) + 1
      };

      await this.medicalEventsCollection.doc(eventId).update(updateData);

      // Create appointment responsibility record
      await this.createAppointmentResponsibility(eventId, eventData.patientId, userId, transportationNotes);

      // Send notification to patient about claimed responsibility
      await this.sendFamilyNotifications(eventData, 'responsibility_claimed');

      // Get updated event
      const updatedEvent = await this.getMedicalEventById(eventId, userId);
      return updatedEvent;
    } catch (error) {
      console.error('Error claiming event responsibility:', error);
      return { success: false, error: 'Failed to claim responsibility' };
    }
  }

  // Confirm responsibility for an appointment (patient or primary caregiver)
  async confirmEventResponsibility(eventId: string, userId: string): Promise<ApiResponse<MedicalEvent>> {
    try {
      const eventDoc = await this.medicalEventsCollection.doc(eventId).get();
      
      if (!eventDoc.exists) {
        return { success: false, error: 'Medical event not found' };
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() } as MedicalEvent;

      // Check if user is the patient or has family access
      const isPatient = eventData.patientId === userId;
      const hasAccess = await this.checkFamilyAccess(eventData.patientId, userId, 'canManageFamily');
      
      if (!isPatient && !hasAccess) {
        return { success: false, error: 'Access denied - cannot confirm responsibility' };
      }

      // Update the event with responsibility confirmation
      const updateData = {
        responsibilityStatus: 'confirmed' as const,
        responsibilityConfirmedAt: new Date(),
        updatedAt: new Date(),
        version: (eventData.version || 0) + 1
      };

      await this.medicalEventsCollection.doc(eventId).update(updateData);

      // Update appointment responsibility record
      if (eventData.responsiblePersonId) {
        const responsibilityQuery = await this.appointmentResponsibilitiesCollection
          .where('appointmentId', '==', eventId)
          .where('responsiblePersonId', '==', eventData.responsiblePersonId)
          .limit(1)
          .get();

        if (!responsibilityQuery.empty) {
          const responsibilityDoc = responsibilityQuery.docs[0];
          await responsibilityDoc.ref.update({
            status: 'confirmed',
            confirmedAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Get updated event
      const updatedEvent = await this.getMedicalEventById(eventId, userId);
      return updatedEvent;
    } catch (error) {
      console.error('Error confirming event responsibility:', error);
      return { success: false, error: 'Failed to confirm responsibility' };
    }
  }

  // Get events by responsibility status
  async getEventsByResponsibilityStatus(
    userId: string, 
    status: 'unassigned' | 'claimed' | 'confirmed' | 'declined' | 'completed'
  ): Promise<ApiResponse<MedicalEvent[]>> {
    try {
      let query;
      
      if (status === 'unassigned') {
        // Get events where user has family access and responsibility is unassigned
        const familyAccessQuery = await this.familyAccessCollection
          .where('familyMemberId', '==', userId)
          .where('status', '==', 'active')
          .get();

        const patientIds = familyAccessQuery.docs
          .map((doc: any) => doc.data().patientId)
          .filter((patientId: string, index: number) => {
            const permissions = familyAccessQuery.docs[index].data().permissions;
            return permissions.canClaimResponsibility;
          });

        if (patientIds.length === 0) {
          return { success: true, data: [] };
        }

        // Get unassigned events for these patients
        query = this.medicalEventsCollection
          .where('patientId', 'in', patientIds)
          .where('responsibilityStatus', '==', 'unassigned')
          .where('requiresTransportation', '==', true);
      } else {
        // Get events where user is the responsible person
        query = this.medicalEventsCollection
          .where('responsiblePersonId', '==', userId)
          .where('responsibilityStatus', '==', status);
      }

      query = query.orderBy('startDateTime', 'asc');
      const snapshot = await query.get();
      
      const events = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicalEvent));

      return { success: true, data: events };
    } catch (error) {
      console.error('Error getting events by responsibility status:', error);
      return { success: false, error: 'Failed to retrieve events by responsibility status' };
    }
  }

  // ===== FAMILY CALENDAR ACCESS MANAGEMENT =====

  // Get family calendar access for a patient
  async getFamilyCalendarAccess(patientId: string): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    try {
      const query = await this.familyAccessCollection
        .where('patientId', '==', patientId)
        .orderBy('createdAt', 'desc')
        .get();

      const accessRecords = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as FamilyCalendarAccess));

      return { success: true, data: accessRecords };
    } catch (error) {
      console.error('Error getting family calendar access:', error);
      return { success: false, error: 'Failed to retrieve family calendar access' };
    }
  }

  // Create family calendar access
  async createFamilyCalendarAccess(accessData: NewFamilyCalendarAccess): Promise<ApiResponse<FamilyCalendarAccess>> {
    try {
      // Check if access already exists
      const existingQuery = await this.familyAccessCollection
        .where('patientId', '==', accessData.patientId)
        .where('familyMemberId', '==', accessData.familyMemberId)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        return { success: false, error: 'Family member already has access to this calendar' };
      }

      const accessRef = this.familyAccessCollection.doc();
      const newAccess: FamilyCalendarAccess = {
        id: accessRef.id,
        ...accessData,
        status: 'active',
        invitedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await accessRef.set(newAccess);

      return { success: true, data: newAccess };
    } catch (error) {
      console.error('Error creating family calendar access:', error);
      return { success: false, error: 'Failed to create family calendar access' };
    }
  }

  // Update family calendar access
  async updateFamilyCalendarAccess(
    accessId: string, 
    updates: Partial<FamilyCalendarAccess>, 
    userId: string
  ): Promise<ApiResponse<FamilyCalendarAccess>> {
    try {
      const accessDoc = await this.familyAccessCollection.doc(accessId).get();
      
      if (!accessDoc.exists) {
        return { success: false, error: 'Family calendar access not found' };
      }

      const accessData = accessDoc.data() as FamilyCalendarAccess;

      // Check if user has permission to update this access
      const canUpdate = accessData.patientId === userId || 
                       accessData.familyMemberId === userId ||
                       await this.checkFamilyAccess(accessData.patientId, userId, 'canManageFamily');

      if (!canUpdate) {
        return { success: false, error: 'Access denied' };
      }

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await this.familyAccessCollection.doc(accessId).update(updateData);

      const updatedDoc = await this.familyAccessCollection.doc(accessId).get();
      const updatedAccess = { id: updatedDoc.id, ...updatedDoc.data() } as FamilyCalendarAccess;

      return { success: true, data: updatedAccess };
    } catch (error) {
      console.error('Error updating family calendar access:', error);
      return { success: false, error: 'Failed to update family calendar access' };
    }
  }

  // Revoke family calendar access
  async revokeFamilyCalendarAccess(accessId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      const accessDoc = await this.familyAccessCollection.doc(accessId).get();
      
      if (!accessDoc.exists) {
        return { success: false, error: 'Family calendar access not found' };
      }

      const accessData = accessDoc.data() as FamilyCalendarAccess;

      // Check if user has permission to revoke this access
      const canRevoke = accessData.patientId === userId || 
                       accessData.familyMemberId === userId ||
                       await this.checkFamilyAccess(accessData.patientId, userId, 'canManageFamily');

      if (!canRevoke) {
        return { success: false, error: 'Access denied' };
      }

      await this.familyAccessCollection.doc(accessId).delete();

      return { success: true };
    } catch (error) {
      console.error('Error revoking family calendar access:', error);
      return { success: false, error: 'Failed to revoke family calendar access' };
    }
  }

  // ===== CALENDAR VIEW SETTINGS =====

  // Get calendar view settings
  async getCalendarViewSettings(userId: string, patientId?: string): Promise<ApiResponse<CalendarViewSettings | null>> {
    try {
      const settingsId = patientId ? `${userId}_${patientId}` : userId;
      const settingsDoc = await this.viewSettingsCollection.doc(settingsId).get();
      
      if (!settingsDoc.exists) {
        return { success: true, data: null };
      }

      const settings = { id: settingsDoc.id, ...settingsDoc.data() } as CalendarViewSettings;
      return { success: true, data: settings };
    } catch (error) {
      console.error('Error getting calendar view settings:', error);
      return { success: false, error: 'Failed to retrieve calendar view settings' };
    }
  }

  // Create or update calendar view settings
  async createOrUpdateCalendarViewSettings(settingsData: NewCalendarViewSettings): Promise<ApiResponse<CalendarViewSettings>> {
    try {
      const settingsId = `${settingsData.userId}_${settingsData.patientId}`;
      const settingsRef = this.viewSettingsCollection.doc(settingsId);
      
      const existingDoc = await settingsRef.get();
      
      if (existingDoc.exists) {
        // Update existing settings
        const updateData = {
          ...settingsData,
          updatedAt: new Date()
        };
        
        await settingsRef.update(updateData);
      } else {
        // Create new settings
        const newSettings: CalendarViewSettings = {
          id: settingsId,
          ...settingsData,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await settingsRef.set(newSettings);
      }

      const updatedDoc = await settingsRef.get();
      const settings = { id: updatedDoc.id, ...updatedDoc.data() } as CalendarViewSettings;

      return { success: true, data: settings };
    } catch (error) {
      console.error('Error creating/updating calendar view settings:', error);
      return { success: false, error: 'Failed to save calendar view settings' };
    }
  }

  // ===== CALENDAR ANALYTICS =====

  // Get calendar analytics
  async getCalendarAnalytics(
    patientId: string, 
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<ApiResponse<any>> {
    try {
      let query = this.medicalEventsCollection.where('patientId', '==', patientId);

      if (options.startDate) {
        query = query.where('startDateTime', '>=', new Date(options.startDate));
      }
      if (options.endDate) {
        query = query.where('startDateTime', '<=', new Date(options.endDate));
      }

      const snapshot = await query.get();
      const events = snapshot.docs.map((doc: any) => doc.data() as MedicalEvent);

      // Calculate analytics
      const analytics = {
        totalEvents: events.length,
        eventsByType: this.groupBy(events, 'eventType'),
        eventsByStatus: this.groupBy(events, 'status'),
        eventsByPriority: this.groupBy(events, 'priority'),
        upcomingEvents: events.filter((e: MedicalEvent) => new Date(e.startDateTime) > new Date()).length,
        completedEvents: events.filter((e: MedicalEvent) => e.status === 'completed').length,
        cancelledEvents: events.filter((e: MedicalEvent) => e.status === 'cancelled').length,
        eventsRequiringTransportation: events.filter((e: MedicalEvent) => e.requiresTransportation).length,
        unassignedResponsibilities: events.filter((e: MedicalEvent) => e.requiresTransportation && e.responsibilityStatus === 'unassigned').length
      };

      return { success: true, data: analytics };
    } catch (error) {
      console.error('Error getting calendar analytics:', error);
      return { success: false, error: 'Failed to retrieve calendar analytics' };
    }
  }

  // Get upcoming events
  async getUpcomingEvents(patientId: string, days: number = 7): Promise<ApiResponse<MedicalEvent[]>> {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

      const query = await this.medicalEventsCollection
        .where('patientId', '==', patientId)
        .where('startDateTime', '>=', now)
        .where('startDateTime', '<=', futureDate)
        .orderBy('startDateTime', 'asc')
        .get();

      const events = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicalEvent));

      return { success: true, data: events };
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return { success: false, error: 'Failed to retrieve upcoming events' };
    }
  }

  // Get events requiring attention
  async getEventsRequiringAttention(userId: string): Promise<ApiResponse<MedicalEvent[]>> {
    try {
      // Get events where user is patient or has family access
      const familyAccessQuery = await this.familyAccessCollection
        .where('familyMemberId', '==', userId)
        .where('status', '==', 'active')
        .get();

      const patientIds = [userId, ...familyAccessQuery.docs.map((doc: any) => doc.data().patientId)];

      const now = new Date();
      const query = await this.medicalEventsCollection
        .where('patientId', 'in', patientIds)
        .where('startDateTime', '>=', now)
        .get();

      const events = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicalEvent));

      // Filter events requiring attention
      const attentionEvents = events.filter((event: MedicalEvent) => {
        return (
          // Unassigned transportation responsibilities
          (event.requiresTransportation && event.responsibilityStatus === 'unassigned') ||
          // Overdue follow-ups
          (event.followUpRequired && event.followUpDate && new Date(event.followUpDate) < now) ||
          // High priority events within 24 hours
          (event.priority === 'urgent' || event.priority === 'high') && 
          new Date(event.startDateTime).getTime() - now.getTime() < 24 * 60 * 60 * 1000
        );
      });

      return { success: true, data: attentionEvents };
    } catch (error) {
      console.error('Error getting events requiring attention:', error);
      return { success: false, error: 'Failed to retrieve events requiring attention' };
    }
  }

  // ===== HELPER METHODS =====

  // Check if user has access to an event
  private async checkEventAccess(event: MedicalEvent, userId: string): Promise<boolean> {
    // Patient owns the event
    if (event.patientId === userId) {
      return true;
    }

    // Check family access
    return await this.checkFamilyAccess(event.patientId, userId, 'canView');
  }

  // Check family access permissions
  private async checkFamilyAccess(
    patientId: string, 
    userId: string, 
    permission: keyof FamilyCalendarAccess['permissions']
  ): Promise<boolean> {
    try {
      const accessQuery = await this.familyAccessCollection
        .where('patientId', '==', patientId)
        .where('familyMemberId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (accessQuery.empty) {
        return false;
      }

      const accessData = accessQuery.docs[0].data() as FamilyCalendarAccess;
      return accessData.permissions[permission] === true;
    } catch (error) {
      console.error('Error checking family access:', error);
      return false;
    }
  }

  // Create appointment responsibility record
  private async createAppointmentResponsibility(
    appointmentId: string,
    patientId: string,
    responsiblePersonId: string,
    transportationNotes?: string
  ): Promise<void> {
    try {
      const responsibilityRef = this.appointmentResponsibilitiesCollection.doc();
      const responsibility = {
        id: responsibilityRef.id,
        appointmentId,
        patientId,
        responsiblePersonId,
        responsiblePersonName: '', // This would be populated from user data
        status: 'claimed' as const,
        claimedAt: new Date(),
        transportationNotes: transportationNotes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await responsibilityRef.set(responsibility);
    } catch (error) {
      console.error('Error creating appointment responsibility:', error);
    }
  }

  // Send family notifications
  private async sendFamilyNotifications(
    event: MedicalEvent,
    notificationType: 'appointment_created' | 'responsibility_needed' | 'responsibility_claimed' | 'appointment_reminder' | 'appointment_cancelled'
  ): Promise<void> {
    try {
      // Get family members with notification permissions
      const familyAccessQuery = await this.familyAccessCollection
        .where('patientId', '==', event.patientId)
        .where('status', '==', 'active')
        .get();

      const notifications = familyAccessQuery.docs
        .filter((doc: any) => {
          const permissions = doc.data().permissions;
          return permissions.canReceiveNotifications;
        })
        .map((doc: any) => {
          const familyData = doc.data();
          return {
            patientId: event.patientId,
            appointmentId: event.id,
            recipientId: familyData.familyMemberId,
            recipientEmail: familyData.familyMemberEmail,
            recipientName: familyData.familyMemberName,
            notificationType,
            message: this.generateNotificationMessage(event, notificationType),
            sentAt: new Date(),
            createdAt: new Date()
          };
        });

      // Send notifications (batch write)
      if (notifications.length > 0) {
        const batch = adminDb.batch();
        notifications.forEach((notification: any) => {
          const notificationRef = this.familyNotificationsCollection.doc();
          batch.set(notificationRef, { id: notificationRef.id, ...notification });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('Error sending family notifications:', error);
    }
  }

  // Generate notification message
  private generateNotificationMessage(event: MedicalEvent, type: string): string {
    switch (type) {
      case 'appointment_created':
        return `New appointment scheduled: ${event.title} on ${new Date(event.startDateTime).toLocaleDateString()}`;
      case 'responsibility_needed':
        return `Transportation needed for appointment: ${event.title} on ${new Date(event.startDateTime).toLocaleDateString()}`;
      case 'responsibility_claimed':
        return `Transportation has been arranged for appointment: ${event.title}`;
      case 'appointment_reminder':
        return `Reminder: ${event.title} is scheduled for ${new Date(event.startDateTime).toLocaleDateString()}`;
      case 'appointment_cancelled':
        return `Appointment cancelled: ${event.title} scheduled for ${new Date(event.startDateTime).toLocaleDateString()}`;
      default:
        return `Update for appointment: ${event.title}`;
    }
  }

  // Group array by property
  private groupBy<T>(array: T[], property: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = String(item[property]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// Export singleton instance
export const calendarService = new CalendarService();