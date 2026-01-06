"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthMiddleware = createAuthMiddleware;
const types_1 = require("../types");
/**
 * Helper to extract IP address from request
 */
function getIpAddress(req) {
    // Check for X-Forwarded-For header (common in load balancers/proxies)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
        return ips[0]?.trim();
    }
    // Check for X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
        return realIp;
    }
    // Fall back to connection remote address
    return req.ip || req.socket.remoteAddress;
}
/**
 * Helper to extract user agent from request
 */
function getUserAgent(req) {
    return req.headers['user-agent'];
}
function createAuthMiddleware(deps) {
    return async (req, res, next) => {
        const ipAddress = getIpAddress(req);
        const userAgent = getUserAgent(req);
        try {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.startsWith('Bearer ')
                ? authHeader.slice(7)
                : undefined;
            if (!token) {
                // Log unauthorized access attempt
                if (deps.auditService) {
                    await deps.auditService.logSecurityEvent('anonymous', types_1.AuditAction.UNAUTHORIZED_ACCESS, 'api', 'No access token provided', ipAddress, userAgent);
                }
                return res.status(401).json({
                    success: false,
                    error: 'Access token required'
                });
            }
            const decoded = await deps.verifyIdToken(token);
            if (!decoded) {
                // Log invalid token
                if (deps.auditService) {
                    await deps.auditService.logSecurityEvent('anonymous', types_1.AuditAction.INVALID_TOKEN, 'api', 'Token verification returned null', ipAddress, userAgent);
                }
                return res.status(403).json({
                    success: false,
                    error: 'Invalid or expired token'
                });
            }
            // Attach user info to request
            req.user = {
                uid: decoded.uid,
                email: decoded.email,
                name: decoded.name,
                picture: decoded.picture
            };
            // Also attach IP and user agent for downstream audit logging
            req.ipAddress = ipAddress;
            req.userAgent = userAgent;
            // Log successful authentication (token verification)
            if (deps.auditService) {
                await deps.auditService.log({
                    userId: decoded.uid,
                    userEmail: decoded.email,
                    action: types_1.AuditAction.TOKEN_REFRESH,
                    resource: 'api',
                    result: 'SUCCESS',
                    ipAddress,
                    userAgent,
                });
            }
            next();
        }
        catch (error) {
            console.error('Auth middleware error:', error);
            // Log authentication error
            if (deps.auditService) {
                await deps.auditService.logSecurityEvent('anonymous', types_1.AuditAction.INVALID_TOKEN, 'api', error instanceof Error ? error.message : 'Unknown authentication error', ipAddress, userAgent);
            }
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
    };
}
