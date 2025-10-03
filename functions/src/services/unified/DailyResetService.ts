/**
 * Daily Reset Service
 * 
 * Handles the daily medication reset and archiving system:
 * 1. Archives medication events older than the current day at midnight (patient's timezone)
 * 2. Creates daily summary documents for historical tracking
 * 3. Maintains data integrity and provides rollback capability
 */

import * as admin from 'firebase-admin';
import {
  MedicationEvent,
  MedicationDailySummary,
  MEDICATION_EVENT_TYPES
} from '../../schemas/unifiedMedicationSchema';
import {
  getPreviousDayBoundaries,
  toISODateString,
  isValidTimezone
} from '../../utils/timezoneUtils';

export interface DailyResetOptions {
  patientId: string;
  timezone: string;
  dryRun?: boolean; // If true, don't actually modify data
}

export interface DailyResetResult {
  success: boolean;
  patientId: string;
  summaryDate: string;
  statistics: {
    eventsQueried: number;
    eventsArchived: number;
    summaryCreated: boolean;
  };
  summary?: MedicationDailySummary;
  error?: string;
  rollbackData?: any; // For potential rollback
}

export class DailyResetService {
  private firestore: admin.firestore.Firestore;
  private eventsCollection: admin.firestore.CollectionReference;
  private summariesCollection: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.eventsCollection = this.firestore.collection('medication_events');
    this.summariesCollection = this.firestore.collection('medication_daily_summaries');
  }

  /**
   * Execute the complete daily reset process for a patient
   */
  async executeDailyReset(options: DailyResetOptions): Promise<DailyResetResult> {
    const startTime = Date.now();
    console.log(`🌅 Starting daily reset for patient ${options.patientId} in timezone ${options.timezone}`);

    try {
      // Validate timezone
      if (!isValidTimezone(options.timezone)) {
        return {
          success: false,
          patientId: options.patientId,
          summaryDate: '',
          statistics: {
            eventsQueried: 0,
            eventsArchived: 0,
            summaryCreated: false
          },
          error: `Invalid timezone: ${options.timezone}`
        };
      }

      // Get previous day's boundaries
      const { startOfDay, endOfDay, dateString } = getPreviousDayBoundaries(options.timezone);
      
      console.log(`📅 Processing events for date: ${dateString}`);
      console.log(`⏰ Time range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

      // Step 1: Query events that should be archived
      const eventsToArchive = await this.queryEventsForArchival(
        options.patientId,
        startOfDay,
        endOfDay,
        dateString
      );

      console.log(`📊 Found ${eventsToArchive.length} events to archive`);

      if (eventsToArchive.length === 0) {
        console.log(`ℹ️ No events to archive for ${dateString}`);
        return {
          success: true,
          patientId: options.patientId,
          summaryDate: dateString,
          statistics: {
            eventsQueried: 0,
            eventsArchived: 0,
            summaryCreated: false
          }
        };
      }

      // Step 2: Calculate statistics for daily summary
      const statistics = this.calculateStatistics(eventsToArchive);

      // Step 3: Create daily summary document
      const summary = await this.createDailySummary(
        options.patientId,
        dateString,
        options.timezone,
        eventsToArchive,
        statistics
      );

      if (options.dryRun) {
        console.log(`🔍 DRY RUN: Would archive ${eventsToArchive.length} events`);
        return {
          success: true,
          patientId: options.patientId,
          summaryDate: dateString,
          statistics: {
            eventsQueried: eventsToArchive.length,
            eventsArchived: 0,
            summaryCreated: false
          },
          summary
        };
      }

      // Step 4: Mark events as archived (with rollback capability)
      const archiveResult = await this.markEventsAsArchived(
        eventsToArchive,
        dateString,
        summary.id
      );

      if (!archiveResult.success) {
        console.error(`❌ Failed to archive events: ${archiveResult.error}`);
        return {
          success: false,
          patientId: options.patientId,
          summaryDate: dateString,
          statistics: {
            eventsQueried: eventsToArchive.length,
            eventsArchived: 0,
            summaryCreated: true
          },
          error: archiveResult.error,
          summary
        };
      }

      const executionTime = Date.now() - startTime;
      console.log(`✅ Daily reset completed in ${executionTime}ms`);
      console.log(`📦 Archived ${archiveResult.archivedCount} events`);
      console.log(`📄 Created summary: ${summary.id}`);

      return {
        success: true,
        patientId: options.patientId,
        summaryDate: dateString,
        statistics: {
          eventsQueried: eventsToArchive.length,
          eventsArchived: archiveResult.archivedCount,
          summaryCreated: true
        },
        summary
      };

    } catch (error) {
      console.error(`❌ Error in daily reset for patient ${options.patientId}:`, error);
      return {
        success: false,
        patientId: options.patientId,
        summaryDate: '',
        statistics: {
          eventsQueried: 0,
          eventsArchived: 0,
          summaryCreated: false
        },
        error: error instanceof Error ? error.message : 'Unknown error during daily reset'
      };
    }
  }

  /**
   * Query events that should be archived for a specific day
   */
  private async queryEventsForArchival(
    patientId: string,
    startOfDay: Date,
    endOfDay: Date,
    dateString: string
  ): Promise<MedicationEvent[]> {
    try {
      // Query events within the day's time range that are not already archived
      const snapshot = await this.eventsCollection
        .where('patientId', '==', patientId)
        .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .where('timing.eventTimestamp', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
        .get();

      const events: MedicationEvent[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip if already archived
        if (data.archiveStatus?.isArchived) {
          continue;
        }

        // Deserialize the event
        const event = this.deserializeEvent(doc.id, data);
        events.push(event);
      }

      return events;

    } catch (error) {
      console.error('❌ Error querying events for archival:', error);
      throw error;
    }
  }

  /**
   * Mark events as archived in batch
   */
  private async markEventsAsArchived(
    events: MedicationEvent[],
    dateString: string,
    summaryId: string
  ): Promise<{
    success: boolean;
    archivedCount: number;
    error?: string;
  }> {
    try {
      const batchSize = 500; // Firestore batch limit
      let archivedCount = 0;

      // Process in batches
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = this.firestore.batch();
        const batchEvents = events.slice(i, i + batchSize);

        for (const event of batchEvents) {
          const eventRef = this.eventsCollection.doc(event.id);
          
          batch.update(eventRef, {
            'archiveStatus.isArchived': true,
            'archiveStatus.archivedAt': admin.firestore.FieldValue.serverTimestamp(),
            'archiveStatus.archivedReason': 'daily_reset',
            'archiveStatus.belongsToDate': dateString,
            'archiveStatus.dailySummaryId': summaryId
          });

          archivedCount++;
        }

        await batch.commit();
        console.log(`📦 Archived batch ${Math.floor(i / batchSize) + 1}: ${batchEvents.length} events`);
      }

      return {
        success: true,
        archivedCount
      };

    } catch (error) {
      console.error('❌ Error marking events as archived:', error);
      return {
        success: false,
        archivedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a daily summary document
   */
  private async createDailySummary(
    patientId: string,
    dateString: string,
    timezone: string,
    events: MedicationEvent[],
    statistics: any
  ): Promise<MedicationDailySummary> {
    const summaryId = `${patientId}_${dateString}`;

    const summary: MedicationDailySummary = {
      id: summaryId,
      patientId,
      summaryDate: dateString,
      timezone,
      statistics,
      medicationBreakdown: this.calculateMedicationBreakdown(events),
      archivedEvents: {
        totalArchived: events.length,
        eventIds: events.map(e => e.id),
        archivedAt: new Date()
      },
      metadata: {
        createdAt: new Date(),
        createdBy: 'system',
        version: 1
      }
    };

    // Save to Firestore
    await this.summariesCollection.doc(summaryId).set({
      ...summary,
      'archivedEvents.archivedAt': admin.firestore.FieldValue.serverTimestamp(),
      'metadata.createdAt': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`📄 Created daily summary: ${summaryId}`);

    return summary;
  }

  /**
   * Calculate statistics from events
   */
  private calculateStatistics(events: MedicationEvent[]): {
    totalScheduledDoses: number;
    totalTakenDoses: number;
    totalMissedDoses: number;
    totalSkippedDoses: number;
    totalSnoozedDoses: number;
    adherenceRate: number;
    onTimeRate: number;
    averageDelayMinutes: number;
  } {
    const scheduled = events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SCHEDULED).length;
    const taken = events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_TAKEN);
    const missed = events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_MISSED).length;
    const skipped = events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SKIPPED).length;
    const snoozed = events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SNOOZED).length;

    const takenCount = taken.length;
    const adherenceRate = scheduled > 0 ? (takenCount / scheduled) * 100 : 0;

    const onTimeDoses = taken.filter(e => e.timing.isOnTime).length;
    const onTimeRate = takenCount > 0 ? (onTimeDoses / takenCount) * 100 : 0;

    const lateDoses = taken.filter(e => e.timing.minutesLate && e.timing.minutesLate > 0);
    const totalDelay = lateDoses.reduce((sum, e) => sum + (e.timing.minutesLate || 0), 0);
    const averageDelayMinutes = lateDoses.length > 0 ? totalDelay / lateDoses.length : 0;

    return {
      totalScheduledDoses: scheduled,
      totalTakenDoses: takenCount,
      totalMissedDoses: missed,
      totalSkippedDoses: skipped,
      totalSnoozedDoses: snoozed,
      adherenceRate: Math.round(adherenceRate * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      averageDelayMinutes: Math.round(averageDelayMinutes * 100) / 100
    };
  }

  /**
   * Calculate medication breakdown
   */
  private calculateMedicationBreakdown(events: MedicationEvent[]): Array<{
    commandId: string;
    medicationName: string;
    scheduledDoses: number;
    takenDoses: number;
    missedDoses: number;
    skippedDoses: number;
    adherenceRate: number;
  }> {
    const medicationMap = new Map<string, any>();

    for (const event of events) {
      const key = event.commandId;
      
      if (!medicationMap.has(key)) {
        medicationMap.set(key, {
          commandId: event.commandId,
          medicationName: event.context.medicationName,
          scheduledDoses: 0,
          takenDoses: 0,
          missedDoses: 0,
          skippedDoses: 0,
          adherenceRate: 0
        });
      }

      const med = medicationMap.get(key);

      switch (event.eventType) {
        case MEDICATION_EVENT_TYPES.DOSE_SCHEDULED:
          med.scheduledDoses++;
          break;
        case MEDICATION_EVENT_TYPES.DOSE_TAKEN:
          med.takenDoses++;
          break;
        case MEDICATION_EVENT_TYPES.DOSE_MISSED:
          med.missedDoses++;
          break;
        case MEDICATION_EVENT_TYPES.DOSE_SKIPPED:
          med.skippedDoses++;
          break;
      }
    }

    // Calculate adherence rates
    const breakdown = Array.from(medicationMap.values());
    for (const med of breakdown) {
      med.adherenceRate = med.scheduledDoses > 0 
        ? Math.round((med.takenDoses / med.scheduledDoses) * 10000) / 100
        : 0;
    }

    return breakdown;
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
      },
      archiveStatus: data.archiveStatus ? {
        ...data.archiveStatus,
        archivedAt: data.archiveStatus.archivedAt?.toDate?.() || null
      } : undefined
    };
  }

  /**
   * Get daily summary for a specific date
   */
  async getDailySummary(patientId: string, dateString: string): Promise<MedicationDailySummary | null> {
    try {
      const summaryId = `${patientId}_${dateString}`;
      const doc = await this.summariesCollection.doc(summaryId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        ...data,
        archivedEvents: {
          ...data.archivedEvents,
          archivedAt: data.archivedEvents.archivedAt.toDate()
        },
        metadata: {
          ...data.metadata,
          createdAt: data.metadata.createdAt.toDate()
        }
      } as MedicationDailySummary;

    } catch (error) {
      console.error('❌ Error getting daily summary:', error);
      return null;
    }
  }

  /**
   * Get daily summaries for a date range
   */
  async getDailySummaries(
    patientId: string,
    startDate: string,
    endDate: string
  ): Promise<MedicationDailySummary[]> {
    try {
      const snapshot = await this.summariesCollection
        .where('patientId', '==', patientId)
        .where('summaryDate', '>=', startDate)
        .where('summaryDate', '<=', endDate)
        .orderBy('summaryDate', 'desc')
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          archivedEvents: {
            ...data.archivedEvents,
            archivedAt: data.archivedEvents.archivedAt.toDate()
          },
          metadata: {
            ...data.metadata,
            createdAt: data.metadata.createdAt.toDate()
          }
        } as MedicationDailySummary;
      });

    } catch (error) {
      console.error('❌ Error getting daily summaries:', error);
      return [];
    }
  }
}