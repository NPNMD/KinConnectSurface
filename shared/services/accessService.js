"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessService = void 0;
const firebase_1 = require("../firebase");
const types_1 = require("../types");
class AccessService {
    db;
    auditService;
    constructor(deps) {
        this.db = deps.db;
        this.auditService = deps.auditService;
    }
    /**
     * Checks if a user has access to a patient's data.
     * Access is granted if:
     * 1. The user IS the patient (userId === patientId)
     * 2. The user is in the same family group as the patient
     */
    async canAccessPatient(userId, targetPatientId) {
        // If user is accessing their own data, grant access immediately
        if (userId === targetPatientId) {
            // Log successful access (user accessing their own data)
            if (this.auditService) {
                await this.auditService.logPatientAccess(userId, targetPatientId, types_1.AuditAction.ACCESS_PATIENT, types_1.AuditResult.SUCCESS, { reason: 'Self-access', isSelfAccess: true });
            }
            return true;
        }
        try {
            // 1. Get the requesting user's familyGroupId
            const userDoc = await this.db.collection(firebase_1.COLLECTIONS.USERS).doc(userId).get();
            if (!userDoc.exists) {
                // Log denied access - user not found
                if (this.auditService) {
                    await this.auditService.logPatientAccessDenied(userId, targetPatientId, 'Requesting user not found');
                }
                return false;
            }
            const userData = userDoc.data();
            const userFamilyGroupId = userData?.familyGroupId;
            if (!userFamilyGroupId) {
                // Log denied access - no family group
                if (this.auditService) {
                    await this.auditService.logPatientAccessDenied(userId, targetPatientId, 'User not in any family group');
                }
                return false;
            }
            // 2. Get the target patient's familyGroupId
            let targetUserUid = targetPatientId;
            // Check if targetPatientId is a user ID or patient profile ID
            const targetUserDoc = await this.db.collection(firebase_1.COLLECTIONS.USERS).doc(targetPatientId).get();
            if (!targetUserDoc.exists) {
                // Try finding patient by ID to get the userId
                const patientDoc = await this.db.collection(firebase_1.COLLECTIONS.PATIENTS).doc(targetPatientId).get();
                if (patientDoc.exists) {
                    targetUserUid = patientDoc.data()?.userId;
                }
                else {
                    // Log denied access - target patient not found
                    if (this.auditService) {
                        await this.auditService.logPatientAccessDenied(userId, targetPatientId, 'Target patient not found');
                    }
                    return false;
                }
            }
            // Now we have the target user's UID (targetUserUid)
            let targetFamilyGroupId;
            if (targetUserDoc.exists) {
                targetFamilyGroupId = targetUserDoc.data()?.familyGroupId;
            }
            else {
                const uDoc = await this.db.collection(firebase_1.COLLECTIONS.USERS).doc(targetUserUid).get();
                targetFamilyGroupId = uDoc.data()?.familyGroupId;
            }
            const hasAccess = userFamilyGroupId === targetFamilyGroupId;
            // Log the access attempt result
            if (this.auditService) {
                if (hasAccess) {
                    await this.auditService.logPatientAccess(userId, targetPatientId, types_1.AuditAction.ACCESS_PATIENT, types_1.AuditResult.SUCCESS, {
                        reason: 'Family group access',
                        userFamilyGroupId,
                        targetFamilyGroupId
                    });
                }
                else {
                    await this.auditService.logPatientAccessDenied(userId, targetPatientId, 'User and patient not in same family group');
                }
            }
            return hasAccess;
        }
        catch (error) {
            console.error('Error checking access:', error);
            // Log the error
            if (this.auditService) {
                await this.auditService.logPatientAccessDenied(userId, targetPatientId, `Access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return false;
        }
    }
}
exports.AccessService = AccessService;
