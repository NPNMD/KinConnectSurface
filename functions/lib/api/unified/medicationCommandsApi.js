"use strict";
/**
 * Unified Medication Commands API
 *
 * Consolidates medication CRUD operations into single-purpose endpoints:
 * - POST /medication-commands - Create medication
 * - GET /medication-commands - List medications
 * - GET /medication-commands/:id - Get specific medication
 * - PUT /medication-commands/:id - Update medication
 * - DELETE /medication-commands/:id - Delete medication
 *
 * Replaces fragmented endpoints:
 * - /medications, /medication-schedules, /medication-reminders
 * - /medications/bulk-create-schedules, /medication-calendar/schedules
 * - Multiple medication status endpoints
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin = __importStar(require("firebase-admin"));
const MedicationOrchestrator_1 = require("../../services/unified/MedicationOrchestrator");
const MedicationCommandService_1 = require("../../services/unified/MedicationCommandService");
const MedicationEventService_1 = require("../../services/unified/MedicationEventService");
const MedicationNotificationService_1 = require("../../services/unified/MedicationNotificationService");
const AdherenceAnalyticsService_1 = require("../../services/unified/AdherenceAnalyticsService");
const MedicationUndoService_1 = require("../../services/unified/MedicationUndoService");
const router = express_1.default.Router();
// Lazy initialization to avoid Firebase Admin initialization order issues
let orchestrator;
let commandService;
let adherenceService;
let undoService;
function getOrchestrator() {
    if (!orchestrator) {
        orchestrator = new MedicationOrchestrator_1.MedicationOrchestrator();
    }
    return orchestrator;
}
function getCommandService() {
    if (!commandService) {
        commandService = new MedicationCommandService_1.MedicationCommandService();
    }
    return commandService;
}
function getAdherenceService() {
    if (!adherenceService) {
        adherenceService = new AdherenceAnalyticsService_1.AdherenceAnalyticsService();
    }
    return adherenceService;
}
function getUndoService() {
    if (!undoService) {
        undoService = new MedicationUndoService_1.MedicationUndoService();
    }
    return undoService;
}
// ===== MEDICATION COMMANDS CRUD =====
/**
 * POST /medication-commands
 * Create a new medication with complete workflow
 */
