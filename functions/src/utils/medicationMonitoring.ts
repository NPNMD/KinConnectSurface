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

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

// Lazy initialization to avoid Firebase Admin initialization order issues
let db: admin.firestore.Firestore;

function getDb(): admin.firestore.Firestore {
  if (!db) {
    db = admin.firestore();
  }
  return db;
}

// ===== TYPES =====

export interface MedicationMetrics {
  timestamp: Date;
  operation: 'create' | 'update' | 'delete' | 'take' | 'skip' | 'snooze';
  success: boolean;
  duration: number; // milliseconds
  patientId: string;
  medicationId?: string;
  medicationName?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  operationType: string;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;
  minDuration: number;
  maxDuration: number;
  totalOperations: number;
  slowOperations: number; // > 2 seconds
  failedOperations: number;
}

export interface DailyReport {
  date: string; // YYYY-MM-DD
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  averageResponseTime: number;
  slowOperations: number;
  errorBreakdown: Record<string, number>;
  operationBreakdown: Record<string, number>;
  topErrors: Array<{
    errorCode: string;
    count: number;
    percentage: number;
  }>;
  performanceByOperation: Record<string, PerformanceMetrics>;
}

export interface AlertConfig {
  failureThreshold: number; // Percentage
  slowOperationThreshold: number; // Milliseconds
  repeatedFailureCount: number; // Number of consecutive failures
  alertRecipients: string[];
  enabled: boolean;
}

// ===== MONITORING FUNCTIONS =====

/**
 * Track medication creation metrics
 */
export async function trackMedicationCreation(
  patientId: string,
  medicationName: string,
  success: boolean,
  duration: number,
  errorCode?: string,
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const metrics: MedicationMetrics = {
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
      logger.info('✅ Medication created successfully', {
        patientId,
        medicationName,
        duration: `${duration}ms`,
        ...metadata
      });
    } else {
      logger.error('❌ Medication creation failed', {
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
  } catch (error) {
    logger.error('Failed to track medication creation metrics', { error });
  }
}

/**
 * Track medication operation metrics (generic)
 */
export async function trackMedicationOperation(
  operation: MedicationMetrics['operation'],
  patientId: string,
  success: boolean,
  duration: number,
  medicationId?: string,
  medicationName?: string,
  errorCode?: string,
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const metrics: MedicationMetrics = {
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
      logger.info(`${emoji} Medication ${operation} successful`, logData);
    } else {
      logger.error(`${emoji} Medication ${operation} failed`, logData);
    }

    // Check for alerts
    if (!success) {
      await checkForRepeatedFailures(patientId, operation);
    }

    if (duration > 2000) {
      await logSlowOperation(operation, duration, { patientId, medicationId, medicationName });
    }
  } catch (error) {
    logger.error('Failed to track medication operation metrics', { error });
  }
}

/**
 * Detect and alert on repeated failures
 */
export async function checkForRepeatedFailures(
  patientId: string,
  operation: string,
  threshold: number = 3
): Promise<void> {
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

      logger.warn('🚨 Repeated failures detected', {
        patientId,
        operation,
        failureCount: recentFailures.size,
        threshold
      });
    }
  } catch (error) {
    logger.error('Failed to check for repeated failures', { error });
  }
}

/**
 * Log slow operation
 */
export async function logSlowOperation(
  operation: string,
  duration: number,
  context: Record<string, any>
): Promise<void> {
  try {
    await getDb().collection('medication_slow_operations').add({
      operation,
      duration,
      timestamp: new Date(),
      context
    });

    logger.warn('⚠️ Slow operation detected', {
      operation,
      duration: `${duration}ms`,
      threshold: '2000ms',
      ...context
    });
  } catch (error) {
    logger.error('Failed to log slow operation', { error });
  }
}

/**
 * Create alert
 */
export async function createAlert(alert: {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  patientId?: string;
  operation?: string;
  failureCount?: number;
  timeWindow?: string;
  timestamp: Date;
  errors?: any[];
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await getDb().collection('medication_alerts').add(alert);

    logger.warn('🚨 Alert created', alert);

    // TODO: Send notifications to alert recipients
    // This could integrate with email, SMS, or push notification services
  } catch (error) {
    logger.error('Failed to create alert', { error });
  }
}

