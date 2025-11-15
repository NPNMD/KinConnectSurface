"use strict";
/**
 * Firestore Trigger: CASCADE DELETE for Medication Commands
 *
 * This trigger ensures that when a medication_commands document is deleted,
 * all related data is automatically deleted from both unified and legacy systems.
 *
 * Unified System Collections:
 * - medication_events
 * - medication_events_archive
 *
 * Legacy System Collections:
 * - medication_calendar_events
 * - medication_schedules
 * - medication_reminders
 *
 * This fixes the bug where deleting a medication left orphaned events and reminders.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMedicationCommandDelete = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
/**
 * Firestore onDelete trigger for medication_commands collection
 * Automatically cascades deletes to related collections
 */
exports.onMedicationCommandDelete = functions
    .region('us-central1')
    .runWith({
    memory: '256MB',
    timeoutSeconds: 60
})
    .firestore
    .document('medication_commands/{commandId}')
    .onDelete(async (snapshot, context) => {
    const commandId = context.params.commandId;
    const commandData = snapshot.data();
    console.log('🗑️ CASCADE DELETE TRIGGER: Medication command deleted:', commandId);
    console.log('📋 Command data:', {
        medicationName: commandData?.medication?.name,
        patientId: commandData?.patientId,
        status: commandData?.status?.current
    });
    const db = admin.firestore();
    const deletionResults = {
        eventsDeleted: 0,
        archivedEventsDeleted: 0,
        legacyCalendarEventsDeleted: 0,
        legacySchedulesDeleted: 0,
        legacyRemindersDeleted: 0,
        errors: []
    };
    try {
        // Step 1: Delete all medication_events for this command
        console.log('🔍 Step 1: Querying medication_events for commandId:', commandId);
        const eventsQuery = await db.collection('medication_events')
            .where('commandId', '==', commandId)
            .get();
        console.log(`📊 Found ${eventsQuery.docs.length} medication_events to delete`);
        if (eventsQuery.docs.length > 0) {
            // Use batched writes for efficiency (max 500 per batch)
            const batches = [];
            let currentBatch = db.batch();
            let operationCount = 0;
            for (const doc of eventsQuery.docs) {
                currentBatch.delete(doc.ref);
                operationCount++;
                deletionResults.eventsDeleted++;
                // Firestore batch limit is 500 operations
                if (operationCount >= 500) {
                    batches.push(currentBatch);
                    currentBatch = db.batch();
                    operationCount = 0;
                }
            }
            // Add remaining operations
            if (operationCount > 0) {
                batches.push(currentBatch);
            }
            // Commit all batches
            console.log(`🔥 Committing ${batches.length} batch(es) to delete events...`);
            await Promise.all(batches.map(batch => batch.commit()));
            console.log(`✅ Deleted ${deletionResults.eventsDeleted} medication_events`);
        }
        // Step 2: Delete all archived events for this command
        console.log('🔍 Step 2: Querying medication_events_archive for commandId:', commandId);
        const archivedEventsQuery = await db.collection('medication_events_archive')
            .where('commandId', '==', commandId)
            .get();
        console.log(`📊 Found ${archivedEventsQuery.docs.length} archived events to delete`);
        if (archivedEventsQuery.docs.length > 0) {
            const archiveBatches = [];
            let currentArchiveBatch = db.batch();
            let archiveOperationCount = 0;
            for (const doc of archivedEventsQuery.docs) {
                currentArchiveBatch.delete(doc.ref);
                archiveOperationCount++;
                deletionResults.archivedEventsDeleted++;
                if (archiveOperationCount >= 500) {
                    archiveBatches.push(currentArchiveBatch);
                    currentArchiveBatch = db.batch();
                    archiveOperationCount = 0;
                }
            }
            if (archiveOperationCount > 0) {
                archiveBatches.push(currentArchiveBatch);
            }
            console.log(`🔥 Committing ${archiveBatches.length} batch(es) to delete archived events...`);
            await Promise.all(archiveBatches.map(batch => batch.commit()));
            console.log(`✅ Deleted ${deletionResults.archivedEventsDeleted} archived events`);
        }
        // Step 3: Delete legacy medication_calendar_events
        console.log('🔍 Step 3: Querying medication_calendar_events for medicationId:', commandId);
        try {
            const calendarEventsQuery = await db.collection('medication_calendar_events')
                .where('medicationId', '==', commandId)
                .get();
            console.log(`📊 Found ${calendarEventsQuery.docs.length} legacy calendar events to delete`);
            if (calendarEventsQuery.docs.length > 0) {
                const calendarBatches = [];
                let currentCalendarBatch = db.batch();
                let calendarOperationCount = 0;
                for (const doc of calendarEventsQuery.docs) {
                    currentCalendarBatch.delete(doc.ref);
                    calendarOperationCount++;
                    deletionResults.legacyCalendarEventsDeleted++;
                    if (calendarOperationCount >= 500) {
                        calendarBatches.push(currentCalendarBatch);
                        currentCalendarBatch = db.batch();
                        calendarOperationCount = 0;
                    }
                }
                if (calendarOperationCount > 0) {
                    calendarBatches.push(currentCalendarBatch);
                }
                console.log(`🔥 Committing ${calendarBatches.length} batch(es) to delete legacy calendar events...`);
                await Promise.all(calendarBatches.map(batch => batch.commit()));
                console.log(`✅ Deleted ${deletionResults.legacyCalendarEventsDeleted} legacy calendar events`);
            }
        }
        catch (calendarError) {
            const errorMsg = `Failed to delete legacy calendar events: ${calendarError instanceof Error ? calendarError.message : 'Unknown error'}`;
            console.error('❌', errorMsg);
            deletionResults.errors.push(errorMsg);
            // Continue with other deletions
        }
        // Step 4: Delete legacy medication_schedules
        console.log('🔍 Step 4: Querying medication_schedules for medicationId:', commandId);
        try {
            const schedulesQuery = await db.collection('medication_schedules')
                .where('medicationId', '==', commandId)
                .get();
            console.log(`📊 Found ${schedulesQuery.docs.length} legacy schedules to delete`);
            if (schedulesQuery.docs.length > 0) {
                const scheduleBatches = [];
                let currentScheduleBatch = db.batch();
                let scheduleOperationCount = 0;
                for (const doc of schedulesQuery.docs) {
                    currentScheduleBatch.delete(doc.ref);
                    scheduleOperationCount++;
                    deletionResults.legacySchedulesDeleted++;
                    if (scheduleOperationCount >= 500) {
                        scheduleBatches.push(currentScheduleBatch);
                        currentScheduleBatch = db.batch();
                        scheduleOperationCount = 0;
                    }
                }
                if (scheduleOperationCount > 0) {
                    scheduleBatches.push(currentScheduleBatch);
                }
                console.log(`🔥 Committing ${scheduleBatches.length} batch(es) to delete legacy schedules...`);
                await Promise.all(scheduleBatches.map(batch => batch.commit()));
                console.log(`✅ Deleted ${deletionResults.legacySchedulesDeleted} legacy schedules`);
            }
        }
        catch (scheduleError) {
            const errorMsg = `Failed to delete legacy schedules: ${scheduleError instanceof Error ? scheduleError.message : 'Unknown error'}`;
            console.error('❌', errorMsg);
            deletionResults.errors.push(errorMsg);
            // Continue with other deletions
        }
        // Step 5: Delete legacy medication_reminders
        console.log('🔍 Step 5: Querying medication_reminders for medicationId:', commandId);
        try {
            const remindersQuery = await db.collection('medication_reminders')
                .where('medicationId', '==', commandId)
                .get();
            console.log(`📊 Found ${remindersQuery.docs.length} legacy reminders to delete`);
            if (remindersQuery.docs.length > 0) {
                const reminderBatches = [];
                let currentReminderBatch = db.batch();
                let reminderOperationCount = 0;
                for (const doc of remindersQuery.docs) {
                    currentReminderBatch.delete(doc.ref);
                    reminderOperationCount++;
                    deletionResults.legacyRemindersDeleted++;
                    if (reminderOperationCount >= 500) {
                        reminderBatches.push(currentReminderBatch);
                        currentReminderBatch = db.batch();
                        reminderOperationCount = 0;
                    }
                }
                if (reminderOperationCount > 0) {
                    reminderBatches.push(currentReminderBatch);
                }
                console.log(`🔥 Committing ${reminderBatches.length} batch(es) to delete legacy reminders...`);
                await Promise.all(reminderBatches.map(batch => batch.commit()));
                console.log(`✅ Deleted ${deletionResults.legacyRemindersDeleted} legacy reminders`);
            }
        }
        catch (reminderError) {
            const errorMsg = `Failed to delete legacy reminders: ${reminderError instanceof Error ? reminderError.message : 'Unknown error'}`;
            console.error('❌', errorMsg);
            deletionResults.errors.push(errorMsg);
            // Continue with other deletions
        }
        // Step 6: Update migration tracking
        console.log('📊 Step 6: Updating migration tracking...');
        try {
            const trackingRef = db.collection('migration_tracking').doc('medication_system');
            await trackingRef.set({
                statistics: {
                    totalDeleted: admin.firestore.FieldValue.increment(1),
                    eventsDeleted: admin.firestore.FieldValue.increment(deletionResults.eventsDeleted),
                    archivedEventsDeleted: admin.firestore.FieldValue.increment(deletionResults.archivedEventsDeleted),
                    legacyCalendarEventsDeleted: admin.firestore.FieldValue.increment(deletionResults.legacyCalendarEventsDeleted),
                    legacySchedulesDeleted: admin.firestore.FieldValue.increment(deletionResults.legacySchedulesDeleted),
                    legacyRemindersDeleted: admin.firestore.FieldValue.increment(deletionResults.legacyRemindersDeleted)
                },
                lastCascadeDelete: {
                    commandId,
                    medicationName: commandData?.medication?.name,
                    patientId: commandData?.patientId,
                    eventsDeleted: deletionResults.eventsDeleted,
                    archivedEventsDeleted: deletionResults.archivedEventsDeleted,
                    legacyCalendarEventsDeleted: deletionResults.legacyCalendarEventsDeleted,
                    legacySchedulesDeleted: deletionResults.legacySchedulesDeleted,
                    legacyRemindersDeleted: deletionResults.legacyRemindersDeleted,
                    timestamp: new Date(),
                    triggerSource: 'firestore_trigger'
                },
                updatedAt: new Date()
            }, { merge: true });
            console.log('✅ Migration tracking updated');
        }
        catch (trackingError) {
            console.warn('⚠️ Failed to update migration tracking:', trackingError);
            // Don't fail the cascade delete if tracking update fails
        }
        // Log final results
        const totalDeleted = deletionResults.eventsDeleted +
            deletionResults.archivedEventsDeleted +
            deletionResults.legacyCalendarEventsDeleted +
            deletionResults.legacySchedulesDeleted +
            deletionResults.legacyRemindersDeleted;
        console.log('✅ CASCADE DELETE TRIGGER COMPLETED:', {
            commandId,
            medicationName: commandData?.medication?.name,
            unifiedSystem: {
                eventsDeleted: deletionResults.eventsDeleted,
                archivedEventsDeleted: deletionResults.archivedEventsDeleted
            },
            legacySystem: {
                calendarEventsDeleted: deletionResults.legacyCalendarEventsDeleted,
                schedulesDeleted: deletionResults.legacySchedulesDeleted,
                remindersDeleted: deletionResults.legacyRemindersDeleted
            },
            totalDeleted,
            errors: deletionResults.errors.length
        });
    }
    catch (error) {
        console.error('❌ CASCADE DELETE TRIGGER FAILED:', error);
        console.error('❌ Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack',
            commandId,
            medicationName: commandData?.medication?.name
        });
        // Log error but don't throw - we don't want to prevent the deletion
        deletionResults.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    return deletionResults;
});
