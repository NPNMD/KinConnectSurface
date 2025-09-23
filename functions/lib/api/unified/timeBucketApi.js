"use strict";
/**
 * Time Bucket Management API
 *
 * Provides endpoints for managing patient time preferences and time bucket configurations:
 * - GET /time-buckets/preferences - Get patient time preferences
 * - POST /time-buckets/preferences - Create patient time preferences
 * - PUT /time-buckets/preferences - Update patient time preferences
 * - GET /time-buckets/status - Get time bucket status for a date
 * - POST /time-buckets/compute-schedule - Compute medication schedule
 * - GET /time-buckets/optimal-time - Get optimal time for medication
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const TimeBucketService_1 = require("../../services/unified/TimeBucketService");
const unifiedMedicationSchema_1 = require("../../schemas/unifiedMedicationSchema");
const router = express_1.default.Router();
// Lazy initialization to avoid Firebase Admin initialization order issues
let timeBucketService;
function getTimeBucketService() {
    if (!timeBucketService) {
        timeBucketService = new TimeBucketService_1.TimeBucketService();
    }
    return timeBucketService;
}
// ===== TIME PREFERENCES ENDPOINTS =====
/**
 * GET /time-buckets/preferences
 * Get patient time preferences
 */
router.get('/preferences', async (req, res) => {
    try {
        console.log('🕐 GET /time-buckets/preferences - Getting patient time preferences');
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
        const result = await getTimeBucketService().getTimePreferences(targetPatientId);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Time preferences retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /time-buckets/preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /time-buckets/preferences
 * Create patient time preferences
 */
router.post('/preferences', async (req, res) => {
    try {
        console.log('🕐 POST /time-buckets/preferences - Creating patient time preferences');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, timeBuckets, frequencyMapping, lifestyle } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getTimeBucketService().createTimePreferences({
            patientId: targetPatientId,
            timeBuckets,
            frequencyMapping,
            lifestyle,
            createdBy: userId
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.status(201).json({
            success: true,
            data: result.data,
            message: 'Time preferences created successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /time-buckets/preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PUT /time-buckets/preferences
 * Update patient time preferences
 */
router.put('/preferences', async (req, res) => {
    try {
        console.log('🕐 PUT /time-buckets/preferences - Updating patient time preferences');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, updates, reason } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getTimeBucketService().updateTimePreferences({
            patientId: targetPatientId,
            updates,
            updatedBy: userId,
            reason
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Time preferences updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in PUT /time-buckets/preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== TIME BUCKET STATUS ENDPOINTS =====
/**
 * GET /time-buckets/status
 * Get time bucket status for a specific date
 */
router.get('/status', async (req, res) => {
    try {
        console.log('🗂️ GET /time-buckets/status - Getting time bucket status');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, date, includeMedications = 'true', includeCompleted = 'false' } = req.query;
        const targetPatientId = patientId || userId;
        const targetDate = date ? new Date(date) : new Date();
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const result = await getTimeBucketService().getTimeBucketStatus({
            patientId: targetPatientId,
            date: targetDate,
            includeMedications: includeMedications === 'true',
            includeCompleted: includeCompleted === 'true'
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
            message: 'Time bucket status retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /time-buckets/status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== SCHEDULE COMPUTATION ENDPOINTS =====
/**
 * POST /time-buckets/compute-schedule
 * Compute medication schedule based on patient preferences
 */
router.post('/compute-schedule', async (req, res) => {
    try {
        console.log('🕐 POST /time-buckets/compute-schedule - Computing medication schedule');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, frequency, medicationName, customOverrides, flexibleScheduling } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Validate required fields
        if (!frequency || !medicationName) {
            return res.status(400).json({
                success: false,
                error: 'Frequency and medication name are required'
            });
        }
        const result = await getTimeBucketService().computeMedicationSchedule({
            frequency,
            patientId: targetPatientId,
            medicationName,
            customOverrides,
            flexibleScheduling
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Medication schedule computed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /time-buckets/compute-schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /time-buckets/optimal-time
 * Get optimal time for a medication based on patient lifestyle
 */
router.get('/optimal-time', async (req, res) => {
    try {
        console.log('🕐 GET /time-buckets/optimal-time - Getting optimal medication time');
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        const { patientId, medicationName, mustTakeWith, avoidTimes, preferredTimeOfDay } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            // TODO: Add family access validation here
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        // Validate required fields
        if (!medicationName) {
            return res.status(400).json({
                success: false,
                error: 'Medication name is required'
            });
        }
        const constraints = {
            mustTakeWith: mustTakeWith,
            avoidTimes: avoidTimes ? avoidTimes.split(',') : undefined,
            preferredTimeOfDay: preferredTimeOfDay
        };
        const result = await getTimeBucketService().getOptimalMedicationTime(targetPatientId, medicationName, constraints);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            message: 'Optimal medication time computed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /time-buckets/optimal-time:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ===== UTILITY ENDPOINTS =====
/**
 * GET /time-buckets/defaults
 * Get default time bucket configuration
 */
router.get('/defaults', async (req, res) => {
    try {
        console.log('🕐 GET /time-buckets/defaults - Getting default time bucket configuration');
        res.json({
            success: true,
            data: unifiedMedicationSchema_1.DEFAULT_PATIENT_TIME_PREFERENCES,
            message: 'Default time bucket configuration retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error in GET /time-buckets/defaults:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /time-buckets/validate
 * Validate time bucket configuration
 */
router.post('/validate', async (req, res) => {
    try {
        console.log('🕐 POST /time-buckets/validate - Validating time bucket configuration');
        const { preferences } = req.body;
        if (!preferences) {
            return res.status(400).json({
                success: false,
                error: 'Time preferences are required for validation'
            });
        }
        const validation = getTimeBucketService().validateTimeBuckets(preferences);
        res.json({
            success: true,
            data: validation,
            message: 'Time bucket configuration validated'
        });
    }
    catch (error) {
        console.error('❌ Error in POST /time-buckets/validate:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
