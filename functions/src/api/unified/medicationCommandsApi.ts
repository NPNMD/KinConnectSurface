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

import express from 'express';
import * as admin from 'firebase-admin';
import { MedicationOrchestrator } from '../../services/unified/MedicationOrchestrator';
import { MedicationCommandService } from '../../services/unified/MedicationCommandService';
import { MedicationEventService } from '../../services/unified/MedicationEventService';
import { AdherenceAnalyticsService } from '../../services/unified/AdherenceAnalyticsService';
import {
  EnhancedTakeMedicationRequest,
  UndoMedicationRequest,
  ENHANCED_ADHERENCE_EVENT_TYPES
} from '../../schemas/unifiedMedicationSchema';

const router = express.Router();

// Lazy initialization to avoid Firebase Admin initialization order issues
let orchestrator: MedicationOrchestrator;
let commandService: MedicationCommandService;
let adherenceService: AdherenceAnalyticsService;

function getOrchestrator(): MedicationOrchestrator {
  if (!orchestrator) {
    orchestrator = new MedicationOrchestrator();
  }
  return orchestrator;
}

function getCommandService(): MedicationCommandService {
  if (!commandService) {
    commandService = new MedicationCommandService();
  }
  return commandService;
}

function getAdherenceService(): AdherenceAnalyticsService {
  if (!adherenceService) {
    adherenceService = new AdherenceAnalyticsService();
  }
  return adherenceService;
}

// ===== MEDICATION COMMANDS CRUD =====

/**
 * POST /medication-commands
 * Create a new medication with complete workflow
 */
