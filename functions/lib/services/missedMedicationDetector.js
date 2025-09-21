"use strict";
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
exports.MissedMedicationDetector = void 0;
const admin = __importStar(require("firebase-admin"));
const gracePeriodEngine_1 = require("./gracePeriodEngine");
const medicationMonitoringService_1 = require("./medicationMonitoringService");
class MissedMedicationDetector {
    firestore = admin.firestore();
    gracePeriodEngine = new gracePeriodEngine_1.GracePeriodEngine();
    monitoringService = new medicationMonitoringService_1.MedicationMonitoringService();
    /**
     * Main method to detect missed medications across all patients
     */
    async detectMissedMedications() {
        const startTime = Date.now();
        const now = new Date();
        const results = {
            processed: 0,
            missed: 0,
            errors: [],
            detectionTime: now,
            batchResults: []
        };
        try {
            console.log('🔍 Starting missed medication detection sweep...');
            // Query for scheduled events that might be overdue
            // Look back 24 hours to catch any that might have been missed
            const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            const queryStartTime = Date.now();
            const overdueQuery = await this.firestore.collection('medication_calendar_events')
                .where('status', '==', 'scheduled')
                .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
                .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
                .limit(500) // Process in batches to avoid timeouts
                .get();
            const queryTime = Date.now() - queryStartTime;
            console.log(`🔍 Found ${overdueQuery.docs.length} potentially overdue events (query took ${queryTime}ms)`);
            // Process events in batches
            const batchSize = 50;
            const batches = [];
            for (let i = 0; i < overdueQuery.docs.length; i += batchSize) {
                batches.push(overdueQuery.docs.slice(i, i + batchSize));
            }
            const updateStartTime = Date.now();
            for (const batch of batches) {
                await this.processBatch(batch, now, results);
            }
            const updateTime = Date.now() - updateStartTime;
            const totalExecutionTime = Date.now() - startTime;
            console.log(`✅ Missed medication detection completed:`, {
                processed: results.processed,
                missed: results.missed,
                errors: results.errors.length,
                duration: `${totalExecutionTime}ms`,
                queryTime: `${queryTime}ms`,
                updateTime: `${updateTime}ms`
            });
            // Log monitoring metrics
            const metrics = {
                timestamp: now,
                functionName: 'detectMissedMedications',
                executionTime: totalExecutionTime,
                eventsProcessed: results.processed,
                eventsMarkedMissed: results.missed,
                errorCount: results.errors.length,
                errors: results.errors,
                performanceMetrics: {
                    averageProcessingTimePerEvent: results.processed > 0 ? totalExecutionTime / results.processed : 0,
                    batchSize,
                    totalBatches: batches.length,
                    queryTime,
                    updateTime
                }
            };
            await this.monitoringService.logDetectionMetrics(metrics);
            // Create alerts for concerning patterns
            if (results.errors.length > 0) {
                await this.monitoringService.createSystemAlert('error', results.errors.length > results.processed * 0.1 ? 'critical' : 'warning', `Missed medication detection encountered ${results.errors.length} errors`, { errors: results.errors.slice(0, 5) } // First 5 errors
                );
            }
            if (totalExecutionTime > 300000) { // >5 minutes
                await this.monitoringService.createSystemAlert('performance', 'warning', `Missed medication detection took ${Math.round(totalExecutionTime / 1000)}s to complete`, { executionTime: totalExecutionTime, eventsProcessed: results.processed });
            }
            return results;
        }
        catch (error) {
            console.error('❌ Error in missed medication detection:', error);
            results.errors.push(error instanceof Error ? error.message : 'Unknown error');
            // Log critical system error
            await this.monitoringService.createSystemAlert('error', 'critical', 'Missed medication detection failed completely', { error: error instanceof Error ? error.message : 'Unknown error' });
            return results;
        }
    }
    /**
     * Detect missed medications for a specific patient (for manual triggers)
     */
    async detectMissedMedicationsForPatient(patientId) {
        const now = new Date();
        const results = {
            processed: 0,
            missed: 0,
            errors: [],
            detectionTime: now,
            batchResults: []
        };
        try {
            console.log('🔍 Starting missed medication detection for patient:', patientId);
            // Look back 24 hours for this specific patient
            const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            const overdueQuery = await this.firestore.collection('medication_calendar_events')
                .where('patientId', '==', patientId)
                .where('status', '==', 'scheduled')
                .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
                .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
                .get();
            console.log(`🔍 Found ${overdueQuery.docs.length} potentially overdue events for patient ${patientId}`);
            if (overdueQuery.docs.length > 0) {
                await this.processBatch(overdueQuery.docs, now, results);
            }
            return results;
        }
        catch (error) {
            console.error('❌ Error in patient-specific missed medication detection:', error);
            results.errors.push(error instanceof Error ? error.message : 'Unknown error');
            return results;
        }
    }
    /**
     * Process a batch of potentially overdue events
     */
    async processBatch(docs, currentTime, results) {
        const batch = this.firestore.batch();
        const notificationQueue = [];
        for (const doc of docs) {
            try {
                const event = doc.data();
                results.processed++;
                // Calculate grace period for this specific event
                const gracePeriodCalc = await this.gracePeriodEngine.calculateGracePeriod(event, event.patientId, currentTime);
                // Check if grace period has expired
                if (currentTime > gracePeriodCalc.gracePeriodEnd) {
                    // Mark as missed
                    batch.update(doc.ref, {
                        status: 'missed',
                        missedAt: admin.firestore.Timestamp.now(),
                        missedReason: 'automatic_detection',
                        gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
                        gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodCalc.gracePeriodEnd),
                        gracePeriodRules: gracePeriodCalc.appliedRules,
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                    results.missed++;
                    // Add to batch results for reporting
                    results.batchResults?.push({
                        eventId: doc.id,
                        medicationName: event.medicationName || 'Unknown',
                        patientId: event.patientId,
                        gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
                        gracePeriodEnd: gracePeriodCalc.gracePeriodEnd,
                        appliedRules: gracePeriodCalc.appliedRules
                    });
                    // Queue for notification processing
                    notificationQueue.push({
                        eventId: doc.id,
                        event,
                        gracePeriodCalc
                    });
                    console.log(`📋 Marked as missed: ${event.medicationName} for patient ${event.patientId}`);
                }
                else {
                    // Update with grace period info for future reference
                    batch.update(doc.ref, {
                        gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
                        gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodCalc.gracePeriodEnd),
                        gracePeriodRules: gracePeriodCalc.appliedRules,
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
            }
            catch (error) {
                console.error(`❌ Error processing event ${doc.id}:`, error);
                results.errors.push(`Event ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        // Commit batch updates
        let hasWrites = false;
        try {
            // Check if batch has any writes by attempting to commit
            // If there are no writes, commit will succeed but do nothing
            await batch.commit();
            hasWrites = true;
            console.log(`✅ Committed batch update for processed events`);
        }
        catch (error) {
            // If batch is empty, this might throw an error, but that's okay
            if (error instanceof Error && error.message.includes('empty')) {
                console.log('ℹ️ No batch updates to commit');
            }
            else {
                console.error('❌ Error committing batch:', error);
                throw error;
            }
        }
        // Process notifications
        if (notificationQueue.length > 0) {
            await this.queueMissedMedicationNotifications(notificationQueue);
        }
    }
    /**
     * Queue notifications for missed medications
     */
    async queueMissedMedicationNotifications(missedEvents) {
        try {
            // Group by patient for efficient notification processing
            const patientGroups = new Map();
            for (const missedEvent of missedEvents) {
                const patientId = missedEvent.event.patientId;
                if (!patientGroups.has(patientId)) {
                    patientGroups.set(patientId, []);
                }
                patientGroups.get(patientId).push(missedEvent);
            }
            // Process notifications for each patient
            for (const [patientId, events] of patientGroups) {
                await this.processPatientMissedNotifications(patientId, events);
            }
        }
        catch (error) {
            console.error('❌ Error queueing missed medication notifications:', error);
        }
    }
    /**
     * Process missed medication notifications for a specific patient
     */
    async processPatientMissedNotifications(patientId, missedEvents) {
        try {
            // Get family notification rules
            const notificationRules = await this.getFamilyNotificationRules(patientId);
            for (const rule of notificationRules) {
                // Check if this rule should trigger for these missed events
                const shouldNotify = await this.shouldTriggerNotification(rule, missedEvents);
                if (shouldNotify) {
                    await this.sendMissedMedicationNotification(rule, missedEvents);
                }
            }
        }
        catch (error) {
            console.error(`❌ Error processing notifications for patient ${patientId}:`, error);
        }
    }
    /**
     * Get family notification rules for a patient
     */
    async getFamilyNotificationRules(patientId) {
        try {
            const rulesQuery = await this.firestore.collection('family_notification_rules')
                .where('patientId', '==', patientId)
                .where('isActive', '==', true)
                .get();
            return rulesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        catch (error) {
            console.warn('Error getting family notification rules:', error);
            return [];
        }
    }
    /**
     * Check if notification should be triggered based on rules
     */
    async shouldTriggerNotification(rule, missedEvents) {
        try {
            // Check immediate notification setting
            if (rule.triggers?.missedMedication?.immediateNotification) {
                return true;
            }
            // Check consecutive missed threshold
            if (rule.triggers?.missedMedication?.consecutiveThreshold > 1) {
                // Check for consecutive misses for each medication
                for (const missedEvent of missedEvents) {
                    const consecutiveMisses = await this.getConsecutiveMissedCount(missedEvent.event.medicationId, missedEvent.event.patientId);
                    if (consecutiveMisses >= rule.triggers.missedMedication.consecutiveThreshold) {
                        return true;
                    }
                }
            }
            // Check critical medications only setting
            if (rule.triggers?.missedMedication?.criticalMedicationsOnly) {
                const hasCriticalMissed = await Promise.all(missedEvents.map(async (missedEvent) => {
                    const medicationType = await this.gracePeriodEngine.getMedicationType(missedEvent.event.medicationId);
                    return medicationType === 'critical';
                }));
                return hasCriticalMissed.some(isCritical => isCritical);
            }
            return false;
        }
        catch (error) {
            console.warn('Error checking notification trigger:', error);
            return false;
        }
    }
    /**
     * Get consecutive missed count for a medication
     */
    async getConsecutiveMissedCount(medicationId, patientId) {
        try {
            // Get recent events for this medication, ordered by scheduled time descending
            const recentEvents = await this.firestore.collection('medication_calendar_events')
                .where('medicationId', '==', medicationId)
                .where('patientId', '==', patientId)
                .orderBy('scheduledDateTime', 'desc')
                .limit(10)
                .get();
            let consecutiveCount = 0;
            for (const doc of recentEvents.docs) {
                const event = doc.data();
                if (event.status === 'missed') {
                    consecutiveCount++;
                }
                else if (event.status === 'taken' || event.status === 'skipped') {
                    // Break the consecutive streak
                    break;
                }
                // Continue counting for 'scheduled' events (they might become missed)
            }
            return consecutiveCount;
        }
        catch (error) {
            console.warn('Error getting consecutive missed count:', error);
            return 0;
        }
    }
    /**
     * Send missed medication notification
     */
    async sendMissedMedicationNotification(rule, missedEvents) {
        try {
            // Create notification record
            const notification = {
                patientId: rule.patientId,
                familyMemberId: rule.familyMemberId,
                notificationType: 'missed_medication',
                missedEvents: missedEvents.map(me => ({
                    eventId: me.eventId,
                    medicationName: me.event.medicationName,
                    scheduledDateTime: me.event.scheduledDateTime,
                    gracePeriodEnd: me.gracePeriodCalc.gracePeriodEnd
                })),
                severity: this.calculateNotificationSeverity(missedEvents),
                status: 'pending',
                scheduledFor: admin.firestore.Timestamp.now(),
                method: rule.preferences?.methods?.[0] || 'email',
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            await this.firestore.collection('family_notification_queue').add(notification);
            console.log(`📨 Queued missed medication notification for patient ${rule.patientId}`);
        }
        catch (error) {
            console.error('❌ Error sending missed medication notification:', error);
        }
    }
    /**
     * Calculate notification severity based on missed events
     */
    calculateNotificationSeverity(missedEvents) {
        // Check if any critical medications were missed
        const hasCriticalMeds = missedEvents.some(me => me.gracePeriodCalc?.appliedRules?.includes('type_critical'));
        if (hasCriticalMeds) {
            return 'critical';
        }
        // Check if multiple medications were missed
        if (missedEvents.length >= 3) {
            return 'warning';
        }
        return 'info';
    }
    /**
     * Mark a medication event as missed manually
     */
    async markEventAsMissed(eventId, userId, reason = 'manual_mark') {
        try {
            const eventDoc = await this.firestore.collection('medication_calendar_events').doc(eventId).get();
            if (!eventDoc.exists) {
                return { success: false, error: 'Event not found' };
            }
            const eventData = eventDoc.data();
            // Verify access permissions
            if (eventData?.patientId !== userId) {
                // Check family access
                const familyAccess = await this.firestore.collection('family_calendar_access')
                    .where('familyMemberId', '==', userId)
                    .where('patientId', '==', eventData?.patientId)
                    .where('status', '==', 'active')
                    .get();
                if (familyAccess.empty) {
                    return { success: false, error: 'Access denied' };
                }
            }
            // Calculate grace period for audit trail
            const gracePeriodCalc = await this.gracePeriodEngine.calculateGracePeriod(eventData, eventData?.patientId, new Date());
            // Update event status
            await eventDoc.ref.update({
                status: 'missed',
                missedAt: admin.firestore.Timestamp.now(),
                missedReason: reason,
                gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
                gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodCalc.gracePeriodEnd),
                gracePeriodRules: gracePeriodCalc.appliedRules,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log(`✅ Manually marked event as missed: ${eventId}`);
            return { success: true };
        }
        catch (error) {
            console.error('❌ Error marking event as missed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get missed medications for a patient within a date range
     */
    async getMissedMedications(patientId, startDate, endDate, limit = 50) {
        try {
            let query = this.firestore.collection('medication_calendar_events')
                .where('patientId', '==', patientId)
                .where('status', '==', 'missed');
            // Add date filters if provided
            if (startDate) {
                query = query.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startDate));
            }
            if (endDate) {
                query = query.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endDate));
            }
            const missedSnapshot = await query
                .orderBy('scheduledDateTime', 'desc')
                .limit(limit)
                .get();
            return missedSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    scheduledDateTime: data.scheduledDateTime?.toDate(),
                    missedAt: data.missedAt?.toDate(),
                    gracePeriodEnd: data.gracePeriodEnd?.toDate(),
                    createdAt: data.createdAt?.toDate(),
                    updatedAt: data.updatedAt?.toDate()
                };
            });
        }
        catch (error) {
            console.error('❌ Error getting missed medications:', error);
            return [];
        }
    }
    /**
     * Get missed medication statistics for a patient
     */
    async getMissedMedicationStats(patientId, days = 30) {
        try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
            const missedEvents = await this.getMissedMedications(patientId, startDate, endDate, 1000);
            // Calculate statistics
            const medicationCounts = new Map();
            const timeSlotCounts = { morning: 0, noon: 0, evening: 0, bedtime: 0 };
            const reasonCounts = new Map();
            let totalGracePeriod = 0;
            let gracePeriodCount = 0;
            for (const event of missedEvents) {
                // Count by medication
                const medKey = event.medicationId;
                if (medicationCounts.has(medKey)) {
                    medicationCounts.get(medKey).count++;
                }
                else {
                    medicationCounts.set(medKey, { name: event.medicationName, count: 1 });
                }
                // Count by time slot (simplified classification)
                const hour = event.scheduledDateTime.getHours();
                if (hour >= 6 && hour < 11)
                    timeSlotCounts.morning++;
                else if (hour >= 11 && hour < 17)
                    timeSlotCounts.noon++;
                else if (hour >= 17 && hour < 21)
                    timeSlotCounts.evening++;
                else
                    timeSlotCounts.bedtime++;
                // Count reasons
                const reason = event.missedReason || 'automatic_detection';
                reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
                // Calculate average grace period
                if (event.gracePeriodMinutes) {
                    totalGracePeriod += event.gracePeriodMinutes;
                    gracePeriodCount++;
                }
            }
            return {
                totalMissed: missedEvents.length,
                missedByMedication: Array.from(medicationCounts.entries()).map(([id, data]) => ({
                    medicationId: id,
                    medicationName: data.name,
                    count: data.count
                })),
                missedByTimeSlot: timeSlotCounts,
                averageGracePeriod: gracePeriodCount > 0 ? Math.round(totalGracePeriod / gracePeriodCount) : 0,
                mostCommonReasons: Array.from(reasonCounts.entries())
                    .map(([reason, count]) => ({ reason, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
            };
        }
        catch (error) {
            console.error('❌ Error calculating missed medication stats:', error);
            return {
                totalMissed: 0,
                missedByMedication: [],
                missedByTimeSlot: { morning: 0, noon: 0, evening: 0, bedtime: 0 },
                averageGracePeriod: 0,
                mostCommonReasons: []
            };
        }
    }
}
exports.MissedMedicationDetector = MissedMedicationDetector;