router.post('/', async (req, res) => {
    try {
        console.log('🚀 POST /medication-commands - Creating medication');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { medicationData, scheduleData, reminderSettings, notifyFamily = false } = req.body;
        // Validation
        if (!medicationData?.name || !scheduleData?.frequency) {
            return res.status(400).json({
                success: false,
                error: 'Medication name and schedule frequency are required'
            });
        }
        // Execute complete medication creation workflow
        const workflowResult = await getOrchestrator().createMedicationWorkflow({
            patientId: userId,
            medicationData,
            scheduleData: {
                ...scheduleData,
                times: scheduleData.times || ['07:00'], // Default time if not provided
                startDate: scheduleData.startDate ? new Date(scheduleData.startDate) : new Date(),
                endDate: scheduleData.endDate ? new Date(scheduleData.endDate) : undefined,
                dosageAmount: scheduleData.dosageAmount || medicationData.dosage || '1 tablet'
            },
            reminderSettings,
            createdBy: userId,
            notifyFamily
        });
        if (!workflowResult.success) {
            return res.status(500).json({
                success: false,
                error: workflowResult.error,
                workflowId: workflowResult.workflowId
            });
        }
        // Get the created command for response
        const commandResult = await getCommandService().getCommand(workflowResult.commandId);
        res.status(201).json({
            success: true,
            data: commandResult.data,
            workflow: {
                workflowId: workflowResult.workflowId,
                correlationId: workflowResult.correlationId,
                eventsCreated: workflowResult.eventIds.length,
                notificationsSent: workflowResult.notificationsSent,
                executionTimeMs: workflowResult.executionTimeMs
            },
            message: 'Medication created successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-commands
 * List medications with filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        console.log('🔍 GET /medication-commands - Listing medications');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, status, medicationName, frequency, isActive, isPRN, limit, orderBy, orderDirection } = req.query;
        // Determine target patient (support family access)
        const targetPatientId = patientId || userId;
        // TODO: Add family access validation here
        if (targetPatientId !== userId) {
            // For now, only allow access to own medications
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const queryOptions = {
            patientId: targetPatientId,
            status: status,
            medicationName: medicationName,
            frequency: frequency,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            isPRN: isPRN === 'true' ? true : isPRN === 'false' ? false : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            orderBy: orderBy || 'name',
            orderDirection: orderDirection || 'asc'
        };
        const result = await getCommandService().queryCommands(queryOptions);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data || [],
            total: result.total || 0,
            query: queryOptions,
            message: `Found ${result.total || 0} medications`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-commands:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-commands/:id
 * Get specific medication command
 */
router.get('/:commandId', async (req, res) => {
    try {
        console.log('🔍 GET /medication-commands/:id - Getting medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const result = await getCommandService().getCommand(commandId);
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error
            });
        }
        const command = result.data;
        // Check access permissions
        if (command.patientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        res.json({
            success: true,
            data: command,
            message: 'Medication retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-commands/:id:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PUT /medication-commands/:id
 * Update medication command
 */
router.put('/:commandId', async (req, res) => {
    try {
        console.log('📝 PUT /medication-commands/:id - Updating medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const updates = req.body;
        // Get current command to check permissions
        const currentResult = await getCommandService().getCommand(commandId);
        if (!currentResult.success || !currentResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (currentResult.data.patientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Execute update
        const result = await getCommandService().updateCommand({
            commandId,
            updates,
            updatedBy: userId,
            reason: 'User update via API'
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                validation: result.validation
            });
        }
        res.json({
            success: true,
            data: result.data,
            validation: result.validation,
            message: 'Medication updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in PUT /medication-commands/:id:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /medication-commands/:id
 * Delete medication command with CASCADE delete of all related events
 *
 * CRITICAL FIX: This endpoint now properly cascades deletes to:
 * - medication_events (all events for this command)
 * - medication_events_archive (archived events if any)
 * - Updates migration tracking
 *
 * This fixes the original bug where deleting a medication left orphaned events.
 */
router.delete('/:commandId', async (req, res) => {
    try {
        console.log('🗑️ DELETE /medication-commands/:id - CASCADE DELETE for medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { reason = 'Deleted by user', hardDelete = false } = req.body;
        // Get current command to check permissions
        const currentResult = await getCommandService().getCommand(commandId);
        if (!currentResult.success || !currentResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        const command = currentResult.data;
        // Check access permissions
        if (command.patientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        console.log('🔍 Starting CASCADE DELETE operation for commandId:', commandId);
        // Initialize deletion counters
        const deletionResults = {
            commandDeleted: false,
            eventsDeleted: 0,
            archivedEventsDeleted: 0,
            migrationTrackingUpdated: false,
            errors: []
        };
        // Use Firestore transaction for atomicity
        const db = admin.firestore();
        try {
            await db.runTransaction(async (transaction) => {
                // Step 1: Query all medication_events for this command
                console.log('📋 Step 1: Querying medication_events for commandId:', commandId);
                const eventsQuery = await db.collection('medication_events')
                    .where('commandId', '==', commandId)
                    .get();
                console.log(`📊 Found ${eventsQuery.docs.length} medication_events to delete`);
                deletionResults.eventsDeleted = eventsQuery.docs.length;
                // Step 2: Query archived events if they exist
                console.log('📋 Step 2: Querying medication_events_archive for commandId:', commandId);
                const archivedEventsQuery = await db.collection('medication_events_archive')
                    .where('commandId', '==', commandId)
                    .get();
                console.log(`📊 Found ${archivedEventsQuery.docs.length} archived events to delete`);
                deletionResults.archivedEventsDeleted = archivedEventsQuery.docs.length;
                // Step 3: Delete all events in transaction
                console.log('🗑️ Step 3: Deleting medication_events...');
                eventsQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                // Step 4: Delete archived events
                console.log('🗑️ Step 4: Deleting archived events...');
                archivedEventsQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                // Step 5: Handle command deletion based on hardDelete flag
                if (hardDelete) {
                    // Hard delete: Remove the command document entirely
                    console.log('🗑️ Step 5: HARD DELETE - Removing command document');
                    const commandRef = db.collection('medication_commands').doc(commandId);
                    transaction.delete(commandRef);
                    deletionResults.commandDeleted = true;
                }
                else {
                    // Soft delete: Mark as discontinued (default behavior)
                    console.log('🗑️ Step 5: SOFT DELETE - Marking command as discontinued');
                    const commandRef = db.collection('medication_commands').doc(commandId);
                    transaction.update(commandRef, {
                        'status.current': 'discontinued',
                        'status.discontinuedAt': new Date(),
                        'status.discontinuedBy': userId,
                        'status.discontinuedReason': reason,
                        'metadata.updatedAt': new Date(),
                        'metadata.deletedAt': new Date(),
                        'metadata.deletedBy': userId
                    });
                    deletionResults.commandDeleted = true;
                }
                // Step 6: Update migration tracking
                console.log('📊 Step 6: Updating migration tracking...');
                const trackingRef = db.collection('migration_tracking').doc('medication_system');
                const trackingDoc = await transaction.get(trackingRef);
                if (trackingDoc.exists) {
                    const trackingData = trackingDoc.data();
                    const currentStats = trackingData?.statistics || {};
                    transaction.update(trackingRef, {
                        'statistics.totalDeleted': (currentStats.totalDeleted || 0) + 1,
                        'statistics.eventsDeleted': (currentStats.eventsDeleted || 0) + deletionResults.eventsDeleted,
                        'statistics.archivedEventsDeleted': (currentStats.archivedEventsDeleted || 0) + deletionResults.archivedEventsDeleted,
                        'lastOperation': {
                            type: 'cascade_delete',
                            commandId,
                            deletedBy: userId,
                            timestamp: new Date(),
                            eventsDeleted: deletionResults.eventsDeleted,
                            archivedEventsDeleted: deletionResults.archivedEventsDeleted,
                            hardDelete
                        },
                        updatedAt: new Date()
                    });
                    deletionResults.migrationTrackingUpdated = true;
                }
            });
            console.log('✅ CASCADE DELETE transaction completed successfully');
        }
        catch (transactionError) {
            console.error('❌ CASCADE DELETE transaction failed:', transactionError);
            return res.status(500).json({
                success: false,
                error: 'Failed to complete cascade delete',
                details: transactionError instanceof Error ? transactionError.message : 'Unknown error'
            });
        }
        // Log final results
        console.log('📊 CASCADE DELETE Results:', {
            commandId,
            commandDeleted: deletionResults.commandDeleted,
            eventsDeleted: deletionResults.eventsDeleted,
            archivedEventsDeleted: deletionResults.archivedEventsDeleted,
            totalDeleted: deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted + 1,
            migrationTrackingUpdated: deletionResults.migrationTrackingUpdated,
            deleteType: hardDelete ? 'HARD' : 'SOFT'
        });
        res.json({
            success: true,
            data: {
                commandId,
                deleteType: hardDelete ? 'hard' : 'soft',
                deletionResults: {
                    commandDeleted: deletionResults.commandDeleted,
                    eventsDeleted: deletionResults.eventsDeleted,
                    archivedEventsDeleted: deletionResults.archivedEventsDeleted,
                    totalItemsDeleted: deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted + 1
                }
            },
            message: `Medication ${hardDelete ? 'deleted' : 'discontinued'} successfully with ${deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted} related events removed`
        });
    }
    catch (error) {
        console.error('❌ Error in DELETE /medication-commands/:id:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== MEDICATION COMMAND ACTIONS =====
/**
 * POST /medication-commands/:id/take
 * Enhanced mark medication as taken with comprehensive adherence tracking
 */
router.post('/:commandId/take', async (req, res) => {
    try {
        console.log('💊 POST /medication-commands/:id/take - Enhanced marking as taken:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const requestData = req.body;
        // Validate required fields
        if (!requestData.scheduledDateTime) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled date time is required'
            });
        }
        // Check for duplicate take events within the last 5 minutes
        const recentTakeCheck = await checkForRecentTakeEvent(commandId, new Date(requestData.scheduledDateTime));
        if (recentTakeCheck.isDuplicate) {
            return res.status(409).json({
                success: false,
                error: 'Medication already marked as taken for this time',
                existingEventId: recentTakeCheck.existingEventId
            });
        }
        // Get command to verify access and get medication details
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        const command = commandResult.data;
        // Check access permissions
        if (command.patientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Calculate timing metrics
        const scheduledTime = new Date(requestData.scheduledDateTime);
        const takenTime = requestData.takenAt ? new Date(requestData.takenAt) : new Date();
        const minutesFromScheduled = Math.floor((takenTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
        const isOnTime = Math.abs(minutesFromScheduled) <= 30;
        // Determine timing category
        let timingCategory;
        if (minutesFromScheduled < -30)
            timingCategory = 'early';
        else if (minutesFromScheduled <= 30)
            timingCategory = 'on_time';
        else if (minutesFromScheduled <= 120)
            timingCategory = 'late';
        else
            timingCategory = 'very_late';
        // Determine dose type
        let doseType = 'full';
        if (requestData.doseDetails?.doseAdjustment) {
            doseType = 'adjusted';
        }
        else if (requestData.doseDetails && requestData.doseDetails.actualDose !== requestData.doseDetails.prescribedDose) {
            doseType = 'partial';
        }
        // Calculate adherence scores
        const doseAccuracy = calculateDoseAccuracy(requestData.doseDetails, command.schedule.dosageAmount);
        const timingAccuracy = calculateTimingAccuracy(minutesFromScheduled);
        const circumstanceCompliance = calculateCircumstanceCompliance(requestData.circumstances);
        const overallScore = (doseAccuracy + timingAccuracy + circumstanceCompliance) / 3;
        // Enhanced workflow request
        const enhancedWorkflowRequest = {
            commandId,
            eventData: {
                takenAt: takenTime,
                takenBy: userId,
                notes: requestData.notes,
                scheduledDateTime: scheduledTime,
                // Enhanced adherence tracking
                adherenceTracking: {
                    doseAccuracy,
                    timingAccuracy,
                    circumstanceCompliance,
                    overallScore,
                    prescribedDose: requestData.doseDetails?.prescribedDose || command.schedule.dosageAmount,
                    actualDose: requestData.doseDetails?.actualDose || command.schedule.dosageAmount,
                    dosePercentage: doseAccuracy,
                    adjustmentReason: requestData.doseDetails?.doseAdjustment?.reason,
                    timingCategory,
                    minutesFromScheduled,
                    circumstances: requestData.circumstances
                },
                // Family interaction data
                familyInteraction: requestData.circumstances?.assistedBy ? {
                    assistedBy: requestData.circumstances.assistedBy,
                    assistanceType: requestData.circumstances.assistanceType || 'reminder',
                    assistanceNotes: requestData.notes
                } : undefined
            },
            context: {
                medicationName: command.medication.name,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                triggerSource: 'user_action'
            },
            notificationOptions: {
                notifyFamily: requestData.notifyFamily || false,
                urgency: (timingCategory === 'very_late' ? 'medium' : 'low')
            }
        };
        // Execute enhanced mark taken workflow
        const workflowResult = await getOrchestrator().markMedicationTakenWorkflow(enhancedWorkflowRequest);
        if (!workflowResult.success) {
            return res.status(500).json({
                success: false,
                error: workflowResult.error,
                workflowId: workflowResult.workflowId
            });
        }
        // Check for adherence milestones
        const milestonesResult = await getAdherenceService().checkAdherenceMilestones(command.patientId, commandId);
        const newMilestones = milestonesResult.data?.newMilestones || [];
        // Calculate current streak
        const currentStreak = milestonesResult.data?.currentStreaks?.find(s => s.medicationId === commandId)?.streakDays || 0;
        res.json({
            success: true,
            data: {
                eventId: workflowResult.eventIds[0],
                commandId,
                takenAt: takenTime,
                adherenceScore: Math.round(overallScore),
                timingCategory,
                undoAvailableUntil: new Date(Date.now() + 30 * 1000), // 30 seconds to undo
                streakUpdated: currentStreak > 0 ? {
                    previousStreak: Math.max(0, currentStreak - 1),
                    newStreak: currentStreak,
                    milestone: newMilestones.length > 0 ? newMilestones[0].milestone : undefined
                } : undefined,
                newMilestones
            },
            workflow: {
                workflowId: workflowResult.workflowId,
                correlationId: workflowResult.correlationId,
                notificationsSent: workflowResult.notificationsSent,
                executionTimeMs: workflowResult.executionTimeMs
            },
            message: 'Medication marked as taken successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/take:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/undo-take
 * Undo accidental medication marking (within 30-second window)
 */
router.post('/:commandId/undo-take', async (req, res) => {
    try {
        console.log('🔄 POST /medication-commands/:id/undo-take - Undoing medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const undoRequest = req.body;
        // Validate required fields
        if (!undoRequest.originalEventId || !undoRequest.undoReason) {
            return res.status(400).json({
                success: false,
                error: 'Original event ID and undo reason are required'
            });
        }
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (commandResult.data.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Execute undo using MedicationUndoService
        const undoResult = await getUndoService().undoMedicationEvent(undoRequest);
        if (!undoResult.success) {
            // Check if requires correction workflow
            const validation = await getUndoService().validateUndo(undoRequest.originalEventId);
            if (validation.requiresCorrection) {
                return res.status(410).json({
                    success: false,
                    error: undoResult.error,
                    requiresCorrection: true,
                    timeoutExpiredAt: validation.timeoutExpiredAt,
                    message: 'Undo timeout expired. Use the correction endpoint instead.'
                });
            }
            return res.status(400).json({
                success: false,
                error: undoResult.error
            });
        }
        // Execute undo workflow through orchestrator if needed
        const workflowResult = await getOrchestrator().undoMedicationWorkflow(commandId, undoRequest, {
            notifyFamily: undoRequest.notifyFamily || false,
            urgency: 'low'
        });
        res.json({
            success: true,
            data: {
                undoEventId: undoResult.undoEventId,
                originalEventId: undoRequest.originalEventId,
                correctedAction: undoResult.correctedAction,
                adherenceImpact: undoResult.adherenceImpact
            },
            workflow: {
                workflowId: workflowResult.workflowId,
                correlationId: workflowResult.correlationId,
                notificationsSent: workflowResult.notificationsSent,
                executionTimeMs: workflowResult.executionTimeMs
            },
            message: 'Medication take action undone successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/undo-take:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/correct
 * Correct older medication events (beyond 30-second undo window)
 */
router.post('/:commandId/correct', async (req, res) => {
    try {
        console.log('🔄 POST /medication-commands/:id/correct - Correcting medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { originalEventId, correctedAction, correctionReason, correctedData, notifyFamily = false } = req.body;
        // Validate required fields
        if (!originalEventId || !correctedAction || !correctionReason) {
            return res.status(400).json({
                success: false,
                error: 'Original event ID, corrected action, and correction reason are required'
            });
        }
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (commandResult.data.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Execute correction using MedicationUndoService
        const correctionResult = await getUndoService().correctMedicationEvent({
            originalEventId,
            correctedAction,
            correctionReason,
            correctedData,
            correctedBy: userId,
            notifyFamily
        });
        if (!correctionResult.success) {
            return res.status(400).json({
                success: false,
                error: correctionResult.error
            });
        }
        res.json({
            success: true,
            data: {
                correctionEventId: correctionResult.undoEventId,
                originalEventId,
                correctedAction,
                adherenceImpact: correctionResult.adherenceImpact
            },
            message: 'Medication event corrected successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/correct:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-commands/:id/undo-history
 * Get undo history for a medication
 */
router.get('/:commandId/undo-history', async (req, res) => {
    try {
        console.log('📋 GET /medication-commands/:id/undo-history - Getting undo history:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { limit } = req.query;
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (commandResult.data.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Get undo history
        const historyResult = await getUndoService().getUndoHistory(commandId, limit ? parseInt(limit, 10) : 10);
        if (!historyResult.success) {
            return res.status(500).json({
                success: false,
                error: historyResult.error
            });
        }
        res.json({
            success: true,
            data: historyResult.data || [],
            total: historyResult.data?.length || 0,
            message: 'Undo history retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-commands/:id/undo-history:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/status
 * Change medication status (pause, resume, hold, discontinue)
 */
router.post('/:commandId/status', async (req, res) => {
    try {
        console.log('📝 POST /medication-commands/:id/status - Changing status:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { status, reason, additionalData, notifyFamily = true, urgency = 'medium' } = req.body;
        // Validation
        const validStatuses = ['active', 'paused', 'held', 'discontinued', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Reason is required for status changes'
            });
        }
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (commandResult.data.patientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Execute status change workflow
        const workflowResult = await getOrchestrator().medicationStatusChangeWorkflow(commandId, {
            newStatus: status,
            reason,
            updatedBy: userId,
            additionalData
        }, {
            notifyFamily,
            urgency
        });
        if (!workflowResult.success) {
            return res.status(500).json({
                success: false,
                error: workflowResult.error,
                workflowId: workflowResult.workflowId
            });
        }
        res.json({
            success: true,
            data: {
                commandId,
                newStatus: status,
                reason,
                changedAt: new Date()
            },
            workflow: {
                workflowId: workflowResult.workflowId,
                correlationId: workflowResult.correlationId,
                notificationsSent: workflowResult.notificationsSent,
                executionTimeMs: workflowResult.executionTimeMs
            },
            message: `Medication status changed to ${status} successfully`
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/pause
 * Pause medication (convenience endpoint - delegates to status change)
 */
router.post('/:commandId/pause', async (req, res) => {
    try {
        console.log('⏸️ POST /medication-commands/:id/pause - Pausing medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { reason = 'Paused by user', pausedUntil, notifyFamily = true } = req.body;
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (commandResult.data.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Execute status change workflow (pause)
        const workflowResult = await getOrchestrator().medicationStatusChangeWorkflow(commandId, {
            newStatus: 'paused',
            reason,
            updatedBy: userId,
            additionalData: pausedUntil ? { pausedUntil: new Date(pausedUntil) } : undefined
        }, {
            notifyFamily,
            urgency: 'low'
        });
        if (!workflowResult.success) {
            return res.status(500).json({
                success: false,
                error: workflowResult.error,
                workflowId: workflowResult.workflowId
            });
        }
        res.json({
            success: true,
            data: {
                commandId,
                status: 'paused',
                reason,
                pausedUntil: pausedUntil ? new Date(pausedUntil) : null
            },
            workflow: {
                workflowId: workflowResult.workflowId,
                correlationId: workflowResult.correlationId,
                notificationsSent: workflowResult.notificationsSent
            },
            message: 'Medication paused successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/pause:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/resume
 * Resume paused medication (convenience endpoint - delegates to status change)
 */
router.post('/:commandId/resume', async (req, res) => {
    try {
        console.log('▶️ POST /medication-commands/:id/resume - Resuming medication:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { reason = 'Resumed by user', notifyFamily = true } = req.body;
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        // Check access permissions
        if (commandResult.data.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Execute status change workflow (resume to active)
        const workflowResult = await getOrchestrator().medicationStatusChangeWorkflow(commandId, {
            newStatus: 'active',
            reason,
            updatedBy: userId
        }, {
            notifyFamily,
            urgency: 'low'
        });
        if (!workflowResult.success) {
            return res.status(500).json({
                success: false,
                error: workflowResult.error,
                workflowId: workflowResult.workflowId
            });
        }
        res.json({
            success: true,
            data: {
                commandId,
                status: 'active',
                reason
            },
            workflow: {
                workflowId: workflowResult.workflowId,
                correlationId: workflowResult.correlationId,
                notificationsSent: workflowResult.notificationsSent
            },
            message: 'Medication resumed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/resume:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/skip
 * Skip a scheduled dose with reason
 */
router.post('/:commandId/skip', async (req, res) => {
    try {
        console.log('⏭️ POST /medication-commands/:id/skip - Skipping dose:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { scheduledDateTime, reason, notes, notifyFamily = false } = req.body;
        // Validate required fields
        if (!scheduledDateTime || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled date time and reason are required'
            });
        }
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        const command = commandResult.data;
        // Check access permissions
        if (command.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Create skip event directly using event service
        const eventService = new MedicationEventService_1.MedicationEventService();
        const correlationId = `skip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const skipEventResult = await eventService.createEvent({
            commandId,
            patientId: command.patientId,
            eventType: 'dose_skipped',
            eventData: {
                scheduledDateTime: new Date(scheduledDateTime),
                skipReason: reason,
                actionNotes: notes
            },
            context: {
                medicationName: command.medication.name,
                triggerSource: 'user_action'
            },
            timing: {
                scheduledFor: new Date(scheduledDateTime)
            },
            createdBy: userId,
            correlationId
        });
        if (!skipEventResult.success) {
            return res.status(500).json({
                success: false,
                error: skipEventResult.error
            });
        }
        // Send notifications if requested
        let notificationsSent = 0;
        if (notifyFamily) {
            const notificationService = new MedicationNotificationService_1.MedicationNotificationService();
            const notificationResult = await notificationService.sendNotification({
                patientId: command.patientId,
                commandId,
                medicationName: command.medication.name,
                notificationType: 'status_change',
                urgency: 'low',
                title: 'Medication Dose Skipped',
                message: `${command.medication.name} dose was skipped. Reason: ${reason}`,
                recipients: [], // Would need to fetch family members
                context: {
                    correlationId,
                    triggerSource: 'user_action'
                }
            });
            notificationsSent = notificationResult.data?.totalSent || 0;
        }
        res.json({
            success: true,
            data: {
                eventId: skipEventResult.data.id,
                commandId,
                scheduledDateTime: new Date(scheduledDateTime),
                reason,
                skippedAt: new Date(),
                notificationsSent
            },
            message: 'Dose skipped successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/skip:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/:id/snooze
 * Snooze a medication reminder
 */
router.post('/:commandId/snooze', async (req, res) => {
    try {
        console.log('💤 POST /medication-commands/:id/snooze - Snoozing reminder:', req.params.commandId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { commandId } = req.params;
        const { scheduledDateTime, snoozeMinutes, reason, notifyFamily = false } = req.body;
        // Validate required fields
        if (!scheduledDateTime || !snoozeMinutes) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled date time and snooze minutes are required'
            });
        }
        // Validate snooze duration
        if (snoozeMinutes < 1 || snoozeMinutes > 480) {
            return res.status(400).json({
                success: false,
                error: 'Snooze minutes must be between 1 and 480 (8 hours)'
            });
        }
        // Get command to verify access
        const commandResult = await getCommandService().getCommand(commandId);
        if (!commandResult.success || !commandResult.data) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        const command = commandResult.data;
        // Check access permissions
        if (command.patientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Calculate new scheduled time
        const originalTime = new Date(scheduledDateTime);
        const newScheduledTime = new Date(originalTime.getTime() + (snoozeMinutes * 60 * 1000));
        // Create snooze event directly using event service
        const eventService = new MedicationEventService_1.MedicationEventService();
        const correlationId = `snooze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const snoozeEventResult = await eventService.createEvent({
            commandId,
            patientId: command.patientId,
            eventType: 'dose_snoozed',
            eventData: {
                scheduledDateTime: originalTime,
                newScheduledTime: newScheduledTime,
                snoozeMinutes,
                actionReason: reason,
                additionalData: {
                    originalScheduledDateTime: originalTime.toISOString(),
                    newScheduledDateTime: newScheduledTime.toISOString()
                }
            },
            context: {
                medicationName: command.medication.name,
                triggerSource: 'user_action'
            },
            timing: {
                scheduledFor: newScheduledTime
            },
            createdBy: userId,
            correlationId
        });
        if (!snoozeEventResult.success) {
            return res.status(500).json({
                success: false,
                error: snoozeEventResult.error
            });
        }
        // Send notifications if requested
        let notificationsSent = 0;
        if (notifyFamily) {
            const notificationService = new MedicationNotificationService_1.MedicationNotificationService();
            const notificationResult = await notificationService.sendNotification({
                patientId: command.patientId,
                commandId,
                medicationName: command.medication.name,
                notificationType: 'status_change',
                urgency: 'low',
                title: 'Medication Reminder Snoozed',
                message: `${command.medication.name} reminder was snoozed for ${snoozeMinutes} minutes`,
                recipients: [], // Would need to fetch family members
                context: {
                    correlationId,
                    triggerSource: 'user_action'
                }
            });
            notificationsSent = notificationResult.data?.totalSent || 0;
        }
        res.json({
            success: true,
            data: {
                eventId: snoozeEventResult.data.id,
                commandId,
                originalScheduledDateTime: originalTime,
                newScheduledDateTime: newScheduledTime,
                snoozeMinutes,
                snoozedAt: new Date(),
                notificationsSent
            },
            message: `Reminder snoozed for ${snoozeMinutes} minutes`
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/:id/snooze:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-commands/stats
 * Get medication statistics for dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 GET /medication-commands/stats - Getting statistics');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getCommandService().getCommandStats(targetPatientId);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Statistics retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-commands/stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-commands/health-check
 * Perform health check on medication commands
 */
router.post('/health-check', async (req, res) => {
    try {
        console.log('🏥 POST /medication-commands/health-check - Performing health check');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getCommandService().performHealthCheck(targetPatientId);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Health check completed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-commands/health-check:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== HELPER METHODS =====
/**
 * Check for recent take events to prevent duplicates
 */
async function checkForRecentTakeEvent(commandId, scheduledDateTime) {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        // Query for recent take events for this medication around the scheduled time
        const recentEventsQuery = await admin.firestore()
            .collection('medication_events')
            .where('commandId', '==', commandId)
            .where('eventType', 'in', [
            'dose_taken',
            'dose_taken_full',
            'dose_taken_partial',
            'dose_taken_adjusted'
        ])
            .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
            .get();
        // Check if any recent events match the scheduled time (within 1 hour)
        for (const doc of recentEventsQuery.docs) {
            const eventData = doc.data();
            const eventScheduledTime = eventData.eventData?.scheduledDateTime?.toDate();
            if (eventScheduledTime) {
                const timeDiff = Math.abs(eventScheduledTime.getTime() - scheduledDateTime.getTime());
                if (timeDiff < 60 * 60 * 1000) { // Within 1 hour
                    return {
                        isDuplicate: true,
                        existingEventId: doc.id
                    };
                }
            }
        }
        return { isDuplicate: false };
    }
    catch (error) {
        console.error('❌ Error checking for recent take events:', error);
        return { isDuplicate: false };
    }
}
/**
 * Calculate dose accuracy percentage
 */
function calculateDoseAccuracy(doseDetails, prescribedDose) {
    if (!doseDetails || !doseDetails.actualDose) {
        return 100; // Assume full dose if not specified
    }
    // Simple calculation - in real implementation would parse dose strings
    if (doseDetails.actualDose === doseDetails.prescribedDose) {
        return 100;
    }
    // For partial doses, try to extract numeric values
    const prescribedMatch = prescribedDose.match(/(\d+(?:\.\d+)?)/);
    const actualMatch = doseDetails.actualDose.match(/(\d+(?:\.\d+)?)/);
    if (prescribedMatch && actualMatch) {
        const prescribed = parseFloat(prescribedMatch[1]);
        const actual = parseFloat(actualMatch[1]);
        return Math.min(100, (actual / prescribed) * 100);
    }
    return 90; // Default for partial dose
}
/**
 * Calculate timing accuracy percentage
 */
function calculateTimingAccuracy(minutesFromScheduled) {
    const absMinutes = Math.abs(minutesFromScheduled);
    if (absMinutes <= 15)
        return 100; // Perfect timing
    if (absMinutes <= 30)
        return 90; // Good timing
    if (absMinutes <= 60)
        return 75; // Acceptable timing
    if (absMinutes <= 120)
        return 50; // Poor timing
    return 25; // Very poor timing
}
/**
 * Calculate circumstance compliance percentage
 */
function calculateCircumstanceCompliance(circumstances) {
    if (!circumstances)
        return 100; // No special circumstances required
    let score = 100;
    // Deduct points for non-compliance
    if (circumstances.withFood === false && circumstances.shouldTakeWithFood) {
        score -= 20;
    }
    if (circumstances.symptoms && circumstances.symptoms.length > 0) {
        score -= 10; // Taking while symptomatic
    }
    return Math.max(0, score);
}
/**
 * Calculate adherence impact of undo action
 */
async function calculateUndoAdherenceImpact(commandId, originalEvent) {
    try {
        // Get current adherence analytics
        const analyticsResult = await getAdherenceService().calculateComprehensiveAdherence({
            patientId: originalEvent.patientId,
            medicationId: commandId
        });
        const currentScore = analyticsResult.data?.adherenceMetrics.overallAdherenceRate || 0;
        // Estimate impact (simplified calculation)
        const estimatedNewScore = Math.max(0, currentScore - 5); // Undo typically reduces score
        return {
            previousScore: Math.round(currentScore),
            newScore: Math.round(estimatedNewScore),
            streakImpact: 'Streak may be affected by undo action'
        };
    }
    catch (error) {
        console.error('❌ Error calculating undo impact:', error);
        return {
            previousScore: 0,
            newScore: 0,
            streakImpact: 'Unable to calculate impact'
        };
    }
}
exports.default = router;
