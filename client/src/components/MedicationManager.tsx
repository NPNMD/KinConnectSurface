import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Pill,
  Save,
  X,
  CheckCircle,
  Bell,
  BellOff,
  AlertTriangle,
  Clock,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  Settings,
  Lock
} from 'lucide-react';
import { Medication, NewMedication, MedicationCalendarEvent, MedicationSchedule } from '@shared/types';
import { DrugConcept } from '@/lib/drugApi';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import { useFamily } from '@/contexts/FamilyContext';
import { parseFrequencyToScheduleType, generateDefaultTimesForFrequency, validateFrequencyParsing } from '@/utils/medicationFrequencyUtils';
import MedicationSearch from './MedicationSearch';
import LoadingSpinner from './LoadingSpinner';
import { showSuccess, showError } from '@/utils/toast';

interface MedicationManagerProps {
  patientId: string;
  medications: Medication[];
  onAddMedication: (medication: NewMedication) => Promise<void>;
  onUpdateMedication: (id: string, medication: Partial<Medication>) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
  isLoading?: boolean;
}

// Enhanced medication with schedule status
interface MedicationWithStatus extends Medication {
  scheduleStatus: 'scheduled' | 'unscheduled' | 'paused';
  todaysEvents: MedicationCalendarEvent[];
  nextDose?: MedicationCalendarEvent;
  schedules: MedicationSchedule[];
  hasActiveSchedule: boolean;
}

// Simplified form data - only essential fields
interface MedicationFormData {
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  prescribedBy: string;
  isPRN: boolean;
  hasReminders: boolean;
  reminderTimes: string[];
}

const initialFormData: MedicationFormData = {
  name: '',
  dosage: '',
  frequency: '',
  instructions: '',
  prescribedBy: '',
  isPRN: false,
  hasReminders: false,
  reminderTimes: [],
};

// Simplified frequency options
const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'As needed'
];

// Frequency normalization function - maps display values to API values
const normalizeFrequency = (displayFrequency: string): string => {
  const freq = displayFrequency.toLowerCase().trim();
  
  // Map common display formats to unified API format
  const mappings: Record<string, string> = {
    'once daily': 'daily',
    'once a day': 'daily',
    'daily': 'daily',
    'twice daily': 'twice_daily',
    'twice a day': 'twice_daily',
    'bid': 'twice_daily',
    'three times daily': 'three_times_daily',
    'three times a day': 'three_times_daily',
    'tid': 'three_times_daily',
    'four times daily': 'four_times_daily',
    'four times a day': 'four_times_daily',
    'qid': 'four_times_daily',
    'as needed': 'as_needed',
    'prn': 'as_needed'
  };
  
  const normalized = mappings[freq];
  if (normalized) {
    console.log(`🔄 Frequency normalized: "${displayFrequency}" → "${normalized}"`);
    return normalized;
  }
  
  // Fallback with warning
  console.warn(`⚠️ Unknown frequency "${displayFrequency}", defaulting to "daily"`);
  return 'daily';
};

