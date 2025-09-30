"use strict";
/**
 * Unified Error Handling and Rollback Service
 *
 * Provides comprehensive error handling and rollback mechanisms for the unified medication system:
 * - Centralized error classification and handling
 * - Automatic rollback for failed transactions
 * - Error recovery strategies
 * - System health monitoring
 * - Circuit breaker patterns
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
exports.errorHandlingService = exports.ErrorHandlingService = void 0;
exports.unifiedErrorHandler = unifiedErrorHandler;
const admin = __importStar(require("firebase-admin"));
const MedicationTransactionManager_1 = require("./MedicationTransactionManager");
class ErrorHandlingService {
    firestore;
    errorLog;
    healthMetrics;
    transactionManager;
    circuitBreakers;
    constructor() {
        this.firestore = admin.firestore();
        this.errorLog = this.firestore.collection('medication_error_log');
        this.healthMetrics = this.firestore.collection('medication_health_metrics');
        this.transactionManager = new MedicationTransactionManager_1.MedicationTransactionManager();
        this.circuitBreakers = new Map();
    }
    // ===== ERROR HANDLING =====
    /**
     * Handle and classify errors with automatic recovery
     */
    async handleError(error, context) {
        const errorId = this.generateErrorId();
        try {
            console.log('❌ ErrorHandlingService: Handling error:', errorId, error.message);
            // Classify the error
            const classification = this.classifyError(error, context);
            // Determine recovery strategy
            const recovery = this.determineRecoveryStrategy(classification, context);
            // Log the error
            await this.logError(errorId, error, context, classification, recovery);
            // Execute recovery strategy
            let rollbackPerformed = false;
            if (recovery.strategy === 'rollback' && context.transactionId) {
                console.log('🔄 Executing automatic rollback for transaction:', context.transactionId);
                const rollbackResult = await this.transactionManager.performRollback({
                    transactionId: context.transactionId,
                    reason: `Automatic rollback due to error: ${error.message}`,
                    rollbackBy: 'system'
                });
                rollbackPerformed = rollbackResult.success;
                if (!rollbackPerformed) {
                    console.error('❌ Rollback failed for transaction:', context.transactionId);
                    // Escalate to manual intervention
                    await this.escalateError(errorId, 'rollback_failed', context);
                }
            }
            // Send notifications if required
            if (recovery.requiresNotification) {
                await this.sendErrorNotifications(errorId, error, context, classification);
            }
            // Update circuit breaker
            this.updateCircuitBreaker(context.service, false);
            // Update health metrics
            await this.updateHealthMetrics(classification, context);
            return {
                handled: true,
                classification,
                recovery,
                errorId,
                shouldRetry: recovery.strategy === 'retry',
                rollbackPerformed
            };
        }
        catch (handlingError) {
            console.error('❌ Error handling failed:', handlingError);
            // Fallback error handling
            await this.logCriticalError(errorId, error, handlingError, context);
            return {
                handled: false,
                classification: {
                    type: 'system',
                    severity: 'critical',
                    category: 'system_error',
                    isRetryable: false,
                    requiresRollback: true,
                    requiresNotification: true
                },
                recovery: {
                    strategy: 'escalate',
                    escalationLevel: 'emergency'
                },
                errorId,
                shouldRetry: false,
                rollbackPerformed: false
            };
        }
    }
    /**
     * Classify error type and severity
     */
    classifyError(error, context) {
        const message = error.message || error.toString();
        const code = error.code || error.statusCode || error.status;
        // Authentication errors
        if (code === 401 || message.includes('Authentication') || message.includes('Unauthorized')) {
            return {
                type: 'authentication',
                severity: 'medium',
                category: 'user_error',
                isRetryable: true,
                requiresRollback: false,
                requiresNotification: false
            };
        }
        // Authorization errors
        if (code === 403 || message.includes('Access denied') || message.includes('Forbidden')) {
            return {
                type: 'authorization',
                severity: 'medium',
                category: 'user_error',
                isRetryable: false,
                requiresRollback: false,
                requiresNotification: false
            };
        }
        // Validation errors
        if (message.includes('Validation') || message.includes('Invalid') || message.includes('Required')) {
            return {
                type: 'validation',
                severity: 'low',
                category: 'user_error',
                isRetryable: false,
                requiresRollback: false,
                requiresNotification: false
            };
        }
        // Network errors
        if (code >= 500 || message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
            return {
                type: 'network',
                severity: 'medium',
                category: 'external_error',
                isRetryable: true,
                requiresRollback: false,
                requiresNotification: false
            };
        }
        // Database errors
        if (message.includes('Firestore') || message.includes('Database') || code === 'unavailable') {
            return {
                type: 'database',
                severity: 'high',
                category: 'system_error',
                isRetryable: true,
                requiresRollback: true,
                requiresNotification: true
            };
        }
        // Business logic errors
        if (message.includes('Command') || message.includes('Event') || message.includes('Workflow')) {
            return {
                type: 'business_logic',
                severity: 'medium',
                category: 'system_error',
                isRetryable: false,
                requiresRollback: true,
                requiresNotification: false
            };
        }
        // Critical system errors
        if (message.includes('Transaction') || message.includes('Rollback') || message.includes('Corruption')) {
            return {
                type: 'system',
                severity: 'critical',
                category: 'system_error',
                isRetryable: false,
                requiresRollback: true,
                requiresNotification: true
            };
        }
        // Default classification
        return {
            type: 'unknown',
            severity: 'medium',
            category: 'system_error',
            isRetryable: true,
            requiresRollback: false,
            requiresNotification: false
        };
    }
    /**
     * Determine recovery strategy based on error classification
     */
    determineRecoveryStrategy(classification, context) {
        switch (classification.type) {
            case 'validation':
            case 'authorization':
                return {
                    strategy: 'ignore', // User needs to fix input
                    notificationRecipients: []
                };
            case 'authentication':
                return {
                    strategy: 'retry',
                    maxRetries: 1,
                    retryDelayMs: 1000
                };
            case 'network':
                return {
                    strategy: 'retry',
                    maxRetries: 3,
                    retryDelayMs: 2000
                };
            case 'database':
                return {
                    strategy: classification.severity === 'critical' ? 'rollback' : 'retry',
                    maxRetries: 2,
                    retryDelayMs: 5000,
                    escalationLevel: classification.severity === 'critical' ? 'admin' : undefined
                };
            case 'business_logic':
                return {
                    strategy: 'rollback',
                    escalationLevel: 'support'
                };
            case 'system':
                return {
                    strategy: 'rollback',
                    escalationLevel: 'emergency',
                    notificationRecipients: ['admin', 'support']
                };
            default:
                return {
                    strategy: 'escalate',
                    escalationLevel: 'support'
                };
        }
    }
    // ===== CIRCUIT BREAKER PATTERN =====
    /**
     * Execute operation with circuit breaker protection
     */
    async executeWithCircuitBreaker(serviceName, operation, context) {
        const circuitBreaker = this.getCircuitBreaker(serviceName);
        if (circuitBreaker.isOpen()) {
            throw new Error(`Service ${serviceName} is currently unavailable (circuit breaker open)`);
        }
        try {
            const result = await operation();
            circuitBreaker.recordSuccess();
            return result;
        }
        catch (error) {
            circuitBreaker.recordFailure();
            // Handle the error through our error handling system
            await this.handleError(error, context);
            throw error;
        }
    }
    /**
     * Get or create circuit breaker for service
     */
    getCircuitBreaker(serviceName) {
        if (!this.circuitBreakers.has(serviceName)) {
            this.circuitBreakers.set(serviceName, new CircuitBreaker({
                failureThreshold: 5,
                recoveryTimeMs: 60000, // 1 minute
                monitoringPeriodMs: 300000 // 5 minutes
            }));
        }
        return this.circuitBreakers.get(serviceName);
    }
    /**
     * Update circuit breaker state
     */
    updateCircuitBreaker(serviceName, success) {
        const circuitBreaker = this.getCircuitBreaker(serviceName);
        if (success) {
            circuitBreaker.recordSuccess();
        }
        else {
            circuitBreaker.recordFailure();
        }
    }
    // ===== HEALTH MONITORING =====
    /**
     * Get current system health metrics
     */
    async getSystemHealth() {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            // Get recent errors
            const recentErrorsQuery = await this.errorLog
                .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo))
                .get();
            const recentErrors = recentErrorsQuery.docs.map(doc => doc.data());
            // Calculate metrics
            const totalErrors = recentErrors.length;
            const criticalErrors = recentErrors.filter(e => e.classification.severity === 'critical').length;
            const systemErrors = recentErrors.filter(e => e.classification.category === 'system_error').length;
            const userErrors = recentErrors.filter(e => e.classification.category === 'user_error').length;
            const errorRate = totalErrors; // Errors per hour
            // Get transaction success rate
            const transactionStats = await this.transactionManager.getTransactionStatistics(undefined, 1);
            const transactionSuccessRate = transactionStats.data?.successRate || 0;
            // Check service availability
            const serviceAvailability = {
                commandService: !this.getCircuitBreaker('MedicationCommandService').isOpen(),
                eventService: !this.getCircuitBreaker('MedicationEventService').isOpen(),
                notificationService: !this.getCircuitBreaker('MedicationNotificationService').isOpen(),
                transactionManager: !this.getCircuitBreaker('MedicationTransactionManager').isOpen(),
                orchestrator: !this.getCircuitBreaker('MedicationOrchestrator').isOpen()
            };
            // Get circuit breaker status
            const circuitBreakerStatus = {};
            this.circuitBreakers.forEach((breaker, serviceName) => {
                circuitBreakerStatus[serviceName] = breaker.getState();
            });
            return {
                errorRate,
                criticalErrors,
                systemErrors,
                userErrors,
                averageResponseTime: transactionStats.data?.averageExecutionTime || 0,
                transactionSuccessRate,
                serviceAvailability,
                circuitBreakerStatus,
                lastHealthCheck: now
            };
        }
        catch (error) {
            console.error('❌ Error getting system health:', error);
            return {
                errorRate: -1,
                criticalErrors: -1,
                systemErrors: -1,
                userErrors: -1,
                averageResponseTime: -1,
                transactionSuccessRate: -1,
                serviceAvailability: {},
                circuitBreakerStatus: {},
                lastHealthCheck: new Date()
            };
        }
    }
    /**
     * Perform system health check and auto-recovery
     */
    async performHealthCheck() {
        try {
            console.log('🏥 ErrorHandlingService: Performing system health check');
            const health = await this.getSystemHealth();
            const issues = [];
            const autoRecoveryActions = [];
            const manualInterventionRequired = [];
            // Check error rates
            if (health.errorRate > 10) {
                issues.push(`High error rate: ${health.errorRate} errors/hour`);
                if (health.errorRate > 50) {
                    manualInterventionRequired.push('Investigate high error rate');
                }
            }
            // Check critical errors
            if (health.criticalErrors > 0) {
                issues.push(`${health.criticalErrors} critical errors in last hour`);
                manualInterventionRequired.push('Review critical errors immediately');
            }
            // Check transaction success rate
            if (health.transactionSuccessRate < 95) {
                issues.push(`Low transaction success rate: ${health.transactionSuccessRate}%`);
                if (health.transactionSuccessRate < 80) {
                    manualInterventionRequired.push('Investigate transaction failures');
                }
            }
            // Check service availability
            Object.entries(health.serviceAvailability).forEach(([service, available]) => {
                if (!available) {
                    issues.push(`Service unavailable: ${service}`);
                    autoRecoveryActions.push(`Attempt to recover ${service} circuit breaker`);
                }
            });
            // Check circuit breakers
            Object.entries(health.circuitBreakerStatus).forEach(([service, status]) => {
                if (status === 'open') {
                    issues.push(`Circuit breaker open for ${service}`);
                    autoRecoveryActions.push(`Monitor ${service} for recovery`);
                }
                else if (status === 'half_open') {
                    issues.push(`Circuit breaker half-open for ${service}`);
                }
            });
            // Perform auto-recovery actions
            for (const action of autoRecoveryActions) {
                try {
                    await this.executeAutoRecoveryAction(action);
                    console.log('✅ Auto-recovery action completed:', action);
                }
                catch (recoveryError) {
                    console.error('❌ Auto-recovery action failed:', action, recoveryError);
                    manualInterventionRequired.push(`Manual intervention needed for: ${action}`);
                }
            }
            const healthy = issues.length === 0;
            console.log('🏥 Health check completed:', {
                healthy,
                issuesCount: issues.length,
                autoRecoveryCount: autoRecoveryActions.length,
                manualInterventionCount: manualInterventionRequired.length
            });
            return {
                healthy,
                issues,
                autoRecoveryActions,
                manualInterventionRequired
            };
        }
        catch (error) {
            console.error('❌ Health check failed:', error);
            return {
                healthy: false,
                issues: ['Health check system failure'],
                autoRecoveryActions: [],
                manualInterventionRequired: ['Investigate health check system']
            };
        }
    }
    // ===== RECOVERY OPERATIONS =====
    /**
     * Execute automatic recovery action
     */
    async executeAutoRecoveryAction(action) {
        console.log('🔧 Executing auto-recovery action:', action);
        if (action.includes('recover') && action.includes('circuit breaker')) {
            const serviceName = action.split(' ')[2]; // Extract service name
            const circuitBreaker = this.getCircuitBreaker(serviceName);
            if (circuitBreaker.isOpen()) {
                // Attempt to transition to half-open state
                circuitBreaker.attemptReset();
                console.log('🔧 Circuit breaker reset attempted for:', serviceName);
            }
        }
        // Add more auto-recovery actions as needed
    }
    /**
     * Escalate error for manual intervention
     */
    async escalateError(errorId, escalationType, context) {
        try {
            const escalation = {
                errorId,
                escalationType,
                context,
                escalatedAt: admin.firestore.Timestamp.now(),
                status: 'open',
                assignedTo: null,
                resolvedAt: null,
                resolutionNotes: null
            };
            await this.firestore.collection('medication_error_escalations').add(escalation);
            console.log('🚨 Error escalated for manual intervention:', errorId, escalationType);
        }
        catch (escalationError) {
            console.error('❌ Error escalation failed:', escalationError);
        }
    }
    // ===== LOGGING METHODS =====
    /**
     * Log error with full context
     */
    async logError(errorId, error, context, classification, recovery) {
        try {
            const errorLog = {
                errorId,
                message: error.message || error.toString(),
                stack: error.stack,
                code: error.code || error.statusCode,
                context,
                classification,
                recovery,
                timestamp: admin.firestore.Timestamp.fromDate(context.timestamp),
                resolved: false
            };
            await this.errorLog.doc(errorId).set(errorLog);
        }
        catch (loggingError) {
            console.error('❌ Error logging failed:', loggingError);
        }
    }
    /**
     * Log critical error that couldn't be handled
     */
    async logCriticalError(errorId, originalError, handlingError, context) {
        try {
            const criticalLog = {
                errorId,
                type: 'critical_system_failure',
                originalError: {
                    message: originalError.message || originalError.toString(),
                    stack: originalError.stack
                },
                handlingError: {
                    message: handlingError.message || handlingError.toString(),
                    stack: handlingError.stack
                },
                context,
                timestamp: admin.firestore.Timestamp.fromDate(context.timestamp),
                requiresImmediateAttention: true
            };
            await this.firestore.collection('medication_critical_errors').add(criticalLog);
            console.error('🚨 CRITICAL ERROR LOGGED:', errorId);
        }
        catch (criticalLoggingError) {
            console.error('❌ CRITICAL ERROR LOGGING FAILED:', criticalLoggingError);
            // At this point, we can only log to console
        }
    }
    /**
     * Update health metrics
     */
    async updateHealthMetrics(classification, context) {
        try {
            const metricsDoc = this.healthMetrics.doc('current');
            await metricsDoc.set({
                [`errors.${classification.type}`]: admin.firestore.FieldValue.increment(1),
                [`errors.${classification.severity}`]: admin.firestore.FieldValue.increment(1),
                [`services.${context.service}.errors`]: admin.firestore.FieldValue.increment(1),
                lastUpdated: admin.firestore.Timestamp.now()
            }, { merge: true });
        }
        catch (metricsError) {
            console.error('❌ Error updating health metrics:', metricsError);
        }
    }
    /**
     * Send error notifications
     */
    async sendErrorNotifications(errorId, error, context, classification) {
        try {
            // For critical errors, send immediate notifications
            if (classification.severity === 'critical') {
                const notification = {
                    type: 'critical_error',
                    errorId,
                    message: error.message,
                    service: context.service,
                    operation: context.operation,
                    patientId: context.patientId,
                    timestamp: context.timestamp,
                    requiresImmediateAction: true
                };
                await this.firestore.collection('admin_notifications').add({
                    ...notification,
                    createdAt: admin.firestore.Timestamp.now()
                });
                console.log('🚨 Critical error notification sent:', errorId);
            }
        }
        catch (notificationError) {
            console.error('❌ Error notification failed:', notificationError);
        }
    }
    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ErrorHandlingService = ErrorHandlingService;
