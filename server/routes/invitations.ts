import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { familyAccessService } from '../services/familyAccessService';
import { patientService } from '../services/patientService';
import { userService } from '../services/userService';
import type { FamilyCalendarAccess } from '@shared/types';

const router = Router();

// Send family invitation
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { email, patientName } = req.body;
    const senderUserId = req.user!.uid;

    // Validate required fields
    if (!email || !patientName) {
      return res.status(400).json({
        success: false,
        error: 'Email and patient name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Get sender's patient profile
    const senderPatient = await patientService.getPatientByUserId(senderUserId);
    if (!senderPatient.success || !senderPatient.data) {
      return res.status(404).json({
        success: false,
        error: 'Patient profile not found. Please create your profile first.'
      });
    }

    // Get sender's user info
    const senderUser = await userService.getUserById(senderUserId);
    if (!senderUser.success || !senderUser.data) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Define permissions for the invitation
    const permissions: FamilyCalendarAccess['permissions'] = {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canClaimResponsibility: true,
      canManageFamily: false,
      canViewMedicalDetails: false,
      canReceiveNotifications: true
    };

    // Create family invitation using the existing service
    const invitation = await familyAccessService.createFamilyInvitation(
      senderPatient.data.id,
      email,
      patientName,
      permissions,
      'limited',
      senderUserId
    );

    if (!invitation.success) {
      return res.status(500).json({
        success: false,
        error: invitation.error || 'Failed to create invitation'
      });
    }

    console.log(`✅ Invitation sent successfully to ${email} from ${senderUser.data.email}`);

    res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitationId: invitation.data?.invitation.id,
        expiresAt: invitation.data?.invitation.invitationExpiresAt
      }
    });

  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while sending invitation'
    });
  }
});

// Get pending invitations for current user
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.uid;
    
    // Get patient profile
    const patient = await patientService.getPatientByUserId(userId);
    if (!patient.success || !patient.data) {
      return res.status(404).json({
        success: false,
        error: 'Patient profile not found'
      });
    }

    // Get family access records for this patient
    const familyAccess = await familyAccessService.getFamilyAccessByPatientId(patient.data.id);
    
    if (!familyAccess.success) {
      return res.status(500).json(familyAccess);
    }

    // Filter for pending invitations
    const pendingInvitations = familyAccess.data?.filter(access => access.status === 'pending') || [];
    
    res.json({
      success: true,
      data: pendingInvitations
    });
  } catch (error) {
    console.error('Error getting pending invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Accept invitation
router.post('/accept/:token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user!.uid;

    // Accept the invitation using the existing service
    const result = await familyAccessService.acceptFamilyInvitation(token, userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Decline invitation (revoke it)
router.post('/decline/:token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user!.uid;

    // Find the invitation by token first
    const familyAccess = await familyAccessService.getFamilyAccessByMemberId(userId);
    if (!familyAccess.success) {
      return res.status(500).json(familyAccess);
    }

    // Find the invitation with the matching token
    const invitation = familyAccess.data?.find(access =>
      access.invitationToken === token && access.status === 'pending'
    );

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or already processed'
      });
    }

    // Revoke the invitation
    const result = await familyAccessService.revokeFamilyAccess(
      invitation.id,
      userId,
      'Invitation declined by recipient'
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Invitation declined successfully'
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;