import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  MapPin, 
  Phone, 
  Globe, 
  Star,
  Stethoscope,
  Building2,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react';
import { 
  HealthcareProvider, 
  NewHealthcareProvider, 
  MedicalFacility,
  NewMedicalFacility,
  GooglePlaceResult,
  MEDICAL_SPECIALTIES,
  FACILITY_TYPES
} from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import HealthcareProviderSearch from './HealthcareProviderSearch';
import { googlePlacesApi } from '@/lib/googlePlacesApi';

interface HealthcareProvidersManagerProps {
  patientId: string;
  providers: HealthcareProvider[];
  facilities: MedicalFacility[];
  onAddProvider: (provider: NewHealthcareProvider) => Promise<void>;
  onUpdateProvider: (id: string, provider: Partial<HealthcareProvider>) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  onAddFacility: (facility: NewMedicalFacility) => Promise<void>;
  onUpdateFacility: (id: string, facility: Partial<MedicalFacility>) => Promise<void>;
  onDeleteFacility: (id: string) => Promise<void>;
  isLoading?: boolean;
}

interface ProviderFormData {
  name: string;
  specialty: string;
  subSpecialty: string;
  credentials: string;
  phoneNumber: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  placeId: string;
  googleRating: number | null;
  googleReviews: number | null;
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | '';
  practiceName: string;
  hospitalAffiliation: string[];
  acceptedInsurance: string[];
  languages: string[];
  preferredAppointmentTime: string;
  typicalWaitTime: string;
  isPrimary: boolean;
  relationshipStart: string;
  lastVisit: string;
  nextAppointment: string;
  notes: string;
}

interface FacilityFormData {
  name: string;
  facilityType: string;
  phoneNumber: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  placeId: string;
  googleRating: number | null;
  googleReviews: number | null;
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | '';
  services: string[];
  acceptedInsurance: string[];
  emergencyServices: boolean;
  isPreferred: boolean;
  notes: string;
}

const initialProviderFormData: ProviderFormData = {
  name: '',
  specialty: '',
  subSpecialty: '',
  credentials: '',
  phoneNumber: '',
  email: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  placeId: '',
  googleRating: null,
  googleReviews: null,
  businessStatus: '',
  practiceName: '',
  hospitalAffiliation: [],
  acceptedInsurance: [],
  languages: [],
  preferredAppointmentTime: '',
  typicalWaitTime: '',
  isPrimary: false,
  relationshipStart: '',
  lastVisit: '',
  nextAppointment: '',
  notes: ''
};

const initialFacilityFormData: FacilityFormData = {
  name: '',
  facilityType: '',
  phoneNumber: '',
  email: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  placeId: '',
  googleRating: null,
  googleReviews: null,
  businessStatus: '',
  services: [],
  acceptedInsurance: [],
  emergencyServices: false,
  isPreferred: false,
  notes: ''
};

