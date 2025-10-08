/**
 * MedicationUndoService
 * 
 * Single Responsibility: ONLY handles medication undo operations
 * 
 * This service is responsible for:
 * - Validating undo eligibility (30-second window)
 * - Creating undo events with proper event chains
 * - Supporting correction workflows for older events
 * - Maintaining event correlation and audit trails
 * - Recalculating adherence after undo
 * 
 * This service does NOT:
 * - Send notifications (delegates to NotificationService)
 * - Modify commands directly (uses EventService)
 * - Handle transactions (delegates to TransactionManager)
 */

import * as admin from 'firebase-admin';
import {
  MedicationEvent,
  MedicationCommand,
  ENHANCED_ADHERENCE_EVENT_TYPES,
  ALL_MEDICATION_EVENT_TYPES,
  UndoMedicationRequest,
  generateEventId,
  generateCorrelationId
} from '../../schemas/unifiedMedicationSchema';

export interface UndoValidationResult {
  canUndo: boolean;
  reason?: string;
  timeoutExpiredAt?: Date;
  requiresCorrection: boolean;
  originalEvent?: MedicationEvent;
}

export interface UndoResult {
  success: boolean;
  undoEventId?: string;
  originalEventId: string;
  correctedAction?: 'missed' | 'skipped' | 'rescheduled' | 'none';
  adherenceImpact?: {
    previousScore: number;
    newScore: number;
    streakImpact: string;
  };
  error?: string;
}

export interface CorrectionRequest {
  originalEventId: string;
  correctedAction: 'taken' | 'missed' | 'skipped' | 'rescheduled';
  correctionReason: string;
  correctedData?: any;
  correctedBy: string;
  notifyFamily?: boolean;
}

export class MedicationUndoService {
  private firestore: admin.firestore.Firestore;
  private eventsCollection: admin.firestore.CollectionReference;
  private commandsCollection: admin.firestore.CollectionReference;
  
  // Undo timeout in milliseconds (30 seconds)
  private readonly UNDO_TIMEOUT_MS = 30 * 1000;
  
  // Correction window in hours (24 hours)
  private readonly CORRECTION_WINDOW_HOURS = 24;

  constructor() {
    this.firestore = admin.firestore();
    this.eventsCollection = this.firestore.collection('medication_events');
    this.commandsCollection = this.firestore.collection('medication_commands');
  }

  // ===== UNDO VALIDATION =====

  /**
   * Validate if an event can be undone
   */
  async validateUndo(eventId: string): Promise<UndoValidationResult> {
    try {
      console.log('🔍 MedicationUndoService: Validating undo for event:', eventId);

      // Get the original event
      const eventDoc = await this.eventsCollection.doc(eventId).get();
      
      if (!eventDoc.exists) {
        return {
          canUndo: false,
          reason: 'Event not found',
          requiresCorrection: false
        };
      }

      const originalEvent = this.deserializeEvent(eventDoc.id, eventDoc.data()!);

      // Check if event type is undoable
      const undoableTypes = [
        ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_PARTIAL,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_ADJUSTED,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_LATE,
        ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_EARLY
      ];

      if (!undoableTypes.includes(originalEvent.eventType as any)) {
        return {
          canUndo: false,
          reason: `Event type ${originalEvent.eventType} cannot be undone`,
          requiresCorrection: false,
          originalEvent
        };
      }

      // Check if already undone
      const existingUndoQuery = await this.eventsCollection
        .where('eventData.undoData.originalEventId', '==', eventId)
        .where('eventType', '==', ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE)
        .limit(1)
        .get();

      if (!existingUndoQuery.empty) {
        return {
          canUndo: false,
          reason: 'Event has already been undone',
          requiresCorrection: false,
          originalEvent
        };
      }

      // Check time window
      const now = Date.now();
      const eventTime = originalEvent.timing.eventTimestamp.getTime();
      const timeSinceEvent = now - eventTime;
      const timeoutExpiredAt = new Date(eventTime + this.UNDO_TIMEOUT_MS);

      // Within 30-second window - can undo
      if (timeSinceEvent <= this.UNDO_TIMEOUT_MS) {
        return {
          canUndo: true,
          requiresCorrection: false,
          originalEvent
        };
      }

      // Within 24-hour window - requires correction workflow
      const correctionWindowMs = this.CORRECTION_WINDOW_HOURS * 60 * 60 * 1000;
      if (timeSinceEvent <= correctionWindowMs) {
        return {
          canUndo: false,
          reason: 'Undo timeout expired. Use correction workflow instead.',
          timeoutExpiredAt,
          requiresCorrection: true,
          originalEvent
        };
      }

      // Too old to correct
      return {
        canUndo: false,
        reason: 'Event is too old to undo or correct (>24 hours)',
        timeoutExpiredAt,
        requiresCorrection: false,
        originalEvent
      };

    } catch (error) {
      console.error('❌ MedicationUndoService: Error validating undo:', error);
      return {
        canUndo: false,
        reason: error instanceof Error ? error.message : 'Validation failed',
        requiresCorrection: false
      };
    }
  }

