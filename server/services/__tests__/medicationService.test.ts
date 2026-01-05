import { MedicationService } from '../../../shared/services/medicationService';

// Mock Firestore
const mockDb = {
  collection: jest.fn(() => ({
    where: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          docs: [
            {
              id: 'med1',
              data: () => ({
                patientId: 'patient123',
                name: 'Aspirin',
                dosage: '81mg',
                createdAt: { toDate: () => new Date() },
                takenAt: { toDate: () => new Date() } // for logs
              })
            }
          ]
        }))
      })),
      get: jest.fn(() => Promise.resolve({
        docs: [
          {
            id: 'med1',
            data: () => ({
              patientId: 'patient123',
              name: 'Aspirin',
              dosage: '81mg',
              createdAt: { toDate: () => new Date() }
            })
          }
        ]
      }))
    })),
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({
        exists: true,
        id: 'med1',
        data: () => ({
          patientId: 'patient123',
          name: 'Aspirin'
        })
      })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve())
    })),
    add: jest.fn(() => Promise.resolve({
      id: 'new-med-id'
    }))
  }))
};

describe('MedicationService', () => {
  let service: MedicationService;
  
  beforeEach(() => {
    service = new MedicationService({ db: mockDb });
    jest.clearAllMocks();
  });
  
  describe('getMedicationsByPatientId', () => {
    it('should return medications for a patient', async () => {
      const result = await service.getMedicationsByPatientId('patient123');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Aspirin');
    });
    
    it('should return empty array for patient with no medications', async () => {
      mockDb.collection().where().get.mockResolvedValueOnce({ docs: [] });
      
      const result = await service.getMedicationsByPatientId('patient456');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });
  
  describe('createMedication', () => {
    it('should create a new medication', async () => {
      const medData = {
        patientId: 'patient123',
        name: 'Ibuprofen',
        dosage: '200mg',
        frequency: 'Twice daily',
        instructions: 'Take with food',
        prescribedBy: 'Dr. Smith',
        prescribedDate: new Date(),
        isActive: true
      };
      
      // Mock doc().set() implementation since createMedication uses set on a doc ref
      const mockDocRef = {
        id: 'new-med-id',
        set: jest.fn().mockResolvedValue(undefined)
      };
      mockDb.collection().doc.mockReturnValueOnce(mockDocRef);

      const result = await service.createMedication(medData as any);
      
      expect(result.success).toBe(true);
      expect(mockDocRef.set).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      const mockDocRef = {
        id: 'new-med-id',
        set: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      mockDb.collection().doc.mockReturnValueOnce(mockDocRef);
      
      const result = await service.createMedication({} as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