export default function HealthcareProvidersManager({
  patientId,
  providers,
  facilities,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
  onAddFacility,
  onUpdateFacility,
  onDeleteFacility,
  isLoading = false
}: HealthcareProvidersManagerProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'facilities'>('providers');
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [isAddingFacility, setIsAddingFacility] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [providerFormData, setProviderFormData] = useState<ProviderFormData>(initialProviderFormData);
  const [facilityFormData, setFacilityFormData] = useState<FacilityFormData>(initialFacilityFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleProviderSelect = async (place: GooglePlaceResult, specialty: string) => {
    const addressComponents = googlePlacesApi.extractAddressComponents(place.address_components);
    
    setProviderFormData(prev => ({
      ...prev,
      name: place.name,
      specialty: specialty,
      phoneNumber: place.formatted_phone_number || '',
      website: place.website || '',
      address: place.formatted_address,
      city: addressComponents.city,
      state: addressComponents.state,
      zipCode: addressComponents.zipCode,
      country: addressComponents.country,
      placeId: place.place_id,
      googleRating: place.rating || null,
      googleReviews: place.user_ratings_total || null,
      businessStatus: place.business_status || ''
    }));
  };

  const handleFacilitySelect = async (place: GooglePlaceResult, facilityType: string) => {
    const addressComponents = googlePlacesApi.extractAddressComponents(place.address_components);
    
    setFacilityFormData(prev => ({
      ...prev,
      name: place.name,
      facilityType: facilityType,
      phoneNumber: place.formatted_phone_number || '',
      website: place.website || '',
      address: place.formatted_address,
      city: addressComponents.city,
      state: addressComponents.state,
      zipCode: addressComponents.zipCode,
      country: addressComponents.country,
      placeId: place.place_id,
      googleRating: place.rating || null,
      googleReviews: place.user_ratings_total || null,
      businessStatus: place.business_status || ''
    }));
  };

  const handleProviderInputChange = (field: keyof ProviderFormData, value: string | boolean | number | string[]) => {
    setProviderFormData(prev => ({
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

  const handleFacilityInputChange = (field: keyof FacilityFormData, value: string | boolean | number | string[]) => {
    setFacilityFormData(prev => ({
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

  const validateProviderForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!providerFormData.name.trim()) errors.name = 'Provider name is required';
    if (!providerFormData.specialty.trim()) errors.specialty = 'Specialty is required';
    if (!providerFormData.address.trim()) errors.address = 'Address is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFacilityForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!facilityFormData.name.trim()) errors.name = 'Facility name is required';
    if (!facilityFormData.facilityType.trim()) errors.facilityType = 'Facility type is required';
    if (!facilityFormData.address.trim()) errors.address = 'Address is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProviderForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const providerData: NewHealthcareProvider = {
        patientId,
        name: providerFormData.name.trim(),
        specialty: providerFormData.specialty,
        subSpecialty: providerFormData.subSpecialty?.trim() || undefined,
        credentials: providerFormData.credentials?.trim() || undefined,
        phoneNumber: providerFormData.phoneNumber?.trim() || undefined,
        email: providerFormData.email?.trim() || undefined,
        website: providerFormData.website?.trim() || undefined,
        address: providerFormData.address.trim(),
        city: providerFormData.city?.trim() || undefined,
        state: providerFormData.state?.trim() || undefined,
        zipCode: providerFormData.zipCode?.trim() || undefined,
        country: providerFormData.country?.trim() || undefined,
        placeId: providerFormData.placeId?.trim() || undefined,
        googleRating: providerFormData.googleRating || undefined,
        googleReviews: providerFormData.googleReviews || undefined,
        businessStatus: providerFormData.businessStatus || undefined,
        practiceName: providerFormData.practiceName?.trim() || undefined,
        hospitalAffiliation: providerFormData.hospitalAffiliation.filter(h => h.trim()),
        acceptedInsurance: providerFormData.acceptedInsurance.filter(i => i.trim()),
        languages: providerFormData.languages.filter(l => l.trim()),
        preferredAppointmentTime: providerFormData.preferredAppointmentTime?.trim() || undefined,
        typicalWaitTime: providerFormData.typicalWaitTime?.trim() || undefined,
        isPrimary: providerFormData.isPrimary,
        relationshipStart: providerFormData.relationshipStart ? new Date(providerFormData.relationshipStart) : undefined,
        lastVisit: providerFormData.lastVisit ? new Date(providerFormData.lastVisit) : undefined,
        nextAppointment: providerFormData.nextAppointment ? new Date(providerFormData.nextAppointment) : undefined,
        notes: providerFormData.notes?.trim() || undefined,
        isActive: true
      };

      console.log('🏥 Submitting provider data:', {
        name: providerData.name,
        isPrimary: providerData.isPrimary,
        isEditing: !!editingProviderId,
        providerId: editingProviderId || 'new'
      });

      if (editingProviderId) {
        await onUpdateProvider(editingProviderId, providerData);
        setEditingProviderId(null);
      } else {
        await onAddProvider(providerData);
        setIsAddingProvider(false);
      }

      handleProviderCancel();
    } catch (error) {
      console.error('Error saving provider:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateFacilityForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const facilityData: NewMedicalFacility = {
        patientId,
        name: facilityFormData.name.trim(),
        facilityType: facilityFormData.facilityType as any,
        phoneNumber: facilityFormData.phoneNumber?.trim() || undefined,
        email: facilityFormData.email?.trim() || undefined,
        website: facilityFormData.website?.trim() || undefined,
        address: facilityFormData.address.trim(),
        city: facilityFormData.city?.trim() || undefined,
        state: facilityFormData.state?.trim() || undefined,
        zipCode: facilityFormData.zipCode?.trim() || undefined,
        country: facilityFormData.country?.trim() || undefined,
        placeId: facilityFormData.placeId?.trim() || undefined,
        googleRating: facilityFormData.googleRating || undefined,
        googleReviews: facilityFormData.googleReviews || undefined,
        businessStatus: facilityFormData.businessStatus || undefined,
        services: facilityFormData.services.filter(s => s.trim()),
        acceptedInsurance: facilityFormData.acceptedInsurance.filter(i => i.trim()),
        emergencyServices: facilityFormData.emergencyServices,
        isPreferred: facilityFormData.isPreferred,
        notes: facilityFormData.notes?.trim() || undefined,
        isActive: true
      };

      if (editingFacilityId) {
        await onUpdateFacility(editingFacilityId, facilityData);
        setEditingFacilityId(null);
      } else {
        await onAddFacility(facilityData);
        setIsAddingFacility(false);
      }

      handleFacilityCancel();
    } catch (error) {
      console.error('Error saving facility:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProviderEdit = (provider: HealthcareProvider) => {
    setProviderFormData({
      name: provider.name,
      specialty: provider.specialty,
      subSpecialty: provider.subSpecialty || '',
      credentials: provider.credentials || '',
      phoneNumber: provider.phoneNumber || '',
      email: provider.email || '',
      website: provider.website || '',
      address: provider.address,
      city: provider.city || '',
      state: provider.state || '',
      zipCode: provider.zipCode || '',
      country: provider.country || '',
      placeId: provider.placeId || '',
      googleRating: provider.googleRating || null,
      googleReviews: provider.googleReviews || null,
      businessStatus: provider.businessStatus || '',
      practiceName: provider.practiceName || '',
      hospitalAffiliation: provider.hospitalAffiliation || [],
      acceptedInsurance: provider.acceptedInsurance || [],
      languages: provider.languages || [],
      preferredAppointmentTime: provider.preferredAppointmentTime || '',
      typicalWaitTime: provider.typicalWaitTime || '',
      isPrimary: provider.isPrimary || false,
      relationshipStart: provider.relationshipStart ? 
        (provider.relationshipStart instanceof Date ? 
          provider.relationshipStart.toISOString().split('T')[0] : 
          new Date(provider.relationshipStart).toISOString().split('T')[0]) : '',
      lastVisit: provider.lastVisit ? 
        (provider.lastVisit instanceof Date ? 
          provider.lastVisit.toISOString().split('T')[0] : 
          new Date(provider.lastVisit).toISOString().split('T')[0]) : '',
      nextAppointment: provider.nextAppointment ? 
        (provider.nextAppointment instanceof Date ? 
          provider.nextAppointment.toISOString().split('T')[0] : 
          new Date(provider.nextAppointment).toISOString().split('T')[0]) : '',
      notes: provider.notes || ''
    });
    setEditingProviderId(provider.id);
    setIsAddingProvider(true);
  };

  const handleProviderCancel = () => {
    setIsAddingProvider(false);
    setEditingProviderId(null);
    setProviderFormData(initialProviderFormData);
    setValidationErrors({});
  };

  const handleFacilityCancel = () => {
    setIsAddingFacility(false);
    setEditingFacilityId(null);
    setFacilityFormData(initialFacilityFormData);
    setValidationErrors({});
  };

  const handleProviderDelete = async (providerId: string) => {
    if (window.confirm('Are you sure you want to delete this healthcare provider?')) {
      try {
        await onDeleteProvider(providerId);
      } catch (error) {
        console.error('Error deleting provider:', error);
      }
    }
  };

  const handleFacilityDelete = async (facilityId: string) => {
    if (window.confirm('Are you sure you want to delete this medical facility?')) {
      try {
        await onDeleteFacility(facilityId);
      } catch (error) {
        console.error('Error deleting facility:', error);
      }
    }
  };

  const activeProviders = providers.filter(p => p.isActive);
  const activeFacilities = facilities.filter(f => f.isActive);
  const primaryProvider = activeProviders.find(p => p.isPrimary);
  
  console.log('🔍 Primary provider search:', {
    totalProviders: providers.length,
    activeProviders: activeProviders.length,
    primaryProvider: primaryProvider ? {
      id: primaryProvider.id,
      name: primaryProvider.name,
      isPrimary: primaryProvider.isPrimary
    } : null,
    allProvidersPrimaryStatus: activeProviders.map(p => ({
      id: p.id,
      name: p.name,
      isPrimary: p.isPrimary
    }))
  });

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'providers'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Stethoscope className="w-4 h-4 inline mr-2" />
            Healthcare Providers ({activeProviders.length})
          </button>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'facilities'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Medical Facilities ({activeFacilities.length})
          </button>
        </div>

        {!isAddingProvider && !isAddingFacility && (
          <button
            onClick={() => {
              if (activeTab === 'providers') {
                setIsAddingProvider(true);
              } else {
                setIsAddingFacility(true);
              }
            }}
            className="btn-primary flex items-center justify-center space-x-2 text-sm md:text-base px-3 py-2 md:px-4 md:py-2 min-h-[44px] w-auto"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap">
              Add {activeTab === 'providers' ? 'Provider' : 'Facility'}
            </span>
          </button>
        )}
      </div>

      {/* Primary Care Provider Alert */}
      {activeTab === 'providers' && !primaryProvider && activeProviders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">No Primary Care Provider</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Consider designating one of your providers as your primary care physician for better care coordination.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Providers Tab Content */}
      {activeTab === 'providers' && (
        <>
          {/* Add/Edit Provider Form */}
          {isAddingProvider && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-medium text-gray-900">
                  {editingProviderId ? 'Edit Healthcare Provider' : 'Add New Healthcare Provider'}
                </h4>
                <button
                  onClick={handleProviderCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Provider Search */}
              {!editingProviderId && (
                <div className="mb-6">
                  <label className="label">Search for Healthcare Provider</label>
                  <HealthcareProviderSearch
                    onSelect={handleProviderSelect}
                    selectedProviders={providers.map(p => p.placeId).filter(Boolean) as string[]}
                    searchType="doctor"
                    placeholder="Search for doctors, clinics, or medical practices..."
                  />
                </div>
              )}

              <form onSubmit={handleProviderSubmit} className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Basic Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Provider Name *</label>
                      <input
                        type="text"
                        value={providerFormData.name}
                        onChange={(e) => handleProviderInputChange('name', e.target.value)}
                        className={`input ${validationErrors.name ? 'border-red-300' : ''}`}
                        required
                        placeholder="Dr. John Smith"
                      />
                      {validationErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">Specialty *</label>
                      <select
                        value={providerFormData.specialty}
                        onChange={(e) => handleProviderInputChange('specialty', e.target.value)}
                        className={`input ${validationErrors.specialty ? 'border-red-300' : ''}`}
                        required
                      >
                        <option value="">Select specialty</option>
                        {MEDICAL_SPECIALTIES.map(specialty => (
                          <option key={specialty} value={specialty}>
                            {specialty}
                          </option>
                        ))}
                      </select>
                      {validationErrors.specialty && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.specialty}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">Sub-Specialty</label>
                      <input
                        type="text"
                        value={providerFormData.subSpecialty}
                        onChange={(e) => handleProviderInputChange('subSpecialty', e.target.value)}
                        className="input"
                        placeholder="e.g., Interventional Cardiology"
                      />
                    </div>

                    <div>
                      <label className="label">Credentials</label>
                      <input
                        type="text"
                        value={providerFormData.credentials}
                        onChange={(e) => handleProviderInputChange('credentials', e.target.value)}
                        className="input"
                        placeholder="MD, DO, NP, PA, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Contact Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Phone Number</label>
                      <input
                        type="tel"
                        value={providerFormData.phoneNumber}
                        onChange={(e) => handleProviderInputChange('phoneNumber', e.target.value)}
                        className="input"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="label">Email</label>
                      <input
                        type="email"
                        value={providerFormData.email}
                        onChange={(e) => handleProviderInputChange('email', e.target.value)}
                        className="input"
                        placeholder="doctor@clinic.com"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">Website</label>
                      <input
                        type="url"
                        value={providerFormData.website}
                        onChange={(e) => handleProviderInputChange('website', e.target.value)}
                        className="input"
                        placeholder="https://www.clinic.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Address</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="label">Address *</label>
                      <input
                        type="text"
                        value={providerFormData.address}
                        onChange={(e) => handleProviderInputChange('address', e.target.value)}
                        className={`input ${validationErrors.address ? 'border-red-300' : ''}`}
                        required
                        placeholder="123 Medical Center Dr"
                      />
                      {validationErrors.address && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.address}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">City</label>
                      <input
                        type="text"
                        value={providerFormData.city}
                        onChange={(e) => handleProviderInputChange('city', e.target.value)}
                        className="input"
                        placeholder="City"
                      />
                    </div>

                    <div>
                      <label className="label">State</label>
                      <input
                        type="text"
                        value={providerFormData.state}
                        onChange={(e) => handleProviderInputChange('state', e.target.value)}
                        className="input"
                        placeholder="State"
                      />
                    </div>

                    <div>
                      <label className="label">ZIP Code</label>
                      <input
                        type="text"
                        value={providerFormData.zipCode}
                        onChange={(e) => handleProviderInputChange('zipCode', e.target.value)}
                        className="input"
                        placeholder="12345"
                      />
                    </div>

                    <div>
                      <label className="label">Country</label>
                      <input
                        type="text"
                        value={providerFormData.country}
                        onChange={(e) => handleProviderInputChange('country', e.target.value)}
                        className="input"
                        placeholder="United States"
                      />
                    </div>
                  </div>
                </div>

                {/* Practice Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Practice Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Practice Name</label>
                      <input
                        type="text"
                        value={providerFormData.practiceName}
                        onChange={(e) => handleProviderInputChange('practiceName', e.target.value)}
                        className="input"
                        placeholder="Medical Associates"
                      />
                    </div>

                    <div>
                      <label className="label">Typical Wait Time</label>
                      <select
                        value={providerFormData.typicalWaitTime}
                        onChange={(e) => handleProviderInputChange('typicalWaitTime', e.target.value)}
                        className="input"
                      >
                        <option value="">Select wait time</option>
                        <option value="Same day">Same day</option>
                        <option value="1-3 days">1-3 days</option>
                        <option value="1 week">1 week</option>
                        <option value="2-3 weeks">2-3 weeks</option>
                        <option value="1 month">1 month</option>
                        <option value="2+ months">2+ months</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Preferred Appointment Time</label>
                      <select
                        value={providerFormData.preferredAppointmentTime}
                        onChange={(e) => handleProviderInputChange('preferredAppointmentTime', e.target.value)}
                        className="input"
                      >
                        <option value="">No preference</option>
                        <option value="Morning">Morning</option>
                        <option value="Afternoon">Afternoon</option>
                        <option value="Evening">Evening</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Relationship Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Relationship Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Relationship Start</label>
                      <input
                        type="date"
                        value={providerFormData.relationshipStart}
                        onChange={(e) => handleProviderInputChange('relationshipStart', e.target.value)}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="label">Last Visit</label>
                      <input
                        type="date"
                        value={providerFormData.lastVisit}
                        onChange={(e) => handleProviderInputChange('lastVisit', e.target.value)}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="label">Next Appointment</label>
                      <input
                        type="date"
                        value={providerFormData.nextAppointment}
                        onChange={(e) => handleProviderInputChange('nextAppointment', e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-4">
                    <input
                      type="checkbox"
                      id="isPrimary"
                      checked={providerFormData.isPrimary}
                      onChange={(e) => handleProviderInputChange('isPrimary', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="isPrimary" className="text-sm text-gray-700">
                      This is my primary care provider
                    </label>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={providerFormData.notes}
                    onChange={(e) => handleProviderInputChange('notes', e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Additional notes about this provider..."
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleProviderCancel}
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
                        <span>{editingProviderId ? 'Update' : 'Add'} Provider</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Providers List */}
          {activeProviders.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Your Healthcare Providers</h4>
              <div className="space-y-4">
                {activeProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex-shrink-0">
                            <Stethoscope className="w-6 h-6 text-primary-600" />
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900 flex items-center space-x-2">
                              <span>{provider.name}</span>
                              {provider.credentials && (
                                <span className="text-sm text-gray-500">({provider.credentials})</span>
                              )}
                              {provider.isPrimary && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                                  Primary
                                </span>
                              )}
                            </h5>
                            <p className="text-sm text-gray-600">
                              {provider.specialty}
                              {provider.subSpecialty && ` • ${provider.subSpecialty}`}
                            </p>
                            {provider.practiceName && (
                              <p className="text-sm text-gray-500">{provider.practiceName}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-2">
                            {provider.address && (
                              <div className="flex items-start space-x-2">
                                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{provider.address}</span>
                              </div>
                            )}
                            {provider.phoneNumber && (
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                <span>{provider.phoneNumber}</span>
                              </div>
                            )}
                            {provider.website && (
                              <div className="flex items-center space-x-2">
                                <Globe className="w-4 h-4 flex-shrink-0" />
                                <a
                                  href={provider.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700"
                                >
                                  Visit Website
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            {provider.typicalWaitTime && (
                              <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 flex-shrink-0" />
                                <span>Wait time: {provider.typicalWaitTime}</span>
                              </div>
                            )}
                            {provider.nextAppointment && (
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 flex-shrink-0" />
                                <span>
                                  Next: {new Date(provider.nextAppointment).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {provider.googleRating && (
                              <div className="flex items-center space-x-2">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span>{provider.googleRating}/5</span>
                                {provider.googleReviews && (
                                  <span className="text-gray-500">({provider.googleReviews} reviews)</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {provider.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-700">{provider.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleProviderEdit(provider)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit provider"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleProviderDelete(provider.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete provider"
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

          {/* Empty State for Providers */}
          {activeProviders.length === 0 && !isAddingProvider && (
            <div className="text-center py-12">
              <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No healthcare providers added</h4>
              <p className="text-gray-500 mb-6">
                Add your doctors and healthcare providers to keep track of your care team.
              </p>
              <button
                onClick={() => setIsAddingProvider(true)}
                className="btn-primary flex items-center justify-center space-x-2 mx-auto text-sm md:text-base px-3 py-2 md:px-4 md:py-2 min-h-[44px]"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="whitespace-nowrap">Add Your First Provider</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Facilities Tab Content */}
      {activeTab === 'facilities' && (
        <>
          {/* Add/Edit Facility Form */}
          {isAddingFacility && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-medium text-gray-900">
                  {editingFacilityId ? 'Edit Medical Facility' : 'Add New Medical Facility'}
                </h4>
                <button
                  onClick={handleFacilityCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Facility Search */}
              {!editingFacilityId && (
                <div className="mb-6">
                  <label className="label">Search for Medical Facility</label>
                  <HealthcareProviderSearch
                    onSelect={(place, type) => handleFacilitySelect(place, type)}
                    selectedProviders={facilities.map(f => f.placeId).filter(Boolean) as string[]}
                    searchType="hospital"
                    placeholder="Search for hospitals, imaging centers, labs..."
                  />
                </div>
              )}

              <form onSubmit={handleFacilitySubmit} className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Basic Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Facility Name *</label>
                      <input
                        type="text"
                        value={facilityFormData.name}
                        onChange={(e) => handleFacilityInputChange('name', e.target.value)}
                        className={`input ${validationErrors.name ? 'border-red-300' : ''}`}
                        required
                        placeholder="General Hospital"
                      />
                      {validationErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">Facility Type *</label>
                      <select
                        value={facilityFormData.facilityType}
                        onChange={(e) => handleFacilityInputChange('facilityType', e.target.value)}
                        className={`input ${validationErrors.facilityType ? 'border-red-300' : ''}`}
                        required
                      >
                        <option value="">Select facility type</option>
                        {FACILITY_TYPES.map(type => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                      {validationErrors.facilityType && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.facilityType}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Contact Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Phone Number</label>
                      <input
                        type="tel"
                        value={facilityFormData.phoneNumber}
                        onChange={(e) => handleFacilityInputChange('phoneNumber', e.target.value)}
                        className="input"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="label">Email</label>
                      <input
                        type="email"
                        value={facilityFormData.email}
                        onChange={(e) => handleFacilityInputChange('email', e.target.value)}
                        className="input"
                        placeholder="info@hospital.com"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">Website</label>
                      <input
                        type="url"
                        value={facilityFormData.website}
                        onChange={(e) => handleFacilityInputChange('website', e.target.value)}
                        className="input"
                        placeholder="https://www.hospital.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Address</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="label">Address *</label>
                      <input
                        type="text"
                        value={facilityFormData.address}
                        onChange={(e) => handleFacilityInputChange('address', e.target.value)}
                        className={`input ${validationErrors.address ? 'border-red-300' : ''}`}
                        required
                        placeholder="123 Hospital Dr"
                      />
                      {validationErrors.address && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.address}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">City</label>
                      <input
                        type="text"
                        value={facilityFormData.city}
                        onChange={(e) => handleFacilityInputChange('city', e.target.value)}
                        className="input"
                        placeholder="City"
                      />
                    </div>

                    <div>
                      <label className="label">State</label>
                      <input
                        type="text"
                        value={facilityFormData.state}
                        onChange={(e) => handleFacilityInputChange('state', e.target.value)}
                        className="input"
                        placeholder="State"
                      />
                    </div>

                    <div>
                      <label className="label">ZIP Code</label>
                      <input
                        type="text"
                        value={facilityFormData.zipCode}
                        onChange={(e) => handleFacilityInputChange('zipCode', e.target.value)}
                        className="input"
                        placeholder="12345"
                      />
                    </div>

                    <div>
                      <label className="label">Country</label>
                      <input
                        type="text"
                        value={facilityFormData.country}
                        onChange={(e) => handleFacilityInputChange('country', e.target.value)}
                        className="input"
                        placeholder="United States"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <h5 className="text-md font-medium text-gray-900 mb-4">Preferences</h5>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isPreferred"
                        checked={facilityFormData.isPreferred}
                        onChange={(e) => handleFacilityInputChange('isPreferred', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="isPreferred" className="text-sm text-gray-700">
                        This is a preferred facility
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="emergencyServices"
                        checked={facilityFormData.emergencyServices}
                        onChange={(e) => handleFacilityInputChange('emergencyServices', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="emergencyServices" className="text-sm text-gray-700">
                        Has emergency services
                      </label>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={facilityFormData.notes}
                    onChange={(e) => handleFacilityInputChange('notes', e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Additional notes about this facility..."
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleFacilityCancel}
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
                        <span>{editingFacilityId ? 'Update' : 'Add'} Facility</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Facilities List */}
          {activeFacilities.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Your Medical Facilities</h4>
              <div className="space-y-4">
                {activeFacilities.map((facility) => (
                  <div
                    key={facility.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex-shrink-0">
                            <Building2 className="w-6 h-6 text-primary-600" />
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900 flex items-center space-x-2">
                              <span>{facility.name}</span>
                              {facility.isPreferred && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Preferred
                                </span>
                              )}
                              {facility.emergencyServices && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Emergency
                                </span>
                              )}
                            </h5>
                            <p className="text-sm text-gray-600">
                              {facility.facilityType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-2">
                            {facility.address && (
                              <div className="flex items-start space-x-2">
                                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{facility.address}</span>
                              </div>
                            )}
                            {facility.phoneNumber && (
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                <span>{facility.phoneNumber}</span>
                              </div>
                            )}
                            {facility.website && (
                              <div className="flex items-center space-x-2">
                                <Globe className="w-4 h-4 flex-shrink-0" />
                                <a
                                  href={facility.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700"
                                >
                                  Visit Website
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            {facility.googleRating && (
                              <div className="flex items-center space-x-2">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span>{facility.googleRating}/5</span>
                                {facility.googleReviews && (
                                  <span className="text-gray-500">({facility.googleReviews} reviews)</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {facility.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-700">{facility.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => {
                            // Handle facility edit - similar to provider edit
                            setFacilityFormData({
                              name: facility.name,
                              facilityType: facility.facilityType,
                              phoneNumber: facility.phoneNumber || '',
                              email: facility.email || '',
                              website: facility.website || '',
                              address: facility.address,
                              city: facility.city || '',
                              state: facility.state || '',
                              zipCode: facility.zipCode || '',
                              country: facility.country || '',
                              placeId: facility.placeId || '',
                              googleRating: facility.googleRating || null,
                              googleReviews: facility.googleReviews || null,
                              businessStatus: facility.businessStatus || '',
                              services: facility.services || [],
                              acceptedInsurance: facility.acceptedInsurance || [],
                              emergencyServices: facility.emergencyServices || false,
                              isPreferred: facility.isPreferred || false,
                              notes: facility.notes || ''
                            });
                            setEditingFacilityId(facility.id);
                            setIsAddingFacility(true);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit facility"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFacilityDelete(facility.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete facility"
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

          {/* Empty State for Facilities */}
          {activeFacilities.length === 0 && !isAddingFacility && (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No medical facilities added</h4>
              <p className="text-gray-500 mb-6">
                Add hospitals, imaging centers, and other medical facilities you visit.
              </p>
              <button
                onClick={() => setIsAddingFacility(true)}
                className="btn-primary flex items-center justify-center space-x-2 mx-auto text-sm md:text-base px-3 py-2 md:px-4 md:py-2 min-h-[44px]"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="whitespace-nowrap">Add Your First Facility</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
                        