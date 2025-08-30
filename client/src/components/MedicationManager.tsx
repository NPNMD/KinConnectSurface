import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Pill, Save, X, AlertTriangle, CheckCircle, Info, Clock, Bell } from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { DrugConcept, drugApiService } from '@/lib/drugApi';
import MedicationSearch from './MedicationSearch';
import MedicationScheduleManager from './MedicationScheduleManager';

// API constants
const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Helper function to get authenticated headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { getIdToken } = await import('@/lib/firebase');
  const token = await getIdToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

interface MedicationManagerProps {
  patientId: string;
  medications: Medication[];
  onAddMedication: (medication: NewMedication) => Promise<void>;
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
  // Removed RxNorm-based state variables for OpenFDA-only implementation
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [showScheduleFor, setShowScheduleFor] = useState<string | null>(null);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({
    enableReminders: false,
    reminderTimes: ['15'], // minutes before dose
    notificationMethods: ['browser'] as ('browser' | 'email' | 'sms')[]
  });

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
    
    // Extract complete dosage from drug name or use API data
    const dosageMatch = drug.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
    const completeDosage = drug.extractedDosage || (dosageMatch ? `${dosageMatch[1]}${dosageMatch[2].toLowerCase()}` : '');
    
    // Use API dosage form or determine from drug name
    let dosageForm = drug.dosageForm || '';
    if (!dosageForm || dosageForm === 'Unknown') {
      const formMatches = drug.name.toLowerCase();
      if (formMatches.includes('tablet')) dosageForm = 'tablet';
      else if (formMatches.includes('capsule')) dosageForm = 'capsule';
      else if (formMatches.includes('liquid') || formMatches.includes('solution')) dosageForm = 'liquid';
      else if (formMatches.includes('cream')) dosageForm = 'cream';
      else if (formMatches.includes('injection')) dosageForm = 'injection';
      else dosageForm = 'tablet'; // Default to tablet if unknown
    }
    
    // Auto-fill with standard dosing if available
    let autoFillData: Partial<MedicationFormData> = {
      dosage: completeDosage || '500mg', // Complete dosage with unit
    };
    
    if (drug.standardDosing) {
      // Use the first common dose directly (already includes unit)
      const firstCommonDose = drug.standardDosing.commonDoses?.[0] || '';
      
      autoFillData = {
        dosage: firstCommonDose || completeDosage || '500mg', // Complete dosage (e.g., "500mg", "200mg")
        frequency: drug.standardDosing.frequency?.[0] || '',
        instructions: drug.standardDosing.notes || '',
        maxDailyDose: drug.standardDosing.maxDailyDose || ''
      };
    }
    
    setFormData(prev => ({
      ...prev,
      name: drug.name,
      rxcui: drug.rxcui,
      dosage: autoFillData.dosage || completeDosage || prev.dosage, // Complete dosage with unit
      dosageForm: dosageForm || prev.dosageForm, // This is the form (e.g., "tablet")
      route: drug.route || prev.route,
      // Try to extract generic/brand info from the drug name and type
      genericName: drug.tty === 'SCD' ? drug.name : (drug.synonym || prev.genericName),
      brandName: drug.tty === 'SBD' ? drug.name : prev.brandName,
      // Auto-fill other standard dosing data
      frequency: autoFillData.frequency || prev.frequency,
      instructions: autoFillData.instructions || prev.instructions,
      maxDailyDose: autoFillData.maxDailyDose || prev.maxDailyDose
    }));
    
