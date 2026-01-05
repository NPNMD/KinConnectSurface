import * as functions from 'firebase-functions/v1';
import { MedicationOrchestrator } from '../services/unified/MedicationOrchestrator';

/**
 * Scheduled function to detect missed medications
 * Runs every 15 minutes to check for medications past their grace period
 */
export const detectMissedMedications = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 300,
  })
  .pubsub.schedule('*/15 * * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const startTime = Date.now();
    console.log('🔍 ===== MISSED MEDICATION DETECTION START =====');
    console.log(`⏰ Execution time (UTC): ${new Date().toISOString()}`);
    
    try {
      const orchestrator = new MedicationOrchestrator();
      const result = await orchestrator.processMissedMedicationDetection();
      
      const executionTime = Date.now() - startTime;
      
      console.log('📊 ===== MISSED MEDICATION DETECTION SUMMARY =====');
      console.log(`   - Medications processed: ${result.medicationsProcessed}`);
      console.log(`   - Missed doses detected: ${result.missedDetected}`);
      console.log(`   - Workflows executed: ${result.workflowsExecuted}`);
      console.log(`   - Notifications sent: ${result.notificationsSent}`);
      console.log(`   - Errors: ${result.errors.length}`);
      console.log(`   - Execution time: ${executionTime}ms`);
      
      if (result.errors.length > 0) {
        console.error('❌ Errors during detection:', result.errors.slice(0, 5));
      }
      
      console.log('🔍 ===== MISSED MEDICATION DETECTION END =====');
      
      return result;
      
    } catch (error) {
      console.error('❌ Fatal error in missed medication detection:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  });