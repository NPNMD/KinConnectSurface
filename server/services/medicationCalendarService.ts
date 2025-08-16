import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '@shared/firebase';
import { calendarService } from './calendarService';
import { medicationService } from './medicationService';
import type {
  MedicationSchedule,
  NewMedicationSchedule,
  MedicationCalendarEvent,
  NewMedicationCalendarEvent,
  MedicationAdherence,
  MedicalEvent,
  NewMedicalEvent,
  Medication,
  ApiResponse
} from '@shared/types';

export class MedicationCalendarService {
  private medicationSchedulesCollection = adminDb.collection(COLLECTIONS.MEDICATION_SCHEDULES);
  private medicationCalendarEventsCollection = adminDb.collection(COLLECTIONS.MEDICATION_CALENDAR_EVENTS);
  private medicationAdherenceCollection = adminDb.collection(COLLECTIONS.MEDICATION_ADHERENCE);

  // ===== MEDICATION SCHEDULE MANAGEMENT =====

  // Create a new medication schedule
  async createMedicationSchedule(scheduleData: NewMedicationSchedule): Promise<ApiResponse<MedicationSchedule>> {
    try {
      // Validate the medication exists
      const medicationResult = await medicationService.getMedicationById(scheduleData.medicationId);
      if (!medicationResult.success || !medicationResult.data) {
        return { success: false, error: 'Medication not found' };
      }

      const scheduleRef = this.medicationSchedulesCollection.doc();
      const newSchedule: MedicationSchedule = {
        id: scheduleRef.id,
        ...scheduleData,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await scheduleRef.set(newSchedule);

      // Generate initial calendar events if enabled
      if (newSchedule.generateCalendarEvents) {
        await this.generateCalendarEventsForSchedule(newSchedule, medicationResult.data);
      }

      return { success: true, data: newSchedule };
    } catch (error) {
      console.error('Error creating medication schedule:', error);
      return { success: false, error: 'Failed to create medication schedule' };
    }
  }

  // Get medication schedules for a patient
  async getMedicationSchedulesByPatientId(patientId: string): Promise<ApiResponse<MedicationSchedule[]>> {
    try {
      const query = await this.medicationSchedulesCollection
        .where('patientId', '==', patientId)
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .get();

      const schedules = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicationSchedule));

      return { success: true, data: schedules };
    } catch (error) {
      console.error('Error getting medication schedules:', error);
      return { success: false, error: 'Failed to retrieve medication schedules' };
    }
  }

  // Get medication schedules for a specific medication
  async getMedicationSchedulesByMedicationId(medicationId: string): Promise<ApiResponse<MedicationSchedule[]>> {
    try {
      const query = await this.medicationSchedulesCollection
        .where('medicationId', '==', medicationId)
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .get();

      const schedules = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicationSchedule));

      return { success: true, data: schedules };
    } catch (error) {
      console.error('Error getting medication schedules by medication ID:', error);
      return { success: false, error: 'Failed to retrieve medication schedules' };
    }
  }

  // Update a medication schedule
  async updateMedicationSchedule(
    scheduleId: string, 
    updates: Partial<MedicationSchedule>
  ): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const scheduleDoc = await this.medicationSchedulesCollection.doc(scheduleId).get();
      
      if (!scheduleDoc.exists) {
        return { success: false, error: 'Medication schedule not found' };
      }

      const currentSchedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as MedicationSchedule;
      
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await this.medicationSchedulesCollection.doc(scheduleId).update(updateData);

      // If schedule timing changed and calendar events are enabled, regenerate events
      if (updates.times || updates.frequency || updates.startDate || updates.endDate) {
        const medicationResult = await medicationService.getMedicationById(currentSchedule.medicationId);
        if (medicationResult.success && medicationResult.data && currentSchedule.generateCalendarEvents) {
          await this.regenerateCalendarEventsForSchedule(currentSchedule, medicationResult.data);
        }
      }

      const updatedDoc = await this.medicationSchedulesCollection.doc(scheduleId).get();
      const updatedSchedule = { id: updatedDoc.id, ...updatedDoc.data() } as MedicationSchedule;

      return { success: true, data: updatedSchedule };
    } catch (error) {
      console.error('Error updating medication schedule:', error);
      return { success: false, error: 'Failed to update medication schedule' };
    }
  }

  // ===== CALENDAR EVENT GENERATION =====

  // Generate calendar events for a medication schedule
  async generateCalendarEventsForSchedule(
    schedule: MedicationSchedule, 
    medication: Medication
  ): Promise<ApiResponse<void>> {
    try {
      const now = new Date();
      const startDate = new Date(Math.max(schedule.startDate.getTime(), now.getTime()));
      const endDate = schedule.endDate || new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days default
      
      // Generate events for the next period (up to 30 days ahead)
      const generateUntil = new Date(Math.min(
        endDate.getTime(),
        now.getTime() + (30 * 24 * 60 * 60 * 1000)
      ));

      const events = this.calculateMedicationEvents(schedule, medication, startDate, generateUntil);
      
      // Create calendar events and medication calendar event records
      for (const eventData of events) {
        // Create the medical calendar event
        const calendarEventResult = await calendarService.createMedicalEvent(eventData.medicalEvent);
        
        if (calendarEventResult.success && calendarEventResult.data) {
          // Create the medication calendar event link
          const medicationEventData: NewMedicationCalendarEvent = {
            medicationId: schedule.medicationId,
            medicationScheduleId: schedule.id,
            medicalEventId: calendarEventResult.data.id,
            patientId: schedule.patientId,
            medicationName: medication.name,
            dosageAmount: schedule.dosageAmount,
            instructions: schedule.instructions,
            scheduledDateTime: eventData.scheduledDateTime,
            status: 'scheduled',
            isOnTime: true
          };

          await this.createMedicationCalendarEvent(medicationEventData);
        }
      }

      // Update the schedule's last generated date
      await this.medicationSchedulesCollection.doc(schedule.id).update({
        lastGeneratedDate: generateUntil,
        updatedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Error generating calendar events for schedule:', error);
      return { success: false, error: 'Failed to generate calendar events' };
    }
  }

  // Calculate medication events for a given time period
  private calculateMedicationEvents(
    schedule: MedicationSchedule,
    medication: Medication,
    startDate: Date,
    endDate: Date
  ): Array<{ medicalEvent: NewMedicalEvent; scheduledDateTime: Date }> {
    const events: Array<{ medicalEvent: NewMedicalEvent; scheduledDateTime: Date }> = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayEvents = this.getEventsForDay(schedule, medication, currentDate);
      events.push(...dayEvents);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return events;
  }

  // Get medication events for a specific day
  private getEventsForDay(
    schedule: MedicationSchedule,
    medication: Medication,
    date: Date
  ): Array<{ medicalEvent: NewMedicalEvent; scheduledDateTime: Date }> {
    const events: Array<{ medicalEvent: NewMedicalEvent; scheduledDateTime: Date }> = [];
    
    // Check if this day should have medication events based on frequency
    if (!this.shouldGenerateForDay(schedule, date)) {
      return events;
    }

    // Generate events for each scheduled time
    for (const timeStr of schedule.times) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const eventDateTime = new Date(date);
      eventDateTime.setHours(hours, minutes, 0, 0);

      // Skip if the event time has already passed
      if (eventDateTime <= new Date()) {
        continue;
      }

      const medicalEvent: NewMedicalEvent = {
        patientId: schedule.patientId,
        title: `${medication.name} - ${schedule.dosageAmount}`,
        description: `Take ${schedule.dosageAmount} of ${medication.name}${schedule.instructions ? `\n\nInstructions: ${schedule.instructions}` : ''}`,
        eventType: 'medication_reminder',
        priority: medication.isPRN ? 'medium' : 'high',
        status: 'scheduled',
        startDateTime: eventDateTime,
        endDateTime: new Date(eventDateTime.getTime() + (15 * 60 * 1000)), // 15 minutes duration
        duration: 15,
        isAllDay: false,
        requiresTransportation: false,
        responsibilityStatus: 'unassigned',
        isRecurring: false,
        reminders: schedule.reminderMinutesBefore.map((minutes, index) => ({
          id: `reminder_${Date.now()}_${index}`,
          type: 'push' as const,
          minutesBefore: minutes,
          isActive: true
        })),
        medications: [medication.name],
        specialInstructions: schedule.instructions,
        tags: ['medication', 'reminder', medication.name.toLowerCase()],
        createdBy: schedule.patientId
      };

      events.push({
        medicalEvent,
        scheduledDateTime: eventDateTime
      });
    }

    return events;
  }

  // Check if medication should be taken on a specific day
  private shouldGenerateForDay(schedule: MedicationSchedule, date: Date): boolean {
    const dayOfWeek = date.getDay(); // 0 = Sunday
    const dayOfMonth = date.getDate();

    switch (schedule.frequency) {
      case 'daily':
      case 'twice_daily':
      case 'three_times_daily':
      case 'four_times_daily':
        return true;
      
      case 'weekly':
        return schedule.daysOfWeek?.includes(dayOfWeek) || false;
      
      case 'monthly':
        return schedule.dayOfMonth === dayOfMonth;
      
      case 'as_needed':
        return false; // PRN medications don't generate automatic events
      
      default:
        return false;
    }
  }

  // ===== MEDICATION CALENDAR EVENT MANAGEMENT =====

  // Create a medication calendar event
  async createMedicationCalendarEvent(eventData: NewMedicationCalendarEvent): Promise<ApiResponse<MedicationCalendarEvent>> {
    try {
      const eventRef = this.medicationCalendarEventsCollection.doc();
      const newEvent: MedicationCalendarEvent = {
        id: eventRef.id,
        ...eventData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await eventRef.set(newEvent);
      return { success: true, data: newEvent };
    } catch (error) {
      console.error('Error creating medication calendar event:', error);
      return { success: false, error: 'Failed to create medication calendar event' };
    }
  }

  // Mark medication as taken
  async markMedicationTaken(
    medicationEventId: string,
    takenBy: string,
    takenAt?: Date,
    notes?: string
  ): Promise<ApiResponse<MedicationCalendarEvent>> {
    try {
      const eventDoc = await this.medicationCalendarEventsCollection.doc(medicationEventId).get();
      
      if (!eventDoc.exists) {
        return { success: false, error: 'Medication calendar event not found' };
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() } as MedicationCalendarEvent;
      const actualTakenTime = takenAt || new Date();
      const scheduledTime = new Date(eventData.scheduledDateTime);
      
      // Calculate if taken on time (within 30 minutes of scheduled time)
      const timeDifference = Math.abs(actualTakenTime.getTime() - scheduledTime.getTime());
      const minutesLate = Math.max(0, (actualTakenTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
      const isOnTime = timeDifference <= (30 * 60 * 1000); // 30 minutes tolerance

      const updateData = {
        status: 'taken' as const,
        actualTakenDateTime: actualTakenTime,
        takenBy,
        notes,
        isOnTime,
        minutesLate: minutesLate > 0 ? Math.round(minutesLate) : undefined,
        updatedAt: new Date()
      };

      await this.medicationCalendarEventsCollection.doc(medicationEventId).update(updateData);

      // Update the corresponding medical calendar event status
      await calendarService.updateMedicalEvent(eventData.medicalEventId, {
        status: 'completed'
      }, takenBy);

      const updatedDoc = await this.medicationCalendarEventsCollection.doc(medicationEventId).get();
      const updatedEvent = { id: updatedDoc.id, ...updatedDoc.data() } as MedicationCalendarEvent;

      return { success: true, data: updatedEvent };
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      return { success: false, error: 'Failed to mark medication as taken' };
    }
  }

  // Get medication calendar events for a patient
  async getMedicationCalendarEventsByPatientId(
    patientId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      medicationId?: string;
      status?: string;
    } = {}
  ): Promise<ApiResponse<MedicationCalendarEvent[]>> {
    try {
      let query = this.medicationCalendarEventsCollection.where('patientId', '==', patientId);

      if (options.startDate) {
        query = query.where('scheduledDateTime', '>=', options.startDate);
      }
      if (options.endDate) {
        query = query.where('scheduledDateTime', '<=', options.endDate);
      }
      if (options.medicationId) {
        query = query.where('medicationId', '==', options.medicationId);
      }
      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      query = query.orderBy('scheduledDateTime', 'desc');
      const snapshot = await query.get();

      const events = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as MedicationCalendarEvent));

      return { success: true, data: events };
    } catch (error) {
      console.error('Error getting medication calendar events:', error);
      return { success: false, error: 'Failed to retrieve medication calendar events' };
    }
  }

  // ===== ADHERENCE TRACKING =====

  // Calculate medication adherence for a patient
  async calculateMedicationAdherence(
    patientId: string,
    medicationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ApiResponse<MedicationAdherence[]>> {
    try {
      const start = startDate || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
      const end = endDate || new Date();

      let query = this.medicationCalendarEventsCollection
        .where('patientId', '==', patientId)
        .where('scheduledDateTime', '>=', start)
        .where('scheduledDateTime', '<=', end);

      if (medicationId) {
        query = query.where('medicationId', '==', medicationId);
      }

      const snapshot = await query.get();
      const events = snapshot.docs.map((doc: any) => doc.data() as MedicationCalendarEvent);

      // Group events by medication
      const eventsByMedication = events.reduce((acc: Record<string, MedicationCalendarEvent[]>, event: MedicationCalendarEvent) => {
        if (!acc[event.medicationId]) {
          acc[event.medicationId] = [];
        }
        acc[event.medicationId].push(event);
        return acc;
      }, {} as Record<string, MedicationCalendarEvent[]>);

      const adherenceResults: MedicationAdherence[] = [];

      for (const [medId, medEvents] of Object.entries(eventsByMedication)) {
        const adherence = this.calculateAdherenceMetrics(medId, patientId, medEvents as MedicationCalendarEvent[], start, end);
        adherenceResults.push(adherence);
      }

      return { success: true, data: adherenceResults };
    } catch (error) {
      console.error('Error calculating medication adherence:', error);
      return { success: false, error: 'Failed to calculate medication adherence' };
    }
  }

  // Calculate adherence metrics for a specific medication
  private calculateAdherenceMetrics(
    medicationId: string,
    patientId: string,
    events: MedicationCalendarEvent[],
    startDate: Date,
    endDate: Date
  ): MedicationAdherence {
    const totalScheduled = events.length;
    const taken = events.filter(e => e.status === 'taken').length;
    const missed = events.filter(e => e.status === 'missed').length;
    const skipped = events.filter(e => e.status === 'skipped').length;
    const late = events.filter(e => e.status === 'taken' && !e.isOnTime).length;
    const onTime = events.filter(e => e.status === 'taken' && e.isOnTime).length;

    const adherenceRate = totalScheduled > 0 ? ((taken) / totalScheduled) * 100 : 0;
    const onTimeRate = totalScheduled > 0 ? (onTime / totalScheduled) * 100 : 0;
    const missedRate = totalScheduled > 0 ? (missed / totalScheduled) * 100 : 0;

    // Calculate timing metrics
    const lateEvents = events.filter(e => e.minutesLate && e.minutesLate > 0);
    const averageDelay = lateEvents.length > 0 
      ? lateEvents.reduce((sum, e) => sum + (e.minutesLate || 0), 0) / lateEvents.length 
      : 0;
    const longestDelay = lateEvents.length > 0 
      ? Math.max(...lateEvents.map(e => e.minutesLate || 0)) 
      : 0;

    return {
      medicationId,
      patientId,
      startDate,
      endDate,
      totalScheduledDoses: totalScheduled,
      takenDoses: taken,
      missedDoses: missed,
      skippedDoses: skipped,
      lateDoses: late,
      adherenceRate: Math.round(adherenceRate * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      missedRate: Math.round(missedRate * 100) / 100,
      averageDelayMinutes: Math.round(averageDelay),
      longestDelayMinutes: Math.round(longestDelay),
      calculatedAt: new Date()
    };
  }

  // ===== UTILITY METHODS =====

  // Regenerate calendar events for a schedule (when schedule changes)
  private async regenerateCalendarEventsForSchedule(
    schedule: MedicationSchedule,
    medication: Medication
  ): Promise<void> {
    try {
      // Delete future medication calendar events for this schedule
      const futureEventsQuery = await this.medicationCalendarEventsCollection
        .where('medicationScheduleId', '==', schedule.id)
        .where('scheduledDateTime', '>', new Date())
        .get();

      const batch = adminDb.batch();
      
      // Delete medication calendar events and their corresponding medical events
      for (const doc of futureEventsQuery.docs) {
        const eventData = doc.data() as MedicationCalendarEvent;
        
        // Delete the medical calendar event
        await calendarService.deleteMedicalEvent(eventData.medicalEventId, schedule.patientId);
        
        // Delete the medication calendar event
        batch.delete(doc.ref);
      }
      
      await batch.commit();

      // Generate new events
      await this.generateCalendarEventsForSchedule(schedule, medication);
    } catch (error) {
      console.error('Error regenerating calendar events:', error);
    }
  }

  // Pause a medication schedule
  async pauseMedicationSchedule(
    scheduleId: string,
    pausedUntil?: Date
  ): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const updateData = {
        isPaused: true,
        pausedUntil,
        updatedAt: new Date()
      };

      await this.medicationSchedulesCollection.doc(scheduleId).update(updateData);

      const updatedDoc = await this.medicationSchedulesCollection.doc(scheduleId).get();
      const updatedSchedule = { id: updatedDoc.id, ...updatedDoc.data() } as MedicationSchedule;

      return { success: true, data: updatedSchedule };
    } catch (error) {
      console.error('Error pausing medication schedule:', error);
      return { success: false, error: 'Failed to pause medication schedule' };
    }
  }

  // Resume a medication schedule
  async resumeMedicationSchedule(scheduleId: string): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const updateData = {
        isPaused: false,
        pausedUntil: null,
        updatedAt: new Date()
      };

      await this.medicationSchedulesCollection.doc(scheduleId).update(updateData);

      const updatedDoc = await this.medicationSchedulesCollection.doc(scheduleId).get();
      const updatedSchedule = { id: updatedDoc.id, ...updatedDoc.data() } as MedicationSchedule;

      // Regenerate calendar events if needed
      if (updatedSchedule.generateCalendarEvents) {
        const medicationResult = await medicationService.getMedicationById(updatedSchedule.medicationId);
        if (medicationResult.success && medicationResult.data) {
          await this.generateCalendarEventsForSchedule(updatedSchedule, medicationResult.data);
        }
      }

      return { success: true, data: updatedSchedule };
    } catch (error) {
      console.error('Error resuming medication schedule:', error);
      return { success: false, error: 'Failed to resume medication schedule' };
    }
  }
}

// Export singleton instance
export const medicationCalendarService = new MedicationCalendarService();