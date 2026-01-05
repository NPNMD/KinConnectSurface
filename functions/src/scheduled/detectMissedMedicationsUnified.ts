import * as functions from 'firebase-functions/v1';
import { MedicationOrchestrator } from '../services/unified/MedicationOrchestrator';

export const detectMissedMedicationsUnified = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 300,
  })
  .pubsub.schedule('*/15 * * * *') // Every 15 minutes
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🔍 Starting unified missed medication detection');
    
    const orchestrator = new MedicationOrchestrator();
    const result = await orchestrator.processMissedMedicationDetection();
    
    console.log('✅ Missed detection complete:', result);
    return result;
  });