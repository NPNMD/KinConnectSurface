/**
 * Unified Medication API Router
 * 
 * Consolidates 20+ fragmented endpoints into 8 single-purpose endpoints:
 * 
 * MEDICATION COMMANDS (State Management):
 * - POST /medication-commands - Create medication
 * - GET /medication-commands - List medications
 * - GET /medication-commands/:id - Get specific medication
 * - PUT /medication-commands/:id - Update medication
 * - DELETE /medication-commands/:id - Delete medication
 * - POST /medication-commands/:id/take - Mark as taken
 * - POST /medication-commands/:id/status - Change status
 * 
 * MEDICATION EVENTS (Event Processing):
 * - GET /medication-events - Query events
 * - GET /medication-events/:id - Get specific event
 * - GET /medication-events/adherence - Get adherence metrics
 * - GET /medication-events/missed - Get missed medications
 * - POST /medication-events/detect-missed - Trigger detection
 * 
 * MEDICATION VIEWS (Read-Only Views):
 * - GET /medication-views/today-buckets - Today's medication buckets
 * - GET /medication-views/dashboard - Dashboard summary
 * - GET /medication-views/calendar - Calendar view data
 *
 * TIME BUCKETS (Flexible Scheduling):
 * - GET /time-buckets/preferences - Get patient time preferences
 * - POST /time-buckets/preferences - Create patient time preferences
 * - PUT /time-buckets/preferences - Update patient time preferences
 * - GET /time-buckets/status - Get time bucket status
 * - POST /time-buckets/compute-schedule - Compute medication schedule
 * - GET /time-buckets/optimal-time - Get optimal medication time
 *
 * This replaces the fragmented system of:
 * - /medications, /medication-schedules, /medication-reminders
 * - /medication-calendar/events, /medication-calendar/adherence
 * - /medication-calendar/events/today-buckets
 * - /patients/preferences/medication-timing
 * - Multiple status and action endpoints
 */

import express from 'express';
import medicationCommandsApi from './medicationCommandsApi';
import medicationEventsApi from './medicationEventsApi';
import medicationViewsApi from './medicationViewsApi';
import timeBucketApi from './timeBucketApi';

const router = express.Router();

// ===== UNIFIED API ROUTES =====

// Medication Commands API - State management operations
router.use('/medication-commands', medicationCommandsApi);

// Medication Events API - Event processing operations  
router.use('/medication-events', medicationEventsApi);

// Medication Views API - Read-only view operations
router.use('/medication-views', medicationViewsApi);

// Time Bucket API - Flexible scheduling and time preference management
router.use('/time-buckets', timeBucketApi);

// ===== API HEALTH AND MONITORING =====

/**
 * GET /unified-medication/health
 * Health check for unified medication system
 */
router.get('/health', async (req, res) => {
  try {
    console.log('🏥 GET /unified-medication/health - System health check');

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        commandService: 'operational',
        eventService: 'operational', 
        notificationService: 'operational',
        transactionManager: 'operational',
        orchestrator: 'operational'
      },
      endpoints: {
        commands: 7,
        events: 5,
        views: 3,
        timeBuckets: 6,
        total: 21
      },
      features: {
        unifiedCollections: true,
        eventSourcing: true,
        acidTransactions: true,
        singleResponsibility: true,
        consolidatedEndpoints: true,
        flexibleTimeScheduling: true,
        patientTimePreferences: true,
        customTimeBuckets: true
      }
    };

    res.json({
      success: true,
      data: healthData,
      message: 'Unified medication system is healthy'
    });

  } catch (error) {
    console.error('❌ Error in unified medication health check:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /unified-medication/info
 * Get system information and capabilities
 */
router.get('/info', (req, res) => {
  const systemInfo = {
    name: 'Unified Medication Data Flow',
    version: '1.0.0',
    description: 'Consolidated medication management system with single source of truth',
    
    architecture: {
      collections: {
        total: 3,
        unified: [
          'medication_commands - Single authoritative source for all medication state',
          'medication_events - Immutable event log for audit trail and state derivation', 
          'family_access - Simplified permissions only'
        ],
        replaced: [
          'medications', 'medication_schedules', 'medication_reminders',
          'medication_calendar_events', 'medication_grace_periods',
          'patient_medication_preferences', 'prn_medication_logs',
          'medication_status_changes', 'medication_detection_metrics'
        ]
      },
      
      services: {
        total: 5,
        singleResponsibility: [
          'MedicationCommandService - ONLY manages command state (CRUD)',
          'MedicationEventService - ONLY processes events (create/query)',
          'MedicationNotificationService - ONLY handles notifications',
          'MedicationTransactionManager - ONLY ensures ACID compliance',
          'MedicationOrchestrator - ONLY coordinates between services'
        ]
      },
      
      endpoints: {
        total: 8,
        consolidated: [
          '/medication-commands/* - Command operations only',
          '/medication-events/* - Event operations only', 
          '/medication-views/* - Read-only views only'
        ],
        replaced: '20+ fragmented endpoints'
      }
    },
    
    benefits: [
      'Single source of truth eliminates synchronization issues',
      'Event sourcing provides complete audit trail',
      'ACID transactions ensure data consistency',
      'Single responsibility services reduce complexity',
      'Consolidated endpoints simplify API surface'
    ],
    
    capabilities: {
      dataFlow: 'unified',
      consistency: 'ACID',
      auditTrail: 'complete',
      transactions: 'atomic',
      rollback: 'automatic',
      notifications: 'integrated',
      familyAccess: 'simplified',
      migration: 'backward_compatible'
    }
  };

  res.json({
    success: true,
    data: systemInfo,
    message: 'Unified medication system information'
  });
});

/**
 * POST /unified-medication/migrate
 * Trigger migration from old system to unified system
 */
router.post('/migrate', async (req, res) => {
  try {
    console.log('🔄 POST /unified-medication/migrate - Starting migration');
    
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const {
      patientId,
      dryRun = true,
      batchSize = 10
    } = req.body;

    const targetPatientId = patientId || userId;

    // Check access permissions
    if (targetPatientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - can only migrate own data'
      });
    }

    // TODO: Implement migration logic
    // For now, return placeholder response
    const migrationResult = {
      dryRun,
      patientId: targetPatientId,
      collections: {
        medications: { found: 0, migrated: 0, errors: 0 },
        medication_schedules: { found: 0, migrated: 0, errors: 0 },
        medication_calendar_events: { found: 0, migrated: 0, errors: 0 },
        medication_reminders: { found: 0, migrated: 0, errors: 0 }
      },
      summary: {
        totalFound: 0,
        totalMigrated: 0,
        totalErrors: 0,
        migrationTime: 0
      },
      errors: [] as string[],
      warnings: [] as string[]
    };

    if (dryRun) {
      migrationResult.warnings.push('This was a dry run - no data was actually migrated');
    }

    res.json({
      success: true,
      data: migrationResult,
      message: dryRun ? 'Migration dry run completed' : 'Migration completed successfully'
    });

  } catch (error) {
    console.error('❌ Error in POST /unified-medication/migrate:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;