import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pill,
  Bell,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import { useFamily } from '@/contexts/FamilyContext';
import { parseFrequencyToScheduleType, generateDefaultTimesForFrequency, validateFrequencyParsing } from '@/utils/medicationFrequencyUtils';
import LoadingSpinner from './LoadingSpinner';
import { showSuccess, showError } from '@/utils/toast';
import MedicationForm from './MedicationForm';
import MedicationList from './MedicationList';
import { MedicationWithStatus } from '@/types/medicationTypes';

interface MedicationManagerProps {
  patientId: string;
  medications: Medication[];
  onAddMedication: (medication: NewMedication) => Promise<void>;
  onUpdateMedication: (id: string, medication: Partial<Medication>) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function MedicationManager({
  patientId,
  medications,
  onAddMedication,
  onUpdateMedication,
  onDeleteMedication,
  isLoading = false
}: MedicationManagerProps) {
  const [isAddingMedication, setIsAddingMedication] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState<string | null>(null);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
  const [showPastMedications, setShowPastMedications] = useState(false);
  
  const queryClient = useQueryClient();
  const { hasPermission } = useFamily();

  // Query for today's medication buckets/status
  const { data: schedulesResult, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['todayMedicationBuckets', patientId],
    queryFn: () => unifiedMedicationApi.getTodayMedicationBuckets(new Date(), { patientId }),
    enabled: !!patientId && medications.length > 0,
    staleTime: 1000 * 60, // 1 minute
  });

  // Compute medications with status
  const medicationsWithStatus = useMemo(() => {
    if (!schedulesResult?.success || !schedulesResult.data) {
      // Return basic mapping if no schedule data yet
      return medications
        .filter(med => med.isActive)
        .map(med => ({
          ...med,
          scheduleStatus: 'unscheduled' as const,
          todaysEvents: [],
          schedules: [],
          hasActiveSchedule: false
        }));
    }

    const now = new Date();
    const data = schedulesResult.data;

    // Flatten buckets to get all schedules and events
    const allBucketItems = [
      ...data.now,
      ...data.dueSoon,
      ...data.morning,
      ...data.lunch,
      ...data.evening,
      ...data.beforeBed,
      ...data.overdue,
      ...data.completed
    ];

    // Map bucket items to schedules (approximate) and events
    const allSchedules = allBucketItems.map(item => ({
      medicationId: item.commandId,
      frequency: 'daily' as const, // Assumed from bucket presence
      times: [item.scheduledTime],
      isActive: true,
      isPaused: false
    }));

    const todaysEvents = allBucketItems.map(item => ({
      id: item.eventId,
      medicationId: item.commandId,
      status: item.timeSlot === 'completed' ? 'taken' : (item.isOverdue ? 'missed' : 'scheduled'), // Simplified status mapping
      scheduledDateTime: new Date(item.scheduledTime),
    }));

    const activeMeds = medications.filter(med => med.isActive);
    
    const processed = activeMeds.map(medication => {
      // Find schedules for this medication
      const medicationSchedules = allSchedules.filter(schedule => 
        schedule.medicationId === medication.id
      );

      // Find today's events for this medication
      const medicationTodaysEvents = todaysEvents.filter(event => 
        event.medicationId === medication.id
      );

      // Find next upcoming dose
      const upcomingEvents = medicationTodaysEvents.filter(event => 
        event.status === 'scheduled' && new Date(event.scheduledDateTime) > now
      );
      const nextDose = upcomingEvents.sort((a, b) => 
        new Date(a.scheduledDateTime).getTime() - new Date(b.scheduledDateTime).getTime()
      )[0];

      // Determine schedule status
      let scheduleStatus: 'scheduled' | 'unscheduled' | 'paused' = 'unscheduled';
      const hasActiveSchedule = medicationSchedules.length > 0;
      
      if (hasActiveSchedule) {
        // Check for paused state if available in future API updates
        scheduleStatus = 'scheduled';
      } else if (medication.times && medication.times.length > 0) {
        // Fallback: If medication has times configured but doesn't appear in today's buckets
        // (e.g. weekly medication not due today), still consider it scheduled
        scheduleStatus = 'scheduled';
      }

      return {
        ...medication,
        scheduleStatus,
        todaysEvents: medicationTodaysEvents,
        nextDose,
        schedules: medicationSchedules,
        hasActiveSchedule
      };
    });

    // Sort
    return processed.sort((a, b) => {
      if (a.scheduleStatus === 'scheduled' && b.scheduleStatus !== 'scheduled') return -1;
      if (a.scheduleStatus !== 'scheduled' && b.scheduleStatus === 'scheduled') return 1;
      
      if (a.nextDose && !b.nextDose) return -1;
      if (!a.nextDose && b.nextDose) return 1;
      
      if (a.nextDose && b.nextDose) {
        return new Date(a.nextDose.scheduledDateTime).getTime() - new Date(b.nextDose.scheduledDateTime).getTime();
      }
      
      return a.name.localeCompare(b.name);
    });
  }, [medications, schedulesResult]);

