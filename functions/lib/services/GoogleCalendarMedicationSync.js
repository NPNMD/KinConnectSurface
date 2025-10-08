"use strict";
/**
 * GoogleCalendarMedicationSync
 *
 * Handles Google Calendar integration for medication reminders with privacy controls.
 *
 * Responsibilities:
 * - Sync medication reminders to Google Calendar
 * - Apply privacy filtering (exclude sensitive details)
 * - Handle bidirectional sync (Google → KinConnect)
 * - Manage sync conflicts and errors
 * - Support per-patient sync settings
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleCalendarMedicationSync = exports.GoogleCalendarMedicationSync = void 0;
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
class GoogleCalendarMedicationSync {
    _firestore = null;
    _medicalEventsCollection = null;
    _syncSettingsCollection = null;
    get firestore() {
        if (!this._firestore) {
            this._firestore = admin.firestore();
        }
        return this._firestore;
    }
    get medicalEventsCollection() {
        if (!this._medicalEventsCollection) {
            this._medicalEventsCollection = this.firestore.collection('medical_events');
        }
        return this._medicalEventsCollection;
    }
    get syncSettingsCollection() {
        if (!this._syncSettingsCollection) {
            this._syncSettingsCollection = this.firestore.collection('google_calendar_sync_settings');
        }
        return this._syncSettingsCollection;
    }
    /**
     * Sync medication events to Google Calendar
     */
    async syncMedicationEventsToGoogle(patientId, userId) {
        const result = {
            success: true,
            synced: 0,
            updated: 0,
            deleted: 0,
            errors: [],
            syncedEventIds: []
        };
        try {
            console.log('📅 GoogleCalendarSync: Starting medication sync for patient:', patientId);
            // Get sync settings for this user/patient
            const syncSettings = await this.getSyncSettings(userId, patientId);
            if (!syncSettings) {
                return {
                    success: false,
                    synced: 0,
                    updated: 0,
                    deleted: 0,
                    errors: ['Google Calendar sync not configured for this patient'],
                    syncedEventIds: []
                };
            }
            if (!syncSettings.syncEnabled) {
                return {
                    success: false,
                    synced: 0,
                    updated: 0,
                    deleted: 0,
                    errors: ['Google Calendar sync is disabled'],
                    syncedEventIds: []
                };
            }
            // Initialize Google Calendar API
            const calendar = await this.initializeGoogleCalendar(syncSettings);
            if (!calendar) {
                return {
                    success: false,
                    synced: 0,
                    updated: 0,
                    deleted: 0,
                    errors: ['Failed to initialize Google Calendar API'],
                    syncedEventIds: []
                };
            }
            // Get medication reminder events from medical_events
            const medicationEventsQuery = await this.medicalEventsCollection
                .where('patientId', '==', patientId)
                .where('eventType', '==', 'medication_reminder')
                .where('syncedFromMedicationCalendar', '==', true)
                .get();
            console.log(`📊 Found ${medicationEventsQuery.docs.length} medication events to sync`);
            // Process each medication event
            for (const eventDoc of medicationEventsQuery.docs) {
                try {
                    const event = eventDoc.data();
                    // Apply privacy filtering
                    const filteredEvent = this.applyPrivacyFiltering(event, syncSettings);
                    // Check if event should be synced based on settings
                    if (!this.shouldSyncEvent(event, syncSettings)) {
                        console.log('⏭️ Skipping event (filtered by settings):', event.title);
                        continue;
                    }
                    // Sync to Google Calendar
                    const syncResult = await this.syncEventToGoogle(calendar, syncSettings.googleCalendarId, eventDoc.id, filteredEvent, event.googleCalendarEventId);
                    if (syncResult.success) {
                        // Update medical event with Google Calendar event ID
                        await eventDoc.ref.update({
                            googleCalendarEventId: syncResult.googleEventId,
                            syncedToGoogleCalendar: true,
                            lastSyncedAt: admin.firestore.Timestamp.now()
                        });
                        if (syncResult.action === 'created') {
                            result.synced++;
                        }
                        else if (syncResult.action === 'updated') {
                            result.updated++;
                        }
                        result.syncedEventIds.push(syncResult.googleEventId);
                    }
                    else {
                        result.errors.push(`Event ${eventDoc.id}: ${syncResult.error}`);
                    }
                }
                catch (eventError) {
                    console.error('❌ Error syncing event:', eventDoc.id, eventError);
                    result.errors.push(`Event ${eventDoc.id}: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`);
                }
            }
            // Update sync settings with last sync time
            await this.updateSyncStatus(userId, patientId, {
                lastSyncAt: new Date(),
                lastSyncStatus: result.errors.length === 0 ? 'success' : 'partial',
                syncErrors: result.errors,
                totalEventsSynced: result.synced + result.updated
            });
            console.log('✅ Google Calendar medication sync completed:', result);
        }
        catch (error) {
            console.error('❌ GoogleCalendarSync: Fatal error:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
        return result;
    }
    /**
     * Apply privacy filtering to event data
     */
    applyPrivacyFiltering(event, syncSettings) {
        const filtered = {
            title: event.title,
            startDateTime: event.startDateTime,
            endDateTime: event.endDateTime,
            isAllDay: event.isAllDay
        };
        // Apply custom title template if configured
        if (syncSettings.customEventTitleTemplate) {
            filtered.title = syncSettings.customEventTitleTemplate;
        }
        else if (!syncSettings.includeMedicalDetails) {
            // Generic title for privacy
            filtered.title = 'Medication Reminder';
        }
        // Include description only if medical details are allowed
        if (syncSettings.includeMedicalDetails) {
            filtered.description = event.description || event.specialInstructions;
        }
        else {
            filtered.description = 'Take medication as prescribed';
        }
        // Include location only if provider info is allowed
        if (syncSettings.includeProviderInfo && event.location) {
            filtered.location = event.location;
        }
        return filtered;
    }
    /**
     * Check if event should be synced based on settings
     */
    shouldSyncEvent(event, syncSettings) {
        // Check if medication_reminder is in included event types
        if (syncSettings.includeEventTypes && Array.isArray(syncSettings.includeEventTypes)) {
            return syncSettings.includeEventTypes.includes('medication_reminder');
        }
        // Default to true if no specific filtering
        return true;
    }
    /**
     * Sync a single event to Google Calendar
     */
    async syncEventToGoogle(calendar, calendarId, eventId, eventData, existingGoogleEventId) {
        try {
            const startDateTime = eventData.startDateTime?.toDate?.() || new Date(eventData.startDateTime);
            const endDateTime = eventData.endDateTime?.toDate?.() || new Date(eventData.endDateTime);
            const googleEvent = {
                summary: eventData.title,
                description: eventData.description,
                location: eventData.location,
                start: {
                    dateTime: startDateTime.toISOString(),
                    timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                    timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 15 },
                        { method: 'popup', minutes: 5 }
                    ]
                },
                // Add metadata to identify KinConnect events
                extendedProperties: {
                    private: {
                        kinconnect_event_id: eventId,
                        kinconnect_event_type: 'medication_reminder',
                        kinconnect_sync_version: '1.0'
                    }
                }
            };
            if (existingGoogleEventId) {
                // Update existing event
                const response = await calendar.events.update({
                    calendarId,
                    eventId: existingGoogleEventId,
                    requestBody: googleEvent
                });
                return {
                    success: true,
                    googleEventId: response.data.id,
                    action: 'updated'
                };
            }
            else {
                // Create new event
                const response = await calendar.events.insert({
                    calendarId,
                    requestBody: googleEvent
                });
                return {
                    success: true,
                    googleEventId: response.data.id,
                    action: 'created'
                };
            }
        }
        catch (error) {
            console.error('❌ Error syncing to Google Calendar:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Initialize Google Calendar API client
     */
    async initializeGoogleCalendar(syncSettings) {
        try {
            const oauth2Client = new googleapis_1.google.auth.OAuth2();
            // Set credentials from sync settings
            oauth2Client.setCredentials({
                access_token: syncSettings.accessToken,
                refresh_token: syncSettings.refreshToken
            });
            // Check if token needs refresh
            const tokenExpiresAt = syncSettings.tokenExpiresAt?.toDate?.() || new Date(syncSettings.tokenExpiresAt);
            if (tokenExpiresAt < new Date()) {
                console.log('🔄 Refreshing Google Calendar access token...');
                const { credentials } = await oauth2Client.refreshAccessToken();
                // Update stored tokens
                await this.updateTokens(syncSettings.id, {
                    accessToken: credentials.access_token,
                    refreshToken: credentials.refresh_token || syncSettings.refreshToken,
                    tokenExpiresAt: new Date(credentials.expiry_date)
                });
                oauth2Client.setCredentials(credentials);
            }
            return googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
        }
        catch (error) {
            console.error('❌ Error initializing Google Calendar:', error);
            return null;
        }
    }
    /**
     * Get sync settings for user/patient
     */
    async getSyncSettings(userId, patientId) {
        try {
            const settingsId = `${userId}_${patientId}`;
            const settingsDoc = await this.syncSettingsCollection.doc(settingsId).get();
            if (!settingsDoc.exists) {
                return null;
            }
            return {
                id: settingsDoc.id,
                ...settingsDoc.data()
            };
        }
        catch (error) {
            console.error('❌ Error getting sync settings:', error);
            return null;
        }
    }
    /**
     * Update sync status
     */
    async updateSyncStatus(userId, patientId, status) {
        try {
            const settingsId = `${userId}_${patientId}`;
            await this.syncSettingsCollection.doc(settingsId).update({
                lastSyncAt: admin.firestore.Timestamp.fromDate(status.lastSyncAt),
                lastSyncStatus: status.lastSyncStatus,
                syncErrors: status.syncErrors,
                totalEventsSynced: admin.firestore.FieldValue.increment(status.totalEventsSynced),
                updatedAt: admin.firestore.Timestamp.now()
            });
        }
        catch (error) {
            console.error('❌ Error updating sync status:', error);
        }
    }
    /**
     * Update stored OAuth tokens
     */
    async updateTokens(settingsId, tokens) {
        try {
            await this.syncSettingsCollection.doc(settingsId).update({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                tokenExpiresAt: admin.firestore.Timestamp.fromDate(tokens.tokenExpiresAt),
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('✅ Updated Google Calendar tokens');
        }
        catch (error) {
            console.error('❌ Error updating tokens:', error);
        }
    }
    /**
     * Sync events from Google Calendar to KinConnect (bidirectional sync)
     */
    async syncFromGoogleCalendar(patientId, userId) {
        const result = {
            success: true,
            imported: 0,
            errors: []
        };
        try {
            console.log('📥 GoogleCalendarSync: Importing events from Google Calendar');
            // Get sync settings
            const syncSettings = await this.getSyncSettings(userId, patientId);
            if (!syncSettings || !syncSettings.syncEnabled) {
                return {
                    success: false,
                    imported: 0,
                    errors: ['Google Calendar sync not configured or disabled']
                };
            }
            // Check sync direction
            if (syncSettings.syncDirection === 'one_way_to_google') {
                return {
                    success: false,
                    imported: 0,
                    errors: ['Sync direction is one-way to Google only']
                };
            }
            // Initialize Google Calendar
            const calendar = await this.initializeGoogleCalendar(syncSettings);
            if (!calendar) {
                return {
                    success: false,
                    imported: 0,
                    errors: ['Failed to initialize Google Calendar API']
                };
            }
            // Get events from Google Calendar
            const now = new Date();
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            const response = await calendar.events.list({
                calendarId: syncSettings.googleCalendarId,
                timeMin: now.toISOString(),
                timeMax: futureDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });
            const googleEvents = response.data.items || [];
            console.log(`📊 Found ${googleEvents.length} events in Google Calendar`);
            // Filter for KinConnect medication events
            const kinconnectEvents = googleEvents.filter((event) => event.extendedProperties?.private?.kinconnect_event_type === 'medication_reminder');
            console.log(`📊 Found ${kinconnectEvents.length} KinConnect medication events`);
            // Process each event
            for (const googleEvent of kinconnectEvents) {
                try {
                    const kinconnectEventId = googleEvent.extendedProperties?.private?.kinconnect_event_id;
                    if (!kinconnectEventId) {
                        continue;
                    }
                    // Check if event exists in KinConnect
                    const medicalEventDoc = await this.medicalEventsCollection.doc(kinconnectEventId).get();
                    if (medicalEventDoc.exists) {
                        // Update if changed in Google Calendar
                        const existingEvent = medicalEventDoc.data();
                        const googleStartTime = new Date(googleEvent.start.dateTime || googleEvent.start.date);
                        const existingStartTime = existingEvent?.startDateTime?.toDate?.();
                        if (existingStartTime && googleStartTime.getTime() !== existingStartTime.getTime()) {
                            // Time changed in Google Calendar, update KinConnect
                            const duration = existingEvent?.duration || 5;
                            const newEndTime = new Date(googleStartTime.getTime() + duration * 60 * 1000);
                            await medicalEventDoc.ref.update({
                                startDateTime: admin.firestore.Timestamp.fromDate(googleStartTime),
                                endDateTime: admin.firestore.Timestamp.fromDate(newEndTime),
                                lastSyncedAt: admin.firestore.Timestamp.now(),
                                updatedAt: admin.firestore.Timestamp.now(),
                                syncedFromGoogle: true
                            });
                            result.imported++;
                            console.log('✅ Updated event from Google Calendar:', kinconnectEventId);
                        }
                    }
                }
                catch (eventError) {
                    console.error('❌ Error processing Google event:', eventError);
                    result.errors.push(`Google event: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`);
                }
            }
            console.log('✅ Google Calendar import completed:', result);
        }
        catch (error) {
            console.error('❌ GoogleCalendarSync: Fatal error in import:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
        return result;
    }
    /**
     * Delete medication event from Google Calendar
     */
    async deleteMedicationEventFromGoogle(medicalEventId, userId, patientId) {
        try {
            // Get the medical event
            const medicalEventDoc = await this.medicalEventsCollection.doc(medicalEventId).get();
            if (!medicalEventDoc.exists) {
                return { success: false, error: 'Medical event not found' };
            }
            const medicalEvent = medicalEventDoc.data();
            const googleEventId = medicalEvent?.googleCalendarEventId;
            if (!googleEventId) {
                return { success: true }; // Nothing to delete
            }
            // Get sync settings
            const syncSettings = await this.getSyncSettings(userId, patientId);
            if (!syncSettings || !syncSettings.syncEnabled) {
                return { success: true }; // Sync not enabled, nothing to do
            }
            // Initialize Google Calendar
            const calendar = await this.initializeGoogleCalendar(syncSettings);
            if (!calendar) {
                return { success: false, error: 'Failed to initialize Google Calendar' };
            }
            // Delete from Google Calendar
            await calendar.events.delete({
                calendarId: syncSettings.googleCalendarId,
                eventId: googleEventId
            });
            console.log('✅ Deleted medication event from Google Calendar:', googleEventId);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error deleting from Google Calendar:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Configure Google Calendar sync for a patient
     */
    async configureSyncSettings(userId, patientId, settings) {
        try {
            const settingsId = `${userId}_${patientId}`;
            const syncSettings = {
                userId,
                patientId,
                ...settings,
                tokenExpiresAt: admin.firestore.Timestamp.fromDate(settings.tokenExpiresAt),
                lastSyncStatus: 'success',
                totalEventsSynced: 0,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            await this.syncSettingsCollection.doc(settingsId).set(syncSettings, { merge: true });
            console.log('✅ Configured Google Calendar sync settings:', settingsId);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error configuring sync settings:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Disable Google Calendar sync
     */
    async disableSync(userId, patientId) {
        try {
            const settingsId = `${userId}_${patientId}`;
            await this.syncSettingsCollection.doc(settingsId).update({
                syncEnabled: false,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('✅ Disabled Google Calendar sync:', settingsId);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error disabling sync:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get sync status for a patient
     */
    async getSyncStatusForPatient(userId, patientId) {
        try {
            const syncSettings = await this.getSyncSettings(userId, patientId);
            if (!syncSettings) {
                return {
                    success: false,
                    error: 'Google Calendar sync not configured'
                };
            }
            return {
                success: true,
                data: {
                    syncEnabled: syncSettings.syncEnabled,
                    lastSyncAt: syncSettings.lastSyncAt?.toDate?.(),
                    lastSyncStatus: syncSettings.lastSyncStatus || 'success',
                    totalEventsSynced: syncSettings.totalEventsSynced || 0,
                    syncErrors: syncSettings.syncErrors || [],
                    syncDirection: syncSettings.syncDirection || 'one_way_to_google'
                }
            };
        }
        catch (error) {
            console.error('❌ Error getting sync status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
exports.GoogleCalendarMedicationSync = GoogleCalendarMedicationSync;
// Export singleton instance
exports.googleCalendarMedicationSync = new GoogleCalendarMedicationSync();
