/**
 * MedicationOrchestrator
 *
 * Single Responsibility: ONLY coordinates between services
 *
 * This service is responsible for:
 * - Orchestrating complex medication workflows
 * - Coordinating between Command, Event, Notification, and Transaction services
 * - Managing business logic and service interactions
 * - Ensuring proper service call sequences
 * - Handling cross-service error scenarios
 *
 * This service does NOT:
 * - Directly modify data (delegates to appropriate services)
 * - Handle low-level transactions (delegates to TransactionManager)
 * - Send notifications directly (delegates to NotificationService)
 * - Validate data directly (delegates to individual services)
 */

import * as admin from 'firebase-admin';
import {
  MedicationCommand,
  MedicationEvent,
  MedicationEventType,
  MEDICATION_EVENT_TYPES,
  UnifiedFamilyAccess,
  UndoMedicationRequest,
  generateCorrelationId
} from '../../schemas/unifiedMedicationSchema';

import { MedicationCommandService, CreateMedicationCommandRequest } from './MedicationCommandService';
import { MedicationEventService, CreateEventRequest } from './MedicationEventService';
import { MedicationNotificationService, NotificationRequest } from './MedicationNotificationService';
import { MedicationTransactionManager } from './MedicationTransactionManager';
import { MedicationUndoService } from './MedicationUndoService';

export interface CreateMedicationWorkflowRequest {
  patientId: string;
  medicationData: {
    name: string;
    genericName?: string;
    brandName?: string;
    rxcui?: string;
    dosage: string;
    strength?: string;
    dosageForm?: string;
    route?: string;
    instructions?: string;
    prescribedBy?: string;
    prescribedDate?: Date;
  };
  scheduleData: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
    times: string[];
    startDate: Date;
    endDate?: Date;
    dosageAmount: string;
  };
  reminderSettings?: {
    enabled: boolean;
    minutesBefore?: number[];
    notificationMethods?: ('email' | 'sms' | 'push' | 'browser')[];
  };
  createdBy: string;
  notifyFamily?: boolean;
}

