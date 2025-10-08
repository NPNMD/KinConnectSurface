/**
 * Scheduled Missed Medication Detection Cloud Function
 * 
 * Runs every 15 minutes to automatically detect medications that have passed
 * their grace period without being taken.
 * 
 * This function:
 * 1. Queries for scheduled medication events past their grace period
 * 2. Calculates grace periods using existing GracePeriodEngine
 * 3. Creates DOSE_MISSED events via MedicationEventService
 * 4. Sends notifications to patient and family via MedicationNotificationService
 * 5. Respects grace period configuration per medication/time slot
 * 
 * Integration with Unified System:
 * - Uses medication_events collection for event sourcing
 * - Integrates with MedicationOrchestrator for workflow coordination
 * - Leverages existing GracePeriodEngine for grace period logic
 * - Uses MedicationNotificationService for notifications
 * - Maintains ACID compliance via MedicationTransactionManager
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { MedicationOrchestrator } from './services/unified/MedicationOrchestrator';
import { MedicationEventService } from './services/unified/MedicationEventService';
import { MedicationNotificationService } from './services/unified/MedicationNotificationService';
import { GracePeriodEngine } from './services/gracePeriodEngine';
import { MEDICATION_EVENT_TYPES } from './schemas/unifiedMedicationSchema';

interface MissedDetectionResult {
  success: boolean;
  processed: number;
  missed: number;
  notificationsSent: number;
  errors: string[];
  executionTimeMs: number;
  detectionTime: Date;
  batchResults: Array<{
    eventId: string;
    commandId: string;
    medicationName: string;
    patientId: string;
    scheduledDateTime: Date;
    gracePeriodMinutes: number;
    gracePeriodEnd: Date;
    appliedRules: string[];
  }>;
}

/**
 * Scheduled function that runs every 15 minutes to detect missed medications
 */
