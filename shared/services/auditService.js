"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const firebase_1 = require("../firebase");
const types_1 = require("../types");
class AuditService {
    db;
    constructor(deps) {
        this.db = deps.db;
    }
    /**
     * Log an audit event. This method is non-blocking - failures are logged but don't throw.
     * @param auditLog - The audit log data to record
     */
    async log(auditLog) {
        try {
            const timestamp = new Date();
            const auditLogData = {
                ...auditLog,
                timestamp,
                createdAt: timestamp,
            };
            await this.db.collection(firebase_1.COLLECTIONS.AUDIT_LOGS).add(auditLogData);
        }
        catch (error) {
            // Log error but don't throw - audit logging should never break the application
            console.error('Failed to write audit log:', error);
            console.error('Audit log data:', auditLog);
        }
    }
    /**
     * Log a successful authentication event
     */
    async logLogin(userId, userEmail, ipAddress, userAgent) {
        await this.log({
            userId,
            userEmail,
            action: types_1.AuditAction.LOGIN,
            resource: `user:${userId}`,
            resourceId: userId,
            result: types_1.AuditResult.SUCCESS,
            ipAddress,
            userAgent,
        });
    }
    /**
     * Log a failed authentication attempt
     */
    async logLoginFailed(email, reason, ipAddress, userAgent) {
        await this.log({
            userId: 'anonymous',
            userEmail: email,
            action: types_1.AuditAction.LOGIN_FAILED,
            resource: `login:${email}`,
            result: types_1.AuditResult.FAILURE,
            ipAddress,
            userAgent,
            errorMessage: reason,
        });
    }
    /**
     * Log a logout event
     */
    async logLogout(userId, userEmail, ipAddress, userAgent) {
        await this.log({
            userId,
            userEmail,
            action: types_1.AuditAction.LOGOUT,
            resource: `user:${userId}`,
            resourceId: userId,
            result: types_1.AuditResult.SUCCESS,
            ipAddress,
            userAgent,
        });
    }
    /**
     * Log successful patient data access
     */
    async logPatientAccess(userId, patientId, action, result, metadata, ipAddress, userAgent) {
        await this.log({
            userId,
            action,
            resource: `patient:${patientId}`,
            resourceId: patientId,
            result,
            ipAddress,
            userAgent,
            metadata,
        });
    }
    /**
     * Log denied patient data access
     */
    async logPatientAccessDenied(userId, patientId, reason, ipAddress, userAgent) {
        await this.log({
            userId,
            action: types_1.AuditAction.ACCESS_PATIENT_DENIED,
            resource: `patient:${patientId}`,
            resourceId: patientId,
            result: types_1.AuditResult.DENIED,
            ipAddress,
            userAgent,
            errorMessage: reason,
            metadata: { reason },
        });
    }
    /**
     * Log medication operations
     */
    async logMedicationOperation(userId, medicationId, action, result, metadata, ipAddress, userAgent) {
        await this.log({
            userId,
            action,
            resource: `medication:${medicationId}`,
            resourceId: medicationId,
            result,
            ipAddress,
            userAgent,
            metadata,
        });
    }
    /**
     * Log authorization check results
     */
    async logAuthorizationCheck(userId, resource, resourceId, action, granted, reason, ipAddress, userAgent) {
        await this.log({
            userId,
            action,
            resource: `${resource}:${resourceId}`,
            resourceId,
            result: granted ? types_1.AuditResult.SUCCESS : types_1.AuditResult.DENIED,
            ipAddress,
            userAgent,
            errorMessage: granted ? undefined : reason,
            metadata: { granted, reason },
        });
    }
    /**
     * Log security events (unauthorized access, invalid tokens, etc.)
     */
    async logSecurityEvent(userId, action, resource, errorMessage, ipAddress, userAgent) {
        await this.log({
            userId,
            action,
            resource,
            result: types_1.AuditResult.FAILURE,
            ipAddress,
            userAgent,
            errorMessage,
        });
    }
    /**
     * Retrieve audit logs by user ID
     */
    async getLogsByUserId(userId, limit = 100) {
        try {
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving audit logs by user:', error);
            throw error;
        }
    }
    /**
     * Retrieve audit logs by action type
     */
    async getLogsByAction(action, limit = 100) {
        try {
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('action', '==', action)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving audit logs by action:', error);
            throw error;
        }
    }
    /**
     * Retrieve audit logs within a date range
     */
    async getLogsByDateRange(startDate, endDate, limit = 1000) {
        try {
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('timestamp', '>=', startDate)
                .where('timestamp', '<=', endDate)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving audit logs by date range:', error);
            throw error;
        }
    }
    /**
     * Retrieve failed authorization attempts
     */
    async getFailedAuthorizationAttempts(limit = 100) {
        try {
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('result', '==', types_1.AuditResult.DENIED)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving failed authorization attempts:', error);
            throw error;
        }
    }
    /**
     * Retrieve audit logs for a specific resource
     */
    async getLogsByResource(resource, limit = 100) {
        try {
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('resource', '==', resource)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving audit logs by resource:', error);
            throw error;
        }
    }
    /**
     * Retrieve security events (failed logins, unauthorized access, etc.)
     */
    async getSecurityEvents(limit = 100) {
        try {
            const securityActions = [
                types_1.AuditAction.LOGIN_FAILED,
                types_1.AuditAction.UNAUTHORIZED_ACCESS,
                types_1.AuditAction.PERMISSION_DENIED,
                types_1.AuditAction.INVALID_TOKEN,
                types_1.AuditAction.ACCESS_PATIENT_DENIED,
            ];
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('action', 'in', securityActions)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving security events:', error);
            throw error;
        }
    }
    /**
     * Get recent logs for a patient (all actions related to a patient)
     */
    async getPatientActivityLogs(patientId, limit = 100) {
        try {
            const snapshot = await this.db
                .collection(firebase_1.COLLECTIONS.AUDIT_LOGS)
                .where('resourceId', '==', patientId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }));
        }
        catch (error) {
            console.error('Error retrieving patient activity logs:', error);
            throw error;
        }
    }
}
exports.AuditService = AuditService;
