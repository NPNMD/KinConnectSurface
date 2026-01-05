import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Pill, Save, X, AlertTriangle, CheckCircle, Info, Clock, Bell } from 'lucide-react';
import { Medication, NewMedication, MedicationReminder, NewMedicationReminder } from '@shared/types';
import { DrugConcept, drugApiService } from '@/lib/drugApi';
import { apiClient } from '@/lib/api';
import MedicationSearch from './MedicationSearch';

interface MedicationManagerProps {
  patientId: string;
  medications: Medication[];
  onAddMedication: (medication: NewMedication) => Promise<Medication | void>;
  onUpdateMedication: (id: string, medication: Partial<Medication>) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
  isLoading?: boolean;
}

interface MedicationFormData {
  name: string;
  genericName: string;
  brandName: string;
  rxcui: string;
  dosage: string;
  strength: string;
  dosageForm: string;
  frequency: string;
  route: string;
  instructions: string;
  prescribedBy: string;
  prescribedDate: string;
  startDate: string;
  endDate: string;
  isPRN: boolean;
  maxDailyDose: string;
  notes: string;
  pharmacy: string;
  prescriptionNumber: string;
  refillsRemaining: number;
}

const initialFormData: MedicationFormData = {
  name: '',
  genericName: '',
  brandName: '',
  rxcui: '',
  dosage: '',
  strength: '',
  dosageForm: '',
  frequency: '',
  route: 'oral',
  instructions: '',
  prescribedBy: '',
  prescribedDate: new Date().toISOString().split('T')[0],
  startDate: '',
  endDate: '',
  isPRN: false,
  maxDailyDose: '',
  notes: '',
  pharmacy: '',
  prescriptionNumber: '',
  refillsRemaining: 0,
};

// Common dosage forms for validation
const COMMON_DOSAGE_FORMS = [
  'tablet', 'capsule', 'liquid', 'syrup', 'suspension', 'injection', 'cream', 'ointment',
  'gel', 'patch', 'inhaler', 'drops', 'spray', 'powder', 'suppository', 'lozenge'
];

// Weekdays for reminders
const WEEKDAYS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' }
] as const;

type DayOfWeek = typeof WEEKDAYS[number]['value'];

interface ReminderFormData {
  id?: string;
  time: string;
  days: DayOfWeek[];
}

