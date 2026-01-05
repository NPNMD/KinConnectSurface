import request from 'supertest';
import express from 'express';
import { createMedicationRouter } from '../../../shared/routes/medications';

// Mock dependencies
const mockMedicationService = {
  getMedicationsByPatientId: jest.fn(),
  getMedicationById: jest.fn(),
  createMedication: jest.fn(),
  updateMedication: jest.fn(),
  deleteMedication: jest.fn(),
  getActiveMedicationsByPatientId: jest.fn(),
  searchMedicationsByName: jest.fn(),
  getMedicationLogsByPatientId: jest.fn(),
  getMedicationLogsByMedicationId: jest.fn(),
  createMedicationLog: jest.fn(),
  updateMedicationLog: jest.fn(),
  deleteMedicationLog: jest.fn(),
  getMedicationRemindersByPatientId: jest.fn(),
  getMedicationRemindersByMedicationId: jest.fn(),
  createMedicationReminder: jest.fn(),
  updateMedicationReminder: jest.fn(),
  deleteMedicationReminder: jest.fn()
};

const mockAccessService = {
  canAccessPatient: jest.fn()
};

const mockAuthenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }
  req.user = { uid: 'user123', email: 'test@example.com' };
  next();
};

describe('Medications API', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/medications', createMedicationRouter(
      mockMedicationService as any,
      mockAccessService as any,
      mockAuthenticateToken
    ));
    jest.clearAllMocks();
  });
  
  describe('GET /medications', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/medications');
      expect(response.status).toBe(401);
    });
    
    it('should return medications for authenticated user', async () => {
      mockMedicationService.getMedicationsByPatientId.mockResolvedValue({
        success: true,
        data: [{ id: 'med1', name: 'Aspirin' }]
      });

      const response = await request(app)
        .get('/medications')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
  
  describe('POST /medications', () => {
    it('should create medication with valid data', async () => {
      const medicationData = {
        name: 'Test Med',
        dosage: '10mg',
        frequency: 'Daily',
        instructions: 'Take with water',
        prescribedBy: 'Dr. Test',
        prescribedDate: new Date().toISOString(),
        isActive: true
      };

      mockMedicationService.createMedication.mockResolvedValue({
        success: true,
        data: { id: 'new-med', ...medicationData }
      });
      
      const response = await request(app)
        .post('/medications')
        .set('Authorization', 'Bearer valid-token')
        .send(medicationData);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
    
    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/medications')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Incomplete' });
      
      expect(response.status).toBe(400);
    });
  });
});

