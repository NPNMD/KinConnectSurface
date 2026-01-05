import { COLLECTIONS } from '../firebase';
import { AuditAction, AuditResult, NewAuditLog, AuditLog } from '../types';

interface AuditServiceDeps {
  db: any;
}

export class AuditService {
  private db: any;

  constructor(deps: AuditServiceDeps) {
    this.db = deps.db;
  }

  /**
   * Log an audit event. This method is non-blocking - failures are logged but don't throw.
   * @param auditLog - The audit log data to record
   */
  async log(auditLog: NewAuditLog): Promise<void> {
    try {
      const timestamp = new Date();
      const auditLogData = {
        ...auditLog,
        timestamp,
        createdAt: timestamp,
      };

      await this.db.collection(COLLECTIONS.AUDIT_LOGS).add(auditLogData);
    } catch (error) {
      // Log error but don't throw - audit logging should never break the application
      console.error('Failed to write audit log:', error);
      console.error('Audit log data:', auditLog);
    }
  }

  /**
   * Log a successful authentication event
   */
  async logLogin(userId: string, userEmail?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      userEmail,
      action: AuditAction.LOGIN,
      resource: `user:${userId}`,
      resourceId: userId,
      result: AuditResult.SUCCESS,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a failed authentication attempt
   */
  async logLoginFailed(email: string, reason: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId: 'anonymous',
      userEmail: email,
      action: AuditAction.LOGIN_FAILED,
      resource: `login:${email}`,
      result: AuditResult.FAILURE,
      ipAddress,
      userAgent,
      errorMessage: reason,
    });
  }

  /**
   * Log a logout event
   */
  async logLogout(userId: string, userEmail?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      userEmail,
      action: AuditAction.LOGOUT,
      resource: `user:${userId}`,
      resourceId: userId,
      result: AuditResult.SUCCESS,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log successful patient data access
   */
  async logPatientAccess(
    userId: string,
    patientId: string,
    action: AuditAction,
    result: AuditResult,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
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
  async logPatientAccessDenied(
    userId: string,
    patientId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.ACCESS_PATIENT_DENIED,
      resource: `patient:${patientId}`,
      resourceId: patientId,
      result: AuditResult.DENIED,
      ipAddress,
      userAgent,
      errorMessage: reason,
      metadata: { reason },
    });
  }

  /**
   * Log medication operations
   */
  async logMedicationOperation(
    userId: string,
    medicationId: string,
    action: AuditAction,
    result: AuditResult,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
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
  async logAuthorizationCheck(
    userId: string,
    resource: string,
    resourceId: string,
    action: AuditAction,
    granted: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: `${resource}:${resourceId}`,
      resourceId,
      result: granted ? AuditResult.SUCCESS : AuditResult.DENIED,
      ipAddress,
      userAgent,
      errorMessage: granted ? undefined : reason,
      metadata: { granted, reason },
    });
  }

  /**
   * Log security events (unauthorized access, invalid tokens, etc.)
   */
  async logSecurityEvent(
    userId: string,
    action: AuditAction,
    resource: string,
    errorMessage: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      result: AuditResult.FAILURE,
      ipAddress,
      userAgent,
      errorMessage,
    });
  }

  /**
   * Retrieve audit logs by user ID
   */
  async getLogsByUserId(userId: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving audit logs by user:', error);
      throw error;
    }
  }

  /**
   * Retrieve audit logs by action type
   */
  async getLogsByAction(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('action', '==', action)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving audit logs by action:', error);
      throw error;
    }
  }

  /**
   * Retrieve audit logs within a date range
   */
  async getLogsByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<AuditLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving audit logs by date range:', error);
      throw error;
    }
  }

  /**
   * Retrieve failed authorization attempts
   */
  async getFailedAuthorizationAttempts(limit: number = 100): Promise<AuditLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('result', '==', AuditResult.DENIED)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving failed authorization attempts:', error);
      throw error;
    }
  }

  /**
   * Retrieve audit logs for a specific resource
   */
  async getLogsByResource(resource: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('resource', '==', resource)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving audit logs by resource:', error);
      throw error;
    }
  }

  /**
   * Retrieve security events (failed logins, unauthorized access, etc.)
   */
  async getSecurityEvents(limit: number = 100): Promise<AuditLog[]> {
    try {
      const securityActions = [
        AuditAction.LOGIN_FAILED,
        AuditAction.UNAUTHORIZED_ACCESS,
        AuditAction.PERMISSION_DENIED,
        AuditAction.INVALID_TOKEN,
        AuditAction.ACCESS_PATIENT_DENIED,
      ];

      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('action', 'in', securityActions)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving security events:', error);
      throw error;
    }
  }

  /**
   * Get recent logs for a patient (all actions related to a patient)
   */
  async getPatientActivityLogs(patientId: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const snapshot = await this.db
        .collection(COLLECTIONS.AUDIT_LOGS)
        .where('resourceId', '==', patientId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
    } catch (error) {
      console.error('Error retrieving patient activity logs:', error);
      throw error;
    }
  }
}