  const handleMarkMedicationTaken = async (eventId: string) => {
    try {
      setTakingMedication(eventId);
      
      const medication = medicationsWithStatus.find(med => 
        med.todaysEvents.some(event => event.id === eventId)
      );
      const event = medication?.todaysEvents.find(e => e.id === eventId);
      
      if (!event) throw new Error('Event not found');

      const result = await unifiedMedicationApi.markMedicationTaken(
        medication!.id,
        { scheduledDateTime: event.scheduledDateTime }
      );
      
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });
        showSuccess('Medication marked as taken!');
      } else {
        showError(`Failed to mark medication as taken: ${result.error}`);
      }
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setTakingMedication(null);
    }
  };

  const handleCreateSchedule = async (medication: Medication) => {
    try {
      setCreatingSchedule(medication.id);
      
      const frequency = getScheduleFrequency(medication.frequency);
      const times = getDefaultTimes(frequency);
      
      const updatePayload = {
        scheduleData: {
          frequency,
          times,
          startDate: medication.startDate || new Date(),
          endDate: medication.endDate,
          isIndefinite: !medication.endDate,
          dosageAmount: medication.dosage,
          scheduleInstructions: medication.instructions,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        reminderSettings: {
          enabled: true,
          minutesBefore: [15, 5],
          notificationMethods: ['browser', 'push']
        },
        status: { isActive: medication.isActive ?? true }
      };

      const result = await unifiedMedicationApi.updateMedication(
        medication.id,
        updatePayload,
        { reason: 'Creating schedule for existing medication' }
      );
      
      const command = result.data?.command || result.data;

      if (result.success && command) {
        await queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });
        window.dispatchEvent(new CustomEvent('medicationScheduleUpdated'));
        showSuccess('Medication schedule created successfully!');
      } else {
        showError(`Failed to create schedule: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ [MedicationManager] Error creating schedule:', error);
      showError('Failed to create medication schedule. Please try again.');
    } finally {
      setCreatingSchedule(null);
    }
  };

  const getScheduleFrequency = (medicationFrequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' => {
    const parsedFrequency = parseFrequencyToScheduleType(medicationFrequency);
    const generatedTimes = generateDefaultTimesForFrequency(parsedFrequency);
    validateFrequencyParsing(medicationFrequency, parsedFrequency, generatedTimes);
    return parsedFrequency;
  };

  const getDefaultTimes = (frequency: string): string[] => {
    return generateDefaultTimesForFrequency(frequency as any);
  };

  const handleFormSubmit = async (data: NewMedication) => {
    setIsSubmitting(true);
    try {
      if (editingMedicationId) {
        await onUpdateMedication(editingMedicationId, data);
        setEditingMedicationId(null);
      } else {
        await onAddMedication(data);
        setIsAddingMedication(false);
      }
      queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });
    } catch (error) {
      console.error('Error saving medication:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (medication: Medication) => {
    setEditingMedicationId(medication.id);
    setIsAddingMedication(true);
  };

  const handleCancelForm = () => {
    setIsAddingMedication(false);
    setEditingMedicationId(null);
  };

  const handleDelete = async (medicationId: string) => {
    if (window.confirm('Are you sure you want to delete this medication?')) {
      try {
        await onDeleteMedication(medicationId);
        queryClient.invalidateQueries({ queryKey: ['todayMedicationBuckets'] });
      } catch (error) {
        console.error('Error deleting medication:', error);
      }
    }
  };

  const inactiveMedications = medications.filter(med => !med.isActive);
  const editingMedication = medications.find(m => m.id === editingMedicationId);

  if (isLoading || (isLoadingStatus && medications.length > 0)) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-gray-600 text-sm">Loading medications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className="flex items-center space-x-1">
              <Bell className="w-3 h-3 text-green-600" />
              <span>{medicationsWithStatus.filter(m => m.scheduleStatus === 'scheduled').length} scheduled</span>
            </span>
            <span className="flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-orange-600" />
              <span>{medicationsWithStatus.filter(m => m.scheduleStatus === 'unscheduled').length} unscheduled</span>
            </span>
          </div>
        </div>
        {!isAddingMedication && hasPermission('canEdit') && (
          <button
            onClick={() => setIsAddingMedication(true)}
            className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAddingMedication && (
        <MedicationForm
          patientId={patientId}
          initialData={editingMedication}
          existingMedications={medications}
          onSubmit={handleFormSubmit}
          onCancel={handleCancelForm}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Active Medications List */}
      {medicationsWithStatus.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Active Medications</h4>
          <MedicationList
            medications={medicationsWithStatus}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateSchedule={handleCreateSchedule}
            onMarkTaken={handleMarkMedicationTaken}
            takingMedication={takingMedication}
            creatingSchedule={creatingSchedule}
            canEdit={hasPermission('canEdit')}
          />
        </div>
      )}

      {/* Empty state */}
      {medicationsWithStatus.length === 0 && !isAddingMedication && (
        <div className="text-center py-8">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No medications added</h4>
          <p className="text-gray-500 mb-4">Add medications to track prescriptions and dosages.</p>
          {hasPermission('canEdit') && (
            <button
              onClick={() => setIsAddingMedication(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center space-x-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Medication</span>
            </button>
          )}
        </div>
      )}

      {/* Expandable Past Medications Section */}
      {inactiveMedications.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200">
          <button
            onClick={() => setShowPastMedications(!showPastMedications)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <h4 className="text-md font-medium text-gray-700">
                Past Medications ({inactiveMedications.length})
              </h4>
            </div>
            {showPastMedications ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          
          {showPastMedications && (
            <div className="px-4 pb-4 space-y-3">
              {inactiveMedications.map((medication) => (
                <div
                  key={medication.id}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <Pill className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h5 className="font-medium text-gray-700">{medication.name}</h5>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Inactive
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {medication.dosage} • {medication.frequency}
                      </p>
                      {medication.instructions && (
                        <p className="text-sm text-gray-400 mt-1">{medication.instructions}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      {medicationsWithStatus.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Medication Schedule Status:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Scheduled:</strong> Medication has active reminders and will appear in daily schedule</li>
                <li>• <strong>No Schedule:</strong> Medication is in your list but has no reminders set</li>
                <li>• <strong>Paused:</strong> Reminders are temporarily disabled</li>
              </ul>
              {medicationsWithStatus.some(m => m.scheduleStatus === 'unscheduled') && (
                <p className="mt-2 text-blue-700">
                  <strong>Tip:</strong> Click "Schedule" to set up reminders for unscheduled medications.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
