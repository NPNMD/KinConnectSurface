"use strict";
/**
 * Medication Calendar Sync API Endpoints
 *
 * Provides API endpoints for:
 * - Syncing medication events to medical_events collection
 * - Google Calendar integration for medications
 * - Sync status and configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MedicationCalendarSyncService_1 = require("../services/MedicationCalendarSyncService");
const GoogleCalendarMedicationSync_1 = require("../services/GoogleCalendarMedicationSync");
const router = (0, express_1.Router)();
/**
 * POST /medication-calendar-sync/sync
 * Sync medication events to medical_events collection
 */
router.post('/sync', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId, startDate, endDate, medicationId, forceResync } = req.body;
        // Use current user as patient if not specified
        const targetPatientId = patientId || userId;
        console.log('📅 Sync request:', {
            userId,
            targetPatientId,
            startDate,
            endDate,
            medicationId,
            forceResync
        });
        // Check access permissions
        if (targetPatientId !== userId) {
            // Verify family access
            const familyAccess = await req.app.locals.firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', userId)
                .where('patientId', '==', targetPatientId)
                .where('status', '==', 'active')
                .get();
            if (familyAccess.empty) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Parse dates if provided
        const options = {
            patientId: targetPatientId,
            forceResync: forceResync || false
        };
        if (startDate) {
            options.startDate = new Date(startDate);
        }
        if (endDate) {
            options.endDate = new Date(endDate);
        }
        if (medicationId) {
            options.medicationId = medicationId;
        }
        // Perform sync
        const syncResult = await MedicationCalendarSyncService_1.medicationCalendarSyncService.syncMedicationEvents(options);
        res.json({
            success: syncResult.success,
            data: syncResult,
            message: `Synced ${syncResult.synced} events, updated ${syncResult.updated}, skipped ${syncResult.skipped}`
        });
    }
    catch (error) {
        console.error('❌ Error in sync endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-calendar-sync/status
 * Get sync status for a patient
 */
router.get('/status', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            const familyAccess = await req.app.locals.firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', userId)
                .where('patientId', '==', targetPatientId)
                .where('status', '==', 'active')
                .get();
            if (familyAccess.empty) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Get sync status
        const statusResult = await MedicationCalendarSyncService_1.medicationCalendarSyncService.getSyncStatus(targetPatientId);
        if (!statusResult.success) {
            return res.status(500).json(statusResult);
        }
        res.json({
            success: true,
            data: statusResult.data,
            message: 'Sync status retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error getting sync status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-calendar-sync/google/configure
 * Configure Google Calendar sync settings
 */
router.post('/google/configure', async (req, res) => {
    try {
        const userId = req.user.uid;
        const settings = req.body;
        // Use current user as patient if not specified
        const patientId = settings.patientId || userId;
        // Validate required fields
        if (!settings.googleAccountEmail || !settings.googleCalendarId || !settings.accessToken || !settings.refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Missing required Google Calendar credentials'
            });
        }
        // Configure sync
        const configResult = await GoogleCalendarMedicationSync_1.googleCalendarMedicationSync.configureSyncSettings(userId, patientId, {
            googleAccountEmail: settings.googleAccountEmail,
            googleCalendarId: settings.googleCalendarId,
            googleCalendarName: settings.googleCalendarName || 'Primary',
            accessToken: settings.accessToken,
            refreshToken: settings.refreshToken,
            tokenExpiresAt: new Date(settings.tokenExpiresAt),
            syncEnabled: settings.syncEnabled !== false,
            syncDirection: settings.syncDirection || 'one_way_to_google',
            syncFrequency: settings.syncFrequency || 'real_time',
            includeEventTypes: settings.includeEventTypes || ['medication_reminder'],
            includeMedicalDetails: settings.includeMedicalDetails !== false,
            includeProviderInfo: settings.includeProviderInfo || false,
            includeFamilyInfo: settings.includeFamilyInfo || false,
            customEventTitleTemplate: settings.customEventTitleTemplate,
            conflictResolution: settings.conflictResolution || 'app_wins'
        });
        if (!configResult.success) {
            return res.status(500).json(configResult);
        }
        res.json({
            success: true,
            message: 'Google Calendar sync configured successfully'
        });
    }
    catch (error) {
        console.error('❌ Error configuring Google Calendar sync:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-calendar-sync/google/sync
 * Sync medication events to Google Calendar
 */
router.post('/google/sync', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            const familyAccess = await req.app.locals.firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', userId)
                .where('patientId', '==', targetPatientId)
                .where('status', '==', 'active')
                .get();
            if (familyAccess.empty) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Perform Google Calendar sync
        const syncResult = await GoogleCalendarMedicationSync_1.googleCalendarMedicationSync.syncMedicationEventsToGoogle(targetPatientId, userId);
        res.json({
            success: syncResult.success,
            data: syncResult,
            message: `Synced ${syncResult.synced} events to Google Calendar`
        });
    }
    catch (error) {
        console.error('❌ Error syncing to Google Calendar:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-calendar-sync/google/import
 * Import events from Google Calendar to KinConnect
 */
router.post('/google/import', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            const familyAccess = await req.app.locals.firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', userId)
                .where('patientId', '==', targetPatientId)
                .where('status', '==', 'active')
                .get();
            if (familyAccess.empty) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Import from Google Calendar
        const importResult = await GoogleCalendarMedicationSync_1.googleCalendarMedicationSync.syncFromGoogleCalendar(targetPatientId, userId);
        res.json({
            success: importResult.success,
            data: importResult,
            message: `Imported ${importResult.imported} events from Google Calendar`
        });
    }
    catch (error) {
        console.error('❌ Error importing from Google Calendar:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /medication-calendar-sync/google/status
 * Get Google Calendar sync status
 */
router.get('/google/status', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId } = req.query;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            const familyAccess = await req.app.locals.firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', userId)
                .where('patientId', '==', targetPatientId)
                .where('status', '==', 'active')
                .get();
            if (familyAccess.empty) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Get sync status
        const statusResult = await GoogleCalendarMedicationSync_1.googleCalendarMedicationSync.getSyncStatusForPatient(userId, targetPatientId);
        if (!statusResult.success) {
            return res.status(404).json(statusResult);
        }
        res.json({
            success: true,
            data: statusResult.data,
            message: 'Google Calendar sync status retrieved successfully'
        });
    }
    catch (error) {
        console.error('❌ Error getting Google Calendar sync status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-calendar-sync/google/disable
 * Disable Google Calendar sync
 */
router.post('/google/disable', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId } = req.body;
        const targetPatientId = patientId || userId;
        // Only patient can disable their own sync
        if (targetPatientId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the patient can disable Google Calendar sync'
            });
        }
        // Disable sync
        const disableResult = await GoogleCalendarMedicationSync_1.googleCalendarMedicationSync.disableSync(userId, targetPatientId);
        if (!disableResult.success) {
            return res.status(500).json(disableResult);
        }
        res.json({
            success: true,
            message: 'Google Calendar sync disabled successfully'
        });
    }
    catch (error) {
        console.error('❌ Error disabling Google Calendar sync:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /medication-calendar-sync/batch-sync
 * Batch sync medication events for current patient
 */
router.post('/batch-sync', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { patientId } = req.body;
        const targetPatientId = patientId || userId;
        // Check access permissions
        if (targetPatientId !== userId) {
            const familyAccess = await req.app.locals.firestore.collection('family_calendar_access')
                .where('familyMemberId', '==', userId)
                .where('patientId', '==', targetPatientId)
                .where('status', '==', 'active')
                .get();
            if (familyAccess.empty) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
        }
        // Perform batch sync
        const syncResult = await MedicationCalendarSyncService_1.medicationCalendarSyncService.batchSyncPatientMedications(targetPatientId);
        res.json({
            success: syncResult.success,
            data: syncResult,
            message: `Batch sync completed: ${syncResult.synced} synced, ${syncResult.updated} updated`
        });
    }
    catch (error) {
        console.error('❌ Error in batch sync:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