router.post('/', async (req, res) => {
  try {
    console.log('🚀 POST /medication-commands - Creating medication');
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const {
      medicationData,
      scheduleData,
      reminderSettings,
      notifyFamily = false
    } = req.body;

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
    const commandResult = await getCommandService().getCommand(workflowResult.commandId!);
    
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

  } catch (error) {
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
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const {
      patientId,
      status,
      medicationName,
      frequency,
      isActive,
      isPRN,
      limit,
      orderBy,
      orderDirection
    } = req.query;

    // Determine target patient (support family access)
    const targetPatientId = (patientId as string) || userId;
    
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
      status: status as any,
      medicationName: medicationName as string,
      frequency: frequency as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isPRN: isPRN === 'true' ? true : isPRN === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      orderBy: (orderBy as 'name' | 'createdAt' | 'updatedAt') || 'name',
      orderDirection: (orderDirection as 'asc' | 'desc') || 'asc'
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

  } catch (error) {
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
    
    const userId = (req as any).user?.uid;
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

    const command = result.data!;

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

  } catch (error) {
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
    
    const userId = (req as any).user?.uid;
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

  } catch (error) {
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
 * Delete (discontinue) medication command
 */
router.delete('/:commandId', async (req, res) => {
  try {
    console.log('🗑️ DELETE /medication-commands/:id - Deleting medication:', req.params.commandId);
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { commandId } = req.params;
    const { reason = 'Deleted by user' } = req.body;

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

    // Execute status change workflow (discontinue)
    const workflowResult = await getOrchestrator().medicationStatusChangeWorkflow(
      commandId,
      {
        newStatus: 'discontinued',
        reason,
        updatedBy: userId
      },
      {
        notifyFamily: true,
        urgency: 'low'
      }
    );

    if (!workflowResult.success) {
      return res.status(500).json({
        success: false,
        error: workflowResult.error,
        workflowId: workflowResult.workflowId
      });
    }

    res.json({
      success: true,
      workflow: {
        workflowId: workflowResult.workflowId,
        correlationId: workflowResult.correlationId,
        notificationsSent: workflowResult.notificationsSent
      },
      message: 'Medication discontinued successfully'
    });

  } catch (error) {
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
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { commandId } = req.params;
    const requestData: EnhancedTakeMedicationRequest = req.body;

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
    let timingCategory: 'early' | 'on_time' | 'late' | 'very_late';
    if (minutesFromScheduled < -30) timingCategory = 'early';
    else if (minutesFromScheduled <= 30) timingCategory = 'on_time';
    else if (minutesFromScheduled <= 120) timingCategory = 'late';
    else timingCategory = 'very_late';

    // Determine dose type
    let doseType: 'full' | 'partial' | 'adjusted' = 'full';
    if (requestData.doseDetails?.doseAdjustment) {
      doseType = 'adjusted';
    } else if (requestData.doseDetails && requestData.doseDetails.actualDose !== requestData.doseDetails.prescribedDose) {
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
        triggerSource: 'user_action' as const
      },
      notificationOptions: {
        notifyFamily: requestData.notifyFamily || false,
        urgency: (timingCategory === 'very_late' ? 'medium' : 'low') as 'low' | 'medium' | 'high' | 'critical'
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

  } catch (error) {
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
 * Undo accidental medication marking
 */
router.post('/:commandId/undo-take', async (req, res) => {
  try {
    console.log('🔄 POST /medication-commands/:id/undo-take - Undoing medication:', req.params.commandId);
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { commandId } = req.params;
    const undoRequest: UndoMedicationRequest = req.body;

    // Validate required fields
    if (!undoRequest.originalEventId || !undoRequest.undoReason) {
      return res.status(400).json({
        success: false,
        error: 'Original event ID and undo reason are required'
      });
    }

    // Check if undo is still allowed (within 30 seconds)
    const eventService = new MedicationEventService();
    const originalEventResult = await eventService.getEvent(undoRequest.originalEventId);
    
    if (!originalEventResult.success || !originalEventResult.data) {
      return res.status(404).json({
        success: false,
        error: 'Original event not found'
      });
    }

    const originalEvent = originalEventResult.data;
    const timeSinceEvent = Date.now() - originalEvent.timing.eventTimestamp.getTime();
    const undoTimeoutMs = 30 * 1000; // 30 seconds

    if (timeSinceEvent > undoTimeoutMs) {
      return res.status(410).json({
        success: false,
        error: 'Undo timeout expired. Cannot undo after 30 seconds.',
        timeoutExpiredAt: new Date(originalEvent.timing.eventTimestamp.getTime() + undoTimeoutMs)
      });
    }

    // Check access permissions
    if (originalEvent.patientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Execute undo workflow
    // For now, create an undo event directly since the workflow doesn't exist yet
    const undoEventResult = await eventService.createEvent({
      commandId,
      patientId: originalEvent.patientId,
      eventType: ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE,
      eventData: {
        additionalData: {
          undoData: {
            isUndo: true,
            originalEventId: undoRequest.originalEventId,
            undoReason: undoRequest.undoReason,
            undoTimestamp: new Date(),
            correctedAction: undoRequest.correctedAction
          }
        }
      },
      context: {
        medicationName: originalEvent.context.medicationName,
        triggerSource: 'user_action'
      },
      createdBy: userId
    });

    if (!undoEventResult.success) {
      return res.status(500).json({
        success: false,
        error: undoEventResult.error
      });
    }

    const undoWorkflowResult = {
      success: true,
      workflowId: `undo_${Date.now()}`,
      correlationId: `corr_${Date.now()}`,
      eventIds: [undoEventResult.data!.id],
      notificationsSent: 0,
      executionTimeMs: 100
    };

    // Since we're creating the workflow result manually, it should always succeed
    // In a full implementation, this would be handled by a proper undo workflow

    // Calculate adherence impact
    const adherenceImpact = await calculateUndoAdherenceImpact(commandId, originalEvent);

    res.json({
      success: true,
      data: {
        undoEventId: undoWorkflowResult.eventIds[0],
        originalEventId: undoRequest.originalEventId,
        correctedAction: undoRequest.correctedAction,
        adherenceImpact: {
          previousScore: adherenceImpact.previousScore,
          newScore: adherenceImpact.newScore,
          streakImpact: adherenceImpact.streakImpact
        }
      },
      workflow: {
        workflowId: undoWorkflowResult.workflowId,
        correlationId: undoWorkflowResult.correlationId,
        notificationsSent: undoWorkflowResult.notificationsSent,
        executionTimeMs: undoWorkflowResult.executionTimeMs
      },
      message: 'Medication take action undone successfully'
    });

  } catch (error) {
    console.error('❌ Error in POST /medication-commands/:id/undo-take:', error);
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
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { commandId } = req.params;
    const {
      status,
      reason,
      additionalData,
      notifyFamily = true,
      urgency = 'medium'
    } = req.body;

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
    const workflowResult = await getOrchestrator().medicationStatusChangeWorkflow(
      commandId,
      {
        newStatus: status,
        reason,
        updatedBy: userId,
        additionalData
      },
      {
        notifyFamily,
        urgency
      }
    );

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

  } catch (error) {
    console.error('❌ Error in POST /medication-commands/:id/status:', error);
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
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { patientId } = req.query;
    const targetPatientId = (patientId as string) || userId;

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

  } catch (error) {
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
    
    const userId = (req as any).user?.uid;
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

  } catch (error) {
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
async function checkForRecentTakeEvent(commandId: string, scheduledDateTime: Date): Promise<{
  isDuplicate: boolean;
  existingEventId?: string;
}> {
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
  } catch (error) {
    console.error('❌ Error checking for recent take events:', error);
    return { isDuplicate: false };
  }
}

/**
 * Calculate dose accuracy percentage
 */
function calculateDoseAccuracy(doseDetails: any, prescribedDose: string): number {
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
function calculateTimingAccuracy(minutesFromScheduled: number): number {
  const absMinutes = Math.abs(minutesFromScheduled);
  
  if (absMinutes <= 15) return 100;      // Perfect timing
  if (absMinutes <= 30) return 90;       // Good timing
  if (absMinutes <= 60) return 75;       // Acceptable timing
  if (absMinutes <= 120) return 50;      // Poor timing
  return 25;                             // Very poor timing
}

/**
 * Calculate circumstance compliance percentage
 */
function calculateCircumstanceCompliance(circumstances: any): number {
  if (!circumstances) return 100; // No special circumstances required

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
async function calculateUndoAdherenceImpact(commandId: string, originalEvent: any): Promise<{
  previousScore: number;
  newScore: number;
  streakImpact: string;
}> {
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
  } catch (error) {
    console.error('❌ Error calculating undo impact:', error);
    return {
      previousScore: 0,
      newScore: 0,
      streakImpact: 'Unable to calculate impact'
    };
  }
}

export default router;