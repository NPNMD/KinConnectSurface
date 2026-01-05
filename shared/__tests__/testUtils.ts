/**
 * Shared test utilities and mock helpers for Jest tests
 */

// Mock Firestore helpers
export const createMockFirestoreDb = () => {
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

// Mock Redis client helpers
export const createMockRedisClient = () => {
  const mockClient = {
    get: jest.fn(() => Promise.resolve(null)),
    setEx: jest.fn(() => Promise.resolve()),
    del: jest.fn(() => Promise.resolve(1)),
    keys: jest.fn(() => Promise.resolve([])),
    quit: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    on: jest.fn((event: string, callback: Function) => {
      if (event === 'ready') {
        callback();
      }
    })
  };

  return mockClient;
};

// Mock Express Request object
export const createMockRequest = (overrides: any = {}): any => {
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

// Mock Express Response object
export const createMockResponse = (): any => {
  const res: any = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    sendStatus: jest.fn(() => res),
    setHeader: jest.fn(() => res)
  };
  return res;
};

// Mock Express NextFunction
export const createMockNext = (): jest.Mock => {
  return jest.fn();
};

// Mock fetch for API tests
export const createMockFetch = (responseData: any, ok: boolean = true, status: number = 200) => {
  return jest.fn(() => Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(responseData)
  }));
};

// Test fixtures
export const testFixtures = {
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
export const createFirestoreTimestamp = (date: Date = new Date()) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0
});

// Helper to wait for async operations
export const waitFor = (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to mock console methods without polluting test output
export const mockConsole = () => {
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
