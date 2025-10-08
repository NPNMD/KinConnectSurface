/**
 * Scheduled Adherence Summaries Cloud Functions
 * 
 * Two scheduled functions:
 * 1. Weekly summaries - Runs every Sunday at 8 AM (patient's timezone)
 * 2. Monthly summaries - Runs on the 1st of each month at 8 AM (patient's timezone)
 * 
 * These functions:
 * 1. Generate comprehensive adherence reports for each patient
 * 2. Send summaries to family members with appropriate permissions
 * 3. Include actionable insights and recommendations
 * 4. Respect notification preferences and quiet hours
 * 
 * Integration with Unified System:
 * - Uses AdherenceAnalyticsService for calculations
 * - Uses FamilyAdherenceNotificationService for delivery
 * - Respects family access permissions
 * - Follows event sourcing pattern
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FamilyAdherenceNotificationService } from './services/FamilyAdherenceNotificationService';

interface SummaryResult {
  success: boolean;
  processed: number;
  summariesGenerated: number;
  notificationsSent: number;
  errors: string[];
  executionTimeMs: number;
  executionTime: Date;
  summaryType: 'weekly' | 'monthly';
  patientResults: Array<{
    patientId: string;
    summaryGenerated: boolean;
    notificationsSent: number;
    familyMembersNotified: number;
    error?: string;
  }>;
}

/**
 * Scheduled function for weekly adherence summaries
 * Runs every Sunday at 8:00 AM UTC (adjusts for patient timezones)
 */
