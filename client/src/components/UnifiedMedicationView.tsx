/**
 * @deprecated This component has been deprecated as of Phase 2 UX Consolidation.
 * All functionality has been merged into MedicationManager.tsx
 *
 * This file is kept for reference only and should not be used in new code.
 * Use MedicationManager instead, which now includes:
 * - Inline schedule status badges (Scheduled/Unscheduled/Paused)
 * - Today's dose information
 * - Next scheduled dose time
 * - Visual indicators for reminder status
 * - Expandable past medications section
 * - All CRUD operations
 *
 * Migration: Replace <UnifiedMedicationView /> with <MedicationManager />
 * Date: 2025-09-30
 */

import React, { useState, useEffect } from 'react';
import {
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Plus,
  Bell,
  BellOff,
  Settings,
  Info,
  Lock
} from 'lucide-react';
import type { Medication, MedicationCalendarEvent, MedicationSchedule } from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from './LoadingSpinner';
import { parseFrequencyToScheduleType, generateDefaultTimesForFrequency, validateFrequencyParsing } from '@/utils/medicationFrequencyUtils';

/**
 * @deprecated Use MedicationManager instead
 */
interface UnifiedMedicationViewProps {
  patientId: string;
  medications: Medication[];
  maxItems?: number;
  showCreateScheduleButton?: boolean;
  onScheduleCreated?: () => void;
}

interface MedicationWithStatus extends Medication {
  scheduleStatus: 'scheduled' | 'unscheduled' | 'paused';
  todaysEvents: MedicationCalendarEvent[];
  nextDose?: MedicationCalendarEvent;
  schedules: MedicationSchedule[];
  hasActiveSchedule: boolean;
}

/**
 * @deprecated This component is deprecated. Use MedicationManager instead.
 * All functionality from UnifiedMedicationView has been consolidated into MedicationManager.
 */
