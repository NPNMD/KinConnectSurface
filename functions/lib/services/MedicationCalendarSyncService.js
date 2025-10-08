"use strict";
/**
 * MedicationCalendarSyncService
 *
 * Syncs medication events from medication_calendar_events to medical_events collection
 * for unified calendar view integration.
 *
 * Responsibilities:
 * - Create medication_reminder events in medical_events collection
 * - Maintain bidirectional sync between collections
 * - Handle event updates and deletions
 * - Prevent duplicate events
 * - Support family access permissions
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
exports.medicationCalendarSyncService = exports.MedicationCalendarSyncService = void 0;
const admin = __importStar(require("firebase-admin"));
class MedicationCalendarSyncService {
    _firestore = null;
    _medicationEventsCollection = null;
    _medicalEventsCollection = null;
    get firestore() {
        if (!this._firestore) {
            this._firestore = admin.firestore();
        }
        return this._firestore;
    }
    get medicationEventsCollection() {
        if (!this._medicationEventsCollection) {
            this._medicationEventsCollection = this.firestore.collection('medication_calendar_events');
        }
        return this._medicationEventsCollection;
    }
    get medicalEventsCollection() {
        if (!this._medicalEventsCollection) {
            this._medicalEventsCollection = this.firestore.collection('medical_events');
        }
        return this._medicalEventsCollection;
    }
    /**
     * Sync medication events to medical_events collection
     */
    async syncMedicationEvents(options) {
        const result = {
            success: true,
            synced: 0,
            updated: 0,
            deleted: 0,
            skipped: 0,
            errors: []
        };
        try {
            console.log('📅 MedicationCalendarSync: Starting sync for patient:', options.patientId);
            // Build query for medication events
            let query = this.medicationEventsCollection
                .where('patientId', '==', options.patientId);
            if (options.startDate) {
                query = query.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(options.startDate));
            }
            if (options.endDate) {
                query = query.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(options.endDate));
            }
            if (options.medicationId) {
                query = query.where('medicationId', '==', options.medicationId);
            }
            const medicationEventsSnapshot = await query.get();
            console.log(`📊 Found ${medicationEventsSnapshot.docs.length} medication events to sync`);
            // Process each medication event
            for (const medEventDoc of medicationEventsSnapshot.docs) {
                try {
                    const medEvent = medEventDoc.data();
                    const syncResult = await this.syncSingleEvent(medEventDoc.id, medEvent, options.forceResync);
                    if (syncResult === 'synced') {
                        result.synced++;
                    }
                    else if (syncResult === 'updated') {
                        result.updated++;
                    }
                    else if (syncResult === 'skipped') {
                        result.skipped++;
                    }
                }
                catch (eventError) {
                    console.error('❌ Error syncing event:', medEventDoc.id, eventError);
                    result.errors.push(`Event ${medEventDoc.id}: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`);
                }
            }
            // Clean up orphaned medical events (medication events that were deleted)
            const cleanupResult = await this.cleanupOrphanedEvents(options.patientId);
            result.deleted = cleanupResult.deleted;
            console.log('✅ Medication calendar sync completed:', result);
        }
        catch (error) {
            console.error('❌ MedicationCalendarSync: Fatal error:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
        return result;
    }
    /**
     * Sync a single medication event to medical_events
     */
    async syncSingleEvent(medicationEventId, medicationEvent, forceResync = false) {
        try {
            // Generate deterministic medical event ID based on medication event ID
            const medicalEventId = `med_${medicationEventId}`;
            // Check if medical event already exists
            const existingMedicalEvent = await this.medicalEventsCollection.doc(medicalEventId).get();
            if (existingMedicalEvent.exists && !forceResync) {
                // Check if update is needed
                const existingData = existingMedicalEvent.data();
                const needsUpdate = this.needsUpdate(existingData, medicationEvent);
                if (!needsUpdate) {
                    return 'skipped';
                }
                // Update existing event
                await this.updateMedicalEvent(medicalEventId, medicationEvent);
                return 'updated';
            }
            // Create new medical event
            await this.createMedicalEvent(medicalEventId, medicationEvent);
            return 'synced';
        }
        catch (error) {
            console.error('❌ Error syncing single event:', error);
            throw error;
        }
    }
    /**
     * Create a medical event from medication event
     */
    async createMedicalEvent(medicalEventId, medicationEvent) {
        const scheduledDateTime = medicationEvent.scheduledDateTime?.toDate?.() || new Date(medicationEvent.scheduledDateTime);
        const duration = 5; // 5 minutes for medication reminder
        const endDateTime = new Date(scheduledDateTime.getTime() + duration * 60 * 1000);
        const medicalEvent = {
            // Link to medication event
            medicationEventId: medicationEvent.id || medicalEventId.replace('med_', ''),
            medicationId: medicationEvent.medicationId,
            medicationScheduleId: medicationEvent.medicationScheduleId,
            // Basic event information
            patientId: medicationEvent.patientId,
            title: `${medicationEvent.medicationName} - ${medicationEvent.dosageAmount}`,
            description: medicationEvent.instructions || `Take ${medicationEvent.dosageAmount}`,
            eventType: 'medication_reminder',
            priority: this.determinePriority(medicationEvent),
            status: this.mapMedicationStatusToEventStatus(medicationEvent.status),
            // Date and time
            startDateTime: admin.firestore.Timestamp.fromDate(scheduledDateTime),
            endDateTime: admin.firestore.Timestamp.fromDate(endDateTime),
            duration,
            isAllDay: false,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            // Medication-specific data
            medications: [medicationEvent.medicationName],
            specialInstructions: medicationEvent.instructions || undefined,
            // Family responsibility (not applicable for medication reminders)
            requiresTransportation: false,
            responsibilityStatus: 'unassigned',
            // Recurring information
            isRecurring: medicationEvent.isRecurring || false,
            // Reminders
            reminders: (medicationEvent.reminderMinutesBefore || [15, 5]).map((minutes, index) => ({
                id: `reminder_${index}`,
                type: 'push',
                minutesBefore: minutes,
                isActive: true
            })),
            // Sync metadata
            syncedFromMedicationCalendar: true,
            lastSyncedAt: admin.firestore.Timestamp.now(),
            // Audit trail
            createdBy: medicationEvent.patientId,
            createdAt: medicationEvent.createdAt || admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            version: 1
        };
        await this.medicalEventsCollection.doc(medicalEventId).set(medicalEvent);
        console.log('✅ Created medical event:', medicalEventId, 'for medication:', medicationEvent.medicationName);
    }
    /**
     * Update an existing medical event from medication event
     */
    async updateMedicalEvent(medicalEventId, medicationEvent) {
        const scheduledDateTime = medicationEvent.scheduledDateTime?.toDate?.() || new Date(medicationEvent.scheduledDateTime);
        const duration = 5;
        const endDateTime = new Date(scheduledDateTime.getTime() + duration * 60 * 1000);
        const updates = {
            title: `${medicationEvent.medicationName} - ${medicationEvent.dosageAmount}`,
            description: medicationEvent.instructions || `Take ${medicationEvent.dosageAmount}`,
            status: this.mapMedicationStatusToEventStatus(medicationEvent.status),
            priority: this.determinePriority(medicationEvent),
            startDateTime: admin.firestore.Timestamp.fromDate(scheduledDateTime),
            endDateTime: admin.firestore.Timestamp.fromDate(endDateTime),
            specialInstructions: medicationEvent.instructions || undefined,
            lastSyncedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            version: admin.firestore.FieldValue.increment(1)
        };
        await this.medicalEventsCollection.doc(medicalEventId).update(updates);
        console.log('✅ Updated medical event:', medicalEventId);
    }
    /**
     * Check if medical event needs update
     */
    needsUpdate(existingEvent, medicationEvent) {
        const existingScheduledTime = existingEvent.startDateTime?.toDate?.()?.getTime();
        const newScheduledTime = medicationEvent.scheduledDateTime?.toDate?.()?.getTime() ||
            new Date(medicationEvent.scheduledDateTime).getTime();
        // Update if time changed or status changed
        return existingScheduledTime !== newScheduledTime ||
            existingEvent.status !== this.mapMedicationStatusToEventStatus(medicationEvent.status);
    }
    /**
     * Map medication event status to medical event status
     */
    mapMedicationStatusToEventStatus(medicationStatus) {
        const statusMap = {
            'scheduled': 'scheduled',
            'taken': 'completed',
            'missed': 'cancelled',
            'skipped': 'cancelled',
            'late': 'completed',
            'snoozed': 'scheduled'
        };
        return statusMap[medicationStatus] || 'scheduled';
    }
    /**
     * Determine priority based on medication event
     */
    determinePriority(medicationEvent) {
        // Critical medications get high priority
        if (medicationEvent.isCritical || medicationEvent.status === 'overdue') {
            return 'high';
        }
        // Missed medications get urgent priority
        if (medicationEvent.status === 'missed') {
            return 'urgent';
        }
        // Default to medium priority
        return 'medium';
    }
    /**
     * Clean up orphaned medical events (medication events that were deleted)
     */
    async cleanupOrphanedEvents(patientId) {
        let deleted = 0;
        try {
            // Get all medical events that are synced from medication calendar
            const medicalEventsQuery = await this.medicalEventsCollection
                .where('patientId', '==', patientId)
                .where('syncedFromMedicationCalendar', '==', true)
                .get();
            console.log(`🔍 Checking ${medicalEventsQuery.docs.length} synced medical events for orphans`);
            const batch = this.firestore.batch();
            let batchCount = 0;
            for (const medicalEventDoc of medicalEventsQuery.docs) {
                const medicalEvent = medicalEventDoc.data();
                const medicationEventId = medicalEvent.medicationEventId;
                if (!medicationEventId) {
                    continue;
                }
                // Check if corresponding medication event still exists
                const medicationEventDoc = await this.medicationEventsCollection.doc(medicationEventId).get();
                if (!medicationEventDoc.exists) {
                    // Medication event was deleted, remove medical event
                    batch.delete(medicalEventDoc.ref);
                    batchCount++;
                    deleted++;
                    // Commit batch every 500 operations
                    if (batchCount >= 500) {
                        await batch.commit();
                        batchCount = 0;
                    }
                }
            }
            // Commit remaining operations
            if (batchCount > 0) {
                await batch.commit();
            }
            if (deleted > 0) {
                console.log(`🗑️ Cleaned up ${deleted} orphaned medical events`);
            }
        }
        catch (error) {
            console.error('❌ Error cleaning up orphaned events:', error);
        }
        return { deleted };
    }
    /**
     * Sync a single medication event immediately (for real-time updates)
     */
    async syncSingleMedicationEvent(medicationEventId) {
        try {
            const medicationEventDoc = await this.medicationEventsCollection.doc(medicationEventId).get();
            if (!medicationEventDoc.exists) {
                return {
                    success: false,
                    error: 'Medication event not found'
                };
            }
            const medicationEvent = medicationEventDoc.data();
            await this.syncSingleEvent(medicationEventId, medicationEvent, true);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error syncing single medication event:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Delete medical event when medication event is deleted
     */
    async deleteSyncedMedicalEvent(medicationEventId) {
        try {
            const medicalEventId = `med_${medicationEventId}`;
            const medicalEventDoc = await this.medicalEventsCollection.doc(medicalEventId).get();
            if (medicalEventDoc.exists) {
                await medicalEventDoc.ref.delete();
                console.log('✅ Deleted synced medical event:', medicalEventId);
            }
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error deleting synced medical event:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get sync status for a patient
     */
    async getSyncStatus(patientId) {
        try {
            // Count total medication events
            const medicationEventsQuery = await this.medicationEventsCollection
                .where('patientId', '==', patientId)
                .get();
            const totalMedicationEvents = medicationEventsQuery.docs.length;
            // Count synced medical events
            const syncedEventsQuery = await this.medicalEventsCollection
                .where('patientId', '==', patientId)
                .where('syncedFromMedicationCalendar', '==', true)
                .get();
            const syncedToCalendar = syncedEventsQuery.docs.length;
            const pendingSync = totalMedicationEvents - syncedToCalendar;
            // Get last sync time
            let lastSyncAt;
            if (syncedEventsQuery.docs.length > 0) {
                const lastSyncedEvent = syncedEventsQuery.docs
                    .map(doc => doc.data())
                    .sort((a, b) => {
                    const aTime = a.lastSyncedAt?.toDate?.()?.getTime() || 0;
                    const bTime = b.lastSyncedAt?.toDate?.()?.getTime() || 0;
                    return bTime - aTime;
                })[0];
                lastSyncAt = lastSyncedEvent.lastSyncedAt?.toDate?.();
            }
            return {
                success: true,
                data: {
                    totalMedicationEvents,
                    syncedToCalendar,
                    pendingSync,
                    lastSyncAt
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
    /**
     * Batch sync all medication events for a patient
     */
    async batchSyncPatientMedications(patientId) {
        // Set date range for next 30 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // Include past week
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // Include next 30 days
        return this.syncMedicationEvents({
            patientId,
            startDate,
            endDate,
            forceResync: false
        });
    }
    /**
     * Handle medication event status change (real-time sync)
     */
    async handleMedicationEventStatusChange(medicationEventId, newStatus) {
        try {
            const medicalEventId = `med_${medicationEventId}`;
            const medicalEventDoc = await this.medicalEventsCollection.doc(medicalEventId).get();
            if (!medicalEventDoc.exists) {
                // Event not synced yet, sync it now
                return this.syncSingleMedicationEvent(medicationEventId);
            }
            // Update status
            const mappedStatus = this.mapMedicationStatusToEventStatus(newStatus);
            await medicalEventDoc.ref.update({
                status: mappedStatus,
                lastSyncedAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
                version: admin.firestore.FieldValue.increment(1)
            });
            console.log('✅ Updated medical event status:', medicalEventId, 'to', mappedStatus);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error handling status change:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Sync medication events for multiple patients (batch operation)
     */
    async batchSyncMultiplePatients(patientIds) {
        const results = {};
        let totalSynced = 0;
        let totalErrors = 0;
        for (const patientId of patientIds) {
            try {
                const syncResult = await this.batchSyncPatientMedications(patientId);
                results[patientId] = syncResult;
                totalSynced += syncResult.synced + syncResult.updated;
                totalErrors += syncResult.errors.length;
            }
            catch (error) {
                console.error('❌ Error syncing patient:', patientId, error);
                results[patientId] = {
                    success: false,
                    synced: 0,
                    updated: 0,
                    deleted: 0,
                    skipped: 0,
                    errors: [error instanceof Error ? error.message : 'Unknown error']
                };
                totalErrors++;
            }
        }
        return {
            success: totalErrors === 0,
            results,
            totalSynced,
            totalErrors
        };
    }
}
exports.MedicationCalendarSyncService = MedicationCalendarSyncService;
// Export singleton instance
exports.medicationCalendarSyncService = new MedicationCalendarSyncService();