export const scheduledWeeklyAdherenceSummaries = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540, // 9 minutes
  })
  .pubsub.schedule('0 8 * * 0') // Every Sunday at 8 AM UTC
  .timeZone('UTC')
  .onRun(async (context: functions.EventContext) => {
    const startTime = Date.now();
    const executionTime = new Date();
    
    console.log('📊 ===== WEEKLY ADHERENCE SUMMARIES START =====');
    console.log(`⏰ Execution time (UTC): ${executionTime.toISOString()}`);
    console.log(`📅 Execution context:`, {
      eventId: context.eventId,
      timestamp: context.timestamp,
      resource: context.resource
    });

    const firestore = admin.firestore();
    const familyNotificationService = new FamilyAdherenceNotificationService();

    const results: SummaryResult = {
      success: true,
      processed: 0,
      summariesGenerated: 0,
      notificationsSent: 0,
      errors: [],
      executionTimeMs: 0,
      executionTime,
      summaryType: 'weekly',
      patientResults: []
    };

    try {
      // Step 1: Get all active patients with family members
      console.log('📊 Step 1: Querying for patients with family access...');
      
      const patientsWithFamilyQuery = await firestore
        .collection('family_calendar_access')
        .where('status', '==', 'active')
        .get();

      // Get unique patient IDs
      const patientIds = new Set<string>();
      patientsWithFamilyQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.permissions?.canReceiveNotifications) {
          patientIds.add(data.patientId);
        }
      });

      console.log(`📊 Found ${patientIds.size} patients with family members who can receive notifications`);

      if (patientIds.size === 0) {
        console.log('ℹ️ No patients with family notification access found');
        return logAndReturnResults(firestore, results, startTime);
      }

      // Step 2: Process each patient
      console.log('🔄 Step 2: Generating weekly summaries for each patient...');
      
      for (const patientId of patientIds) {
        try {
          results.processed++;
          
          console.log(`📊 Processing patient: ${patientId}`);

          // Check if patient has weekly summaries enabled
          const shouldSendSummary = await checkPatientSummaryPreferences(
            patientId,
            'weekly',
            firestore
          );

          if (!shouldSendSummary) {
            console.log(`⏭️ Weekly summaries disabled for patient: ${patientId}`);
            results.patientResults.push({
              patientId,
              summaryGenerated: false,
              notificationsSent: 0,
              familyMembersNotified: 0,
              error: 'Weekly summaries disabled'
            });
            continue;
          }

          // Generate weekly summary
          const summaryResult = await familyNotificationService.generateWeeklySummary(patientId);

          if (!summaryResult.success || !summaryResult.data) {
            const errorMsg = `Failed to generate weekly summary for ${patientId}: ${summaryResult.error}`;
            console.error(`❌ ${errorMsg}`);
            results.errors.push(errorMsg);
            results.patientResults.push({
              patientId,
              summaryGenerated: false,
              notificationsSent: 0,
              familyMembersNotified: 0,
              error: summaryResult.error
            });
            continue;
          }

          results.summariesGenerated++;
          const summary = summaryResult.data;

          // Send summary to family members
          const sendResult = await familyNotificationService.sendAdherenceSummary(summary);

          if (sendResult.success && sendResult.data) {
            results.notificationsSent += sendResult.data.notificationsSent;
            
            results.patientResults.push({
              patientId,
              summaryGenerated: true,
              notificationsSent: sendResult.data.notificationsSent,
              familyMembersNotified: sendResult.data.familyMembersNotified
            });

            console.log(`✅ Weekly summary sent for patient ${patientId}: ${sendResult.data.notificationsSent} notifications`);
          } else {
            const errorMsg = `Failed to send weekly summary for ${patientId}: ${sendResult.error}`;
            console.error(`❌ ${errorMsg}`);
            results.errors.push(errorMsg);
            results.patientResults.push({
              patientId,
              summaryGenerated: true,
              notificationsSent: 0,
              familyMembersNotified: 0,
              error: sendResult.error
            });
          }

        } catch (patientError) {
          const errorMsg = `Error processing patient ${patientId}: ${patientError instanceof Error ? patientError.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
          results.patientResults.push({
            patientId,
            summaryGenerated: false,
            notificationsSent: 0,
            familyMembersNotified: 0,
            error: errorMsg
          });
        }
      }

      // Step 3: Log summary
      results.executionTimeMs = Date.now() - startTime;
      
      console.log('📊 ===== WEEKLY SUMMARIES SUMMARY =====');
      console.log(`   - Patients processed: ${results.processed}`);
      console.log(`   - Summaries generated: ${results.summariesGenerated}`);
      console.log(`   - Notifications sent: ${results.notificationsSent}`);
      console.log(`   - Errors encountered: ${results.errors.length}`);
      console.log(`   - Execution time: ${results.executionTimeMs}ms`);

      if (results.errors.length > 0) {
        console.error('❌ Errors during summary generation:', results.errors.slice(0, 5));
      }

      console.log('📊 ===== WEEKLY ADHERENCE SUMMARIES END =====');

      return logAndReturnResults(firestore, results, startTime);

    } catch (error) {
      console.error('❌ Fatal error in weekly adherence summaries:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      results.success = false;
      results.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
      results.executionTimeMs = Date.now() - startTime;
      
      return logAndReturnResults(firestore, results, startTime);
    }
  });

/**
 * Scheduled function for monthly adherence summaries
 * Runs on the 1st of each month at 8:00 AM UTC (adjusts for patient timezones)
 */
export const scheduledMonthlyAdherenceSummaries = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540, // 9 minutes
  })
  .pubsub.schedule('0 8 1 * *') // 1st of each month at 8 AM UTC
  .timeZone('UTC')
  .onRun(async (context: functions.EventContext) => {
    const startTime = Date.now();
    const executionTime = new Date();
    
    console.log('📊 ===== MONTHLY ADHERENCE SUMMARIES START =====');
    console.log(`⏰ Execution time (UTC): ${executionTime.toISOString()}`);
    console.log(`📅 Execution context:`, {
      eventId: context.eventId,
      timestamp: context.timestamp,
      resource: context.resource
    });

    const firestore = admin.firestore();
    const familyNotificationService = new FamilyAdherenceNotificationService();

    const results: SummaryResult = {
      success: true,
      processed: 0,
      summariesGenerated: 0,
      notificationsSent: 0,
      errors: [],
      executionTimeMs: 0,
      executionTime,
      summaryType: 'monthly',
      patientResults: []
    };

    try {
      // Step 1: Get all active patients with family members
      console.log('📊 Step 1: Querying for patients with family access...');
      
      const patientsWithFamilyQuery = await firestore
        .collection('family_calendar_access')
        .where('status', '==', 'active')
        .get();

      // Get unique patient IDs
      const patientIds = new Set<string>();
      patientsWithFamilyQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.permissions?.canReceiveNotifications) {
          patientIds.add(data.patientId);
        }
      });

      console.log(`📊 Found ${patientIds.size} patients with family members who can receive notifications`);

      if (patientIds.size === 0) {
        console.log('ℹ️ No patients with family notification access found');
        return logAndReturnResults(firestore, results, startTime);
      }

      // Step 2: Process each patient
      console.log('🔄 Step 2: Generating monthly summaries for each patient...');
      
      for (const patientId of patientIds) {
        try {
          results.processed++;
          
          console.log(`📊 Processing patient: ${patientId}`);

          // Check if patient has monthly summaries enabled
          const shouldSendSummary = await checkPatientSummaryPreferences(
            patientId,
            'monthly',
            firestore
          );

          if (!shouldSendSummary) {
            console.log(`⏭️ Monthly summaries disabled for patient: ${patientId}`);
            results.patientResults.push({
              patientId,
              summaryGenerated: false,
              notificationsSent: 0,
              familyMembersNotified: 0,
              error: 'Monthly summaries disabled'
            });
            continue;
          }

          // Generate monthly summary
          const summaryResult = await familyNotificationService.generateMonthlySummary(patientId);

          if (!summaryResult.success || !summaryResult.data) {
            const errorMsg = `Failed to generate monthly summary for ${patientId}: ${summaryResult.error}`;
            console.error(`❌ ${errorMsg}`);
            results.errors.push(errorMsg);
            results.patientResults.push({
              patientId,
              summaryGenerated: false,
              notificationsSent: 0,
              familyMembersNotified: 0,
              error: summaryResult.error
            });
            continue;
          }

          results.summariesGenerated++;
          const summary = summaryResult.data;

          // Send summary to family members
          const sendResult = await familyNotificationService.sendAdherenceSummary(summary);

          if (sendResult.success && sendResult.data) {
            results.notificationsSent += sendResult.data.notificationsSent;
            
            results.patientResults.push({
              patientId,
              summaryGenerated: true,
              notificationsSent: sendResult.data.notificationsSent,
              familyMembersNotified: sendResult.data.familyMembersNotified
            });

            console.log(`✅ Monthly summary sent for patient ${patientId}: ${sendResult.data.notificationsSent} notifications`);
          } else {
            const errorMsg = `Failed to send monthly summary for ${patientId}: ${sendResult.error}`;
            console.error(`❌ ${errorMsg}`);
            results.errors.push(errorMsg);
            results.patientResults.push({
              patientId,
              summaryGenerated: true,
              notificationsSent: 0,
              familyMembersNotified: 0,
              error: sendResult.error
            });
          }

        } catch (patientError) {
          const errorMsg = `Error processing patient ${patientId}: ${patientError instanceof Error ? patientError.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
          results.patientResults.push({
            patientId,
            summaryGenerated: false,
            notificationsSent: 0,
            familyMembersNotified: 0,
            error: errorMsg
          });
        }
      }

      // Step 3: Log summary
      results.executionTimeMs = Date.now() - startTime;
      
      console.log('📊 ===== MONTHLY SUMMARIES SUMMARY =====');
      console.log(`   - Patients processed: ${results.processed}`);
      console.log(`   - Summaries generated: ${results.summariesGenerated}`);
      console.log(`   - Notifications sent: ${results.notificationsSent}`);
      console.log(`   - Errors encountered: ${results.errors.length}`);
      console.log(`   - Execution time: ${results.executionTimeMs}ms`);

      if (results.errors.length > 0) {
        console.error('❌ Errors during summary generation:', results.errors.slice(0, 5));
      }

      console.log('📊 ===== MONTHLY ADHERENCE SUMMARIES END =====');

      return logAndReturnResults(firestore, results, startTime);

    } catch (error) {
      console.error('❌ Fatal error in monthly adherence summaries:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      results.success = false;
      results.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
      results.executionTimeMs = Date.now() - startTime;
      
      return logAndReturnResults(firestore, results, startTime);
    }
  });

