import { PatientService } from '../patientService';
import { createMockFirestoreDb, mockConsole, testFixtures } from '../../__tests__/testUtils';

mockConsole();

describe('PatientService', () => {
  let service: PatientService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockFirestoreDb();
    service = new PatientService({ db: mockDb });
    jest.clearAllMocks();
  });

  describe('createPatient', () => {
    it('should create a new patient successfully', async () => {
      const newPatient = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        email: 'john@example.com'
      };

      const result = await service.createPatient(newPatient as any);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockDb._mockDoc.set).toHaveBeenCalled();
    });

    it('should handle errors during patient creation', async () => {
      mockDb._mockDoc.set = jest.fn().mockRejectedValue(new Error('DB Error'));

      const result = await service.createPatient({} as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create patient');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getPatientById', () => {
    it('should retrieve a patient by ID', async () => {
      mockDb._mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => testFixtures.patient
      });

      const result = await service.getPatientById('patient-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testFixtures.patient);
    });

    it('should return null if patient not found', async () => {
      mockDb._mockDoc.get.mockResolvedValue({
        exists: false
      });

      const result = await service.getPatientById('nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle errors', async () => {
      mockDb._mockDoc.get.mockRejectedValue(new Error('DB Error'));

      const result = await service.getPatientById('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get patient');
    });
  });

  describe('getPatientByUserId', () => {
    it('should retrieve patient by user ID', async () => {
      mockDb._mockCollection.get.mockResolvedValue({
        empty: false,
        docs: [{
          data: () => testFixtures.patient
        }]
      });

      const result = await service.getPatientByUserId('user-123');

      expect(mockDb._mockCollection.where).toHaveBeenCalledWith('userId', '==', 'user-123');
      expect(mockDb._mockCollection.limit).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testFixtures.patient);
    });

    it('should return null if no patient found', async () => {
      mockDb._mockCollection.get.mockResolvedValue({
        empty: true,
        docs: []
      });

      const result = await service.getPatientByUserId('user-456');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('updatePatient', () => {
    it('should update patient successfully', async () => {
      const updates = {
        phoneNumber: '555-9999',
        address: '456 New St'
      };

      mockDb._mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({ ...testFixtures.patient, ...updates })
      });

      const result = await service.updatePatient('patient-123', updates);

      expect(mockDb._mockDoc.update).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data?.phoneNumber).toBe('555-9999');
    });

    it('should handle update errors', async () => {
      mockDb._mockDoc.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.updatePatient('patient-123', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update patient');
    });
  });

  describe('deletePatient', () => {
    it('should delete patient successfully', async () => {
      const result = await service.deletePatient('patient-123');

      expect(mockDb._mockDoc.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should handle delete errors', async () => {
      mockDb._mockDoc.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await service.deletePatient('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete patient');
    });
  });

  describe('getPatients', () => {
    it('should retrieve paginated patients', async () => {
      const patients = [testFixtures.patient];
      mockDb._mockCollection.get.mockResolvedValue({
        docs: patients.map(p => ({ data: () => p }))
      });

      const result = await service.getPatients(1, 20);

      expect(mockDb._mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockDb._mockCollection.limit).toHaveBeenCalledWith(20);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should handle pagination correctly', async () => {
      mockDb._mockCollection.get.mockResolvedValue({ docs: [] });

      await service.getPatients(2, 10);

      expect(mockDb._mockCollection.offset).toHaveBeenCalledWith(10);
    });
  });

  describe('searchPatientsByCondition', () => {
    it('should search patients by medical condition', async () => {
      mockDb._mockCollection.get.mockResolvedValue({
        docs: [{ data: () => testFixtures.patient }]
      });

      const result = await service.searchPatientsByCondition('Hypertension');

      expect(mockDb._mockCollection.where).toHaveBeenCalledWith(
        'medicalConditions',
        'array-contains',
        'Hypertension'
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should handle search errors', async () => {
      mockDb._mockCollection.get.mockRejectedValue(new Error('Search failed'));

      const result = await service.searchPatientsByCondition('Diabetes');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to search patients by condition');
    });
  });

  describe('searchPatientsByAllergy', () => {
    it('should search patients by allergy', async () => {
      mockDb._mockCollection.get.mockResolvedValue({
        docs: [{ data: () => testFixtures.patient }]
      });

      const result = await service.searchPatientsByAllergy('Penicillin');

      expect(mockDb._mockCollection.where).toHaveBeenCalledWith(
        'allergies',
        'array-contains',
        'Penicillin'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getPatientsByAgeRange', () => {
    it('should get patients by age range', async () => {
      mockDb._mockCollection.get.mockResolvedValue({
        docs: [{ data: () => testFixtures.patient }]
      });

      const result = await service.getPatientsByAgeRange(25, 45);

      expect(mockDb._mockCollection.where).toHaveBeenCalled();
      expect(mockDb._mockCollection.limit).toHaveBeenCalledWith(50);
      expect(result.success).toBe(true);
    });

    it('should calculate date range correctly', async () => {
      const now = new Date();
      mockDb._mockCollection.get.mockResolvedValue({ docs: [] });

      await service.getPatientsByAgeRange(30, 40);

      const wereCallArgs = mockDb._mockCollection.where.mock.calls;
      expect(wereCallArgs.length).toBeGreaterThan(0);
    });
  });
});
