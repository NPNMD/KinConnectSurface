"use strict";
/**
 * Firestore Trigger: CASCADE DELETE for Medication Commands
 *
 * This trigger ensures that when a medication_commands document is deleted,
 * all related medication_events and archived events are automatically deleted.
 *
 * This fixes the original bug where deleting a medication left orphaned events.
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
        // Step 3: Update migration tracking
        console.log('📊 Step 3: Updating migration tracking...');
        try {
            const trackingRef = db.collection('migration_tracking').doc('medication_system');
            await trackingRef.set({
                statistics: {
                    totalDeleted: admin.firestore.FieldValue.increment(1),
                    eventsDeleted: admin.firestore.FieldValue.increment(deletionResults.eventsDeleted),
                    archivedEventsDeleted: admin.firestore.FieldValue.increment(deletionResults.archivedEventsDeleted)
                },
                lastCascadeDelete: {
                    commandId,
                    medicationName: commandData?.medication?.name,
                    patientId: commandData?.patientId,
                    eventsDeleted: deletionResults.eventsDeleted,
                    archivedEventsDeleted: deletionResults.archivedEventsDeleted,
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
        console.log('✅ CASCADE DELETE TRIGGER COMPLETED:', {
            commandId,
            medicationName: commandData?.medication?.name,
            eventsDeleted: deletionResults.eventsDeleted,
            archivedEventsDeleted: deletionResults.archivedEventsDeleted,
            totalDeleted: deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted,
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
