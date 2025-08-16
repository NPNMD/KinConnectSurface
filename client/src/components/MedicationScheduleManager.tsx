import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Save, 
  X, 
  AlertTriangle,
  CheckCircle,
  Info,
  Bell
} from 'lucide-react';
import type { 
  Medication, 
  MedicationSchedule, 
  NewMedicationSchedule,
  MedicationCalendarEvent 
} from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';

interface MedicationScheduleManagerProps {
  medication: Medication;
  onScheduleChange?: () => void;
}

interface ScheduleFormData {
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
  times: string[];
  daysOfWeek: number[];
  dayOfMonth: number;
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  dosageAmount: string;
  instructions: string;
  generateCalendarEvents: boolean;
  reminderMinutesBefore: number[];
}

const initialFormData: ScheduleFormData = {
  frequency: 'daily',
  times: ['08:00'],
  daysOfWeek: [],
  dayOfMonth: 1,
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  isIndefinite: true,
  dosageAmount: '',
  instructions: '',
  generateCalendarEvents: true,
  reminderMinutesBefore: [15, 5]
};

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice Daily' },
  { value: 'three_times_daily', label: 'Three Times Daily' },
  { value: 'four_times_daily', label: 'Four Times Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'as_needed', label: 'As Needed (PRN)' }
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' }
];

