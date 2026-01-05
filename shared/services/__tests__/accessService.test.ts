import { AccessService } from '../accessService';
import { AuditService } from '../auditService';
import { createMockFirestoreDb, mockConsole } from '../../__tests__/testUtils';
import { AuditAction, AuditResult } from '../../types';

mockConsole();

describe('AccessService', () => {
  let service: AccessService;
  let mockDb: any;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    mockDb = createMockFirestoreDb();
    mockAuditService = {
      logPatientAccess: jest.fn(),
      logPatientAccessDenied: jest.fn()
    } as any;

    service = new AccessService({ db: mockDb, auditService: mockAuditService });
    jest.clearAllMocks();
  });

  describe('canAccessPatient - Self Access', () => {
    it('should grant access when user accesses their own data', async () => {
      const hasAccess = await service.canAccessPatient('user-123', 'user-123');

      expect(hasAccess).toBe(true);
      expect(mockAuditService.logPatientAccess).toHaveBeenCalledWith(
        'user-123',
        'user-123',
        AuditAction.ACCESS_PATIENT,
        AuditResult.SUCCESS,
        expect.objectContaining({ isSelfAccess: true })
      );
    });
  });

  describe('canAccessPatient - Family Group Access', () => {
    it('should grant access to users in same family group', async () => {
      const mockUserData = { familyGroupId: 'family-123' };
      const mockTargetUserData = { familyGroupId: 'family-123' };

      mockDb._mockDoc.get
        .mockResolvedValueOnce({ exists: true, data: () => mockUserData }) // requesting user
        .mockResolvedValueOnce({ exists: true, data: () => mockTargetUserData }); // target user

      const hasAccess = await service.canAccessPatient('user-123', 'user-456');

      expect(hasAccess).toBe(true);
      expect(mockAuditService.logPatientAccess).toHaveBeenCalledWith(
        'user-123',
        'user-456',
        AuditAction.ACCESS_PATIENT,
        AuditResult.SUCCESS,
        expect.objectContaining({ reason: 'Family group access' })
      );
    });

    it('should deny access to users in different family groups', async () => {
      const mockUserData = { familyGroupId: 'family-123' };
      const mockTargetUserData = { familyGroupId: 'family-456' };

      mockDb._mockDoc.get
        .mockResolvedValueOnce({ exists: true, data: () => mockUserData })
        .mockResolvedValueOnce({ exists: true, data: () => mockTargetUserData });

      const hasAccess = await service.canAccessPatient('user-123', 'user-456');

      expect(hasAccess).toBe(false);
      expect(mockAuditService.logPatientAccessDenied).toHaveBeenCalledWith(
        'user-123',
        'user-456',
        'User and patient not in same family group'
      );
    });

    it('should deny access when user not found', async () => {
      mockDb._mockDoc.get.mockResolvedValueOnce({ exists: false });

      const hasAccess = await service.canAccessPatient('nonexistent', 'user-456');

      expect(hasAccess).toBe(false);
      expect(mockAuditService.logPatientAccessDenied).toHaveBeenCalledWith(
        'nonexistent',
        'user-456',
        'Requesting user not found'
      );
    });

    it('should deny access when user has no family group', async () => {
      const mockUserData = { familyGroupId: null };

      mockDb._mockDoc.get.mockResolvedValueOnce({ exists: true, data: () => mockUserData });

      const hasAccess = await service.canAccessPatient('user-123', 'user-456');

      expect(hasAccess).toBe(false);
      expect(mockAuditService.logPatientAccessDenied).toHaveBeenCalledWith(
        'user-123',
        'user-456',
        'User not in any family group'
      );
    });
  });

  describe('canAccessPatient - Patient Profile Access', () => {
    it('should handle access to patient profile by ID', async () => {
      const mockUserData = { familyGroupId: 'family-123' };
      const mockPatientData = { userId: 'patient-user-id' };
      const mockPatientUserData = { familyGroupId: 'family-123' };

      mockDb._mockDoc.get
        .mockResolvedValueOnce({ exists: true, data: () => mockUserData }) // requesting user
        .mockResolvedValueOnce({ exists: false }) // target patient ID as user (not exists)
        .mockResolvedValueOnce({ exists: true, data: () => mockPatientData }) // patient profile
        .mockResolvedValueOnce({ exists: true, data: () => mockPatientUserData }); // patient's user record

      const hasAccess = await service.canAccessPatient('user-123', 'patient-456');

      expect(hasAccess).toBe(true);
    });

    it('should deny access when patient not found', async () => {
      const mockUserData = { familyGroupId: 'family-123' };

      mockDb._mockDoc.get
        .mockResolvedValueOnce({ exists: true, data: () => mockUserData }) // requesting user
        .mockResolvedValueOnce({ exists: false }) // target as user
        .mockResolvedValueOnce({ exists: false }); // target as patient

      const hasAccess = await service.canAccessPatient('user-123', 'nonexistent');

      expect(hasAccess).toBe(false);
      expect(mockAuditService.logPatientAccessDenied).toHaveBeenCalledWith(
        'user-123',
        'nonexistent',
        'Target patient not found'
      );
    });
  });

  describe('canAccessPatient - Error Handling', () => {
    it('should deny access and log error on exception', async () => {
      mockDb._mockDoc.get.mockRejectedValue(new Error('Database error'));

      const hasAccess = await service.canAccessPatient('user-123', 'user-456');

      expect(hasAccess).toBe(false);
      expect(mockAuditService.logPatientAccessDenied).toHaveBeenCalledWith(
        'user-123',
        'user-456',
        expect.stringContaining('Database error')
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('canAccessPatient - Without Audit Service', () => {
    it('should work without audit service', async () => {
      const serviceWithoutAudit = new AccessService({ db: mockDb });

      const hasAccess = await serviceWithoutAudit.canAccessPatient('user-123', 'user-123');

      expect(hasAccess).toBe(true);
    });
  });
});
