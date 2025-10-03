/**
 * MedicationEventService
 * 
 * Single Responsibility: ONLY processes events (create/query events)
 * 
 * This service is responsible for:
 * - Creating immutable medication events
 * - Querying event history
 * - Event correlation and tracking
 * - Event validation and integrity
 * 
 * This service does NOT:
 * - Modify command state (handled by MedicationCommandService)
 * - Send notifications (handled by MedicationNotificationService)
 * - Manage transactions (handled by MedicationTransactionManager)
 * - Coordinate between services (handled by MedicationOrchestrator)
 */

import * as admin from 'firebase-admin';
import {
  MedicationEvent,
  MedicationEventType,
  MEDICATION_EVENT_TYPES,
  validateMedicationEvent,
  generateEventId,
  generateCorrelationId
} from '../../schemas/unifiedMedicationSchema';

export interface CreateEventRequest {
  commandId: string;
  patientId: string;
  eventType: MedicationEventType;
  eventData: {
    // For dose events
    scheduledDateTime?: Date;
    actualDateTime?: Date;
    dosageAmount?: string;
    takenBy?: string;
    
    // For action events
    actionReason?: string;
    actionNotes?: string;
    snoozeMinutes?: number;
    newScheduledTime?: Date;
    skipReason?: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other';
    
    // For status changes
    previousStatus?: string;
    newStatus?: string;
    statusReason?: string;
    
    // For reminders
    reminderType?: 'email' | 'sms' | 'push' | 'browser';
    reminderSentAt?: Date;
    reminderAcknowledged?: boolean;
    
    // For safety events
    alertType?: 'interaction' | 'duplicate' | 'contraindication' | 'allergy';
    alertSeverity?: 'info' | 'warning' | 'critical';
    alertDescription?: string;
    
    // For grace period events
    gracePeriodMinutes?: number;
    gracePeriodEnd?: Date;
    appliedRules?: string[];
    
    // Generic data
    additionalData?: Record<string, any>;
  };
  context: {
    medicationName: string;
    scheduleId?: string;
    calendarEventId?: string;
    relatedEventIds?: string[];
    triggerSource: 'user_action' | 'system_detection' | 'scheduled_task' | 'api_call';
    userAgent?: string;
    ipAddress?: string;
  };
  timing?: {
    scheduledFor?: Date;
    gracePeriodEnd?: Date;
    isWithinGracePeriod?: boolean;
    minutesLate?: number;
    isOnTime?: boolean;
  };
  createdBy: string;
  correlationId?: string;
  sessionId?: string;
}

export interface EventQueryOptions {
  patientId?: string;
  commandId?: string;
  eventType?: MedicationEventType | MedicationEventType[];
  startDate?: Date;
  endDate?: Date;
  correlationId?: string;
  triggerSource?: 'user_action' | 'system_detection' | 'scheduled_task' | 'api_call';
  limit?: number;
  orderBy?: 'eventTimestamp' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
  // Archive filtering options
  excludeArchived?: boolean; // Default: true (exclude archived events)
  onlyArchived?: boolean; // Default: false (only show archived events)
  belongsToDate?: string; // ISO date string (YYYY-MM-DD) to filter by archive date
}

export interface EventAggregationOptions {
  patientId: string;
  startDate?: Date;
  endDate?: Date;
  groupBy: 'eventType' | 'medicationName' | 'day' | 'week' | 'month';
  eventTypes?: MedicationEventType[];
}

