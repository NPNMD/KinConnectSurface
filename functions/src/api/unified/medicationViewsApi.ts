/**
 * Unified Medication Views API
 * 
 * Consolidates read-only view operations into single-purpose endpoints:
 * - GET /medication-views/today-buckets - Get today's medication buckets
 * - GET /medication-views/dashboard - Get dashboard summary
 * - GET /medication-views/calendar - Get calendar view data
 * 
 * Replaces fragmented endpoints:
 * - /medication-calendar/events/today-buckets
 * - /medication-calendar/adherence/summary
 * - Multiple dashboard and view endpoints
 */

import express from 'express';
import { MedicationCommandService } from '../../services/unified/MedicationCommandService';
import { MedicationEventService } from '../../services/unified/MedicationEventService';
import { MedicationOrchestrator } from '../../services/unified/MedicationOrchestrator';
import { MEDICATION_EVENT_TYPES } from '../../schemas/unifiedMedicationSchema';

const router = express.Router();

// Lazy initialization to avoid Firebase Admin initialization order issues
let commandService: MedicationCommandService;
let eventService: MedicationEventService;
let orchestrator: MedicationOrchestrator;

function getCommandService(): MedicationCommandService {
  if (!commandService) {
    commandService = new MedicationCommandService();
  }
  return commandService;
}

function getEventService(): MedicationEventService {
  if (!eventService) {
    eventService = new MedicationEventService();
  }
  return eventService;
}

function getOrchestrator(): MedicationOrchestrator {
  if (!orchestrator) {
    orchestrator = new MedicationOrchestrator();
  }
  return orchestrator;
}

// ===== VIEW ENDPOINTS =====

/**
 * GET /medication-views/today-buckets
 * Get today's medications organized by time buckets
 */
