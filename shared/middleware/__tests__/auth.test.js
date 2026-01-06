"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../auth");
const testUtils_1 = require("../../__tests__/testUtils");
const types_1 = require("../../types");
(0, testUtils_1.mockConsole)();
describe('Auth Middleware', () => {
    let mockVerifyIdToken;
    let mockAuditService;
    let middleware;
    beforeEach(() => {
        mockVerifyIdToken = jest.fn();
        mockAuditService = {
            logSecurityEvent: jest.fn(),
            log: jest.fn()
        };
        middleware = (0, auth_1.createAuthMiddleware)({
            verifyIdToken: mockVerifyIdToken,
            auditService: mockAuditService
        });
        jest.clearAllMocks();
    });
    describe('Missing Token', () => {
        it('should return 401 when no authorization header', async () => {
            const req = (0, testUtils_1.createMockRequest)();
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Access token required'
            });
            expect(next).not.toHaveBeenCalled();
            expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith('anonymous', types_1.AuditAction.UNAUTHORIZED_ACCESS, 'api', 'No access token provided', undefined, undefined);
        });
        it('should return 401 when authorization header does not start with Bearer', async () => {
            const req = (0, testUtils_1.createMockRequest)({
                headers: { authorization: 'Basic abc123' }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });
    describe('Invalid Token', () => {
        it('should return 403 when token verification fails', async () => {
            mockVerifyIdToken.mockResolvedValue(null);
            const req = (0, testUtils_1.createMockRequest)({
                headers: { authorization: 'Bearer invalid-token' }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid or expired token'
            });
            expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith('anonymous', types_1.AuditAction.INVALID_TOKEN, 'api', 'Token verification returned null', undefined, undefined);
        });
        it('should return 403 when token verification throws error', async () => {
            mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));
            const req = (0, testUtils_1.createMockRequest)({
                headers: { authorization: 'Bearer expired-token' }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith('anonymous', types_1.AuditAction.INVALID_TOKEN, 'api', 'Token expired', undefined, undefined);
        });
    });
    describe('Valid Token', () => {
        it('should attach user info to request and call next', async () => {
            const decodedToken = {
                uid: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                picture: 'https://example.com/pic.jpg'
            };
            mockVerifyIdToken.mockResolvedValue(decodedToken);
            const req = (0, testUtils_1.createMockRequest)({
                headers: { authorization: 'Bearer valid-token' }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(req.user).toEqual({
                uid: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                picture: 'https://example.com/pic.jpg'
            });
            expect(next).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalled();
        });
        it('should extract IP address from various headers', async () => {
            const decodedToken = { uid: 'user-123', email: 'test@example.com' };
            mockVerifyIdToken.mockResolvedValue(decodedToken);
            const req = (0, testUtils_1.createMockRequest)({
                headers: {
                    authorization: 'Bearer valid-token',
                    'x-forwarded-for': '192.168.1.1, 10.0.0.1'
                }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(req.ipAddress).toBe('192.168.1.1');
            expect(next).toHaveBeenCalled();
        });
        it('should extract IP from x-real-ip header', async () => {
            const decodedToken = { uid: 'user-123', email: 'test@example.com' };
            mockVerifyIdToken.mockResolvedValue(decodedToken);
            const req = (0, testUtils_1.createMockRequest)({
                headers: {
                    authorization: 'Bearer valid-token',
                    'x-real-ip': '192.168.1.100'
                }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(req.ipAddress).toBe('192.168.1.100');
        });
        it('should extract user agent from request', async () => {
            const decodedToken = { uid: 'user-123', email: 'test@example.com' };
            mockVerifyIdToken.mockResolvedValue(decodedToken);
            const req = (0, testUtils_1.createMockRequest)({
                headers: {
                    authorization: 'Bearer valid-token',
                    'user-agent': 'Mozilla/5.0'
                }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middleware(req, res, next);
            expect(req.userAgent).toBe('Mozilla/5.0');
        });
    });
    describe('Without Audit Service', () => {
        it('should work without audit service', async () => {
            const middlewareWithoutAudit = (0, auth_1.createAuthMiddleware)({
                verifyIdToken: mockVerifyIdToken
            });
            const decodedToken = { uid: 'user-123', email: 'test@example.com' };
            mockVerifyIdToken.mockResolvedValue(decodedToken);
            const req = (0, testUtils_1.createMockRequest)({
                headers: { authorization: 'Bearer valid-token' }
            });
            const res = (0, testUtils_1.createMockResponse)();
            const next = (0, testUtils_1.createMockNext)();
            await middlewareWithoutAudit(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
        });
    });
});
