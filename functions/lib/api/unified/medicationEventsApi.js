"use strict";
/**
 * Unified Medication Events API
 *
 * Consolidates event operations into single-purpose endpoints:
 * - GET /medication-events - Query events with filters
 * - GET /medication-events/:id - Get specific event
 * - GET /medication-events/adherence - Get adherence metrics
 * - GET /medication-events/missed - Get missed medications
 * - POST /medication-events/detect-missed - Trigger missed detection
 *
 * Replaces fragmented endpoints:
 * - /medication-calendar/events, /medication-calendar/adherence
 * - /medication-calendar/missed, /medication-calendar/detect-missed
 * - Various event tracking endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MedicationEventService_1 = require("../../services/unified/MedicationEventService");
const MedicationOrchestrator_1 = require("../../services/unified/MedicationOrchestrator");
const AdherenceAnalyticsService_1 = require("../../services/unified/AdherenceAnalyticsService");
const router = express_1.default.Router();
// Lazy initialization to avoid Firebase Admin initialization order issues
let eventService;
let orchestrator;
let adherenceService;
function getEventService() {
    if (!eventService) {
        eventService = new MedicationEventService_1.MedicationEventService();
    }
    return eventService;
}
function getOrchestrator() {
    if (!orchestrator) {
        orchestrator = new MedicationOrchestrator_1.MedicationOrchestrator();
    }
    return orchestrator;
}
function getAdherenceService() {
    if (!adherenceService) {
        adherenceService = new AdherenceAnalyticsService_1.AdherenceAnalyticsService();
    }
    return adherenceService;
}
// ===== EVENT QUERY ENDPOINTS =====
/**
 * GET /medication-events
 * Query medication events with comprehensive filtering
 */
