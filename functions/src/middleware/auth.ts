import * as express from 'express';
import { auth } from '../firebase';
import { createAuthMiddleware } from '../../../shared/middleware/auth';

// Use the shared middleware factory
export const authenticate = createAuthMiddleware({
  verifyIdToken: (token) => auth.verifyIdToken(token)
});
