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
 *
 * Enhanced with:
 * - Structured error responses with error codes
 * - Comprehensive logging with context
 * - Field-specific validation errors
 * - Performance timing and monitoring
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
const medicationMonitoring_1 = require("../../utils/medicationMonitoring");
const serialization_1 = require("../../utils/serialization");
const router = express_1.default.Router();
/**
 * Create structured error response
 */
function createErrorResponse(code, message, details, fieldErrors) {
    return {
        code,
        message,
        details,
        fieldErrors,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
}
/**
 * Log request with context
 */
function logRequest(req, context = {}) {
    console.log('📥 [API Request]', {
        method: req.method,
        path: req.path,
        userId: req.user?.uid,
        timestamp: new Date().toISOString(),
        ...context
    });
}
/**
 * Log response with context
 */
function logResponse(statusCode, context = {}) {
    const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    console.log(`${emoji} [API Response]`, {
        statusCode,
        timestamp: new Date().toISOString(),
        ...context
    });
}
/**
 * Validate required fields
 */
function validateRequiredFields(data, requiredFields) {
    const fieldErrors = {};
    for (const field of requiredFields) {
        if (!data[field]) {
            fieldErrors[field] = `${field} is required`;
        }
    }
    return {
        isValid: Object.keys(fieldErrors).length === 0,
        fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
    };
}
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
 * Enhanced with performance monitoring
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
    const performanceTimer = new medicationMonitoring_1.PerformanceTimer('create', {
        patientId: req.user?.uid,
        endpoint: 'POST /medication-commands'
    });
    try {
        logRequest(req, { requestId, endpoint: 'POST /medication-commands' });
        const userId = req.user?.uid;
        if (!userId) {
            const error = createErrorResponse('AUTH_REQUIRED', 'Authentication required', 'User must be authenticated to create medications');
            logResponse(401, { requestId, error: error.code });
            return res.status(401).json({
                success: false,
                error: error.message,
                errorCode: error.code,
                timestamp: error.timestamp
            });
        }
        const { medicationData, scheduleData, reminderSettings, notifyFamily = false } = req.body;
        console.log('🔍 [Backend] Request payload:', {
            requestId,
            userId,
            medicationName: medicationData?.name,
            scheduleFrequency: scheduleData?.frequency,
            hasFlexibleScheduling: !!scheduleData?.flexibleScheduling,
            timestamp: new Date().toISOString()
        });
        // Enhanced validation with field-specific errors
        const validation = validateRequiredFields({ medicationData, scheduleData }, ['medicationData', 'scheduleData']);
        if (!validation.isValid) {
            const error = createErrorResponse('VALIDATION_ERROR', 'Required fields are missing', 'Request must include medicationData and scheduleData', validation.fieldErrors);
            logResponse(400, { requestId, error: error.code, fieldErrors: error.fieldErrors });
            return res.status(400).json({
                success: false,
                error: error.message,
                errorCode: error.code,
                fieldErrors: error.fieldErrors,
                timestamp: error.timestamp
            });
        }
        // Validate medication data fields
        const medicationValidation = validateRequiredFields(medicationData, ['name']);
        const scheduleValidation = validateRequiredFields(scheduleData, ['frequency']);
        if (!medicationValidation.isValid || !scheduleValidation.isValid) {
            const fieldErrors = {
                ...medicationValidation.fieldErrors,
                ...scheduleValidation.fieldErrors
            };
            const error = createErrorResponse('VALIDATION_ERROR', 'Medication name and schedule frequency are required', 'Missing required fields in medication or schedule data', fieldErrors);
            logResponse(400, { requestId, error: error.code, fieldErrors });
            return res.status(400).json({
                success: false,
                error: error.message,
                errorCode: error.code,
                fieldErrors,
                timestamp: error.timestamp
            });
        }
        // Build scheduleData, filtering out undefined values for Firestore
        const processedScheduleData = {
            ...scheduleData,
            times: scheduleData.times || ['07:00'], // Default time if not provided
            startDate: scheduleData.startDate ? new Date(scheduleData.startDate) : new Date(),
            dosageAmount: scheduleData.dosageAmount || medicationData.dosage || '1 tablet',
            flexibleScheduling: scheduleData.flexibleScheduling ?? false // Explicitly set default to prevent undefined
        };
        // Only include optional fields if they have values
        if (scheduleData.endDate) {
            processedScheduleData.endDate = new Date(scheduleData.endDate);
        }
        if (scheduleData.computedSchedule) {
            processedScheduleData.computedSchedule = {
                ...scheduleData.computedSchedule,
                lastComputedAt: scheduleData.computedSchedule.lastComputedAt
                    ? new Date(scheduleData.computedSchedule.lastComputedAt)
                    : undefined,
                nextRecomputeAt: scheduleData.computedSchedule.nextRecomputeAt
                    ? new Date(scheduleData.computedSchedule.nextRecomputeAt)
                    : undefined
            };
        }
        // Build the workflow request and strip undefined values
        const workflowRequest = {
            patientId: userId,
            medicationData: {
                ...medicationData,
                // Convert prescribedDate string to Date object if present
                prescribedDate: medicationData.prescribedDate
                    ? new Date(medicationData.prescribedDate)
                    : undefined
            },
            scheduleData: processedScheduleData,
            reminderSettings,
            createdBy: userId,
            notifyFamily
        };
        // Strip undefined values before sending to Firestore
        const cleanedWorkflowRequest = (0, serialization_1.deepStripUndefined)(workflowRequest);
        // Execute complete medication creation workflow
        const workflowResult = await getOrchestrator().createMedicationWorkflow(cleanedWorkflowRequest);
        if (!workflowResult.success) {
            const error = createErrorResponse('WORKFLOW_ERROR', workflowResult.error || 'Failed to create medication workflow', { workflowId: workflowResult.workflowId });
            logResponse(500, {
                requestId,
                error: error.code,
                workflowId: workflowResult.workflowId,
                executionTime: Date.now() - startTime
            });
            return res.status(500).json({
                success: false,
                error: error.message,
                errorCode: error.code,
                details: error.details,
                timestamp: error.timestamp
            });
        }
        // Get the created command for response
        const commandResult = await getCommandService().getCommand(workflowResult.commandId);
        const executionTime = Date.now() - startTime;
        logResponse(201, {
            requestId,
            commandId: commandResult.data?.id,
            workflowId: workflowResult.workflowId,
            eventsCreated: workflowResult.eventIds.length,
            executionTime
        });
        // Track performance metrics
        await performanceTimer.end(true);
        // Track medication creation specifically
        await (0, medicationMonitoring_1.trackMedicationOperation)('create', userId, true, executionTime, commandResult.data?.id, medicationData.name, undefined, undefined, {
            workflowId: workflowResult.workflowId,
            eventsCreated: workflowResult.eventIds.length
        });
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
            message: 'Medication created successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ [Backend] Error in POST /medication-commands:', {
            requestId,
            error,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            message: errorMessage,
            executionTime,
            timestamp: new Date().toISOString()
        });
        const structuredError = createErrorResponse('INTERNAL_ERROR', 'Internal server error', errorMessage);
        logResponse(500, { requestId, error: structuredError.code, executionTime });
        // Track failed operation
        await performanceTimer.end(false, structuredError.code, errorMessage);
        await (0, medicationMonitoring_1.trackMedicationOperation)('create', req.user?.uid || 'unknown', false, executionTime, undefined, req.body.medicationData?.name, structuredError.code, errorMessage);
        res.status(500).json({
            success: false,
            error: structuredError.message,
            errorCode: structuredError.code,
            details: structuredError.details,
            timestamp: structuredError.timestamp,
            requestId
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
            orderBy: orderBy || 'createdAt', // Default to createdAt to avoid index requirements
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
            legacyMedicationsDeleted: 0,
            schedulesDeleted: 0,
            calendarEventsDeleted: 0,
            remindersDeleted: 0,
            notificationsDeleted: 0,
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
                // Step 3: Query legacy collections for cascade cleanup
                console.log('📋 Step 3: Querying legacy collections for commandId:', commandId);
                // Query legacy medications collection
                const legacyMedicationsQuery = await db.collection('medications')
                    .where('patientId', '==', command.patientId)
                    .where('name', '==', command.medication.name)
                    .get();
                // Query medication schedules
                const schedulesQuery = await db.collection('medication_schedules')
                    .where('medicationId', '==', commandId)
                    .get();
                // Query medication calendar events
                const calendarEventsQuery = await db.collection('medication_calendar_events')
                    .where('medicationId', '==', commandId)
                    .get();
                // Query medication reminders
                const remindersQuery = await db.collection('medication_reminders')
                    .where('medicationId', '==', commandId)
                    .get();
                // Query notification collections
                const notificationDeliveryQuery = await db.collection('medication_notification_delivery_log')
                    .where('medicationId', '==', commandId)
                    .get();
                const notificationQueueQuery = await db.collection('medication_notification_queue')
                    .where('medicationId', '==', commandId)
                    .get();
                console.log(`📊 Legacy cleanup: ${legacyMedicationsQuery.docs.length} medications, ${schedulesQuery.docs.length} schedules, ${calendarEventsQuery.docs.length} calendar events, ${remindersQuery.docs.length} reminders, ${notificationDeliveryQuery.docs.length} delivery logs, ${notificationQueueQuery.docs.length} queued notifications`);
                // Store counts for response
                deletionResults.legacyMedicationsDeleted = legacyMedicationsQuery.docs.length;
                deletionResults.schedulesDeleted = schedulesQuery.docs.length;
                deletionResults.calendarEventsDeleted = calendarEventsQuery.docs.length;
                deletionResults.remindersDeleted = remindersQuery.docs.length;
                deletionResults.notificationsDeleted = notificationDeliveryQuery.docs.length + notificationQueueQuery.docs.length;
                // Step 4: Delete all events in transaction
                console.log('🗑️ Step 4: Deleting medication_events...');
                eventsQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                // Step 5: Delete archived events
                console.log('🗑️ Step 5: Deleting archived events...');
                archivedEventsQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                // Step 6: Delete legacy collections
                console.log('🗑️ Step 6: Deleting legacy medication data...');
                legacyMedicationsQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                console.log('🗑️ Step 7: Deleting medication schedules...');
                schedulesQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                console.log('🗑️ Step 8: Deleting medication calendar events...');
                calendarEventsQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                console.log('🗑️ Step 9: Deleting medication reminders...');
                remindersQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                console.log('🗑️ Step 10: Deleting notification delivery logs...');
                notificationDeliveryQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                console.log('🗑️ Step 11: Deleting queued notifications...');
                notificationQueueQuery.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
                // Step 7: Handle command deletion based on hardDelete flag
                if (hardDelete) {
                    // Hard delete: Remove the command document entirely
                    console.log('🗑️ Step 12: HARD DELETE - Removing command document');
                    const commandRef = db.collection('medication_commands').doc(commandId);
                    transaction.delete(commandRef);
                    deletionResults.commandDeleted = true;
                }
                else {
                    // Soft delete: Mark as discontinued (default behavior)
                    console.log('🗑️ Step 12: SOFT DELETE - Marking command as discontinued');
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
                // Step 8: Update migration tracking
                console.log('📊 Step 13: Updating migration tracking...');
                const trackingRef = db.collection('migration_tracking').doc('medication_system');
                const trackingDoc = await transaction.get(trackingRef);
                if (trackingDoc.exists) {
                    const trackingData = trackingDoc.data();
                    const currentStats = trackingData?.statistics || {};
                    transaction.update(trackingRef, {
                        'statistics.totalDeleted': (currentStats.totalDeleted || 0) + 1,
                        'statistics.eventsDeleted': (currentStats.eventsDeleted || 0) + deletionResults.eventsDeleted,
                        'statistics.archivedEventsDeleted': (currentStats.archivedEventsDeleted || 0) + deletionResults.archivedEventsDeleted,
                        'statistics.legacyMedicationsDeleted': (currentStats.legacyMedicationsDeleted || 0) + legacyMedicationsQuery.docs.length,
                        'statistics.schedulesDeleted': (currentStats.schedulesDeleted || 0) + schedulesQuery.docs.length,
                        'statistics.calendarEventsDeleted': (currentStats.calendarEventsDeleted || 0) + calendarEventsQuery.docs.length,
                        'statistics.remindersDeleted': (currentStats.remindersDeleted || 0) + remindersQuery.docs.length,
                        'lastOperation': {
                            type: 'cascade_delete_unified',
                            commandId,
                            deletedBy: userId,
                            timestamp: new Date(),
                            eventsDeleted: deletionResults.eventsDeleted,
                            archivedEventsDeleted: deletionResults.archivedEventsDeleted,
                            legacyCleanup: {
                                medications: legacyMedicationsQuery.docs.length,
                                schedules: schedulesQuery.docs.length,
                                calendarEvents: calendarEventsQuery.docs.length,
                                reminders: remindersQuery.docs.length,
                                notifications: notificationDeliveryQuery.docs.length + notificationQueueQuery.docs.length
                            },
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
        // Calculate comprehensive deletion stats
        const totalLegacyItemsDeleted = deletionResults.legacyMedicationsDeleted + deletionResults.schedulesDeleted + deletionResults.calendarEventsDeleted + deletionResults.remindersDeleted + deletionResults.notificationsDeleted;
        res.json({
            success: true,
            data: {
                commandId,
                deleteType: hardDelete ? 'hard' : 'soft',
                deletionResults: {
                    commandDeleted: deletionResults.commandDeleted,
                    eventsDeleted: deletionResults.eventsDeleted,
                    archivedEventsDeleted: deletionResults.archivedEventsDeleted,
                    legacyMedicationsDeleted: deletionResults.legacyMedicationsDeleted,
                    schedulesDeleted: deletionResults.schedulesDeleted,
                    calendarEventsDeleted: deletionResults.calendarEventsDeleted,
                    remindersDeleted: deletionResults.remindersDeleted,
                    notificationsDeleted: deletionResults.notificationsDeleted,
                    totalUnifiedItemsDeleted: deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted + 1,
                    totalLegacyItemsDeleted,
                    totalItemsDeleted: deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted + 1 + totalLegacyItemsDeleted
                }
            },
            message: `Medication ${hardDelete ? 'deleted' : 'discontinued'} successfully with complete cascade cleanup: ${deletionResults.eventsDeleted + deletionResults.archivedEventsDeleted} events and ${totalLegacyItemsDeleted} legacy items removed`
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
// ===== MIGRATION ENDPOINTS =====
/**
 * POST /medication-commands/migrate-from-legacy
 * Migrate all legacy medications to medication_commands collection
 */
router.post('/migrate-from-legacy', async (req, res) => {
    try {
        console.log('🚀 POST /medication-commands/migrate-from-legacy - Starting migration');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, dryRun = false } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const db = admin.firestore();
        const stats = {
            totalMedications: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
        console.log(`📊 Starting migration for patient: ${targetPatientId}, dryRun: ${dryRun}`);
        // Get all medications from legacy collection for this patient
        const medicationsSnapshot = await db.collection('medications')
            .where('patientId', '==', targetPatientId)
            .get();
        stats.totalMedications = medicationsSnapshot.docs.length;
        console.log(`📊 Found ${stats.totalMedications} medications to migrate`);
        // Process each medication
        for (const medDoc of medicationsSnapshot.docs) {
            const medicationId = medDoc.id;
            const medicationData = medDoc.data();
            try {
                console.log(`🔄 Processing: ${medicationData.name} (${medicationId})`);
                // Check if already migrated
                const existingCommand = await db.collection('medication_commands')
                    .doc(medicationId)
                    .get();
                if (existingCommand.exists) {
                    console.log(`  ⏭️  Already migrated, skipping...`);
                    stats.skipped++;
                    continue;
                }
                // Get associated schedule
                const scheduleSnapshot = await db.collection('medication_schedules')
                    .where('medicationId', '==', medicationId)
                    .where('isActive', '==', true)
                    .limit(1)
                    .get();
                const scheduleData = scheduleSnapshot.empty ? null : scheduleSnapshot.docs[0].data();
                // Get associated reminder
                const reminderSnapshot = await db.collection('medication_reminders')
                    .where('medicationId', '==', medicationId)
                    .where('isActive', '==', true)
                    .limit(1)
                    .get();
                const reminderData = reminderSnapshot.empty ? null : reminderSnapshot.docs[0].data();
                // Determine medication type
                const medicationType = classifyMedicationType(medicationData.name, medicationData.frequency || 'daily');
                // Map frequency
                const unifiedFrequency = mapFrequency(medicationData.frequency || scheduleData?.frequency || 'daily');
                // Generate times
                const times = scheduleData?.times ||
                    medicationData.reminderTimes ||
                    generateDefaultTimes(unifiedFrequency);
                // Build unified medication command
                const medicationCommand = {
                    id: medicationId,
                    patientId: medicationData.patientId,
                    medication: {
                        name: medicationData.name,
                        genericName: medicationData.genericName,
                        brandName: medicationData.brandName,
                        dosage: medicationData.dosage || '1 tablet',
                        instructions: medicationData.instructions,
                        prescribedBy: medicationData.prescribedBy,
                        prescribedDate: medicationData.prescribedDate?.toDate() || null
                    },
                    schedule: {
                        frequency: unifiedFrequency,
                        times: times,
                        startDate: scheduleData?.startDate?.toDate() ||
                            medicationData.startDate?.toDate() ||
                            medicationData.createdAt?.toDate() ||
                            new Date(),
                        endDate: scheduleData?.endDate?.toDate() || medicationData.endDate?.toDate() || null,
                        isIndefinite: scheduleData?.isIndefinite !== false,
                        dosageAmount: scheduleData?.dosageAmount || medicationData.dosage || '1 tablet',
                        timingType: 'absolute'
                    },
                    reminders: {
                        enabled: reminderData?.isActive || medicationData.hasReminders || false,
                        minutesBefore: reminderData?.reminderTimes || [15, 5],
                        notificationMethods: reminderData?.notificationMethods || ['browser'],
                        quietHours: {
                            start: '22:00',
                            end: '07:00',
                            enabled: true
                        }
                    },
                    gracePeriod: {
                        defaultMinutes: getGracePeriod(medicationType),
                        medicationType: medicationType,
                        weekendMultiplier: 1.5,
                        holidayMultiplier: 2.0
                    },
                    status: {
                        current: medicationData.isActive === false ? 'discontinued' :
                            scheduleData?.isPaused ? 'paused' : 'active',
                        isActive: medicationData.isActive !== false,
                        isPRN: medicationData.isPRN || medicationData.frequency === 'as_needed' || false,
                        lastStatusChange: admin.firestore.Timestamp.now(),
                        statusChangedBy: 'migration_script'
                    },
                    preferences: {
                        timeSlot: determineTimeSlot(times[0]),
                        separationRules: []
                    },
                    metadata: {
                        version: 1,
                        createdAt: medicationData.createdAt?.toDate() || new Date(),
                        createdBy: 'migration_script',
                        updatedAt: admin.firestore.Timestamp.now(),
                        updatedBy: 'migration_script',
                        checksum: generateChecksum(medicationId, medicationData.name, unifiedFrequency),
                        migratedFrom: {
                            medicationId: medicationId,
                            scheduleId: scheduleSnapshot.empty ? null : scheduleSnapshot.docs[0].id,
                            reminderId: reminderSnapshot.empty ? null : reminderSnapshot.docs[0].id,
                            migratedAt: admin.firestore.Timestamp.now()
                        }
                    }
                };
                if (!dryRun) {
                    // Write to medication_commands collection
                    await db.collection('medication_commands').doc(medicationId).set(medicationCommand);
                    console.log(`  ✅ Successfully migrated`);
                }
                else {
                    console.log(`  ✅ [DRY RUN] Would migrate`);
                }
                stats.successful++;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`  ❌ Failed: ${errorMessage}`);
                stats.failed++;
                stats.errors.push({ medicationId, error: errorMessage });
            }
        }
        console.log('\n📊 Migration Summary:');
        console.log(`  Total: ${stats.totalMedications}`);
        console.log(`  ✅ Successful: ${stats.successful}`);
        console.log(`  ⏭️  Skipped: ${stats.skipped}`);
        console.log(`  ❌ Failed: ${stats.failed}`);
        res.json({
            success: true,
            data: stats,
            message: dryRun
                ? `DRY RUN: Would migrate ${stats.successful} medications`
                : `Migration completed: ${stats.successful} medications migrated successfully`
        });
    }
    catch (error) {
        console.error('❌ Error in migration endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Helper functions for migration
function classifyMedicationType(name, frequency) {
    const nameLower = name.toLowerCase();
    if (frequency === 'as_needed')
        return 'prn';
    const criticalMeds = ['insulin', 'warfarin', 'digoxin', 'levothyroxine', 'phenytoin'];
    if (criticalMeds.some(med => nameLower.includes(med)))
        return 'critical';
    const vitaminMeds = ['vitamin', 'multivitamin', 'calcium', 'iron', 'supplement'];
    if (vitaminMeds.some(med => nameLower.includes(med)))
        return 'vitamin';
    return 'standard';
}
function mapFrequency(frequency) {
    const freqLower = frequency.toLowerCase().trim();
    if (freqLower.includes('twice') || freqLower.includes('bid') || freqLower.includes('2x')) {
        return 'twice_daily';
    }
    else if (freqLower.includes('three') || freqLower.includes('tid') || freqLower.includes('3x')) {
        return 'three_times_daily';
    }
    else if (freqLower.includes('four') || freqLower.includes('qid') || freqLower.includes('4x')) {
        return 'four_times_daily';
    }
    else if (freqLower.includes('weekly')) {
        return 'weekly';
    }
    else if (freqLower.includes('monthly')) {
        return 'monthly';
    }
    else if (freqLower.includes('needed') || freqLower.includes('prn')) {
        return 'as_needed';
    }
    return 'daily';
}
function generateDefaultTimes(frequency) {
    switch (frequency) {
        case 'daily': return ['08:00'];
        case 'twice_daily': return ['08:00', '20:00'];
        case 'three_times_daily': return ['08:00', '14:00', '20:00'];
        case 'four_times_daily': return ['08:00', '12:00', '17:00', '22:00'];
        case 'weekly':
        case 'monthly': return ['08:00'];
        case 'as_needed': return [];
        default: return ['08:00'];
    }
}
function getGracePeriod(type) {
    const periods = {
        critical: 15,
        standard: 30,
        vitamin: 120,
        prn: 0
    };
    return periods[type];
}
function determineTimeSlot(time) {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 6 && hour < 11)
        return 'morning';
    if (hour >= 11 && hour < 15)
        return 'lunch';
    if (hour >= 17 && hour < 21)
        return 'evening';
    if (hour >= 21 || hour < 6)
        return 'beforeBed';
    return 'custom';
}
function generateChecksum(id, name, frequency) {
    const data = `${id}_${name}_${frequency}_${Date.now()}`;
    return Buffer.from(data).toString('base64').slice(0, 16);
}
exports.default = router;
