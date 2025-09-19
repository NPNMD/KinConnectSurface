import React, { ReactNode } from 'react';
import { useFamily } from '@/contexts/FamilyContext';
import { Lock, Eye } from 'lucide-react';

interface PermissionWrapperProps {
  children: ReactNode;
  permission: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canClaimResponsibility' | 'canManageFamily' | 'canViewMedicalDetails' | 'canReceiveNotifications';
  fallback?: ReactNode;
  showFallback?: boolean;
  className?: string;
}

export default function PermissionWrapper({ 
  children, 
  permission, 
  fallback, 
  showFallback = false,
  className = ''
}: PermissionWrapperProps) {
  const { hasPermission, userRole, activePatientAccess } = useFamily();

  const hasRequiredPermission = hasPermission(permission);

  if (hasRequiredPermission) {
    return <>{children}</>;
  }

  if (showFallback && fallback) {
    return <div className={className}>{fallback}</div>;
  }

  if (showFallback && userRole === 'family_member') {
    // Default fallback for family members without permission
    return (
      <div className={`flex items-center space-x-2 text-gray-500 text-sm ${className}`}>
        <Lock className="w-4 h-4" />
        <span>
          {permission === 'canEdit' || permission === 'canCreate' || permission === 'canDelete' 
            ? 'View-only access' 
            : 'Access restricted'
          }
        </span>
      </div>
    );
  }

  return null;
}

// Convenience wrapper for edit permissions
interface EditPermissionWrapperProps {
  children: ReactNode;
  viewOnlyFallback?: ReactNode;
  showViewOnlyMessage?: boolean;
  className?: string;
}

export function EditPermissionWrapper({ 
  children, 
  viewOnlyFallback, 
  showViewOnlyMessage = true,
  className = ''
}: EditPermissionWrapperProps) {
  return (
    <PermissionWrapper
      permission="canEdit"
      fallback={viewOnlyFallback || (
        <div className="flex items-center space-x-2 text-gray-500 text-sm">
          <Eye className="w-4 h-4" />
          <span>View-only access</span>
        </div>
      )}
      showFallback={showViewOnlyMessage}
      className={className}
    >
      {children}
    </PermissionWrapper>
  );
}

// Convenience wrapper for create permissions
interface CreatePermissionWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
  className?: string;
}

export function CreatePermissionWrapper({ 
  children, 
  fallback, 
  showFallback = true,
  className = ''
}: CreatePermissionWrapperProps) {
  return (
    <PermissionWrapper
      permission="canCreate"
      fallback={fallback}
      showFallback={showFallback}
      className={className}
    >
      {children}
    </PermissionWrapper>
  );
}

// Convenience wrapper for delete permissions
interface DeletePermissionWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
  className?: string;
}

export function DeletePermissionWrapper({ 
  children, 
  fallback, 
  showFallback = false,
  className = ''
}: DeletePermissionWrapperProps) {
  return (
    <PermissionWrapper
      permission="canDelete"
      fallback={fallback}
      showFallback={showFallback}
      className={className}
    >
      {children}
    </PermissionWrapper>
  );
}