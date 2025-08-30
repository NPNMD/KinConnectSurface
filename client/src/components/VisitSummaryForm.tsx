import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Mic, 
  MicOff, 
  Save, 
  Sparkles, 
  Calendar, 
  User, 
  Building, 
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import type { 
  NewVisitSummary, 
  VisitType, 
  VisitInputMethod, 
  VisitFamilyAccessLevel,
  HealthcareProvider,
  MedicalFacility 
} from '@shared/types';

interface VisitSummaryFormProps {
  patientId: string;
  medicalEventId?: string;
  onSubmit?: (summary: any) => void;
  onCancel?: () => void;
  initialData?: Partial<NewVisitSummary>;
}

export default function VisitSummaryForm({ 
  patientId, 
  medicalEventId, 
  onSubmit, 
  onCancel,
  initialData 
}: VisitSummaryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [providers, setProviders] = useState<HealthcareProvider[]>([]);
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  
  const [formData, setFormData] = useState<Partial<NewVisitSummary>>({
    patientId,
    medicalEventId,
    visitDate: new Date(),
    visitType: 'scheduled',
    inputMethod: 'text',
    doctorSummary: '',
    treatmentPlan: '',
    providerName: '',
    providerSpecialty: '',
    facilityName: '',
    chiefComplaint: '',
    diagnosis: [],
    procedures: [],
    sharedWithFamily: true,
    familyAccessLevel: 'summary_only',
    tags: [],
    ...initialData
  });

  // Load providers and facilities
  useEffect(() => {
    const loadProvidersAndFacilities = async () => {
      try {
        setLoadingProviders(true);
        
        // Load healthcare providers
        const providersResponse = await apiClient.get<{ success: boolean; data: HealthcareProvider[] }>(
          API_ENDPOINTS.HEALTHCARE_PROVIDERS(patientId)
        );
        
        if (providersResponse.success && providersResponse.data) {
          setProviders(providersResponse.data);
        }
        
        // Load medical facilities
        const facilitiesResponse = await apiClient.get<{ success: boolean; data: MedicalFacility[] }>(
          API_ENDPOINTS.MEDICAL_FACILITIES(patientId)
        );
        
        if (facilitiesResponse.success && facilitiesResponse.data) {
          setFacilities(facilitiesResponse.data);
        }
      } catch (error) {
        console.error('Error loading providers/facilities:', error);
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProvidersAndFacilities();
  }, [patientId]);

  const handleInputChange = (field: keyof NewVisitSummary, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProviderSelect = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setFormData(prev => ({
        ...prev,
        providerId: provider.id,
        providerName: provider.name,
        providerSpecialty: provider.specialty
      }));
    }
  };

  const handleFacilitySelect = (facilityId: string) => {
    const facility = facilities.find(f => f.id === facilityId);
    if (facility) {
      setFormData(prev => ({
        ...prev,
        facilityId: facility.id,
        facilityName: facility.name
      }));
    }
  };

  const handleVoiceRecording = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        setFormData(prev => ({ ...prev, inputMethod: 'voice' }));
        
        // TODO: Implement actual voice recording and transcription
        console.log('Voice recording started');
        
        // For now, just simulate recording
        setTimeout(() => {
          setIsRecording(false);
          console.log('Voice recording stopped');
        }, 5000);
        
      } catch (error) {
        console.error('Error starting voice recording:', error);
        alert('Unable to access microphone. Please check permissions.');
      }
    } else {
      // Stop recording
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.doctorSummary?.trim()) {
      alert('Please provide a visit summary');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const visitSummaryData: NewVisitSummary = {
        patientId,
        medicalEventId,
        visitDate: formData.visitDate || new Date(),
        visitType: formData.visitType || 'scheduled',
        inputMethod: formData.inputMethod || 'text',
        doctorSummary: formData.doctorSummary || '',
        treatmentPlan: formData.treatmentPlan || '',
        providerName: formData.providerName || '',
        providerSpecialty: formData.providerSpecialty,
        providerId: formData.providerId,
        facilityName: formData.facilityName,
        facilityId: formData.facilityId,
        visitDuration: formData.visitDuration,
        chiefComplaint: formData.chiefComplaint,
        diagnosis: formData.diagnosis || [],
        procedures: formData.procedures || [],
        labResults: formData.labResults || [],
        imagingResults: formData.imagingResults || [],
        vitalSigns: formData.vitalSigns,
        sharedWithFamily: formData.sharedWithFamily !== false,
        familyAccessLevel: formData.familyAccessLevel || 'summary_only',
        restrictedFields: formData.restrictedFields || [],
        tags: formData.tags || [],
        categories: formData.categories || [],
        createdBy: patientId // Will be set by backend auth
      };

      const response = await apiClient.post<{ success: boolean; data: any }>(
        API_ENDPOINTS.VISIT_SUMMARY_CREATE,
        visitSummaryData
      );

      if (response.success) {
        onSubmit?.(response.data);
      } else {
        throw new Error('Failed to create visit summary');
      }
    } catch (error) {
      console.error('Error creating visit summary:', error);
      alert('Failed to save visit summary. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Record Visit Summary</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleVoiceRecording}
            className={`p-2 rounded-md transition-colors ${
              isRecording 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Visit Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visit Date *
            </label>
            <input
              type="date"
              value={formData.visitDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => handleInputChange('visitDate', new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visit Type
            </label>
            <select
              value={formData.visitType || 'scheduled'}
              onChange={(e) => handleInputChange('visitType', e.target.value as VisitType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="scheduled">Scheduled Appointment</option>
              <option value="walk_in">Walk-in</option>
              <option value="emergency">Emergency Visit</option>
              <option value="follow_up">Follow-up</option>
              <option value="consultation">Consultation</option>
              <option value="telemedicine">Telemedicine</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={formData.visitDuration || ''}
              onChange={(e) => handleInputChange('visitDuration', parseInt(e.target.value) || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="30"
              min="1"
              max="480"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chief Complaint
            </label>
            <input
              type="text"
              value={formData.chiefComplaint || ''}
              onChange={(e) => handleInputChange('chiefComplaint', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Main reason for visit"
            />
          </div>
        </div>

        {/* Provider and Facility */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Healthcare Provider
            </label>
            {providers.length > 0 ? (
              <select
                value={formData.providerId || ''}
                onChange={(e) => handleProviderSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a provider</option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} - {provider.specialty}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.providerName || ''}
                onChange={(e) => handleInputChange('providerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Dr. Smith"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medical Facility
            </label>
            {facilities.length > 0 ? (
              <select
                value={formData.facilityId || ''}
                onChange={(e) => handleFacilitySelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a facility</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.facilityName || ''}
                onChange={(e) => handleInputChange('facilityName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="General Hospital"
              />
            )}
          </div>
        </div>

        {/* Visit Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visit Summary *
          </label>
          <textarea
            value={formData.doctorSummary || ''}
            onChange={(e) => handleInputChange('doctorSummary', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={6}
            placeholder="Describe what happened during the visit, findings, discussions..."
            required
          />
          {isRecording && (
            <div className="mt-2 flex items-center space-x-2 text-red-600">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm">Recording in progress...</span>
            </div>
          )}
        </div>

        {/* Treatment Plan */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Treatment Plan
          </label>
          <textarea
            value={formData.treatmentPlan || ''}
            onChange={(e) => handleInputChange('treatmentPlan', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
            placeholder="Treatment recommendations, medications, follow-up instructions..."
          />
        </div>

        {/* Family Sharing */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Family Sharing</h3>
          
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="shareWithFamily"
                checked={formData.sharedWithFamily !== false}
                onChange={(e) => handleInputChange('sharedWithFamily', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="shareWithFamily" className="ml-2 text-sm text-gray-700">
                Share this visit summary with family members
              </label>
            </div>

            {formData.sharedWithFamily !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Family Access Level
                </label>
                <select
                  value={formData.familyAccessLevel || 'summary_only'}
                  onChange={(e) => handleInputChange('familyAccessLevel', e.target.value as VisitFamilyAccessLevel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="full">Full Access - All details</option>
                  <option value="summary_only">Summary Only - Key points and action items</option>
                  <option value="restricted">Restricted - Basic information only</option>
                  <option value="none">None - Not shared</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting || !formData.doctorSummary?.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Save & Process with AI</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}