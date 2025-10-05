import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { familyAccessService } from '../services/familyAccessService';
import { patientService } from '../services/patientService';
import { userService } from '../services/userService';
import { emailService } from '../services/emailService';
import { adminDb } from '../firebase-admin';
import type { FamilyCalendarAccess } from '@shared/types';
import { derivePermissionsFromAccessLevel, isValidAccessLevel } from '../utils/accessLevelPermissions';

const router = Router();

// Send family invitation
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { email, patientName, accessLevel } = req.body;
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

    // Validate and default access level
    const selectedAccessLevel = accessLevel || 'view_only'; // Default to view_only for backward compatibility
    if (!isValidAccessLevel(selectedAccessLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid access level. Must be either "full" or "view_only"'
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

    // Derive permissions from access level
    const permissions = derivePermissionsFromAccessLevel(selectedAccessLevel);

    // Create family invitation using the existing service
    const invitation = await familyAccessService.createFamilyInvitation(
      senderPatient.data.id,
      email,
      patientName,
      permissions,
      selectedAccessLevel,
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

// Get all family members for a patient (pending + accepted)
// IMPORTANT: This specific route must come BEFORE the generic /:token route
router.get('/family-access/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user!.uid;

    // Verify the requesting user is the patient
    if (userId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only view your own family members'
      });
    }

    // Get all family access records for this patient
    const familyMembersResponse = await familyAccessService.getFamilyAccessByPatientId(patientId);
    
    if (!familyMembersResponse.success || !familyMembersResponse.data) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch family members'
      });
    }

    // Sort: pending first, then by date
    const sorted = familyMembersResponse.data.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime();
    });

    res.json({
      success: true,
      data: sorted
    });
  } catch (error) {
    console.error('Error fetching family members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch family members'
    });
  }
});

// Get invitation details by token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find invitation by token
    const invitation = await familyAccessService.getFamilyAccessByToken(token);
    
    if (!invitation.success || !invitation.data) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or expired'
      });
    }

    // Get patient info (the person who sent the invitation)
    const patientUser = await userService.getUserById(invitation.data.createdBy);
    
    res.json({
      success: true,
      data: {
        id: invitation.data.id,
        inviterName: patientUser.success ? patientUser.data?.name : 'Unknown',
        inviterEmail: patientUser.success ? patientUser.data?.email : 'Unknown',
        patientName: patientUser.success ? patientUser.data?.name : 'Unknown',
        patientEmail: patientUser.success ? patientUser.data?.email : 'Unknown',
        message: '', // Could add a message field to the invitation
        status: invitation.data.status,
        createdAt: invitation.data.invitedAt,
        expiresAt: invitation.data.invitationExpiresAt
      }
    });
  } catch (error) {
    console.error('Error getting invitation details:', error);
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

// Decline invitation
router.post('/invitations/:invitationId/decline', authenticateToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { reason } = req.body;

    // Get the invitation
    const invitationDoc = await adminDb.collection('family_calendar_access').doc(invitationId).get();
    
    if (!invitationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    const invitation = invitationDoc.data() as FamilyCalendarAccess;

    // Verify invitation is pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Can only decline pending invitations'
      });
    }

    // Decline the invitation using the service
    const result = await familyAccessService.declineInvitation(invitationId, reason);
    
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