router.get('/today-buckets', async (req, res) => {
  try {
    console.log('🗂️ GET /medication-views/today-buckets - Getting today\'s medication buckets');
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const {
      patientId,
      date
    } = req.query;

    const targetPatientId = (patientId as string) || userId;
    const targetDate = date ? new Date(date as string) : new Date();
    
    // Check access permissions
    if (targetPatientId !== userId) {
      // TODO: Add family access validation here
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get active commands for the patient
    const commandsResult = await getCommandService().getActiveCommands(targetPatientId);
    
    if (!commandsResult.success || !commandsResult.data) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch active medications'
      });
    }

    const commands = commandsResult.data;

    // Get today's scheduled and completed events
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const eventsResult = await getEventService().queryEvents({
      patientId: targetPatientId,
      eventType: [
        MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        MEDICATION_EVENT_TYPES.DOSE_TAKEN,
        MEDICATION_EVENT_TYPES.DOSE_MISSED,
        MEDICATION_EVENT_TYPES.DOSE_SKIPPED
      ],
      startDate: startOfDay,
      endDate: endOfDay,
      orderBy: 'eventTimestamp',
      orderDirection: 'asc'
    });

    // Filter out archived events (only show today's active events)
    const allEvents = eventsResult.data || [];
    const events = allEvents.filter(event => !event.archiveStatus?.isArchived);
    
    console.log(`📊 Filtered events: ${allEvents.length} total, ${events.length} non-archived`);

    // Organize into time buckets
    const now = new Date();
    const buckets = {
      now: [] as any[],
      dueSoon: [] as any[],
      morning: [] as any[],
      lunch: [] as any[], // Updated from 'noon'
      evening: [] as any[],
      beforeBed: [] as any[], // Updated from 'bedtime'
      overdue: [] as any[],
      completed: [] as any[],
      lastUpdated: now
    };

    // Process each command to create bucket items
    for (const command of commands) {
      if (command.status.isPRN) continue; // Skip PRN medications
      
      // Find today's events for this medication
      const medicationEvents = events.filter(e => e.commandId === command.id);
      
      // Check if already taken/completed today
      const completedEvent = medicationEvents.find(e => 
        e.eventType === MEDICATION_EVENT_TYPES.DOSE_TAKEN ||
        e.eventType === MEDICATION_EVENT_TYPES.DOSE_MISSED ||
        e.eventType === MEDICATION_EVENT_TYPES.DOSE_SKIPPED
      );

      if (completedEvent) {
        buckets.completed.push({
          commandId: command.id,
          medicationName: command.medication.name,
          dosageAmount: command.schedule.dosageAmount,
          scheduledTime: completedEvent.timing.scheduledFor,
          completedAt: completedEvent.timing.eventTimestamp,
          status: completedEvent.eventType.replace('dose_', ''),
          isOnTime: completedEvent.timing.isOnTime,
          minutesLate: completedEvent.timing.minutesLate,
          notes: completedEvent.eventData.actionNotes
        });
        continue;
      }

      // Find scheduled event for today
      const scheduledEvent = medicationEvents.find(e => 
        e.eventType === MEDICATION_EVENT_TYPES.DOSE_SCHEDULED
      );

      if (scheduledEvent && scheduledEvent.timing.scheduledFor) {
        const scheduledTime = scheduledEvent.timing.scheduledFor;
        const minutesUntilDue = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
        
        const bucketItem = {
          commandId: command.id,
          eventId: scheduledEvent.id,
          medicationName: command.medication.name,
          dosageAmount: command.schedule.dosageAmount,
          scheduledTime,
          minutesUntilDue,
          isOverdue: minutesUntilDue < 0,
          minutesOverdue: minutesUntilDue < 0 ? Math.abs(minutesUntilDue) : 0,
          gracePeriodEnd: scheduledEvent.timing.gracePeriodEnd,
          instructions: command.medication.instructions,
          timeSlot: command.preferences.timeSlot
        };

        // Classify into appropriate bucket
        if (minutesUntilDue < 0) {
          buckets.overdue.push(bucketItem);
        } else if (minutesUntilDue <= 15) {
          buckets.now.push(bucketItem);
        } else if (minutesUntilDue <= 60) {
          buckets.dueSoon.push(bucketItem);
        } else {
          // Classify by time slot
          switch (command.preferences.timeSlot) {
            case 'morning':
              buckets.morning.push(bucketItem);
              break;
            case 'lunch': // Updated from 'noon'
              buckets.lunch.push(bucketItem);
              break;
            case 'evening':
              buckets.evening.push(bucketItem);
              break;
            case 'beforeBed': // Updated from 'bedtime'
              buckets.beforeBed.push(bucketItem);
              break;
            default:
              // Determine by time
              const hour = scheduledTime.getHours();
              if (hour >= 6 && hour < 11) buckets.morning.push(bucketItem);
              else if (hour >= 11 && hour < 15) buckets.lunch.push(bucketItem); // Updated from 'noon'
              else if (hour >= 17 && hour < 21) buckets.evening.push(bucketItem);
              else buckets.beforeBed.push(bucketItem); // Updated from 'bedtime'
          }
        }
      }
    }

    res.json({
      success: true,
      data: buckets,
      summary: {
        totalMedications: commands.length,
        scheduledToday: buckets.now.length + buckets.dueSoon.length + buckets.morning.length +
                       buckets.lunch.length + buckets.evening.length + buckets.beforeBed.length, // Updated field names
        completed: buckets.completed.length,
        overdue: buckets.overdue.length,
        date: targetDate.toISOString().split('T')[0]
      },
      message: 'Today\'s medication buckets retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error in GET /medication-views/today-buckets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /medication-views/dashboard
 * Get comprehensive dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    console.log('📊 GET /medication-views/dashboard - Getting dashboard data');
    
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

    // Get command statistics
    const commandStatsResult = await getCommandService().getCommandStats(targetPatientId);
    
    // Get adherence metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const adherenceResult = await getEventService().calculateAdherenceMetrics(
      targetPatientId,
      thirtyDaysAgo,
      new Date()
    );

    // Get recent missed medications
    const missedResult = await getEventService().getMissedEventsInGracePeriod(targetPatientId);

    // Get event statistics (last 7 days)
    const eventStatsResult = await getEventService().getEventStatistics(targetPatientId, 24 * 7);

    // Compile dashboard data
    const dashboardData = {
      medications: {
        total: commandStatsResult.data?.total || 0,
        active: commandStatsResult.data?.active || 0,
        paused: commandStatsResult.data?.paused || 0,
        withReminders: commandStatsResult.data?.withReminders || 0,
        prnMedications: commandStatsResult.data?.prnMedications || 0,
        byFrequency: commandStatsResult.data?.byFrequency || {},
        byType: commandStatsResult.data?.byMedicationType || {}
      },
      adherence: {
        totalScheduled: adherenceResult.data?.totalScheduled || 0,
        totalTaken: adherenceResult.data?.totalTaken || 0,
        totalMissed: adherenceResult.data?.totalMissed || 0,
        adherenceRate: adherenceResult.data?.adherenceRate || 0,
        onTimeRate: adherenceResult.data?.onTimeRate || 0,
        averageDelayMinutes: adherenceResult.data?.averageDelayMinutes || 0,
        byMedication: adherenceResult.data?.byMedication || {}
      },
      alerts: {
        missedMedications: missedResult.data?.length || 0,
        recentMissed: missedResult.data || []
      },
      activity: {
        totalEvents: eventStatsResult.data?.totalEvents || 0,
        eventsByType: eventStatsResult.data?.eventsByType || {},
        eventsPerHour: eventStatsResult.data?.eventsPerHour || 0,
        mostActiveHour: eventStatsResult.data?.mostActiveHour || 0
      },
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: dashboardData,
      message: 'Dashboard data retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error in GET /medication-views/dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /medication-views/calendar
 * Get calendar view data for date range
 */
router.get('/calendar', async (req, res) => {
  try {
    console.log('📅 GET /medication-views/calendar - Getting calendar data');
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const {
      patientId,
      startDate,
      endDate,
      view = 'week'
    } = req.query;

    const targetPatientId = (patientId as string) || userId;
    
    // Check access permissions
    if (targetPatientId !== userId) {
      // TODO: Add family access validation here
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Set default date range based on view
    let queryStartDate: Date;
    let queryEndDate: Date;

    if (startDate && endDate) {
      queryStartDate = new Date(startDate as string);
      queryEndDate = new Date(endDate as string);
    } else {
      const today = new Date();
      
      switch (view) {
        case 'day':
          queryStartDate = new Date(today);
          queryStartDate.setHours(0, 0, 0, 0);
          queryEndDate = new Date(today);
          queryEndDate.setHours(23, 59, 59, 999);
          break;
        
        case 'week':
          queryStartDate = new Date(today);
          queryStartDate.setDate(today.getDate() - today.getDay()); // Start of week
          queryStartDate.setHours(0, 0, 0, 0);
          queryEndDate = new Date(queryStartDate);
          queryEndDate.setDate(queryStartDate.getDate() + 6); // End of week
          queryEndDate.setHours(23, 59, 59, 999);
          break;
        
        case 'month':
          queryStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
          queryEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          queryEndDate.setHours(23, 59, 59, 999);
          break;
        
        default:
          queryStartDate = new Date(today);
          queryStartDate.setDate(today.getDate() - 7);
          queryEndDate = new Date(today);
          queryEndDate.setDate(today.getDate() + 7);
      }
    }

    // Get events for the date range
    const eventsResult = await getEventService().queryEvents({
      patientId: targetPatientId,
      eventType: [
        MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
        MEDICATION_EVENT_TYPES.DOSE_TAKEN,
        MEDICATION_EVENT_TYPES.DOSE_MISSED,
        MEDICATION_EVENT_TYPES.DOSE_SKIPPED
      ],
      startDate: queryStartDate,
      endDate: queryEndDate,
      orderBy: 'eventTimestamp',
      orderDirection: 'asc'
    });

    // Filter out archived events for calendar view
    const allEvents = eventsResult.data || [];
    const events = allEvents.filter(event => !event.archiveStatus?.isArchived);
    
    console.log(`📊 Calendar events filtered: ${allEvents.length} total, ${events.length} non-archived`);

    // Get active commands for medication details
    const commandsResult = await getCommandService().getActiveCommands(targetPatientId);
    const commands = commandsResult.data || [];
    const commandsMap = new Map(commands.map(cmd => [cmd.id, cmd]));

    // Organize events by date
    const eventsByDate: Record<string, any[]> = {};
    
    events.forEach(event => {
      const dateKey = event.timing.eventTimestamp.toISOString().split('T')[0];
      
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }

      const command = commandsMap.get(event.commandId);
      
      eventsByDate[dateKey].push({
        eventId: event.id,
        commandId: event.commandId,
        medicationName: event.context.medicationName,
        dosageAmount: command?.schedule.dosageAmount || 'Unknown',
        scheduledTime: event.timing.scheduledFor || event.timing.eventTimestamp,
        actualTime: event.eventData.actualDateTime,
        status: event.eventType.replace('dose_', ''),
        isOnTime: event.timing.isOnTime,
        minutesLate: event.timing.minutesLate,
        notes: event.eventData.actionNotes,
        timeSlot: command?.preferences.timeSlot || 'custom',
        medicationType: command?.gracePeriod.medicationType || 'standard'
      });
    });

    // Generate calendar structure
    const calendarData = {
      dateRange: {
        startDate: queryStartDate,
        endDate: queryEndDate,
        view
      },
      eventsByDate,
      summary: {
        totalDays: Object.keys(eventsByDate).length,
        totalEvents: events.length,
        scheduledEvents: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SCHEDULED).length,
        takenEvents: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_TAKEN).length,
        missedEvents: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_MISSED).length,
        skippedEvents: events.filter(e => e.eventType === MEDICATION_EVENT_TYPES.DOSE_SKIPPED).length
      },
      medications: commands.map(cmd => ({
        commandId: cmd.id,
        name: cmd.medication.name,
        frequency: cmd.schedule.frequency,
        times: cmd.schedule.times,
        timeSlot: cmd.preferences.timeSlot,
        isActive: cmd.status.isActive,
        medicationType: cmd.gracePeriod.medicationType
      }))
    };

    res.json({
      success: true,
      data: calendarData,
      message: 'Calendar data retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error in GET /medication-views/calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /medication-views/dashboard
 * Get comprehensive dashboard summary
 */
router.get('/dashboard', async (req, res) => {
  try {
    console.log('📊 GET /medication-views/dashboard - Getting dashboard summary');
    
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

    // Get today's buckets data directly
    const todayBuckets = { data: null }; // Simplified for now - would call today-buckets logic

    // Get adherence metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const adherenceResult = await getEventService().calculateAdherenceMetrics(
      targetPatientId,
      thirtyDaysAgo,
      new Date()
    );

    // Get command statistics
    const commandStatsResult = await getCommandService().getCommandStats(targetPatientId);

    // Get workflow statistics
    const workflowStatsResult = await getOrchestrator().getWorkflowStatistics(24);

    const dashboardSummary = {
      overview: {
        totalMedications: commandStatsResult.data?.total || 0,
        activeMedications: commandStatsResult.data?.active || 0,
        medicationsWithReminders: commandStatsResult.data?.withReminders || 0,
        prnMedications: commandStatsResult.data?.prnMedications || 0
      },
      
      todayStatus: {
        now: (todayBuckets as any)?.now?.length || 0,
        dueSoon: (todayBuckets as any)?.dueSoon?.length || 0,
        overdue: (todayBuckets as any)?.overdue?.length || 0,
        completed: (todayBuckets as any)?.completed?.length || 0,
        totalScheduled: ((todayBuckets as any)?.now?.length || 0) +
                       ((todayBuckets as any)?.dueSoon?.length || 0) +
                       ((todayBuckets as any)?.morning?.length || 0) +
                       ((todayBuckets as any)?.lunch?.length || 0) + // Updated from 'noon'
                       ((todayBuckets as any)?.evening?.length || 0) +
                       ((todayBuckets as any)?.beforeBed?.length || 0) // Updated from 'bedtime'
      },
      
      adherence: {
        last30Days: {
          adherenceRate: adherenceResult.data?.adherenceRate || 0,
          onTimeRate: adherenceResult.data?.onTimeRate || 0,
          totalScheduled: adherenceResult.data?.totalScheduled || 0,
          totalTaken: adherenceResult.data?.totalTaken || 0,
          totalMissed: adherenceResult.data?.totalMissed || 0,
          averageDelayMinutes: adherenceResult.data?.averageDelayMinutes || 0
        },
        byMedication: adherenceResult.data?.byMedication || {}
      },
      
      systemHealth: {
        workflowSuccessRate: workflowStatsResult.data?.successRate || 0,
        averageResponseTime: workflowStatsResult.data?.averageExecutionTime || 0,
        totalWorkflows: workflowStatsResult.data?.totalWorkflows || 0,
        notificationsSent: workflowStatsResult.data?.notificationsSent || 0
      },
      
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: dashboardSummary,
      message: 'Dashboard summary retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error in GET /medication-views/dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;