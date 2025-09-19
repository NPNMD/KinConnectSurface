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

  // Enhanced family invitation acceptance with transaction-based updates
  async acceptFamilyInvitation(
    invitationToken: string,
    familyMemberId: string
  ): Promise<ApiResponse<FamilyCalendarAccess>> {
    
    // Start transaction for atomic updates
    const batch = adminDb.batch();
    
    try {
      console.log('🔍 Enhanced FamilyAccessService: Starting invitation acceptance', {
        invitationToken,
        familyMemberId
      });
      
      // 1. Find and validate invitation
      const invitationQuery = await this.familyAccessCollection
        .where('invitationToken', '==', invitationToken)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (invitationQuery.empty) {
        console.log('❌ FamilyAccessService: No pending invitation found for token:', invitationToken);
        return {
          success: false,
          error: 'Invalid or expired invitation token'
        };
      }

      const invitationDoc = invitationQuery.docs[0];
      const invitation = invitationDoc.data() as FamilyCalendarAccess;
      
      console.log('✅ FamilyAccessService: Found invitation:', {
        id: invitationDoc.id,
        patientId: invitation.patientId,
        familyMemberEmail: invitation.familyMemberEmail,
        status: invitation.status
      });

      // 2. Validate invitation hasn't expired
      if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt) {
        console.log('❌ FamilyAccessService: Invitation has expired:', invitation.invitationExpiresAt);
        return {
          success: false,
          error: 'Invitation has expired'
        };
      }

      // 3. Validate familyMemberId
      if (!familyMemberId || familyMemberId.trim() === '') {
        console.log('❌ FamilyAccessService: Invalid familyMemberId provided:', familyMemberId);
        return {
          success: false,
          error: 'Invalid family member ID'
        };
      }

      // 4. Get user info for enhanced updates
      const userResult = await this.getUserById(familyMemberId);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'Family member user not found'
        };
      }

      // 5. Update family_calendar_access record
      const accessUpdateData = {
        familyMemberId: familyMemberId.trim(),
        status: 'active',
        acceptedAt: new Date(),
        updatedAt: new Date(),
        invitationToken: adminDb.FieldValue.delete(),
        invitationExpiresAt: adminDb.FieldValue.delete(),
        connectionVerified: true,
        lastVerificationAt: new Date()
      };
      
      batch.update(invitationDoc.ref, accessUpdateData);

      // 6. Update user record with family member metadata
      const userRef = this.usersCollection.doc(familyMemberId);
      const userUpdateData: any = {
        primaryPatientId: invitation.patientId,
        familyMemberOf: adminDb.FieldValue.arrayUnion(invitation.patientId),
        lastFamilyAccessCheck: new Date(),
        invitationHistory: adminDb.FieldValue.arrayUnion({
          invitationId: invitation.id,
          acceptedAt: new Date(),
          patientId: invitation.patientId
        }),
        updatedAt: new Date()
      };
      
      batch.update(userRef, userUpdateData);

      // 7. Commit transaction
      await batch.commit();
      console.log('✅ Enhanced FamilyAccessService: Transaction committed successfully');

      // 8. Verify the updates worked
      const verificationResult = await this.verifyInvitationAcceptance(
        invitationDoc.id,
        familyMemberId,
        invitation.patientId
      );
      
      if (!verificationResult.success) {
        console.error('❌ Enhanced FamilyAccessService: Verification failed:', verificationResult.issues);
        // Attempt repair
        await this.repairFailedInvitationAcceptance(
          invitationDoc.id,
          familyMemberId,
          invitation.patientId
        );
      }

      // 9. Get final access record
      const finalDoc = await invitationDoc.ref.get();
      const finalAccess = { id: finalDoc.id, ...finalDoc.data() } as FamilyCalendarAccess;

      // 10. Log successful acceptance
      await this.logFamilyAccessAction(invitation.patientId, familyMemberId, 'invitation_accepted', {
        familyMemberEmail: invitation.familyMemberEmail,
        accessLevel: invitation.accessLevel,
        invitationId: invitationDoc.id,
        verificationStatus: verificationResult.success ? 'verified' : 'repair_attempted'
      });

      console.log('🎉 Enhanced FamilyAccessService: Invitation acceptance completed successfully');

      return {
        success: true,
        data: finalAccess
      };

    } catch (error) {
      console.error('❌ Enhanced FamilyAccessService: Critical error during invitation acceptance:', error);
      
      // Attempt rollback if possible
      try {
        await this.rollbackFailedInvitationAcceptance(invitationToken, familyMemberId);
      } catch (rollbackError) {
        console.error('❌ Rollback also failed:', rollbackError);
      }

      return {
        success: false,
        error: 'Failed to accept family invitation'
      };
    }
  }

  // Verification method to ensure invitation acceptance worked
  async verifyInvitationAcceptance(
    accessId: string,
    familyMemberId: string,
    patientId: string
  ): Promise<{ success: boolean; issues?: string[] }> {
    
    const issues: string[] = [];
    
    try {
      // Check 1: Family access record updated correctly
      const accessDoc = await this.familyAccessCollection.doc(accessId).get();
      if (!accessDoc.exists) {
        issues.push('Family access record not found');
      } else {
        const accessData = accessDoc.data() as FamilyCalendarAccess;
        if (accessData.familyMemberId !== familyMemberId) {
          issues.push('familyMemberId not set correctly');
        }
        if (accessData.status !== 'active') {
          issues.push('Status not set to active');
        }
      }
      
      // Check 2: User record updated correctly
      const userDoc = await this.usersCollection.doc(familyMemberId).get();
      if (!userDoc.exists) {
        issues.push('User record not found');
      } else {
        const userData = userDoc.data();
        if (userData.primaryPatientId !== patientId) {
          issues.push('primaryPatientId not set correctly');
        }
        if (!userData.familyMemberOf?.includes(patientId)) {
          issues.push('familyMemberOf array not updated');
        }
      }
      
      // Check 3: Can query family access successfully
      const queryResult = await this.getFamilyAccessByMemberId(familyMemberId);
      if (!queryResult.success || !queryResult.data?.length) {
        issues.push('Cannot query family access after acceptance');
      }
      
      return {
        success: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined
      };
      
    } catch (error) {
      console.error('❌ Verification check failed:', error);
      return {
        success: false,
        issues: ['Verification check failed due to error']
      };
    }
  }

  // Repair failed invitation acceptance
  async repairFailedInvitationAcceptance(
    accessId: string,
    familyMemberId: string,
    patientId: string
  ): Promise<void> {
    try {
      console.log('🔧 Attempting to repair failed invitation acceptance');
      
      const batch = adminDb.batch();
      
      // Repair family access record
      const accessRef = this.familyAccessCollection.doc(accessId);
      batch.update(accessRef, {
        familyMemberId,
        status: 'active',
        repairedAt: new Date(),
        repairReason: 'failed_invitation_acceptance_repair'
      });
      
      // Repair user record
      const userRef = this.usersCollection.doc(familyMemberId);
      batch.update(userRef, {
        primaryPatientId: patientId,
        familyMemberOf: adminDb.FieldValue.arrayUnion(patientId),
        lastFamilyAccessCheck: new Date()
      });
      
      await batch.commit();
      console.log('✅ Repair completed successfully');
      
    } catch (error) {
      console.error('❌ Repair failed:', error);
    }
  }

  // Rollback failed invitation acceptance
  async rollbackFailedInvitationAcceptance(
    invitationToken: string,
    familyMemberId: string
  ): Promise<void> {
    try {
      console.log('🔄 Attempting rollback of failed invitation acceptance');
      
      // Find the invitation and reset it to pending
      const invitationQuery = await this.familyAccessCollection
        .where('invitationToken', '==', invitationToken)
        .limit(1)
        .get();
      
      if (!invitationQuery.empty) {
        const invitationDoc = invitationQuery.docs[0];
        await invitationDoc.ref.update({
          status: 'pending',
          familyMemberId: '',
          acceptedAt: adminDb.FieldValue.delete(),
          rollbackAt: new Date(),
          rollbackReason: 'failed_acceptance_rollback'
        });
        
        console.log('✅ Rollback completed');
      }
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
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

  // Get family access for a family member with enhanced fallbacks
  async getFamilyAccessByMemberId(familyMemberId: string): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    try {
      console.log('🔍 FamilyAccessService: Getting family access for member:', familyMemberId);
      
      // First try with orderBy, but fall back to simple query if it fails
      let query;
      try {
        query = await this.familyAccessCollection
          .where('familyMemberId', '==', familyMemberId)
          .where('status', '==', 'active')
          .orderBy('lastAccessAt', 'desc')
          .get();
      } catch (orderByError: any) {
        console.log('⚠️ FamilyAccessService: orderBy failed, trying simple query:', orderByError?.message || 'Unknown error');
        // Fallback to simple query without orderBy
        query = await this.familyAccessCollection
          .where('familyMemberId', '==', familyMemberId)
          .where('status', '==', 'active')
          .get();
      }

      console.log(`📊 FamilyAccessService: Found ${query.docs.length} active access records for family member`);

      const accessRecords = query.docs.map((doc: any) => {
        const data = doc.data();
        console.log(`   ├─ Record: ${doc.id}, Patient: ${data.patientId}, Status: ${data.status}`);
        return {
          id: doc.id,
          ...data
        } as FamilyCalendarAccess;
      });

      // Sort manually if we couldn't use orderBy
      accessRecords.sort((a: FamilyCalendarAccess, b: FamilyCalendarAccess) => {
        const aTime = a.lastAccessAt ? new Date(a.lastAccessAt).getTime() : 0;
        const bTime = b.lastAccessAt ? new Date(b.lastAccessAt).getTime() : 0;
        return bTime - aTime; // desc order
      });

      console.log(`✅ FamilyAccessService: Returning ${accessRecords.length} access records`);

      return {
        success: true,
        data: accessRecords
      };
    } catch (error) {
      console.error('❌ FamilyAccessService: Error getting family member access:', error);
      return {
        success: false,
        error: 'Failed to retrieve family member access records'
      };
    }
  }

  // Enhanced family access retrieval with multiple fallback mechanisms
  async getFamilyAccessWithFallbacks(
    familyMemberId: string,
    familyMemberEmail?: string
  ): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    
    console.log('🔍 Enhanced Family Access: Starting multi-layer query', {
      familyMemberId,
      familyMemberEmail
    });
    
    // Layer 1: Primary query by familyMemberId
    let result = await this.getFamilyAccessByMemberId(familyMemberId);
    
    if (result.success && result.data && result.data.length > 0) {
      console.log('✅ Layer 1 Success: Found access by familyMemberId');
      await this.updateLastQueryTime(result.data);
      return result;
    }
    
    // Layer 2: Email fallback with auto-repair
    if (familyMemberEmail) {
      console.log('🔄 Layer 2: Trying email fallback');
      result = await this.getFamilyAccessByEmail(familyMemberEmail);
      
      if (result.success && result.data && result.data.length > 0) {
        console.log('✅ Layer 2 Success: Found access by email, performing auto-repair');
        await this.autoRepairMissingFamilyMemberId(result.data, familyMemberId);
        return result;
      }
    }
    
    // Layer 3: User's stored primaryPatientId
    console.log('🔄 Layer 3: Checking user primaryPatientId');
    const userResult = await this.getUserById(familyMemberId);
    if (userResult.success && userResult.data && (userResult.data as any).primaryPatientId) {
      console.log('✅ Layer 3: Found primaryPatientId, creating emergency access');
      return await this.createEmergencyFamilyAccess(
        familyMemberId,
        (userResult.data as any).primaryPatientId
      );
    }
    
    console.log('❌ All layers failed: No family access found');
    return {
      success: false,
      error: 'No family access found through any method'
    };
  }

  // Get family access by email (for fallback)
  async getFamilyAccessByEmail(familyMemberEmail: string): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    try {
      console.log('🔍 FamilyAccessService: Getting family access by email:', familyMemberEmail);
      
      const query = await this.familyAccessCollection
        .where('familyMemberEmail', '==', familyMemberEmail.toLowerCase())
        .where('status', '==', 'active')
        .get();

      console.log(`📊 FamilyAccessService: Found ${query.docs.length} active access records by email`);

      const accessRecords = query.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as FamilyCalendarAccess));

      return {
        success: true,
        data: accessRecords
      };
    } catch (error) {
      console.error('❌ FamilyAccessService: Error getting family access by email:', error);
      return {
        success: false,
        error: 'Failed to retrieve family access records by email'
      };
    }
  }

  // Auto-repair missing familyMemberId fields
  async autoRepairMissingFamilyMemberId(
    accessRecords: FamilyCalendarAccess[],
    familyMemberId: string
  ): Promise<void> {
    const batch = adminDb.batch();
    
    for (const access of accessRecords) {
      if (!access.familyMemberId || access.familyMemberId === '') {
        const accessRef = this.familyAccessCollection.doc(access.id);
        batch.update(accessRef, {
          familyMemberId,
          repairedAt: new Date(),
          repairReason: 'auto_repair_missing_family_member_id',
          repairCount: ((access as any).repairCount || 0) + 1,
          updatedAt: new Date()
        });
        
        console.log('🔧 Auto-repairing access record:', access.id);
      }
    }
    
    await batch.commit();
    console.log('✅ Auto-repair completed');
  }

  // Create emergency family access when other methods fail
  async createEmergencyFamilyAccess(
    familyMemberId: string,
    patientId: string
  ): Promise<ApiResponse<FamilyCalendarAccess[]>> {
    
    // Verify the patient exists and get their info
    const patientUser = await this.getUserById(patientId);
    if (!patientUser.success) {
      return {
        success: false,
        error: 'Patient not found for emergency access creation'
      };
    }
    
    // Create emergency access record
    const emergencyAccess: FamilyCalendarAccess = {
      id: `emergency_${Date.now()}`,
      patientId,
      familyMemberId,
      familyMemberName: 'Emergency Access',
      familyMemberEmail: '',
      permissions: {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canClaimResponsibility: false,
        canManageFamily: false,
        canViewMedicalDetails: true,
        canReceiveNotifications: false
      },
      accessLevel: 'limited',
      emergencyAccess: true,
      status: 'active',
      invitedAt: new Date(),
      acceptedAt: new Date(),
      createdBy: patientId,
      createdAt: new Date(),
      updatedAt: new Date(),
      repairReason: 'emergency_access_creation'
    };
    
    // Save to database
    await this.familyAccessCollection.doc(emergencyAccess.id).set(emergencyAccess);
    
    console.log('🚨 Created emergency family access:', emergencyAccess.id);
    
    return {
      success: true,
      data: [emergencyAccess]
    };
  }

  // Update last query time for access records
  async updateLastQueryTime(accessRecords: FamilyCalendarAccess[]): Promise<void> {
    try {
      const batch = adminDb.batch();
      const now = new Date();
      
      for (const access of accessRecords) {
        const accessRef = this.familyAccessCollection.doc(access.id);
        batch.update(accessRef, {
          lastQueryAt: now,
          updatedAt: now
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('❌ Failed to update last query time:', error);
    }
  }

  // Get family access by invitation token
  async getFamilyAccessByToken(invitationToken: string): Promise<ApiResponse<FamilyCalendarAccess>> {
    try {
      const query = await this.familyAccessCollection
        .where('invitationToken', '==', invitationToken)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (query.empty) {
        return {
          success: false,
          error: 'Invitation not found or expired'
        };
      }

      const doc = query.docs[0];
      const invitation = { id: doc.id, ...doc.data() } as FamilyCalendarAccess;

      // Check if invitation has expired
      if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt) {
        return {
          success: false,
          error: 'Invitation has expired'
        };
      }

      return {
        success: true,
        data: invitation
      };
    } catch (error) {
      console.error('Error getting invitation by token:', error);
      return {
        success: false,
        error: 'Failed to retrieve invitation'
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