export class MedicationEventService {
  private firestore: admin.firestore.Firestore;
  private collection: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.collection = this.firestore.collection('medication_events');
  }

  // ===== CREATE OPERATIONS =====

  /**
   * Create a new medication event (immutable)
   */
  async createEvent(request: CreateEventRequest): Promise<{
    success: boolean;
    data?: MedicationEvent;
    error?: string;
  }> {
    try {
      console.log('📝 MedicationEventService: Creating event:', request.eventType, 'for command:', request.commandId);

      // Generate event ID
      const eventId = generateEventId(request.commandId, request.eventType);
      const correlationId = request.correlationId || generateCorrelationId();

      // Build complete event object
      const event: MedicationEvent = {
        id: eventId,
        commandId: request.commandId,
        patientId: request.patientId,
        eventType: request.eventType,
        eventData: { ...request.eventData },
        context: { ...request.context },
        timing: {
          eventTimestamp: new Date(),
          scheduledFor: request.timing?.scheduledFor,
          gracePeriodEnd: request.timing?.gracePeriodEnd,
          isWithinGracePeriod: request.timing?.isWithinGracePeriod,
          minutesLate: request.timing?.minutesLate,
          isOnTime: request.timing?.isOnTime
        },
        metadata: {
          eventVersion: 1,
          createdAt: new Date(),
          createdBy: request.createdBy,
          correlationId,
          sessionId: request.sessionId
        }
      };

      // Validate event
      const validation = validateMedicationEvent(event);
      if (!validation.isValid) {
        console.error('❌ Event validation failed:', validation.errors);
        return {
          success: false,
          error: `Event validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Save to Firestore (events are immutable, so use set)
      await this.collection.doc(eventId).set(this.serializeEvent(event));

      console.log('✅ MedicationEventService: Event created successfully:', eventId);

      return {
        success: true,
        data: event
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error creating event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication event'
      };
    }
  }

  /**
   * Create multiple events in a batch (for related actions)
   */
  async createEventsBatch(requests: CreateEventRequest[]): Promise<{
    success: boolean;
    data?: {
      created: MedicationEvent[];
      failed: Array<{ request: CreateEventRequest; error: string }>;
      correlationId: string;
    };
    error?: string;
  }> {
    try {
      console.log('📝 MedicationEventService: Creating batch of', requests.length, 'events');

      const batch = this.firestore.batch();
      const created: MedicationEvent[] = [];
      const failed: Array<{ request: CreateEventRequest; error: string }> = [];
      const correlationId = generateCorrelationId();

      for (const request of requests) {
        try {
          const eventId = generateEventId(request.commandId, request.eventType);

          const event: MedicationEvent = {
            id: eventId,
            commandId: request.commandId,
            patientId: request.patientId,
            eventType: request.eventType,
            eventData: { ...request.eventData },
            context: { ...request.context },
            timing: {
              eventTimestamp: new Date(),
              scheduledFor: request.timing?.scheduledFor,
              gracePeriodEnd: request.timing?.gracePeriodEnd,
              isWithinGracePeriod: request.timing?.isWithinGracePeriod,
              minutesLate: request.timing?.minutesLate,
              isOnTime: request.timing?.isOnTime
            },
            metadata: {
              eventVersion: 1,
              createdAt: new Date(),
              createdBy: request.createdBy,
              correlationId,
              sessionId: request.sessionId
            }
          };

          // Validate event
          const validation = validateMedicationEvent(event);
          if (!validation.isValid) {
            failed.push({
              request,
              error: `Validation failed: ${validation.errors.join(', ')}`
            });
            continue;
          }

          // Add to batch
          batch.set(this.collection.doc(eventId), this.serializeEvent(event));
          created.push(event);

        } catch (error) {
          failed.push({
            request,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Execute batch
      await batch.commit();

      console.log(`✅ MedicationEventService: Batch created ${created.length} events, ${failed.length} failed`);

      return {
        success: true,
        data: { created, failed, correlationId }
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error creating event batch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create event batch'
      };
    }
  }

  // ===== READ OPERATIONS =====

  /**
   * Get a medication event by ID
   */
  async getEvent(eventId: string): Promise<{
    success: boolean;
    data?: MedicationEvent;
    error?: string;
  }> {
    try {
      const doc = await this.collection.doc(eventId).get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication event not found'
        };
      }

      const event = this.deserializeEvent(doc.id, doc.data()!);
      
      return {
        success: true,
        data: event
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error getting event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get medication event'
      };
    }
  }

  /**
   * Query medication events with filters
   */
  async queryEvents(options: EventQueryOptions): Promise<{
    success: boolean;
    data?: MedicationEvent[];
    error?: string;
    total?: number;
  }> {
    try {
      console.log('🔍 MedicationEventService: Querying events with options:', options);

      let query: admin.firestore.Query = this.collection;

      // Apply filters
      if (options.patientId) {
        query = query.where('patientId', '==', options.patientId);
      }

      if (options.commandId) {
        query = query.where('commandId', '==', options.commandId);
      }

      if (options.eventType) {
        if (Array.isArray(options.eventType)) {
          query = query.where('eventType', 'in', options.eventType);
        } else {
          query = query.where('eventType', '==', options.eventType);
        }
      }

      if (options.correlationId) {
        query = query.where('metadata.correlationId', '==', options.correlationId);
      }

      if (options.triggerSource) {
        query = query.where('context.triggerSource', '==', options.triggerSource);
      }

      // Apply date range filters
      if (options.startDate) {
        query = query.where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(options.startDate));
      }

      if (options.endDate) {
        query = query.where('timing.eventTimestamp', '<=', admin.firestore.Timestamp.fromDate(options.endDate));
      }

      // Apply ordering
      const orderField = options.orderBy === 'createdAt' ? 'metadata.createdAt' : 'timing.eventTimestamp';
      const orderDirection = options.orderDirection === 'asc' ? 'asc' : 'desc';
      
      query = query.orderBy(orderField, orderDirection);

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      let events = snapshot.docs.map(doc => this.deserializeEvent(doc.id, doc.data()));

      // Apply archive filtering (post-query since archiveStatus is optional)
      const excludeArchived = options.excludeArchived !== false; // Default to true
      const onlyArchived = options.onlyArchived === true; // Default to false
      
      if (onlyArchived) {
        events = events.filter(event => event.archiveStatus?.isArchived === true);
        if (options.belongsToDate) {
          events = events.filter(event => event.archiveStatus?.belongsToDate === options.belongsToDate);
        }
      } else if (excludeArchived) {
        events = events.filter(event => !event.archiveStatus?.isArchived);
      }

      console.log(`✅ MedicationEventService: Found ${events.length} events (after archive filtering)`);

      return {
        success: true,
        data: events,
        total: events.length
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error querying events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query medication events'
      };
    }
  }

  /**
   * Get events for a specific command (medication)
   */
  async getEventsForCommand(commandId: string, limit?: number): Promise<{
    success: boolean;
    data?: MedicationEvent[];
    error?: string;
  }> {
    return this.queryEvents({
      commandId,
      limit,
      orderBy: 'eventTimestamp',
      orderDirection: 'desc'
    });
  }

  /**
   * Get recent events for a patient
   */
  async getRecentEvents(patientId: string, hours: number = 24): Promise<{
    success: boolean;
    data?: MedicationEvent[];
    error?: string;
  }> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return this.queryEvents({
      patientId,
      startDate,
      orderBy: 'eventTimestamp',
      orderDirection: 'desc',
      limit: 100
    });
  }

  /**
   * Get events by correlation ID (related events)
   */
  async getCorrelatedEvents(correlationId: string): Promise<{
    success: boolean;
    data?: MedicationEvent[];
    error?: string;
  }> {
    return this.queryEvents({
      correlationId,
      orderBy: 'eventTimestamp',
      orderDirection: 'asc'
    });
  }

  // ===== SPECIALIZED QUERY OPERATIONS =====

  /**
   * Get dose events for adherence calculation
   */
  async getDoseEvents(patientId: string, startDate?: Date, endDate?: Date): Promise<{
    success: boolean;
    data?: {
      scheduled: MedicationEvent[];
      taken: MedicationEvent[];
      missed: MedicationEvent[];
      skipped: MedicationEvent[];
      snoozed: MedicationEvent[];
    };
    error?: string;
  }> {
    try {
      const doseEventTypes: MedicationEventType[] = [
        MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        MEDICATION_EVENT_TYPES.DOSE_TAKEN,
        MEDICATION_EVENT_TYPES.DOSE_MISSED,
        MEDICATION_EVENT_TYPES.DOSE_SKIPPED,
        MEDICATION_EVENT_TYPES.DOSE_SNOOZED
      ];

      const result = await this.queryEvents({
        patientId,
        eventType: doseEventTypes,
        startDate,
        endDate,
        orderBy: 'eventTimestamp',
        orderDirection: 'desc'
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch dose events'
        };
      }

      // Group events by type
      const events = result.data;
      const groupedEvents = {
        scheduled: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SCHEDULED),
        taken: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_TAKEN),
        missed: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_MISSED),
        skipped: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SKIPPED),
        snoozed: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SNOOZED)
      };

      return {
        success: true,
        data: groupedEvents
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error getting dose events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dose events'
      };
    }
  }

  /**
   * Get missed medication events within grace period
   */
  async getMissedEventsInGracePeriod(patientId: string): Promise<{
    success: boolean;
    data?: MedicationEvent[];
    error?: string;
  }> {
    try {
      const now = new Date();
      
      const result = await this.queryEvents({
        patientId,
        eventType: MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        orderBy: 'eventTimestamp',
        orderDirection: 'asc'
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch scheduled events'
        };
      }

      // Filter for events that are past their grace period
      const missedEvents = result.data.filter(event => {
        if (!event.timing.gracePeriodEnd) return false;
        return event.timing.gracePeriodEnd < now;
      });

      return {
        success: true,
        data: missedEvents
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error getting missed events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get missed events'
      };
    }
  }

  // ===== AGGREGATION AND ANALYTICS =====

  /**
   * Aggregate events for analytics
   */
  async aggregateEvents(options: EventAggregationOptions): Promise<{
    success: boolean;
    data?: Record<string, number>;
    error?: string;
  }> {
    try {
      console.log('📊 MedicationEventService: Aggregating events:', options);

      const queryOptions: EventQueryOptions = {
        patientId: options.patientId,
        startDate: options.startDate,
        endDate: options.endDate,
        eventType: options.eventTypes
      };

      const result = await this.queryEvents(queryOptions);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch events for aggregation'
        };
      }

      const events = result.data;
      const aggregation: Record<string, number> = {};

      // Group by specified field
      events.forEach(event => {
        let groupKey: string;

        switch (options.groupBy) {
          case 'eventType':
            groupKey = event.eventType;
            break;
          case 'medicationName':
            groupKey = event.context.medicationName;
            break;
          case 'day':
            groupKey = event.timing.eventTimestamp.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(event.timing.eventTimestamp);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            groupKey = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            groupKey = event.timing.eventTimestamp.toISOString().slice(0, 7); // YYYY-MM
            break;
          default:
            groupKey = 'unknown';
        }

        aggregation[groupKey] = (aggregation[groupKey] || 0) + 1;
      });

      return {
        success: true,
        data: aggregation
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error aggregating events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to aggregate events'
      };
    }
  }

  /**
   * Calculate adherence metrics from events
   */
  async calculateAdherenceMetrics(patientId: string, startDate?: Date, endDate?: Date): Promise<{
    success: boolean;
    data?: {
      totalScheduled: number;
      totalTaken: number;
      totalMissed: number;
      totalSkipped: number;
      adherenceRate: number;
      onTimeRate: number;
      averageDelayMinutes: number;
      byMedication: Record<string, {
        scheduled: number;
        taken: number;
        missed: number;
        skipped: number;
        adherenceRate: number;
      }>;
    };
    error?: string;
  }> {
    try {
      console.log('📊 MedicationEventService: Calculating adherence metrics for patient:', patientId);

      const doseEventsResult = await this.getDoseEvents(patientId, startDate, endDate);

      if (!doseEventsResult.success || !doseEventsResult.data) {
        return {
          success: false,
          error: doseEventsResult.error || 'Failed to fetch dose events'
        };
      }

      const { scheduled, taken, missed, skipped } = doseEventsResult.data;

      // Calculate overall metrics
      const totalScheduled = scheduled.length;
      const totalTaken = taken.length;
      const totalMissed = missed.length;
      const totalSkipped = skipped.length;
      
      const adherenceRate = totalScheduled > 0 ? ((totalTaken) / totalScheduled) * 100 : 0;
      const onTimeEvents = taken.filter(e => e.timing.isOnTime);
      const onTimeRate = totalTaken > 0 ? (onTimeEvents.length / totalTaken) * 100 : 0;
      
      // Calculate average delay
      const lateEvents = taken.filter(e => e.timing.minutesLate && e.timing.minutesLate > 0);
      const averageDelayMinutes = lateEvents.length > 0 
        ? lateEvents.reduce((sum, e) => sum + (e.timing.minutesLate || 0), 0) / lateEvents.length
        : 0;

      // Calculate by medication
      const byMedication: Record<string, any> = {};
      const allEvents = [...scheduled, ...taken, ...missed, ...skipped];
      
      allEvents.forEach(event => {
        const medName = event.context.medicationName;
        if (!byMedication[medName]) {
          byMedication[medName] = {
            scheduled: 0,
            taken: 0,
            missed: 0,
            skipped: 0,
            adherenceRate: 0
          };
        }

        switch (event.eventType) {
          case MEDICATION_EVENT_TYPES.DOSE_SCHEDULED:
            byMedication[medName].scheduled++;
            break;
          case MEDICATION_EVENT_TYPES.DOSE_TAKEN:
            byMedication[medName].taken++;
            break;
          case MEDICATION_EVENT_TYPES.DOSE_MISSED:
            byMedication[medName].missed++;
            break;
          case MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
            byMedication[medName].skipped++;
            break;
        }
      });

      // Calculate adherence rate for each medication
      Object.keys(byMedication).forEach(medName => {
        const med = byMedication[medName];
        med.adherenceRate = med.scheduled > 0 ? (med.taken / med.scheduled) * 100 : 0;
      });

      const metrics = {
        totalScheduled,
        totalTaken,
        totalMissed,
        totalSkipped,
        adherenceRate,
        onTimeRate,
        averageDelayMinutes,
        byMedication
      };

      console.log('📊 Adherence metrics calculated:', metrics);

      return {
        success: true,
        data: metrics
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error calculating adherence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate adherence metrics'
      };
    }
  }

  // ===== EVENT CHAIN OPERATIONS =====

  /**
   * Get event chain for a correlation ID
   */
  async getEventChain(correlationId: string): Promise<{
    success: boolean;
    data?: {
      events: MedicationEvent[];
      timeline: Array<{
        timestamp: Date;
        eventType: string;
        medicationName: string;
        description: string;
      }>;
    };
    error?: string;
  }> {
    try {
      const result = await this.getCorrelatedEvents(correlationId);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch correlated events'
        };
      }

      const events = result.data;
      
      // Create timeline
      const timeline = events.map(event => ({
        timestamp: event.timing.eventTimestamp,
        eventType: event.eventType,
        medicationName: event.context.medicationName,
        description: this.generateEventDescription(event)
      }));

      return {
        success: true,
        data: { events, timeline }
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error getting event chain:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get event chain'
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Generate human-readable event description
   */
  private generateEventDescription(event: MedicationEvent): string {
    const medName = event.context.medicationName;
    
    switch (event.eventType) {
      case MEDICATION_EVENT_TYPES.MEDICATION_CREATED:
        return `${medName} was added to medication list`;
      case MEDICATION_EVENT_TYPES.DOSE_SCHEDULED:
        return `${medName} dose scheduled for ${event.eventData.scheduledDateTime?.toLocaleTimeString()}`;
      case MEDICATION_EVENT_TYPES.DOSE_TAKEN:
        return `${medName} was taken${event.timing.isOnTime ? ' on time' : event.timing.minutesLate ? ` ${event.timing.minutesLate} minutes late` : ''}`;
      case MEDICATION_EVENT_TYPES.DOSE_MISSED:
        return `${medName} dose was missed`;
      case MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
        return `${medName} dose was skipped (${event.eventData.skipReason})`;
      case MEDICATION_EVENT_TYPES.DOSE_SNOOZED:
        return `${medName} was snoozed for ${event.eventData.snoozeMinutes} minutes`;
      case MEDICATION_EVENT_TYPES.REMINDER_SENT:
        return `Reminder sent for ${medName} via ${event.eventData.reminderType}`;
      case MEDICATION_EVENT_TYPES.MEDICATION_PAUSED:
        return `${medName} was paused: ${event.eventData.statusReason}`;
      case MEDICATION_EVENT_TYPES.MEDICATION_DISCONTINUED:
        return `${medName} was discontinued: ${event.eventData.statusReason}`;
      default:
        return `${event.eventType} event for ${medName}`;
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
      'eventData.newScheduledTime': event.eventData.newScheduledTime ? 
        admin.firestore.Timestamp.fromDate(event.eventData.newScheduledTime) : null,
      'eventData.reminderSentAt': event.eventData.reminderSentAt ? 
        admin.firestore.Timestamp.fromDate(event.eventData.reminderSentAt) : null,
      'eventData.gracePeriodEnd': event.eventData.gracePeriodEnd ? 
        admin.firestore.Timestamp.fromDate(event.eventData.gracePeriodEnd) : null,
      'timing.eventTimestamp': admin.firestore.Timestamp.fromDate(event.timing.eventTimestamp),
      'timing.scheduledFor': event.timing.scheduledFor ? 
        admin.firestore.Timestamp.fromDate(event.timing.scheduledFor) : null,
      'timing.gracePeriodEnd': event.timing.gracePeriodEnd ? 
        admin.firestore.Timestamp.fromDate(event.timing.gracePeriodEnd) : null,
      'metadata.createdAt': admin.firestore.Timestamp.fromDate(event.metadata.createdAt),
      'metadata.deviceInfo.timestamp': event.metadata.deviceInfo?.timestamp ? 
        admin.firestore.Timestamp.fromDate(event.metadata.deviceInfo.timestamp) : null
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
        actualDateTime: data.eventData?.actualDateTime?.toDate?.() || null,
        newScheduledTime: data.eventData?.newScheduledTime?.toDate?.() || null,
        reminderSentAt: data.eventData?.reminderSentAt?.toDate?.() || null,
        gracePeriodEnd: data.eventData?.gracePeriodEnd?.toDate?.() || null
      },
      timing: {
        ...data.timing,
        eventTimestamp: data.timing.eventTimestamp.toDate(),
        scheduledFor: data.timing.scheduledFor?.toDate?.() || null,
        gracePeriodEnd: data.timing.gracePeriodEnd?.toDate?.() || null
      },
      metadata: {
        ...data.metadata,
        createdAt: data.metadata.createdAt.toDate(),
        deviceInfo: data.metadata.deviceInfo ? {
          ...data.metadata.deviceInfo,
          timestamp: data.metadata.deviceInfo.timestamp?.toDate?.() || new Date()
        } : undefined
      }
    };
  }

  // ===== EVENT STATISTICS =====

  /**
   * Get event statistics for monitoring
   */
  async getEventStatistics(patientId?: string, hours: number = 24): Promise<{
    success: boolean;
    data?: {
      totalEvents: number;
      eventsByType: Record<string, number>;
      eventsBySource: Record<string, number>;
      eventsPerHour: number;
      errorRate: number;
      mostActiveHour: number;
      correlationStats: {
        totalCorrelations: number;
        averageEventsPerCorrelation: number;
      };
    };
    error?: string;
  }> {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const queryOptions: EventQueryOptions = {
        startDate,
        orderBy: 'eventTimestamp',
        orderDirection: 'desc'
      };

      if (patientId) {
        queryOptions.patientId = patientId;
      }

      const result = await this.queryEvents(queryOptions);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch events for statistics'
        };
      }

      const events = result.data;
      
      // Calculate statistics
      const eventsByType: Record<string, number> = {};
      const eventsBySource: Record<string, number> = {};
      const eventsByHour: Record<number, number> = {};
      const correlations = new Set<string>();

      events.forEach(event => {
        // Count by type
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
        
        // Count by source
        eventsBySource[event.context.triggerSource] = (eventsBySource[event.context.triggerSource] || 0) + 1;
        
        // Count by hour
        const hour = event.timing.eventTimestamp.getHours();
        eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;
        
        // Track correlations
        if (event.metadata.correlationId) {
          correlations.add(event.metadata.correlationId);
        }
      });

      // Find most active hour
      const mostActiveHour = Object.entries(eventsByHour)
        .reduce((max, [hour, count]) => count > max.count ? { hour: parseInt(hour), count } : max, { hour: 0, count: 0 })
        .hour;

      const statistics = {
        totalEvents: events.length,
        eventsByType,
        eventsBySource,
        eventsPerHour: events.length / hours,
        errorRate: 0, // Would need error tracking in events
        mostActiveHour,
        correlationStats: {
          totalCorrelations: correlations.size,
          averageEventsPerCorrelation: correlations.size > 0 ? events.length / correlations.size : 0
        }
      };

      return {
        success: true,
        data: statistics
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error getting statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get event statistics'
      };
    }
  }

  // ===== CLEANUP OPERATIONS =====

  /**
   * Archive old events (for data lifecycle management)
   */
  async archiveOldEvents(olderThanDays: number = 90): Promise<{
    success: boolean;
    data?: {
      archived: number;
      errors: string[];
    };
    error?: string;
  }> {
    try {
      console.log('🗄️ MedicationEventService: Archiving events older than', olderThanDays, 'days');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const oldEventsQuery = await this.collection
        .where('timing.eventTimestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(500) // Process in batches
        .get();

      if (oldEventsQuery.empty) {
        return {
          success: true,
          data: { archived: 0, errors: [] }
        };
      }

      // Move to archive collection
      const archiveBatch = this.firestore.batch();
      const deleteBatch = this.firestore.batch();
      const archiveCollection = this.firestore.collection('medication_events_archive');

      oldEventsQuery.docs.forEach(doc => {
        const archiveData = {
          ...doc.data(),
          archivedAt: admin.firestore.Timestamp.now(),
          originalId: doc.id
        };
        
        archiveBatch.set(archiveCollection.doc(doc.id), archiveData);
        deleteBatch.delete(doc.ref);
      });

      // Execute archive and delete
      await archiveBatch.commit();
      await deleteBatch.commit();

      console.log(`✅ Archived ${oldEventsQuery.docs.length} old events`);

      return {
        success: true,
        data: {
          archived: oldEventsQuery.docs.length,
          errors: []
        }
      };

    } catch (error) {
      console.error('❌ MedicationEventService: Error archiving events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to archive old events'
      };
    }
  }
}