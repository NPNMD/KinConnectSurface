import React, { useState, useEffect } from 'react';
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
  TrendingUp
} from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { createSmartRefresh, createDebouncedFunction } from '@/lib/requestDebouncer';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { parseFrequencyToScheduleType, generateDefaultTimesForFrequency } from '@/utils/medicationFrequencyUtils';
import MedicationManager from '@/components/MedicationManager';
import TimeBucketView from '@/components/TimeBucketView';
import MissedMedicationsModal from '@/components/MissedMedicationsModal';
import UnscheduledMedicationsAlert from '@/components/UnscheduledMedicationsAlert';
import AdherenceDashboard from '@/components/AdherenceDashboard';
import MedicationMigrationTrigger from '@/components/MedicationMigrationTrigger';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';
import { PermissionGate } from '@/components/PermissionGate';

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
  
  // State for schedule creation feedback
  const [scheduleCreationStatus, setScheduleCreationStatus] = useState<{
    isCreating: boolean;
    success: boolean | null;
    message: string | null;
  }>({
    isCreating: false,
    success: null,
    message: null
  });

  // Create smart refresh function for medications
  const smartLoadMedications = createSmartRefresh(
    async () => {
      try {
        setIsLoadingMedications(true);
        const effectivePatientId = getEffectivePatientId();
        if (!effectivePatientId) return;
        
        const endpoint = userRole === 'family_member'
          ? API_ENDPOINTS.MEDICATIONS_FOR_PATIENT(effectivePatientId)
          : API_ENDPOINTS.MEDICATIONS;
        
        const response = await apiClient.get<{ success: boolean; data: Medication[] }>(endpoint);
        
        if (response.success && response.data) {
          // Parse date strings back to Date objects
          const medicationsWithDates = response.data.map(med => ({
            ...med,
            prescribedDate: new Date(med.prescribedDate),
            startDate: med.startDate ? new Date(med.startDate) : undefined,
            endDate: med.endDate ? new Date(med.endDate) : undefined,
            createdAt: new Date(med.createdAt),
            updatedAt: new Date(med.updatedAt),
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

      const response = await medicationCalendarApi.getMissedMedications({
        patientId,
        startDate,
        endDate,
        limit: 50
      });

      if (response.success && response.data) {
        setMissedMedicationsCount(response.data.length);
      }
    } catch (error) {
      console.error('Error loading missed medications count:', error);
    }
  };

  const loadAdherenceStats = async () => {
    try {
      const response = await medicationCalendarApi.getAdherenceSummary();
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

  // Medication management functions
  const handleAddMedication = async (medication: NewMedication) => {
    let createdMedication: Medication | null = null;
    let scheduleCreated = false;
    
    try {
      setIsLoadingMedications(true);
      setScheduleCreationStatus({ isCreating: false, success: null, message: null });
      console.log('🔧 Medications: Adding new medication:', medication.name);
      
      // Step 1: Create the medication
      const response = await apiClient.post<{ success: boolean; data: Medication }>(
        API_ENDPOINTS.MEDICATIONS,
        medication
      );
      
      if (!response.success || !response.data) {
        throw new Error('Failed to create medication');
      }
      
      // Parse date strings back to Date objects for the new medication
      createdMedication = {
        ...response.data,
        prescribedDate: new Date(response.data.prescribedDate),
        startDate: response.data.startDate ? new Date(response.data.startDate) : undefined,
        endDate: response.data.endDate ? new Date(response.data.endDate) : undefined,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt),
      };
      
      console.log('✅ Medications: Medication created successfully:', createdMedication.id);
      
      // Step 2: Check if automatic schedule creation is needed
      if (medication.hasReminders && !medication.isPRN) {
        setScheduleCreationStatus({
          isCreating: true,
          success: null,
          message: 'Creating medication schedule...'
        });
        
        console.log('🔧 Medications: Attempting automatic schedule creation');
        console.log('🔧 Medications: Frequency:', medication.frequency);
        console.log('🔧 Medications: Reminder times:', medication.reminderTimes);
        
        try {
          // Parse frequency to schedule type
          const scheduleFrequency = parseFrequencyToScheduleType(medication.frequency);
          console.log('🔧 Medications: Parsed schedule frequency:', scheduleFrequency);
          
          // Use provided reminder times or generate defaults
          const scheduleTimes = medication.reminderTimes && medication.reminderTimes.length > 0
            ? medication.reminderTimes
            : generateDefaultTimesForFrequency(scheduleFrequency);
          
          console.log('🔧 Medications: Schedule times:', scheduleTimes);
          
          // Create the schedule
          const scheduleData = {
            medicationId: createdMedication.id,
            patientId: medication.patientId,
            frequency: scheduleFrequency,
            times: scheduleTimes,
            dosageAmount: medication.dosage,
            instructions: medication.instructions,
            startDate: medication.startDate || new Date(),
            endDate: medication.endDate,
            isIndefinite: !medication.endDate,
            generateCalendarEvents: true,
            reminderMinutesBefore: [15, 5], // Default reminders
            isActive: true
          };
          
          console.log('🔧 Medications: Creating schedule with data:', scheduleData);
          
          const scheduleResponse = await medicationCalendarApi.createMedicationSchedule(scheduleData);
          
          if (scheduleResponse.success) {
            scheduleCreated = true;
            console.log('✅ Medications: Schedule created successfully');
            
            setScheduleCreationStatus({
              isCreating: false,
              success: true,
              message: '✅ Medication added and reminders scheduled successfully!'
            });
            
            // Clear success message after 5 seconds
            setTimeout(() => {
              setScheduleCreationStatus({ isCreating: false, success: null, message: null });
            }, 5000);
          } else {
            console.warn('⚠️ Medications: Schedule creation failed:', scheduleResponse.error);
            
            setScheduleCreationStatus({
              isCreating: false,
              success: false,
              message: '⚠️ Medication added but reminders could not be scheduled. You can set them up later from the medication list.'
            });
            
            // Clear error message after 8 seconds
            setTimeout(() => {
              setScheduleCreationStatus({ isCreating: false, success: null, message: null });
            }, 8000);
          }
        } catch (scheduleError) {
          console.error('❌ Medications: Error creating schedule:', scheduleError);
          
          setScheduleCreationStatus({
            isCreating: false,
            success: false,
            message: '⚠️ Medication added but reminders could not be scheduled. You can set them up later from the medication list.'
          });
          
          // Clear error message after 8 seconds
          setTimeout(() => {
            setScheduleCreationStatus({ isCreating: false, success: null, message: null });
          }, 8000);
        }
      } else {
        console.log('ℹ️ Medications: No automatic schedule creation needed (hasReminders:', medication.hasReminders, ', isPRN:', medication.isPRN, ')');
      }
      
      // Step 3: Update local state
      setMedications(prev => [...prev, createdMedication!]);
      
      // Step 4: Refresh related data
      if (scheduleCreated) {
        // Refresh medications list to show the new schedule
        await loadMedications();
        // Refresh today's view
        setRefreshTrigger(prev => prev + 1);
        // Refresh adherence stats
        loadMissedMedicationsCount();
        loadAdherenceStats();
      }
      
    } catch (error) {
      console.error('❌ Medications: Error adding medication:', error);
      setScheduleCreationStatus({
        isCreating: false,
        success: false,
        message: '❌ Failed to add medication. Please try again.'
      });
      throw error; // Re-throw to let the component handle the error
    } finally {
      setIsLoadingMedications(false);
    }
  };

  const handleUpdateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      setIsLoadingMedications(true);
      const response = await apiClient.put<{ success: boolean; data: Medication }>(
        API_ENDPOINTS.MEDICATION_BY_ID(id),
        updates
      );
      
      if (response.success && response.data) {
        // Parse date strings back to Date objects for the updated medication
        const medicationWithDates = {
          ...response.data,
          prescribedDate: new Date(response.data.prescribedDate),
          startDate: response.data.startDate ? new Date(response.data.startDate) : undefined,
          endDate: response.data.endDate ? new Date(response.data.endDate) : undefined,
          createdAt: new Date(response.data.createdAt),
          updatedAt: new Date(response.data.updatedAt),
        };
        setMedications(prev =>
          prev.map(med =>
            med.id === id ? medicationWithDates : med
          )
        );
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
      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.MEDICATION_BY_ID(id)
      );
      
      if (response.success) {
        // Clear the medications cache to force fresh data
        const cacheKey = 'medications_/medications';
        if ('caches' in window) {
          caches.open('api-cache').then(cache => {
            cache.delete(cacheKey).then(() => {
              console.log('✅ Cleared medications cache after deletion');
            });
          });
        }
        
        // Update local state
        setMedications(prev => prev.filter(med => med.id !== id));
        
        // Force immediate refresh to ensure UI is in sync
        await loadMedications();
        
        // Refresh related data
        loadMissedMedicationsCount();
        loadAdherenceStats();
        setRefreshTrigger(prev => prev + 1);
      } else {
        // If backend delete failed, don't remove from UI
        throw new Error('Failed to delete medication from server');
      }
    } catch (error) {
      console.error('Error deleting medication:', error);
      // Show user-friendly error message
      alert('Failed to delete medication. Please try again or contact support if the problem persists.');
      throw error;
    } finally {
      setIsLoadingMedications(false);
    }
  };

  // Get active medications
  const activeMedications = medications.filter(med => med.isActive);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
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
      <main className="px-4 py-4 pb-20 max-w-full overflow-x-hidden">
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
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors w-full sm:w-auto flex-shrink-0"
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
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium w-full sm:w-auto text-left sm:text-right"
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

        {/* Today's Medications Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Today's Med List</h2>
            {missedMedicationsCount > 0 && (
              <button
                onClick={() => setShowMissedModal(true)}
                className="text-xs px-3 py-1.5 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors flex-shrink-0"
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
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-rose-600 hover:text-rose-700 transition-colors"
          >
            <div className="bg-rose-100 p-1.5 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <div className="bg-blue-100 p-1.5 rounded-lg">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <div className="bg-purple-100 p-1.5 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-green-600 hover:text-green-700 transition-colors"
          >
            <div className="bg-green-100 p-1.5 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 text-amber-600 hover:text-amber-700 transition-colors"
          >
            <div className="bg-amber-100 p-1.5 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs">Family</span>
          </Link>
        </div>
      </nav>

      {/* Missed Medications Modal */}
      <MissedMedicationsModal
        isOpen={showMissedModal}
        onClose={() => setShowMissedModal(false)}
        onMedicationAction={handleMissedMedicationAction}
      />
    </div>
  );
}