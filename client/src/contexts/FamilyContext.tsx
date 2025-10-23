import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import type { FamilyPermission } from '@shared/types';

interface PatientAccess {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canClaimResponsibility: boolean;
    canManageFamily: boolean;
    canViewMedicalDetails: boolean;
    canReceiveNotifications: boolean;
  };
  accessLevel: 'full' | 'limited' | 'emergency_only';
  status: 'active' | 'suspended' | 'revoked' | 'pending' | 'expired';
  acceptedAt: Date | null;
  lastAccessAt: Date | null;
}

interface FamilyContextType {
  // User role detection
  userRole: 'patient' | 'family_member' | 'unknown';
  isLoading: boolean;
  
  // Patient access for family members
  patientsWithAccess: PatientAccess[];
  activePatientId: string | null;
  activePatientAccess: PatientAccess | null;
  
  // Actions
  switchToPatient: (patientId: string) => void;
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
  const { firebaseUser, user, isAuthenticated } = useAuth();
  const [userRole, setUserRole] = useState<'patient' | 'family_member' | 'unknown'>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [patientsWithAccess, setPatientsWithAccess] = useState<PatientAccess[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  const refreshFamilyAccess = async (retryCount = 0): Promise<void> => {
    if (!isAuthenticated || !firebaseUser) {
      console.log('🔍 Enhanced FamilyContext: Not authenticated, resetting state');
      resetToPatientMode();
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('🔍 Enhanced FamilyContext: Starting comprehensive family access check', {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        retryCount
      });
      
      // Primary API call with enhanced endpoint
      const response = await apiClient.get<{
        success: boolean;
        data: {
          patientsIHaveAccessTo: any[];
          familyMembersWithAccessToMe: any[];
          totalConnections: number;
          debugInfo: any;
        };
        error?: string;
      }>(API_ENDPOINTS.FAMILY_ACCESS);

      console.log('📊 Enhanced FamilyContext: API response:', {
        success: response.success,
        patientsCount: response.data?.patientsIHaveAccessTo?.length || 0,
        debugInfo: response.data?.debugInfo
      });

      if (response.success && response.data) {
        const { patientsIHaveAccessTo, debugInfo } = response.data;
        
        if (patientsIHaveAccessTo.length > 0) {
          // Success: User is a family member
          console.log('👨‍👩‍👧‍👦 Enhanced FamilyContext: User confirmed as family member');
          setUserRole('family_member');
          
          const patientAccess: PatientAccess[] = patientsIHaveAccessTo.map((access: any) => ({
            id: access.id,
            patientId: access.patientId,
            patientName: access.patientName,
            patientEmail: access.patientEmail,
            permissions: access.permissions,
            accessLevel: access.accessLevel,
            status: access.status,
            acceptedAt: access.acceptedAt ? new Date(access.acceptedAt) : null,
            lastAccessAt: access.lastAccessAt ? new Date(access.lastAccessAt) : null,
          }));
          
          setPatientsWithAccess(patientAccess);
          
          // Smart active patient selection with multiple strategies
          const activePatient = selectActivePatient(patientAccess);
          if (activePatient) {
            setActivePatientId(activePatient.patientId);
            console.log('🎯 Enhanced FamilyContext: Set active patient:', {
              name: activePatient.patientName,
              id: activePatient.patientId,
              method: getSelectionMethod(activePatient, patientAccess)
            });
            
            // Update user preferences for future sessions
            localStorage.setItem('lastActivePatientId', activePatient.patientId);
            
            // Clear sessionStorage backup once patient context is properly loaded
            const pendingPatientId = sessionStorage.getItem('pendingPatientId');
            if (pendingPatientId) {
              console.log('🧹 FamilyContext: Clearing sessionStorage backup, patient context now loaded');
              sessionStorage.removeItem('pendingPatientId');
            }
          }
        } else {
          // No family access found - user is a patient
          console.log('👤 Enhanced FamilyContext: User confirmed as patient');
          setUserRole('patient');
          setPatientsWithAccess([]);
          setActivePatientId(firebaseUser.uid);
        }
      } else {
        // API call failed - attempt fallback strategies
        console.log('⚠️ Enhanced FamilyContext: Primary API failed, attempting fallbacks');
        const fallbackSuccess = await attemptFallbackStrategies();
        
        if (!fallbackSuccess) {
          if (retryCount < 2) {
            // Retry with exponential backoff
            console.log(`🔄 Enhanced FamilyContext: Retrying (${retryCount + 1}/3)`);
            setTimeout(() => refreshFamilyAccess(retryCount + 1), Math.pow(2, retryCount) * 1000);
            return;
          } else {
            // Final fallback to patient mode
            console.log('❌ Enhanced FamilyContext: All attempts failed, defaulting to patient mode');
            resetToPatientMode();
          }
        }
      }
    } catch (error) {
      console.error('❌ Enhanced FamilyContext: Critical error:', error);
      
      if (retryCount < 2) {
        setTimeout(() => refreshFamilyAccess(retryCount + 1), Math.pow(2, retryCount) * 1000);
      } else {
        resetToPatientMode();
      }
    } finally {
      setIsLoading(false);
      console.log('🔍 Enhanced FamilyContext: Refresh complete, final state:', {
        userRole,
        activePatientId,
        patientsWithAccessCount: patientsWithAccess.length
      });
    }
  };

  // Fallback strategies when primary API fails
  const attemptFallbackStrategies = async (): Promise<boolean> => {
    try {
      // Fallback 1: Check local storage for cached patient ID
      const cachedPatientId = localStorage.getItem('lastActivePatientId');
      if (cachedPatientId && cachedPatientId !== firebaseUser?.uid) {
        console.log('🔄 Fallback 1: Found cached patient ID, attempting verification');
        const verified = await verifyPatientConnection(cachedPatientId);
        if (verified) {
          setUserRole('family_member');
          setActivePatientId(cachedPatientId);
          return true;
        }
      }
      
      // Fallback 2: Check user profile for primaryPatientId
      try {
        const userProfile = await apiClient.get<{ success: boolean; data: any }>(API_ENDPOINTS.AUTH_PROFILE);
        if ((userProfile as any).data?.primaryPatientId) {
          console.log('🔄 Fallback 2: Found primaryPatientId in user profile');
          const verified = await verifyPatientConnection((userProfile as any).data.primaryPatientId);
          if (verified) {
            setUserRole('family_member');
            setActivePatientId((userProfile as any).data.primaryPatientId);
            return true;
          }
        }
      } catch (profileError) {
        console.log('⚠️ Fallback 2: User profile check failed');
      }
      
      return false;
    } catch (error) {
      console.error('❌ Fallback strategies failed:', error);
      return false;
    }
  };

  // Verify patient connection
  const verifyPatientConnection = async (patientId: string): Promise<boolean> => {
    try {
      // Try to fetch some patient data to verify connection
      const response = await apiClient.get<{ success: boolean }>(`/patients/${patientId}/basic-info`);
      return (response as any).success;
    } catch (error) {
      console.log('❌ Patient connection verification failed:', error);
      return false;
    }
  };

  // Smart active patient selection
  const selectActivePatient = (patientAccess: PatientAccess[]): PatientAccess | null => {
    if (patientAccess.length === 0) return null;
    
    // Strategy 0: Check sessionStorage for pending patient ID (from recent invitation acceptance)
    const pendingPatientId = sessionStorage.getItem('pendingPatientId');
    if (pendingPatientId) {
      const pending = patientAccess.find(p => p.patientId === pendingPatientId);
      if (pending && pending.status === 'active') {
        console.log('🎯 FamilyContext: Using pending patient ID from sessionStorage:', pendingPatientId);
        return pending;
      }
    }
    
    // Strategy 1: User's stored preference
    const cachedPatientId = localStorage.getItem('lastActivePatientId');
    if (cachedPatientId) {
      const preferred = patientAccess.find(p => p.patientId === cachedPatientId);
      if (preferred && preferred.status === 'active') return preferred;
    }
    
    // Strategy 2: Most recently accessed
    const recentlyAccessed = patientAccess
      .filter(p => p.lastAccessAt && p.status === 'active')
      .sort((a, b) => (b.lastAccessAt?.getTime() || 0) - (a.lastAccessAt?.getTime() || 0))[0];
    if (recentlyAccessed) return recentlyAccessed;
    
    // Strategy 3: First active patient
    const firstActive = patientAccess.find(p => p.status === 'active');
    if (firstActive) return firstActive;
    
    // Strategy 4: Any patient
    return patientAccess[0];
  };

  // Get selection method for debugging
  const getSelectionMethod = (selected: PatientAccess, allAccess: PatientAccess[]): string => {
    const cachedPatientId = localStorage.getItem('lastActivePatientId');
    if (selected.patientId === cachedPatientId) return 'cached_preference';
    
    const recentlyAccessed = allAccess
      .filter(p => p.lastAccessAt && p.status === 'active')
      .sort((a, b) => (b.lastAccessAt?.getTime() || 0) - (a.lastAccessAt?.getTime() || 0))[0];
    if (selected === recentlyAccessed) return 'most_recent';
    
    if (selected.status === 'active' && selected === allAccess.find(p => p.status === 'active')) {
      return 'first_active';
    }
    
    return 'fallback';
  };

  // Reset to patient mode
  const resetToPatientMode = (): void => {
    setUserRole('patient');
    setPatientsWithAccess([]);
    setActivePatientId(firebaseUser?.uid || null);
  };

  const switchToPatient = async (patientId: string): Promise<void> => {
    const patientAccess = patientsWithAccess.find(p => p.patientId === patientId);
    if (!patientAccess || patientAccess.status !== 'active') {
      console.warn('⚠️ Enhanced FamilyContext: Cannot switch to inactive patient:', patientId);
      throw new Error('Cannot switch to inactive or non-existent patient');
    }

    try {
      console.log('🔄 Enhanced FamilyContext: Switching to patient:', patientAccess.patientName);
      
      // Update active patient ID
      setActivePatientId(patientId);
      
      // Update preferences and access time
      localStorage.setItem('lastActivePatientId', patientId);
      await updateLastAccessTime(patientAccess.id);
      
      console.log('✅ Enhanced FamilyContext: Successfully switched to patient:', patientAccess.patientName);
      
    } catch (error) {
      console.error('❌ Enhanced FamilyContext: Failed to switch patient:', error);
      // Revert to previous patient on error
      const previousPatientId = localStorage.getItem('lastActivePatientId');
      if (previousPatientId && previousPatientId !== patientId) {
        setActivePatientId(previousPatientId);
      }
      throw error;
    }
  };

  const updateLastAccessTime = async (accessId: string) => {
    try {
      // Update last access time in the background
      await apiClient.patch(`/family-access/${accessId}/last-access`, {
        lastAccessAt: new Date()
      });
    } catch (error) {
      console.warn('⚠️ FamilyContext: Failed to update last access time:', error);
      // Non-critical error, don't throw
    }
  };

  const activePatientAccess = activePatientId 
    ? patientsWithAccess.find(p => p.patientId === activePatientId) || null
    : null;

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

  // Initialize family access when user changes
  useEffect(() => {
    if (isAuthenticated && firebaseUser) {
      refreshFamilyAccess();
    } else {
      setUserRole('unknown');
      setPatientsWithAccess([]);
      setActivePatientId(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, firebaseUser]);

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