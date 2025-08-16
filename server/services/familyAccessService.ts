import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '@shared/firebase';
import { emailService } from './emailService';
import type { 
  FamilyCalendarAccess, 
  NewFamilyCalendarAccess,
  ApiResponse,
  User
} from '@shared/types';

export class FamilyAccessService {
  private familyAccessCollection = adminDb.collection(COLLECTIONS.FAMILY_CALENDAR_ACCESS);
  private usersCollection = adminDb.collection(COLLECTIONS.USERS);

  // ===== FAMILY ACCESS MANAGEMENT =====

  // Create family calendar access invitation
  async createFamilyInvitation(
    patientId: string,
    familyMemberEmail: string,
    familyMemberName: string,
    permissions: FamilyCalendarAccess['permissions'],
    accessLevel: 'full' | 'limited' | 'emergency_only',
    invitedBy: string,
    eventTypesAllowed?: import('@shared/types').MedicalEventType[]
  ): Promise<ApiResponse<{ invitation: FamilyCalendarAccess; invitationToken: string }>> {
    try {
      // Check if invitation already exists
      const existingQuery = await this.familyAccessCollection
        .where('patientId', '==', patientId)
        .where('familyMemberEmail', '==', familyMemberEmail)
        .where('status', 'in', ['active', 'pending'])
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        return {
          success: false,
          error: 'Family member already has access or has a pending invitation'
        };
      }

      // Generate invitation token
      const invitationToken = this.generateInvitationToken();
      
      // Create family access record
      const accessRef = this.familyAccessCollection.doc();
      const familyAccess: FamilyCalendarAccess = {
        id: accessRef.id,
        patientId,
        familyMemberId: '', // Will be set when invitation is accepted
        familyMemberName,
        familyMemberEmail,
        permissions,
        accessLevel,
        eventTypesAllowed: eventTypesAllowed || [],
        emergencyAccess: accessLevel === 'emergency_only',
        emergencyContactPriority: accessLevel === 'emergency_only' ? 1 : undefined,
        status: 'pending',
        invitedAt: new Date(),
        createdBy: invitedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        invitationToken,
        invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      await accessRef.set(familyAccess);

      // Send invitation email
      const patientUser = await this.getUserById(patientId);
      if (patientUser.success && patientUser.data) {
        await emailService.sendFamilyInvitation({
          patientName: patientUser.data.name,
          patientEmail: patientUser.data.email,
          familyMemberName,
          familyMemberEmail,
          invitationToken,
          permissions: this.formatPermissionsForEmail(permissions)
        });
      }

      // Log invitation creation
      await this.logFamilyAccessAction(patientId, invitedBy, 'invitation_sent', {
        familyMemberEmail,
        accessLevel,
        permissions
      });

      return {
        success: true,
        data: { invitation: familyAccess, invitationToken }
      };
    } catch (error) {
      console.error('Error creating family invitation:', error);
      return {
        success: false,
        error: 'Failed to create family invitation'
      };
    }
  }

