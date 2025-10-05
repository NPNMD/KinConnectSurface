import React from 'react';
import { useFamily } from '@/contexts/FamilyContext';

interface PermissionGateProps {
  children: React.ReactNode;
  requiredPermission: 'canCreate' | 'canEdit' | 'canDelete' | 'canManageFamily';
  fallback?: React.ReactNode;
}

/**
 * PermissionGate Component
 * 
 * Conditionally renders children based on user permissions.
 * - Patients always have all permissions
 * - Family members are checked against their access level permissions
 * - Renders fallback (or null) if permission is denied
 */
export function PermissionGate({ children, requiredPermission, fallback = null }: PermissionGateProps) {
  const { userRole, hasPermission } = useFamily();

  // Patients always have all permissions
  if (userRole === 'patient') {
    return <>{children}</>;
  }

  // Family members need to check their permissions
  if (userRole === 'family_member') {
    const hasRequiredPermission = hasPermission(requiredPermission);
    
    if (hasRequiredPermission) {
      return <>{children}</>;
    }
    
    return <>{fallback}</>;
  }

  // Unknown role - deny access
  return <>{fallback}</>;
}