  // ===== UNDO OPERATIONS =====

  /**
   * Perform undo operation (within 30-second window)
   */
  async undoMedicationEvent(request: UndoMedicationRequest): Promise<UndoResult> {
    try {
      console.log('🔄 MedicationUndoService: Undoing medication event:', request.originalEventId);

      // Validate undo eligibility
      const validation = await this.validateUndo(request.originalEventId);
      
      if (!validation.canUndo) {
        return {
          success: false,
          originalEventId: request.originalEventId,
          error: validation.reason || 'Cannot undo this event'
        };
      }

      const originalEvent = validation.originalEvent!;

      // Create undo event
      const undoEventId = generateEventId(originalEvent.commandId, ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE);
      const correlationId = generateCorrelationId();

      const undoEvent: Partial<MedicationEvent> = {
        id: undoEventId,
        commandId: originalEvent.commandId,
        patientId: originalEvent.patientId,
        eventType: ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE,
        eventData: {
          scheduledDateTime: originalEvent.eventData.scheduledDateTime,
          additionalData: {
            undoData: {
              isUndo: true,
              originalEventId: request.originalEventId,
              undoEventId: undoEventId,
              undoReason: request.undoReason,
              undoTimestamp: new Date(),
              correctedAction: request.correctedAction || 'none',
              correctedData: request.correctedData
            }
          }
        },
        context: {
          medicationName: originalEvent.context.medicationName,
          triggerSource: 'user_action' as const,
          relatedEventIds: [request.originalEventId]
        },
        timing: {
          eventTimestamp: new Date(),
          scheduledFor: originalEvent.timing.scheduledFor
        },
        metadata: {
          eventVersion: 1,
          createdAt: new Date(),
          createdBy: originalEvent.metadata.createdBy,
          correlationId
        }
      };

      // Save undo event
      await this.eventsCollection.doc(undoEventId).set(this.serializeEvent(undoEvent as MedicationEvent));

      console.log('✅ Undo event created:', undoEventId);

      // Calculate adherence impact
      const adherenceImpact = await this.calculateUndoAdherenceImpact(
        originalEvent.commandId,
        originalEvent.patientId
      );

      // If corrected action specified, create correction event
      if (request.correctedAction && request.correctedAction !== 'none') {
        await this.createCorrectionEvent(
          originalEvent,
          request.correctedAction,
          request.correctedData,
          correlationId
        );
      }

      return {
        success: true,
        undoEventId,
        originalEventId: request.originalEventId,
        correctedAction: request.correctedAction,
        adherenceImpact
      };

    } catch (error) {
      console.error('❌ MedicationUndoService: Error undoing event:', error);
      return {
        success: false,
        originalEventId: request.originalEventId,
        error: error instanceof Error ? error.message : 'Undo operation failed'
      };
    }
  }