    // Note: Removed RxNorm API calls for pure OpenFDA implementation
    // All dosing info is now handled through the OpenFDA data above
    console.log('✅ Drug selection completed with OpenFDA data');
  };
  
  // Note: Drug interactions removed for OpenFDA-only implementation
  // Can be re-implemented with OpenFDA data if needed

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
          // Complete dosage validation - includes unit
          const dosagePattern = /^\d+(?:\.\d+)?\s*(mg|mcg|g|ml|units?|iu|tablet|capsule)s?$/i;
          if (!dosagePattern.test(value.trim())) {
            errors.dosage = 'Please enter a valid dosage (e.g., "500mg", "1 tablet", "5ml")';
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
    // Instructions and prescribedBy are now optional
    
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
        dosageForm: formData.dosageForm?.trim() || undefined,
        frequency: formData.frequency,
        route: formData.route || undefined,
        instructions: formData.instructions?.trim() || undefined, // Now optional
        prescribedBy: formData.prescribedBy?.trim() || undefined, // Now optional
        prescribedDate: formData.prescribedDate ? new Date(formData.prescribedDate) : new Date(), // Default to today if not provided
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

      if (editingMedicationId) {
        console.log('🔍 MedicationManager: Updating medication:', editingMedicationId);
        await onUpdateMedication(editingMedicationId, medicationData);
        setEditingMedicationId(null);
      } else {
        console.log('🔍 MedicationManager: Adding new medication');
        await onAddMedication(medicationData);
        setIsAddingMedication(false);
        
        // Show reminder prompt for new medications
        setShowReminderPrompt(true);
      }

      console.log('✅ MedicationManager: Medication saved successfully');
      if (!showReminderPrompt) {
        handleCancel(); // Reset form and clear state only if not showing reminder prompt
      }
    } catch (error) {
      console.error('❌ MedicationManager: Error saving medication:', error);
      // You could add a toast notification here for better UX
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (medication: Medication) => {
    setFormData({
      name: medication.name,
      genericName: medication.genericName || '',
      brandName: medication.brandName || '',
      rxcui: medication.rxcui || '',
      dosage: medication.dosage,
      dosageForm: medication.dosageForm || '',
      frequency: medication.frequency,
      route: medication.route || 'oral',
      instructions: medication.instructions || '',
      prescribedBy: medication.prescribedBy || '',
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
  };

  const handleCancel = () => {
    setIsAddingMedication(false);
    setEditingMedicationId(null);
    setFormData(initialFormData);
    setValidationErrors({});
    setDuplicateWarning(null);
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

            {/* Drug interactions removed for OpenFDA-only implementation */}

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
                    {formData.rxcui && <span className="text-gray-400 ml-2">(ID: {formData.rxcui})</span>}
                  </p>
                  {/* Related drugs removed for OpenFDA-only implementation */}
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
                  placeholder="e.g., 500mg, 200mg, 1 tablet"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Complete dosage with unit (auto-filled from search)
                </p>
                {validationErrors.dosage && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.dosage}</p>
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
                <label className="label">Prescribed By</label>
                <input
                  type="text"
                  value={formData.prescribedBy}
                  onChange={(e) => handleInputChange('prescribedBy', e.target.value)}
                  className={`input ${validationErrors.prescribedBy ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Doctor's name (optional)"
                />
                {validationErrors.prescribedBy && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.prescribedBy}</p>
                )}
              </div>

              <div>
                <label className="label">Prescribed Date</label>
                <input
                  type="date"
                  value={formData.prescribedDate}
                  onChange={(e) => handleInputChange('prescribedDate', e.target.value)}
                  className={`input ${validationErrors.prescribedDate ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
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
              <label className="label">Extra Instructions</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                className={`input ${validationErrors.instructions ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                rows={3}
                placeholder="e.g., Take with food, avoid alcohol, take on empty stomach (optional)"
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

            {/* Drug interaction checking removed for OpenFDA-only implementation */}

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

      {/* Medication Reminder Prompt */}
      {showReminderPrompt && (
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium text-blue-900 mb-2">
                Set Up Medication Reminders
              </h4>
              <p className="text-blue-800 mb-4">
                Would you like to receive reminders for this medication? We can send you notifications to help you stay on track with your medication schedule.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enableReminders"
                    checked={reminderSettings.enableReminders}
                    onChange={(e) => setReminderSettings(prev => ({
                      ...prev,
                      enableReminders: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enableReminders" className="text-sm font-medium text-blue-900">
                    Enable medication reminders
                  </label>
                </div>
                
                {reminderSettings.enableReminders && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-2">
                        Reminder timing (minutes before dose)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['5', '10', '15', '30', '60'].map(minutes => (
                          <label key={minutes} className="flex items-center space-x-1">
                            <input
                              type="checkbox"
                              checked={reminderSettings.reminderTimes.includes(minutes)}
                              onChange={(e) => {
                                setReminderSettings(prev => ({
                                  ...prev,
                                  reminderTimes: e.target.checked
                                    ? [...prev.reminderTimes, minutes]
                                    : prev.reminderTimes.filter(t => t !== minutes)
                                }));
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-800">{minutes} min</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-2">
                        Notification methods
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={reminderSettings.notificationMethods.includes('browser')}
                            onChange={(e) => {
                              setReminderSettings(prev => ({
                                ...prev,
                                notificationMethods: e.target.checked
                                  ? [...prev.notificationMethods.filter(m => m !== 'browser'), 'browser']
                                  : prev.notificationMethods.filter(m => m !== 'browser')
                              }));
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-800">Browser notifications</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={reminderSettings.notificationMethods.includes('email')}
                            onChange={(e) => {
                              setReminderSettings(prev => ({
                                ...prev,
                                notificationMethods: e.target.checked
                                  ? [...prev.notificationMethods.filter(m => m !== 'email'), 'email']
                                  : prev.notificationMethods.filter(m => m !== 'email')
                              }));
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-800">Email notifications</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowReminderPrompt(false);
                    setReminderSettings({
                      enableReminders: false,
                      reminderTimes: ['15'],
                      notificationMethods: ['browser']
                    });
                    handleCancel();
                  }}
                  className="btn-secondary"
                >
                  Skip for now
                </button>
                <button
                  onClick={async () => {
                    if (reminderSettings.enableReminders) {
                      try {
                        // Request browser notification permission
                        if (reminderSettings.notificationMethods.includes('browser')) {
                          if ('Notification' in window && Notification.permission === 'default') {
                            await Notification.requestPermission();
                          }
                        }
                        
                        // Get the most recently added medication ID
                        const latestMedication = medications[medications.length - 1];
                        if (latestMedication) {
                          // Save reminder settings to backend
                          const response = await fetch(`${API_BASE}/medication-reminders`, {
                            method: 'POST',
                            headers: await getAuthHeaders(),
                            body: JSON.stringify({
                              medicationId: latestMedication.id,
                              reminderTimes: reminderSettings.reminderTimes,
                              notificationMethods: reminderSettings.notificationMethods,
                              isActive: true
                            })
                          });
                          
                          if (response.ok) {
                            console.log('✅ Medication reminder settings saved successfully');
                            alert('Medication reminders have been set up successfully!');
                          } else {
                            console.error('❌ Failed to save reminder settings');
                            alert('Failed to set up reminders. Please try again.');
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error setting up reminders:', error);
                        alert('Failed to set up reminders. Please try again.');
                      }
                    }
                    
                    setShowReminderPrompt(false);
                    setReminderSettings({
                      enableReminders: false,
                      reminderTimes: ['15'],
                      notificationMethods: ['browser']
                    });
                    handleCancel();
                  }}
                  className="btn-primary"
                >
                  {reminderSettings.enableReminders ? 'Set Up Reminders' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
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
                      onClick={() => setShowScheduleFor(showScheduleFor === medication.id ? null : medication.id)}
                      className={`p-2 transition-colors ${
                        showScheduleFor === medication.id
                          ? 'text-primary-600 bg-primary-50'
                          : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                      }`}
                      title="Manage schedule"
                    >
                      <Clock className="w-4 h-4" />
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
                
                {/* Medication Schedule Manager */}
                {showScheduleFor === medication.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <MedicationScheduleManager
                      medication={medication}
                      onScheduleChange={() => {
                        // Optionally refresh medication data or show success message
                        console.log('Schedule updated for medication:', medication.name);
                      }}
                    />
                  </div>
                )}
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