export interface MarkMedicationTakenWorkflowRequest {
  commandId: string;
  eventData: {
    takenAt: Date;
    takenBy: string;
    notes?: string;
    scheduledDateTime: Date;
  };
  context: {
    medicationName: string;
    calendarEventId?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  notificationOptions?: {
    notifyFamily: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  correlationId: string;
  commandId?: string;
  eventIds: string[];
  notificationsSent: number;
  transactionId?: string;
  error?: string;
  warnings?: string[];
  executionTimeMs: number;
}

export class MedicationOrchestrator {
  private commandService: MedicationCommandService;
  private eventService: MedicationEventService;
  private notificationService: MedicationNotificationService;
  private transactionManager: MedicationTransactionManager;
  private undoService: MedicationUndoService;

  constructor() {
    this.commandService = new MedicationCommandService();
    this.eventService = new MedicationEventService();
    this.notificationService = new MedicationNotificationService();
    this.transactionManager = new MedicationTransactionManager();
    this.undoService = new MedicationUndoService();
  }

  // ===== MEDICATION LIFECYCLE WORKFLOWS =====

  /**
   * Complete workflow for creating a new medication
   */
  async createMedicationWorkflow(request: CreateMedicationWorkflowRequest): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    const correlationId = generateCorrelationId();

    console.log('🚀 MedicationOrchestrator: Starting create medication workflow:', workflowId);

    try {
      // Phase 1: Create medication command
      console.log('📝 Phase 1: Creating medication command');
      
      const commandRequest: CreateMedicationCommandRequest = {
        patientId: request.patientId,
        medicationData: request.medicationData,
        scheduleData: {
          ...request.scheduleData,
          isIndefinite: !request.scheduleData.endDate
        },
        reminderData: request.reminderSettings,
        createdBy: request.createdBy
      };

      const commandResult = await this.commandService.createCommand(commandRequest);

      if (!commandResult.success || !commandResult.data) {
        return {
          success: false,
          workflowId,
          correlationId,
          eventIds: [],
          notificationsSent: 0,
          error: `Failed to create medication command: ${commandResult.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      const command = commandResult.data;
      console.log('✅ Phase 1 complete: Command created:', command.id);

      // Phase 2: Create initial events
      console.log('📝 Phase 2: Creating initial events');
      
      const initialEvents: CreateEventRequest[] = [
        {
          commandId: command.id,
          patientId: request.patientId,
          eventType: MEDICATION_EVENT_TYPES.MEDICATION_CREATED,
          eventData: {
            additionalData: {
              medicationData: request.medicationData,
              scheduleData: request.scheduleData
            }
          },
          context: {
            medicationName: request.medicationData.name,
            triggerSource: 'user_action'
          },
          createdBy: request.createdBy,
          correlationId
        }
      ];

      // Add schedule creation event if reminders are enabled
      if (request.reminderSettings?.enabled !== false) {
        initialEvents.push({
          commandId: command.id,
          patientId: request.patientId,
          eventType: MEDICATION_EVENT_TYPES.SCHEDULE_CREATED,
          eventData: {
            additionalData: request.scheduleData
          },
          context: {
            medicationName: request.medicationData.name,
            triggerSource: 'user_action'
          },
          createdBy: request.createdBy,
          correlationId
        });
      }

      const eventsResult = await this.eventService.createEventsBatch(initialEvents);

      if (!eventsResult.success || !eventsResult.data) {
        // Rollback command creation
        await this.commandService.deleteCommand(command.id, 'system', 'Event creation failed');
        
        return {
          success: false,
          workflowId,
          correlationId,
          commandId: command.id,
          eventIds: [],
          notificationsSent: 0,
          error: `Failed to create initial events: ${eventsResult.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      const eventIds = eventsResult.data.created.map(e => e.id);
      console.log('✅ Phase 2 complete: Events created:', eventIds.length);

      // Phase 3: Generate scheduled dose events for the next 30 days
      console.log('📝 Phase 3: Generating scheduled dose events');
      
      const scheduledEvents = await this.generateScheduledDoseEvents(command, correlationId);
      console.log('✅ Phase 3 complete: Scheduled events generated:', scheduledEvents.length);

      // Phase 4: Send notifications if requested
      let notificationsSent = 0;
      
      if (request.notifyFamily) {
        console.log('📝 Phase 4: Sending family notifications');
        
        const familyMembers = await this.getFamilyMembers(request.patientId);
        
        if (familyMembers.length > 0) {
          const notificationRequest: NotificationRequest = {
            patientId: request.patientId,
            commandId: command.id,
            medicationName: request.medicationData.name,
            notificationType: 'status_change',
            urgency: 'low',
            title: 'New Medication Added',
            message: `${request.medicationData.name} has been added to the medication list.`,
            recipients: familyMembers.map(fm => ({
              userId: fm.familyMemberId,
              name: fm.familyMemberName,
              email: fm.familyMemberEmail,
              preferredMethods: ['email', 'browser'],
              isPatient: false,
              isFamilyMember: true,
              isEmergencyContact: fm.permissions.isEmergencyContact
            })),
            context: {
              correlationId,
              triggerSource: 'user_action'
            }
          };

          const notificationResult = await this.notificationService.sendNotification(notificationRequest);
          notificationsSent = notificationResult.data?.totalSent || 0;
        }
      }

      const executionTime = Date.now() - startTime;

      console.log('✅ Create medication workflow completed successfully:', workflowId, `${executionTime}ms`);

      return {
        success: true,
        workflowId,
        correlationId,
        commandId: command.id,
        eventIds: [...eventIds, ...scheduledEvents],
        notificationsSent,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Create medication workflow failed:', error);
      
      return {
        success: false,
        workflowId,
        correlationId,
        eventIds: [],
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Workflow failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Complete workflow for marking medication as taken
   */
  async markMedicationTakenWorkflow(request: MarkMedicationTakenWorkflowRequest): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    const correlationId = generateCorrelationId();

    console.log('🚀 MedicationOrchestrator: Starting mark taken workflow:', workflowId);

    try {
      // Calculate timing metrics
      const scheduledTime = request.eventData.scheduledDateTime;
      const takenTime = request.eventData.takenAt;
      const minutesLate = Math.max(0, Math.floor((takenTime.getTime() - scheduledTime.getTime()) / (1000 * 60)));
      const isOnTime = minutesLate <= 30; // Within 30 minutes is considered on time

      // Phase 1: Execute dose transaction (atomic)
      console.log('📝 Phase 1: Executing dose transaction');
      
      const transactionResult = await this.transactionManager.executeDoseTransaction(
        request.commandId,
        {
          takenAt: request.eventData.takenAt,
          takenBy: request.eventData.takenBy,
          notes: request.eventData.notes,
          dosageAmount: '', // Will be filled from command
          scheduledDateTime: request.eventData.scheduledDateTime,
          isOnTime,
          minutesLate
        },
        request.context
      );

      if (!transactionResult.success) {
        return {
          success: false,
          workflowId,
          correlationId,
          eventIds: [],
          notificationsSent: 0,
          transactionId: transactionResult.transactionId,
          error: `Dose transaction failed: ${transactionResult.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      console.log('✅ Phase 1 complete: Dose transaction executed');

      // Phase 2: Send notifications if configured
      let notificationsSent = 0;
      
      if (request.notificationOptions?.notifyFamily) {
        console.log('📝 Phase 2: Sending family notifications');
        
        const familyMembers = await this.getFamilyMembers(request.eventData.takenBy);
        
        if (familyMembers.length > 0) {
          const notificationRequest: NotificationRequest = {
            patientId: request.eventData.takenBy,
            commandId: request.commandId,
            medicationName: request.context.medicationName,
            notificationType: 'status_change',
            urgency: request.notificationOptions.urgency,
            title: 'Medication Taken',
            message: `${request.context.medicationName} was taken${isOnTime ? ' on time' : ` ${minutesLate} minutes late`}.`,
            recipients: familyMembers
              .filter(fm => fm.permissions.canReceiveAlerts)
              .map(fm => ({
                userId: fm.familyMemberId,
                name: fm.familyMemberName,
                email: fm.familyMemberEmail,
                preferredMethods: ['browser'],
                isPatient: false,
                isFamilyMember: true,
                isEmergencyContact: fm.permissions.isEmergencyContact
              })),
            context: {
              correlationId,
              triggerSource: 'user_action',
              medicationData: {
                dosageAmount: '', // Will be filled from command
                scheduledTime: request.eventData.scheduledDateTime
              }
            }
          };

          const notificationResult = await this.notificationService.sendNotification(notificationRequest);
          notificationsSent = notificationResult.data?.totalSent || 0;
        }
      }

      const executionTime = Date.now() - startTime;

      console.log('✅ Mark taken workflow completed successfully:', workflowId, `${executionTime}ms`);

      return {
        success: true,
        workflowId,
        correlationId,
        commandId: request.commandId,
        eventIds: [transactionResult.correlationId], // Use correlation ID as event reference
        notificationsSent,
        transactionId: transactionResult.transactionId,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Mark taken workflow failed:', error);
      
      return {
        success: false,
        workflowId,
        correlationId,
        commandId: request.commandId,
        eventIds: [],
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Workflow failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Workflow for processing missed medications
   */
  async processMissedMedicationWorkflow(
    commandId: string,
    missedEventData: {
      scheduledDateTime: Date;
      gracePeriodEnd: Date;
      detectionMethod: 'automatic' | 'manual';
      detectedBy: string;
    }
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    const correlationId = generateCorrelationId();

    console.log('🚀 MedicationOrchestrator: Starting missed medication workflow:', workflowId);

    try {
      // Phase 1: Get command details
      const commandResult = await this.commandService.getCommand(commandId);
      
      if (!commandResult.success || !commandResult.data) {
        return {
          success: false,
          workflowId,
          correlationId,
          commandId,
          eventIds: [],
          notificationsSent: 0,
          error: 'Command not found',
          executionTimeMs: Date.now() - startTime
        };
      }

      const command = commandResult.data;

      // Phase 2: Create missed medication event
      console.log('📝 Phase 2: Creating missed medication event');
      
      const missedEventRequest: CreateEventRequest = {
        commandId,
        patientId: command.patientId,
        eventType: MEDICATION_EVENT_TYPES.DOSE_MISSED,
        eventData: {
          scheduledDateTime: missedEventData.scheduledDateTime,
          additionalData: {
            detectionMethod: missedEventData.detectionMethod,
            gracePeriodEnd: missedEventData.gracePeriodEnd
          }
        },
        context: {
          medicationName: command.medication.name,
          triggerSource: missedEventData.detectionMethod === 'automatic' ? 'system_detection' : 'user_action'
        },
        timing: {
          scheduledFor: missedEventData.scheduledDateTime,
          gracePeriodEnd: missedEventData.gracePeriodEnd,
          isWithinGracePeriod: false
        },
        createdBy: missedEventData.detectedBy,
        correlationId
      };

      const eventResult = await this.eventService.createEvent(missedEventRequest);

      if (!eventResult.success || !eventResult.data) {
        return {
          success: false,
          workflowId,
          correlationId,
          commandId,
          eventIds: [],
          notificationsSent: 0,
          error: `Failed to create missed event: ${eventResult.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      const eventId = eventResult.data.id;
      console.log('✅ Phase 2 complete: Missed event created:', eventId);

      // Phase 3: Send notifications
      console.log('📝 Phase 3: Sending missed medication notifications');
      
      const recipients = await this.buildNotificationRecipients(command.patientId, 'missed');
      let notificationsSent = 0;

      if (recipients.length > 0) {
        const notificationRequest: NotificationRequest = {
          patientId: command.patientId,
          commandId,
          medicationName: command.medication.name,
          notificationType: 'missed',
          urgency: command.gracePeriod.medicationType === 'critical' ? 'high' : 'medium',
          title: 'Missed Medication Alert',
          message: `${command.medication.name} dose was missed. Scheduled for ${missedEventData.scheduledDateTime.toLocaleTimeString()}.`,
          recipients,
          context: {
            eventId,
            correlationId,
            triggerSource: 'missed_detection',
            medicationData: {
              dosageAmount: command.schedule.dosageAmount,
              scheduledTime: missedEventData.scheduledDateTime,
              gracePeriodEnd: missedEventData.gracePeriodEnd
            }
          }
        };

        const notificationResult = await this.notificationService.sendNotification(notificationRequest);
        notificationsSent = notificationResult.data?.totalSent || 0;
      }

      const executionTime = Date.now() - startTime;

      console.log('✅ Missed medication workflow completed:', workflowId, `${executionTime}ms`);

      return {
        success: true,
        workflowId,
        correlationId,
        commandId,
        eventIds: [eventId],
        notificationsSent,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Missed medication workflow failed:', error);
      
      return {
        success: false,
        workflowId,
        correlationId,
        commandId,
        eventIds: [],
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Workflow failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Workflow for medication status changes (pause, resume, discontinue)
   */
  async medicationStatusChangeWorkflow(
    commandId: string,
    statusChange: {
      newStatus: 'active' | 'paused' | 'held' | 'discontinued' | 'completed';
      reason: string;
      updatedBy: string;
      additionalData?: any;
    },
    notificationOptions?: {
      notifyFamily: boolean;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    const correlationId = generateCorrelationId();

    console.log('🚀 MedicationOrchestrator: Starting status change workflow:', workflowId);

    try {
      // Phase 1: Get current command
      const commandResult = await this.commandService.getCommand(commandId);
      
      if (!commandResult.success || !commandResult.data) {
        return {
          success: false,
          workflowId,
          correlationId,
          commandId,
          eventIds: [],
          notificationsSent: 0,
          error: 'Command not found',
          executionTimeMs: Date.now() - startTime
        };
      }

      const command = commandResult.data;
      const previousStatus = command.status.current;

      // Phase 2: Execute status change transaction
      console.log('📝 Phase 2: Executing status change transaction');
      
      const transactionResult = await this.transactionManager.executeStatusChangeTransaction(
        commandId,
        statusChange,
        {
          medicationName: command.medication.name,
          previousStatus
        }
      );

      if (!transactionResult.success) {
        return {
          success: false,
          workflowId,
          correlationId,
          commandId,
          eventIds: [],
          notificationsSent: 0,
          transactionId: transactionResult.transactionId,
          error: `Status change transaction failed: ${transactionResult.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      console.log('✅ Phase 2 complete: Status change transaction executed');

      // Phase 3: Send notifications if requested
      let notificationsSent = 0;
      
      if (notificationOptions?.notifyFamily) {
        console.log('📝 Phase 3: Sending status change notifications');
        
        const recipients = await this.buildNotificationRecipients(command.patientId, 'status_change');
        
        if (recipients.length > 0) {
          const notificationRequest: NotificationRequest = {
            patientId: command.patientId,
            commandId,
            medicationName: command.medication.name,
            notificationType: 'status_change',
            urgency: notificationOptions.urgency,
            title: 'Medication Status Changed',
            message: `${command.medication.name} status changed from ${previousStatus} to ${statusChange.newStatus}. Reason: ${statusChange.reason}`,
            recipients,
            context: {
              correlationId,
              triggerSource: 'user_action'
            }
          };

          const notificationResult = await this.notificationService.sendNotification(notificationRequest);
          notificationsSent = notificationResult.data?.totalSent || 0;
        }
      }

      const executionTime = Date.now() - startTime;

      console.log('✅ Status change workflow completed:', workflowId, `${executionTime}ms`);

      return {
        success: true,
        workflowId,
        correlationId,
        commandId,
        eventIds: [transactionResult.correlationId],
        notificationsSent,
        transactionId: transactionResult.transactionId,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Status change workflow failed:', error);
      
      return {
        success: false,
        workflowId,
        correlationId,
        commandId,
        eventIds: [],
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Workflow failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Workflow for undoing medication events
   */
  async undoMedicationWorkflow(
    commandId: string,
    undoRequest: UndoMedicationRequest,
    notificationOptions?: {
      notifyFamily: boolean;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    const correlationId = generateCorrelationId();

    console.log('🚀 MedicationOrchestrator: Starting undo medication workflow:', workflowId);

    try {
      // Phase 1: Get command details
      const commandResult = await this.commandService.getCommand(commandId);
      
      if (!commandResult.success || !commandResult.data) {
        return {
          success: false,
          workflowId,
          correlationId,
          commandId,
          eventIds: [],
          notificationsSent: 0,
          error: 'Command not found',
          executionTimeMs: Date.now() - startTime
        };
      }

      const command = commandResult.data;

      // Phase 2: Execute undo through UndoService
      console.log('📝 Phase 2: Executing undo operation');
      
      const undoResult = await this.undoService.undoMedicationEvent(undoRequest);

      if (!undoResult.success) {
        return {
          success: false,
          workflowId,
          correlationId,
          commandId,
          eventIds: [],
          notificationsSent: 0,
          error: `Undo operation failed: ${undoResult.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      console.log('✅ Phase 2 complete: Undo operation executed');

      // Phase 3: Send notifications if configured
      let notificationsSent = 0;
      
      if (notificationOptions?.notifyFamily) {
        console.log('📝 Phase 3: Sending undo notifications');
        
        const recipients = await this.buildNotificationRecipients(command.patientId, 'status_change');
        
        if (recipients.length > 0) {
          const notificationRequest: NotificationRequest = {
            patientId: command.patientId,
            commandId,
            medicationName: command.medication.name,
            notificationType: 'status_change',
            urgency: notificationOptions.urgency,
            title: 'Medication Action Undone',
            message: `${command.medication.name} dose marking was undone. Reason: ${undoRequest.undoReason}`,
            recipients,
            context: {
              correlationId,
              triggerSource: 'user_action'
            }
          };

          const notificationResult = await this.notificationService.sendNotification(notificationRequest);
          notificationsSent = notificationResult.data?.totalSent || 0;
        }
      }

      const executionTime = Date.now() - startTime;

      console.log('✅ Undo medication workflow completed:', workflowId, `${executionTime}ms`);

      return {
        success: true,
        workflowId,
        correlationId,
        commandId,
        eventIds: [undoResult.undoEventId || ''],
        notificationsSent,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Undo medication workflow failed:', error);
      
      return {
        success: false,
        workflowId,
        correlationId,
        commandId,
        eventIds: [],
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Workflow failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  // ===== SCHEDULED OPERATIONS =====

  /**
   * Process missed medication detection (scheduled workflow)
   */
  async processMissedMedicationDetection(): Promise<{
    success: boolean;
    workflowsExecuted: number;
    medicationsProcessed: number;
    missedDetected: number;
    notificationsSent: number;
    errors: string[];
    executionTimeMs: number;
  }> {
    const startTime = Date.now();
    
    console.log('🔍 MedicationOrchestrator: Starting missed medication detection');

    try {
      const results = {
        workflowsExecuted: 0,
        medicationsProcessed: 0,
        missedDetected: 0,
        notificationsSent: 0,
        errors: [] as string[]
      };

      // Get all active commands that need monitoring
      const commandsResult = await this.commandService.queryCommands({
        isActive: true,
        isPRN: false // Don't check PRN medications
      });

      if (!commandsResult.success || !commandsResult.data) {
        return {
          success: false,
          workflowsExecuted: 0,
          medicationsProcessed: 0,
          missedDetected: 0,
          notificationsSent: 0,
          errors: ['Failed to fetch active commands'],
          executionTimeMs: Date.now() - startTime
        };
      }

      const commands = commandsResult.data;
      results.medicationsProcessed = commands.length;

      // Check each command for missed doses
      for (const command of commands) {
        try {
          const missedEvents = await this.detectMissedDoses(command);
          
          if (missedEvents.length > 0) {
            results.missedDetected += missedEvents.length;
            
            // Process each missed dose
            for (const missedEvent of missedEvents) {
              const workflowResult = await this.processMissedMedicationWorkflow(
                command.id,
                missedEvent
              );
              
              if (workflowResult.success) {
                results.workflowsExecuted++;
                results.notificationsSent += workflowResult.notificationsSent;
              } else {
                results.errors.push(`Failed to process missed dose for ${command.medication.name}: ${workflowResult.error}`);
              }
            }
          }

        } catch (commandError) {
          results.errors.push(`Error processing command ${command.id}: ${commandError instanceof Error ? commandError.message : 'Unknown error'}`);
        }
      }

      const executionTime = Date.now() - startTime;

      console.log('✅ Missed medication detection completed:', {
        processed: results.medicationsProcessed,
        missed: results.missedDetected,
        workflows: results.workflowsExecuted,
        notifications: results.notificationsSent,
        errors: results.errors.length,
        time: `${executionTime}ms`
      });

      return {
        success: true,
        ...results,
        executionTimeMs: executionTime
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Missed detection failed:', error);
      
      return {
        success: false,
        workflowsExecuted: 0,
        medicationsProcessed: 0,
        missedDetected: 0,
        notificationsSent: 0,
        errors: [error instanceof Error ? error.message : 'Detection failed'],
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Generate scheduled dose events for a medication
   */
  private async generateScheduledDoseEvents(
    command: MedicationCommand,
    correlationId: string
  ): Promise<string[]> {
    try {
      const events: CreateEventRequest[] = [];
      const startDate = command.schedule.startDate;
      const endDate = command.schedule.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate && events.length < 100) { // Limit to prevent excessive events
        if (this.shouldCreateEventForDate(currentDate, command.schedule)) {
          for (const time of command.schedule.times) {
            // Parse time string with validation
            const timeParts = time.split(':');
            if (timeParts.length !== 2) {
              console.warn(`⚠️ Invalid time format: ${time}, skipping`);
              continue;
            }

            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);

            // Validate parsed values
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              console.warn(`⚠️ Invalid time values: ${time} (hours: ${hours}, minutes: ${minutes}), skipping`);
              continue;
            }

            const eventDateTime = new Date(currentDate);
            eventDateTime.setHours(hours, minutes, 0, 0);
            
            // Only create future events
            if (eventDateTime > new Date()) {
              events.push({
                commandId: command.id,
                patientId: command.patientId,
                eventType: MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
                eventData: {
                  scheduledDateTime: eventDateTime,
                  dosageAmount: command.schedule.dosageAmount
                },
                context: {
                  medicationName: command.medication.name,
                  triggerSource: 'system_detection'
                },
                timing: {
                  scheduledFor: eventDateTime,
                  gracePeriodEnd: new Date(eventDateTime.getTime() + command.gracePeriod.defaultMinutes * 60 * 1000)
                },
                createdBy: 'system',
                correlationId
              });
            }
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (events.length > 0) {
        const batchResult = await this.eventService.createEventsBatch(events);
        return batchResult.data?.created.map(e => e.id) || [];
      }

      return [];

    } catch (error) {
      console.error('❌ Error generating scheduled events:', error);
      return [];
    }
  }

  /**
   * Check if event should be created for a specific date
   */
  private shouldCreateEventForDate(date: Date, schedule: MedicationCommand['schedule']): boolean {
    switch (schedule.frequency) {
      case 'daily':
      case 'twice_daily':
      case 'three_times_daily':
      case 'four_times_daily':
        return true;
      
      case 'weekly':
        return schedule.daysOfWeek?.includes(date.getDay()) || false;
      
      case 'monthly':
        return date.getDate() === (schedule.dayOfMonth || 1);
      
      case 'as_needed':
        return false; // PRN medications don't have scheduled events
      
      default:
        return false;
    }
  }

  /**
   * Regenerate scheduled dose events for a medication command
   * Used when schedule times are updated
   */
  async regenerateScheduledEvents(commandId: string): Promise<{
    success: boolean;
    eventIds: string[];
    deleted: number;
    created: number;
    error?: string;
  }> {
    try {
      console.log('🔄 MedicationOrchestrator: Regenerating scheduled events for command:', commandId);

      // Get the updated command
      const commandResult = await this.commandService.getCommand(commandId);
      if (!commandResult.success || !commandResult.data) {
        return {
          success: false,
          eventIds: [],
          deleted: 0,
          created: 0,
          error: 'Command not found'
        };
      }

      const command = commandResult.data;

      // Check if reminders are enabled and schedule has times
      if (!command.reminders.enabled || !command.schedule.times || command.schedule.times.length === 0) {
        console.log('⚠️ Reminders disabled or no schedule times, deleting future events only');
        const deleteResult = await this.eventService.deleteFutureScheduledEvents(commandId);
        return {
          success: true,
          eventIds: [],
          deleted: deleteResult.data?.deleted || 0,
          created: 0
        };
      }

      // Delete existing future scheduled events
      const deleteResult = await this.eventService.deleteFutureScheduledEvents(commandId);
      const deletedCount = deleteResult.data?.deleted || 0;

      // Generate new scheduled events
      const correlationId = generateCorrelationId();
      const newEventIds = await this.generateScheduledDoseEvents(command, correlationId);

      console.log(`✅ Regenerated events: deleted ${deletedCount}, created ${newEventIds.length}`);

      return {
        success: true,
        eventIds: newEventIds,
        deleted: deletedCount,
        created: newEventIds.length
      };

    } catch (error) {
      console.error('❌ MedicationOrchestrator: Error regenerating scheduled events:', error);
      return {
        success: false,
        eventIds: [],
        deleted: 0,
        created: 0,
        error: error instanceof Error ? error.message : 'Failed to regenerate scheduled events'
      };
    }
  }

  /**
   * Detect missed doses for a command
   */
  private async detectMissedDoses(command: MedicationCommand): Promise<Array<{
    scheduledDateTime: Date;
    gracePeriodEnd: Date;
    detectionMethod: 'automatic';
    detectedBy: string;
  }>> {
    try {
      // Get recent scheduled events that haven't been taken
      const eventsResult = await this.eventService.queryEvents({
        commandId: command.id,
        eventType: MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        orderBy: 'eventTimestamp',
        orderDirection: 'desc'
      });

      if (!eventsResult.success || !eventsResult.data) {
        return [];
      }

      const scheduledEvents = eventsResult.data;
      const missedEvents: Array<{
        scheduledDateTime: Date;
        gracePeriodEnd: Date;
        detectionMethod: 'automatic';
        detectedBy: string;
      }> = [];

      const now = new Date();

      for (const scheduledEvent of scheduledEvents) {
        if (scheduledEvent.timing.gracePeriodEnd && scheduledEvent.timing.gracePeriodEnd < now) {
          // Check if there's a corresponding taken event
          const takenEventsResult = await this.eventService.queryEvents({
            commandId: command.id,
            eventType: MEDICATION_EVENT_TYPES.DOSE_TAKEN,
            startDate: new Date(scheduledEvent.timing.scheduledFor!.getTime() - 60 * 60 * 1000), // 1 hour before
            endDate: new Date(scheduledEvent.timing.scheduledFor!.getTime() + 4 * 60 * 60 * 1000) // 4 hours after
          });

          const hasTakenEvent = takenEventsResult.success && 
                               takenEventsResult.data && 
                               takenEventsResult.data.length > 0;

          if (!hasTakenEvent) {
            missedEvents.push({
              scheduledDateTime: scheduledEvent.timing.scheduledFor!,
              gracePeriodEnd: scheduledEvent.timing.gracePeriodEnd,
              detectionMethod: 'automatic',
              detectedBy: 'system'
            });
          }
        }
      }

      return missedEvents;

    } catch (error) {
      console.error('❌ Error detecting missed doses:', error);
      return [];
    }
  }

  /**
   * Get family members for a patient
   */
  private async getFamilyMembers(patientId: string): Promise<UnifiedFamilyAccess[]> {
    try {
      const familyQuery = await admin.firestore()
        .collection('family_access')
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .get();

      return familyQuery.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data()
      })) as UnifiedFamilyAccess[];

    } catch (error) {
      console.error('❌ Error getting family members:', error);
      return [];
    }
  }

  /**
   * Build notification recipients based on type and preferences
   */
  private async buildNotificationRecipients(
    patientId: string,
    notificationType: 'reminder' | 'missed' | 'alert' | 'status_change'
  ): Promise<NotificationRequest['recipients']> {
    try {
      const recipients: NotificationRequest['recipients'] = [];

      // Always include the patient
      const patientDoc = await admin.firestore().collection('users').doc(patientId).get();
      if (patientDoc.exists) {
        const patientData = patientDoc.data()!;
        recipients.push({
          userId: patientId,
          name: patientData.name || 'Patient',
          email: patientData.email,
          phone: patientData.phone,
          preferredMethods: ['browser', 'push'],
          isPatient: true,
          isFamilyMember: false,
          isEmergencyContact: false
        });
      }

      // Add family members based on notification type
      const familyMembers = await this.getFamilyMembers(patientId);
      
      for (const familyMember of familyMembers) {
        let shouldInclude = false;

        switch (notificationType) {
          case 'reminder':
            shouldInclude = familyMember.permissions.canReceiveAlerts;
            break;
          case 'missed':
            shouldInclude = familyMember.permissions.canReceiveAlerts;
            break;
          case 'alert':
            shouldInclude = familyMember.permissions.canReceiveAlerts || familyMember.permissions.isEmergencyContact;
            break;
          case 'status_change':
            shouldInclude = familyMember.permissions.canReceiveAlerts;
            break;
        }

        if (shouldInclude) {
          recipients.push({
            userId: familyMember.familyMemberId,
            name: familyMember.familyMemberName,
            email: familyMember.familyMemberEmail,
            preferredMethods: ['email', 'browser'],
            isPatient: false,
            isFamilyMember: true,
            isEmergencyContact: familyMember.permissions.isEmergencyContact
          });
        }
      }

      return recipients;

    } catch (error) {
      console.error('❌ Error building notification recipients:', error);
      return [];
    }
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== WORKFLOW MONITORING =====

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(hours: number = 24): Promise<{
    success: boolean;
    data?: {
      totalWorkflows: number;
      successfulWorkflows: number;
      failedWorkflows: number;
      successRate: number;
      averageExecutionTime: number;
      workflowsByType: Record<string, number>;
      notificationsSent: number;
      transactionsExecuted: number;
    };
    error?: string;
  }> {
    try {
      // This would query workflow logs if we implemented them
      // For now, return basic statistics from transaction logs
      const transactionStats = await this.transactionManager.getTransactionStatistics(undefined, hours);
      
      if (!transactionStats.success || !transactionStats.data) {
        return {
          success: false,
          error: 'Failed to get transaction statistics'
        };
      }

      const stats = {
        totalWorkflows: transactionStats.data.totalTransactions,
        successfulWorkflows: transactionStats.data.successfulTransactions,
        failedWorkflows: transactionStats.data.failedTransactions,
        successRate: transactionStats.data.successRate,
        averageExecutionTime: transactionStats.data.averageExecutionTime,
        workflowsByType: transactionStats.data.transactionsByType,
        notificationsSent: 0, // Would need to query notification logs
        transactionsExecuted: transactionStats.data.totalTransactions
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('❌ Error getting workflow statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow statistics'
      };
    }
  }
}