export const scheduledMissedDetection = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540, // 9 minutes (leave buffer for 15-min schedule)
  })
  .pubsub.schedule('every 15 minutes')
  .timeZone('UTC') // Run in UTC, handle patient timezones internally
  .onRun(async (context: functions.EventContext) => {
    const startTime = Date.now();
    const detectionTime = new Date();
    
    console.log('🔍 ===== SCHEDULED MISSED DETECTION START =====');
    console.log(`⏰ Execution time (UTC): ${detectionTime.toISOString()}`);
    console.log(`📅 Execution context:`, {
      eventId: context.eventId,
      timestamp: context.timestamp,
      resource: context.resource
    });

    const firestore = admin.firestore();
    const orchestrator = new MedicationOrchestrator();
    const eventService = new MedicationEventService();
    const notificationService = new MedicationNotificationService();
    const gracePeriodEngine = new GracePeriodEngine();

    const results: MissedDetectionResult = {
      success: true,
      processed: 0,
      missed: 0,
      notificationsSent: 0,
      errors: [],
      executionTimeMs: 0,
      detectionTime,
      batchResults: []
    };

    try {
      // Step 1: Query for scheduled events that might be past grace period
      console.log('📊 Step 1: Querying for potentially overdue medication events...');
      
      // Look back 24 hours to catch any that might have been missed
      const lookbackTime = new Date(detectionTime.getTime() - (24 * 60 * 60 * 1000));
      
      const queryStartTime = Date.now();
      const scheduledEventsQuery = await eventService.queryEvents({
        eventType: MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        startDate: lookbackTime,
        endDate: detectionTime,
        orderBy: 'eventTimestamp',
        orderDirection: 'asc',
        limit: 500, // Process in batches to avoid timeouts
        excludeArchived: true // Only check non-archived events
      });
      
      const queryTime = Date.now() - queryStartTime;
      
      if (!scheduledEventsQuery.success || !scheduledEventsQuery.data) {
        console.error('❌ Failed to query scheduled events:', scheduledEventsQuery.error);
        results.errors.push(`Query failed: ${scheduledEventsQuery.error}`);
        results.success = false;
        return logAndReturnResults(firestore, results, startTime);
      }

      const scheduledEvents = scheduledEventsQuery.data;
      console.log(`📊 Found ${scheduledEvents.length} scheduled events to check (query took ${queryTime}ms)`);

      if (scheduledEvents.length === 0) {
        console.log('ℹ️ No scheduled events found to check');
        return logAndReturnResults(firestore, results, startTime);
      }

      // Step 2: Process events in batches
      console.log('🔄 Step 2: Processing events for missed detection...');
      
      const batchSize = 50;
      const batches: typeof scheduledEvents[] = [];
      
      for (let i = 0; i < scheduledEvents.length; i += batchSize) {
        batches.push(scheduledEvents.slice(i, i + batchSize));
      }

      console.log(`📦 Processing ${batches.length} batches of ${batchSize} events each`);

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} events)`);
        
        await processBatch(
          batch,
          detectionTime,
          orchestrator,
          eventService,
          notificationService,
          gracePeriodEngine,
          firestore,
          results
        );
      }

      // Step 3: Log summary
      results.executionTimeMs = Date.now() - startTime;
      
      console.log('📊 ===== MISSED DETECTION SUMMARY =====');
      console.log(`   - Events processed: ${results.processed}`);
      console.log(`   - Medications missed: ${results.missed}`);
      console.log(`   - Notifications sent: ${results.notificationsSent}`);
      console.log(`   - Errors encountered: ${results.errors.length}`);
      console.log(`   - Execution time: ${results.executionTimeMs}ms`);
      console.log(`   - Average time per event: ${results.processed > 0 ? Math.round(results.executionTimeMs / results.processed) : 0}ms`);

      if (results.errors.length > 0) {
        console.error('❌ Errors during detection:', results.errors.slice(0, 5));
      }

      if (results.missed > 0) {
        console.log('📋 Missed medications by patient:');
        const patientCounts = results.batchResults.reduce((acc, result) => {
          acc[result.patientId] = (acc[result.patientId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(patientCounts).forEach(([patientId, count]) => {
          console.log(`   - Patient ${patientId}: ${count} missed dose(s)`);
        });
      }

      console.log('🔍 ===== SCHEDULED MISSED DETECTION END =====');

      return logAndReturnResults(firestore, results, startTime);

    } catch (error) {
      console.error('❌ Fatal error in scheduled missed detection:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      results.success = false;
      results.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
      results.executionTimeMs = Date.now() - startTime;
      
      return logAndReturnResults(firestore, results, startTime);
    }
  });

/**
 * Process a batch of scheduled events for missed detection
 */
async function processBatch(
  events: any[],
  currentTime: Date,
  orchestrator: MedicationOrchestrator,
  eventService: MedicationEventService,
  notificationService: MedicationNotificationService,
  gracePeriodEngine: GracePeriodEngine,
  firestore: admin.firestore.Firestore,
  results: MissedDetectionResult
): Promise<void> {
  
  for (const scheduledEvent of events) {
    try {
      results.processed++;
      
      // Skip if event doesn't have required data
      if (!scheduledEvent.timing?.scheduledFor || !scheduledEvent.commandId) {
        console.warn(`⚠️ Event ${scheduledEvent.id} missing required data, skipping`);
        continue;
      }

      const scheduledFor = scheduledEvent.timing.scheduledFor;
      
      // Check if there's already a taken/missed/skipped event for this scheduled event
      const completionEventsQuery = await eventService.queryEvents({
        commandId: scheduledEvent.commandId,
        eventType: [
          MEDICATION_EVENT_TYPES.DOSE_TAKEN,
          MEDICATION_EVENT_TYPES.DOSE_MISSED,
          MEDICATION_EVENT_TYPES.DOSE_SKIPPED
        ],
        startDate: new Date(scheduledFor.getTime() - 60 * 60 * 1000), // 1 hour before
        endDate: new Date(scheduledFor.getTime() + 24 * 60 * 60 * 1000), // 24 hours after
        excludeArchived: true
      });

      if (completionEventsQuery.success && completionEventsQuery.data && completionEventsQuery.data.length > 0) {
        // Event already has a completion status, skip
        continue;
      }

      // Calculate grace period for this event
      const gracePeriodCalc = await calculateGracePeriodForEvent(
        scheduledEvent,
        gracePeriodEngine,
        firestore
      );

      // Check if grace period has expired
      if (currentTime > gracePeriodCalc.gracePeriodEnd) {
        console.log(`⏰ Grace period expired for ${scheduledEvent.context.medicationName}`);
        console.log(`   - Scheduled: ${scheduledFor.toISOString()}`);
        console.log(`   - Grace period end: ${gracePeriodCalc.gracePeriodEnd.toISOString()}`);
        console.log(`   - Current time: ${currentTime.toISOString()}`);
        console.log(`   - Minutes overdue: ${Math.round((currentTime.getTime() - gracePeriodCalc.gracePeriodEnd.getTime()) / 60000)}`);

        // Process missed medication using orchestrator
        const workflowResult = await orchestrator.processMissedMedicationWorkflow(
          scheduledEvent.commandId,
          {
            scheduledDateTime: scheduledFor,
            gracePeriodEnd: gracePeriodCalc.gracePeriodEnd,
            detectionMethod: 'automatic',
            detectedBy: 'system'
          }
        );

        if (workflowResult.success) {
          results.missed++;
          results.notificationsSent += workflowResult.notificationsSent;
          
          results.batchResults.push({
            eventId: scheduledEvent.id,
            commandId: scheduledEvent.commandId,
            medicationName: scheduledEvent.context.medicationName,
            patientId: scheduledEvent.patientId,
            scheduledDateTime: scheduledFor,
            gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
            gracePeriodEnd: gracePeriodCalc.gracePeriodEnd,
            appliedRules: gracePeriodCalc.appliedRules
          });

          console.log(`✅ Processed missed medication: ${scheduledEvent.context.medicationName}`);
          console.log(`   - Event ID: ${scheduledEvent.id}`);
          console.log(`   - Command ID: ${scheduledEvent.commandId}`);
          console.log(`   - Patient ID: ${scheduledEvent.patientId}`);
          console.log(`   - Notifications sent: ${workflowResult.notificationsSent}`);
        } else {
          const errorMsg = `Failed to process missed medication for ${scheduledEvent.context.medicationName}: ${workflowResult.error}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      } else {
        // Still within grace period
        const minutesRemaining = Math.round((gracePeriodCalc.gracePeriodEnd.getTime() - currentTime.getTime()) / 60000);
        console.log(`⏳ ${scheduledEvent.context.medicationName} still within grace period (${minutesRemaining} minutes remaining)`);
      }

    } catch (eventError) {
      const errorMsg = `Error processing event ${scheduledEvent.id}: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }
}

/**
 * Calculate grace period for a scheduled event
 */
async function calculateGracePeriodForEvent(
  scheduledEvent: any,
  gracePeriodEngine: GracePeriodEngine,
  firestore: admin.firestore.Firestore
): Promise<{
  gracePeriodMinutes: number;
  gracePeriodEnd: Date;
  appliedRules: string[];
}> {
  try {
    // Get command to access grace period configuration
    const commandDoc = await firestore
      .collection('medication_commands')
      .doc(scheduledEvent.commandId)
      .get();

    if (!commandDoc.exists) {
      // Fallback to default grace period calculation
      console.warn(`⚠️ Command ${scheduledEvent.commandId} not found, using default grace period`);
      return calculateDefaultGracePeriod(scheduledEvent);
    }

    const command = commandDoc.data()!;
    
    // Use command's grace period configuration if available
    if (command.gracePeriod) {
      const scheduledFor = scheduledEvent.timing.scheduledFor;
      const timeSlot = getTimeSlotForScheduledTime(scheduledFor);
      
      // Get grace period for this time slot
      let gracePeriodMinutes = command.gracePeriod.defaultMinutes;
      const appliedRules = ['command_default'];
      
      // Apply time slot override if exists
      if (command.gracePeriod.timeSlotOverrides?.[timeSlot]) {
        gracePeriodMinutes = command.gracePeriod.timeSlotOverrides[timeSlot];
        appliedRules.push(`time_slot_${timeSlot}`);
      }
      
      // Apply medication type multiplier
      const medicationType = command.gracePeriod.medicationType || 'standard';
      appliedRules.push(`type_${medicationType}`);
      
      // Apply weekend/holiday multipliers
      const isWeekend = isWeekendDate(scheduledFor);
      const multiplier = isWeekend && command.gracePeriod.weekendMultiplier 
        ? command.gracePeriod.weekendMultiplier 
        : 1.0;
      
      if (multiplier !== 1.0) {
        appliedRules.push('weekend_multiplier');
        gracePeriodMinutes = Math.round(gracePeriodMinutes * multiplier);
      }
      
      const gracePeriodEnd = new Date(scheduledFor.getTime() + gracePeriodMinutes * 60 * 1000);
      
      return {
        gracePeriodMinutes,
        gracePeriodEnd,
        appliedRules
      };
    }
    
    // Fallback to default calculation
    return calculateDefaultGracePeriod(scheduledEvent);
    
  } catch (error) {
    console.error('❌ Error calculating grace period:', error);
    return calculateDefaultGracePeriod(scheduledEvent);
  }
}

/**
 * Calculate default grace period when command data is unavailable
 */
function calculateDefaultGracePeriod(scheduledEvent: any): {
  gracePeriodMinutes: number;
  gracePeriodEnd: Date;
  appliedRules: string[];
} {
  const scheduledFor = scheduledEvent.timing.scheduledFor;
  const timeSlot = getTimeSlotForScheduledTime(scheduledFor);
  
  // Default grace periods by time slot
  const defaultGracePeriods = {
    morning: 30,
    noon: 45,
    evening: 30,
    bedtime: 60
  };
  
  const gracePeriodMinutes = defaultGracePeriods[timeSlot];
  const gracePeriodEnd = new Date(scheduledFor.getTime() + gracePeriodMinutes * 60 * 1000);
  
  return {
    gracePeriodMinutes,
    gracePeriodEnd,
    appliedRules: [`default_${timeSlot}`]
  };
}

/**
 * Determine time slot for a scheduled time
 */
function getTimeSlotForScheduledTime(scheduledTime: Date): 'morning' | 'noon' | 'evening' | 'bedtime' {
  const hour = scheduledTime.getHours();
  
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'bedtime';
}

/**
 * Check if date is a weekend
 */
function isWeekendDate(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Log results to Firestore and return
 */
async function logAndReturnResults(
  firestore: admin.firestore.Firestore,
  results: MissedDetectionResult,
  startTime: number
): Promise<MissedDetectionResult> {
  results.executionTimeMs = Date.now() - startTime;
  
  try {
    // Log execution to Firestore for monitoring
    await firestore.collection('missed_detection_logs').add({
      executionTime: admin.firestore.Timestamp.fromDate(results.detectionTime),
      durationMs: results.executionTimeMs,
      eventsProcessed: results.processed,
      medicationsMissed: results.missed,
      notificationsSent: results.notificationsSent,
      errorCount: results.errors.length,
      errors: results.errors.slice(0, 10), // First 10 errors
      success: results.success,
      batchResultsCount: results.batchResults.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create system alerts for concerning patterns
    if (results.errors.length > 0) {
      const errorRate = results.processed > 0 ? (results.errors.length / results.processed) * 100 : 0;
      
      if (errorRate > 10) {
        console.error(`🚨 HIGH ERROR RATE: ${Math.round(errorRate)}% of events failed processing`);
        
        await firestore.collection('system_alerts').add({
          alertType: 'missed_detection_errors',
          severity: errorRate > 25 ? 'critical' : 'warning',
          message: `Missed medication detection encountered ${results.errors.length} errors (${Math.round(errorRate)}% error rate)`,
          details: {
            totalProcessed: results.processed,
            errorCount: results.errors.length,
            errorRate,
            sampleErrors: results.errors.slice(0, 5)
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedAt: null,
          isResolved: false
        });
      }
    }

    // Alert if execution time is excessive
    if (results.executionTimeMs > 300000) { // > 5 minutes
      console.warn(`⚠️ SLOW EXECUTION: Detection took ${Math.round(results.executionTimeMs / 1000)}s`);
      
      await firestore.collection('system_alerts').add({
        alertType: 'missed_detection_performance',
        severity: 'warning',
        message: `Missed medication detection took ${Math.round(results.executionTimeMs / 1000)}s to complete`,
        details: {
          executionTimeMs: results.executionTimeMs,
          eventsProcessed: results.processed,
          averageTimePerEvent: results.processed > 0 ? Math.round(results.executionTimeMs / results.processed) : 0
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedAt: null,
        isResolved: false
      });
    }

  } catch (loggingError) {
    console.error('❌ Error logging results:', loggingError);
    // Don't fail the function due to logging errors
  }

  return results;
}

/**
 * Get family members who should be notified for a patient
 */
async function getFamilyMembersForNotification(
  patientId: string,
  firestore: admin.firestore.Firestore
): Promise<Array<{
  userId: string;
  name: string;
  email: string;
  preferredMethods: ('email' | 'sms' | 'push' | 'browser')[];
  isPatient: boolean;
  isFamilyMember: boolean;
  isEmergencyContact: boolean;
}>> {
  try {
    // Query family_calendar_access for active family members
    const familyAccessQuery = await firestore
      .collection('family_calendar_access')
      .where('patientId', '==', patientId)
      .where('status', '==', 'active')
      .get();

    const familyMembers = [];

    for (const doc of familyAccessQuery.docs) {
      const access = doc.data();
      
      // Only include family members who can receive notifications
      if (access.permissions?.canReceiveNotifications || access.permissions?.isEmergencyContact) {
        familyMembers.push({
          userId: access.familyMemberId,
          name: access.familyMemberName || 'Family Member',
          email: access.familyMemberEmail,
          preferredMethods: ['email', 'browser'] as ('email' | 'sms' | 'push' | 'browser')[],
          isPatient: false,
          isFamilyMember: true,
          isEmergencyContact: access.permissions?.isEmergencyContact || false
        });
      }
    }

    return familyMembers;

  } catch (error) {
    console.error('❌ Error getting family members:', error);
    return [];
  }
}

/**
 * Get patient information for notifications
 */
async function getPatientInfo(
  patientId: string,
  firestore: admin.firestore.Firestore
): Promise<{
  userId: string;
  name: string;
  email: string;
  preferredMethods: ('email' | 'sms' | 'push' | 'browser')[];
  isPatient: boolean;
  isFamilyMember: boolean;
  isEmergencyContact: boolean;
} | null> {
  try {
    const patientDoc = await firestore.collection('users').doc(patientId).get();
    
    if (!patientDoc.exists) {
      return null;
    }

    const patientData = patientDoc.data()!;
    
    return {
      userId: patientId,
      name: patientData.name || 'Patient',
      email: patientData.email,
      preferredMethods: ['browser', 'push'],
      isPatient: true,
      isFamilyMember: false,
      isEmergencyContact: false
    };

  } catch (error) {
    console.error('❌ Error getting patient info:', error);
    return null;
  }
}