import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../firebase-admin';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name?: string;
        picture?: string;
      };
    }
  }
}

// Authentication middleware
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('🔍 Auth Middleware: Authorization header present:', !!authHeader);
    console.log('🔍 Auth Middleware: Token extracted:', !!token);

    if (!token) {
      console.warn('⚠️ Auth Middleware: No token provided');
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    console.log('🔍 Auth Middleware: Verifying Firebase ID token...');
    const decodedToken = await verifyIdToken(token);
    
    if (!decodedToken) {
      console.error('❌ Auth Middleware: Token verification failed');
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    console.log('🔍 Auth Middleware: Token verified successfully. Claims:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      email_verified: decodedToken.email_verified,
      firebase: decodedToken.firebase
    });

    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name,
      picture: decodedToken.picture,
    };

    console.log('✅ Auth Middleware: User set on request:', req.user);
    next();
  } catch (error) {
    console.error('💥 Auth Middleware: Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decodedToken = await verifyIdToken(token);
      if (decodedToken) {
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email || '',
          name: decodedToken.name,
          picture: decodedToken.picture,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}

// Role-based access control middleware
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // For now, we'll check user type from the database
    // This can be enhanced with more sophisticated role checking
    next();
  };
}