export default function MedicationScheduleManager({ 
  medication, 
  onScheduleChange 
}: MedicationScheduleManagerProps) {
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [recentEvents, setRecentEvents] = useState<MedicationCalendarEvent[]>([]);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load schedules and recent events
  useEffect(() => {
    loadSchedules();
    loadRecentEvents();
  }, [medication.id]);

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      const result = await medicationCalendarApi.getMedicationSchedulesByMedicationId(medication.id);
      
      if (result.success && result.data) {
        setSchedules(result.data);
      } else {
        console.error('Failed to load schedules:', result.error);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // Last 7 days
      
      const result = await medicationCalendarApi.getMedicationCalendarEvents({
        medicationId: medication.id,
        startDate,
        endDate
      });
      
      if (result.success && result.data) {
        setRecentEvents(result.data);
      }
    } catch (error) {
      console.error('Error loading recent events:', error);
    }
  };

  const handleInputChange = (field: keyof ScheduleFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Auto-generate times based on frequency
    if (field === 'frequency') {
      const defaultTimes = medicationCalendarApi.generateDefaultTimes(value);
      setFormData(prev => ({
        ...prev,
        times: defaultTimes
      }));
    }
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    setFormData(prev => ({
      ...prev,
      times: newTimes
    }));
  };

  const addTime = () => {
    setFormData(prev => ({
      ...prev,
      times: [...prev.times, '08:00']
    }));
  };

  const removeTime = (index: number) => {
    if (formData.times.length > 1) {
      const newTimes = formData.times.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        times: newTimes
      }));
    }
  };

  const handleDayOfWeekToggle = (day: number) => {
    const newDays = formData.daysOfWeek.includes(day)
      ? formData.daysOfWeek.filter(d => d !== day)
      : [...formData.daysOfWeek, day].sort();
    
    setFormData(prev => ({
      ...prev,
      daysOfWeek: newDays
    }));
  };

  const handleReminderToggle = (minutes: number) => {
    const newReminders = formData.reminderMinutesBefore.includes(minutes)
      ? formData.reminderMinutesBefore.filter(r => r !== minutes)
      : [...formData.reminderMinutesBefore, minutes].sort((a, b) => b - a);
    
    setFormData(prev => ({
      ...prev,
      reminderMinutesBefore: newReminders
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.dosageAmount.trim()) {
      errors.dosageAmount = 'Dosage amount is required';
    }

    if (formData.times.length === 0) {
      errors.times = 'At least one time is required';
    }

    if (formData.frequency === 'weekly' && formData.daysOfWeek.length === 0) {
      errors.daysOfWeek = 'Select at least one day of the week';
    }

    if (!formData.isIndefinite && !formData.endDate) {
      errors.endDate = 'End date is required when not indefinite';
    }

    if (!formData.isIndefinite && formData.endDate && formData.startDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end <= start) {
        errors.endDate = 'End date must be after start date';
      }
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
      const scheduleData: NewMedicationSchedule = {
        medicationId: medication.id,
        patientId: medication.patientId,
        frequency: formData.frequency,
        times: formData.times,
        daysOfWeek: formData.frequency === 'weekly' ? formData.daysOfWeek : undefined,
        dayOfMonth: formData.frequency === 'monthly' ? formData.dayOfMonth : undefined,
        startDate: new Date(formData.startDate),
        endDate: formData.isIndefinite ? undefined : new Date(formData.endDate),
        isIndefinite: formData.isIndefinite,
        dosageAmount: formData.dosageAmount.trim(),
        instructions: formData.instructions.trim() || undefined,
        generateCalendarEvents: formData.generateCalendarEvents,
        reminderMinutesBefore: formData.reminderMinutesBefore,
        isActive: true
      };

      let result;
      if (editingScheduleId) {
        result = await medicationCalendarApi.updateMedicationSchedule(editingScheduleId, scheduleData);
      } else {
        result = await medicationCalendarApi.createMedicationSchedule(scheduleData);
      }

      if (result.success) {
        await loadSchedules();
        await loadRecentEvents();
        handleCancel();
        onScheduleChange?.();
      } else {
        console.error('Failed to save schedule:', result.error);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (schedule: MedicationSchedule) => {
    setFormData({
      frequency: schedule.frequency,
      times: schedule.times,
      daysOfWeek: schedule.daysOfWeek || [],
      dayOfMonth: schedule.dayOfMonth || 1,
      startDate: new Date(schedule.startDate).toISOString().split('T')[0],
      endDate: schedule.endDate ? new Date(schedule.endDate).toISOString().split('T')[0] : '',
      isIndefinite: schedule.isIndefinite,
      dosageAmount: schedule.dosageAmount,
      instructions: schedule.instructions || '',
      generateCalendarEvents: schedule.generateCalendarEvents,
      reminderMinutesBefore: schedule.reminderMinutesBefore
    });
    setEditingScheduleId(schedule.id);
    setIsAddingSchedule(true);
  };

  const handleCancel = () => {
    setIsAddingSchedule(false);
    setEditingScheduleId(null);
    setFormData(initialFormData);
    setValidationErrors({});
  };

  const handlePauseResume = async (schedule: MedicationSchedule) => {
    try {
      let result;
      if (schedule.isPaused) {
        result = await medicationCalendarApi.resumeMedicationSchedule(schedule.id);
      } else {
        result = await medicationCalendarApi.pauseMedicationSchedule(schedule.id);
      }

      if (result.success) {
        await loadSchedules();
        onScheduleChange?.();
      }
    } catch (error) {
      console.error('Error pausing/resuming schedule:', error);
    }
  };

  const formatFrequency = (frequency: string): string => {
    const option = FREQUENCY_OPTIONS.find(opt => opt.value === frequency);
    return option?.label || frequency;
  };

  const formatTimes = (times: string[]): string => {
    return times.map(time => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    }).join(', ');
  };

  const getAdherenceColor = (events: MedicationCalendarEvent[]): string => {
    if (events.length === 0) return 'text-gray-500';
    
    const takenCount = events.filter(e => e.status === 'taken').length;
    const adherenceRate = (takenCount / events.length) * 100;
    
    if (adherenceRate >= 90) return 'text-green-600';
    if (adherenceRate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading schedules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            <span>Medication Schedule</span>
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Set up automatic reminders and calendar events for {medication.name}
          </p>
        </div>
        {!isAddingSchedule && (
          <button
            onClick={() => setIsAddingSchedule(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Schedule</span>
          </button>
        )}
      </div>

      {/* Add/Edit Schedule Form */}
      {isAddingSchedule && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-md font-medium text-gray-900">
              {editingScheduleId ? 'Edit Schedule' : 'Add New Schedule'}
            </h5>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Frequency *</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => handleInputChange('frequency', e.target.value)}
                  className="input"
                  required
                >
                  {FREQUENCY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Dosage Amount *</label>
                <input
                  type="text"
                  value={formData.dosageAmount}
                  onChange={(e) => handleInputChange('dosageAmount', e.target.value)}
                  className={`input ${validationErrors.dosageAmount ? 'border-red-300' : ''}`}
                  placeholder="e.g., 1 tablet, 5ml"
                  required
                />
                {validationErrors.dosageAmount && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.dosageAmount}</p>
                )}
              </div>
            </div>

            {/* Times */}
            <div>
              <label className="label">Times *</label>
              <div className="space-y-2">
                {formData.times.map((time, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      className="input flex-1"
                      required
                    />
                    {formData.times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTime(index)}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTime}
                  className="btn-secondary text-sm"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Time
                </button>
              </div>
              {validationErrors.times && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.times}</p>
              )}
            </div>

            {/* Days of Week (for weekly frequency) */}
            {formData.frequency === 'weekly' && (
              <div>
                <label className="label">Days of Week *</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleDayOfWeekToggle(day.value)}
                      className={`px-3 py-1 text-sm rounded-md border ${
                        formData.daysOfWeek.includes(day.value)
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {day.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
                {validationErrors.daysOfWeek && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.daysOfWeek}</p>
                )}
              </div>
            )}

            {/* Day of Month (for monthly frequency) */}
            {formData.frequency === 'monthly' && (
              <div>
                <label className="label">Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => handleInputChange('dayOfMonth', parseInt(e.target.value))}
                  className="input"
                />
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`input ${validationErrors.endDate ? 'border-red-300' : ''}`}
                  disabled={formData.isIndefinite}
                />
                {validationErrors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isIndefinite"
                checked={formData.isIndefinite}
                onChange={(e) => handleInputChange('isIndefinite', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isIndefinite" className="text-sm text-gray-700">
                Continue indefinitely (no end date)
              </label>
            </div>

            {/* Instructions */}
            <div>
              <label className="label">Special Instructions</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                className="input"
                rows={2}
                placeholder="e.g., Take with food, avoid alcohol"
              />
            </div>

            {/* Calendar Integration */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generateCalendarEvents"
                checked={formData.generateCalendarEvents}
                onChange={(e) => handleInputChange('generateCalendarEvents', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="generateCalendarEvents" className="text-sm text-gray-700">
                Create calendar events and reminders
              </label>
            </div>

            {/* Reminders */}
            {formData.generateCalendarEvents && (
              <div>
                <label className="label">Reminder Times</label>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map(reminder => (
                    <button
                      key={reminder.value}
                      type="button"
                      onClick={() => handleReminderToggle(reminder.value)}
                      className={`px-3 py-1 text-sm rounded-md border ${
                        formData.reminderMinutesBefore.includes(reminder.value)
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {reminder.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center space-x-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingScheduleId ? 'Update' : 'Create'} Schedule</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Schedules */}
      {schedules.length > 0 && (
        <div>
          <h5 className="text-md font-medium text-gray-900 mb-3">Active Schedules</h5>
          <div className="space-y-3">
            {schedules.map((schedule) => {
              const scheduleEvents = recentEvents.filter(e => e.medicationScheduleId === schedule.id);
              
              return (
                <div
                  key={schedule.id}
                  className={`bg-white border rounded-lg p-4 ${
                    schedule.isPaused ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h6 className="font-medium text-gray-900">
                          {formatFrequency(schedule.frequency)} - {schedule.dosageAmount}
                        </h6>
                        {schedule.isPaused && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Paused
                          </span>
                        )}
                        {schedule.generateCalendarEvents && (
                          <div title="Calendar reminders enabled">
                            <Bell className="w-4 h-4 text-primary-600" />
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimes(schedule.times)}</span>
                          </span>
                          {schedule.frequency === 'weekly' && schedule.daysOfWeek && (
                            <span>
                              Days: {schedule.daysOfWeek.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label.slice(0, 3)).join(', ')}
                            </span>
                          )}
                        </div>
                        
                        <div>
                          Started: {new Date(schedule.startDate).toLocaleDateString()}
                          {!schedule.isIndefinite && schedule.endDate && (
                            <span> • Ends: {new Date(schedule.endDate).toLocaleDateString()}</span>
                          )}
                        </div>
                        
                        {schedule.instructions && (
                          <div className="text-gray-500">
                            Instructions: {schedule.instructions}
                          </div>
                        )}
                        
                        {scheduleEvents.length > 0 && (
                          <div className={`flex items-center space-x-1 ${getAdherenceColor(scheduleEvents)}`}>
                            <CheckCircle className="w-3 h-3" />
                            <span>
                              {scheduleEvents.filter(e => e.status === 'taken').length} of {scheduleEvents.length} doses taken (last 7 days)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePauseResume(schedule)}
                        className={`p-2 rounded-md ${
                          schedule.isPaused 
                            ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                            : 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
                        }`}
                        title={schedule.isPaused ? 'Resume schedule' : 'Pause schedule'}
                      >
                        {schedule.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                        title="Edit schedule"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {schedules.length === 0 && !isAddingSchedule && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h5 className="text-lg font-medium text-gray-900 mb-2">No schedules set up</h5>
          <p className="text-gray-500 mb-4">
            Create a medication schedule to get automatic reminders and calendar events.
          </p>
          <button
            onClick={() => setIsAddingSchedule(true)}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Schedule</span>
          </button>
        </div>
      )}
    </div>
  );
}