  // Accept family invitation
  async acceptFamilyInvitation(
    invitationToken: string,
    familyMemberId: string
  ): Promise<ApiResponse<FamilyCalendarAccess>> {
    try {
      // Find invitation by token
      const invitationQuery = await this.familyAccessCollection
        .where('invitationToken', '==', invitationToken)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (invitationQuery.empty) {
        return {
          success: false,
          error: 'Invalid or expired invitation token'
        };
      }

      const invitationDoc = invitationQuery.docs[0];
      const invitation = invitationDoc.data() as FamilyCalendarAccess;

      // Check if invitation has expired
      if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt) {
        return {
          success: false,
          error: 'Invitation has expired'
        };
      }

      // Update invitation with family member ID and activate
      const updatedAccess: Partial<FamilyCalendarAccess> = {
        familyMemberId,
        status: 'active',
        acceptedAt: new Date(),
        updatedAt: new Date(),
        invitationToken: undefined, // Remove token after acceptance
        invitationExpiresAt: undefined
      };

      await invitationDoc.ref.update(updatedAccess);

      // Get updated access record
      const updatedDoc = await invitationDoc.ref.get();
      const finalAccess = { id: updatedDoc.id, ...updatedDoc.data() } as FamilyCalendarAccess;

      // Log invitation acceptance
      await this.logFamilyAccessAction(invitation.patientId, familyMemberId, 'invitation_accepted', {
        familyMemberEmail: invitation.familyMemberEmail,
        accessLevel: invitation.accessLevel
      });

      return {
        success: true,
        data: finalAccess
      };
    } catch (error) {
      console.error('Error accepting family invitation:', error);
      return {
        success: false,
        error: 'Failed to accept family invitation'
      };
    }
  }

  // Get family access for a patient
  async getFamilyAccessByPatientId(patientId: string): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    try {
      const query = await this.familyAccessCollection
        .where('patientId', '==', patientId)
        .orderBy('createdAt', 'desc')
        .get();

      const accessRecords = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as FamilyCalendarAccess));

      return {
        success: true,
        data: accessRecords
      };
    } catch (error) {
      console.error('Error getting family access:', error);
      return {
        success: false,
        error: 'Failed to retrieve family access records'
      };
    }
  }

  // Get family access for a family member
  async getFamilyAccessByMemberId(familyMemberId: string): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    try {
      const query = await this.familyAccessCollection
        .where('familyMemberId', '==', familyMemberId)
        .where('status', '==', 'active')
        .orderBy('lastAccessAt', 'desc')
        .get();

      const accessRecords = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as FamilyCalendarAccess));

      return {
        success: true,
        data: accessRecords
      };
    } catch (error) {
      console.error('Error getting family member access:', error);
      return {
        success: false,
        error: 'Failed to retrieve family member access records'
      };
    }
  }

  // Check if user has specific permission for patient
  async checkPermission(
    patientId: string,
    userId: string,
    permission: keyof FamilyCalendarAccess['permissions']
  ): Promise<{ hasPermission: boolean; accessLevel?: string; isPatient?: boolean }> {
    try {
      // Check if user is the patient themselves
      if (patientId === userId) {
        return { hasPermission: true, isPatient: true };
      }

      // Check family access
      const accessQuery = await this.familyAccessCollection
        .where('patientId', '==', patientId)
        .where('familyMemberId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (accessQuery.empty) {
        return { hasPermission: false };
      }

      const access = accessQuery.docs[0].data() as FamilyCalendarAccess;
      
      // Update last access time
      await accessQuery.docs[0].ref.update({
        lastAccessAt: new Date(),
        updatedAt: new Date()
      });

      return {
        hasPermission: access.permissions[permission] === true,
        accessLevel: access.accessLevel
      };
    } catch (error) {
      console.error('Error checking permission:', error);
      return { hasPermission: false };
    }
  }

  // Update family access permissions
  async updateFamilyAccess(
    accessId: string,
    updates: Partial<FamilyCalendarAccess>,
    updatedBy: string
  ): Promise<ApiResponse<FamilyCalendarAccess>> {
    try {
      const accessDoc = await this.familyAccessCollection.doc(accessId).get();
      
      if (!accessDoc.exists) {
        return {
          success: false,
          error: 'Family access record not found'
        };
      }

      const currentAccess = accessDoc.data() as FamilyCalendarAccess;

      // Check if user has permission to update this access
      const canUpdateResult = await this.checkPermission(currentAccess.patientId, updatedBy, 'canManageFamily');
      const canUpdate = currentAccess.patientId === updatedBy || canUpdateResult.hasPermission;

      if (!canUpdate) {
        return {
          success: false,
          error: 'Access denied - cannot update family access'
        };
      }

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await accessDoc.ref.update(updateData);

      // Get updated record
      const updatedDoc = await accessDoc.ref.get();
      const updatedAccess = { id: updatedDoc.id, ...updatedDoc.data() } as FamilyCalendarAccess;

      // Log access update
      await this.logFamilyAccessAction(currentAccess.patientId, updatedBy, 'access_updated', {
        familyMemberEmail: currentAccess.familyMemberEmail,
        changes: updates
      });

      return {
        success: true,
        data: updatedAccess
      };
    } catch (error) {
      console.error('Error updating family access:', error);
      return {
        success: false,
        error: 'Failed to update family access'
      };
    }
  }

  // Revoke family access
  async revokeFamilyAccess(
    accessId: string,
    revokedBy: string,
    reason?: string
  ): Promise<ApiResponse<void>> {
    try {
      const accessDoc = await this.familyAccessCollection.doc(accessId).get();
      
      if (!accessDoc.exists) {
        return {
          success: false,
          error: 'Family access record not found'
        };
      }

      const access = accessDoc.data() as FamilyCalendarAccess;

      // Check if user has permission to revoke this access
      const canRevokeResult = await this.checkPermission(access.patientId, revokedBy, 'canManageFamily');
      const canRevoke = access.patientId === revokedBy ||
                       access.familyMemberId === revokedBy ||
                       canRevokeResult.hasPermission;

      if (!canRevoke) {
        return {
          success: false,
          error: 'Access denied - cannot revoke family access'
        };
      }

      // Update status to revoked instead of deleting
      await accessDoc.ref.update({
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy,
        revocationReason: reason,
        updatedAt: new Date()
      });

      // Log access revocation
      await this.logFamilyAccessAction(access.patientId, revokedBy, 'access_revoked', {
        familyMemberEmail: access.familyMemberEmail,
        reason
      });

      return { success: true };
    } catch (error) {
      console.error('Error revoking family access:', error);
      return {
        success: false,
        error: 'Failed to revoke family access'
      };
    }
  }

  // Emergency access override
  async grantEmergencyAccess(
    patientId: string,
    familyMemberId: string,
    grantedBy: string,
    duration: number = 24 // hours
  ): Promise<ApiResponse<FamilyCalendarAccess>> {
    try {
      // Create temporary emergency access
      const accessRef = this.familyAccessCollection.doc();
      const emergencyAccess: FamilyCalendarAccess = {
        id: accessRef.id,
        patientId,
        familyMemberId,
        familyMemberName: 'Emergency Access',
        familyMemberEmail: '',
        permissions: {
          canView: true,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canClaimResponsibility: true,
          canManageFamily: false,
          canViewMedicalDetails: true,
          canReceiveNotifications: true
        },
        accessLevel: 'emergency_only',
        emergencyAccess: true,
        emergencyContactPriority: 1,
        status: 'active',
        invitedAt: new Date(),
        acceptedAt: new Date(),
        emergencyAccessExpiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
        createdBy: grantedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await accessRef.set(emergencyAccess);

      // Log emergency access grant
      await this.logFamilyAccessAction(patientId, grantedBy, 'emergency_access_granted', {
        familyMemberId,
        duration
      });

      return {
        success: true,
        data: emergencyAccess
      };
    } catch (error) {
      console.error('Error granting emergency access:', error);
      return {
        success: false,
        error: 'Failed to grant emergency access'
      };
    }
  }

  // ===== HELPER METHODS =====

  private async getUserById(userId: string): Promise<ApiResponse<User>> {
    try {
      const userDoc = await this.usersCollection.doc(userId).get();
      
      if (!userDoc.exists) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return {
        success: true,
        data: { id: userDoc.id, ...userDoc.data() } as User
      };
    } catch (error) {
      console.error('Error getting user:', error);
      return {
        success: false,
        error: 'Failed to get user'
      };
    }
  }

  private generateInvitationToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatPermissionsForEmail(permissions: FamilyCalendarAccess['permissions']): string[] {
    const permissionMap: Record<string, string> = {
      'canView': 'View medical appointments and events',
      'canCreate': 'Create new appointments',
      'canEdit': 'Edit existing appointments',
      'canDelete': 'Delete appointments',
      'canClaimResponsibility': 'Claim transportation responsibilities',
      'canManageFamily': 'Manage family member access',
      'canViewMedicalDetails': 'View detailed medical information',
      'canReceiveNotifications': 'Receive email notifications'
    };

    return Object.entries(permissions)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => permissionMap[key] || key);
  }

  private async logFamilyAccessAction(
    patientId: string,
    userId: string,
    action: string,
    details: any
  ): Promise<void> {
    try {
      const logRef = adminDb.collection('family_access_logs').doc();
      await logRef.set({
        id: logRef.id,
        patientId,
        userId,
        action,
        details,
        timestamp: new Date(),
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error logging family access action:', error);
    }
  }

  // Clean up expired invitations and emergency access
  async cleanupExpiredAccess(): Promise<void> {
    try {
      const now = new Date();
      
      // Clean up expired invitations
      const expiredInvitations = await this.familyAccessCollection
        .where('status', '==', 'pending')
        .where('invitationExpiresAt', '<=', now)
        .get();

      const expiredEmergencyAccess = await this.familyAccessCollection
        .where('emergencyAccess', '==', true)
        .where('emergencyAccessExpiresAt', '<=', now)
        .get();

      const batch = adminDb.batch();

      // Update expired invitations
      expiredInvitations.docs.forEach((doc: any) => {
        batch.update(doc.ref, {
          status: 'expired',
          updatedAt: now
        });
      });

      // Update expired emergency access
      expiredEmergencyAccess.docs.forEach((doc: any) => {
        batch.update(doc.ref, {
          status: 'expired',
          updatedAt: now
        });
      });

      await batch.commit();
      
      console.log(`Cleaned up ${expiredInvitations.size} expired invitations and ${expiredEmergencyAccess.size} expired emergency access records`);
    } catch (error) {
      console.error('Error cleaning up expired access:', error);
    }
  }
}

// Export singleton instance
export const familyAccessService = new FamilyAccessService();