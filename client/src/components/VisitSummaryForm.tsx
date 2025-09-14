import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  Sparkles,
  Calendar,
  User,
  Building,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import SimpleVisitRecorder from './SimpleVisitRecorder';
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
  const [providers, setProviders] = useState<HealthcareProvider[]>([]);
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [recordingCompleted, setRecordingCompleted] = useState(false);
  
  const [formData, setFormData] = useState<Partial<NewVisitSummary>>({
    patientId,
    medicalEventId,
    visitDate: new Date(),
    visitType: 'scheduled',
    inputMethod: 'text',
    doctorSummary: '',
    providerName: '',
    providerSpecialty: '',
    facilityName: '',
    sharedWithFamily: true,
    familyAccessLevel: 'summary_only',
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

  // Handle recording completion
  const handleRecordingComplete = (visitId: string, results: any) => {
    console.log('🎤 Recording completed:', { visitId, results });
    
    // The results object contains the AI-processed summary, not just transcript
    // We need to extract the transcript or create a summary from the processed data
    let doctorSummary = '';
    
    // Try to get transcript first
    if (results?.transcript) {
      doctorSummary = results.transcript.trim();
    }
    // If no transcript, create summary from AI results
    else if (results?.keyPoints && results.keyPoints.length > 0) {
      doctorSummary = results.keyPoints.join('. ') + '.';
      if (results.actionItems && results.actionItems.length > 0) {
        doctorSummary += '\n\nAction Items:\n' + results.actionItems.map((item: string) => `• ${item}`).join('\n');
      }
    }
    // Fallback: use any text content available
    else if (results?.text || results?.transcription) {
      doctorSummary = (results.text || results.transcription).trim();
    }
    
    if (doctorSummary && doctorSummary.trim()) {
      setFormData(prev => ({
        ...prev,
        doctorSummary: doctorSummary.trim(),
        inputMethod: 'voice',
        voiceTranscriptionId: visitId
      }));
      setRecordingCompleted(true);
      console.log('✅ Doctor summary saved to form:', doctorSummary.substring(0, 100) + '...');
    } else {
      console.warn('⚠️ No usable content found in results:', results);
      // Still mark as completed but show a message
      setRecordingCompleted(true);
      setFormData(prev => ({
        ...prev,
        doctorSummary: 'Recording completed - please add visit details manually.',
        inputMethod: 'voice',
        voiceTranscriptionId: visitId
      }));
    }
  };

  // Handle recording error
  const handleRecordingError = (error: string) => {
    console.error('🎤 Recording error:', error);
    // Could show a toast notification here
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalDoctorSummary = formData.doctorSummary || '';
    
    if (!finalDoctorSummary.trim()) {
      alert('Please provide a visit summary or record audio');
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
        doctorSummary: finalDoctorSummary,
        providerName: formData.providerName || '',
        providerSpecialty: formData.providerSpecialty,
        providerId: formData.providerId,
        facilityName: formData.facilityName,
        facilityId: formData.facilityId,
        sharedWithFamily: formData.sharedWithFamily !== false,
        familyAccessLevel: formData.familyAccessLevel || 'summary_only',
        voiceTranscriptionId: formData.voiceTranscriptionId,
        createdBy: patientId
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Visit Info */}
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

        {/* Visit Recording Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Visit Summary *
          </label>
          
          {/* New Simplified Recording Component */}
          <SimpleVisitRecorder
            patientId={patientId}
            onComplete={handleRecordingComplete}
            onError={handleRecordingError}
            className="mb-4"
          />

          {/* Text Input for Manual Entry or Editing */}
          <div className="relative">
            <textarea
              value={formData.doctorSummary || ''}
              onChange={(e) => handleInputChange('doctorSummary', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={8}
              placeholder="Record audio above or type the doctor's summary of the visit..."
              required
            />
            
            {recordingCompleted && (
              <div className="mt-2 text-sm text-green-600 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Audio transcription completed! You can edit the text above if needed.</span>
              </div>
            )}
          </div>
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
            onClick={() => {
              console.log('🔍 Button click debug:', {
                isSubmitting,
                hasDoctorSummary: !!formData.doctorSummary,
                doctorSummaryLength: formData.doctorSummary?.length || 0,
                doctorSummaryTrimmed: formData.doctorSummary?.trim() || '',
                isDisabled: isSubmitting || !formData.doctorSummary?.trim(),
                formData: formData
              });
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving & Analyzing...</span>
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