// Simple reminder time presets
const REMINDER_PRESETS = [
  { value: '08:00', label: 'Morning (8 AM)' },
  { value: '12:00', label: 'Noon (12 PM)' },
  { value: '18:00', label: 'Evening (6 PM)' },
  { value: '22:00', label: 'Bedtime (10 PM)' }
];

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
  const [formData, setFormData] = useState<MedicationFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  
  // Enhanced state for schedule status
  const [medicationsWithStatus, setMedicationsWithStatus] = useState<MedicationWithStatus[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [creatingSchedule, setCreatingSchedule] = useState<string | null>(null);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
  const [showPastMedications, setShowPastMedications] = useState(false);
  
  // Add family context for permission checks
  const { hasPermission, userRole, activePatientAccess } = useFamily();

  // Load medications with schedule status
  useEffect(() => {
    loadMedicationsWithStatus();
  }, [patientId, medications]);

  const loadMedicationsWithStatus = async () => {
    try {
      setIsLoadingStatus(true);
      
      // Get today's date range
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all medication schedules for this patient
      const schedulesResult = await unifiedMedicationApi.getTodayMedicationBuckets(new Date(), { patientId });
      const allSchedules = schedulesResult.success && schedulesResult.data ? [
        // Map the bucket data to schedule format
        ...schedulesResult.data.now.map(event => ({
          medicationId: event.commandId,
          frequency: 'daily' as const,
          times: [event.scheduledTime],
          isActive: true,
          isPaused: false
        })),
        ...schedulesResult.data.morning.map(event => ({
          medicationId: event.commandId,
          frequency: 'daily' as const,
          times: [event.scheduledTime],
          isActive: true,
          isPaused: false
        })),
        // Add other time buckets as needed
      ] : [];
      
      if (!schedulesResult.success) {
        console.warn('⚠️ Failed to fetch medication schedules:', schedulesResult.error);
      }

      // Get today's medication events using unified API
      const todaysEvents = schedulesResult.success && schedulesResult.data ? [
        ...schedulesResult.data.now.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.dueSoon.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.morning.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.lunch.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.evening.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.beforeBed.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.overdue.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'scheduled' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
        ...schedulesResult.data.completed.map(event => ({
          id: event.eventId,
          medicationId: event.commandId,
          status: 'taken' as const,
          scheduledDateTime: new Date(event.scheduledTime),
        })),
      ] : [];

      // Process each active medication to determine its status
      const activeMeds = medications.filter(med => med.isActive);
      const medicationsWithStatusData: MedicationWithStatus[] = activeMeds.map(medication => {
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
          todaysEvents: [], // Simplified - main CRUD handled by parent component
          nextDose: undefined,
          schedules: [], // Simplified
          hasActiveSchedule
        };
      });

      // Sort medications: scheduled first, then by next dose time, then alphabetically
      medicationsWithStatusData.sort((a, b) => {
        if (a.scheduleStatus === 'scheduled' && b.scheduleStatus !== 'scheduled') return -1;
        if (a.scheduleStatus !== 'scheduled' && b.scheduleStatus === 'scheduled') return 1;
        
        if (a.nextDose && !b.nextDose) return -1;
        if (!a.nextDose && b.nextDose) return 1;
        
        if (a.nextDose && b.nextDose) {
          return new Date(a.nextDose.scheduledDateTime).getTime() - new Date(b.nextDose.scheduledDateTime).getTime();
        }
        
        return a.name.localeCompare(b.name);
      });

      setMedicationsWithStatus(medicationsWithStatusData);
    } catch (error) {
      console.error('Error loading medications with status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleMarkMedicationTaken = async (eventId: string) => {
    try {
      setTakingMedication(eventId);
      
      // Find the medication for this event to get the scheduled time
      const medication = medicationsWithStatus.find(med => 
        med.todaysEvents.some(event => event.id === eventId)
      );
      const event = medication?.todaysEvents.find(e => e.id === eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }

      const result = await unifiedMedicationApi.markMedicationTaken(
        medication!.id, // commandId
        {
          scheduledDateTime: event.scheduledDateTime
        }
      );
      
      if (result.success) {
        await loadMedicationsWithStatus();
        showSuccess('Medication marked as taken!');
      } else {
        console.error('Failed to mark medication as taken:', result.error);
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
      console.log('🔔 [MedicationManager] handleCreateSchedule called:', {
        medicationId: medication.id,
        medicationName: medication.name,
        currentFrequency: medication.frequency,
        currentHasReminders: medication.hasReminders,
        currentReminderTimes: medication.reminderTimes
      });

      setCreatingSchedule(medication.id);
      
      const frequency = getScheduleFrequency(medication.frequency);
      const times = getDefaultTimes(frequency);
      
      console.log('🔔 [MedicationManager] Generated schedule data:', {
        frequency,
        times,
        startDate: medication.startDate || new Date(),
        endDate: medication.endDate,
        isIndefinite: !medication.endDate,
        dosageAmount: medication.dosage
      });

      const updatePayload = {
        scheduleData: {
          frequency,
          times,
          startDate: medication.startDate || new Date(),
          endDate: medication.endDate,
          isIndefinite: !medication.endDate,
          dosageAmount: medication.dosage,
          scheduleInstructions: medication.instructions
        },
        reminderSettings: {
          enabled: medication.hasReminders !== false, // Default to true if not explicitly false
          minutesBefore: [15, 5],
          notificationMethods: ['browser', 'push']
        },
        status: {
          isActive: medication.isActive ?? true
        }
      };

      console.log('🔔 [MedicationManager] Sending update payload to API:', JSON.stringify(updatePayload, null, 2));

      // Use unified medication API - schedules are embedded in medications
      // Update the medication with schedule data instead of creating separate schedule
      const result = await unifiedMedicationApi.updateMedication(
        medication.id,
        updatePayload,
        {
          reason: 'Creating schedule for existing medication',
          notifyFamily: false
        }
      );
      
      console.log('🔔 [MedicationManager] API response received:', {
        success: result.success,
        hasData: !!result.data,
        hasCommand: !!result.data?.command,
        hasWorkflow: !!result.data?.workflow,
        error: result.error,
        fullResponse: JSON.stringify(result, null, 2)
      });

      if (result.success) {
        console.log('✅ [MedicationManager] Schedule update successful, refreshing medications...');
        // Refresh medications and trigger update event
        await loadMedicationsWithStatus();
        window.dispatchEvent(new CustomEvent('medicationScheduleUpdated'));
        showSuccess('Medication schedule created successfully!');
      } else {
        console.error('❌ [MedicationManager] Failed to create schedule:', result.error);
        showError(`Failed to create schedule: ${result.error}`);
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

  const handleDrugSelect = async (drug: DrugConcept) => {
    setValidationErrors({});
    setDuplicateWarning(null);
    
    const existingMed = medications.find(med =>
      med.name.toLowerCase() === drug.name.toLowerCase()
    );
    
    if (existingMed && !editingMedicationId) {
      setDuplicateWarning(`This medication (${drug.name}) is already in the patient's medication list.`);
    }
    
    const dosageMatch = drug.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
    const dosage = dosageMatch ? `${dosageMatch[1]}${dosageMatch[2].toLowerCase()}` : '';
    
    setFormData(prev => ({
      ...prev,
      name: drug.name,
      dosage: dosage || prev.dosage,
    }));
  };

  const handleInputChange = (field: keyof MedicationFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Enhanced validation with dosage format checking
  const validateDosageFormat = (dosage: string): boolean => {
    // Common dosage formats: "10mg", "1 tablet", "5ml", "2.5mg", "100mcg", "1-2 tablets"
    const dosagePattern = /^(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)\s*(mg|mcg|g|ml|tablet|tablets|capsule|capsules|unit|units|iu|drop|drops|spray|sprays|patch|patches|puff|puffs)$/i;
    return dosagePattern.test(dosage.trim());
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Required field validation
    if (!formData.name.trim()) {
      errors.name = 'Medication name is required';
    }
    
    if (!formData.dosage.trim()) {
      errors.dosage = 'Dosage is required';
    } else if (!validateDosageFormat(formData.dosage)) {
      errors.dosage = 'Invalid dosage format. Use formats like "10mg", "1 tablet", "5ml"';
    }
    
    if (!formData.frequency.trim()) {
      errors.frequency = 'Frequency is required';
    }
    
    // PRN medications cannot have scheduled reminder times
    if (formData.isPRN && formData.hasReminders && formData.reminderTimes.length > 0) {
      errors.reminderTimes = 'PRN (as needed) medications cannot have scheduled reminder times';
    }
    
    // Check for duplicate medication - BLOCK submission instead of just warning
    const existingMed = medications.find(med =>
      med.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      med.isActive &&
      (!editingMedicationId || med.id !== editingMedicationId)
    );
    
    if (existingMed) {
      errors.name = `This medication is already in the active medication list`;
      setDuplicateWarning(`Duplicate detected: ${existingMed.name} is already active`);
    } else {
      setDuplicateWarning(null);
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize frequency before creating medication data
      const normalizedFrequency = normalizeFrequency(formData.frequency);
      
      const medicationData: NewMedication = {
        patientId,
        name: formData.name.trim(),
        dosage: formData.dosage.trim(),
        frequency: normalizedFrequency, // Use normalized frequency
        instructions: formData.instructions?.trim() || undefined,
        prescribedBy: formData.prescribedBy?.trim() || undefined,
        prescribedDate: new Date(),
        isActive: true,
        isPRN: formData.isPRN,
        hasReminders: formData.hasReminders,
        reminderTimes: formData.reminderTimes.length > 0 ? formData.reminderTimes : undefined,
      };

      console.log('🔍 DEBUG [MedicationManager Form]: Form submission data:', {
        name: medicationData.name,
        dosage: medicationData.dosage,
        frequency: medicationData.frequency,
        frequencyRaw: formData.frequency,
        frequencyNormalized: normalizedFrequency,
        isPRN: medicationData.isPRN,
        hasReminders: medicationData.hasReminders,
        reminderTimes: medicationData.reminderTimes,
        reminderTimesLength: medicationData.reminderTimes?.length || 0,
        fullMedicationData: JSON.stringify(medicationData, null, 2)
      });

      if (editingMedicationId) {
        await onUpdateMedication(editingMedicationId, medicationData);
        setEditingMedicationId(null);
      } else {
        await onAddMedication(medicationData);
        setIsAddingMedication(false);
      }

      handleCancel();
    } catch (error) {
      console.error('Error saving medication:', error);
      if (!editingMedicationId) {
        setIsAddingMedication(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (medication: Medication) => {
    setFormData({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      instructions: medication.instructions || '',
      prescribedBy: medication.prescribedBy || '',
      isPRN: medication.isPRN || false,
      hasReminders: medication.hasReminders || false,
      reminderTimes: medication.reminderTimes || [],
    });
    setEditingMedicationId(medication.id);
    setIsAddingMedication(true);
  };

  const handleCancel = () => {
    setIsAddingMedication(false);
    setEditingMedicationId(null);
    setFormData(initialFormData);
    setValidationErrors({});
    setDuplicateWarning(null);
  };

  const handleAddReminderTime = (time: string) => {
    if (!formData.reminderTimes.includes(time)) {
      setFormData(prev => ({
        ...prev,
        reminderTimes: [...prev.reminderTimes, time].sort()
      }));
    }
  };

  const handleRemoveReminderTime = (time: string) => {
    setFormData(prev => ({
      ...prev,
      reminderTimes: prev.reminderTimes.filter(t => t !== time)
    }));
  };

  const handleDelete = async (medicationId: string) => {
    if (window.confirm('Are you sure you want to delete this medication?')) {
      try {
        await onDeleteMedication(medicationId);
      } catch (error) {
        console.error('Error deleting medication:', error);
      }
    }
  };

  const inactiveMedications = medications.filter(med => !med.isActive);

  if (isLoadingStatus) {
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
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">
              {editingMedicationId ? 'Edit Medication' : 'Add New Medication'}
            </h4>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {duplicateWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-start space-x-2">
                <div className="text-sm text-yellow-800">{duplicateWarning}</div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Medication</label>
              <MedicationSearch
                onSelect={handleDrugSelect}
                placeholder="Search for medication by name..."
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    validationErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                  placeholder="Enter medication name"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage *</label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => handleInputChange('dosage', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    validationErrors.dosage ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                  placeholder="e.g., 500mg, 1 tablet"
                />
                {validationErrors.dosage && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.dosage}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">How Often *</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => handleInputChange('frequency', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    validationErrors.frequency ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Select frequency</option>
                  {FREQUENCY_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {validationErrors.frequency && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.frequency}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescribed By</label>
                <input
                  type="text"
                  value={formData.prescribedBy}
                  onChange={(e) => handleInputChange('prescribedBy', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Doctor's name (optional)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={2}
                placeholder="e.g., Take with food, avoid alcohol (optional)"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPRN"
                  checked={formData.isPRN}
                  onChange={(e) => handleInputChange('isPRN', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isPRN" className="text-sm text-gray-700">
                  As needed (PRN) medication
                </label>
              </div>

              {!formData.isPRN && (
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id="hasReminders"
                      checked={formData.hasReminders}
                      onChange={(e) => handleInputChange('hasReminders', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <label htmlFor="hasReminders" className="text-sm text-gray-700 font-medium flex items-center space-x-1">
                        <span>✅ Create medication reminders</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Schedules will be set up automatically when you save this medication
                      </p>
                    </div>
                  </div>

                  {formData.hasReminders && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-medium text-blue-900">Reminder Times (Optional)</h5>
                        <span className="text-xs text-blue-700">Default times will be used if none selected</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {REMINDER_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => handleAddReminderTime(preset.value)}
                            disabled={formData.reminderTimes.includes(preset.value)}
                            className={`p-2 text-sm rounded-md border transition-colors ${
                              formData.reminderTimes.includes(preset.value)
                                ? 'bg-primary-100 border-primary-300 text-primary-700 cursor-not-allowed'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {formData.reminderTimes.length > 0 && (
                        <div>
                          <p className="text-xs text-blue-800 mb-2">Selected reminder times:</p>
                          <div className="flex flex-wrap gap-2">
                            {formData.reminderTimes.map((time) => {
                              const [hours, minutes] = time.split(':');
                              const hour = parseInt(hours);
                              const ampm = hour >= 12 ? 'PM' : 'AM';
                              const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                              const displayTime = `${displayHour}:${minutes} ${ampm}`;
                              
                              return (
                                <span
                                  key={time}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-800"
                                >
                                  {displayTime}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveReminderTime(time)}
                                    className="ml-1 text-primary-600 hover:text-primary-800"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                disabled={isSubmitting || !formData.name || !formData.dosage || !formData.frequency}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingMedicationId ? 'Update' : 'Add'} Medication</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Medications List with Enhanced Status */}
      {medicationsWithStatus.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Active Medications</h4>
          <div className="space-y-3">
            {medicationsWithStatus.map((medication) => (
              <div
                key={medication.id}
                className={`bg-white rounded-lg border p-4 max-w-full ${
                  medication.scheduleStatus === 'unscheduled'
                    ? 'border-orange-200 bg-orange-50'
                    : medication.scheduleStatus === 'paused'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
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
                      <div className="flex items-center space-x-2 mb-1 flex-wrap">
                        <h5 className="font-medium text-gray-900">{medication.name}</h5>
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
                        <div className="flex items-center space-x-4 text-sm mb-2">
                          <span className="flex items-center space-x-1 text-blue-600">
                            <Clock className="w-3 h-3" />
                            <span>Next: {formatTime(new Date(medication.nextDose.scheduledDateTime))}</span>
                          </span>
                          <span className="text-gray-500">
                            {getTimeUntil(new Date(medication.nextDose.scheduledDateTime))}
                          </span>
                        </div>
                      )}

                      {medication.scheduleStatus === 'unscheduled' && (
                        <div className="flex items-center space-x-1 text-sm text-orange-600 mb-2">
                          <Info className="w-3 h-3" />
                          <span>No reminders set - medication won't appear in daily schedule</span>
                        </div>
                      )}

                      {medication.scheduleStatus === 'paused' && (
                        <div className="flex items-center space-x-1 text-sm text-yellow-600 mb-2">
                          <BellOff className="w-3 h-3" />
                          <span>Reminders paused</span>
                        </div>
                      )}

                      {medication.instructions && (
                        <p className="text-sm text-gray-500 mt-1">{medication.instructions}</p>
                      )}
                      
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

                      {/* Today's Doses Summary */}
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
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {(() => {
                      const canEdit = hasPermission('canEdit');
                      
                      if (!canEdit) {
                        return (
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Lock className="w-3 h-3" />
                            <span>View only</span>
                          </div>
                        );
                      }
                      
                      return (
                        <>
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

                          {medication.scheduleStatus === 'unscheduled' && (
                            <button
                              onClick={() => handleCreateSchedule(medication)}
                              disabled={creatingSchedule === medication.id}
                              className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                              title="Create medication schedule"
                            >
                              {creatingSchedule === medication.id ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              <span className="hidden sm:inline">Schedule</span>
                              <span className="sm:hidden">+</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleEdit(medication)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Edit medication"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(medication.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete medication"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
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