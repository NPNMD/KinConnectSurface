"use strict";
/**
 * Scheduled Medication Reminders Cloud Function
 *
 * Runs every 5 minutes to send medication reminders before scheduled times.
 *
 * This function:
 * 1. Queries for upcoming medication events (within reminder window)
 * 2. Checks if reminders have already been sent
 * 3. Sends notifications via MedicationNotificationService
 * 4. Tracks delivery status
 * 5. Respects notification preferences and quiet hours
 *
 * Integration with Unified System:
 * - Uses medication_commands collection for medication data
 * - Uses medication_events collection for scheduled events
 * - Leverages MedicationNotificationService for delivery
 * - Tracks delivery in medication_notification_delivery_log
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
exports.scheduledMedicationReminders = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const MedicationNotificationService_1 = require("./services/unified/MedicationNotificationService");
const MedicationEventService_1 = require("./services/unified/MedicationEventService");
const unifiedMedicationSchema_1 = require("./schemas/unifiedMedicationSchema");
/**
 * Scheduled function that runs every 5 minutes to send medication reminders
 */
exports.scheduledMedicationReminders = functions
    .runWith({
    memory: '512MB',
    timeoutSeconds: 300, // 5 minutes
})
    .pubsub.schedule('every 5 minutes')
    .timeZone('UTC') // Run in UTC, handle patient timezones internally
    .onRun(async (context) => {
    const startTime = Date.now();
    const executionTime = new Date();
    console.log('🔔 ===== SCHEDULED MEDICATION REMINDERS START =====');
    console.log(`⏰ Execution time (UTC): ${executionTime.toISOString()}`);
    console.log(`📅 Execution context:`, {
        eventId: context.eventId,
        timestamp: context.timestamp,
        resource: context.resource
    });
    const firestore = admin.firestore();
    const eventService = new MedicationEventService_1.MedicationEventService();
    const notificationService = new MedicationNotificationService_1.MedicationNotificationService();
    const results = {
        success: true,
        processed: 0,
        remindersSent: 0,
        notificationsSent: 0,
        skipped: 0,
        errors: [],
        executionTimeMs: 0,
        executionTime,
        reminderDetails: []
    };
    try {
        // Step 1: Query for upcoming scheduled events
        console.log('📊 Step 1: Querying for upcoming medication events...');
        // Look ahead 60 minutes to catch all reminder windows
        const lookAheadTime = new Date(executionTime.getTime() + (60 * 60 * 1000));
        const queryStartTime = Date.now();
        const scheduledEventsQuery = await eventService.queryEvents({
            eventType: unifiedMedicationSchema_1.MEDICATION_EVENT_TYPES.DOSE_SCHEDULED,
            startDate: executionTime,
            endDate: lookAheadTime,
            orderBy: 'eventTimestamp',
            orderDirection: 'asc',
            limit: 500,
            excludeArchived: true
        });
        const queryTime = Date.now() - queryStartTime;
        if (!scheduledEventsQuery.success || !scheduledEventsQuery.data) {
            console.error('❌ Failed to query scheduled events:', scheduledEventsQuery.error);
            results.errors.push(`Query failed: ${scheduledEventsQuery.error}`);
            results.success = false;
            return logAndReturnResults(firestore, results, startTime);
        }
        const scheduledEvents = scheduledEventsQuery.data;
        console.log(`📊 Found ${scheduledEvents.length} upcoming scheduled events (query took ${queryTime}ms)`);
        if (scheduledEvents.length === 0) {
            console.log('ℹ️ No upcoming events found to send reminders for');
            return logAndReturnResults(firestore, results, startTime);
        }
        // Step 2: Process events and send reminders
        console.log('🔄 Step 2: Processing events for reminder delivery...');
        for (const scheduledEvent of scheduledEvents) {
            try {
                results.processed++;
                // Skip if event doesn't have required data
                if (!scheduledEvent.timing?.scheduledFor || !scheduledEvent.commandId) {
                    console.warn(`⚠️ Event ${scheduledEvent.id} missing required data, skipping`);
                    results.skipped++;
                    continue;
                }
                const scheduledFor = scheduledEvent.timing.scheduledFor;
                const minutesUntilDue = Math.floor((scheduledFor.getTime() - executionTime.getTime()) / 60000);
                // Check if there's already a taken/missed/skipped event for this scheduled event
                const completionEventsQuery = await eventService.queryEvents({
                    commandId: scheduledEvent.commandId,
                    eventType: [
                        unifiedMedicationSchema_1.MEDICATION_EVENT_TYPES.DOSE_TAKEN,
                        unifiedMedicationSchema_1.MEDICATION_EVENT_TYPES.DOSE_MISSED,
                        unifiedMedicationSchema_1.MEDICATION_EVENT_TYPES.DOSE_SKIPPED
                    ],
                    startDate: new Date(scheduledFor.getTime() - 60 * 60 * 1000), // 1 hour before
                    endDate: new Date(scheduledFor.getTime() + 24 * 60 * 60 * 1000), // 24 hours after
                    excludeArchived: true
                });
                if (completionEventsQuery.success && completionEventsQuery.data && completionEventsQuery.data.length > 0) {
                    // Event already completed, skip reminder
                    results.skipped++;
                    continue;
                }
                // Get command to access reminder configuration
                const commandDoc = await firestore
                    .collection('medication_commands')
                    .doc(scheduledEvent.commandId)
                    .get();
                if (!commandDoc.exists) {
                    console.warn(`⚠️ Command ${scheduledEvent.commandId} not found, skipping`);
                    results.skipped++;
                    continue;
                }
                const command = commandDoc.data();
                // Check if reminders are enabled
                if (!command.reminders?.enabled) {
                    results.skipped++;
                    continue;
                }
                // Check if we should send a reminder based on minutesBefore configuration
                const reminderMinutes = command.reminders.minutesBefore || [15, 5];
                const shouldSendReminder = reminderMinutes.some((minutes) => {
                    // Send reminder if we're within 2 minutes of the reminder time
                    const targetReminderTime = minutes;
                    return Math.abs(minutesUntilDue - targetReminderTime) <= 2;
                });
                if (!shouldSendReminder) {
                    // Not time to send reminder yet
                    continue;
                }
                // Check if reminder already sent for this event
                const reminderSentKey = `${scheduledEvent.id}_${Math.floor(minutesUntilDue / 5) * 5}`; // Round to 5-minute buckets
                const reminderCheckDoc = await firestore
                    .collection('medication_reminder_sent_log')
                    .doc(reminderSentKey)
                    .get();
                if (reminderCheckDoc.exists) {
                    // Reminder already sent for this time window
                    results.skipped++;
                    continue;
                }
                console.log(`🔔 Sending reminder for ${scheduledEvent.context.medicationName}`);
                console.log(`   - Scheduled: ${scheduledFor.toISOString()}`);
                console.log(`   - Minutes until due: ${minutesUntilDue}`);
                console.log(`   - Reminder window: ${reminderMinutes.join(', ')} minutes before`);
                // Get patient and family member recipients
                const recipients = await getNotificationRecipients(scheduledEvent.patientId, firestore);
                if (recipients.length === 0) {
                    console.warn(`⚠️ No recipients found for patient ${scheduledEvent.patientId}`);
                    results.skipped++;
                    continue;
                }
                // Build notification request
                const notificationRequest = {
                    patientId: scheduledEvent.patientId,
                    commandId: scheduledEvent.commandId,
                    medicationName: scheduledEvent.context.medicationName,
                    notificationType: 'reminder',
                    urgency: minutesUntilDue <= 5 ? 'high' : 'medium',
                    title: `Medication Reminder: ${scheduledEvent.context.medicationName}`,
                    message: `It's almost time to take your ${scheduledEvent.context.medicationName}. Due in ${minutesUntilDue} minutes.`,
                    actionUrl: `/medications?highlight=${scheduledEvent.commandId}`,
                    scheduledFor: scheduledFor,
                    expiresAt: new Date(scheduledFor.getTime() + 60 * 60 * 1000), // Expires 1 hour after scheduled time
                    recipients,
                    context: {
                        eventId: scheduledEvent.id,
                        correlationId: `reminder_${scheduledEvent.id}_${Date.now()}`,
                        triggerSource: 'scheduled',
                        medicationData: {
                            dosageAmount: command.dosage?.amount || '1 dose',
                            scheduledTime: scheduledFor,
                            gracePeriodEnd: command.gracePeriod?.defaultMinutes
                                ? new Date(scheduledFor.getTime() + command.gracePeriod.defaultMinutes * 60 * 1000)
                                : undefined
                        }
                    }
                };
                // Send notification
                const sendResult = await notificationService.sendNotification(notificationRequest);
                if (sendResult.success && sendResult.data) {
                    results.remindersSent++;
                    results.notificationsSent += sendResult.data.totalSent;
                    results.reminderDetails.push({
                        eventId: scheduledEvent.id,
                        commandId: scheduledEvent.commandId,
                        medicationName: scheduledEvent.context.medicationName,
                        patientId: scheduledEvent.patientId,
                        scheduledDateTime: scheduledFor,
                        minutesUntilDue,
                        remindersSent: sendResult.data.totalSent,
                        recipientCount: recipients.length
                    });
                    // Mark reminder as sent
                    await firestore
                        .collection('medication_reminder_sent_log')
                        .doc(reminderSentKey)
                        .set({
                        eventId: scheduledEvent.id,
                        commandId: scheduledEvent.commandId,
                        patientId: scheduledEvent.patientId,
                        medicationName: scheduledEvent.context.medicationName,
                        scheduledFor: admin.firestore.Timestamp.fromDate(scheduledFor),
                        minutesBeforeDue: minutesUntilDue,
                        sentAt: admin.firestore.Timestamp.now(),
                        recipientCount: recipients.length,
                        notificationsSent: sendResult.data.totalSent,
                        notificationsFailed: sendResult.data.totalFailed,
                        deliveryDetails: sendResult.data
                    });
                    console.log(`✅ Reminder sent for ${scheduledEvent.context.medicationName}`);
                    console.log(`   - Recipients: ${recipients.length}`);
                    console.log(`   - Notifications sent: ${sendResult.data.totalSent}`);
                }
                else {
                    const errorMsg = `Failed to send reminder for ${scheduledEvent.context.medicationName}: ${sendResult.error}`;
                    console.error(`❌ ${errorMsg}`);
                    results.errors.push(errorMsg);
                }
            }
            catch (eventError) {
                const errorMsg = `Error processing event ${scheduledEvent.id}: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`;
                console.error(`❌ ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }
        // Step 3: Log summary
        results.executionTimeMs = Date.now() - startTime;
        console.log('📊 ===== MEDICATION REMINDERS SUMMARY =====');
        console.log(`   - Events processed: ${results.processed}`);
        console.log(`   - Reminders sent: ${results.remindersSent}`);
        console.log(`   - Total notifications: ${results.notificationsSent}`);
        console.log(`   - Skipped: ${results.skipped}`);
        console.log(`   - Errors encountered: ${results.errors.length}`);
        console.log(`   - Execution time: ${results.executionTimeMs}ms`);
        console.log(`   - Average time per event: ${results.processed > 0 ? Math.round(results.executionTimeMs / results.processed) : 0}ms`);
        if (results.errors.length > 0) {
            console.error('❌ Errors during reminder delivery:', results.errors.slice(0, 5));
        }
        if (results.remindersSent > 0) {
            console.log('📋 Reminders sent by patient:');
            const patientCounts = results.reminderDetails.reduce((acc, result) => {
                acc[result.patientId] = (acc[result.patientId] || 0) + 1;
                return acc;
            }, {});
            Object.entries(patientCounts).forEach(([patientId, count]) => {
                console.log(`   - Patient ${patientId}: ${count} reminder(s)`);
            });
        }
        console.log('🔔 ===== SCHEDULED MEDICATION REMINDERS END =====');
        return logAndReturnResults(firestore, results, startTime);
    }
    catch (error) {
        console.error('❌ Fatal error in scheduled medication reminders:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
        results.success = false;
        results.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
        results.executionTimeMs = Date.now() - startTime;
        return logAndReturnResults(firestore, results, startTime);
    }
});
/**
 * Get notification recipients for a patient (patient + family members)
 */
async function getNotificationRecipients(patientId, firestore) {
    const recipients = [];
    try {
        // Get patient information
        const patientDoc = await firestore.collection('users').doc(patientId).get();
        if (patientDoc.exists) {
            const patientData = patientDoc.data();
            recipients.push({
                userId: patientId,
                name: patientData.name || 'Patient',
                email: patientData.email,
                phone: patientData.phone,
                preferredMethods: ['browser', 'push', 'email'],
                isPatient: true,
                isFamilyMember: false,
                isEmergencyContact: false
            });
        }
        // Get family members who should receive notifications
        const familyAccessQuery = await firestore
            .collection('family_calendar_access')
            .where('patientId', '==', patientId)
            .where('status', '==', 'active')
            .get();
        for (const doc of familyAccessQuery.docs) {
            const access = doc.data();
            // Only include family members who can receive notifications
            if (access.permissions?.canReceiveNotifications) {
                // Get family member's notification preferences
                const familyMemberDoc = await firestore
                    .collection('users')
                    .doc(access.familyMemberId)
                    .get();
                if (familyMemberDoc.exists) {
                    const familyMemberData = familyMemberDoc.data();
                    recipients.push({
                        userId: access.familyMemberId,
                        name: familyMemberData.name || access.familyMemberName || 'Family Member',
                        email: familyMemberData.email || access.familyMemberEmail,
                        phone: familyMemberData.phone,
                        preferredMethods: ['email', 'browser'],
                        isPatient: false,
                        isFamilyMember: true,
                        isEmergencyContact: access.permissions?.isEmergencyContact || false
                    });
                }
            }
        }
        return recipients;
    }
    catch (error) {
        console.error('❌ Error getting notification recipients:', error);
        return recipients; // Return what we have so far
    }
}
/**
 * Log results to Firestore and return
 */
async function logAndReturnResults(firestore, results, startTime) {
    results.executionTimeMs = Date.now() - startTime;
    try {
        // Log execution to Firestore for monitoring
        await firestore.collection('medication_reminder_logs').add({
            executionTime: admin.firestore.Timestamp.fromDate(results.executionTime),
            durationMs: results.executionTimeMs,
            eventsProcessed: results.processed,
            remindersSent: results.remindersSent,
            notificationsSent: results.notificationsSent,
            skipped: results.skipped,
            errorCount: results.errors.length,
            errors: results.errors.slice(0, 10), // First 10 errors
            success: results.success,
            reminderDetailsCount: results.reminderDetails.length,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Create system alerts for concerning patterns
        if (results.errors.length > 0) {
            const errorRate = results.processed > 0 ? (results.errors.length / results.processed) * 100 : 0;
            if (errorRate > 10) {
                console.error(`🚨 HIGH ERROR RATE: ${Math.round(errorRate)}% of reminders failed`);
                await firestore.collection('system_alerts').add({
                    alertType: 'medication_reminder_errors',
                    severity: errorRate > 25 ? 'critical' : 'warning',
                    message: `Medication reminder delivery encountered ${results.errors.length} errors (${Math.round(errorRate)}% error rate)`,
                    details: {
                        totalProcessed: results.processed,
                        errorCount: results.errors.length,
                        errorRate,
                        sampleErrors: results.errors.slice(0, 5)
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    resolvedAt: null,
                    isResolved: false
                });
            }
        }
        // Alert if execution time is excessive
        if (results.executionTimeMs > 240000) { // > 4 minutes
            console.warn(`⚠️ SLOW EXECUTION: Reminder delivery took ${Math.round(results.executionTimeMs / 1000)}s`);
            await firestore.collection('system_alerts').add({
                alertType: 'medication_reminder_performance',
                severity: 'warning',
                message: `Medication reminder delivery took ${Math.round(results.executionTimeMs / 1000)}s to complete`,
                details: {
                    executionTimeMs: results.executionTimeMs,
                    eventsProcessed: results.processed,
                    averageTimePerEvent: results.processed > 0 ? Math.round(results.executionTimeMs / results.processed) : 0
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                resolvedAt: null,
                isResolved: false
            });
        }
        // Alert if delivery rate is low
        if (results.processed > 0) {
            const deliveryRate = (results.remindersSent / results.processed) * 100;
            if (deliveryRate < 80) {
                console.warn(`⚠️ LOW DELIVERY RATE: Only ${Math.round(deliveryRate)}% of reminders were sent`);
                await firestore.collection('system_alerts').add({
                    alertType: 'medication_reminder_delivery_rate',
                    severity: deliveryRate < 50 ? 'critical' : 'warning',
                    message: `Low medication reminder delivery rate: ${Math.round(deliveryRate)}%`,
                    details: {
                        processed: results.processed,
                        sent: results.remindersSent,
                        skipped: results.skipped,
                        deliveryRate
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    resolvedAt: null,
                    isResolved: false
                });
            }
        }
    }
    catch (loggingError) {
        console.error('❌ Error logging results:', loggingError);
        // Don't fail the function due to logging errors
    }
    return results;
}
