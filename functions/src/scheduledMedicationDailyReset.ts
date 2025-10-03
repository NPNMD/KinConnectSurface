/**
 * Scheduled Medication Daily Reset Cloud Function
 *
 * Runs every 15 minutes to check which patients are at midnight in their timezone
 * and executes the daily reset process for those patients.
 *
 * This function:
 * 1. Queries all patients with their timezone information
 * 2. Determines which patients are currently at midnight (±15 min window)
 * 3. Executes daily reset for each patient at midnight
 * 4. Logs results and errors for monitoring
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { DailyResetService } from './services/unified/DailyResetService';
import { getPatientsAtMidnight, isValidTimezone } from './utils/timezoneUtils';

/**
 * Scheduled function that runs every 15 minutes
 */
export const scheduledMedicationDailyReset = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540, // 9 minutes (leave buffer for 15-min schedule)
  })
  .pubsub.schedule('every 15 minutes')
  .timeZone('UTC') // Run in UTC, we'll handle patient timezones internally
  .onRun(async (context: functions.EventContext) => {
    const startTime = Date.now();
    console.log('🌅 Starting scheduled medication daily reset check');
    console.log(`⏰ Execution time: ${new Date().toISOString()}`);

    try {
      const firestore = admin.firestore();
      const dailyResetService = new DailyResetService();

      // Step 1: Get all patients with their timezone information
      const patientTimezones = await getPatientTimezones(firestore);
      console.log(`👥 Found ${patientTimezones.size} patients with timezone information`);

      if (patientTimezones.size === 0) {
        console.log('ℹ️ No patients found with timezone information');
        return {
          success: true,
          patientsProcessed: 0,
          message: 'No patients with timezone information'
        };
      }

      // Step 2: Determine which patients are at midnight
      const patientsAtMidnight = getPatientsAtMidnight(patientTimezones, 15);
      console.log(`🌙 Found ${patientsAtMidnight.length} patients at midnight`);

      if (patientsAtMidnight.length === 0) {
        console.log('ℹ️ No patients at midnight in their timezone');
        return {
          success: true,
          patientsProcessed: 0,
          message: 'No patients at midnight'
        };
      }

      // Step 3: Execute daily reset for each patient at midnight
      const results = {
        successful: [] as string[],
        failed: [] as { patientId: string; error: string }[],
        totalEventsArchived: 0,
        totalSummariesCreated: 0
      };

      for (const patientId of patientsAtMidnight) {
        const timezone = patientTimezones.get(patientId)!;
        
        try {
          console.log(`🔄 Processing daily reset for patient ${patientId} (${timezone})`);
          
          const result = await dailyResetService.executeDailyReset({
            patientId,
            timezone,
            dryRun: false
          });

          if (result.success) {
            results.successful.push(patientId);
            results.totalEventsArchived += result.statistics.eventsArchived;
            if (result.statistics.summaryCreated) {
              results.totalSummariesCreated++;
            }
            
            console.log(`✅ Daily reset successful for patient ${patientId}`);
            console.log(`   - Date: ${result.summaryDate}`);
            console.log(`   - Events archived: ${result.statistics.eventsArchived}`);
            console.log(`   - Summary created: ${result.statistics.summaryCreated}`);
          } else {
            results.failed.push({
              patientId,
              error: result.error || 'Unknown error'
            });
            console.error(`❌ Daily reset failed for patient ${patientId}: ${result.error}`);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.failed.push({ patientId, error: errorMessage });
          console.error(`❌ Exception during daily reset for patient ${patientId}:`, error);
        }
      }

      // Step 4: Log summary and return results
      const executionTime = Date.now() - startTime;
      console.log('📊 Daily Reset Summary:');
      console.log(`   - Total patients checked: ${patientTimezones.size}`);
      console.log(`   - Patients at midnight: ${patientsAtMidnight.length}`);
      console.log(`   - Successful resets: ${results.successful.length}`);
      console.log(`   - Failed resets: ${results.failed.length}`);
      console.log(`   - Total events archived: ${results.totalEventsArchived}`);
      console.log(`   - Total summaries created: ${results.totalSummariesCreated}`);
      console.log(`   - Execution time: ${executionTime}ms`);

      if (results.failed.length > 0) {
        console.error('❌ Failed patients:', results.failed);
      }

      // Log to Firestore for monitoring
      await logDailyResetExecution(firestore, {
        executionTime: new Date(),
        durationMs: executionTime,
        totalPatientsChecked: patientTimezones.size,
        patientsAtMidnight: patientsAtMidnight.length,
        successfulResets: results.successful.length,
        failedResets: results.failed.length,
        totalEventsArchived: results.totalEventsArchived,
        totalSummariesCreated: results.totalSummariesCreated,
        failures: results.failed
      });

      return {
        success: true,
        patientsProcessed: patientsAtMidnight.length,
        successful: results.successful.length,
        failed: results.failed.length,
        eventsArchived: results.totalEventsArchived,
        summariesCreated: results.totalSummariesCreated,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ Fatal error in scheduled daily reset:', error);
      
      // Log error to Firestore
      const firestore = admin.firestore();
      await logDailyResetExecution(firestore, {
        executionTime: new Date(),
        durationMs: Date.now() - startTime,
        totalPatientsChecked: 0,
        patientsAtMidnight: 0,
        successfulResets: 0,
        failedResets: 0,
        totalEventsArchived: 0,
        totalSummariesCreated: 0,
        fatalError: error instanceof Error ? error.message : 'Unknown fatal error',
        failures: []
      });

      throw error; // Re-throw to mark function execution as failed
    }
  });

/**
 * Get all patients with their timezone information
 */
async function getPatientTimezones(
  firestore: admin.firestore.Firestore
): Promise<Map<string, string>> {
  const patientTimezones = new Map<string, string>();

  try {
    // Query patient_time_preferences collection for timezone information
    const preferencesSnapshot = await firestore
      .collection('patient_time_preferences')
      .get();

    for (const doc of preferencesSnapshot.docs) {
      const data = doc.data();
      const patientId = data.patientId || doc.id;
      const timezone = data.lifestyle?.timezone;

      if (timezone && isValidTimezone(timezone)) {
        patientTimezones.set(patientId, timezone);
      } else {
        console.warn(`⚠️ Patient ${patientId} has invalid or missing timezone: ${timezone}`);
      }
    }

    // Fallback: Check users collection for timezone if not in preferences
    if (patientTimezones.size === 0) {
      console.log('ℹ️ No timezones found in patient_time_preferences, checking users collection');
      
      const usersSnapshot = await firestore
        .collection('users')
        .get();

      for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const timezone = data.timezone || data.timeZone;

        if (timezone && isValidTimezone(timezone)) {
          patientTimezones.set(doc.id, timezone);
        }
      }
    }

    return patientTimezones;

  } catch (error) {
    console.error('❌ Error getting patient timezones:', error);
    return patientTimezones;
  }
}

/**
 * Log daily reset execution to Firestore for monitoring
 */
async function logDailyResetExecution(
  firestore: admin.firestore.Firestore,
  data: {
    executionTime: Date;
    durationMs: number;
    totalPatientsChecked: number;
    patientsAtMidnight: number;
    successfulResets: number;
    failedResets: number;
    totalEventsArchived: number;
    totalSummariesCreated: number;
    fatalError?: string;
    failures: Array<{ patientId: string; error: string }>;
  }
): Promise<void> {
  try {
    await firestore.collection('daily_reset_logs').add({
      ...data,
      executionTime: admin.firestore.Timestamp.fromDate(data.executionTime),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Error logging daily reset execution:', error);
    // Don't throw - logging failure shouldn't fail the function
  }
}