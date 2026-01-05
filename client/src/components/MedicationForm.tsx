import React, { useState, useEffect } from 'react';
import {
  Save,
  X,
  Plus,
  Info
} from 'lucide-react';
import { NewMedication, Medication } from '@shared/types';
import { DrugConcept } from '@/lib/drugApi';
import MedicationSearch from './MedicationSearch';

export interface MedicationFormData {
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  prescribedBy: string;
  isPRN: boolean;
  hasReminders: boolean;
  reminderTimes: string[];
}

export const initialFormData: MedicationFormData = {
  name: '',
  dosage: '',
  frequency: '',
  instructions: '',
  prescribedBy: '',
  isPRN: false,
  hasReminders: false,
  reminderTimes: [],
};

interface MedicationFormProps {
  patientId: string;
  initialData?: Medication; // For editing
  existingMedications: Medication[]; // For duplicate check
  onSubmit: (data: NewMedication) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

// Simplified frequency options
const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'Weekly',
  'Monthly',
  'As needed'
];

// Time of day options for daily frequency
const TIME_OF_DAY_OPTIONS = [
  { value: '08:00', label: 'Morning (8 AM)', bucket: 'morning' },
  { value: '12:00', label: 'Lunch (12 PM)', bucket: 'noon' },
  { value: '18:00', label: 'Evening (6 PM)', bucket: 'evening' },
  { value: '22:00', label: 'Bedtime (10 PM)', bucket: 'bedtime' }
];

// Simple reminder time presets
const REMINDER_PRESETS = [
  { value: '08:00', label: 'Morning (8 AM)' },
  { value: '12:00', label: 'Noon (12 PM)' },
  { value: '18:00', label: 'Evening (6 PM)' },
  { value: '22:00', label: 'Bedtime (10 PM)' }
];

// Frequency normalization function - maps display values to API values
export const normalizeFrequency = (displayFrequency: string): string => {
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
    return normalized;
  }
  
  return 'daily';
};

export default function MedicationForm({
  patientId,
  initialData,
  existingMedications,
  onSubmit,
  onCancel,
  isSubmitting
}: MedicationFormProps) {
  const [formData, setFormData] = useState<MedicationFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Track preferred time of day for daily meds
  const [preferredTimeOfDay, setPreferredTimeOfDay] = useState<string>('08:00');

  // Initialize form data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        dosage: initialData.dosage,
        frequency: initialData.frequency,
        instructions: initialData.instructions || '',
        prescribedBy: initialData.prescribedBy || '',
        isPRN: initialData.isPRN || false,
        hasReminders: initialData.hasReminders || false,
        reminderTimes: initialData.reminderTimes || [],
      });
      
      // If daily frequency and has reminder times, set preferred time
      if (normalizeFrequency(initialData.frequency) === 'daily' && initialData.reminderTimes && initialData.reminderTimes.length > 0) {
        setPreferredTimeOfDay(initialData.reminderTimes[0]);
      }
    }
  }, [initialData]);

  const handleDrugSelect = async (drug: DrugConcept) => {
    setValidationErrors({});
    setDuplicateWarning(null);
    
    const existingMed = existingMedications.find(med =>
      med.name.toLowerCase() === drug.name.toLowerCase()
    );
    
    if (existingMed && (!initialData || existingMed.id !== initialData.id)) {
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
    const dosagePattern = /^(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)\s*(mg|mcg|g|ml|tablet|tablets|capsule|capsules|unit|units|iu|drop|drops|spray|sprays|patch|patches|puff|puffs)$/i;
    return dosagePattern.test(dosage.trim());
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
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
    
    if (formData.isPRN && formData.hasReminders && formData.reminderTimes.length > 0) {
      errors.reminderTimes = 'PRN (as needed) medications cannot have scheduled reminder times';
    }
    
    const existingMed = existingMedications.find(med =>
      med.name.toLowerCase() === formData.name.trim().toLowerCase() &&
      med.isActive &&
      (!initialData || med.id !== initialData.id)
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

    const normalizedFrequency = normalizeFrequency(formData.frequency);
    
    // For daily medications, if no specific reminder times are set, use the preferred time of day
    let finalReminderTimes = formData.reminderTimes;
    if (normalizedFrequency === 'daily' && (!finalReminderTimes || finalReminderTimes.length === 0)) {
      finalReminderTimes = [preferredTimeOfDay];
    }
    
    const medicationData: NewMedication = {
      patientId,
      name: formData.name.trim(),
      dosage: formData.dosage.trim(),
      frequency: normalizedFrequency,
      instructions: formData.instructions?.trim() || undefined,
      prescribedBy: formData.prescribedBy?.trim() || undefined,
      prescribedDate: new Date(),
      isActive: true,
      isPRN: formData.isPRN,
      hasReminders: formData.hasReminders || normalizedFrequency === 'daily', // Auto-enable reminders for daily if not explicitly set
      reminderTimes: finalReminderTimes.length > 0 ? finalReminderTimes : undefined,
    };

    await onSubmit(medicationData);
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

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-medium text-gray-900">
          {initialData ? 'Edit Medication' : 'Add New Medication'}
        </h4>
        <button
          onClick={onCancel}
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

          {normalizeFrequency(formData.frequency) === 'daily' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time *</label>
              <select
                value={preferredTimeOfDay}
                onChange={(e) => setPreferredTimeOfDay(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {TIME_OF_DAY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">When do you take this dose?</p>
            </div>
          )}

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
            onClick={onCancel}
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
                <span>{initialData ? 'Update' : 'Add'} Medication</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

