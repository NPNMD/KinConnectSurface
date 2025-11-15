"use strict";
/**
 * Medication Monitoring Utilities
 *
 * Provides comprehensive monitoring and metrics tracking for the medication system.
 * Tracks success/failure rates, performance metrics, and generates reports.
 *
 * Features:
 * - Medication creation success/failure tracking
 * - Performance timing metrics
 * - Error detection and alerting
 * - Daily medication addition reports
 * - Integration with existing logging infrastructure
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
exports.PerformanceTimer = void 0;
exports.trackMedicationCreation = trackMedicationCreation;
exports.trackMedicationOperation = trackMedicationOperation;
exports.checkForRepeatedFailures = checkForRepeatedFailures;
exports.logSlowOperation = logSlowOperation;
exports.createAlert = createAlert;
exports.generateDailyReport = generateDailyReport;
exports.getOperationPerformance = getOperationPerformance;
exports.getRecentAlerts = getRecentAlerts;
exports.cleanupOldMetrics = cleanupOldMetrics;
exports.monitoringMiddleware = monitoringMiddleware;
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
// Lazy initialization to avoid Firebase Admin initialization order issues
let db;
function getDb() {
    if (!db) {
        db = admin.firestore();
    }
    return db;
}
// ===== MONITORING FUNCTIONS =====
/**
 * Track medication creation metrics
 */
async function trackMedicationCreation(patientId, medicationName, success, duration, errorCode, errorMessage, metadata) {
    try {
        const metrics = {
            timestamp: new Date(),
            operation: 'create',
            success,
            duration,
            patientId,
            medicationName,
            errorCode,
            errorMessage,
            metadata
        };
        // Log to Firestore for analysis
        await getDb().collection('medication_metrics').add(metrics);
        // Log to console with appropriate level
        if (success) {
            firebase_functions_1.logger.info('✅ Medication created successfully', {
                patientId,
                medicationName,
                duration: `${duration}ms`,
                ...metadata
            });
        }
        else {
            firebase_functions_1.logger.error('❌ Medication creation failed', {
                patientId,
                medicationName,
                duration: `${duration}ms`,
                errorCode,
                errorMessage,
                ...metadata
            });
        }
        // Check for alerts
        if (!success) {
            await checkForRepeatedFailures(patientId, 'create');
        }
        if (duration > 2000) {
            await logSlowOperation('create', duration, { patientId, medicationName });
        }
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to track medication creation metrics', { error });
    }
}
/**
 * Track medication operation metrics (generic)
 */
async function trackMedicationOperation(operation, patientId, success, duration, medicationId, medicationName, errorCode, errorMessage, metadata) {
    try {
        const metrics = {
            timestamp: new Date(),
            operation,
            success,
            duration,
            patientId,
            medicationId,
            medicationName,
            errorCode,
            errorMessage,
            metadata
        };
        // Log to Firestore
        await getDb().collection('medication_metrics').add(metrics);
        // Log to console
        const emoji = success ? '✅' : '❌';
        const logData = {
            operation,
            patientId,
            medicationId,
            medicationName,
            duration: `${duration}ms`,
            success,
            errorCode,
            errorMessage,
            ...metadata
        };
        if (success) {
            firebase_functions_1.logger.info(`${emoji} Medication ${operation} successful`, logData);
        }
        else {
            firebase_functions_1.logger.error(`${emoji} Medication ${operation} failed`, logData);
        }
        // Check for alerts
        if (!success) {
            await checkForRepeatedFailures(patientId, operation);
        }
        if (duration > 2000) {
            await logSlowOperation(operation, duration, { patientId, medicationId, medicationName });
        }
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to track medication operation metrics', { error });
    }
}
/**
 * Detect and alert on repeated failures
 */
async function checkForRepeatedFailures(patientId, operation, threshold = 3) {
    try {
        // Get recent failures for this patient and operation
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentFailures = await getDb().collection('medication_metrics')
            .where('patientId', '==', patientId)
            .where('operation', '==', operation)
            .where('success', '==', false)
            .where('timestamp', '>=', fiveMinutesAgo)
            .orderBy('timestamp', 'desc')
            .limit(threshold)
            .get();
        if (recentFailures.size >= threshold) {
            // Alert on repeated failures
            await createAlert({
                type: 'repeated_failures',
                severity: 'high',
                patientId,
                operation,
                failureCount: recentFailures.size,
                timeWindow: '5 minutes',
                timestamp: new Date(),
                errors: recentFailures.docs.map(doc => ({
                    errorCode: doc.data().errorCode,
                    errorMessage: doc.data().errorMessage,
                    timestamp: doc.data().timestamp
                }))
            });
            firebase_functions_1.logger.warn('🚨 Repeated failures detected', {
                patientId,
                operation,
                failureCount: recentFailures.size,
                threshold
            });
        }
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to check for repeated failures', { error });
    }
}
/**
 * Log slow operation
 */
