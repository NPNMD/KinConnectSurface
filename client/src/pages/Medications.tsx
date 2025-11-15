import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFamily } from '@/contexts/FamilyContext';
import {
  Heart,
  ArrowLeft,
  Pill,
  Calendar,
  AlertTriangle,
  User,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { createSmartRefresh, createDebouncedFunction, clearRequestCache } from '@/lib/requestDebouncer';
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
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoadingMedications, setIsLoadingMedications] = useState(false);
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
  const [retryCount, setRetryCount] = useState(0);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRY_ATTEMPTS = 3;

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
  

  // Create smart refresh function for medications
  const smartLoadMedications = createSmartRefresh(
    async () => {
      try {
        setIsLoadingMedications(true);
        const effectivePatientId = getEffectivePatientId();
        if (!effectivePatientId) return;

        // Use unified API for consistent single source of truth
        const response = await unifiedMedicationApi.getMedications({
          patientId: effectivePatientId,
          isActive: true // Only show active medications by default
        });

        if (response.success && response.data) {
          // Convert unified medication format to legacy format for compatibility
          const medicationsWithDates = response.data.map(med => ({
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
          setMedications(medicationsWithDates);
        }
      } catch (error) {
        console.error('Error loading medications:', error);
      } finally {
        setIsLoadingMedications(false);
      }
    },
    60000, // 1 minute minimum between calls
    'medications_list'
  );

  // Load medications function with smart refresh
  const loadMedications = async () => {
    const result = await smartLoadMedications();
    if (result === null && medications.length > 0) {
      console.log('🚫 Skipped redundant medications refresh');
    }
  };

  // Load medications on component mount
  useEffect(() => {
    const effectivePatientId = getEffectivePatientId();
    if (effectivePatientId) {
      loadMedications();
    }
  }, [getEffectivePatientId()]);

  // Load missed medications count and adherence stats
  useEffect(() => {
    const effectivePatientId = getEffectivePatientId();
    if (effectivePatientId) {
      loadMissedMedicationsCount();
      loadAdherenceStats();
    }
  }, [getEffectivePatientId()]);

  const loadMissedMedicationsCount = async () => {
    try {
      const patientId = getEffectivePatientId();
      if (!patientId) return;

      // Get missed medications from last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Note: getMissedMedications not yet implemented in unified API
      // This will need to be added or use a different approach
      console.warn('getMissedMedications not yet available in unified API');
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
        patientId: getEffectivePatientId() || undefined
      });
      
      // Map to expected format
      if (response.success && response.data) {
        response.data = {
          summary: {
            totalMedications: response.data.totalMedications || 0,
            overallAdherenceRate: response.data.overallAdherenceRate || 0,
            totalTakenDoses: response.data.totalTakenDoses || 0,
            totalMissedDoses: response.data.totalMissedDoses || 0
          }
        };
      }
      if (response.success && response.data) {
        setAdherenceStats(response.data.summary);
      }
    } catch (error) {
      console.error('Error loading adherence stats:', error);
    }
  };

  const handleMissedMedicationAction = (eventId: string, action: 'take' | 'skip') => {
    // Refresh counts and stats after action
    loadMissedMedicationsCount();
    loadAdherenceStats();
    loadMedications();
    setRefreshTrigger(prev => prev + 1);
  };

  // Listen for medication schedule updates with debounced refresh
  useEffect(() => {
    const debouncedRefresh = createDebouncedFunction(
      async () => {
        console.log('🔍 Medications: Refreshing medications after schedule update');
        await loadMedications();
      },
      2000, // 2 second debounce
      'medications_schedule_update'
    );

    const handleScheduleUpdate = () => {
      console.log('🔍 Medications: Received schedule update event');
      debouncedRefresh();
    };

    window.addEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    
    return () => {
      window.removeEventListener('medicationScheduleUpdated', handleScheduleUpdate);
      debouncedRefresh.cancel();
    };
  }, []);

  // Medication management functions with enhanced error handling
  const handleAddMedication = async (medication: NewMedication, attemptNumber: number = 0): Promise<void> => {
    let createdMedication: Medication | null = null;
    
    try {
      setIsLoadingMedications(true);
      clearError(); // Clear any previous errors
      setScheduleCreationStatus({ isCreating: true, success: null, message: 'Adding medication and creating schedule...' });
      
      console.log('🔧 [Medications] Adding new medication:', {
        name: medication.name,
        attempt: attemptNumber + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        timestamp: new Date().toISOString()
      });
      
      console.log('🔍 [Medications] Request payload:', {
        name: medication.name,
        frequency: medication.frequency,
        hasReminders: medication.hasReminders,
        reminderTimes: medication.reminderTimes,
        reminderTimesIsArray: Array.isArray(medication.reminderTimes),
        reminderTimesLength: medication.reminderTimes?.length,
        isPRN: medication.isPRN,
        usePatientTimePreferences: !medication.isPRN,
        fullMedicationObject: JSON.stringify(medication, null, 2)
      });
      
      // Use unified API to create medication with schedule in one call
      const startTime = performance.now();
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
      const endTime = performance.now();

      console.log('🔍 [Medications] API Response:', {
        success: response.success,
        hasData: !!response.data,
        error: response.error,
        responseTime: `${(endTime - startTime).toFixed(2)}ms`,
        fullResponse: JSON.stringify(response, null, 2)
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
      
      // Handle both response formats: simplified {id, timestamp} or full {command, workflow}
      const unifiedCommand = response.data.command;
      
      if (unifiedCommand) {
        // Full response format with command object
        createdMedication = {
          id: unifiedCommand.id,
          patientId: unifiedCommand.patientId,
          name: unifiedCommand.medication.name,
          genericName: unifiedCommand.medication.genericName,
          brandName: unifiedCommand.medication.brandName,
          rxcui: unifiedCommand.medication.rxcui,
          dosage: unifiedCommand.medication.dosage,
          strength: unifiedCommand.medication.strength,
          dosageForm: unifiedCommand.medication.dosageForm,
          route: unifiedCommand.medication.route,
          instructions: unifiedCommand.medication.instructions,
          prescribedBy: unifiedCommand.medication.prescribedBy,
          prescribedDate: unifiedCommand.medication.prescribedDate || new Date(),
          startDate: unifiedCommand.schedule.startDate,
          endDate: unifiedCommand.schedule.endDate,
          isActive: unifiedCommand.status.isActive,
          isPRN: unifiedCommand.status.isPRN,
          maxDailyDose: unifiedCommand.medication.maxDailyDose,
          sideEffects: unifiedCommand.medication.sideEffects,
          notes: unifiedCommand.medication.notes,
          pharmacy: unifiedCommand.medication.pharmacy,
          prescriptionNumber: unifiedCommand.medication.prescriptionNumber,
          refillsRemaining: unifiedCommand.medication.refillsRemaining,
          hasReminders: unifiedCommand.reminders.enabled,
          reminderTimes: unifiedCommand.schedule.times,
          frequency: mapUnifiedFrequencyToLegacy(unifiedCommand.schedule.frequency),
          createdAt: unifiedCommand.metadata.createdAt,
          updatedAt: unifiedCommand.metadata.updatedAt,
        };
      } else {
        // Simplified response format with just {id, timestamp}
        // Create a minimal medication object and rely on refresh to get full data
        console.log('📝 [Medications] Received simplified response, will refresh to get full data');
        const simplifiedData = response.data as any; // Type assertion for simplified response
        createdMedication = {
          id: simplifiedData.id,
          patientId: medication.patientId,
          name: medication.name,
          genericName: medication.genericName,
          dosage: medication.dosage,
          instructions: medication.instructions,
          prescribedBy: medication.prescribedBy,
          prescribedDate: medication.prescribedDate || new Date(),
          frequency: medication.frequency,
          isActive: true,
          isPRN: medication.isPRN || false,
          hasReminders: medication.hasReminders || false,
          reminderTimes: medication.reminderTimes || [],
          createdAt: simplifiedData.timestamp ? new Date(simplifiedData.timestamp) : new Date(),
          updatedAt: simplifiedData.timestamp ? new Date(simplifiedData.timestamp) : new Date(),
        };
      }
      
      console.log('✅ Medications: Medication and schedule created successfully:', createdMedication?.id);
      
      setScheduleCreationStatus({
        isCreating: false,
        success: true,
        message: '✅ Medication added and reminders scheduled successfully!'
      });
      
      showSuccess('Medication added and reminders scheduled successfully!');
      
      // Clear cache to force fresh fetch after mutation
      clearRequestCache('medications_list');
      
      // Update local state optimistically
      if (createdMedication) {
        setMedications(prev => [...prev, createdMedication!]);
      }
      
      // Refresh related data - cache is cleared so this will force a fresh fetch
      await loadMedications();
      setRefreshTrigger(prev => prev + 1);
      loadMissedMedicationsCount();
      loadAdherenceStats();
      
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
    } finally {
      setIsLoadingMedications(false);
    }
  };

  const handleUpdateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      setIsLoadingMedications(true);
      
      // Map legacy frequency to unified format
      const mapFrequencyToUnified = (frequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' => {
        const freq = frequency.toLowerCase();
        if (freq.includes('twice') || freq.includes('bid')) return 'twice_daily';
        if (freq.includes('three') || freq.includes('tid')) return 'three_times_daily';
        if (freq.includes('four') || freq.includes('qid')) return 'four_times_daily';
        if (freq.includes('weekly')) return 'weekly';
        if (freq.includes('monthly')) return 'monthly';
        if (freq.includes('needed') || freq.includes('prn')) return 'as_needed';
        return 'daily';
      };

      // Get default times for frequency if reminderTimes not provided
      const getDefaultTimesForFrequency = (frequency: string): string[] => {
        switch (frequency) {
          case 'daily':
            return ['08:00'];
          case 'twice_daily':
            return ['08:00', '20:00'];
          case 'three_times_daily':
            return ['08:00', '14:00', '20:00'];
          case 'four_times_daily':
            return ['08:00', '12:00', '16:00', '20:00'];
          case 'as_needed':
            return [];
          default:
            return ['08:00'];
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
        const unifiedFreq = mapFrequencyToUnified(updates.frequency);
        scheduleTimes = getDefaultTimesForFrequency(unifiedFreq);
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

      // Schedule data
      if (updates.frequency !== undefined) {
        unifiedUpdates.scheduleData.frequency = mapFrequencyToUnified(updates.frequency);
      }
      if (scheduleTimes !== undefined) {
        unifiedUpdates.scheduleData.times = scheduleTimes;
      }
      if (updates.startDate !== undefined) unifiedUpdates.scheduleData.startDate = updates.startDate;
      if (updates.endDate !== undefined) unifiedUpdates.scheduleData.endDate = updates.endDate;

      // Reminder settings
      if (updates.hasReminders !== undefined) {
        unifiedUpdates.reminderSettings.enabled = updates.hasReminders;
        // Include reminder settings only if reminders are enabled
        if (updates.hasReminders) {
          unifiedUpdates.reminderSettings.minutesBefore = [15, 5];
          unifiedUpdates.reminderSettings.notificationMethods = ['browser', 'push'];
        }
      }

      // Status
      if (updates.isActive !== undefined) unifiedUpdates.status.isActive = updates.isActive;
      if (updates.isPRN !== undefined) unifiedUpdates.status.isPRN = updates.isPRN;

      // Remove empty objects to avoid sending unnecessary data
      if (Object.keys(unifiedUpdates.medicationData).length === 0) delete unifiedUpdates.medicationData;
      if (Object.keys(unifiedUpdates.scheduleData).length === 0) delete unifiedUpdates.scheduleData;
      if (Object.keys(unifiedUpdates.reminderSettings).length === 0) delete unifiedUpdates.reminderSettings;
      if (Object.keys(unifiedUpdates.status).length === 0) delete unifiedUpdates.status;

      console.log('🔍 [Medications] Updating medication with unified format:', {
        id,
        unifiedUpdates,
        originalUpdates: updates
      });

      const response = await unifiedMedicationApi.updateMedication(id, unifiedUpdates, {
        reason: 'Updated by user from medications page'
      });
      
      if (response.success && response.data?.command) {
        // Convert unified format back to legacy format for compatibility
        const unifiedCommand = response.data.command;
        const medicationWithDates = {
          id: unifiedCommand.id,
          patientId: unifiedCommand.patientId,
          name: unifiedCommand.medication.name,
          genericName: unifiedCommand.medication.genericName,
          brandName: unifiedCommand.medication.brandName,
          rxcui: unifiedCommand.medication.rxcui,
          dosage: unifiedCommand.medication.dosage,
          strength: unifiedCommand.medication.strength,
          dosageForm: unifiedCommand.medication.dosageForm,
          route: unifiedCommand.medication.route,
          instructions: unifiedCommand.medication.instructions,
          prescribedBy: unifiedCommand.medication.prescribedBy,
          prescribedDate: unifiedCommand.medication.prescribedDate || new Date(),
          startDate: unifiedCommand.schedule.startDate,
          endDate: unifiedCommand.schedule.endDate,
          isActive: unifiedCommand.status.isActive,
          isPRN: unifiedCommand.status.isPRN,
          maxDailyDose: unifiedCommand.medication.maxDailyDose,
          sideEffects: unifiedCommand.medication.sideEffects,
          notes: unifiedCommand.medication.notes,
          pharmacy: unifiedCommand.medication.pharmacy,
          prescriptionNumber: unifiedCommand.medication.prescriptionNumber,
          refillsRemaining: unifiedCommand.medication.refillsRemaining,
          hasReminders: unifiedCommand.reminders.enabled,
          reminderTimes: unifiedCommand.schedule.times,
          frequency: mapUnifiedFrequencyToLegacy(unifiedCommand.schedule.frequency),
          createdAt: unifiedCommand.metadata.createdAt,
          updatedAt: unifiedCommand.metadata.updatedAt,
        };
        setMedications(prev =>
          prev.map(med =>
            med.id === id ? medicationWithDates : med
          )
        );
        showSuccess('Medication updated successfully!');
        
        // Clear cache to force fresh fetch after mutation
        clearRequestCache('medications_list');
        await loadMedications();
      }
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    } finally {
      setIsLoadingMedications(false);
    }
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      setIsLoadingMedications(true);

      // Use unified API for consistent deletion with proper cascade cleanup
      const response = await unifiedMedicationApi.deleteMedication(id, false, {
        reason: 'Deleted by user from medications page'
      });

      if (response.success) {
        console.log('✅ Medication deleted successfully with cascade cleanup');

        // Clear cache to force fresh fetch after mutation
        clearRequestCache('medications_list');

        // Update local state immediately
        setMedications(prev => prev.filter(med => med.id !== id));

        showSuccess('Medication deleted successfully!');

        // Force immediate refresh to ensure UI is in sync - cache is cleared so this will force a fresh fetch
        await loadMedications();

        // Refresh related data
        loadMissedMedicationsCount();
        loadAdherenceStats();
        setRefreshTrigger(prev => prev + 1);
      } else {
        // If backend delete failed, don't remove from UI
        throw new Error(response.error || 'Failed to delete medication from server');
      }
    } catch (error) {
      console.error('Error deleting medication:', error);
      // Show user-friendly error message
      showError('Failed to delete medication. Please try again or contact support if the problem persists.');
      throw error;
    } finally {
      setIsLoadingMedications(false);
    }
  };

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

  // Get active medications
  const activeMedications = medications.filter(med => med.isActive);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-safe">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Simplified Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-2">
                <Pill className="w-6 h-6 text-primary-600" />
                <span className="text-lg font-bold text-gray-900">Medications</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{activeMedications.length} active medication{activeMedications.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 pb-24 sm:pb-20 max-w-full overflow-x-hidden">
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
            <div className="bg-white rounded-lg border border-gray-200 p-4">
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
                  patientId={getEffectivePatientId() || undefined}
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
          patientId={getEffectivePatientId() || undefined}
          onMigrationComplete={() => {
            loadMedications();
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
            loadMedications();
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
              loadMedications();
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
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <TimeBucketView
              patientId={getEffectivePatientId() || ''}
              date={new Date()}
              onMedicationAction={(eventId, action) => {
                console.log('Medication action performed:', { eventId, action });
                setTimeout(() => {
                  loadMedications();
                  setRefreshTrigger(prev => prev + 1);
                }, 1000);
              }}
              compactMode={false}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Enhanced Medication Management Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {hasPermission('canEdit') ? (
            <MedicationManager
              patientId={getEffectivePatientId() || ''}
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
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex-1 flex flex-col items-center space-y-1 py-2 px-1 min-h-[56px] text-rose-600 hover:text-rose-700 transition-colors active:bg-rose-50 rounded-lg"
          >
            <div className="bg-rose-100 p-2 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex-1 flex flex-col items-center space-y-1 py-2 px-1 min-h-[56px] text-blue-600 hover:text-blue-700 transition-colors active:bg-blue-50 rounded-lg"
          >
            <div className="bg-blue-100 p-2 rounded-lg">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Meds</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex-1 flex flex-col items-center space-y-1 py-2 px-1 min-h-[56px] text-purple-600 hover:text-purple-700 transition-colors active:bg-purple-50 rounded-lg"
          >
            <div className="bg-purple-100 p-2 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex-1 flex flex-col items-center space-y-1 py-2 px-1 min-h-[56px] text-green-600 hover:text-green-700 transition-colors active:bg-green-50 rounded-lg"
          >
            <div className="bg-green-100 p-2 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex-1 flex flex-col items-center space-y-1 py-2 px-1 min-h-[56px] text-amber-600 hover:text-amber-700 transition-colors active:bg-amber-50 rounded-lg"
          >
            <div className="bg-amber-100 p-2 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Family</span>
          </Link>
        </div>
      </nav>

      {/* PRN Floating Action Button */}
      <PRNFloatingButton
        medications={medications}
        onMedicationAction={(medId, action) => {
          console.log('PRN FAB action:', { medId, action });
          // Refresh data after PRN action
          loadMedications();
          setRefreshTrigger(prev => prev + 1);
          loadMissedMedicationsCount();
          loadAdherenceStats();
        }}
      />

      {/* Missed Medications Modal */}
      <MissedMedicationsModal
        isOpen={showMissedModal}
        onClose={() => setShowMissedModal(false)}
        onMedicationAction={handleMissedMedicationAction}
      />
    </div>
  );
}