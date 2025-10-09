/**
 * Phase 2: Data Migration Script
 * Migrates legacy embedded medication data to unified normalized system
 *
 * Strategy: Extract and Normalize
 * 1. Extract unique medications from schedules
 * 2. Create medication_commands for each medication
 * 3. Create schedule_commands from medication_schedules
 * 4. Transform calendar events to medication_events
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✅ Service account JSON parsed successfully');
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
    process.exit(1);
  }
}

if (!serviceAccount) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'claritystream-uldp9'
});

const db = admin.firestore();

// Migration tracking
const migrationId = `migration-${new Date().toISOString()}`;
const migrationLog = {
  id: migrationId,
  startTime: new Date().toISOString(),
  phase: 'data_migration',
  steps: [],
  errors: [],
  summary: {}
};

function logStep(step, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    step,
    ...data
  };
  migrationLog.steps.push(logEntry);
  console.log(`[${logEntry.timestamp}] ${step}:`, data);
}

function logError(error, context = '') {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    context,
    error: error.message,
    stack: error.stack
  };
  migrationLog.errors.push(errorEntry);
  console.error(`[ERROR] ${context}:`, error);
}

/**
 * Extract unique medications from schedules
 */
async function extractMedications() {
  logStep('Extracting unique medications from schedules');
  
  const schedulesSnapshot = await db.collection('medication_schedules').get();
  const medications = new Map();
  
  schedulesSnapshot.forEach(doc => {
    const schedule = doc.data();
    const medId = schedule.medicationId;
    
    if (!medications.has(medId)) {
      medications.set(medId, {
        id: medId,
        name: schedule.medicationName,
        dosage: schedule.medicationDosage || schedule.dosageAmount,
        form: schedule.medicationForm || '',
        route: schedule.medicationRoute || 'oral',
        instructions: schedule.medicationInstructions || schedule.instructions || '',
        patientId: schedule.patientId,
        // Track which schedules use this medication
        scheduleIds: [doc.id]
      });
    } else {
      medications.get(medId).scheduleIds.push(doc.id);
    }
  });
  
  logStep('Medications extracted', { count: medications.size });
  return medications;
}

/**
 * Create medication_commands for each unique medication
 */