async function logSlowOperation(operation, duration, context) {
    try {
        await getDb().collection('medication_slow_operations').add({
            operation,
            duration,
            timestamp: new Date(),
            context
        });
        firebase_functions_1.logger.warn('⚠️ Slow operation detected', {
            operation,
            duration: `${duration}ms`,
            threshold: '2000ms',
            ...context
        });
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to log slow operation', { error });
    }
}
/**
 * Create alert
 */
async function createAlert(alert) {
    try {
        await getDb().collection('medication_alerts').add(alert);
        firebase_functions_1.logger.warn('🚨 Alert created', alert);
        // TODO: Send notifications to alert recipients
        // This could integrate with email, SMS, or push notification services
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to create alert', { error });
    }
}
/**
 * Generate daily medication report
 */
async function generateDailyReport(date) {
    const reportDate = date || new Date();
    const dateString = reportDate.toISOString().split('T')[0];
    firebase_functions_1.logger.info('📊 Generating daily medication report', { date: dateString });
    try {
        // Get start and end of day
        const startOfDay = new Date(reportDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(reportDate);
        endOfDay.setHours(23, 59, 59, 999);
        // Query metrics for the day
        const metricsSnapshot = await getDb().collection('medication_metrics')
            .where('timestamp', '>=', startOfDay)
            .where('timestamp', '<=', endOfDay)
            .get();
        const metrics = metricsSnapshot.docs.map(doc => doc.data());
        // Calculate statistics
        const totalOperations = metrics.length;
        const successfulOperations = metrics.filter(m => m.success).length;
        const failedOperations = metrics.filter(m => !m.success).length;
        const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;
        const durations = metrics.map(m => m.duration);
        const averageResponseTime = durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0;
        const slowOperations = metrics.filter(m => m.duration > 2000).length;
        // Error breakdown
        const errorBreakdown = {};
        metrics.filter(m => !m.success && m.errorCode).forEach(m => {
            errorBreakdown[m.errorCode] = (errorBreakdown[m.errorCode] || 0) + 1;
        });
        // Operation breakdown
        const operationBreakdown = {};
        metrics.forEach(m => {
            operationBreakdown[m.operation] = (operationBreakdown[m.operation] || 0) + 1;
        });
        // Top errors
        const topErrors = Object.entries(errorBreakdown)
            .map(([errorCode, count]) => ({
            errorCode,
            count,
            percentage: (count / failedOperations) * 100
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        // Performance by operation
        const performanceByOperation = {};
        const operationTypes = [...new Set(metrics.map(m => m.operation))];
        for (const opType of operationTypes) {
            const opMetrics = metrics.filter(m => m.operation === opType);
            const opDurations = opMetrics.map(m => m.duration).sort((a, b) => a - b);
            performanceByOperation[opType] = {
                operationType: opType,
                averageDuration: opDurations.reduce((sum, d) => sum + d, 0) / opDurations.length,
                medianDuration: opDurations[Math.floor(opDurations.length / 2)] || 0,
                p95Duration: opDurations[Math.floor(opDurations.length * 0.95)] || 0,
                p99Duration: opDurations[Math.floor(opDurations.length * 0.99)] || 0,
                minDuration: opDurations[0] || 0,
                maxDuration: opDurations[opDurations.length - 1] || 0,
                totalOperations: opMetrics.length,
                slowOperations: opMetrics.filter(m => m.duration > 2000).length,
                failedOperations: opMetrics.filter(m => !m.success).length
            };
        }
        const report = {
            date: dateString,
            totalOperations,
            successfulOperations,
            failedOperations,
            successRate,
            averageResponseTime,
            slowOperations,
            errorBreakdown,
            operationBreakdown,
            topErrors,
            performanceByOperation
        };
        // Save report to Firestore
        await getDb().collection('medication_daily_reports').doc(dateString).set({
            ...report,
            generatedAt: new Date()
        });
        firebase_functions_1.logger.info('✅ Daily report generated', {
            date: dateString,
            totalOperations,
            successRate: `${successRate.toFixed(2)}%`,
            averageResponseTime: `${averageResponseTime.toFixed(2)}ms`
        });
        return report;
    }
    catch (error) {
        firebase_functions_1.logger.error('❌ Failed to generate daily report', { error });
        throw error;
    }
}
/**
 * Get performance metrics for a specific operation type
 */
async function getOperationPerformance(operation, startDate, endDate) {
    try {
        const metricsSnapshot = await getDb().collection('medication_metrics')
            .where('operation', '==', operation)
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .get();
        const metrics = metricsSnapshot.docs.map(doc => doc.data());
        const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
        return {
            operationType: operation,
            averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            medianDuration: durations[Math.floor(durations.length / 2)] || 0,
            p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
            p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
            minDuration: durations[0] || 0,
            maxDuration: durations[durations.length - 1] || 0,
            totalOperations: metrics.length,
            slowOperations: metrics.filter(m => m.duration > 2000).length,
            failedOperations: metrics.filter(m => !m.success).length
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to get operation performance', { error });
        throw error;
    }
}
/**
 * Get recent alerts
 */
async function getRecentAlerts(limit = 10) {
    try {
        const alertsSnapshot = await getDb().collection('medication_alerts')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        return alertsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to get recent alerts', { error });
        return [];
    }
}
/**
 * Clean up old metrics (retention policy)
 */
async function cleanupOldMetrics(retentionDays = 90) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        firebase_functions_1.logger.info('🧹 Cleaning up old metrics', {
            retentionDays,
            cutoffDate: cutoffDate.toISOString()
        });
        const oldMetricsSnapshot = await getDb().collection('medication_metrics')
            .where('timestamp', '<', cutoffDate)
            .limit(500) // Process in batches
            .get();
        if (oldMetricsSnapshot.empty) {
            firebase_functions_1.logger.info('No old metrics to clean up');
            return 0;
        }
        const batch = getDb().batch();
        oldMetricsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        firebase_functions_1.logger.info(`✅ Cleaned up ${oldMetricsSnapshot.size} old metrics`);
        return oldMetricsSnapshot.size;
    }
    catch (error) {
        firebase_functions_1.logger.error('Failed to clean up old metrics', { error });
        return 0;
    }
}
/**
 * Performance timer utility
 */
class PerformanceTimer {
    startTime;
    operation;
    context;
    constructor(operation, context = {}) {
        this.operation = operation;
        this.context = context;
        this.startTime = Date.now();
    }
    /**
     * End timer and log metrics
     */
    async end(success, errorCode, errorMessage) {
        const duration = Date.now() - this.startTime;
        await trackMedicationOperation(this.operation, this.context.patientId || 'unknown', success, duration, this.context.medicationId, this.context.medicationName, errorCode, errorMessage, this.context);
        return duration;
    }
    /**
     * Get elapsed time without ending timer
     */
    elapsed() {
        return Date.now() - this.startTime;
    }
}
exports.PerformanceTimer = PerformanceTimer;
/**
 * Monitoring middleware for Express routes
 */
function monitoringMiddleware(operation) {
    return async (req, res, next) => {
        const timer = new PerformanceTimer(operation, {
            patientId: req.user?.uid,
            path: req.path,
            method: req.method
        });
        // Capture original send
        const originalSend = res.send;
        res.send = function (data) {
            const success = res.statusCode >= 200 && res.statusCode < 400;
            const errorCode = success ? undefined : `HTTP_${res.statusCode}`;
            const errorMessage = success ? undefined : data?.error || 'Unknown error';
            timer.end(success, errorCode, errorMessage).catch(err => {
                firebase_functions_1.logger.error('Failed to track middleware metrics', { err });
            });
            return originalSend.call(this, data);
        };
        next();
    };
}
// ===== EXPORTS =====
exports.default = {
    trackMedicationCreation,
    trackMedicationOperation,
    checkForRepeatedFailures,
    logSlowOperation,
    createAlert,
    generateDailyReport,
    getOperationPerformance,
    getRecentAlerts,
    cleanupOldMetrics,
    PerformanceTimer,
    monitoringMiddleware
};
