import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface PatientAccess {
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

interface FamilyAccessData {
  patientsIHaveAccessTo: any[];
  familyMembersWithAccessToMe: any[];
  totalConnections: number;
  debugInfo: any;
}

export function useFamilyAccess() {
  const { firebaseUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activePatientId, setActivePatientId] = useState<string | null>(() => {
    return localStorage.getItem('lastActivePatientId');
  });

  // Query for family access data
  const { 
    data: apiResponse, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['familyAccess', firebaseUser?.uid],
    queryFn: async () => {
      if (!isAuthenticated || !firebaseUser) return null;
      
      console.log('🔍 useFamilyAccess: Fetching family access data');
      return await apiClient.get<{
        success: boolean;
        data: FamilyAccessData;
        error?: string;
      }>(API_ENDPOINTS.FAMILY_ACCESS);
    },
    enabled: isAuthenticated && !!firebaseUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1
  });

  // Derive state from query data
  const patientsWithAccess = useMemo(() => {
    if (!apiResponse?.success || !apiResponse.data?.patientsIHaveAccessTo) {
      return [] as PatientAccess[];
    }

    return apiResponse.data.patientsIHaveAccessTo.map((access: any) => ({
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
  }, [apiResponse]);

  const userRole = useMemo<'patient' | 'family_member' | 'unknown'>(() => {
    if (!isAuthenticated) return 'unknown';
    if (patientsWithAccess.length > 0) return 'family_member';
    if (apiResponse?.success) return 'patient'; // API success but no patients = patient role
    return 'unknown';
  }, [isAuthenticated, patientsWithAccess.length, apiResponse?.success]);

  // Smart active patient selection logic
  const determineActivePatient = useCallback(() => {
    if (patientsWithAccess.length === 0) {
      if (userRole === 'patient') {
        setActivePatientId(firebaseUser?.uid || null);
      } else {
        setActivePatientId(null);
      }
      return;
    }

    // Strategy 0: Check sessionStorage for pending patient ID
    const pendingPatientId = sessionStorage.getItem('pendingPatientId');
    if (pendingPatientId) {
      const pending = patientsWithAccess.find(p => p.patientId === pendingPatientId);
      if (pending && pending.status === 'active') {
        setActivePatientId(pending.patientId);
        sessionStorage.removeItem('pendingPatientId');
        return;
      }
    }

    // Strategy 1: User's stored preference (already checked in initial state, but re-verify validity)
    const cachedPatientId = localStorage.getItem('lastActivePatientId');
    if (cachedPatientId) {
      const preferred = patientsWithAccess.find(p => p.patientId === cachedPatientId);
      if (preferred && preferred.status === 'active') {
        if (activePatientId !== cachedPatientId) {
          setActivePatientId(cachedPatientId);
        }
        return;
      }
    }

    // Strategy 2: Most recently accessed
    const recentlyAccessed = [...patientsWithAccess]
      .filter(p => p.lastAccessAt && p.status === 'active')
      .sort((a, b) => (b.lastAccessAt?.getTime() || 0) - (a.lastAccessAt?.getTime() || 0))[0];
    
    if (recentlyAccessed) {
      setActivePatientId(recentlyAccessed.patientId);
      return;
    }

    // Strategy 3: First active patient
    const firstActive = patientsWithAccess.find(p => p.status === 'active');
    if (firstActive) {
      setActivePatientId(firstActive.patientId);
      return;
    }

    // Strategy 4: Any patient
    if (patientsWithAccess[0]) {
      setActivePatientId(patientsWithAccess[0].patientId);
    }
  }, [patientsWithAccess, userRole, firebaseUser?.uid, activePatientId]);

  // Effect to update active patient when data changes
  useEffect(() => {
    if (!isLoading && apiResponse) {
      determineActivePatient();
    }
  }, [isLoading, apiResponse, determineActivePatient]);

  // Actions
  const refreshFamilyAccess = async () => {
    await refetch();
  };

  const updateLastAccessTime = async (accessId: string) => {
    try {
      await apiClient.patch(`/family-access/${accessId}/last-access`, {
        lastAccessAt: new Date()
      });
    } catch (error) {
      console.warn('⚠️ FamilyContext: Failed to update last access time:', error);
    }
  };

  const switchToPatient = useCallback(async (patientId: string): Promise<void> => {
    const patientAccess = patientsWithAccess.find(p => p.patientId === patientId);
    
    // Allow switching to self if in patient mode (though UI shouldn't trigger this)
    if (userRole === 'patient' && patientId === firebaseUser?.uid) {
      return;
    }

    if (!patientAccess || patientAccess.status !== 'active') {
      console.warn('⚠️ Enhanced FamilyContext: Cannot switch to inactive patient:', patientId);
      throw new Error('Cannot switch to inactive or non-existent patient');
    }

    try {
      console.log('🔄 Enhanced FamilyContext: Switching to patient:', patientAccess.patientName);
      
      setActivePatientId(patientId);
      localStorage.setItem('lastActivePatientId', patientId);
      
      // Fire and forget access time update
      updateLastAccessTime(patientAccess.id);
      
    } catch (error) {
      console.error('❌ Enhanced FamilyContext: Failed to switch patient:', error);
      throw error;
    }
  }, [patientsWithAccess, userRole, firebaseUser?.uid]);

  const activePatientAccess = useMemo(() => 
    activePatientId 
      ? patientsWithAccess.find(p => p.patientId === activePatientId) || null
      : null,
    [activePatientId, patientsWithAccess]
  );

  return {
    userRole,
    isLoading,
    patientsWithAccess,
    activePatientId,
    activePatientAccess,
    switchToPatient,
    refreshFamilyAccess
  };
}
