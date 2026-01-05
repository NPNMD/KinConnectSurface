import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFamily } from '@/contexts/FamilyContext';
import {
  AlertTriangle,
  TrendingUp,
  Pill
} from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import MedicationManager from '@/components/MedicationManager';
import TimeBucketView from '@/components/TimeBucketView';
import MissedMedicationsModal from '@/components/MissedMedicationsModal';
import UnscheduledMedicationsAlert from '@/components/UnscheduledMedicationsAlert';
import AdherenceDashboard from '@/components/AdherenceDashboard';
import MedicationMigrationTrigger from '@/components/MedicationMigrationTrigger';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';
import PRNQuickAccess from '@/components/PRNQuickAccess';
import PRNFloatingButton from '@/components/PRNFloatingButton';
import { showSuccess, showError } from '@/utils/toast';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

// Enhanced error types for better error handling
type ErrorType = 'validation' | 'network' | 'server' | 'timeout' | 'unknown';

interface EnhancedError {
  type: ErrorType;
  message: string;
  details?: string;
  retryable: boolean;
  fieldErrors?: Record<string, string>;
}

export default function Medications() {
  const {
    getEffectivePatientId,
    userRole,
    activePatientAccess,
    hasPermission
  } = useFamily();
  const queryClient = useQueryClient();
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [missedMedicationsCount, setMissedMedicationsCount] = useState(0);
  const [showAdherenceDashboard, setShowAdherenceDashboard] = useState(false);
  const [adherenceStats, setAdherenceStats] = useState<{
    totalMedications: number;
    overallAdherenceRate: number;
    totalTakenDoses: number;
    totalMissedDoses: number;
  } | null>(null);
  const [scheduleCreationStatus, setScheduleCreationStatus] = useState<{
    isCreating: boolean;
    success: boolean | null;
    message: string | null;
  }>({ isCreating: false, success: null, message: null });
  
  // Enhanced error state management
  const [currentError, setCurrentError] = useState<EnhancedError | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRY_ATTEMPTS = 3;

  const effectivePatientId = getEffectivePatientId();

  // Use React Query for fetching medications
  const { 
    data: medications = [], 
    isLoading: isLoadingMedications,
    refetch: refetchMedications
  } = useQuery({
    queryKey: ['medications', effectivePatientId],
    queryFn: async () => {
      if (!effectivePatientId) return [];
      
      const response = await unifiedMedicationApi.getMedications({
        patientId: effectivePatientId,
        isActive: true // Only show active medications by default
      });

      if (response.success && response.data) {
        // Convert unified medication format to legacy format for compatibility
        return response.data.map(med => ({
          id: med.id,
          patientId: med.patientId,
          name: med.medication.name,
          genericName: med.medication.genericName,
          brandName: med.medication.brandName,
          rxcui: med.medication.rxcui,
          dosage: med.medication.dosage,
          strength: med.medication.strength,
          dosageForm: med.medication.dosageForm,
          route: med.medication.route,
          instructions: med.medication.instructions,
          prescribedBy: med.medication.prescribedBy,
          prescribedDate: med.metadata.createdAt,
          pharmacy: med.medication.pharmacy,
          prescriptionNumber: med.medication.prescriptionNumber,
          refillsRemaining: med.medication.refillsRemaining,
          maxDailyDose: med.medication.maxDailyDose,
          sideEffects: med.medication.sideEffects,
          notes: med.medication.notes,
          frequency: mapUnifiedFrequencyToLegacy(med.schedule.frequency),
          times: med.schedule.times,
          daysOfWeek: med.schedule.daysOfWeek,
          dayOfMonth: med.schedule.dayOfMonth,
          startDate: med.schedule.startDate,
          endDate: med.schedule.endDate,
          isIndefinite: med.schedule.endDate ? false : true,
          hasReminders: med.reminders.enabled,
          reminderTimes: med.reminders.minutesBefore.map(String), // Convert numbers to strings for compatibility
          isActive: med.status.isActive,
          isPRN: med.status.isPRN,
          createdAt: med.metadata.createdAt,
          updatedAt: med.metadata.updatedAt,
        }));
      }
      return [];
    },
    enabled: !!effectivePatientId,
    staleTime: 1000 * 60, // 1 minute
  });

  // Helper function to parse and categorize errors
  const parseError = (error: any): EnhancedError => {
    console.log('🔍 [Medications] Parsing error:', error);
    
    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network') || !navigator.onLine) {
      return {
        type: 'network',
        message: 'Network connection issue. Please check your internet connection.',
        details: error.message,
        retryable: true
      };
    }
    
    // Timeout errors
    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      return {
        type: 'timeout',
        message: 'Request timed out. The server is taking too long to respond.',
        details: error.message,
        retryable: true
      };
    }
    
    // Validation errors (from backend)
    if (error.validation || error.fieldErrors) {
      return {
        type: 'validation',
        message: 'Please check the form for errors.',
        details: error.message || 'Validation failed',
        retryable: false,
        fieldErrors: error.fieldErrors || error.validation
      };
    }
    
    // Server errors (5xx)
    if (error.status >= 500 || error.message?.includes('server error')) {
      return {
        type: 'server',
        message: 'Server error. Our team has been notified.',
        details: error.message,
        retryable: true
      };
    }
    
    // Authentication errors
    if (error.status === 401 || error.message?.includes('authentication')) {
      return {
        type: 'validation',
        message: 'Authentication required. Please log in again.',
        details: error.message,
        retryable: false
      };
    }
    
    // Permission errors
    if (error.status === 403 || error.message?.includes('permission')) {
      return {
        type: 'validation',
        message: 'You do not have permission to perform this action.',
        details: error.message,
        retryable: false
      };
    }
    
    // Default unknown error
    return {
      type: 'unknown',
      message: 'An unexpected error occurred. Please try again.',
      details: error.message || String(error),
      retryable: true
    };
  };

  // Display error with auto-clear
  const displayError = (error: EnhancedError) => {
    console.error('❌ [Medications] Displaying error:', error);
    setCurrentError(error);
    
    // Show toast notification
    showError(error.message);
    
    // Auto-clear error after 5 seconds
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setCurrentError(null);
    }, 5000);
  };

  // Clear error manually
  const clearError = () => {
    setCurrentError(null);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Load missed medications count and adherence stats
  useEffect(() => {
    if (effectivePatientId) {
      loadMissedMedicationsCount();
      loadAdherenceStats();
    }
  }, [effectivePatientId]);

  const loadMissedMedicationsCount = async () => {
    try {
      if (!effectivePatientId) return;

      // Note: getMissedMedications not yet implemented in unified API
      // This will need to be added or use a different approach
      const response = { success: false, data: [] };

      if (response.success && response.data) {
        setMissedMedicationsCount(response.data.length);
      }
    } catch (error) {
      console.error('Error loading missed medications count:', error);
    }
  };

  const loadAdherenceStats = async () => {
    try {
      // Use unified API's comprehensive adherence method
      const response = await unifiedMedicationApi.getComprehensiveAdherence({
        patientId: effectivePatientId || undefined
      });
      
      // Map to expected format
      if (response.success && response.data) {
        const summaryData = {
          totalMedications: response.data.summary?.totalMedications || response.data.totalMedications || 0,
          overallAdherenceRate: response.data.summary?.overallAdherenceRate || response.data.overallAdherenceRate || 0,
          totalTakenDoses: response.data.summary?.totalTakenDoses || response.data.totalTakenDoses || 0,
          totalMissedDoses: response.data.summary?.totalMissedDoses || response.data.totalMissedDoses || 0
        };
        setAdherenceStats(summaryData);
      }
    } catch (error) {
      console.error('Error loading adherence stats:', error);
    }
  };

  const handleMissedMedicationAction = (eventId: string, action: 'take' | 'skip') => {
    // Refresh counts and stats after action
    loadMissedMedicationsCount();
    loadAdherenceStats();
    refetchMedications();
    setRefreshTrigger(prev => prev + 1);
  };

  // Listen for medication schedule updates
  useEffect(() => {
    const handleScheduleUpdate = () => {
      console.log('🔍 Medications: Received schedule update event');
      refetchMedications();
    };

    window.addEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    
    return () => {
      window.removeEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    };
  }, [refetchMedications]);

  // Helper method to map unified frequency to legacy frequency
  const mapUnifiedFrequencyToLegacy = (unifiedFrequency: string): string => {
    switch (unifiedFrequency) {
      case 'daily': return 'daily';
      case 'twice_daily': return 'twice_daily';
      case 'three_times_daily': return 'three_times_daily';
      case 'four_times_daily': return 'four_times_daily';
      case 'weekly': return 'weekly';
      case 'monthly': return 'monthly';
      case 'as_needed': return 'as_needed';
      default: return 'daily';
    }
  };

  // Medication management functions with enhanced error handling
  const handleAddMedication = async (medication: NewMedication, attemptNumber: number = 0): Promise<void> => {
    try {
      clearError(); // Clear any previous errors
      setScheduleCreationStatus({ isCreating: true, success: null, message: 'Adding medication and creating schedule...' });
      
      console.log('🔧 [Medications] Adding new medication:', {
        name: medication.name,
        attempt: attemptNumber + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        timestamp: new Date().toISOString()
      });
      
      // Use unified API to create medication with schedule in one call
      const response = await unifiedMedicationApi.createMedication({
        name: medication.name,
        genericName: medication.genericName,
        dosage: medication.dosage,
        frequency: medication.frequency,
        instructions: medication.instructions,
        prescribedBy: medication.prescribedBy,
        prescribedDate: medication.prescribedDate,
        startDate: medication.startDate,
        endDate: medication.endDate,
        reminderTimes: medication.reminderTimes,
        hasReminders: medication.hasReminders,
        usePatientTimePreferences: !medication.isPRN // Use patient preferences unless PRN
      });

      if (!response.success || !response.data) {
        // Parse the error for better handling
        const enhancedError = parseError({
          message: response.error || 'Failed to create medication',
          validation: (response as any).validation,
          fieldErrors: (response as any).fieldErrors
        });
        
        // Check if we should retry
        if (enhancedError.retryable && attemptNumber < MAX_RETRY_ATTEMPTS - 1) {
          const retryDelay = Math.min(1000 * Math.pow(2, attemptNumber), 5000); // Exponential backoff, max 5s
          console.log(`⏳ [Medications] Retrying in ${retryDelay}ms (attempt ${attemptNumber + 2}/${MAX_RETRY_ATTEMPTS})`);
          
          setScheduleCreationStatus({
            isCreating: true,
            success: null,
            message: `Retrying... (attempt ${attemptNumber + 2}/${MAX_RETRY_ATTEMPTS})`
          });
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return handleAddMedication(medication, attemptNumber + 1);
        }
        
        throw enhancedError;
      }
      
      setScheduleCreationStatus({
        isCreating: false,
        success: true,
        message: '✅ Medication added and reminders scheduled successfully!'
      });
      
      showSuccess('Medication added and reminders scheduled successfully!');
      
      // Invalidate queries to trigger refresh
      await queryClient.invalidateQueries({ queryKey: ['medications'] });
      await queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });
      
      // Refresh related data
      loadMissedMedicationsCount();
      loadAdherenceStats();
      setRefreshTrigger(prev => prev + 1);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setScheduleCreationStatus({ isCreating: false, success: null, message: null });
      }, 5000);
      
    } catch (error) {
      console.error('❌ [Medications] Error adding medication:', {
        error,
        attempt: attemptNumber + 1,
        medicationName: medication.name,
        timestamp: new Date().toISOString()
      });
      
      // Parse and display the error
      const enhancedError = error instanceof Error || (error as any).type
        ? parseError(error)
        : parseError({ message: 'Unknown error occurred' });
      
      displayError(enhancedError);
      
      // Update status with specific error message
      let statusMessage = '❌ Failed to add medication.';
      if (enhancedError.type === 'network') {
        statusMessage += ' Please check your connection and try again.';
      } else if (enhancedError.type === 'validation') {
        statusMessage += ' Please check the form for errors.';
      } else if (enhancedError.retryable) {
        statusMessage += ' Please try again.';
      }
      
      setScheduleCreationStatus({
        isCreating: false,
        success: false,
        message: statusMessage
      });
      
      throw enhancedError; // Re-throw to let the component handle the error
    }
  };

  const handleUpdateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      // Get default times for frequency if reminderTimes not provided
      const getDefaultTimesForFrequency = (frequency: string): string[] => {
        switch (frequency) {
          case 'daily': return ['08:00'];
          case 'twice_daily': return ['08:00', '20:00'];
          case 'three_times_daily': return ['08:00', '14:00', '20:00'];
          case 'four_times_daily': return ['08:00', '12:00', '16:00', '20:00'];
          case 'as_needed': return [];
          default: return ['08:00'];
        }
      };

      // Determine schedule times: use provided reminderTimes or defaults based on frequency
      let scheduleTimes: string[] | undefined;
      if (updates.reminderTimes !== undefined) {
        // If reminderTimes is explicitly provided (even if empty array), use it
        scheduleTimes = updates.reminderTimes.length > 0 ? updates.reminderTimes : undefined;
        // If reminderTimes are provided, automatically enable reminders
        if (scheduleTimes && scheduleTimes.length > 0 && updates.hasReminders === undefined) {
          updates.hasReminders = true;
        }
      } else if (updates.frequency) {
        // If frequency is provided but no reminderTimes, use defaults
        scheduleTimes = getDefaultTimesForFrequency(updates.frequency);
      }

      // Map legacy updates to unified format
      const unifiedUpdates: any = {
        medicationData: {},
        scheduleData: {},
        reminderSettings: {},
        status: {}
      };

      // Only include fields that are actually being updated
      if (updates.name !== undefined) unifiedUpdates.medicationData.name = updates.name;
      if (updates.dosage !== undefined) unifiedUpdates.medicationData.dosage = updates.dosage;
      if (updates.instructions !== undefined) unifiedUpdates.medicationData.instructions = updates.instructions;
      if (updates.prescribedBy !== undefined) unifiedUpdates.medicationData.prescribedBy = updates.prescribedBy;

      const mapFrequencyToUnifiedType = (frequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' => {
        const freq = frequency.toLowerCase();
        if (freq.includes('twice') || freq.includes('bid')) return 'twice_daily';
        if (freq.includes('three') || freq.includes('tid')) return 'three_times_daily';
        if (freq.includes('four') || freq.includes('qid')) return 'four_times_daily';
        if (freq.includes('weekly')) return 'weekly';
        if (freq.includes('monthly')) return 'monthly';
        if (freq.includes('needed') || freq.includes('prn')) return 'as_needed';
        return 'daily';
      };

      if (updates.frequency !== undefined) {
        unifiedUpdates.scheduleData.frequency = mapFrequencyToUnifiedType(updates.frequency);
      }
      if (scheduleTimes !== undefined) {
        unifiedUpdates.scheduleData.times = scheduleTimes;
      }
      if (updates.startDate !== undefined) unifiedUpdates.scheduleData.startDate = updates.startDate;
      if (updates.endDate !== undefined) unifiedUpdates.scheduleData.endDate = updates.endDate;

      // Reminder settings
      if (updates.hasReminders !== undefined) {
        unifiedUpdates.reminderSettings.enabled = updates.hasReminders;
        if (updates.hasReminders) {
          unifiedUpdates.reminderSettings.minutesBefore = [15, 5];
          unifiedUpdates.reminderSettings.notificationMethods = ['browser', 'push'];
        }
      }

      // Status
      if (updates.isActive !== undefined) unifiedUpdates.status.isActive = updates.isActive;
      if (updates.isPRN !== undefined) unifiedUpdates.status.isPRN = updates.isPRN;

      // Remove empty objects
      if (Object.keys(unifiedUpdates.medicationData).length === 0) delete unifiedUpdates.medicationData;
      if (Object.keys(unifiedUpdates.scheduleData).length === 0) delete unifiedUpdates.scheduleData;
      if (Object.keys(unifiedUpdates.reminderSettings).length === 0) delete unifiedUpdates.reminderSettings;
      if (Object.keys(unifiedUpdates.status).length === 0) delete unifiedUpdates.status;

      const response = await unifiedMedicationApi.updateMedication(id, unifiedUpdates, {
        reason: 'Updated by user from medications page'
      });
      
      if (response.success) {
        showSuccess('Medication updated successfully!');
        await queryClient.invalidateQueries({ queryKey: ['medications'] });
        await queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });
      } else {
        throw new Error(response.error || 'Failed to update medication');
      }
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      // Use unified API for consistent deletion with proper cascade cleanup
      const response = await unifiedMedicationApi.deleteMedication(id, false, {
        reason: 'Deleted by user from medications page'
      });

      if (response.success) {
        console.log('✅ Medication deleted successfully with cascade cleanup');
        showSuccess('Medication deleted successfully!');

        await queryClient.invalidateQueries({ queryKey: ['medications'] });
        await queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });

        // Refresh related data
        loadMissedMedicationsCount();
        loadAdherenceStats();
        setRefreshTrigger(prev => prev + 1);
      } else {
        throw new Error(response.error || 'Failed to delete medication from server');
      }
    } catch (error) {
      console.error('Error deleting medication:', error);
      showError('Failed to delete medication. Please try again or contact support if the problem persists.');
      throw error;
    }
  };

  // Get active medications
  const activeMedications = useMemo(() => medications.filter(med => med.isActive), [medications]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-safe">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Enhanced Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-20">
        
        {/* Page Title Section */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Pill className="w-8 h-8 text-primary-600" />
              Medications
            </h1>
            <p className="text-gray-600 mt-1">
              Manage prescriptions, schedule, and adherence
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm self-start sm:self-auto">
            <span className="font-medium">{activeMedications.length}</span> active medication{activeMedications.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Simplified Alert Section */}
        {missedMedicationsCount > 0 && (
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-red-900">
                      {missedMedicationsCount} Missed Medication{missedMedicationsCount !== 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-red-700">
                      {userRole === 'family_member' && activePatientAccess
                        ? `${activePatientAccess.patientName} has missed medications that need attention.`
                        : 'You have missed medications that need attention.'
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMissedModal(true)}
                  className="px-4 py-3 min-h-[44px] bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors w-full sm:w-auto flex-shrink-0 font-medium"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Adherence Dashboard */}
        {adherenceStats && (
          <div className="mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span>Your Progress</span>
                </h3>
                <button
                  onClick={() => setShowAdherenceDashboard(!showAdherenceDashboard)}
                  className="px-3 py-2 min-h-[44px] text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md font-medium w-full sm:w-auto text-left sm:text-right transition-colors"
                >
                  {showAdherenceDashboard ? 'Show Summary' : 'View Details'}
                </button>
              </div>
              
              {showAdherenceDashboard ? (
                <AdherenceDashboard
                  patientId={effectivePatientId || undefined}
                  timeRange="month"
                  showFamilyView={userRole === 'family_member'}
                  compactMode={false}
                />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round(adherenceStats.overallAdherenceRate)}%
                      </div>
                      <div className="text-sm text-gray-600">Adherence Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {adherenceStats.totalTakenDoses}
                      </div>
                      <div className="text-sm text-gray-600">Doses Taken</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {adherenceStats.totalMissedDoses}
                      </div>
                      <div className="text-sm text-gray-600">Doses Missed</div>
                    </div>
                  </div>
                  
                  {/* Simplified Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(adherenceStats.overallAdherenceRate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Migration Trigger */}
        <MedicationMigrationTrigger
          patientId={effectivePatientId || undefined}
          onMigrationComplete={() => {
            refetchMedications();
            setRefreshTrigger(prev => prev + 1);
            loadMissedMedicationsCount();
            loadAdherenceStats();
          }}
        />

        {/* Unscheduled Medications Alert */}
        <UnscheduledMedicationsAlert
          medications={medications}
          onSchedulesCreated={() => {
            // Refresh medications and today's view after schedules are created
            refetchMedications();
            setRefreshTrigger(prev => prev + 1);
            loadMissedMedicationsCount();
            loadAdherenceStats();
          }}
        />

        {/* PRN (As Needed) Medications Section - Always at top */}
        <div className="mb-6">
          <PRNQuickAccess
            medications={medications}
            onMedicationAction={(medId, action) => {
              console.log('PRN medication action:', { medId, action });
              // Refresh data after PRN action
              refetchMedications();
              setRefreshTrigger(prev => prev + 1);
              loadMissedMedicationsCount();
              loadAdherenceStats();
            }}
            compactMode={false}
          />
        </div>

        {/* Today's Medications Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Today's Med List</h2>
            {missedMedicationsCount > 0 && (
              <button
                onClick={() => setShowMissedModal(true)}
                className="text-xs px-3 py-2 min-h-[36px] bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors flex-shrink-0 font-medium"
              >
                {missedMedicationsCount} Missed
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <TimeBucketView
              patientId={effectivePatientId || ''}
              date={new Date()}
              onMedicationAction={(eventId, action) => {
                console.log('Medication action performed:', { eventId, action });
                setTimeout(() => {
                  refetchMedications();
                  setRefreshTrigger(prev => prev + 1);
                }, 1000);
              }}
              compactMode={false}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Enhanced Medication Management Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          {hasPermission('canEdit') ? (
            <MedicationManager
              patientId={effectivePatientId || ''}
              medications={activeMedications}
              onAddMedication={handleAddMedication}
              onUpdateMedication={handleUpdateMedication}
              onDeleteMedication={handleDeleteMedication}
              isLoading={isLoadingMedications}
            />
          ) : (
            <div className="text-center py-8">
              <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">View-Only Access</h3>
              <p className="text-gray-600 text-sm">
                You have view-only access to {activePatientAccess?.patientName}'s medications.
                Contact them to request edit permissions if needed.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* PRN Floating Action Button - Mobile Only or Strategic Placement */}
      <div className="md:hidden">
        <PRNFloatingButton
          medications={medications}
          onMedicationAction={(medId, action) => {
            console.log('PRN FAB action:', { medId, action });
            refetchMedications();
            setRefreshTrigger(prev => prev + 1);
            loadMissedMedicationsCount();
            loadAdherenceStats();
          }}
        />
      </div>

      {/* Missed Medications Modal */}
      <MissedMedicationsModal
        isOpen={showMissedModal}
        onClose={() => setShowMissedModal(false)}
        onMedicationAction={handleMissedMedicationAction}
      />
    </div>
  );
}
