import express from 'express';
import { familyAccessService } from '../services/familyAccessService';
import { authenticateToken } from '../middleware/auth';
import type { 
  FamilyCalendarAccess, 
  NewFamilyCalendarAccess,
  MedicalEventType 
} from '@shared/types';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ===== FAMILY INVITATION MANAGEMENT =====

// POST /api/family-access/invite - Create family invitation
router.post('/invite', async (req, res) => {
  try {
    const {
      patientId,
      familyMemberEmail,
      familyMemberName,
      permissions,
      accessLevel,
      eventTypesAllowed
    } = req.body;

    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Validate required fields
    if (!patientId || !familyMemberEmail || !familyMemberName || !permissions || !accessLevel) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate permissions object
    const requiredPermissions = [
      'canView', 'canCreate', 'canEdit', 'canDelete',
      'canClaimResponsibility', 'canManageFamily', 
      'canViewMedicalDetails', 'canReceiveNotifications'
    ];

    for (const perm of requiredPermissions) {
      if (typeof permissions[perm] !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: `Invalid permission value for ${perm}`
        });
      }
    }

    const result = await familyAccessService.createFamilyInvitation(
      patientId,
      familyMemberEmail,
      familyMemberName,
      permissions,
      accessLevel,
      userId,
      eventTypesAllowed
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating family invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/family-access/accept - Accept family invitation
router.post('/accept', async (req, res) => {
  try {
    const { invitationToken } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!invitationToken) {
      return res.status(400).json({
        success: false,
        error: 'Invitation token is required'
      });
    }

    const result = await familyAccessService.acceptFamilyInvitation(
      invitationToken,
      userId
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error accepting family invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== FAMILY ACCESS MANAGEMENT =====

// GET /api/family-access/patient/:patientId - Get family access for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Check if user has permission to view family access for this patient
    const permissionCheck = await familyAccessService.checkPermission(
      patientId,
      userId,
      'canManageFamily'
    );

    if (!permissionCheck.hasPermission && !permissionCheck.isPatient) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - cannot view family access for this patient'
      });
    }

    const result = await familyAccessService.getFamilyAccessByPatientId(patientId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error getting family access:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/family-access/member - Get family access for current user
router.get('/member', async (req, res) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const result = await familyAccessService.getFamilyAccessByMemberId(userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error getting family member access:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/family-access/:accessId - Update family access permissions
router.put('/:accessId', async (req, res) => {
  try {
    const { accessId } = req.params;
    const updates = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Remove sensitive fields that shouldn't be updated directly
    const allowedUpdates = { ...updates };
    delete allowedUpdates.id;
    delete allowedUpdates.patientId;
    delete allowedUpdates.familyMemberId;
    delete allowedUpdates.createdAt;
    delete allowedUpdates.createdBy;
    delete allowedUpdates.invitationToken;
    delete allowedUpdates.invitationExpiresAt;

    const result = await familyAccessService.updateFamilyAccess(
      accessId,
      allowedUpdates,
      userId
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error updating family access:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /api/family-access/:accessId - Revoke family access
router.delete('/:accessId', async (req, res) => {
  try {
    const { accessId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const result = await familyAccessService.revokeFamilyAccess(
      accessId,
      userId,
      reason
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error revoking family access:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== PERMISSION CHECKING =====

// GET /api/family-access/check-permission/:patientId/:permission - Check specific permission
router.get('/check-permission/:patientId/:permission', async (req, res) => {
  try {
    const { patientId, permission } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Validate permission parameter
    const validPermissions = [
      'canView', 'canCreate', 'canEdit', 'canDelete',
      'canClaimResponsibility', 'canManageFamily',
      'canViewMedicalDetails', 'canReceiveNotifications'
    ];

    if (!validPermissions.includes(permission)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission type'
      });
    }

    const result = await familyAccessService.checkPermission(
      patientId,
      userId,
      permission as keyof FamilyCalendarAccess['permissions']
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== EMERGENCY ACCESS =====

// POST /api/family-access/emergency-access - Grant emergency access
router.post('/emergency-access', async (req, res) => {
  try {
    const { patientId, familyMemberId, duration } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!patientId || !familyMemberId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and family member ID are required'
      });
    }

    const result = await familyAccessService.grantEmergencyAccess(
      patientId,
      familyMemberId,
      userId,
      duration
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error granting emergency access:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== MAINTENANCE =====

// POST /api/family-access/cleanup - Clean up expired access (admin only)
router.post('/cleanup', async (req, res) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Note: In a real application, you'd want to check if the user is an admin
    // For now, we'll allow any authenticated user to trigger cleanup
    
    await familyAccessService.cleanupExpiredAccess();

    res.json({
      success: true,
      message: 'Cleanup completed successfully'
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;