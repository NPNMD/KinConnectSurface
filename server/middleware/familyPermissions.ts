import { Request, Response, NextFunction } from 'express';
import { adminDb } from '../firebase-admin';
import type { FamilyCalendarAccess } from '@shared/types';

/**
 * Middleware to validate family member permissions
 *
 * This middleware checks if the authenticated user has the required permission
 * to perform an action on a patient's data.
 *
 * - Patients always have full permissions on their own data
 * - Family members must have the specific permission granted via family_calendar_access
 */

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    picture?: string;
  };
}

/**
 * Check if user has permission to access patient data
 */
export const requirePermission = (permission: keyof FamilyCalendarAccess['permissions']) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.uid;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get patientId from request (could be in params, body, or query)
      const patientId = req.params.patientId || req.body.patientId || req.query.patientId;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID is required'
        });
      }

      // If user is the patient themselves, allow all actions
      if (userId === patientId) {
        return next();
      }

      // Check if user is a family member with access to this patient
      const accessSnapshot = await adminDb
        .collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (accessSnapshot.empty) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this patient\'s data'
        });
      }

      const accessRecord = accessSnapshot.docs[0].data() as FamilyCalendarAccess;

      // Check specific permission
      const permissions = accessRecord.permissions;
      
      if (!permissions[permission]) {
        return res.status(403).json({
          success: false,
          error: `You do not have permission to perform this action. Required permission: ${permission}`
        });
      }

      // Permission granted, continue
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify permissions'
      });
    }
  };
};

/**
 * Require create permission
 */
export const requireCreatePermission = requirePermission('canCreate');

/**
 * Require edit permission
 */
export const requireEditPermission = requirePermission('canEdit');

/**
 * Require delete permission
 */
export const requireDeletePermission = requirePermission('canDelete');

/**
 * Require family management permission
 */
export const requireManageFamilyPermission = requirePermission('canManageFamily');

/**
 * Require view permission (basic access check)
 */
export const requireViewPermission = requirePermission('canView');