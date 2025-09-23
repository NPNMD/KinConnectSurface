import React, { useState } from 'react';
import { Plus, Edit, Trash2, Pill, Save, X, CheckCircle, Bell } from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { DrugConcept } from '@/lib/drugApi';
import MedicationSearch from './MedicationSearch';

interface MedicationManagerProps {
  patientId: string;
  medications: Medication[];
  onAddMedication: (medication: NewMedication) => Promise<void>;
  onUpdateMedication: (id: string, medication: Partial<Medication>) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
  isLoading?: boolean;
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

  const handleDrugSelect = async (drug: DrugConcept) => {
    console.log('🔍 Selected drug:', drug);
    
    // Clear previous validation errors
    setValidationErrors({});
    setDuplicateWarning(null);
    
    // Check for duplicate medications
    const existingMed = medications.find(med =>
      med.name.toLowerCase() === drug.name.toLowerCase()
    );
    
    if (existingMed && !editingMedicationId) {
      setDuplicateWarning(`This medication (${drug.name}) is already in the patient's medication list.`);
    }
    
    // Extract dosage from drug name
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
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Required field validation
    if (!formData.name.trim()) errors.name = 'Medication name is required';
    if (!formData.dosage.trim()) errors.dosage = 'Dosage is required';
    if (!formData.frequency.trim()) errors.frequency = 'Frequency is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 MedicationManager: Form submitted');

    // Validate form before submission
    if (!validateForm()) {
      console.log('❌ MedicationManager: Form validation failed');
      return;
    }

    setIsSubmitting(true);

    try {
      const medicationData: NewMedication = {
        patientId,
        name: formData.name.trim(),
        dosage: formData.dosage.trim(),
        frequency: formData.frequency,
        instructions: formData.instructions?.trim() || undefined,
        prescribedBy: formData.prescribedBy?.trim() || undefined,
        prescribedDate: new Date(),
        isActive: true,
        isPRN: formData.isPRN,
        hasReminders: formData.hasReminders,
        reminderTimes: formData.reminderTimes.length > 0 ? formData.reminderTimes : undefined,
      };

      console.log('🔍 MedicationManager: Prepared medication data:', medicationData);

      if (editingMedicationId) {
        console.log('🔍 MedicationManager: Updating medication:', editingMedicationId);
        await onUpdateMedication(editingMedicationId, medicationData);
        setEditingMedicationId(null);
      } else {
        console.log('🔍 MedicationManager: Adding new medication');
        await onAddMedication(medicationData);
        setIsAddingMedication(false);
      }

      console.log('✅ MedicationManager: Medication saved successfully');
      handleCancel(); // Reset form and clear state
    } catch (error) {
      console.error('❌ MedicationManager: Error saving medication:', error);
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

  const handleToggleReminder = async (medication: Medication) => {
    try {
      const newReminderState = !medication.hasReminders;
      const reminderTimes = newReminderState ? ['08:00'] : []; // Default to morning
      
      await onUpdateMedication(medication.id, {
        hasReminders: newReminderState,
        reminderTimes: reminderTimes
      });

      if (newReminderState) {
        alert(`Reminders enabled for ${medication.name} at 8:00 AM. You can edit times when editing the medication.`);
      } else {
        alert(`Reminders disabled for ${medication.name}`);
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
      alert('Failed to update reminder settings. Please try again.');
    }
  };

  const activeMedications = medications.filter(med => med.isActive);
  const inactiveMedications = medications.filter(med => !med.isActive);

  return (
    <div className="space-y-6">
      {/* Simplified Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
        {!isAddingMedication && (
          <button
            onClick={() => {
              console.log('🔍 MedicationManager: Add Medication button clicked');
              setIsAddingMedication(true);
            }}
            className="btn-primary flex items-center space-x-2"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
        )}
      </div>

      {/* Simplified Add/Edit Form */}
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
            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-start space-x-2">
                <div className="text-sm text-yellow-800">{duplicateWarning}</div>
              </div>
            )}

            {/* Medication Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Medication</label>
              <MedicationSearch
                onSelect={handleDrugSelect}
                placeholder="Search for medication by name..."
                className="w-full"
              />
            </div>

            {/* Essential Fields Only */}
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

            {/* Simplified Reminder Settings */}
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
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hasReminders"
                      checked={formData.hasReminders}
                      onChange={(e) => handleInputChange('hasReminders', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="hasReminders" className="text-sm text-gray-700 font-medium">
                      Enable medication reminders
                    </label>
                  </div>

                  {formData.hasReminders && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h5 className="text-sm font-medium text-blue-900 mb-3">Reminder Times</h5>
                      
                      {/* Simple Time Preset Buttons */}
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

                      {/* Selected Times Display */}
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

      {/* Simplified Active Medications List */}
      {activeMedications.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Active Medications</h4>
          <div className="space-y-3">
            {activeMedications.map((medication) => (
              <div
                key={medication.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <Pill className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900">{medication.name}</h5>
                        {medication.isPRN && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            As needed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {medication.dosage} • {medication.frequency}
                      </p>
                      {medication.instructions && (
                        <p className="text-sm text-gray-500 mt-1">{medication.instructions}</p>
                      )}
                      {medication.prescribedBy && (
                        <p className="text-xs text-gray-500 mt-1">
                          Prescribed by: {medication.prescribedBy}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleReminder(medication)}
                      className={`p-2 transition-colors ${
                        medication.hasReminders
                          ? 'text-primary-600 bg-primary-50'
                          : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                      }`}
                      title={medication.hasReminders ? 'Reminders enabled' : 'Enable reminders'}
                    >
                      <Bell className="w-4 h-4" />
                    </button>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeMedications.length === 0 && !isAddingMedication && (
        <div className="text-center py-8">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No medications added</h4>
          <p className="text-gray-500 mb-4">Add medications to track prescriptions and dosages.</p>
          <button
            onClick={() => setIsAddingMedication(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Medication</span>
          </button>
        </div>
      )}

      {/* Simplified Inactive Medications */}
      {inactiveMedications.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Past Medications</h4>
          <div className="space-y-3">
            {inactiveMedications.map((medication) => (
              <div
                key={medication.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-75"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <Pill className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-700">{medication.name}</h5>
                    <p className="text-sm text-gray-500 mt-1">
                      {medication.dosage} • {medication.frequency}
                    </p>
                    {medication.prescribedBy && (
                      <p className="text-xs text-gray-400 mt-1">
                        Prescribed by: {medication.prescribedBy}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}