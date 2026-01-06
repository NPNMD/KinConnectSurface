"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auditService_1 = require("../auditService");
const types_1 = require("../../types");
const testUtils_1 = require("../../__tests__/testUtils");
(0, testUtils_1.mockConsole)();
describe('AuditService', () => {
    let service;
    let mockDb;
    beforeEach(() => {
        mockDb = (0, testUtils_1.createMockFirestoreDb)();
        service = new auditService_1.AuditService({ db: mockDb });
        jest.clearAllMocks();
    });
    describe('log', () => {
        it('should log an audit event with timestamp', async () => {
            const auditLog = {
                userId: 'user-123',
                action: types_1.AuditAction.LOGIN,
                resource: 'user:user-123',
                result: types_1.AuditResult.SUCCESS
            };
            await service.log(auditLog);
            expect(mockDb.collection).toHaveBeenCalledWith('audit_logs');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('user-123');
            expect(addedData.action).toBe(types_1.AuditAction.LOGIN);
            expect(addedData.timestamp).toBeInstanceOf(Date);
            expect(addedData.createdAt).toBeInstanceOf(Date);
        });
        it('should not throw on error - non-blocking', async () => {
            mockDb._mockCollection.add = jest.fn().mockRejectedValue(new Error('DB Error'));
            const auditLog = {
                userId: 'user-123',
                action: types_1.AuditAction.LOGIN,
                resource: 'user:user-123',
                result: types_1.AuditResult.SUCCESS
            };
            await expect(service.log(auditLog)).resolves.not.toThrow();
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('logLogin', () => {
        it('should log successful login', async () => {
            await service.logLogin('user-123', 'test@example.com', '127.0.0.1', 'Mozilla/5.0');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('user-123');
            expect(addedData.userEmail).toBe('test@example.com');
            expect(addedData.action).toBe(types_1.AuditAction.LOGIN);
            expect(addedData.result).toBe(types_1.AuditResult.SUCCESS);
            expect(addedData.ipAddress).toBe('127.0.0.1');
            expect(addedData.userAgent).toBe('Mozilla/5.0');
        });
        it('should work without optional parameters', async () => {
            await service.logLogin('user-123');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('user-123');
            expect(addedData.ipAddress).toBeUndefined();
        });
    });
    describe('logLoginFailed', () => {
        it('should log failed login attempt', async () => {
            await service.logLoginFailed('test@example.com', 'Invalid password', '127.0.0.1');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('anonymous');
            expect(addedData.userEmail).toBe('test@example.com');
            expect(addedData.action).toBe(types_1.AuditAction.LOGIN_FAILED);
            expect(addedData.result).toBe(types_1.AuditResult.FAILURE);
            expect(addedData.errorMessage).toBe('Invalid password');
        });
    });
    describe('logLogout', () => {
        it('should log logout event', async () => {
            await service.logLogout('user-123', 'test@example.com');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('user-123');
            expect(addedData.action).toBe(types_1.AuditAction.LOGOUT);
            expect(addedData.result).toBe(types_1.AuditResult.SUCCESS);
        });
    });
    describe('logPatientAccess', () => {
        it('should log patient data access', async () => {
            await service.logPatientAccess('user-123', 'patient-456', types_1.AuditAction.ACCESS_PATIENT, types_1.AuditResult.SUCCESS, { reason: 'View profile' });
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('user-123');
            expect(addedData.resource).toBe('patient:patient-456');
            expect(addedData.resourceId).toBe('patient-456');
            expect(addedData.action).toBe(types_1.AuditAction.ACCESS_PATIENT);
            expect(addedData.result).toBe(types_1.AuditResult.SUCCESS);
            expect(addedData.metadata).toEqual({ reason: 'View profile' });
        });
    });
    describe('logPatientAccessDenied', () => {
        it('should log denied patient access', async () => {
            await service.logPatientAccessDenied('user-123', 'patient-456', 'Not in same family group');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.userId).toBe('user-123');
            expect(addedData.resource).toBe('patient:patient-456');
            expect(addedData.action).toBe(types_1.AuditAction.ACCESS_PATIENT_DENIED);
            expect(addedData.result).toBe(types_1.AuditResult.DENIED);
            expect(addedData.errorMessage).toBe('Not in same family group');
        });
    });
    describe('logMedicationOperation', () => {
        it('should log medication operations', async () => {
            await service.logMedicationOperation('user-123', 'med-456', types_1.AuditAction.UPDATE_MEDICATION, types_1.AuditResult.SUCCESS);
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.resource).toBe('medication:med-456');
            expect(addedData.action).toBe(types_1.AuditAction.UPDATE_MEDICATION);
        });
    });
    describe('logAuthorizationCheck', () => {
        it('should log successful authorization', async () => {
            await service.logAuthorizationCheck('user-123', 'patient', 'patient-456', types_1.AuditAction.ACCESS_PATIENT, true);
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.result).toBe(types_1.AuditResult.SUCCESS);
            expect(addedData.metadata.granted).toBe(true);
        });
        it('should log denied authorization', async () => {
            await service.logAuthorizationCheck('user-123', 'patient', 'patient-456', types_1.AuditAction.ACCESS_PATIENT, false, 'Access denied');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.result).toBe(types_1.AuditResult.DENIED);
            expect(addedData.errorMessage).toBe('Access denied');
            expect(addedData.metadata.granted).toBe(false);
        });
    });
    describe('logSecurityEvent', () => {
        it('should log security events', async () => {
            await service.logSecurityEvent('user-123', types_1.AuditAction.INVALID_TOKEN, 'api', 'Token expired');
            expect(mockDb._mockCollection.add).toHaveBeenCalled();
            const addedData = mockDb._mockCollection.add.mock.calls[0][0];
            expect(addedData.action).toBe(types_1.AuditAction.INVALID_TOKEN);
            expect(addedData.result).toBe(types_1.AuditResult.FAILURE);
            expect(addedData.errorMessage).toBe('Token expired');
        });
    });
    describe('getLogsByUserId', () => {
        it('should retrieve logs for a user', async () => {
            const mockDocs = [
                {
                    id: 'log1',
                    data: () => ({
                        userId: 'user-123',
                        action: types_1.AuditAction.LOGIN,
                        timestamp: { toDate: () => new Date() },
                        createdAt: { toDate: () => new Date() }
                    })
                }
            ];
            mockDb._mockCollection.get.mockResolvedValue({ docs: mockDocs });
            const logs = await service.getLogsByUserId('user-123', 50);
            expect(mockDb.collection).toHaveBeenCalledWith('audit_logs');
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('userId', '==', 'user-123');
            expect(mockDb._mockCollection.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
            expect(mockDb._mockCollection.limit).toHaveBeenCalledWith(50);
            expect(logs).toHaveLength(1);
            expect(logs[0].id).toBe('log1');
        });
        it('should handle errors', async () => {
            mockDb._mockCollection.get.mockRejectedValue(new Error('DB Error'));
            await expect(service.getLogsByUserId('user-123')).rejects.toThrow('DB Error');
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('getLogsByAction', () => {
        it('should retrieve logs by action type', async () => {
            const mockDocs = [
                {
                    id: 'log1',
                    data: () => ({
                        action: types_1.AuditAction.LOGIN,
                        timestamp: { toDate: () => new Date() },
                        createdAt: { toDate: () => new Date() }
                    })
                }
            ];
            mockDb._mockCollection.get.mockResolvedValue({ docs: mockDocs });
            const logs = await service.getLogsByAction(types_1.AuditAction.LOGIN);
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('action', '==', types_1.AuditAction.LOGIN);
            expect(logs).toHaveLength(1);
        });
    });
    describe('getLogsByDateRange', () => {
        it('should retrieve logs within date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');
            mockDb._mockCollection.get.mockResolvedValue({ docs: [] });
            await service.getLogsByDateRange(startDate, endDate, 500);
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('timestamp', '>=', startDate);
            expect(mockDb._mockCollection.limit).toHaveBeenCalledWith(500);
        });
    });
    describe('getFailedAuthorizationAttempts', () => {
        it('should retrieve failed authorization attempts', async () => {
            mockDb._mockCollection.get.mockResolvedValue({ docs: [] });
            await service.getFailedAuthorizationAttempts(25);
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('result', '==', types_1.AuditResult.DENIED);
            expect(mockDb._mockCollection.limit).toHaveBeenCalledWith(25);
        });
    });
    describe('getLogsByResource', () => {
        it('should retrieve logs for a specific resource', async () => {
            mockDb._mockCollection.get.mockResolvedValue({ docs: [] });
            await service.getLogsByResource('patient:patient-123');
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('resource', '==', 'patient:patient-123');
        });
    });
    describe('getSecurityEvents', () => {
        it('should retrieve security events', async () => {
            mockDb._mockCollection.get.mockResolvedValue({ docs: [] });
            await service.getSecurityEvents();
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('action', 'in', expect.arrayContaining([
                types_1.AuditAction.LOGIN_FAILED,
                types_1.AuditAction.UNAUTHORIZED_ACCESS,
                types_1.AuditAction.INVALID_TOKEN
            ]));
        });
        it('should handle errors', async () => {
            mockDb._mockCollection.get.mockRejectedValue(new Error('DB Error'));
            await expect(service.getSecurityEvents()).rejects.toThrow();
            expect(console.error).toHaveBeenCalled();
        });
    });
    describe('getPatientActivityLogs', () => {
        it('should retrieve activity logs for a patient', async () => {
            mockDb._mockCollection.get.mockResolvedValue({ docs: [] });
            await service.getPatientActivityLogs('patient-123');
            expect(mockDb._mockCollection.where).toHaveBeenCalledWith('resourceId', '==', 'patient-123');
            expect(mockDb._mockCollection.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
        });
    });
});