/**
 * Scheduled function for pattern-based adherence alerts
 * Runs every 6 hours to detect concerning patterns
 */
export const scheduledAdherencePatternDetection = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540, // 9 minutes
  })
  .pubsub.schedule('0 */6 * * *') // Every 6 hours
  .timeZone('UTC')
  .onRun(async (context: functions.EventContext) => {
    const startTime = Date.now();
    const executionTime = new Date();
    
    console.log('🔍 ===== ADHERENCE PATTERN DETECTION START =====');
    console.log(`⏰ Execution time (UTC): ${executionTime.toISOString()}`);

    const firestore = admin.firestore();
    const familyNotificationService = new FamilyAdherenceNotificationService();

    const results = {
      success: true,
      processed: 0,
      patternsDetected: 0,
      alertsSent: 0,
      errors: [] as string[],
      executionTimeMs: 0,
      executionTime,
      patientResults: [] as Array<{
        patientId: string;
        patternsDetected: number;
        alertsSent: number;
        error?: string;
      }>
    };

    try {
      // Get all active patients with family members
      const patientsWithFamilyQuery = await firestore
        .collection('family_calendar_access')
        .where('status', '==', 'active')
        .get();

      const patientIds = new Set<string>();
      patientsWithFamilyQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.permissions?.canReceiveNotifications) {
          patientIds.add(data.patientId);
        }
      });

      console.log(`🔍 Checking ${patientIds.size} patients for adherence patterns`);

      // Process each patient
      for (const patientId of patientIds) {
        try {
          results.processed++;

          // Detect patterns
          const patternsResult = await familyNotificationService.detectAdherencePatterns(patientId);

          if (!patternsResult.success || !patternsResult.data) {
            const errorMsg = `Failed to detect patterns for ${patientId}: ${patternsResult.error}`;
            console.error(`❌ ${errorMsg}`);
            results.errors.push(errorMsg);
            results.patientResults.push({
              patientId,
              patternsDetected: 0,
              alertsSent: 0,
              error: patternsResult.error
            });
            continue;
          }

          const patterns = patternsResult.data;
          results.patternsDetected += patterns.length;

          if (patterns.length === 0) {
            console.log(`✅ No concerning patterns detected for patient: ${patientId}`);
            results.patientResults.push({
              patientId,
              patternsDetected: 0,
              alertsSent: 0
            });
            continue;
          }

          console.log(`⚠️ Detected ${patterns.length} patterns for patient ${patientId}`);

          // Send pattern alerts
          const alertResult = await familyNotificationService.sendPatternAlerts(patientId, patterns);

          if (alertResult.success && alertResult.data) {
            results.alertsSent += alertResult.data.alertsSent;
            
            results.patientResults.push({
              patientId,
              patternsDetected: patterns.length,
              alertsSent: alertResult.data.alertsSent
            });

            console.log(`✅ Sent ${alertResult.data.alertsSent} alerts for patient ${patientId}`);
          } else {
            const errorMsg = `Failed to send alerts for ${patientId}: ${alertResult.error}`;
            console.error(`❌ ${errorMsg}`);
            results.errors.push(errorMsg);
            results.patientResults.push({
              patientId,
              patternsDetected: patterns.length,
              alertsSent: 0,
              error: alertResult.error
            });
          }

        } catch (patientError) {
          const errorMsg = `Error processing patient ${patientId}: ${patientError instanceof Error ? patientError.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
          results.patientResults.push({
            patientId,
            patternsDetected: 0,
            alertsSent: 0,
            error: errorMsg
          });
        }
      }

      // Log summary
      results.executionTimeMs = Date.now() - startTime;
      
      console.log('🔍 ===== PATTERN DETECTION SUMMARY =====');
      console.log(`   - Patients processed: ${results.processed}`);
      console.log(`   - Patterns detected: ${results.patternsDetected}`);
      console.log(`   - Alerts sent: ${results.alertsSent}`);
      console.log(`   - Errors encountered: ${results.errors.length}`);
      console.log(`   - Execution time: ${results.executionTimeMs}ms`);

      console.log('🔍 ===== ADHERENCE PATTERN DETECTION END =====');

      // Log to Firestore
      await firestore.collection('adherence_pattern_detection_logs').add({
        executionTime: admin.firestore.Timestamp.fromDate(results.executionTime),
        durationMs: results.executionTimeMs,
        patientsProcessed: results.processed,
        patternsDetected: results.patternsDetected,
        alertsSent: results.alertsSent,
        errorCount: results.errors.length,
        errors: results.errors.slice(0, 10),
        success: results.success,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return results;

    } catch (error) {
      console.error('❌ Fatal error in pattern detection:', error);
      results.success = false;
      results.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
      results.executionTimeMs = Date.now() - startTime;
      return results;
    }
  });

// ===== HELPER FUNCTIONS =====

/**
 * Check if patient has summaries enabled
 */
async function checkPatientSummaryPreferences(
  patientId: string,
  summaryType: 'weekly' | 'monthly',
  firestore: admin.firestore.Firestore
): Promise<boolean> {
  try {
    // Check if any family member has summaries enabled for this patient
    const familyAccessQuery = await firestore
      .collection('family_calendar_access')
      .where('patientId', '==', patientId)
      .where('status', '==', 'active')
      .get();

    for (const doc of familyAccessQuery.docs) {
      const access = doc.data();
      
      if (!access.permissions?.canReceiveNotifications) {
        continue;
      }

      // Check family member's preferences
      const prefsDoc = await firestore
        .collection('family_adherence_notification_preferences')
        .doc(`${patientId}_${access.familyMemberId}`)
        .get();

      if (!prefsDoc.exists) {
        // Default to enabled
        return true;
      }

      const prefs = prefsDoc.data()!;
      
      if (summaryType === 'weekly' && prefs.enableWeeklySummaries !== false) {
        return true;
      }
      
      if (summaryType === 'monthly' && prefs.enableMonthlySummaries !== false) {
        return true;
      }
    }

    return false;

  } catch (error) {
    console.error('❌ Error checking summary preferences:', error);
    // Default to enabled on error
    return true;
  }
}

/**
 * Log results to Firestore and return
 */
async function logAndReturnResults(
  firestore: admin.firestore.Firestore,
  results: SummaryResult,
  startTime: number
): Promise<SummaryResult> {
  results.executionTimeMs = Date.now() - startTime;
  
  try {
    // Log execution to Firestore for monitoring
    await firestore.collection('adherence_summary_logs').add({
      executionTime: admin.firestore.Timestamp.fromDate(results.executionTime),
      summaryType: results.summaryType,
      durationMs: results.executionTimeMs,
      patientsProcessed: results.processed,
      summariesGenerated: results.summariesGenerated,
      notificationsSent: results.notificationsSent,
      errorCount: results.errors.length,
      errors: results.errors.slice(0, 10),
      success: results.success,
      patientResultsCount: results.patientResults.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create system alerts for concerning patterns
    if (results.errors.length > 0) {
      const errorRate = results.processed > 0 ? (results.errors.length / results.processed) * 100 : 0;
      
      if (errorRate > 10) {
        console.error(`🚨 HIGH ERROR RATE: ${Math.round(errorRate)}% of summaries failed`);
        
        await firestore.collection('system_alerts').add({
          alertType: 'adherence_summary_errors',
          severity: errorRate > 25 ? 'critical' : 'warning',
          message: `${results.summaryType} adherence summaries encountered ${results.errors.length} errors (${Math.round(errorRate)}% error rate)`,
          details: {
            summaryType: results.summaryType,
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
      console.warn(`⚠️ SLOW EXECUTION: Summary generation took ${Math.round(results.executionTimeMs / 1000)}s`);
      
      await firestore.collection('system_alerts').add({
        alertType: 'adherence_summary_performance',
        severity: 'warning',
        message: `${results.summaryType} adherence summaries took ${Math.round(results.executionTimeMs / 1000)}s to complete`,
        details: {
          summaryType: results.summaryType,
          executionTimeMs: results.executionTimeMs,
          patientsProcessed: results.processed,
          averageTimePerPatient: results.processed > 0 ? Math.round(results.executionTimeMs / results.processed) : 0
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