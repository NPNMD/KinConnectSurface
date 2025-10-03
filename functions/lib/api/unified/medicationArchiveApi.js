"use strict";
/**
 * Medication Archive API
 *
 * Provides endpoints for accessing archived medication events and daily summaries:
 * - GET /medication-events/archived - Get archived events
 * - GET /medication-events/daily-summaries - Get daily summaries
 * - GET /medication-events/daily-summaries/:date - Get specific daily summary
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MedicationEventService_1 = require("../../services/unified/MedicationEventService");
const DailyResetService_1 = require("../../services/unified/DailyResetService");
const router = express_1.default.Router();
// Lazy initialization
let eventService;
let dailyResetService;
function getEventService() {
    if (!eventService) {
        eventService = new MedicationEventService_1.MedicationEventService();
    }
    return eventService;
}
function getDailyResetService() {
    if (!dailyResetService) {
        dailyResetService = new DailyResetService_1.DailyResetService();
    }
    return dailyResetService;
}
/**
 * GET /medication-events/archived
 * Get archived medication events with filtering
 */
router.get('/archived', async (req, res) => {
    try {
        console.log('🗄️ GET /medication-events/archived - Getting archived events');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, startDate, endDate, belongsToDate, eventType, limit = '100' } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Parse event types if provided
        let eventTypes = undefined;
        if (eventType) {
            if (Array.isArray(eventType)) {
                eventTypes = eventType;
            }
            else if (typeof eventType === 'string') {
                eventTypes = eventType.split(',');
            }
        }
        // Query archived events
        const queryOptions = {
            patientId: targetPatientId,
            eventType: eventTypes,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: parseInt(limit, 10),
            orderBy: 'eventTimestamp',
            orderDirection: 'desc',
            excludeArchived: false, // Don't exclude archived
            onlyArchived: true, // Only show archived
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
            message: `Found ${result.total || 0} archived events`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/archived:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/daily-summaries
 * Get daily summaries for a date range
 */
router.get('/daily-summaries', async (req, res) => {
    try {
        console.log('📊 GET /medication-events/daily-summaries - Getting daily summaries');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, startDate, endDate, limit = '30' } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Set default date range (last 30 days)
        const defaultEndDate = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - 30);
        const queryStartDate = startDate
            ? new Date(startDate).toISOString().split('T')[0]
            : defaultStartDate.toISOString().split('T')[0];
        const queryEndDate = endDate
            ? new Date(endDate).toISOString().split('T')[0]
            : defaultEndDate.toISOString().split('T')[0];
        // Get daily summaries
        const summaries = await getDailyResetService().getDailySummaries(targetPatientId, queryStartDate, queryEndDate);
        // Apply limit
        const limitNum = parseInt(limit, 10);
        const limitedSummaries = summaries.slice(0, limitNum);
        res.json({
            success: true,
            data: limitedSummaries,
            total: limitedSummaries.length,
            dateRange: {
                startDate: queryStartDate,
                endDate: queryEndDate
            },
            message: `Found ${limitedSummaries.length} daily summaries`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/daily-summaries:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-events/daily-summaries/:date
 * Get daily summary for a specific date
 */
router.get('/daily-summaries/:date', async (req, res) => {
    try {
        console.log('📊 GET /medication-events/daily-summaries/:date - Getting specific daily summary');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { date } = req.params;
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
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }
        // Get daily summary
        const summary = await getDailyResetService().getDailySummary(targetPatientId, date);
        if (!summary) {
            return res.status(404).json({
                success: false,
                error: 'Daily summary not found for this date'
            });
        }
        res.json({
            success: true,
            data: summary,
            message: `Daily summary retrieved for ${date}`
        });
    }
    catch (error) {
        console.error('❌ Error in GET /medication-events/daily-summaries/:date:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-events/trigger-daily-reset
 * Manually trigger daily reset for testing (admin only)
 */
router.post('/trigger-daily-reset', async (req, res) => {
    try {
        console.log('🔄 POST /medication-events/trigger-daily-reset - Manual trigger');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, timezone, dryRun = false } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        if (!timezone) {
            return res.status(400).json({
                success: false,
                error: 'Timezone is required (IANA format, e.g., "America/Chicago")'
            });
        }
        // Execute daily reset
        const result = await getDailyResetService().executeDailyReset({
            patientId: targetPatientId,
            timezone,
            dryRun
        });
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result,
            message: dryRun
                ? `Dry run completed - would archive ${result.statistics.eventsArchived} events`
                : `Daily reset completed - archived ${result.statistics.eventsArchived} events`
        });
    }
    catch (error) {
        console.error('❌ Error in POST /medication-events/trigger-daily-reset:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
