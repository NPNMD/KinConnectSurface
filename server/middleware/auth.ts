import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../firebase-admin';
import { createAuthMiddleware } from '../../shared/middleware/auth';

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
export const authenticateToken = createAuthMiddleware({
  verifyIdToken: verifyIdToken
});