  /**
   * Perform correction workflow (for events older than 30 seconds)
   */
  async correctMedicationEvent(request: CorrectionRequest): Promise<UndoResult> {
    try {
      console.log('🔄 MedicationUndoService: Correcting medication event:', request.originalEventId);

      // Get original event
      const eventDoc = await this.eventsCollection.doc(request.originalEventId).get();
      
      if (!eventDoc.exists) {
        return {
          success: false,
          originalEventId: request.originalEventId,
          error: 'Original event not found'
        };
      }

      const originalEvent = this.deserializeEvent(eventDoc.id, eventDoc.data()!);

      // Check if within correction window
      const now = Date.now();
      const eventTime = originalEvent.timing.eventTimestamp.getTime();
      const timeSinceEvent = now - eventTime;
      const correctionWindowMs = this.CORRECTION_WINDOW_HOURS * 60 * 60 * 1000;

      if (timeSinceEvent > correctionWindowMs) {
        return {
          success: false,
          originalEventId: request.originalEventId,
          error: 'Event is too old to correct (>24 hours)'
        };
      }

      // Create correction event based on corrected action
      const correlationId = generateCorrelationId();
      let correctionEventType: string;

      switch (request.correctedAction) {
        case 'missed':
          correctionEventType = ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_MISSED_CORRECTED;
          break;
        case 'skipped':
          correctionEventType = ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_SKIPPED_CORRECTED;
          break;
        case 'taken':
          correctionEventType = ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN;
          break;
        case 'rescheduled':
          correctionEventType = ALL_MEDICATION_EVENT_TYPES.DOSE_RESCHEDULED;
          break;
        default:
          return {
            success: false,
            originalEventId: request.originalEventId,
            error: 'Invalid corrected action'
          };
      }

      const correctionEventId = generateEventId(originalEvent.commandId, correctionEventType);

      const correctionEvent: Partial<MedicationEvent> = {
        id: correctionEventId,
        commandId: originalEvent.commandId,
        patientId: originalEvent.patientId,
        eventType: correctionEventType as any,
        eventData: {
          scheduledDateTime: originalEvent.eventData.scheduledDateTime,
          actionReason: request.correctionReason,
          actionNotes: `Correction for event ${request.originalEventId}`,
          ...request.correctedData,
          additionalData: {
            undoData: {
              isUndo: true,
              originalEventId: request.originalEventId,
              undoEventId: correctionEventId,
              undoReason: request.correctionReason,
              undoTimestamp: new Date(),
              correctedAction: request.correctedAction === 'taken' ? 'none' : request.correctedAction,
              correctedData: request.correctedData
            }
          }
        },
        context: {
          medicationName: originalEvent.context.medicationName,
          triggerSource: 'user_action' as const,
          relatedEventIds: [request.originalEventId]
        },
        timing: {
          eventTimestamp: new Date(),
          scheduledFor: originalEvent.timing.scheduledFor
        },
        metadata: {
          eventVersion: 1,
          createdAt: new Date(),
          createdBy: request.correctedBy,
          correlationId
        }
      };

      // Save correction event
      await this.eventsCollection.doc(correctionEventId).set(this.serializeEvent(correctionEvent as MedicationEvent));

      console.log('✅ Correction event created:', correctionEventId);

      // Calculate adherence impact
      const adherenceImpact = await this.calculateUndoAdherenceImpact(
        originalEvent.commandId,
        originalEvent.patientId
      );

      return {
        success: true,
        undoEventId: correctionEventId,
        originalEventId: request.originalEventId,
        correctedAction: request.correctedAction === 'taken' ? 'none' as const : request.correctedAction,
        adherenceImpact
      };

    } catch (error) {
      console.error('❌ MedicationUndoService: Error correcting event:', error);
      return {
        success: false,
        originalEventId: request.originalEventId,
        error: error instanceof Error ? error.message : 'Correction operation failed'
      };
    }
  }

