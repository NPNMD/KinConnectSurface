import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useFamilyAccess, PatientAccess } from '@/hooks/useFamilyAccess';

interface FamilyContextType {
  // User role detection
  userRole: 'patient' | 'family_member' | 'unknown';
  isLoading: boolean;
  
  // Patient access for family members
  patientsWithAccess: PatientAccess[];
  activePatientId: string | null;
  activePatientAccess: PatientAccess | null;
  
  // Actions
  switchToPatient: (patientId: string) => Promise<void>;
  refreshFamilyAccess: () => Promise<void>;
  
  // Helper functions
  hasPermission: (permission: keyof PatientAccess['permissions']) => boolean;
  canEditPatientData: () => boolean;
  canViewPatientData: () => boolean;
  getEffectivePatientId: () => string | null; // Returns activePatientId for family members, user.id for patients
  
  // Phase 3: Additional permission helpers
  isViewOnly: () => boolean;
  isFullAccess: () => boolean;
  canPerformAction: (action: 'create' | 'edit' | 'delete' | 'manageFamily') => boolean;
  canManageFamily: () => boolean;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

interface FamilyProviderProps {
  children: ReactNode;
}

export function FamilyProvider({ children }: FamilyProviderProps) {
  const { firebaseUser } = useAuth();
  const {
    userRole,
    isLoading,
    patientsWithAccess,
    activePatientId,
    activePatientAccess,
    switchToPatient,
    refreshFamilyAccess
  } = useFamilyAccess();

  const hasPermission = (permission: keyof PatientAccess['permissions']): boolean => {
    if (userRole === 'patient') {
      return true; // Patients have all permissions on their own data
    }
    
    if (userRole === 'family_member' && activePatientAccess) {
      return activePatientAccess.permissions[permission];
    }
    
    return false;
  };

  const canEditPatientData = (): boolean => {
    return hasPermission('canEdit') || hasPermission('canCreate') || hasPermission('canDelete');
  };

  const canViewPatientData = (): boolean => {
    return hasPermission('canView') || hasPermission('canViewMedicalDetails');
  };

  const getEffectivePatientId = (): string | null => {
    if (userRole === 'patient') {
      const patientId = firebaseUser?.uid || null;
      console.log('🔍 FamilyContext.getEffectivePatientId: Patient mode, returning:', patientId);
      return patientId;
    }
    
    if (userRole === 'family_member') {
      // CRITICAL: Never return the family member's own ID
      if (activePatientId && activePatientId !== firebaseUser?.uid) {
        console.log('🔍 FamilyContext.getEffectivePatientId: Family member mode, returning patient ID:', activePatientId);
        return activePatientId;
      }
      
      // Check sessionStorage as backup
      const pendingPatientId = sessionStorage.getItem('pendingPatientId');
      if (pendingPatientId && pendingPatientId !== firebaseUser?.uid) {
        console.log('🔍 FamilyContext.getEffectivePatientId: Using sessionStorage backup:', pendingPatientId);
        return pendingPatientId;
      }
      
      // If activePatientId is null or equals family member's ID, return null
      console.warn('⚠️ FamilyContext.getEffectivePatientId: Family member but no valid patient ID set!', {
        activePatientId,
        familyMemberId: firebaseUser?.uid,
        pendingPatientId
      });
      return null;
    }
    
    console.log('🔍 FamilyContext.getEffectivePatientId: Unknown role, returning null');
    return null;
  };

  // Phase 3: Additional permission helper methods
  const isViewOnly = (): boolean => {
    if (userRole === 'patient') {
      return false; // Patients are never view-only
    }
    
    if (userRole === 'family_member' && activePatientAccess) {
      // View-only means can view but cannot create, edit, or delete
      return (
        activePatientAccess.permissions.canView &&
        !activePatientAccess.permissions.canCreate &&
        !activePatientAccess.permissions.canEdit &&
        !activePatientAccess.permissions.canDelete
      );
    }
    
    return false;
  };

  const isFullAccess = (): boolean => {
    if (userRole === 'patient') {
      return true; // Patients always have full access to their own data
    }
    
    if (userRole === 'family_member' && activePatientAccess) {
      // Full access means can create, edit, and delete
      return (
        activePatientAccess.permissions.canCreate &&
        activePatientAccess.permissions.canEdit &&
        activePatientAccess.permissions.canDelete
      );
    }
    
    return false;
  };

  const canPerformAction = (action: 'create' | 'edit' | 'delete' | 'manageFamily'): boolean => {
    if (userRole === 'patient') {
      return true; // Patients can perform all actions
    }
    
    if (userRole === 'family_member' && activePatientAccess) {
      switch (action) {
        case 'create':
          return activePatientAccess.permissions.canCreate;
        case 'edit':
          return activePatientAccess.permissions.canEdit;
        case 'delete':
          return activePatientAccess.permissions.canDelete;
        case 'manageFamily':
          return activePatientAccess.permissions.canManageFamily;
        default:
          return false;
      }
    }
    
    return false;
  };

  const canManageFamily = (): boolean => {
    return hasPermission('canManageFamily');
  };

  const value: FamilyContextType = {
    userRole,
    isLoading,
    patientsWithAccess,
    activePatientId,
    activePatientAccess,
    switchToPatient,
    refreshFamilyAccess,
    hasPermission,
    canEditPatientData,
    canViewPatientData,
    getEffectivePatientId,
    isViewOnly,
    isFullAccess,
    canPerformAction,
    canManageFamily,
  };

  console.log('🔍 FamilyContext state:', {
    userRole,
    isLoading,
    patientsWithAccessCount: patientsWithAccess.length,
    activePatientId,
    activePatientName: activePatientAccess?.patientName,
    effectivePatientId: getEffectivePatientId(),
    timestamp: new Date().toISOString()
  });

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
