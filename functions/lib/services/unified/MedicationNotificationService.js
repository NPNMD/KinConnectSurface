"use strict";
/**
 * MedicationNotificationService
 *
 * Single Responsibility: ONLY handles notifications
 *
 * This service is responsible for:
 * - Sending medication reminders
 * - Processing notification preferences
 * - Managing notification queues
 * - Tracking notification delivery
 *
 * This service does NOT:
 * - Modify command state (handled by MedicationCommandService)
 * - Create events (handled by MedicationEventService)
 * - Manage transactions (handled by MedicationTransactionManager)
 * - Coordinate between services (handled by MedicationOrchestrator)
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationNotificationService = void 0;
const admin = __importStar(require("firebase-admin"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
class MedicationNotificationService {
    firestore;
    notificationQueue;
    deliveryLog;
    preferences;
    constructor() {
        this.firestore = admin.firestore();
        this.notificationQueue = this.firestore.collection('medication_notification_queue');
        this.deliveryLog = this.firestore.collection('medication_notification_delivery_log');
        this.preferences = this.firestore.collection('medication_notification_preferences');
    }
    // ===== NOTIFICATION SENDING =====
    /**
     * Send medication notification
     */
    async sendNotification(request) {
        try {
            console.log('📨 MedicationNotificationService: Sending notification:', request.notificationType, 'for:', request.medicationName);
            const deliveryResult = {
                success: true,
                deliveredTo: [],
                failed: [],
                totalSent: 0,
                totalFailed: 0
            };
            // Process each recipient
            for (const recipient of request.recipients) {
                // Get recipient preferences
                const preferences = await this.getNotificationPreferences(request.patientId, recipient.userId);
                // Check if notifications are enabled for this type
                if (!this.shouldSendNotification(request, recipient, preferences)) {
                    console.log('⏭️ Skipping notification for recipient:', recipient.name, '(preferences/quiet hours)');
                    continue;
                }
                // Send via each preferred method
                for (const method of recipient.preferredMethods) {
                    if (!preferences.enabledMethods.includes(method)) {
                        continue;
                    }
                    try {
                        const deliverySuccess = await this.deliverNotification(request, recipient, method, preferences);
                        if (deliverySuccess.success) {
                            deliveryResult.deliveredTo.push({
                                userId: recipient.userId,
                                method,
                                deliveredAt: new Date(),
                                messageId: deliverySuccess.messageId
                            });
                            deliveryResult.totalSent++;
                        }
                        else {
                            deliveryResult.failed.push({
                                userId: recipient.userId,
                                method,
                                error: deliverySuccess.error || 'Unknown delivery error'
                            });
                            deliveryResult.totalFailed++;
                        }
                    }
                    catch (deliveryError) {
                        console.error('❌ Delivery error:', deliveryError);
                        deliveryResult.failed.push({
                            userId: recipient.userId,
                            method,
                            error: deliveryError instanceof Error ? deliveryError.message : 'Delivery failed'
                        });
                        deliveryResult.totalFailed++;
                    }
                }
            }
            // Log delivery results
            await this.logNotificationDelivery(request, deliveryResult);
            // Update success status
            deliveryResult.success = deliveryResult.totalSent > 0;
            console.log('📨 Notification delivery complete:', {
                sent: deliveryResult.totalSent,
                failed: deliveryResult.totalFailed,
                success: deliveryResult.success
            });
            return {
                success: true,
                data: deliveryResult
            };
        }
        catch (error) {
            console.error('❌ MedicationNotificationService: Error sending notification:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send notification'
            };
        }
    }
    /**
     * Queue notification for later delivery
     */
    async queueNotification(request, deliverAt) {
        try {
            console.log('📥 MedicationNotificationService: Queueing notification for:', request.medicationName);
            const queueItem = {
                ...request,
                queuedAt: admin.firestore.Timestamp.now(),
                deliverAt: deliverAt ? admin.firestore.Timestamp.fromDate(deliverAt) : admin.firestore.Timestamp.now(),
                status: 'queued',
                attempts: 0,
                maxAttempts: 3
            };
            const queueRef = await this.notificationQueue.add(queueItem);
            console.log('✅ Notification queued successfully:', queueRef.id);
            return {
                success: true,
                data: { queueId: queueRef.id }
            };
        }
        catch (error) {
            console.error('❌ MedicationNotificationService: Error queueing notification:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to queue notification'
            };
        }
    }
    // ===== DELIVERY METHODS =====
    /**
     * Deliver notification via specific method
     */
    async deliverNotification(request, recipient, method, preferences) {
        try {
            switch (method) {
                case 'email':
                    return await this.sendEmailNotification(request, recipient);
                case 'sms':
                    return await this.sendSMSNotification(request, recipient);
                case 'push':
                    return await this.sendPushNotification(request, recipient);
                case 'browser':
                    return await this.sendBrowserNotification(request, recipient);
                default:
                    return {
                        success: false,
                        error: `Unsupported notification method: ${method}`
                    };
            }
        }
        catch (error) {
            console.error(`❌ Error delivering ${method} notification:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : `Failed to deliver ${method} notification`
            };
        }
    }
    /**
     * Send email notification
     */
    async sendEmailNotification(request, recipient) {
        try {
            if (!recipient.email) {
                return {
                    success: false,
                    error: 'No email address provided'
                };
            }
            // Get SendGrid API key from environment
            const sendgridApiKey = process.env.SENDGRID_API_KEY;
            if (!sendgridApiKey) {
                return {
                    success: false,
                    error: 'SendGrid API key not configured'
                };
            }
            mail_1.default.setApiKey(sendgridApiKey);
            const emailContent = this.generateEmailContent(request, recipient);
            const msg = {
                to: recipient.email,
                from: 'notifications@kinconnect.app', // Configure your verified sender
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text
            };
            const [response] = await mail_1.default.send(msg);
            return {
                success: true,
                messageId: response.headers['x-message-id']
            };
        }
        catch (error) {
            console.error('❌ Email delivery error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Email delivery failed'
            };
        }
    }
    /**
     * Send SMS notification (placeholder - would integrate with Twilio or similar)
     */
    async sendSMSNotification(request, recipient) {
        try {
            if (!recipient.phone) {
                return {
                    success: false,
                    error: 'No phone number provided'
                };
            }
            // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
            console.log('📱 SMS notification would be sent to:', recipient.phone);
            return {
                success: true,
                messageId: `sms_${Date.now()}`
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'SMS delivery failed'
            };
        }
    }
    /**
     * Send push notification
     */
    async sendPushNotification(request, recipient) {
        try {
            // Get FCM tokens for user
            const tokensDoc = await this.firestore.collection('user_fcm_tokens').doc(recipient.userId).get();
            if (!tokensDoc.exists) {
                return {
                    success: false,
                    error: 'No FCM tokens found for user'
                };
            }
            const tokens = tokensDoc.data()?.tokens || [];
            if (tokens.length === 0) {
                return {
                    success: false,
                    error: 'No active FCM tokens'
                };
            }
            const pushContent = this.generatePushContent(request, recipient);
            const message = {
                notification: {
                    title: pushContent.title,
                    body: pushContent.body
                },
                data: {
                    type: 'medication_notification',
                    notificationType: request.notificationType,
                    commandId: request.commandId,
                    patientId: request.patientId,
                    actionUrl: request.actionUrl || ''
                },
                tokens
            };
            const response = await admin.messaging().sendMulticast(message);
            return {
                success: response.successCount > 0,
                messageId: `push_${Date.now()}`
            };
        }
        catch (error) {
            console.error('❌ Push notification error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Push notification failed'
            };
        }
    }
    /**
     * Send browser notification (in-app)
     */
    async sendBrowserNotification(request, recipient) {
        try {
            // Store in-app notification
            const notification = {
                userId: recipient.userId,
                patientId: request.patientId,
                commandId: request.commandId,
                type: request.notificationType,
                urgency: request.urgency,
                title: request.title,
                message: request.message,
                actionUrl: request.actionUrl,
                isRead: false,
                createdAt: admin.firestore.Timestamp.now(),
                expiresAt: request.expiresAt ? admin.firestore.Timestamp.fromDate(request.expiresAt) : null
            };
            const notificationRef = await this.firestore.collection('in_app_notifications').add(notification);
            return {
                success: true,
                messageId: notificationRef.id
            };
        }
        catch (error) {
            console.error('❌ Browser notification error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Browser notification failed'
            };
        }
    }
    // ===== CONTENT GENERATION =====
    /**
     * Generate email content
     */
    generateEmailContent(request, recipient) {
        const { medicationName, notificationType, context } = request;
        let subject;
        let bodyText;
        switch (notificationType) {
            case 'reminder':
                subject = `Medication Reminder: ${medicationName}`;
                bodyText = `It's time to take your ${medicationName} (${context.medicationData?.dosageAmount}).`;
                break;
            case 'missed':
                subject = `Missed Medication Alert: ${medicationName}`;
                bodyText = `You missed your scheduled dose of ${medicationName}. Please take it as soon as possible or contact your healthcare provider.`;
                break;
            case 'alert':
                subject = `Medication Safety Alert: ${medicationName}`;
                bodyText = request.message;
                break;
            case 'status_change':
                subject = `Medication Status Update: ${medicationName}`;
                bodyText = request.message;
                break;
            default:
                subject = `Medication Notification: ${medicationName}`;
                bodyText = request.message;
        }
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
          <p style="color: #666; margin: 5px 0;">Medication Management</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin-top: 0;">${request.title}</h2>
          <p style="font-size: 16px; line-height: 1.5;">${bodyText}</p>
          
          ${context.medicationData ? `
            <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #374151;">Medication Details</h3>
              <p><strong>Medication:</strong> ${medicationName}</p>
              <p><strong>Dosage:</strong> ${context.medicationData.dosageAmount}</p>
              <p><strong>Scheduled Time:</strong> ${context.medicationData.scheduledTime.toLocaleTimeString()}</p>
              ${context.medicationData.gracePeriodEnd ?
            `<p><strong>Grace Period Ends:</strong> ${context.medicationData.gracePeriodEnd.toLocaleTimeString()}</p>` : ''}
            </div>
          ` : ''}
          
          ${request.actionUrl ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${request.actionUrl}" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Take Action
              </a>
            </div>
          ` : ''}
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
          <p>This notification was sent to ${recipient.email} for ${recipient.isPatient ? 'your' : `${recipient.name}'s`} medication management.</p>
          <p>To manage notification preferences, visit your KinConnect dashboard.</p>
        </div>
      </div>
    `;
        return {
            subject,
            html,
            text: bodyText
        };
    }
    /**
     * Generate push notification content
     */
    generatePushContent(request, recipient) {
        const { medicationName, notificationType } = request;
        switch (notificationType) {
            case 'reminder':
                return {
                    title: 'Medication Reminder',
                    body: `Time to take ${medicationName}`
                };
            case 'missed':
                return {
                    title: 'Missed Medication',
                    body: `You missed your ${medicationName} dose`
                };
            case 'alert':
                return {
                    title: 'Medication Alert',
                    body: request.message
                };
            default:
                return {
                    title: 'Medication Notification',
                    body: request.message
                };
        }
    }
    // ===== PREFERENCE MANAGEMENT =====
    /**
     * Get notification preferences for a user
     */
    async getNotificationPreferences(patientId, userId) {
        try {
            const prefsDoc = await this.preferences.doc(`${patientId}_${userId}`).get();
            if (!prefsDoc.exists) {
                // Return default preferences
                return this.getDefaultPreferences(patientId, userId);
            }
            const data = prefsDoc.data();
            return {
                patientId,
                userId,
                enabledMethods: data.enabledMethods || ['browser', 'push'],
                quietHours: data.quietHours || { start: '22:00', end: '07:00', enabled: true },
                reminderNotifications: data.reminderNotifications ?? true,
                missedMedicationAlerts: data.missedMedicationAlerts ?? true,
                statusChangeNotifications: data.statusChangeNotifications ?? true,
                safetyAlerts: data.safetyAlerts ?? true,
                maxRemindersPerDay: data.maxRemindersPerDay || 50,
                reminderCooldownMinutes: data.reminderCooldownMinutes || 5,
                emergencyBypass: data.emergencyBypass ?? true,
                escalationEnabled: data.escalationEnabled ?? false,
                escalationDelayMinutes: data.escalationDelayMinutes || 30,
                notifyFamilyOnMissed: data.notifyFamilyOnMissed ?? false,
                notifyFamilyOnCritical: data.notifyFamilyOnCritical ?? true,
                familyNotificationDelay: data.familyNotificationDelay || 15
            };
        }
        catch (error) {
            console.error('❌ Error getting notification preferences:', error);
            return this.getDefaultPreferences(patientId, userId);
        }
    }
    /**
     * Update notification preferences
     */
    async updateNotificationPreferences(patientId, userId, preferences) {
        try {
            const prefsRef = this.preferences.doc(`${patientId}_${userId}`);
            const updateData = {
                ...preferences,
                patientId,
                userId,
                updatedAt: admin.firestore.Timestamp.now()
            };
            await prefsRef.set(updateData, { merge: true });
            console.log('✅ Notification preferences updated for user:', userId);
            return {
                success: true
            };
        }
        catch (error) {
            console.error('❌ Error updating notification preferences:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update notification preferences'
            };
        }
    }
    // ===== HELPER METHODS =====
    /**
     * Check if notification should be sent based on preferences and timing
     */
    shouldSendNotification(request, recipient, preferences) {
        // Check notification type preferences
        switch (request.notificationType) {
            case 'reminder':
                if (!preferences.reminderNotifications)
                    return false;
                break;
            case 'missed':
                if (!preferences.missedMedicationAlerts)
                    return false;
                break;
            case 'alert':
                if (!preferences.safetyAlerts)
                    return false;
                break;
            case 'status_change':
                if (!preferences.statusChangeNotifications)
                    return false;
                break;
        }
        // Check quiet hours (unless emergency bypass)
        if (preferences.quietHours.enabled &&
            request.urgency !== 'critical' &&
            !preferences.emergencyBypass) {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM
            if (this.isInQuietHours(currentTime, preferences.quietHours)) {
                console.log('🔇 Notification blocked by quiet hours');
                return false;
            }
        }
        // Check rate limiting
        // TODO: Implement rate limiting check against recent notifications
        return true;
    }
    /**
     * Check if current time is in quiet hours
     */
    isInQuietHours(currentTime, quietHours) {
        const { start, end } = quietHours;
        // Handle overnight quiet hours (e.g., 22:00 to 07:00)
        if (start > end) {
            return currentTime >= start || currentTime <= end;
        }
        // Handle same-day quiet hours (e.g., 12:00 to 14:00)
        return currentTime >= start && currentTime <= end;
    }
    /**
     * Get default notification preferences
     */
    getDefaultPreferences(patientId, userId) {
        return {
            patientId,
            userId,
            enabledMethods: ['browser', 'push'],
            quietHours: {
                start: '22:00',
                end: '07:00',
                enabled: true
            },
            reminderNotifications: true,
            missedMedicationAlerts: true,
            statusChangeNotifications: true,
            safetyAlerts: true,
            maxRemindersPerDay: 50,
            reminderCooldownMinutes: 5,
            emergencyBypass: true,
            escalationEnabled: false,
            escalationDelayMinutes: 30,
            notifyFamilyOnMissed: false,
            notifyFamilyOnCritical: true,
            familyNotificationDelay: 15
        };
    }
    /**
     * Log notification delivery for audit trail
     */
    async logNotificationDelivery(request, result) {
        try {
            const logEntry = {
                patientId: request.patientId,
                commandId: request.commandId,
                medicationName: request.medicationName,
                notificationType: request.notificationType,
                urgency: request.urgency,
                totalRecipients: request.recipients.length,
                totalSent: result.totalSent,
                totalFailed: result.totalFailed,
                deliveryDetails: {
                    delivered: result.deliveredTo,
                    failed: result.failed
                },
                correlationId: request.context.correlationId,
                triggerSource: request.context.triggerSource,
                createdAt: admin.firestore.Timestamp.now()
            };
            await this.deliveryLog.add(logEntry);
        }
        catch (error) {
            console.error('❌ Error logging notification delivery:', error);
            // Don't throw - logging failure shouldn't fail the notification
        }
    }
    // ===== QUEUE PROCESSING =====
    /**
     * Process queued notifications (called by scheduled function)
     */
    async processNotificationQueue() {
        try {
            console.log('📥 MedicationNotificationService: Processing notification queue');
            const now = admin.firestore.Timestamp.now();
            // Get notifications ready for delivery
            const queueQuery = await this.notificationQueue
                .where('status', '==', 'queued')
                .where('deliverAt', '<=', now)
                .where('attempts', '<', 3)
                .limit(50)
                .get();
            if (queueQuery.empty) {
                return {
                    success: true,
                    data: { processed: 0, sent: 0, failed: 0, errors: [] }
                };
            }
            const results = {
                processed: 0,
                sent: 0,
                failed: 0,
                errors: []
            };
            // Process each queued notification
            for (const doc of queueQuery.docs) {
                try {
                    results.processed++;
                    const queueItem = doc.data();
                    // Send notification
                    const sendResult = await this.sendNotification(queueItem);
                    if (sendResult.success) {
                        results.sent++;
                        // Mark as sent
                        await doc.ref.update({
                            status: 'sent',
                            sentAt: admin.firestore.Timestamp.now(),
                            attempts: queueItem.attempts + 1
                        });
                    }
                    else {
                        results.failed++;
                        results.errors.push(`${queueItem.medicationName}: ${sendResult.error}`);
                        // Update attempt count
                        const newAttempts = queueItem.attempts + 1;
                        if (newAttempts >= queueItem.maxAttempts) {
                            await doc.ref.update({
                                status: 'failed',
                                attempts: newAttempts,
                                lastError: sendResult.error,
                                failedAt: admin.firestore.Timestamp.now()
                            });
                        }
                        else {
                            await doc.ref.update({
                                attempts: newAttempts,
                                lastError: sendResult.error
                            });
                        }
                    }
                }
                catch (itemError) {
                    results.failed++;
                    results.errors.push(`Queue item ${doc.id}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
                }
            }
            console.log('📥 Queue processing complete:', results);
            return {
                success: true,
                data: results
            };
        }
        catch (error) {
            console.error('❌ MedicationNotificationService: Error processing queue:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process notification queue'
            };
        }
    }
    // ===== ANALYTICS =====
    /**
     * Get notification delivery statistics
     */
    async getDeliveryStatistics(patientId, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            let query = this.deliveryLog
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate));
            if (patientId) {
                query = query.where('patientId', '==', patientId);
            }
            const snapshot = await query.get();
            const logs = snapshot.docs.map(doc => doc.data());
            // Calculate statistics
            const totalNotifications = logs.length;
            const totalSent = logs.reduce((sum, log) => sum + log.totalSent, 0);
            const totalFailed = logs.reduce((sum, log) => sum + log.totalFailed, 0);
            const deliveryRate = totalNotifications > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0;
            const byMethod = {};
            const byType = {};
            const byUrgency = {};
            logs.forEach(log => {
                // Count by type
                byType[log.notificationType] = (byType[log.notificationType] || 0) + 1;
                // Count by urgency
                byUrgency[log.urgency] = (byUrgency[log.urgency] || 0) + 1;
                // Count by method
                log.deliveryDetails.delivered.forEach((delivery) => {
                    if (!byMethod[delivery.method]) {
                        byMethod[delivery.method] = { sent: 0, failed: 0, rate: 0 };
                    }
                    byMethod[delivery.method].sent++;
                });
                log.deliveryDetails.failed.forEach((failure) => {
                    if (!byMethod[failure.method]) {
                        byMethod[failure.method] = { sent: 0, failed: 0, rate: 0 };
                    }
                    byMethod[failure.method].failed++;
                });
            });
            // Calculate rates for each method
            Object.keys(byMethod).forEach(method => {
                const methodStats = byMethod[method];
                const total = methodStats.sent + methodStats.failed;
                methodStats.rate = total > 0 ? (methodStats.sent / total) * 100 : 0;
            });
            const statistics = {
                totalNotifications,
                deliveryRate,
                byMethod,
                byType,
                byUrgency,
                averageDeliveryTime: 0 // Would need delivery timing data
            };
            return {
                success: true,
                data: statistics
            };
        }
        catch (error) {
            console.error('❌ MedicationNotificationService: Error getting statistics:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get delivery statistics'
            };
        }
    }
}
exports.MedicationNotificationService = MedicationNotificationService;