class CircuitBreaker {
    failureCount = 0;
    lastFailureTime = 0;
    state = 'closed';
    options;
    constructor(options) {
        this.options = options;
    }
    isOpen() {
        return this.state === 'open';
    }
    getState() {
        return this.state;
    }
    recordSuccess() {
        this.failureCount = 0;
        this.state = 'closed';
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.options.failureThreshold) {
            this.state = 'open';
            console.log('🔴 Circuit breaker opened due to failures');
        }
    }
    attemptReset() {
        if (this.state === 'open' &&
            Date.now() - this.lastFailureTime >= this.options.recoveryTimeMs) {
            this.state = 'half_open';
            console.log('🟡 Circuit breaker transitioned to half-open');
        }
    }
}
// Export singleton instance
exports.errorHandlingService = new ErrorHandlingService();
// ===== ERROR HANDLING MIDDLEWARE =====
/**
 * Express middleware for unified error handling
 */
function unifiedErrorHandler(error, req, res, next) {
    const context = {
        service: 'api',
        operation: `${req.method} ${req.path}`,
        userId: req.user?.uid,
        patientId: req.body?.patientId || req.query?.patientId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        timestamp: new Date()
    };
    // Handle error asynchronously
    exports.errorHandlingService.handleError(error, context)
        .then(result => {
        console.log('✅ Error handled:', result.errorId, result.classification.type);
    })
        .catch(handlingError => {
        console.error('❌ Error handling failed:', handlingError);
    });
    // Send appropriate response
    const statusCode = error.message?.includes('Authentication') ? 401 :
        error.message?.includes('Access denied') ? 403 :
            error.message?.includes('Not found') ? 404 :
                error.message?.includes('Validation') ? 400 : 500;
    res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal server error',
        errorId: context.timestamp.getTime().toString(),
        timestamp: context.timestamp.toISOString()
    });
}
