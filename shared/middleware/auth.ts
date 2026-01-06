import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { AuditAction } from '../types';

interface AuthMiddlewareDeps {
  verifyIdToken: (token: string) => Promise<any>;
  auditService?: AuditService;
}

/**
 * Helper to extract IP address from request
 */
function getIpAddress(req: Request): string | undefined {
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
function getUserAgent(req: Request): string | undefined {
  return req.headers['user-agent'];
}

export function createAuthMiddleware(deps: AuthMiddlewareDeps): any {
  return async (req: Request, res: Response, next: NextFunction) => {
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
          await deps.auditService.logSecurityEvent(
            'anonymous',
            AuditAction.UNAUTHORIZED_ACCESS,
            'api',
            'No access token provided',
            ipAddress,
            userAgent
          );
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
          await deps.auditService.logSecurityEvent(
            'anonymous',
            AuditAction.INVALID_TOKEN,
            'api',
            'Token verification returned null',
            ipAddress,
            userAgent
          );
        }
        
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      // Attach user info to request
      (req as any).user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      };
      
      // Also attach IP and user agent for downstream audit logging
      (req as any).ipAddress = ipAddress;
      (req as any).userAgent = userAgent;
      
      // Log successful authentication (token verification)
      if (deps.auditService) {
        await deps.auditService.log({
          userId: decoded.uid,
          userEmail: decoded.email,
          action: AuditAction.TOKEN_REFRESH,
          resource: 'api',
          result: 'SUCCESS' as any,
          ipAddress,
          userAgent,
        });
      }
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      
      // Log authentication error
      if (deps.auditService) {
        await deps.auditService.logSecurityEvent(
          'anonymous',
          AuditAction.INVALID_TOKEN,
          'api',
          error instanceof Error ? error.message : 'Unknown authentication error',
          ipAddress,
          userAgent
        );
      }
      
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  };
}