/**
 * Generate daily medication report
 */
export async function generateDailyReport(date?: Date): Promise<DailyReport> {
  const reportDate = date || new Date();
  const dateString = reportDate.toISOString().split('T')[0];
  
  logger.info('📊 Generating daily medication report', { date: dateString });

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

    const metrics = metricsSnapshot.docs.map(doc => doc.data() as MedicationMetrics);

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
    const errorBreakdown: Record<string, number> = {};
    metrics.filter(m => !m.success && m.errorCode).forEach(m => {
      errorBreakdown[m.errorCode!] = (errorBreakdown[m.errorCode!] || 0) + 1;
    });

    // Operation breakdown
    const operationBreakdown: Record<string, number> = {};
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
    const performanceByOperation: Record<string, PerformanceMetrics> = {};
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

    const report: DailyReport = {
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

    logger.info('✅ Daily report generated', {
      date: dateString,
      totalOperations,
      successRate: `${successRate.toFixed(2)}%`,
      averageResponseTime: `${averageResponseTime.toFixed(2)}ms`
    });

    return report;
  } catch (error) {
    logger.error('❌ Failed to generate daily report', { error });
    throw error;
  }
}

/**
 * Get performance metrics for a specific operation type
 */
export async function getOperationPerformance(
  operation: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceMetrics> {
  try {
    const metricsSnapshot = await getDb().collection('medication_metrics')
      .where('operation', '==', operation)
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .get();

    const metrics = metricsSnapshot.docs.map(doc => doc.data() as MedicationMetrics);
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
  } catch (error) {
    logger.error('Failed to get operation performance', { error });
    throw error;
  }
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(limit: number = 10): Promise<any[]> {
  try {
    const alertsSnapshot = await getDb().collection('medication_alerts')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    logger.error('Failed to get recent alerts', { error });
    return [];
  }
}

/**
 * Clean up old metrics (retention policy)
 */
export async function cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    logger.info('🧹 Cleaning up old metrics', {
      retentionDays,
      cutoffDate: cutoffDate.toISOString()
    });

    const oldMetricsSnapshot = await getDb().collection('medication_metrics')
      .where('timestamp', '<', cutoffDate)
      .limit(500) // Process in batches
      .get();

    if (oldMetricsSnapshot.empty) {
      logger.info('No old metrics to clean up');
      return 0;
    }

    const batch = getDb().batch();
    oldMetricsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info(`✅ Cleaned up ${oldMetricsSnapshot.size} old metrics`);
    return oldMetricsSnapshot.size;
  } catch (error) {
    logger.error('Failed to clean up old metrics', { error });
    return 0;
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private context: Record<string, any>;

  constructor(operation: string, context: Record<string, any> = {}) {
    this.operation = operation;
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * End timer and log metrics
   */
  async end(success: boolean, errorCode?: string, errorMessage?: string): Promise<number> {
    const duration = Date.now() - this.startTime;

    await trackMedicationOperation(
      this.operation as any,
      this.context.patientId || 'unknown',
      success,
      duration,
      this.context.medicationId,
      this.context.medicationName,
      errorCode,
      errorMessage,
      this.context
    );

    return duration;
  }

  /**
   * Get elapsed time without ending timer
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Monitoring middleware for Express routes
 */
export function monitoringMiddleware(operation: string) {
  return async (req: any, res: any, next: any) => {
    const timer = new PerformanceTimer(operation, {
      patientId: req.user?.uid,
      path: req.path,
      method: req.method
    });

    // Capture original send
    const originalSend = res.send;
    res.send = function (data: any) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      const errorCode = success ? undefined : `HTTP_${res.statusCode}`;
      const errorMessage = success ? undefined : data?.error || 'Unknown error';

      timer.end(success, errorCode, errorMessage).catch(err => {
        logger.error('Failed to track middleware metrics', { err });
      });

      return originalSend.call(this, data);
    };

    next();
  };
}

// ===== EXPORTS =====

export default {
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