  // ===== UNDO HISTORY =====

  /**
   * Get undo history for a medication command
   */
  async getUndoHistory(commandId: string, limit: number = 10): Promise<{
    success: boolean;
    data?: Array<{
      undoEventId: string;
      originalEventId: string;
      undoReason: string;
      undoTimestamp: Date;
      correctedAction?: string;
      timeSinceOriginal: number;
    }>;
    error?: string;
  }> {
    try {
      console.log('📋 MedicationUndoService: Getting undo history for command:', commandId);

      const undoEventsQuery = await this.eventsCollection
        .where('commandId', '==', commandId)
        .where('eventType', 'in', [
          ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE,
          ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_MISSED_CORRECTED,
          ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_SKIPPED_CORRECTED
        ])
        .orderBy('timing.eventTimestamp', 'desc')
        .limit(limit)
        .get();

      const undoHistory = await Promise.all(
        undoEventsQuery.docs.map(async (doc) => {
          const event = this.deserializeEvent(doc.id, doc.data());
          const undoData = event.eventData.additionalData?.undoData;

          if (!undoData) {
            return null;
          }

          // Get original event to calculate time difference
          let timeSinceOriginal = 0;
          if (undoData.originalEventId) {
            const originalDoc = await this.eventsCollection.doc(undoData.originalEventId).get();
            if (originalDoc.exists) {
              const originalEvent = this.deserializeEvent(originalDoc.id, originalDoc.data()!);
              timeSinceOriginal = Math.floor(
                (event.timing.eventTimestamp.getTime() - originalEvent.timing.eventTimestamp.getTime()) / 1000
              );
            }
          }

          return {
            undoEventId: event.id,
            originalEventId: undoData.originalEventId || '',
            undoReason: undoData.undoReason || 'No reason provided',
            undoTimestamp: undoData.undoTimestamp || event.timing.eventTimestamp,
            correctedAction: undoData.correctedAction,
            timeSinceOriginal
          };
        })
      );

      const filteredHistory = undoHistory.filter(item => item !== null) as any[];

      return {
        success: true,
        data: filteredHistory
      };

    } catch (error) {
      console.error('❌ MedicationUndoService: Error getting undo history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get undo history'
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Create correction event when undo includes a corrected action
   */
  private async createCorrectionEvent(
    originalEvent: MedicationEvent,
    correctedAction: string,
    correctedData: any,
    correlationId: string
  ): Promise<void> {
    try {
      let correctionEventType: string;

      switch (correctedAction) {
        case 'missed':
          correctionEventType = ALL_MEDICATION_EVENT_TYPES.DOSE_MISSED;
          break;
        case 'skipped':
          correctionEventType = ALL_MEDICATION_EVENT_TYPES.DOSE_SKIPPED;
          break;
        case 'rescheduled':
          correctionEventType = ALL_MEDICATION_EVENT_TYPES.DOSE_RESCHEDULED;
          break;
        default:
          return; // No correction event needed
      }

      const correctionEventId = generateEventId(originalEvent.commandId, correctionEventType);

      const correctionEvent: Partial<MedicationEvent> = {
        id: correctionEventId,
        commandId: originalEvent.commandId,
        patientId: originalEvent.patientId,
        eventType: correctionEventType as any,
        eventData: {
          scheduledDateTime: originalEvent.eventData.scheduledDateTime,
          ...correctedData
        },
        context: {
          medicationName: originalEvent.context.medicationName,
          triggerSource: 'user_action' as const,
          relatedEventIds: [originalEvent.id]
        },
        timing: {
          eventTimestamp: new Date(),
          scheduledFor: originalEvent.timing.scheduledFor
        },
        metadata: {
          eventVersion: 1,
          createdAt: new Date(),
          createdBy: originalEvent.metadata.createdBy,
          correlationId
        }
      };

      await this.eventsCollection.doc(correctionEventId).set(this.serializeEvent(correctionEvent as MedicationEvent));

      console.log('✅ Correction event created:', correctionEventId);

    } catch (error) {
      console.error('❌ Error creating correction event:', error);
      // Don't throw - correction event is supplementary
    }
  }

  /**
   * Calculate adherence impact of undo
   */
  private async calculateUndoAdherenceImpact(
    commandId: string,
    patientId: string
  ): Promise<{
    previousScore: number;
    newScore: number;
    streakImpact: string;
  }> {
    try {
      // Get recent events for this medication
      const recentEventsQuery = await this.eventsCollection
        .where('commandId', '==', commandId)
        .where('patientId', '==', patientId)
        .orderBy('timing.eventTimestamp', 'desc')
        .limit(30)
        .get();

      const events = recentEventsQuery.docs.map(doc => this.deserializeEvent(doc.id, doc.data()));

      // Calculate simple adherence metrics
      const takenEvents = events.filter(e => 
        e.eventType === ALL_MEDICATION_EVENT_TYPES.DOSE_TAKEN ||
        e.eventType === ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_FULL
      );
      const scheduledEvents = events.filter(e => e.eventType === ALL_MEDICATION_EVENT_TYPES.DOSE_SCHEDULED);
      const undoEvents = events.filter(e => e.eventType === ENHANCED_ADHERENCE_EVENT_TYPES.DOSE_TAKEN_UNDONE);

      const previousScore = scheduledEvents.length > 0 
        ? Math.round((takenEvents.length / scheduledEvents.length) * 100)
        : 0;

      // After undo, one less taken event
      const newScore = scheduledEvents.length > 0
        ? Math.round(((takenEvents.length - 1) / scheduledEvents.length) * 100)
        : 0;

      const streakImpact = undoEvents.length > 0
        ? 'Undo may affect your adherence streak'
        : 'First undo - minimal impact on streak';

      return {
        previousScore,
        newScore,
        streakImpact
      };

    } catch (error) {
      console.error('❌ Error calculating adherence impact:', error);
      return {
        previousScore: 0,
        newScore: 0,
        streakImpact: 'Unable to calculate impact'
      };
    }
  }

  /**
   * Serialize event for Firestore storage
   */
  private serializeEvent(event: MedicationEvent): any {
    return {
      ...event,
      'eventData.scheduledDateTime': event.eventData.scheduledDateTime ? 
        admin.firestore.Timestamp.fromDate(event.eventData.scheduledDateTime) : null,
      'eventData.actualDateTime': event.eventData.actualDateTime ? 
        admin.firestore.Timestamp.fromDate(event.eventData.actualDateTime) : null,
      'timing.eventTimestamp': admin.firestore.Timestamp.fromDate(event.timing.eventTimestamp),
      'timing.scheduledFor': event.timing.scheduledFor ? 
        admin.firestore.Timestamp.fromDate(event.timing.scheduledFor) : null,
      'metadata.createdAt': admin.firestore.Timestamp.fromDate(event.metadata.createdAt)
    };
  }

  /**
   * Deserialize event from Firestore data
   */
  private deserializeEvent(id: string, data: any): MedicationEvent {
    return {
      ...data,
      id,
      eventData: {
        ...data.eventData,
        scheduledDateTime: data.eventData?.scheduledDateTime?.toDate?.() || null,
        actualDateTime: data.eventData?.actualDateTime?.toDate?.() || null
      },
      timing: {
        ...data.timing,
        eventTimestamp: data.timing.eventTimestamp.toDate(),
        scheduledFor: data.timing.scheduledFor?.toDate?.() || null
      },
      metadata: {
        ...data.metadata,
        createdAt: data.metadata.createdAt.toDate()
      }
    };
  }
}