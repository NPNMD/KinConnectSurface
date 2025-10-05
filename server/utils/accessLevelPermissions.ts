import type { FamilyCalendarAccess } from '@shared/types';

/**
 * Derives permission object from access level
 * 
 * This utility function maps access levels to their corresponding permission sets.
 * It provides a centralized way to manage permission derivation for family member invitations.
 * 
 * @param accessLevel - The access level to derive permissions from ('full' | 'view_only')
 * @returns Permission object with all permission flags set according to the access level
 * 
 * @example
 * ```typescript
 * const permissions = derivePermissionsFromAccessLevel('full');
 * // Returns: { canView: true, canCreate: true, canEdit: true, ... }
 * ```
 */
export function derivePermissionsFromAccessLevel(
  accessLevel: 'full' | 'view_only'
): FamilyCalendarAccess['permissions'] {
  
  // Full Access: Complete control over patient's calendar and medical information
  if (accessLevel === 'full') {
    return {
      canView: true,                    // Can view all appointments and events
      canCreate: true,                  // Can create new appointments
      canEdit: true,                    // Can edit existing appointments
      canDelete: true,                  // Can delete appointments
      canClaimResponsibility: true,     // Can claim transportation responsibilities
      canManageFamily: true,            // Can manage other family members' access
      canViewMedicalDetails: true,      // Can view detailed medical information
      canReceiveNotifications: true     // Can receive email/SMS notifications
    };
  }
  
  // View Only Access: Read-only access with limited interaction capabilities
  if (accessLevel === 'view_only') {
    return {
      canView: true,                    // Can view appointments and events
      canCreate: false,                 // Cannot create appointments
      canEdit: false,                   // Cannot edit appointments
      canDelete: false,                 // Cannot delete appointments
      canClaimResponsibility: true,     // Can claim transportation responsibilities
      canManageFamily: false,           // Cannot manage family access
      canViewMedicalDetails: false,     // Cannot view detailed medical information
      canReceiveNotifications: true     // Can receive notifications
    };
  }
  
  // Default fallback (should never reach here with TypeScript)
  return {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canClaimResponsibility: false,
    canManageFamily: false,
    canViewMedicalDetails: false,
    canReceiveNotifications: true
  };
}

/**
 * Validates if an access level is valid
 * 
 * @param accessLevel - The access level to validate
 * @returns True if the access level is valid, false otherwise
 */
export function isValidAccessLevel(accessLevel: string): accessLevel is 'full' | 'view_only' {
  return accessLevel === 'full' || accessLevel === 'view_only';
}

/**
 * Gets a human-readable description of an access level
 * 
 * @param accessLevel - The access level to describe
 * @returns A description of what the access level allows
 */
export function getAccessLevelDescription(accessLevel: 'full' | 'view_only'): string {
  const descriptions = {
    full: 'Full access to view, create, edit, and manage all appointments and medical information',
    view_only: 'View-only access to appointments with ability to claim transportation responsibilities'
  };
  
  return descriptions[accessLevel];
}