// Enhanced family access endpoint with comprehensive fallbacks
router.get('/family-access', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const userEmail = req.user!.email;
    
    console.log('🔍 Enhanced Family Access API: Starting comprehensive query', {
      userId,
      userEmail
    });
    
    // Use enhanced service with fallbacks
    const familyMemberAccess = await familyAccessService.getFamilyAccessWithFallbacks(
      userId,
      userEmail
    );
    
    console.log('📊 Enhanced Family Access Result:', {
      success: familyMemberAccess.success,
      recordCount: familyMemberAccess.data?.length || 0,
      error: familyMemberAccess.error
    });
    
    // Process and format patient access data
    const patientsIHaveAccessTo = [];
    
    if (familyMemberAccess.success && familyMemberAccess.data) {
      for (const access of familyMemberAccess.data) {
        // Get patient user info with multiple fallback strategies
        let patientUser = await userService.getUserById(access.createdBy);
        
        // Fallback 1: try patientUserId if createdBy fails
        if (!patientUser.success && (access as any).patientUserId) {
          console.log('🔄 Trying patientUserId fallback');
          patientUser = await userService.getUserById((access as any).patientUserId);
        }
        
        // Fallback 2: try patientId directly
        if (!patientUser.success) {
          console.log('🔄 Trying patientId fallback');
          patientUser = await userService.getUserById(access.patientId);
        }
        
        if (patientUser.success && patientUser.data) {
          const patientAccess = {
            id: access.id,
            patientId: access.patientId,
            patientName: patientUser.data.name,
            patientEmail: patientUser.data.email,
            accessLevel: access.accessLevel,
            permissions: access.permissions,
            status: access.status,
            acceptedAt: access.acceptedAt,
            lastAccessAt: access.lastAccessAt,
            isEmergencyAccess: access.emergencyAccess || false,
            connectionVerified: (access as any).connectionVerified || false,
            relationship: 'family_member'
          };
          
          patientsIHaveAccessTo.push(patientAccess);
          console.log(`✅ Added patient access: ${patientUser.data.name}`);
        } else {
          console.log(`❌ Failed to resolve patient info for access: ${access.id}`);
        }
      }
    }
    
    // Update user's family member metadata if we found patient access
    if (patientsIHaveAccessTo.length > 0) {
      await updateUserFamilyMetadata(userId, patientsIHaveAccessTo);
    }
    
    // Get family members who have access to current user (existing logic)
    const familyMembersWithAccessToMe = await getFamilyMembersWithAccessToMe(userId);
    
    const result = {
      success: true,
      data: {
        patientsIHaveAccessTo,
        familyMembersWithAccessToMe,
        totalConnections: patientsIHaveAccessTo.length + familyMembersWithAccessToMe.length,
        debugInfo: {
          userId,
          userEmail,
          queryMethod: familyMemberAccess.data?.[0]?.repairReason || 'primary_query',
          timestamp: new Date().toISOString()
        }
      }
    };
    
    console.log('✅ Enhanced Family Access API: Final result:', {
      patientsIHaveAccessTo: patientsIHaveAccessTo.length,
      familyMembersWithAccessToMe: familyMembersWithAccessToMe.length,
      totalConnections: result.data.totalConnections
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Enhanced Family Access API: Critical error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      debugInfo: {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Helper function to update user family metadata
async function updateUserFamilyMetadata(
  userId: string,
  patientsWithAccess: any[]
): Promise<void> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const updateData = {
      familyMemberOf: patientsWithAccess.map(p => p.patientId),
      primaryPatientId: patientsWithAccess[0]?.patientId,
      lastFamilyAccessCheck: new Date(),
      updatedAt: new Date()
    };
    
    await userRef.update(updateData);
    console.log('✅ Updated user family metadata:', userId);
  } catch (error) {
    console.error('❌ Failed to update user family metadata:', error);
  }
}

// Enhanced helper function to get family members with access to current user
async function getFamilyMembersWithAccessToMe(userId: string): Promise<any[]> {
  try {
    const familyMembersWithAccessToMe = [];
    
    console.log('🔍 Getting family members with access to user:', userId);
    
    // Method 1: Check user's familyMembers array (new approach)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const familyMembers = userData.familyMembers || [];
      
      console.log(`📊 Found ${familyMembers.length} family members in user record`);
      
      for (const fm of familyMembers) {
        // Get full user details for the family member
        const familyMemberUser = await userService.getUserById(fm.familyMemberId);
        if (familyMemberUser.success && familyMemberUser.data) {
          familyMembersWithAccessToMe.push({
            id: `user_record_${fm.familyMemberId}`,
            familyMemberId: fm.familyMemberId,
            familyMemberName: familyMemberUser.data.name,
            familyMemberEmail: familyMemberUser.data.email,
            accessLevel: fm.accessLevel,
            permissions: {}, // Will be filled from family_calendar_access if needed
            status: 'active',
            acceptedAt: fm.acceptedAt,
            relationship: fm.relationship || 'family_member',
            source: 'user_record'
          });
        }
      }
    }
    
    // Method 2: Fallback to family_calendar_access collection (original approach)
    if (familyMembersWithAccessToMe.length === 0) {
      console.log('🔄 No family members found in user record, checking family_calendar_access...');
      
      const userPatient = await patientService.getPatientByUserId(userId);
      
      if (userPatient.success && userPatient.data) {
        const patientFamilyAccess = await familyAccessService.getFamilyAccessByPatientId(userPatient.data.id);
        
        if (patientFamilyAccess.success && patientFamilyAccess.data) {
          for (const access of patientFamilyAccess.data.filter(a => a.status === 'active')) {
            if (access.familyMemberId) {
              const familyMemberUser = await userService.getUserById(access.familyMemberId);
              if (familyMemberUser.success && familyMemberUser.data) {
                familyMembersWithAccessToMe.push({
                  id: access.id,
                  familyMemberId: access.familyMemberId,
                  familyMemberName: familyMemberUser.data.name,
                  familyMemberEmail: familyMemberUser.data.email,
                  accessLevel: access.accessLevel,
                  permissions: access.permissions,
                  status: access.status,
                  acceptedAt: access.acceptedAt,
                  relationship: 'family_member',
                  source: 'family_calendar_access'
                });
              }
            }
          }
        }
      }
    }
    
    console.log(`✅ Returning ${familyMembersWithAccessToMe.length} family members with access`);
    return familyMembersWithAccessToMe;
  } catch (error) {
    console.error('❌ Error getting family members with access:', error);
    return [];
  }
}

// ===== PHASE 2: FAMILY MANAGEMENT ENDPOINTS =====

// Remove a family member (soft delete)
router.delete('/family-access/:accessId', authenticateToken, async (req, res) => {
  try {
    const { accessId } = req.params;
    const userId = req.user!.uid;

    // Get the access record
    const accessDoc = await adminDb.collection('family_calendar_access').doc(accessId).get();
    
    if (!accessDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Family access record not found'
      });
    }

    const access = accessDoc.data() as FamilyCalendarAccess;

    // Verify user owns this patient record
    const patient = await patientService.getPatientByUserId(userId);
    if (!patient.success || !patient.data || patient.data.id !== access.patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only remove your own family members'
      });
    }

    // Revoke the access
    const result = await familyAccessService.revokeFamilyAccess(
      accessId,
      userId,
      'Removed by patient'
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Send notification email to removed family member
    if (access.familyMemberEmail && access.familyMemberName) {
      const patientUser = await userService.getUserById(userId);
      if (patientUser.success && patientUser.data) {
        await emailService.sendAccessRemoved({
          familyMemberName: access.familyMemberName,
          familyMemberEmail: access.familyMemberEmail,
          patientName: patientUser.data.name,
          patientEmail: patientUser.data.email
        });
      }
    }

    res.json({
      success: true,
      message: 'Family member removed successfully'
    });
  } catch (error) {
    console.error('Error removing family member:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Change family member's access level
router.patch('/family-access/:accessId/access-level', authenticateToken, async (req, res) => {
  try {
    const { accessId } = req.params;
    const { accessLevel } = req.body;
    const userId = req.user!.uid;

    // Validate access level
    if (!isValidAccessLevel(accessLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid access level. Must be either "full" or "view_only"'
      });
    }

    // Get the access record
    const accessDoc = await adminDb.collection('family_calendar_access').doc(accessId).get();
    
    if (!accessDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Family access record not found'
      });
    }

    const access = accessDoc.data() as FamilyCalendarAccess;

    // Verify user owns this patient record
    const patient = await patientService.getPatientByUserId(userId);
    if (!patient.success || !patient.data || patient.data.id !== access.patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only modify your own family members'
      });
    }

    // Derive new permissions from access level
    const newPermissions = derivePermissionsFromAccessLevel(accessLevel);

    // Update the access record
    const result = await familyAccessService.updateFamilyAccess(
      accessId,
      {
        accessLevel,
        permissions: newPermissions
      },
      userId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Send notification email to family member
    if (access.familyMemberEmail && access.familyMemberName) {
      const patientUser = await userService.getUserById(userId);
      if (patientUser.success && patientUser.data) {
        await emailService.sendAccessLevelChanged({
          familyMemberName: access.familyMemberName,
          familyMemberEmail: access.familyMemberEmail,
          patientName: patientUser.data.name,
          oldAccessLevel: access.accessLevel,
          newAccessLevel: accessLevel,
          newPermissions: Object.entries(newPermissions)
            .filter(([_, value]) => value === true)
            .map(([key, _]) => key)
        });
      }
    }

    res.json({
      success: true,
      message: 'Access level updated successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Error updating access level:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Resend pending invitation
router.post('/invitations/:invitationId/resend', authenticateToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user!.uid;

    // Get the invitation
    const invitationDoc = await adminDb.collection('family_calendar_access').doc(invitationId).get();
    
    if (!invitationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    const invitation = invitationDoc.data() as FamilyCalendarAccess;

    // Verify user owns this patient record
    const patient = await patientService.getPatientByUserId(userId);
    if (!patient.success || !patient.data || patient.data.id !== invitation.patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only resend your own invitations'
      });
    }

    // Verify invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Can only resend pending invitations'
      });
    }

    // Generate new token and extend expiration
    const newToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await invitationDoc.ref.update({
      invitationToken: newToken,
      invitationExpiresAt: newExpiresAt,
      updatedAt: new Date()
    });

    // Send new invitation email
    const patientUser = await userService.getUserById(userId);
    if (patientUser.success && patientUser.data) {
      await emailService.sendFamilyInvitation({
        patientName: patientUser.data.name,
        patientEmail: patientUser.data.email,
        familyMemberName: invitation.familyMemberName,
        familyMemberEmail: invitation.familyMemberEmail,
        invitationToken: newToken,
        permissions: [] // Will be formatted in email service
      });
    }

    res.json({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        invitationId,
        expiresAt: newExpiresAt
      }
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;