export default function UnifiedMedicationView({
  patientId,
  medications,
  maxItems = 10,
  showCreateScheduleButton = true,
  onScheduleCreated
}: UnifiedMedicationViewProps) {
  const [medicationsWithStatus, setMedicationsWithStatus] = useState<MedicationWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
  const [creatingSchedule, setCreatingSchedule] = useState<string | null>(null);
  
  // Add family context for permission checks
  const { hasPermission, userRole, activePatientAccess } = useFamily();

  useEffect(() => {
    loadMedicationsWithStatus();
  }, [patientId, medications]);

  const loadMedicationsWithStatus = async () => {
    try {
      setIsLoading(true);
      
      // Get today's date range
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all medication schedules for this patient
      const schedulesResult = await medicationCalendarApi.getMedicationSchedules();
      const allSchedules = schedulesResult.success ? schedulesResult.data || [] : [];
      
      // Log if there's an error fetching schedules
      if (!schedulesResult.success) {
        console.warn('⚠️ Failed to fetch medication schedules:', schedulesResult.error);
        console.log('🔧 Continuing with empty schedules array to show unscheduled medications');
      }

      // Get today's medication events
      const eventsResult = await medicationCalendarApi.getMedicationCalendarEvents({
        startDate: startOfDay,
        endDate: endOfDay
      });
      const todaysEvents = eventsResult.success ? eventsResult.data || [] : [];

      // Process each medication to determine its status
      const medicationsWithStatusData: MedicationWithStatus[] = medications.map(medication => {
        // Find schedules for this medication
        const medicationSchedules = allSchedules.filter(schedule => 
          schedule.medicationId === medication.id && schedule.isActive && !schedule.isPaused
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
          const hasPausedSchedules = allSchedules.some(schedule => 
            schedule.medicationId === medication.id && schedule.isPaused
          );
          scheduleStatus = hasPausedSchedules ? 'paused' : 'scheduled';
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

      // Sort medications: scheduled first, then by next dose time, then alphabetically
      medicationsWithStatusData.sort((a, b) => {
        // First priority: scheduled medications
        if (a.scheduleStatus === 'scheduled' && b.scheduleStatus !== 'scheduled') return -1;
        if (a.scheduleStatus !== 'scheduled' && b.scheduleStatus === 'scheduled') return 1;
        
        // Second priority: medications with upcoming doses
        if (a.nextDose && !b.nextDose) return -1;
        if (!a.nextDose && b.nextDose) return 1;
        
        // Third priority: sort by next dose time
        if (a.nextDose && b.nextDose) {
          return new Date(a.nextDose.scheduledDateTime).getTime() - new Date(b.nextDose.scheduledDateTime).getTime();
        }
        
        // Final priority: alphabetical by name
        return a.name.localeCompare(b.name);
      });

      setMedicationsWithStatus(medicationsWithStatusData.slice(0, maxItems));
    } catch (error) {
      console.error('Error loading medications with status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkMedicationTaken = async (eventId: string) => {
    try {
      setTakingMedication(eventId);
      
      const result = await medicationCalendarApi.markMedicationTaken(eventId, new Date());
      
      if (result.success) {
        await loadMedicationsWithStatus(); // Refresh the data
      } else {
        console.error('Failed to mark medication as taken:', result.error);
        alert(`Failed to mark medication as taken: ${result.error}`);
      }
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setTakingMedication(null);
    }
  };

  const handleCreateSchedule = async (medication: Medication) => {
    try {
      setCreatingSchedule(medication.id);
      
      // Generate default schedule based on medication frequency
      const frequency = getScheduleFrequency(medication.frequency);
      const times = getDefaultTimes(frequency);
      
      const scheduleData = {
        medicationId: medication.id,
        patientId: medication.patientId,
        frequency,
        times,
        startDate: new Date(),
        isIndefinite: true,
        dosageAmount: medication.dosage,
        instructions: medication.instructions || '',
        generateCalendarEvents: true,
        reminderMinutesBefore: [15, 5],
        isActive: true
      };

      const result = await medicationCalendarApi.createMedicationSchedule(scheduleData);
      
      if (result.success) {
        console.log('✅ Schedule created successfully for:', medication.name);
        await loadMedicationsWithStatus(); // Refresh the data
        onScheduleCreated?.();
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('medicationScheduleUpdated'));
      } else {
        console.error('Failed to create schedule:', result.error);
        alert(`Failed to create schedule: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Failed to create medication schedule. Please try again.');
    } finally {
      setCreatingSchedule(null);
    }
  };

  const getScheduleFrequency = (medicationFrequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' => {
    const parsedFrequency = parseFrequencyToScheduleType(medicationFrequency);
    const generatedTimes = generateDefaultTimesForFrequency(parsedFrequency);
    
    // Validate and log the parsing for debugging
    validateFrequencyParsing(medicationFrequency, parsedFrequency, generatedTimes);
    
    return parsedFrequency;
  };

  const getDefaultTimes = (frequency: string): string[] => {
    console.log('🔍 UnifiedMedicationView: Getting default times for frequency:', frequency);
    
    // Use medicationCalendarApi as single source of truth for default times
    const times = medicationCalendarApi.generateDefaultTimes(frequency);
    console.log('🔍 UnifiedMedicationView: Generated default times:', times);
    
    return times;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs < 0) {
      const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
      if (overdueMins < 60) {
        return `${overdueMins}m overdue`;
      } else {
        const overdueHours = Math.floor(overdueMins / 60);
        return `${overdueHours}h overdue`;
      }
    }
    
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) {
      return `in ${mins}m`;
    } else {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `in ${hours}h ${remainingMins}m` : `in ${hours}h`;
    }
  };

  const getStatusIcon = (medication: MedicationWithStatus) => {
    if (medication.scheduleStatus === 'scheduled') {
      return <Bell className="w-4 h-4 text-green-600" />;
    } else if (medication.scheduleStatus === 'paused') {
      return <BellOff className="w-4 h-4 text-yellow-600" />;
    } else {
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    }
  };

  const getStatusText = (medication: MedicationWithStatus) => {
    switch (medication.scheduleStatus) {
      case 'scheduled':
        return 'Scheduled';
      case 'paused':
        return 'Paused';
      case 'unscheduled':
        return 'No Schedule';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (medication: MedicationWithStatus) => {
    switch (medication.scheduleStatus) {
      case 'scheduled':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unscheduled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-gray-600 text-sm">Loading medications...</span>
      </div>
    );
  }

  if (medicationsWithStatus.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No medications found</h4>
        <p className="text-gray-500">
          Add medications to see them here with their schedule status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">All Medications</h3>
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
      </div>

      {/* Medications List */}
      <div className="space-y-3">
        {medicationsWithStatus.map((medication) => (
          <div
            key={medication.id}
            className={`bg-white rounded-lg border p-4 ${
              medication.scheduleStatus === 'unscheduled' 
                ? 'border-orange-200 bg-orange-50' 
                : medication.scheduleStatus === 'paused'
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className={`p-2 rounded-full ${
                  medication.scheduleStatus === 'scheduled' ? 'bg-green-100' :
                  medication.scheduleStatus === 'paused' ? 'bg-yellow-100' :
                  'bg-orange-100'
                }`}>
                  <Pill className={`w-4 h-4 ${
                    medication.scheduleStatus === 'scheduled' ? 'text-green-600' :
                    medication.scheduleStatus === 'paused' ? 'text-yellow-600' :
                    'text-orange-600'
                  }`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-gray-900">
                      {medication.name}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(medication)}`}>
                      {getStatusIcon(medication)}
                      <span className="ml-1">{getStatusText(medication)}</span>
                    </span>
                    {medication.isPRN && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        PRN
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {medication.dosage} • {medication.frequency}
                  </p>

                  {/* Schedule Status Details */}
                  {medication.scheduleStatus === 'scheduled' && medication.nextDose && (
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center space-x-1 text-blue-600">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(new Date(medication.nextDose.scheduledDateTime))}</span>
                      </span>
                      <span className="text-gray-500">
                        {getTimeUntil(new Date(medication.nextDose.scheduledDateTime))}
                      </span>
                    </div>
                  )}

                  {medication.scheduleStatus === 'unscheduled' && (
                    <div className="flex items-center space-x-1 text-sm text-orange-600">
                      <Info className="w-3 h-3" />
                      <span>No reminders set - medication won't appear in daily schedule</span>
                    </div>
                  )}

                  {medication.scheduleStatus === 'paused' && (
                    <div className="flex items-center space-x-1 text-sm text-yellow-600">
                      <BellOff className="w-3 h-3" />
                      <span>Reminders paused</span>
                    </div>
                  )}

                  {/* Additional medication info */}
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Prescribed: {
                        medication.prescribedDate instanceof Date
                          ? medication.prescribedDate.toLocaleDateString()
                          : new Date(medication.prescribedDate).toLocaleDateString()
                      }</span>
                    </span>
                    {medication.prescribedBy && (
                      <span>By: {medication.prescribedBy}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Permission-based Action Buttons */}
              <div className="flex items-center space-x-2">
                {(() => {
                  const canEdit = hasPermission('canEdit');
                  
                  // Debug logging for permission checks
                  console.log('🔍 UnifiedMedicationView: Permission check for medication actions:', {
                    medicationId: medication.id,
                    medicationName: medication.name,
                    userRole,
                    canEdit,
                    scheduleStatus: medication.scheduleStatus,
                    activePatientAccess: activePatientAccess ? {
                      patientName: activePatientAccess.patientName,
                      permissions: activePatientAccess.permissions,
                      accessLevel: activePatientAccess.accessLevel
                    } : null
                  });
                  
                  if (!canEdit) {
                    return (
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Lock className="w-3 h-3" />
                        <span>View only access</span>
                      </div>
                    );
                  }
                  
                  return (
                    <>
                      {/* Mark as Taken Button (only for scheduled medications with upcoming doses) */}
                      {medication.scheduleStatus === 'scheduled' && medication.nextDose && (
                        <button
                          onClick={() => handleMarkMedicationTaken(medication.nextDose!.id)}
                          disabled={takingMedication === medication.nextDose!.id}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md disabled:opacity-50 transition-colors"
                          title="Mark as taken"
                        >
                          {takingMedication === medication.nextDose!.id ? (
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Create Schedule Button (only for unscheduled medications) */}
                      {medication.scheduleStatus === 'unscheduled' && showCreateScheduleButton && (
                        <button
                          onClick={() => handleCreateSchedule(medication)}
                          disabled={creatingSchedule === medication.id}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                          title="Create medication schedule"
                        >
                          {creatingSchedule === medication.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          <span>Schedule</span>
                        </button>
                      )}

                      {/* Settings Button (for scheduled medications) */}
                      {medication.scheduleStatus === 'scheduled' && (
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                          title="Manage schedule"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Today's Doses Summary (for scheduled medications) */}
            {medication.scheduleStatus === 'scheduled' && medication.todaysEvents.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Today's doses:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">
                      {medication.todaysEvents.filter(e => e.status === 'taken').length} taken
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-blue-600">
                      {medication.todaysEvents.filter(e => e.status === 'scheduled').length} pending
                    </span>
                    {medication.todaysEvents.filter(e => e.status === 'missed').length > 0 && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-red-600">
                          {medication.todaysEvents.filter(e => e.status === 'missed').length} missed
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
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