async function createMedicationCommands(medications) {
  logStep('Creating medication commands');
  
  const batch = db.batch();
  const medicationCommands = [];
  
  for (const [medId, med] of medications) {
    const commandId = `med_${medId}_${Date.now()}`;
    const commandRef = db.collection('medication_commands').doc(commandId);
    
    const command = {
      commandId,
      commandType: 'CREATE_MEDICATION',
      medicationId: medId,
      patientId: med.patientId,
      data: {
        name: med.name,
        dosage: med.dosage,
        form: med.form,
        route: med.route,
        instructions: med.instructions
      },
      metadata: {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'migration_script',
        migrationId,
        source: 'legacy_schedule_extraction'
      },
      status: 'completed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.set(commandRef, command);
    medicationCommands.push({ commandId, medicationId: medId, ...command });
  }
  
  await batch.commit();
  logStep('Medication commands created', { count: medicationCommands.length });
  
  return medicationCommands;
}

/**
 * Create schedule commands from medication_schedules
 */
async function createScheduleCommands(medications) {
  logStep('Creating schedule commands');
  
  const schedulesSnapshot = await db.collection('medication_schedules').get();
  const batch = db.batch();
  const scheduleCommands = [];
  
  for (const doc of schedulesSnapshot.docs) {
    const schedule = doc.data();
    const commandId = `sched_${doc.id}_${Date.now()}`;
    const commandRef = db.collection('medication_commands').doc(commandId);
    
    const command = {
      commandId,
      commandType: 'CREATE_SCHEDULE',
      scheduleId: doc.id,
      medicationId: schedule.medicationId,
      patientId: schedule.patientId,
      data: {
        frequency: schedule.frequency,
        times: schedule.times || [],
        daysOfWeek: schedule.daysOfWeek || [],
        dayOfMonth: schedule.dayOfMonth,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isIndefinite: schedule.isIndefinite || false,
        dosageAmount: schedule.dosageAmount || schedule.medicationDosage,
        instructions: schedule.instructions || schedule.medicationInstructions || '',
        generateCalendarEvents: schedule.generateCalendarEvents !== false,
        reminderMinutesBefore: schedule.reminderMinutesBefore || [],
        isActive: schedule.isActive !== false,
        isPaused: schedule.isPaused || false,
        pausedUntil: schedule.pausedUntil || null
      },
      metadata: {
        createdAt: schedule.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'migration_script',
        migrationId,
        source: 'legacy_medication_schedule',
        legacyScheduleId: doc.id,
        autoCreated: schedule.autoCreated || false,
        autoCreatedReason: schedule.autoCreatedReason || null
      },
      status: 'completed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.set(commandRef, command);
    scheduleCommands.push({ commandId, scheduleId: doc.id, ...command });
  }
  
  await batch.commit();
  logStep('Schedule commands created', { count: scheduleCommands.length });
  
  return scheduleCommands;
}

/**
 * Transform calendar events to medication_events
 */
async function transformCalendarEvents() {
  logStep('Transforming calendar events to medication_events');
  
  const eventsSnapshot = await db.collection('medication_calendar_events').get();
  const batchSize = 500;
  let batch = db.batch();
  let batchCount = 0;
  let totalEvents = 0;
  
  for (const doc of eventsSnapshot.docs) {
    const event = doc.data();
    const eventRef = db.collection('medication_events').doc(doc.id);
    
    const medicationEvent = {
      eventId: doc.id,
      eventType: 'SCHEDULED_DOSE',
      medicationId: event.medicationId,
      scheduleId: event.medicationScheduleId,
      patientId: event.patientId,
      scheduledDateTime: event.scheduledDateTime,
      dosageAmount: event.dosageAmount,
      instructions: event.instructions || '',
      status: event.status || 'scheduled',
      reminderMinutesBefore: event.reminderMinutesBefore || [],
      isRecurring: event.isRecurring !== false,
      
      // Status-specific fields
      ...(event.status === 'taken' && {
        takenAt: event.actualTakenDateTime,
        takenBy: event.takenBy,
        minutesLate: event.minutesLate || 0,
        isOnTime: event.isOnTime !== false,
        wasLate: event.wasLate || false
      }),
      
      ...(event.status === 'missed' && {
        missedAt: event.missedAt,
        missedReason: event.missedReason || 'unknown',
        gracePeriodEnd: event.gracePeriodEnd,
        gracePeriodRules: event.gracePeriodRules || [],
        gracePeriodMinutes: event.gracePeriodMinutes || 0
      }),
      
      metadata: {
        createdAt: event.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: event.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        migrationId,
        source: 'legacy_medication_calendar_event',
        legacyEventId: doc.id,
        medicationName: event.medicationName // Keep for reference
      }
    };
    
    batch.set(eventRef, medicationEvent);
    batchCount++;
    totalEvents++;
    
    // Commit batch every 500 documents
    if (batchCount >= batchSize) {
      await batch.commit();
      logStep('Batch committed', { events: batchCount, total: totalEvents });
      batch = db.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining documents
  if (batchCount > 0) {
    await batch.commit();
    logStep('Final batch committed', { events: batchCount, total: totalEvents });
  }
  
  logStep('Calendar events transformed', { count: totalEvents });
  return totalEvents;
}

/**
 * Validate migration
 */
async function validateMigration() {
  logStep('Validating migration');
  
  const validation = {
    medicationCommands: 0,
    scheduleCommands: 0,
    medicationEvents: 0,
    legacySchedules: 0,
    legacyEvents: 0
  };
  
  // Count new collections
  const medCommandsSnapshot = await db.collection('medication_commands')
    .where('metadata.migrationId', '==', migrationId)
    .where('commandType', '==', 'CREATE_MEDICATION')
    .get();
  validation.medicationCommands = medCommandsSnapshot.size;
  
  const schedCommandsSnapshot = await db.collection('medication_commands')
    .where('metadata.migrationId', '==', migrationId)
    .where('commandType', '==', 'CREATE_SCHEDULE')
    .get();
  validation.scheduleCommands = schedCommandsSnapshot.size;
  
  const eventsSnapshot = await db.collection('medication_events')
    .where('metadata.migrationId', '==', migrationId)
    .get();
  validation.medicationEvents = eventsSnapshot.size;
  
  // Count legacy collections
  const legacySchedulesSnapshot = await db.collection('medication_schedules').get();
  validation.legacySchedules = legacySchedulesSnapshot.size;
  
  const legacyEventsSnapshot = await db.collection('medication_calendar_events').get();
  validation.legacyEvents = legacyEventsSnapshot.size;
  
  logStep('Validation complete', validation);
  
  // Check for data integrity
  const issues = [];
  
  if (validation.scheduleCommands !== validation.legacySchedules) {
    issues.push(`Schedule count mismatch: ${validation.scheduleCommands} commands vs ${validation.legacySchedules} legacy`);
  }
  
  if (validation.medicationEvents !== validation.legacyEvents) {
    issues.push(`Event count mismatch: ${validation.medicationEvents} events vs ${validation.legacyEvents} legacy`);
  }
  
  if (issues.length > 0) {
    logError(new Error('Validation issues found'), issues.join('; '));
  }
  
  return { validation, issues };
}

/**
 * Update migration tracking
 */
async function updateMigrationTracking(summary) {
  logStep('Updating migration tracking');
  
  const trackingRef = db.collection('migration_tracking').doc(migrationId);
  
  await trackingRef.set({
    migrationId,
    phase: 'data_migration',
    status: migrationLog.errors.length > 0 ? 'completed_with_errors' : 'completed',
    startTime: migrationLog.startTime,
    endTime: new Date().toISOString(),
    summary,
    steps: migrationLog.steps,
    errors: migrationLog.errors
  });
  
  logStep('Migration tracking updated');
}

/**
 * Save migration report
 */
function saveMigrationReport() {
  const reportPath = path.join(__dirname, '..', 'PHASE_2_MIGRATION_REPORT.json');
  
  const report = {
    ...migrationLog,
    endTime: new Date().toISOString(),
    duration: new Date() - new Date(migrationLog.startTime)
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logStep('Migration report saved', { path: reportPath });
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('='.repeat(60));
  console.log('PHASE 2: DATA MIGRATION');
  console.log('Strategy: Extract and Normalize');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Extract medications
    const medications = await extractMedications();
    
    // Step 2: Create medication commands
    const medicationCommands = await createMedicationCommands(medications);
    
    // Step 3: Create schedule commands
    const scheduleCommands = await createScheduleCommands(medications);
    
    // Step 4: Transform calendar events
    const eventCount = await transformCalendarEvents();
    
    // Step 5: Validate migration
    const { validation, issues } = await validateMigration();
    
    // Step 6: Update tracking
    const summary = {
      medicationsExtracted: medications.size,
      medicationCommandsCreated: medicationCommands.length,
      scheduleCommandsCreated: scheduleCommands.length,
      eventsTransformed: eventCount,
      validation,
      issues
    };
    
    migrationLog.summary = summary;
    
    await updateMigrationTracking(summary);
    
    // Step 7: Save report
    saveMigrationReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION COMPLETED');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log(JSON.stringify(summary, null, 2));
    
    if (issues.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    process.exit(0);
    
  } catch (error) {
    logError(error, 'Migration failed');
    saveMigrationReport();
    
    console.error('\n' + '='.repeat(60));
    console.error('MIGRATION FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    console.error('\nCheck PHASE_2_MIGRATION_REPORT.json for details');
    
    process.exit(1);
  }
}

// Run migration
runMigration();