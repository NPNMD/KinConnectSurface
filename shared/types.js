"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditResult = exports.AuditAction = void 0;
// Audit Log types
var AuditAction;
(function (AuditAction) {
    // Authentication events
    AuditAction["LOGIN"] = "LOGIN";
    AuditAction["LOGOUT"] = "LOGOUT";
    AuditAction["LOGIN_FAILED"] = "LOGIN_FAILED";
    AuditAction["TOKEN_REFRESH"] = "TOKEN_REFRESH";
    AuditAction["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    // Patient access events
    AuditAction["ACCESS_PATIENT"] = "ACCESS_PATIENT";
    AuditAction["ACCESS_PATIENT_DENIED"] = "ACCESS_PATIENT_DENIED";
    AuditAction["VIEW_PATIENT_PROFILE"] = "VIEW_PATIENT_PROFILE";
    // Medication events
    AuditAction["CREATE_MEDICATION"] = "CREATE_MEDICATION";
    AuditAction["UPDATE_MEDICATION"] = "UPDATE_MEDICATION";
    AuditAction["DELETE_MEDICATION"] = "DELETE_MEDICATION";
    AuditAction["VIEW_MEDICATIONS"] = "VIEW_MEDICATIONS";
    AuditAction["MODIFY_MEDICATION"] = "MODIFY_MEDICATION";
    AuditAction["LOG_MEDICATION_TAKEN"] = "LOG_MEDICATION_TAKEN";
    // Patient data events
    AuditAction["CREATE_PATIENT"] = "CREATE_PATIENT";
    AuditAction["UPDATE_PATIENT"] = "UPDATE_PATIENT";
    AuditAction["DELETE_PATIENT"] = "DELETE_PATIENT";
    // Family group events
    AuditAction["CREATE_FAMILY_GROUP"] = "CREATE_FAMILY_GROUP";
    AuditAction["ADD_FAMILY_MEMBER"] = "ADD_FAMILY_MEMBER";
    AuditAction["REMOVE_FAMILY_MEMBER"] = "REMOVE_FAMILY_MEMBER";
    AuditAction["UPDATE_FAMILY_PERMISSIONS"] = "UPDATE_FAMILY_PERMISSIONS";
    // Invitation events
    AuditAction["CREATE_INVITATION"] = "CREATE_INVITATION";
    AuditAction["ACCEPT_INVITATION"] = "ACCEPT_INVITATION";
    AuditAction["REJECT_INVITATION"] = "REJECT_INVITATION";
    // Appointment events
    AuditAction["CREATE_APPOINTMENT"] = "CREATE_APPOINTMENT";
    AuditAction["UPDATE_APPOINTMENT"] = "UPDATE_APPOINTMENT";
    AuditAction["DELETE_APPOINTMENT"] = "DELETE_APPOINTMENT";
    // Visit record events
    AuditAction["CREATE_VISIT_RECORD"] = "CREATE_VISIT_RECORD";
    AuditAction["UPDATE_VISIT_RECORD"] = "UPDATE_VISIT_RECORD";
    AuditAction["DELETE_VISIT_RECORD"] = "DELETE_VISIT_RECORD";
    // Task events
    AuditAction["CREATE_TASK"] = "CREATE_TASK";
    AuditAction["UPDATE_TASK"] = "UPDATE_TASK";
    AuditAction["DELETE_TASK"] = "DELETE_TASK";
    // Security events
    AuditAction["UNAUTHORIZED_ACCESS"] = "UNAUTHORIZED_ACCESS";
    AuditAction["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    AuditAction["INVALID_TOKEN"] = "INVALID_TOKEN";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
var AuditResult;
(function (AuditResult) {
    AuditResult["SUCCESS"] = "SUCCESS";
    AuditResult["FAILURE"] = "FAILURE";
    AuditResult["DENIED"] = "DENIED";
})(AuditResult || (exports.AuditResult = AuditResult = {}));
