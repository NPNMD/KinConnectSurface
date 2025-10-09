/**
 * MIGRATED TO UNIFIED SYSTEM
 * Now uses medication_events collection instead of legacy medication_calendar_events
 * This service detects missed medications from the unified event sourcing system
 */

import * as admin from 'firebase-admin';
import { GracePeriodEngine, GracePeriodCalculation } from './gracePeriodEngine';
import { MedicationMonitoringService, MonitoringMetrics } from './medicationMonitoringService';

export interface MissedMedicationDetectionResult {
  processed: number;
  missed: number;
  errors: string[];
  detectionTime: Date;
  batchResults?: Array<{
    eventId: string;
    medicationName: string;
    patientId: string;
    gracePeriodMinutes: number;
    gracePeriodEnd: Date;
    appliedRules: string[];
  }>;
}

export class MissedMedicationDetector {
  private firestore = admin.firestore();
  private gracePeriodEngine = new GracePeriodEngine();
  private monitoringService = new MedicationMonitoringService();

  /**
   * Main method to detect missed medications across all patients
   */
  async detectMissedMedications(): Promise<MissedMedicationDetectionResult> {
    const startTime = Date.now();
    const now = new Date();
    const results: MissedMedicationDetectionResult = {
      processed: 0,
      missed: 0,
      errors: [],
      detectionTime: now,
      batchResults: []
    };

    try {
      console.log('🔍 Starting missed medication detection sweep...');
      
      // Query for scheduled events that might be overdue
      // Look back 24 hours to catch any that might have been missed
      const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      const queryStartTime = Date.now();
      // Query unified medication_events collection for scheduled doses
      const overdueQuery = await this.firestore.collection('medication_events')
        .where('eventType', '==', 'dose_scheduled')
        .where('timing.scheduledFor', '<=', admin.firestore.Timestamp.fromDate(now))
        .where('timing.scheduledFor', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
        .limit(500) // Process in batches to avoid timeouts
        .get();
      const queryTime = Date.now() - queryStartTime;

      console.log(`🔍 Found ${overdueQuery.docs.length} potentially overdue events (query took ${queryTime}ms)`);

      // Process events in batches
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < overdueQuery.docs.length; i += batchSize) {
        batches.push(overdueQuery.docs.slice(i, i + batchSize));
      }

      const updateStartTime = Date.now();
      for (const batch of batches) {
        await this.processBatch(batch, now, results);
      }
      const updateTime = Date.now() - updateStartTime;

      const totalExecutionTime = Date.now() - startTime;
      
      console.log(`✅ Missed medication detection completed:`, {
        processed: results.processed,
        missed: results.missed,
        errors: results.errors.length,
        duration: `${totalExecutionTime}ms`,
        queryTime: `${queryTime}ms`,
        updateTime: `${updateTime}ms`
      });
      
      // Log monitoring metrics
      const metrics: MonitoringMetrics = {
        timestamp: now,
        functionName: 'detectMissedMedications',
        executionTime: totalExecutionTime,
        eventsProcessed: results.processed,
        eventsMarkedMissed: results.missed,
        errorCount: results.errors.length,
        errors: results.errors,
        performanceMetrics: {
          averageProcessingTimePerEvent: results.processed > 0 ? totalExecutionTime / results.processed : 0,
          batchSize,
          totalBatches: batches.length,
          queryTime,
          updateTime
        }
      };
      
      await this.monitoringService.logDetectionMetrics(metrics);
      
      // Create alerts for concerning patterns
      if (results.errors.length > 0) {
        await this.monitoringService.createSystemAlert(
          'error',
          results.errors.length > results.processed * 0.1 ? 'critical' : 'warning',
          `Missed medication detection encountered ${results.errors.length} errors`,
          { errors: results.errors.slice(0, 5) } // First 5 errors
        );
      }
      
      if (totalExecutionTime > 300000) { // >5 minutes
        await this.monitoringService.createSystemAlert(
          'performance',
          'warning',
          `Missed medication detection took ${Math.round(totalExecutionTime / 1000)}s to complete`,
          { executionTime: totalExecutionTime, eventsProcessed: results.processed }
        );
      }
      
      return results;

    } catch (error) {
      console.error('❌ Error in missed medication detection:', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      // Log critical system error
      await this.monitoringService.createSystemAlert(
        'error',
        'critical',
        'Missed medication detection failed completely',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      return results;
    }
  }

  /**
   * Detect missed medications for a specific patient (for manual triggers)
   */
  async detectMissedMedicationsForPatient(patientId: string): Promise<MissedMedicationDetectionResult> {
    const now = new Date();
    const results: MissedMedicationDetectionResult = {
      processed: 0,
      missed: 0,
      errors: [],
      detectionTime: now,
      batchResults: []
    };

    try {
      console.log('🔍 Starting missed medication detection for patient:', patientId);
      
      // Look back 24 hours for this specific patient
      const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      // Query unified medication_events collection for this patient's scheduled doses
      const overdueQuery = await this.firestore.collection('medication_events')
        .where('patientId', '==', patientId)
        .where('eventType', '==', 'dose_scheduled')
        .where('timing.scheduledFor', '<=', admin.firestore.Timestamp.fromDate(now))
        .where('timing.scheduledFor', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
        .get();

      console.log(`🔍 Found ${overdueQuery.docs.length} potentially overdue events for patient ${patientId}`);

      if (overdueQuery.docs.length > 0) {
        await this.processBatch(overdueQuery.docs, now, results);
      }

      return results;

    } catch (error) {
      console.error('❌ Error in patient-specific missed medication detection:', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return results;
    }
  }

  /**
   * Process a batch of potentially overdue events
   */
  private async processBatch(
    docs: admin.firestore.QueryDocumentSnapshot[],
    currentTime: Date,
    results: MissedMedicationDetectionResult
  ): Promise<void> {
    const batch = this.firestore.batch();
    const notificationQueue = [];

    for (const doc of docs) {
      try {
        const event = doc.data();
        results.processed++;

        // Check if event already has grace period end time from unified system
        const gracePeriodEnd = event.timing?.gracePeriodEnd?.toDate();
        
        if (!gracePeriodEnd) {
          console.warn(`⚠️ Event ${doc.id} missing grace period end time, skipping`);
          results.errors.push(`Event ${doc.id}: Missing grace period end time`);
          return;
        }

        // Check if grace period has expired
        if (currentTime > gracePeriodEnd) {
          // Create a dose_missed event in the unified system
          const missedEventId = `${event.commandId}_missed_${Date.now()}`;
          
          batch.set(this.firestore.collection('medication_events').doc(missedEventId), {
            id: missedEventId,
            commandId: event.commandId,
            patientId: event.patientId,
            eventType: 'dose_missed',
            eventData: {
              scheduledDateTime: event.timing?.scheduledFor,
              actionReason: 'automatic_detection',
              gracePeriodMinutes: event.eventData?.gracePeriodMinutes,
              gracePeriodEnd: event.timing?.gracePeriodEnd,
              appliedRules: event.eventData?.appliedRules || [],
              additionalData: {
                originalScheduledEventId: doc.id
              }
            },
            context: {
              medicationName: event.context?.medicationName || 'Unknown',
              scheduleId: event.context?.scheduleId,
              calendarEventId: event.context?.calendarEventId,
              triggerSource: 'system_detection'
            },
            timing: {
              eventTimestamp: admin.firestore.Timestamp.now(),
              scheduledFor: event.timing?.scheduledFor,
              gracePeriodEnd: event.timing?.gracePeriodEnd
            },
            metadata: {
              eventVersion: 1,
              createdAt: admin.firestore.Timestamp.now(),
              createdBy: 'system',
              correlationId: event.metadata?.correlationId || `corr_${Date.now()}`
            }
          });

          results.missed++;
          
          // Add to batch results for reporting
          results.batchResults?.push({
            eventId: doc.id,
            medicationName: event.context?.medicationName || 'Unknown',
            patientId: event.patientId,
            gracePeriodMinutes: event.eventData?.gracePeriodMinutes || 0,
            gracePeriodEnd: gracePeriodEnd,
            appliedRules: event.eventData?.appliedRules || []
          });
          
          // Queue for notification processing
          notificationQueue.push({
            eventId: doc.id,
            event,
            gracePeriodCalc: {
              gracePeriodMinutes: event.eventData?.gracePeriodMinutes || 0,
              gracePeriodEnd: gracePeriodEnd,
              appliedRules: event.eventData?.appliedRules || []
            }
          });

          console.log(`📋 Marked as missed: ${event.context?.medicationName} for patient ${event.patientId}`);
        }

      } catch (error) {
        console.error(`❌ Error processing event ${doc.id}:`, error);
        results.errors.push(`Event ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit batch updates
    let hasWrites = false;
    try {
      // Check if batch has any writes by attempting to commit
      // If there are no writes, commit will succeed but do nothing
      await batch.commit();
      hasWrites = true;
      console.log(`✅ Committed batch update for processed events`);
    } catch (error) {
      // If batch is empty, this might throw an error, but that's okay
      if (error instanceof Error && error.message.includes('empty')) {
        console.log('ℹ️ No batch updates to commit');
      } else {
        console.error('❌ Error committing batch:', error);
        throw error;
      }
    }

    // Process notifications
    if (notificationQueue.length > 0) {
      await this.queueMissedMedicationNotifications(notificationQueue);
    }
  }

  /**
   * Queue notifications for missed medications
   */
  private async queueMissedMedicationNotifications(missedEvents: any[]): Promise<void> {
    try {
      // Group by patient for efficient notification processing
      const patientGroups = new Map<string, any[]>();
      
      for (const missedEvent of missedEvents) {
        const patientId = missedEvent.event.patientId;
        if (!patientGroups.has(patientId)) {
          patientGroups.set(patientId, []);
        }
        patientGroups.get(patientId)!.push(missedEvent);
      }

      // Process notifications for each patient
      for (const [patientId, events] of patientGroups) {
        await this.processPatientMissedNotifications(patientId, events);
      }
    } catch (error) {
      console.error('❌ Error queueing missed medication notifications:', error);
    }
  }

  /**
   * Process missed medication notifications for a specific patient
   */
  private async processPatientMissedNotifications(patientId: string, missedEvents: any[]): Promise<void> {
    try {
      // Get family notification rules
      const notificationRules = await this.getFamilyNotificationRules(patientId);
      
      for (const rule of notificationRules) {
        // Check if this rule should trigger for these missed events
        const shouldNotify = await this.shouldTriggerNotification(rule, missedEvents);
        
        if (shouldNotify) {
          await this.sendMissedMedicationNotification(rule, missedEvents);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing notifications for patient ${patientId}:`, error);
    }
  }

  /**
   * Get family notification rules for a patient
   */
  private async getFamilyNotificationRules(patientId: string): Promise<any[]> {
    try {
      const rulesQuery = await this.firestore.collection('family_notification_rules')
        .where('patientId', '==', patientId)
        .where('isActive', '==', true)
        .get();
      
      return rulesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Error getting family notification rules:', error);
      return [];
    }
  }

  /**
   * Check if notification should be triggered based on rules
   */
  private async shouldTriggerNotification(rule: any, missedEvents: any[]): Promise<boolean> {
    try {
      // Check immediate notification setting
      if (rule.triggers?.missedMedication?.immediateNotification) {
        return true;
      }

      // Check consecutive missed threshold
      if (rule.triggers?.missedMedication?.consecutiveThreshold > 1) {
        // Check for consecutive misses for each medication
        for (const missedEvent of missedEvents) {
          const consecutiveMisses = await this.getConsecutiveMissedCount(
            missedEvent.event.medicationId,
            missedEvent.event.patientId
          );
          
          if (consecutiveMisses >= rule.triggers.missedMedication.consecutiveThreshold) {
            return true;
          }
        }
      }

      // Check critical medications only setting
      if (rule.triggers?.missedMedication?.criticalMedicationsOnly) {
        const hasCriticalMissed = await Promise.all(
          missedEvents.map(async (missedEvent) => {
            const medicationType = await this.gracePeriodEngine.getMedicationType(missedEvent.event.medicationId);
            return medicationType === 'critical';
          })
        );
        
        return hasCriticalMissed.some(isCritical => isCritical);
      }

      return false;
    } catch (error) {
      console.warn('Error checking notification trigger:', error);
      return false;
    }
  }

  /**
   * Get consecutive missed count for a medication
   */
  private async getConsecutiveMissedCount(medicationId: string, patientId: string): Promise<number> {
    try {
      // Get recent events for this medication from unified system
      const recentEvents = await this.firestore.collection('medication_events')
        .where('commandId', '==', medicationId)
        .where('patientId', '==', patientId)
        .where('eventType', 'in', ['dose_scheduled', 'dose_taken', 'dose_missed', 'dose_skipped'])
        .orderBy('timing.scheduledFor', 'desc')
        .limit(10)
        .get();

      let consecutiveCount = 0;
      
      for (const doc of recentEvents.docs) {
        const event = doc.data();
        
        if (event.eventType === 'dose_missed') {
          consecutiveCount++;
        } else if (event.eventType === 'dose_taken' || event.eventType === 'dose_skipped') {
          // Break the consecutive streak
          break;
        }
        // Continue counting for 'dose_scheduled' events (they might become missed)
      }

      return consecutiveCount;
    } catch (error) {
      console.warn('Error getting consecutive missed count:', error);
      return 0;
    }
  }

  /**
   * Send missed medication notification
   */
  private async sendMissedMedicationNotification(rule: any, missedEvents: any[]): Promise<void> {
    try {
      // Create notification record
      const notification = {
        patientId: rule.patientId,
        familyMemberId: rule.familyMemberId,
        notificationType: 'missed_medication',
        missedEvents: missedEvents.map(me => ({
          eventId: me.eventId,
          medicationName: me.event.medicationName,
          scheduledDateTime: me.event.scheduledDateTime,
          gracePeriodEnd: me.gracePeriodCalc.gracePeriodEnd
        })),
        severity: this.calculateNotificationSeverity(missedEvents),
        status: 'pending',
        scheduledFor: admin.firestore.Timestamp.now(),
        method: rule.preferences?.methods?.[0] || 'email',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      await this.firestore.collection('family_notification_queue').add(notification);
      console.log(`📨 Queued missed medication notification for patient ${rule.patientId}`);
    } catch (error) {
      console.error('❌ Error sending missed medication notification:', error);
    }
  }

  /**
   * Calculate notification severity based on missed events
   */
  private calculateNotificationSeverity(missedEvents: any[]): 'info' | 'warning' | 'critical' {
    // Check if any critical medications were missed
    const hasCriticalMeds = missedEvents.some(me => 
      me.gracePeriodCalc?.appliedRules?.includes('type_critical')
    );
    
    if (hasCriticalMeds) {
      return 'critical';
    }
    
    // Check if multiple medications were missed
    if (missedEvents.length >= 3) {
      return 'warning';
    }
    
    return 'info';
  }

  /**
   * Mark a medication event as missed manually
   */
  async markEventAsMissed(
    eventId: string, 
    userId: string, 
    reason: 'manual_mark' | 'family_report' = 'manual_mark'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Note: Manual marking should use the unified MedicationOrchestrator instead
      // This method is kept for backward compatibility but should be deprecated
      const eventDoc = await this.firestore.collection('medication_events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        return { success: false, error: 'Event not found' };
      }

      const eventData = eventDoc.data();
      
      // Verify access permissions
      if (eventData?.patientId !== userId) {
        // Check family access
        const familyAccess = await this.firestore.collection('family_calendar_access')
          .where('familyMemberId', '==', userId)
          .where('patientId', '==', eventData?.patientId)
          .where('status', '==', 'active')
          .get();
        
        if (familyAccess.empty) {
          return { success: false, error: 'Access denied' };
        }
      }

      // Calculate grace period for audit trail
      const gracePeriodCalc = await this.gracePeriodEngine.calculateGracePeriod(
        eventData,
        eventData?.patientId,
        new Date()
      );

      // Update event status
      await eventDoc.ref.update({
        status: 'missed',
        missedAt: admin.firestore.Timestamp.now(),
        missedReason: reason,
        gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
        gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodCalc.gracePeriodEnd),
        gracePeriodRules: gracePeriodCalc.appliedRules,
        updatedAt: admin.firestore.Timestamp.now()
      });

      console.log(`✅ Manually marked event as missed: ${eventId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error marking event as missed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get missed medications for a patient within a date range
   */
  async getMissedMedications(
    patientId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<any[]> {
    try {
      // Query unified medication_events for missed doses
      let query = this.firestore.collection('medication_events')
        .where('patientId', '==', patientId)
        .where('eventType', '==', 'dose_missed');
      
      // Add date filters if provided
      if (startDate) {
        query = query.where('timing.scheduledFor', '>=', admin.firestore.Timestamp.fromDate(startDate));
      }
      if (endDate) {
        query = query.where('timing.scheduledFor', '<=', admin.firestore.Timestamp.fromDate(endDate));
      }
      
      const missedSnapshot = await query
        .orderBy('timing.scheduledFor', 'desc')
        .limit(limit)
        .get();
      
      return missedSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          scheduledDateTime: data.timing?.scheduledFor?.toDate(),
          missedAt: data.timing?.eventTimestamp?.toDate(),
          gracePeriodEnd: data.timing?.gracePeriodEnd?.toDate(),
          medicationName: data.context?.medicationName,
          createdAt: data.metadata?.createdAt?.toDate(),
          updatedAt: data.metadata?.createdAt?.toDate()
        };
      });
    } catch (error) {
      console.error('❌ Error getting missed medications:', error);
      return [];
    }
  }

  /**
   * Get missed medication statistics for a patient
   */
  async getMissedMedicationStats(
    patientId: string,
    days: number = 30
  ): Promise<{
    totalMissed: number;
    missedByMedication: Array<{ medicationId: string; medicationName: string; count: number }>;
    missedByTimeSlot: { morning: number; noon: number; evening: number; bedtime: number };
    averageGracePeriod: number;
    mostCommonReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const missedEvents = await this.getMissedMedications(patientId, startDate, endDate, 1000);
      
      // Calculate statistics
      const medicationCounts = new Map<string, { name: string; count: number }>();
      const timeSlotCounts = { morning: 0, noon: 0, evening: 0, bedtime: 0 };
      const reasonCounts = new Map<string, number>();
      let totalGracePeriod = 0;
      let gracePeriodCount = 0;

      for (const event of missedEvents) {
        // Count by medication
        const medKey = event.commandId || 'unknown';
        const medName = event.medicationName || 'Unknown';
        if (medicationCounts.has(medKey)) {
          medicationCounts.get(medKey)!.count++;
        } else {
          medicationCounts.set(medKey, { name: medName, count: 1 });
        }

        // Count by time slot (simplified classification)
        const hour = event.scheduledDateTime?.getHours() || 0;
        if (hour >= 6 && hour < 11) timeSlotCounts.morning++;
        else if (hour >= 11 && hour < 17) timeSlotCounts.noon++;
        else if (hour >= 17 && hour < 21) timeSlotCounts.evening++;
        else timeSlotCounts.bedtime++;

        // Count reasons
        const reason = event.eventData?.actionReason || 'automatic_detection';
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);

        // Calculate average grace period
        const gracePeriodMinutes = event.eventData?.gracePeriodMinutes;
        if (gracePeriodMinutes) {
          totalGracePeriod += gracePeriodMinutes;
          gracePeriodCount++;
        }
      }

      return {
        totalMissed: missedEvents.length,
        missedByMedication: Array.from(medicationCounts.entries()).map(([id, data]) => ({
          medicationId: id,
          medicationName: data.name,
          count: data.count
        })),
        missedByTimeSlot: timeSlotCounts,
        averageGracePeriod: gracePeriodCount > 0 ? Math.round(totalGracePeriod / gracePeriodCount) : 0,
        mostCommonReasons: Array.from(reasonCounts.entries())
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      };
    } catch (error) {
      console.error('❌ Error calculating missed medication stats:', error);
      return {
        totalMissed: 0,
        missedByMedication: [],
        missedByTimeSlot: { morning: 0, noon: 0, evening: 0, bedtime: 0 },
        averageGracePeriod: 0,
        mostCommonReasons: []
      };
    }
  }
}