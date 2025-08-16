import { Request, Response, NextFunction } from 'express';
import { familyAccessService } from '../services/familyAccessService';
import type { FamilyCalendarAccess } from '@shared/types';

// Extend Request interface to include permission check results
declare global {
  namespace Express {
    interface Request {
      familyPermission?: {
        hasPermission: boolean;
        accessLevel?: string;
        isPatient?: boolean;
        familyAccess?: FamilyCalendarAccess;
      };
    }
  }
}

/**
 * Middleware to check if user has specific permission for a patient's calendar
 */
export const checkFamilyPermission = (
  permission: keyof FamilyCalendarAccess['permissions']
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Extract patientId from request (could be in params, body, or query)
      const patientId = req.params.patientId || req.body.patientId || req.query.patientId;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID is required'
        });
      }

      // Check permission
      const permissionResult = await familyAccessService.checkPermission(
        patientId as string,
        userId,
        permission
      );

      // Attach permission result to request for use in route handlers
      req.familyPermission = permissionResult;

      if (!permissionResult.hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied - missing permission: ${permission}`
        });
      }

      next();
    } catch (error) {
      console.error('Error checking family permission:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to check if user can view patient's calendar
 */
export const canViewCalendar = checkFamilyPermission('canView');

/**
 * Middleware to check if user can create events in patient's calendar
 */
export const canCreateEvents = checkFamilyPermission('canCreate');

/**
 * Middleware to check if user can edit events in patient's calendar
 */
export const canEditEvents = checkFamilyPermission('canEdit');

/**
 * Middleware to check if user can delete events in patient's calendar
 */
export const canDeleteEvents = checkFamilyPermission('canDelete');

/**
 * Middleware to check if user can claim responsibility for patient's events
 */
export const canClaimResponsibility = checkFamilyPermission('canClaimResponsibility');

/**
 * Middleware to check if user can manage family access for patient
 */
export const canManageFamily = checkFamilyPermission('canManageFamily');

/**
 * Middleware to check if user can view medical details for patient
 */
export const canViewMedicalDetails = checkFamilyPermission('canViewMedicalDetails');

/**
 * Middleware to check if user can receive notifications for patient
 */
export const canReceiveNotifications = checkFamilyPermission('canReceiveNotifications');

/**
 * Middleware to check multiple permissions (user must have ALL specified permissions)
 */
export const checkMultiplePermissions = (
  permissions: (keyof FamilyCalendarAccess['permissions'])[]
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const patientId = req.params.patientId || req.body.patientId || req.query.patientId;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID is required'
        });
      }

      // Check all permissions
      const permissionChecks = await Promise.all(
        permissions.map(permission =>
          familyAccessService.checkPermission(patientId as string, userId, permission)
        )
      );

      // User must have ALL permissions
      const hasAllPermissions = permissionChecks.every(check => check.hasPermission);
      const isPatient = permissionChecks.some(check => check.isPatient);

      req.familyPermission = {
        hasPermission: hasAllPermissions,
        accessLevel: permissionChecks[0]?.accessLevel,
        isPatient
      };

      if (!hasAllPermissions) {
        const missingPermissions = permissions.filter((_, index) => 
          !permissionChecks[index].hasPermission
        );
        
        return res.status(403).json({
          success: false,
          error: `Access denied - missing permissions: ${missingPermissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Error checking multiple permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to check if user has any of the specified permissions (user needs at least ONE)
 */
export const checkAnyPermission = (
  permissions: (keyof FamilyCalendarAccess['permissions'])[]
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const patientId = req.params.patientId || req.body.patientId || req.query.patientId;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID is required'
        });
      }

      // Check all permissions
      const permissionChecks = await Promise.all(
        permissions.map(permission =>
          familyAccessService.checkPermission(patientId as string, userId, permission)
        )
      );

      // User needs at least ONE permission
      const hasAnyPermission = permissionChecks.some(check => check.hasPermission);
      const isPatient = permissionChecks.some(check => check.isPatient);

      req.familyPermission = {
        hasPermission: hasAnyPermission,
        accessLevel: permissionChecks.find(check => check.hasPermission)?.accessLevel,
        isPatient
      };

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied - missing any of these permissions: ${permissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Error checking any permission:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

/**
 * Middleware for emergency access override
 * Allows access if user has emergency access even if regular permissions are denied
 */
export const allowEmergencyAccess = (
  regularPermission: keyof FamilyCalendarAccess['permissions']
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const patientId = req.params.patientId || req.body.patientId || req.query.patientId;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID is required'
        });
      }

      // Check regular permission first
      const permissionResult = await familyAccessService.checkPermission(
        patientId as string,
        userId,
        regularPermission
      );

      // If regular permission is granted, proceed
      if (permissionResult.hasPermission) {
        req.familyPermission = permissionResult;
        return next();
      }

      // Check for emergency access
      const emergencyResult = await familyAccessService.checkPermission(
        patientId as string,
        userId,
        'canView' // Emergency access typically includes view permission
      );

      if (emergencyResult.hasPermission && emergencyResult.accessLevel === 'emergency_only') {
        req.familyPermission = {
          ...emergencyResult,
          hasPermission: true
        };
        return next();
      }

      // No access granted
      return res.status(403).json({
        success: false,
        error: `Access denied - missing permission: ${regularPermission} and no emergency access`
      });

    } catch (error) {
      console.error('Error checking emergency access:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};