// Common routes for validation
const MEDICATION_ROUTES = [
  { value: 'oral', label: 'Oral (by mouth)' },
  { value: 'topical', label: 'Topical (on skin)' },
  { value: 'injection', label: 'Injection' },
  { value: 'inhalation', label: 'Inhalation' },
  { value: 'nasal', label: 'Nasal' },
  { value: 'rectal', label: 'Rectal' },
  { value: 'sublingual', label: 'Sublingual (under tongue)' },
  { value: 'transdermal', label: 'Transdermal (patch)' },
  { value: 'ophthalmic', label: 'Eye drops' },
  { value: 'otic', label: 'Ear drops' }
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
  const [drugInteractions, setDrugInteractions] = useState<any[]>([]);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [relatedDrugs, setRelatedDrugs] = useState<DrugConcept[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  
  // Reminder state
  const [reminders, setReminders] = useState<ReminderFormData[]>([]);
  const [initialReminders, setInitialReminders] = useState<MedicationReminder[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);

  const addReminder = () => {
    setReminders(prev => [...prev, { time: '08:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }]);
  };

  const removeReminder = (index: number) => {
    setReminders(prev => prev.filter((_, i) => i !== index));
  };

  const updateReminder = (index: number, field: keyof ReminderFormData, value: any) => {
    setReminders(prev => prev.map((reminder, i) => {
      if (i === index) {
        return { ...reminder, [field]: value };
      }
      return reminder;
    }));
  };

  const toggleDay = (reminderIndex: number, day: DayOfWeek) => {
    setReminders(prev => prev.map((reminder, i) => {
      if (i === reminderIndex) {
        const days = reminder.days.includes(day)
          ? reminder.days.filter(d => d !== day)
          : [...reminder.days, day];
        return { ...reminder, days };
      }
      return reminder;
    }));
  };

  const handleDrugSelect = async (drug: DrugConcept) => {
    console.log('🔍 Selected drug:', drug);
    
    // Clear previous validation errors
    setValidationErrors({});
    setDuplicateWarning(null);
    
    // Check for duplicate medications
    const existingMed = medications.find(med =>
      med.rxcui === drug.rxcui ||
      med.name.toLowerCase() === drug.name.toLowerCase()
    );
    
    if (existingMed && !editingMedicationId) {
      setDuplicateWarning(`This medication (${drug.name}) is already in the patient's medication list.`);
    }
    
    // Extract dosage information from drug name
    const dosageMatch = drug.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
    const strengthInfo = dosageMatch ? `${dosageMatch[1]} ${dosageMatch[2].toLowerCase()}` : '';
    
    // Determine dosage form from drug name
    let dosageForm = '';
    const formMatches = drug.name.toLowerCase();
    if (formMatches.includes('tablet')) dosageForm = 'tablet';
    else if (formMatches.includes('capsule')) dosageForm = 'capsule';
    else if (formMatches.includes('liquid') || formMatches.includes('solution')) dosageForm = 'liquid';
    else if (formMatches.includes('cream')) dosageForm = 'cream';
    else if (formMatches.includes('injection')) dosageForm = 'injection';
    
    setFormData(prev => ({
      ...prev,
      name: drug.name,
      rxcui: drug.rxcui,
      strength: strengthInfo || prev.strength,
      dosageForm: dosageForm || prev.dosageForm,
      // Try to extract generic/brand info from the drug name and type
      genericName: drug.tty === 'SCD' ? drug.name : prev.genericName,
      brandName: drug.tty === 'SBD' ? drug.name : prev.brandName,
    }));
    
    // Get related drugs and check interactions
    if (drug.rxcui) {
      try {
        const [related, interactions] = await Promise.all([
          drugApiService.getRelatedDrugs(drug.rxcui),
          checkDrugInteractions(drug.rxcui)
        ]);
        
        setRelatedDrugs(related);
      } catch (error) {
        console.error('Error fetching drug details:', error);
      }
    }
  };
  
  const checkDrugInteractions = async (rxcui: string) => {
    if (!rxcui || medications.length === 0) return;
    
    setIsCheckingInteractions(true);
    try {
      const interactions = await drugApiService.getDrugInteractions(rxcui);
      setDrugInteractions(interactions);
    } catch (error) {
      console.error('Error checking drug interactions:', error);
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  const handleInputChange = (field: keyof MedicationFormData, value: string | boolean | number) => {
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
    
    // Validate specific fields on change
    validateField(field, value);
  };
  
  const validateField = (field: keyof MedicationFormData, value: string | boolean | number) => {
    const errors: Record<string, string> = {};
    
    switch (field) {
      case 'dosage':
        if (typeof value === 'string' && value.trim()) {
          // Basic dosage format validation
          const dosagePattern = /^(\d+(?:\.\d+)?)\s*(tablet|capsule|ml|mg|g|tsp|tbsp|drop|spray|puff|unit)s?\s*(once|twice|three times|four times|every \d+ hours?|as needed)?/i;
          if (!dosagePattern.test(value.trim())) {
            errors.dosage = 'Please enter a valid dosage (e.g., "1 tablet", "5 ml", "2 capsules")';
          }
        }
        break;
        
      case 'strength':
        if (typeof value === 'string' && value.trim()) {
          const strengthPattern = /^\d+(?:\.\d+)?\s*(mg|mcg|g|ml|units?|iu)$/i;
          if (!strengthPattern.test(value.trim())) {
            errors.strength = 'Please enter a valid strength (e.g., "10mg", "500mg", "5ml")';
          }
        }
        break;
        
      case 'frequency':
        if (typeof value === 'string' && value === 'As needed' && !formData.isPRN) {
          setFormData(prev => ({ ...prev, isPRN: true }));
        }
        break;
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(prev => ({ ...prev, ...errors }));
    }
  };
  
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Required field validation
    if (!formData.name.trim()) errors.name = 'Medication name is required';
    if (!formData.dosage.trim()) errors.dosage = 'Dosage is required';
    if (!formData.frequency.trim()) errors.frequency = 'Frequency is required';
    if (!formData.instructions.trim()) errors.instructions = 'Instructions are required';
    if (!formData.prescribedBy.trim()) errors.prescribedBy = 'Prescribing doctor is required';
    if (!formData.prescribedDate) errors.prescribedDate = 'Prescribed date is required';
    
    // Dosage form validation
    if (formData.dosageForm && !COMMON_DOSAGE_FORMS.includes(formData.dosageForm.toLowerCase())) {
      errors.dosageForm = 'Please select a valid dosage form';
    }
    
    // Date validation
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) {
        errors.endDate = 'End date must be after start date';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 MedicationManager: Form submitted');
    console.log('🔍 MedicationManager: Patient ID:', patientId);
    console.log('🔍 MedicationManager: Form data:', formData);
    
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
        genericName: formData.genericName?.trim() || undefined,
        brandName: formData.brandName?.trim() || undefined,
        rxcui: formData.rxcui || undefined,
        dosage: formData.dosage.trim(),
        strength: formData.strength?.trim() || undefined,
        dosageForm: formData.dosageForm?.trim() || undefined,
        frequency: formData.frequency,
        route: formData.route || undefined,
        instructions: formData.instructions.trim(),
        prescribedBy: formData.prescribedBy.trim(),
        prescribedDate: new Date(formData.prescribedDate),
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        isActive: true,
        isPRN: formData.isPRN,
        maxDailyDose: formData.maxDailyDose?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        pharmacy: formData.pharmacy?.trim() || undefined,
        prescriptionNumber: formData.prescriptionNumber?.trim() || undefined,
        refillsRemaining: formData.refillsRemaining || undefined,
      };

      console.log('🔍 MedicationManager: Prepared medication data:', medicationData);

      let savedMedicationId: string | undefined;

      if (editingMedicationId) {
        console.log('🔍 MedicationManager: Updating medication:', editingMedicationId);
        await onUpdateMedication(editingMedicationId, medicationData);
        savedMedicationId = editingMedicationId;
      } else {
        console.log('🔍 MedicationManager: Adding new medication');
        const newMedication = await onAddMedication(medicationData);
        if (newMedication) {
            savedMedicationId = newMedication.id;
        }
        setIsAddingMedication(false);
      }

      // Save Reminders
      if (savedMedicationId) {
        // 1. Delete removed reminders
        const currentReminderIds = reminders.map(r => r.id).filter(Boolean);
        const remindersToDelete = initialReminders.filter(r => !currentReminderIds.includes(r.id));
        
        await Promise.all(remindersToDelete.map(r => 
          apiClient.delete(`/api/medications/reminders/${r.id}`)
        ));

        // 2. Create or update reminders
        await Promise.all(reminders.map(r => {
          if (r.id) {
            // Update
             return apiClient.put(`/api/medications/reminders/${r.id}`, {
              reminderTime: r.time,
              days: r.days
            });
          } else {
            // Create
            return apiClient.post(`/api/medications/${savedMedicationId}/reminders`, {
              reminderTime: r.time,
              days: r.days,
              isActive: true
            });
          }
        }));
      }

      console.log('✅ MedicationManager: Medication saved successfully');
      handleCancel(); // Reset form and clear state
    } catch (error) {
      console.error('❌ MedicationManager: Error saving medication:', error);
      // You could add a toast notification here for better UX
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (medication: Medication) => {
    setFormData({
      name: medication.name,
      genericName: medication.genericName || '',
      brandName: medication.brandName || '',
      rxcui: medication.rxcui || '',
      dosage: medication.dosage,
      strength: medication.strength || '',
      dosageForm: medication.dosageForm || '',
      frequency: medication.frequency,
      route: medication.route || 'oral',
      instructions: medication.instructions,
      prescribedBy: medication.prescribedBy,
      prescribedDate: medication.prescribedDate instanceof Date
        ? medication.prescribedDate.toISOString().split('T')[0]
        : new Date(medication.prescribedDate).toISOString().split('T')[0],
      startDate: medication.startDate
        ? (medication.startDate instanceof Date
          ? medication.startDate.toISOString().split('T')[0]
          : new Date(medication.startDate).toISOString().split('T')[0])
        : '',
      endDate: medication.endDate
        ? (medication.endDate instanceof Date
          ? medication.endDate.toISOString().split('T')[0]
          : new Date(medication.endDate).toISOString().split('T')[0])
        : '',
      isPRN: medication.isPRN || false,
      maxDailyDose: medication.maxDailyDose || '',
      notes: medication.notes || '',
      pharmacy: medication.pharmacy || '',
      prescriptionNumber: medication.prescriptionNumber || '',
      refillsRemaining: medication.refillsRemaining || 0,
    });
    setEditingMedicationId(medication.id);
    setIsAddingMedication(true);

    // Fetch reminders
    try {
      const response = await apiClient.get<MedicationReminder[]>(`/api/medications/${medication.id}/reminders`);
      if (response.success && response.data) {
        setInitialReminders(response.data);
        setReminders(response.data.map(r => ({
          id: r.id,
          time: r.reminderTime,
          days: r.days as DayOfWeek[]
        })));
      } else {
        setInitialReminders([]);
        setReminders([]);
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
      setReminders([]);
    }
  };

  const handleCancel = () => {
    setIsAddingMedication(false);
    setEditingMedicationId(null);
    setFormData(initialFormData);
    setValidationErrors({});
    setDrugInteractions([]);
    setRelatedDrugs([]);
    setDuplicateWarning(null);
    setReminders([]);
    setInitialReminders([]);
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

  const activeMedications = medications.filter(med => med.isActive);
  const inactiveMedications = medications.filter(med => !med.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
        {!isAddingMedication && (
          <button
            onClick={() => {
              console.log('🔍 MedicationManager: Add Medication button clicked');
              console.log('🔍 MedicationManager: Current patient ID:', patientId);
              console.log('🔍 MedicationManager: Is loading:', isLoading);
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

      {/* Add/Edit Medication Form */}
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
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800">{duplicateWarning}</p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Please verify this is a different medication or dosage before proceeding.
                  </p>
                </div>
              </div>
            )}

            {/* Drug Interactions Warning */}
            {drugInteractions.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Potential Drug Interactions</h4>
                    <div className="mt-2 space-y-1">
                      {drugInteractions.slice(0, 3).map((interaction, index) => (
                        <p key={index} className="text-xs text-red-700">
                          • {interaction.description || 'Interaction detected with existing medications'}
                        </p>
                      ))}
                      {drugInteractions.length > 3 && (
                        <p className="text-xs text-red-600">
                          +{drugInteractions.length - 3} more interactions found
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-red-600 mt-2">
                      Please consult with the prescribing physician before adding this medication.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Medication Search */}
            <div>
              <label className="label">Search Medication</label>
              <MedicationSearch
                onSelect={handleDrugSelect}
                placeholder="Search for medication by name..."
                className="w-full"
              />
              {formData.name && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Selected: <span className="font-medium">{formData.name}</span>
                    {formData.rxcui && <span className="text-gray-400 ml-2">(RXCUI: {formData.rxcui})</span>}
                  </p>
                  {relatedDrugs.length > 0 && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Related medications:</span>{' '}
                      {relatedDrugs.slice(0, 3).map(drug => drug.name).join(', ')}
                      {relatedDrugs.length > 3 && ` +${relatedDrugs.length - 3} more`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Manual name entry if search doesn't work */}
              <div>
                <label className="label">Medication Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`input ${validationErrors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  required
                  placeholder="Enter medication name"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <label className="label">Dosage *</label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => handleInputChange('dosage', e.target.value)}
                  className={`input ${validationErrors.dosage ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  required
                  placeholder="e.g., 1 tablet, 5ml, 2 capsules"
                />
                {validationErrors.dosage && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.dosage}</p>
                )}
              </div>

              <div>
                <label className="label">Strength</label>
                <input
                  type="text"
                  value={formData.strength}
                  onChange={(e) => handleInputChange('strength', e.target.value)}
                  className={`input ${validationErrors.strength ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="e.g., 10mg, 500mg, 5ml"
                />
                {validationErrors.strength && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.strength}</p>
                )}
              </div>

              <div>
                <label className="label">Dosage Form</label>
                <select
                  value={formData.dosageForm}
                  onChange={(e) => handleInputChange('dosageForm', e.target.value)}
                  className={`input ${validationErrors.dosageForm ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                >
                  <option value="">Select dosage form</option>
                  {COMMON_DOSAGE_FORMS.map(form => (
                    <option key={form} value={form}>
                      {form.charAt(0).toUpperCase() + form.slice(1)}
                    </option>
                  ))}
                </select>
                {validationErrors.dosageForm && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.dosageForm}</p>
                )}
              </div>

              <div>
                <label className="label">Frequency *</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => handleInputChange('frequency', e.target.value)}
                  className={`input ${validationErrors.frequency ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  required
                >
                  <option value="">Select frequency</option>
                  <option value="Once daily">Once daily</option>
                  <option value="Twice daily">Twice daily</option>
                  <option value="Three times daily">Three times daily</option>
                  <option value="Four times daily">Four times daily</option>
                  <option value="Every 4 hours">Every 4 hours</option>
                  <option value="Every 6 hours">Every 6 hours</option>
                  <option value="Every 8 hours">Every 8 hours</option>
                  <option value="Every 12 hours">Every 12 hours</option>
                  <option value="As needed">As needed (PRN)</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
                {validationErrors.frequency && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.frequency}</p>
                )}
              </div>

              {/* Reminder Settings */}
              {!formData.isPRN && (
                <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-5 h-5 text-blue-600" />
                      <h5 className="font-medium text-blue-900">Reminders</h5>
                    </div>
                    <button
                      type="button"
                      onClick={addReminder}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Reminder Time</span>
                    </button>
                  </div>

                  {reminders.length === 0 ? (
                    <p className="text-sm text-blue-600 italic">No reminders set. Add times to get notified.</p>
                  ) : (
                    <div className="space-y-4">
                      {reminders.map((reminder, index) => (
                        <div key={index} className="bg-white p-3 rounded-md border border-blue-200 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mr-4">
                              <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Time</label>
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <input
                                    type="time"
                                    value={reminder.time}
                                    onChange={(e) => updateReminder(index, 'time', e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Days</label>
                                <div className="flex flex-wrap gap-1">
                                  {WEEKDAYS.map(day => (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() => toggleDay(index, day.value)}
                                      className={`px-2 py-1 text-xs rounded-full border ${
                                        reminder.days.includes(day.value)
                                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                      }`}
                                    >
                                      {day.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReminder(index)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Remove reminder"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="label">Route</label>
                <select
                  value={formData.route}
                  onChange={(e) => handleInputChange('route', e.target.value)}
                  className="input"
                >
                  {MEDICATION_ROUTES.map(route => (
                    <option key={route.value} value={route.value}>
                      {route.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Prescribed By *</label>
                <input
                  type="text"
                  value={formData.prescribedBy}
                  onChange={(e) => handleInputChange('prescribedBy', e.target.value)}
                  className={`input ${validationErrors.prescribedBy ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  required
                  placeholder="Doctor's name"
                />
                {validationErrors.prescribedBy && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.prescribedBy}</p>
                )}
              </div>

              <div>
                <label className="label">Prescribed Date *</label>
                <input
                  type="date"
                  value={formData.prescribedDate}
                  onChange={(e) => handleInputChange('prescribedDate', e.target.value)}
                  className={`input ${validationErrors.prescribedDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  required
                />
                {validationErrors.prescribedDate && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.prescribedDate}</p>
                )}
              </div>

              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`input ${validationErrors.endDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {validationErrors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Instructions *</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                className={`input ${validationErrors.instructions ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                rows={3}
                required
                placeholder="e.g., Take with food, avoid alcohol, take on empty stomach"
              />
              {validationErrors.instructions && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.instructions}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Max Daily Dose (if PRN)</label>
                <input
                  type="text"
                  value={formData.maxDailyDose}
                  onChange={(e) => handleInputChange('maxDailyDose', e.target.value)}
                  className="input"
                  placeholder="e.g., 4 tablets, 20ml"
                  disabled={!formData.isPRN}
                />
              </div>

              <div>
                <label className="label">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input"
                  placeholder="Additional notes or observations"
                />
              </div>
            </div>

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

            {/* Checking interactions indicator */}
            {isCheckingInteractions && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-blue-800">Checking for drug interactions...</p>
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

      {/* Active Medications */}
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
                            PRN
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {medication.dosage} • {medication.frequency}
                        {medication.strength && ` • ${medication.strength}`}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{medication.instructions}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Prescribed: {
                            medication.prescribedDate instanceof Date
                              ? medication.prescribedDate.toLocaleDateString()
                              : new Date(medication.prescribedDate).toLocaleDateString()
                          }</span>
                        </span>
                        <span>By: {medication.prescribedBy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
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
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Medication</span>
          </button>
        </div>
      )}

      {/* Inactive Medications */}
      {inactiveMedications.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Past Medications</h4>
          <div className="space-y-3">
            {inactiveMedications.map((medication) => (
              <div
                key={medication.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <Pill className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-700">{medication.name}</h5>
                      <p className="text-sm text-gray-500 mt-1">
                        {medication.dosage} • {medication.frequency}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span>Prescribed: {
                          medication.prescribedDate instanceof Date
                            ? medication.prescribedDate.toLocaleDateString()
                            : new Date(medication.prescribedDate).toLocaleDateString()
                        }</span>
                        {medication.endDate && (
                          <span>Ended: {
                            medication.endDate instanceof Date
                              ? medication.endDate.toLocaleDateString()
                              : new Date(medication.endDate).toLocaleDateString()
                          }</span>
                        )}
                      </div>
                    </div>
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