"use strict";
/**
 * Shared test utilities and mock helpers for Jest tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockConsole = exports.waitFor = exports.createFirestoreTimestamp = exports.testFixtures = exports.createMockFetch = exports.createMockNext = exports.createMockResponse = exports.createMockRequest = exports.createMockRedisClient = exports.createMockFirestoreDb = void 0;
// Mock Firestore helpers
const createMockFirestoreDb = () => {
    const mockDoc = {
        get: jest.fn(() => Promise.resolve({
            exists: true,
            id: 'test-id',
            data: () => ({ test: 'data' })
        })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve())
    };
    const mockCollection = {
        doc: jest.fn(() => mockDoc),
        where: jest.fn(() => mockCollection),
        orderBy: jest.fn(() => mockCollection),
        limit: jest.fn(() => mockCollection),
        offset: jest.fn(() => mockCollection),
        get: jest.fn(() => Promise.resolve({
            docs: [],
            empty: true
        })),
        add: jest.fn(() => Promise.resolve({
            id: 'new-id'
        }))
    };
    return {
        collection: jest.fn(() => mockCollection),
        _mockCollection: mockCollection,
        _mockDoc: mockDoc
    };
};
exports.createMockFirestoreDb = createMockFirestoreDb;
// Mock Redis client helpers
const createMockRedisClient = () => {
    const mockClient = {
        get: jest.fn(() => Promise.resolve(null)),
        setEx: jest.fn(() => Promise.resolve()),
        del: jest.fn(() => Promise.resolve(1)),
        keys: jest.fn(() => Promise.resolve([])),
        quit: jest.fn(() => Promise.resolve()),
        connect: jest.fn(() => Promise.resolve()),
        on: jest.fn((event, callback) => {
            if (event === 'ready') {
                callback();
            }
        })
    };
    return mockClient;
};
exports.createMockRedisClient = createMockRedisClient;
// Mock Express Request object
const createMockRequest = (overrides = {}) => {
    return {
        headers: {},
        params: {},
        query: {},
        body: {},
        user: undefined,
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        ...overrides
    };
};
exports.createMockRequest = createMockRequest;
// Mock Express Response object
const createMockResponse = () => {
    const res = {
        status: jest.fn(() => res),
        json: jest.fn(() => res),
        send: jest.fn(() => res),
        sendStatus: jest.fn(() => res),
        setHeader: jest.fn(() => res)
    };
    return res;
};
exports.createMockResponse = createMockResponse;
// Mock Express NextFunction
const createMockNext = () => {
    return jest.fn();
};
exports.createMockNext = createMockNext;
// Mock fetch for API tests
const createMockFetch = (responseData, ok = true, status = 200) => {
    return jest.fn(() => Promise.resolve({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: () => Promise.resolve(responseData)
    }));
};
exports.createMockFetch = createMockFetch;
// Test fixtures
exports.testFixtures = {
    patient: {
        id: 'patient-123',
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        email: 'john.doe@example.com',
        phoneNumber: '555-1234',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        emergencyContact: {
            name: 'Jane Doe',
            relationship: 'Spouse',
            phoneNumber: '555-5678'
        },
        medicalConditions: ['Hypertension'],
        allergies: ['Penicillin'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    },
    medication: {
        id: 'med-123',
        patientId: 'patient-123',
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Once daily',
        instructions: 'Take with food',
        prescribedBy: 'Dr. Smith',
        prescribedDate: new Date('2024-01-01'),
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    },
    user: {
        uid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        familyGroupId: 'family-123'
    },
    auditLog: {
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: 'ACCESS_PATIENT',
        resource: 'patient:patient-123',
        resourceId: 'patient-123',
        result: 'SUCCESS',
        timestamp: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01')
    },
    drugSearchResult: {
        rxcui: '313782',
        name: 'Aspirin 81mg',
        synonym: 'Aspirin',
        tty: 'SCD'
    },
    drugDetails: {
        rxcui: '313782',
        name: 'Aspirin 81mg',
        synonym: 'Aspirin',
        tty: 'SCD',
        language: 'ENG',
        suppress: 'N',
        umlscui: 'C0984818'
    }
};
// Helper to create Firestore timestamp
const createFirestoreTimestamp = (date = new Date()) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0
});
exports.createFirestoreTimestamp = createFirestoreTimestamp;
// Helper to wait for async operations
const waitFor = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));
exports.waitFor = waitFor;
// Helper to mock console methods without polluting test output
const mockConsole = () => {
    const originalConsole = { ...console };
    beforeEach(() => {
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
    });
    afterEach(() => {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
    });
};
exports.mockConsole = mockConsole;
