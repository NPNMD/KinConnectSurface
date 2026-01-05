import * as functions from 'firebase-functions/v1';
import { MedicationOrchestrator } from '../services/unified/MedicationOrchestrator';
import * as admin from 'firebase-admin';

export const generateDailyMedicationEvents = functions
  .runWith({
    memory: '1GB',
    timeoutSeconds: 540,
  })
  .pubsub.schedule('0 2 * * *') // 2 AM UTC daily
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('📅 Starting daily event generation');
    
    const firestore = admin.firestore();
    const orchestrator = new MedicationOrchestrator();
    
    // Get all active medications with reminders
    const commandsQuery = await firestore
      .collection('medication_commands')
      .where('status.isActive', '==', true)
      .where('reminders.enabled', '==', true)
      .where('status.isPRN', '==', false)
      .get();
    
    const results = {
      processed: 0,
      eventsGenerated: 0,
      errors: [] as string[]
    };
    
    for (const doc of commandsQuery.docs) {
      try {
        results.processed++;
        const result = await orchestrator.regenerateScheduledEvents(doc.id);
        
        if (result.success) {
          results.eventsGenerated += result.created;
        } else {
          results.errors.push(`${doc.id}: ${result.error}`);
        }
      } catch (error) {
        results.errors.push(`${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('✅ Daily event generation complete:', results);
    return results;
  });