router.get('/', async (req, res) => {
    try {
        console.log('🔍 GET /medication-events - Querying events');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, commandId, eventType, startDate, endDate, correlationId, triggerSource, limit, orderBy, orderDirection, excludeArchived, onlyArchived, belongsToDate } = req.query;
        // Determine target patient
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Parse event types
        let eventTypes = undefined;
        if (eventType) {
            if (Array.isArray(eventType)) {
                eventTypes = eventType;
            }
            else if (typeof eventType === 'string') {
                eventTypes = eventType.split(',');
            }
        }
        const queryOptions = {
            patientId: targetPatientId,
            commandId: commandId,
            eventType: eventTypes,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            correlationId: correlationId,
            triggerSource: triggerSource,
            limit: limit ? parseInt(limit, 10) : undefined,
            orderBy: orderBy || 'eventTimestamp',
            orderDirection: orderDirection || 'desc',
            excludeArchived: excludeArchived !== 'false', // Default to true
            onlyArchived: onlyArchived === 'true', // Default to false
            belongsToDate: belongsToDate
        };
        const result = await getEventService().queryEvents(queryOptions);
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
            message: `Found ${result.total || 0} events`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/:id
 * Get specific medication event
 */
router.get('/:eventId', async (req, res) => {
    try {
        console.log('🔍 GET /medication-events/:id - Getting event:', req.params.eventId);
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { eventId } = req.params;
        const result = await getEventService().getEvent(eventId);
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error
            });
        }
        const event = result.data;
        // Check access permissions
        if (event.patientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        res.json({
            success: true,
            data: event,
            message: 'Event retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/:id:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== ADHERENCE AND ANALYTICS ENDPOINTS =====
/**
 * GET /medication-events/adherence
 * Get medication adherence metrics
 */
router.get('/adherence', async (req, res) => {
    try {
        console.log('📊 GET /medication-events/adherence - Getting adherence metrics');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, startDate, endDate } = req.query;
        // Determine target patient
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getEventService().calculateAdherenceMetrics(targetPatientId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Adherence metrics calculated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/adherence:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/missed
 * Get missed medication events
 */
router.get('/missed', async (req, res) => {
    try {
        console.log('🔍 GET /medication-events/missed - Getting missed medications');
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
        const result = await getEventService().getMissedEventsInGracePeriod(targetPatientId);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data || [],
            total: result.data?.length || 0,
            message: `Found ${result.data?.length || 0} missed medications`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/missed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-events/detect-missed
 * Trigger missed medication detection
 */
router.post('/detect-missed', async (req, res) => {
    try {
        console.log('🔍 POST /medication-events/detect-missed - Triggering missed detection');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        // Execute missed medication detection workflow
        const result = await getOrchestrator().processMissedMedicationDetection();
        res.json({
            success: result.success,
            data: {
                workflowsExecuted: result.workflowsExecuted,
                medicationsProcessed: result.medicationsProcessed,
                missedDetected: result.missedDetected,
                notificationsSent: result.notificationsSent,
                executionTimeMs: result.executionTimeMs
            },
            errors: result.errors,
            message: `Processed ${result.medicationsProcessed} medications, detected ${result.missedDetected} missed doses`
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-events/detect-missed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== EVENT ANALYTICS ENDPOINTS =====
/**
 * GET /medication-events/stats
 * Get event statistics
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 GET /medication-events/stats - Getting event statistics');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, hours = '24' } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getEventService().getEventStatistics(targetPatientId, parseInt(hours, 10));
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Event statistics retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/chain/:correlationId
 * Get event chain for correlation ID
 */
router.get('/chain/:correlationId', async (req, res) => {
    try {
        console.log('🔗 GET /medication-events/chain/:correlationId - Getting event chain');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { correlationId } = req.params;
        const result = await getEventService().getEventChain(correlationId);
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error
            });
        }
        // Check if user has access to any events in the chain
        const events = result.data.events;
        const hasAccess = events.some(event => event.patientId === userId);
        if (!hasAccess) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: `Found ${events.length} events in chain`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/chain/:correlationId:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/aggregate
 * Get aggregated event data for analytics
 */
router.get('/aggregate', async (req, res) => {
    try {
        console.log('📊 GET /medication-events/aggregate - Getting aggregated data');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, startDate, endDate, groupBy = 'eventType', eventTypes } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Parse event types filter
        let eventTypeFilter = undefined;
        if (eventTypes) {
            eventTypeFilter = typeof eventTypes === 'string'
                ? eventTypes.split(',')
                : eventTypes;
        }
        const result = await getEventService().aggregateEvents({
            patientId: targetPatientId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            groupBy: groupBy,
            eventTypes: eventTypeFilter
        });
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            groupBy,
            message: 'Event aggregation completed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/aggregate:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/adherence/comprehensive
 * Get comprehensive adherence analytics
 */
router.get('/adherence/comprehensive', async (req, res) => {
    try {
        console.log('📊 GET /medication-events/adherence/comprehensive - Getting comprehensive adherence');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, medicationId, startDate, endDate, includePatterns = 'true', includePredictions = 'true', includeFamilyData = 'false' } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const options = {
            patientId: targetPatientId,
            medicationId: medicationId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            includePatterns: includePatterns === 'true',
            includePredictions: includePredictions === 'true',
            includeFamilyData: includeFamilyData === 'true'
        };
        const result = await getAdherenceService().calculateComprehensiveAdherence(options);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Comprehensive adherence analytics calculated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/adherence/comprehensive:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/adherence/report
 * Generate adherence report for patients and families
 */
router.get('/adherence/report', async (req, res) => {
    try {
        console.log('📋 GET /medication-events/adherence/report - Generating adherence report');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, reportType = 'weekly', format = 'summary', includeCharts = 'false', medicationIds } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const options = {
            patientId: targetPatientId,
            reportType: reportType,
            format: format,
            includeCharts: includeCharts === 'true',
            medicationIds: medicationIds ? medicationIds.split(',') : undefined
        };
        const result = await getAdherenceService().generateAdherenceReport(options);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Adherence report generated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/adherence/report:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/adherence/milestones
 * Check adherence milestones and achievements
 */
router.get('/adherence/milestones', async (req, res) => {
    try {
        console.log('🏆 GET /medication-events/adherence/milestones - Checking milestones');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, medicationId } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getAdherenceService().checkAdherenceMilestones(targetPatientId, medicationId);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Adherence milestones checked successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/adherence/milestones:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-events/adherence/calculate
 * Trigger adherence calculation for a patient
 */
router.post('/adherence/calculate', async (req, res) => {
    try {
        console.log('🔄 POST /medication-events/adherence/calculate - Triggering calculation');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, medicationId, forceRecalculate = false } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const options = {
            patientId: targetPatientId,
            medicationId,
            includePatterns: true,
            includePredictions: true,
            includeFamilyData: true
        };
        const result = await getAdherenceService().calculateComprehensiveAdherence(options);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Adherence calculation completed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-events/adherence/calculate:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
