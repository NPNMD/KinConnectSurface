"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const patients_1 = require("../patients");
describe('Patient Routes', () => {
    let app;
    let mockPatientService;
    let mockAccessService;
    let mockAuthMiddleware;
    beforeEach(() => {
        mockPatientService = {
            getPatientByUserId: jest.fn(),
            createPatient: jest.fn(),
            updatePatient: jest.fn(),
            getPatientById: jest.fn(),
            searchPatientsByCondition: jest.fn(),
            searchPatientsByAllergy: jest.fn(),
            getPatientsByAgeRange: jest.fn()
        };
        mockAccessService = {
            canAccessPatient: jest.fn()
        };
        mockAuthMiddleware = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            req.user = { uid: 'user-123' };
            next();
        };
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/patients', (0, patients_1.createPatientRouter)(mockPatientService, mockAccessService, mockAuthMiddleware));
        jest.clearAllMocks();
    });
    describe('GET /patients/profile', () => {
        it('should require authentication', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/patients/profile');
            expect(response.status).toBe(401);
        });
        it('should get patient profile for authenticated user', async () => {
            mockPatientService.getPatientByUserId.mockResolvedValue({
                success: true,
                data: { id: 'patient-123', firstName: 'John' }
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/profile')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe('patient-123');
            expect(mockPatientService.getPatientByUserId).toHaveBeenCalledWith('user-123');
        });
        it('should handle service errors', async () => {
            mockPatientService.getPatientByUserId.mockResolvedValue({
                success: false,
                error: 'Database error'
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/profile')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(500);
        });
        it('should handle exceptions', async () => {
            mockPatientService.getPatientByUserId.mockRejectedValue(new Error('DB Error'));
            const response = await (0, supertest_1.default)(app)
                .get('/patients/profile')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Internal server error');
        });
    });
    describe('POST /patients/profile', () => {
        it('should create patient profile', async () => {
            const newPatient = {
                firstName: 'John',
                lastName: 'Doe',
                dateOfBirth: '1990-01-01',
                email: 'john@example.com'
            };
            mockPatientService.createPatient.mockResolvedValue({
                success: true,
                data: { id: 'patient-123', ...newPatient, userId: 'user-123' }
            });
            const response = await (0, supertest_1.default)(app)
                .post('/patients/profile')
                .set('Authorization', 'Bearer valid-token')
                .send(newPatient);
            expect(response.status).toBe(201);
            expect(response.body.data.userId).toBe('user-123');
            expect(mockPatientService.createPatient).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-123',
                ...newPatient
            }));
        });
        it('should handle creation errors', async () => {
            mockPatientService.createPatient.mockResolvedValue({
                success: false,
                error: 'Creation failed'
            });
            const response = await (0, supertest_1.default)(app)
                .post('/patients/profile')
                .set('Authorization', 'Bearer valid-token')
                .send({});
            expect(response.status).toBe(500);
        });
    });
    describe('PUT /patients/profile', () => {
        it('should update existing patient profile', async () => {
            const updates = { phoneNumber: '555-1234' };
            mockPatientService.getPatientByUserId.mockResolvedValue({
                success: true,
                data: { id: 'patient-123', userId: 'user-123' }
            });
            mockPatientService.updatePatient.mockResolvedValue({
                success: true,
                data: { id: 'patient-123', phoneNumber: '555-1234' }
            });
            const response = await (0, supertest_1.default)(app)
                .put('/patients/profile')
                .set('Authorization', 'Bearer valid-token')
                .send(updates);
            expect(response.status).toBe(200);
            expect(response.body.data.phoneNumber).toBe('555-1234');
        });
        it('should create profile if does not exist', async () => {
            mockPatientService.getPatientByUserId.mockResolvedValue({
                success: true,
                data: null
            });
            mockPatientService.createPatient.mockResolvedValue({
                success: true,
                data: { id: 'patient-123', firstName: 'John' }
            });
            const response = await (0, supertest_1.default)(app)
                .put('/patients/profile')
                .set('Authorization', 'Bearer valid-token')
                .send({ firstName: 'John' });
            expect(response.status).toBe(201);
            expect(mockPatientService.createPatient).toHaveBeenCalled();
        });
        it('should handle update errors', async () => {
            mockPatientService.getPatientByUserId.mockResolvedValue({
                success: true,
                data: { id: 'patient-123' }
            });
            mockPatientService.updatePatient.mockResolvedValue({
                success: false,
                error: 'Update failed'
            });
            const response = await (0, supertest_1.default)(app)
                .put('/patients/profile')
                .set('Authorization', 'Bearer valid-token')
                .send({});
            expect(response.status).toBe(500);
        });
    });
    describe('GET /patients/:patientId', () => {
        it('should get patient by ID with access check', async () => {
            mockPatientService.getPatientById.mockResolvedValue({
                success: true,
                data: { id: 'patient-456', userId: 'user-456', firstName: 'Jane' }
            });
            mockAccessService.canAccessPatient.mockResolvedValue(true);
            const response = await (0, supertest_1.default)(app)
                .get('/patients/patient-456')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe('patient-456');
            expect(mockAccessService.canAccessPatient).toHaveBeenCalledWith('user-123', 'user-456');
        });
        it('should return 404 for non-existent patient', async () => {
            mockPatientService.getPatientById.mockResolvedValue({
                success: true,
                data: null
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/nonexistent')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Patient not found');
        });
        it('should return 403 when access denied', async () => {
            mockPatientService.getPatientById.mockResolvedValue({
                success: true,
                data: { id: 'patient-456', userId: 'user-456' }
            });
            mockAccessService.canAccessPatient.mockResolvedValue(false);
            const response = await (0, supertest_1.default)(app)
                .get('/patients/patient-456')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Access denied');
        });
        it('should use patientId when userId not available', async () => {
            mockPatientService.getPatientById.mockResolvedValue({
                success: true,
                data: { id: 'patient-456' } // no userId field
            });
            mockAccessService.canAccessPatient.mockResolvedValue(true);
            const response = await (0, supertest_1.default)(app)
                .get('/patients/patient-456')
                .set('Authorization', 'Bearer valid-token');
            expect(mockAccessService.canAccessPatient).toHaveBeenCalledWith('user-123', 'patient-456');
        });
    });
    describe('GET /patients/search/condition/:condition', () => {
        it('should search patients by medical condition', async () => {
            mockPatientService.searchPatientsByCondition.mockResolvedValue({
                success: true,
                data: [{ id: 'patient-1', medicalConditions: ['Diabetes'] }]
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/search/condition/Diabetes')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(mockPatientService.searchPatientsByCondition).toHaveBeenCalledWith('Diabetes');
        });
        it('should handle search errors', async () => {
            mockPatientService.searchPatientsByCondition.mockResolvedValue({
                success: false,
                error: 'Search failed'
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/search/condition/Diabetes')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(500);
        });
    });
    describe('GET /patients/search/allergy/:allergy', () => {
        it('should search patients by allergy', async () => {
            mockPatientService.searchPatientsByAllergy.mockResolvedValue({
                success: true,
                data: [{ id: 'patient-1', allergies: ['Penicillin'] }]
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/search/allergy/Penicillin')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
        });
    });
    describe('GET /patients/search/age/:minAge/:maxAge', () => {
        it('should get patients by age range', async () => {
            mockPatientService.getPatientsByAgeRange.mockResolvedValue({
                success: true,
                data: [{ id: 'patient-1', dateOfBirth: '1990-01-01' }]
            });
            const response = await (0, supertest_1.default)(app)
                .get('/patients/search/age/25/45')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(mockPatientService.getPatientsByAgeRange).toHaveBeenCalledWith(25, 45);
        });
        it('should return 400 for invalid age range', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/patients/search/age/invalid/age')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid age range');
        });
    });
});
