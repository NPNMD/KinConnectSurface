import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import {
  Heart,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  User,
  CreditCard,
  Building2,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';
import { PermissionGate } from '@/components/PermissionGate';
import {
  HealthcareProvider,
  NewHealthcareProvider,
  MedicalFacility,
  NewMedicalFacility,
  InsuranceInformation,
  NewInsuranceInformation,
  GooglePlaceResult
} from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { googlePlacesApi } from '@/lib/googlePlacesApi';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import MedicalConditionSelect from '@/components/MedicalConditionSelect';
import AllergySelect from '@/components/AllergySelect';
import HealthcareProvidersManager from '@/components/HealthcareProvidersManager';
import InsuranceCardViewer from '@/components/insurance/InsuranceCardViewer';
import InsuranceFormModal from '@/components/insurance/InsuranceFormModal';
import PharmacyAutocomplete from '@/components/PharmacyAutocomplete';
import { showSuccess, showError } from '@/utils/toast';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

export default function PatientProfile() {
  const { user } = useAuth();
  const { hasPermission } = useFamily();
  const [isEditing, setIsEditing] = useState(false);
  const [healthcareProviders, setHealthcareProviders] = useState<HealthcareProvider[]>([]);
  const [medicalFacilities, setMedicalFacilities] = useState<MedicalFacility[]>([]);
  const [insuranceCards, setInsuranceCards] = useState<InsuranceInformation[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isLoadingInsurance, setIsLoadingInsurance] = useState(false);
  const [isAddingInsurance, setIsAddingInsurance] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<InsuranceInformation | null>(null);
  const [preferredPharmacy, setPreferredPharmacy] = useState<MedicalFacility | null>(null);
  const [isChangingPharmacy, setIsChangingPharmacy] = useState(false);
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    gender: '',
    address: '',
    phoneNumber: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    medicalConditions: [''],
    allergies: [''],
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayChange = (field: 'medicalConditions' | 'allergies', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayItem = (field: 'medicalConditions' | 'allergies') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (field: 'medicalConditions' | 'allergies', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    try {
      // Combine emergency contact fields into a single string for backend
      const emergencyContactString = formData.emergencyContactName && formData.emergencyContactPhone
        ? `${formData.emergencyContactName} (${formData.emergencyContactRelationship || 'Not specified'}) - ${formData.emergencyContactPhone}`
        : '';

      // Prepare the data for the API
      const profileData = {
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        address: formData.address || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        emergencyContact: emergencyContactString || undefined,
        medicalConditions: formData.medicalConditions.filter(condition => condition.trim() !== ''),
        allergies: formData.allergies.filter(allergy => allergy.trim() !== ''),
      };

      // Use PUT request - backend handles both create and update
      const response = await apiClient.put<{ success: boolean; data: any; error?: string }>(
        API_ENDPOINTS.PATIENT_PROFILE,
        profileData
      );
      
      if (response.success) {
        setIsEditing(false);
        showSuccess('Profile saved successfully!');
        
        // Update form data with the saved data to ensure consistency
        if (response.data) {
          const savedData = response.data;
          
          // Parse emergency contact back into separate fields
          let emergencyContactName = '';
          let emergencyContactRelationship = '';
          let emergencyContactPhone = '';
          
          if (savedData.emergencyContact) {
            const match = savedData.emergencyContact.match(/^(.+?)\s*\((.+?)\)\s*-\s*(.+)$/);
            if (match) {
              emergencyContactName = match[1].trim();
              emergencyContactRelationship = match[2].trim();
              emergencyContactPhone = match[3].trim();
            }
          }
          
          setFormData({
            dateOfBirth: savedData.dateOfBirth || '',
            gender: savedData.gender || '',
            address: savedData.address || '',
            phoneNumber: savedData.phoneNumber || '',
            emergencyContactName,
            emergencyContactRelationship,
            emergencyContactPhone,
            medicalConditions: savedData.medicalConditions && savedData.medicalConditions.length > 0 ? savedData.medicalConditions : [''],
            allergies: savedData.allergies && savedData.allergies.length > 0 ? savedData.allergies : [''],
          });
        }
      } else {
        throw new Error(response.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showError('Failed to save profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values could be implemented by re-fetching or saving initial state
    // For now, simpler to just exit edit mode
  };

  // Load profile data and medications on component mount
  React.useEffect(() => {
    const loadProfileData = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: any }>(
          API_ENDPOINTS.PATIENT_PROFILE
        );
        
        if (response.success && response.data) {
          const profileData = response.data;
          
          // Parse emergency contact into separate fields
          let emergencyContactName = '';
          let emergencyContactRelationship = '';
          let emergencyContactPhone = '';
          
          if (profileData.emergencyContact) {
            const match = profileData.emergencyContact.match(/^(.+?)\s*\((.+?)\)\s*-\s*(.+)$/);
            if (match) {
              emergencyContactName = match[1].trim();
              emergencyContactRelationship = match[2].trim();
              emergencyContactPhone = match[3].trim();
            }
          }
          
          setFormData({
            dateOfBirth: profileData.dateOfBirth || '',
            gender: profileData.gender || '',
            address: profileData.address || '',
            phoneNumber: profileData.phoneNumber || '',
            emergencyContactName,
            emergencyContactRelationship,
            emergencyContactPhone,
            medicalConditions: profileData.medicalConditions?.length > 0 ? profileData.medicalConditions : [''],
            allergies: profileData.allergies?.length > 0 ? profileData.allergies : [''],
          });
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      }
    };

    const loadHealthcareProviders = async () => {
      try {
        setIsLoadingProviders(true);
        const response = await apiClient.get<{ success: boolean; data: HealthcareProvider[] }>(
          API_ENDPOINTS.HEALTHCARE_PROVIDERS(user?.id || '')
        );
        
        if (response.success && response.data) {
          setHealthcareProviders(response.data);
        }
      } catch (error) {
        console.error('Error loading healthcare providers:', error);
      } finally {
        setIsLoadingProviders(false);
      }
    };

    const loadMedicalFacilities = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: MedicalFacility[] }>(
          API_ENDPOINTS.MEDICAL_FACILITIES(user?.id || '')
        );
        
        if (response.success && response.data) {
          setMedicalFacilities(response.data);
        }
      } catch (error) {
        console.error('Error loading medical facilities:', error);
      }
    };

    const loadInsuranceCards = async () => {
      try {
        setIsLoadingInsurance(true);
        const response = await apiClient.get<{ success: boolean; data: InsuranceInformation[] }>(
          API_ENDPOINTS.INSURANCE_LIST(user?.id || '')
        );
        
        if (response.success && response.data) {
          setInsuranceCards(response.data);
        }
      } catch (error) {
        console.error('Error loading insurance cards:', error);
      } finally {
        setIsLoadingInsurance(false);
      }
    };

    const loadPreferredPharmacy = async () => {
      try {
        // Get patient profile to find preferredPharmacyId
        const profileResponse = await apiClient.get<{ success: boolean; data: any }>(
          API_ENDPOINTS.PATIENT_PROFILE
        );
        
        if (profileResponse.success && profileResponse.data?.preferredPharmacyId) {
          try {
            // Load the pharmacy facility
            const pharmacyResponse = await apiClient.get<{ success: boolean; data: MedicalFacility }>(
              API_ENDPOINTS.MEDICAL_FACILITY_BY_ID(profileResponse.data.preferredPharmacyId)
            );
            
            if (pharmacyResponse.success && pharmacyResponse.data) {
              setPreferredPharmacy(pharmacyResponse.data);
            }
          } catch (pharmacyError) {
            console.warn('Failed to load preferred pharmacy details (likely due to access permissions):', pharmacyError);
            // If we can't access it, maybe we should clear the preference or just fail gracefully?
            // For now, we'll just not show it in the UI, which avoids the error.
            // We could also try to clear the invalid ID from the profile if we were sure it was invalid.
          }
        }
      } catch (error) {
        console.error('Error loading preferred pharmacy:', error);
      }
    };

    if (user?.id) {
      loadProfileData();
      loadHealthcareProviders();
      loadMedicalFacilities();
      loadInsuranceCards();
      loadPreferredPharmacy();
    }
  }, [user?.id]);

  // Extract loadHealthcareProviders as a standalone function for reuse
  const loadHealthcareProviders = async () => {
    try {
      setIsLoadingProviders(true);
      const response = await apiClient.get<{ success: boolean; data: HealthcareProvider[] }>(
        API_ENDPOINTS.HEALTHCARE_PROVIDERS(user?.id || '')
      );
      
      if (response.success && response.data) {
        setHealthcareProviders(response.data);
      }
    } catch (error) {
      console.error('Error loading healthcare providers:', error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  // Healthcare Provider management functions
  const handleAddProvider = async (provider: NewHealthcareProvider) => {
    try {
      setIsLoadingProviders(true);
      const response = await apiClient.post<{ success: boolean; data: HealthcareProvider }>(
        API_ENDPOINTS.HEALTHCARE_PROVIDER_CREATE,
        provider
      );
      
      if (response.success && response.data) {
        setHealthcareProviders(prev => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Error adding healthcare provider:', error);
      throw error;
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleUpdateProvider = async (id: string, updates: Partial<HealthcareProvider>) => {
    try {
      setIsLoadingProviders(true);
      const response = await apiClient.put<{ success: boolean; data: HealthcareProvider }>(
        API_ENDPOINTS.HEALTHCARE_PROVIDER_BY_ID(id),
        updates
      );
      
      if (response.success && response.data) {
        if (updates.isPrimary !== undefined) {
          await loadHealthcareProviders(); // Force complete refresh for PCP changes
        } else {
          setHealthcareProviders(prev =>
            prev.map(provider =>
              provider.id === id ? response.data : provider
            )
          );
        }
      }
    } catch (error) {
      console.error('Error updating healthcare provider:', error);
      throw error;
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      setIsLoadingProviders(true);
      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.HEALTHCARE_PROVIDER_BY_ID(id)
      );
      
      if (response.success) {
        setHealthcareProviders(prev => prev.filter(provider => provider.id !== id));
      }
    } catch (error) {
      console.error('Error deleting healthcare provider:', error);
      throw error;
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleAddFacility = async (facility: NewMedicalFacility) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: MedicalFacility }>(
        API_ENDPOINTS.MEDICAL_FACILITY_CREATE,
        facility
      );
      
      if (response.success && response.data) {
        setMedicalFacilities(prev => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Error adding medical facility:', error);
      throw error;
    }
  };

  const handleUpdateFacility = async (id: string, updates: Partial<MedicalFacility>) => {
    try {
      const response = await apiClient.put<{ success: boolean; data: MedicalFacility }>(
        API_ENDPOINTS.MEDICAL_FACILITY_BY_ID(id),
        updates
      );
      
      if (response.success && response.data) {
        setMedicalFacilities(prev =>
          prev.map(facility =>
            facility.id === id ? response.data : facility
          )
        );
      }
    } catch (error) {
      console.error('Error updating medical facility:', error);
      throw error;
    }
  };

  const handleDeleteFacility = async (id: string) => {
    try {
      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.MEDICAL_FACILITY_BY_ID(id)
      );
      
      if (response.success) {
        setMedicalFacilities(prev => prev.filter(facility => facility.id !== id));
      }
    } catch (error) {
      console.error('Error deleting medical facility:', error);
      throw error;
    }
  };

  // Insurance management functions
  const handleSaveInsurance = async (insuranceData: NewInsuranceInformation | Partial<InsuranceInformation>) => {
    try {
      setIsLoadingInsurance(true);
      
      if (editingInsurance) {
        // Update existing insurance
        const response = await apiClient.put<{ success: boolean; data: InsuranceInformation }>(
          API_ENDPOINTS.INSURANCE_UPDATE(editingInsurance.id),
          insuranceData
        );
        
        if (response.success && response.data) {
          setInsuranceCards(prev =>
            prev.map(insurance =>
              insurance.id === editingInsurance.id ? response.data : insurance
            )
          );
          setEditingInsurance(null);
          setIsAddingInsurance(false);
        }
      } else {
        // Create new insurance
        const response = await apiClient.post<{ success: boolean; data: InsuranceInformation }>(
          API_ENDPOINTS.INSURANCE_CREATE,
          insuranceData
        );
        
        if (response.success && response.data) {
          setInsuranceCards(prev => [...prev, response.data]);
          setIsAddingInsurance(false);
        }
      }
    } catch (error) {
      console.error('Error saving insurance:', error);
      throw error;
    } finally {
      setIsLoadingInsurance(false);
    }
  };

  const handleDeleteInsurance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this insurance information?')) {
      return;
    }
    
    try {
      setIsLoadingInsurance(true);
      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.INSURANCE_DELETE(id)
      );
      
      if (response.success) {
        setInsuranceCards(prev => prev.filter(insurance => insurance.id !== id));
      }
    } catch (error) {
      console.error('Error deleting insurance:', error);
      throw error;
    } finally {
      setIsLoadingInsurance(false);
    }
  };

  const handleEditInsurance = (insurance: InsuranceInformation) => {
    setEditingInsurance(insurance);
    setIsAddingInsurance(true);
  };

  // Pharmacy selection handler
  const handlePharmacySelect = async (place: GooglePlaceResult) => {
    try {
      const addressComponents = googlePlacesApi.extractAddressComponents(place.address_components);
      
      // Create or update pharmacy as MedicalFacility
      const pharmacyData: NewMedicalFacility = {
        patientId: user?.id || '',
        name: place.name,
        facilityType: 'pharmacy',
        phoneNumber: place.formatted_phone_number || undefined,
        website: place.website || undefined,
        address: place.formatted_address,
        city: addressComponents.city || undefined,
        state: addressComponents.state || undefined,
        zipCode: addressComponents.zipCode || undefined,
        country: addressComponents.country || undefined,
        placeId: place.place_id,
        googleRating: place.rating || undefined,
        googleReviews: place.user_ratings_total || undefined,
        businessStatus: place.business_status || undefined,
        isPreferred: true,
        isActive: true
      };

      // Check if pharmacy already exists
      const existingPharmacy = medicalFacilities.find(
        f => f.placeId === place.place_id && f.facilityType === 'pharmacy'
      );

      let pharmacyId: string;
      let usedExisting = false;

      if (existingPharmacy) {
        try {
          // Update existing pharmacy to mark as preferred
          await handleUpdateFacility(existingPharmacy.id, { isPreferred: true });
          pharmacyId = existingPharmacy.id;
          usedExisting = true;
        } catch (error) {
          console.warn('Failed to update existing pharmacy, creating new one instead:', error);
          // Fall through to creation logic - reset existingPharmacy check to allow creation
        }
      }

      if (!usedExisting) {
        // Create new pharmacy facility
        // Ensure we don't send an ID so backend knows it's a new record
        const pharmacyToCreate = {
            ...pharmacyData,
            // Add timestamp to name if needed to ensure uniqueness if backend enforces it, 
            // though facilityType='pharmacy' usually allows duplicates per user
        };

        const response = await apiClient.post<{ success: boolean; data: MedicalFacility }>(
          API_ENDPOINTS.MEDICAL_FACILITY_CREATE,
          pharmacyToCreate
        );
        
        if (response.success && response.data) {
          setMedicalFacilities(prev => [...prev, response.data]);
          pharmacyId = response.data.id;
        } else {
          throw new Error('Failed to create pharmacy');
        }
      }

      // Update patient profile with preferredPharmacyId
      await apiClient.put(API_ENDPOINTS.PATIENT_PROFILE, {
        preferredPharmacyId: pharmacyId
      });

      // Reload preferred pharmacy
      const pharmacyResponse = await apiClient.get<{ success: boolean; data: MedicalFacility }>(
        API_ENDPOINTS.MEDICAL_FACILITY_BY_ID(pharmacyId)
      );
      
      if (pharmacyResponse.success && pharmacyResponse.data) {
        setPreferredPharmacy(pharmacyResponse.data);
      }

      setIsChangingPharmacy(false);
      showSuccess('Preferred pharmacy updated!');
    } catch (error) {
      console.error('Error selecting pharmacy:', error);
      showError('Failed to set preferred pharmacy. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Enhanced Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-20">
        
        {/* Page Title Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-8 h-8 text-primary-600" />
            Patient Profile
          </h1>
          <p className="text-gray-600 mt-1">
            Manage personal information, insurance, and care team
          </p>
        </div>

        {/* Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (Main Info) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Profile Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <Heart className="w-8 h-8 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 mb-1">
                    {user?.name || 'Patient Profile'}
                  </h1>
                  <p className="text-gray-600 text-sm mb-1">{user?.email}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    {user?.userType?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                
                <PermissionGate requiredPermission="canEdit">
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-1"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-3 py-1.5 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors flex items-center space-x-1"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 border border-primary-600 rounded-md hover:bg-primary-50 transition-colors flex items-center space-x-1"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  )}
                </PermissionGate>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date of Birth */}
                  <div>
                    <label className="label">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      disabled={!isEditing || !hasPermission('canEdit')}
                      className="input disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="label">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={!isEditing}
                      className="input disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="label">Address</label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(address) => handleInputChange('address', address)}
                    disabled={!isEditing}
                    className="input disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="Enter your full address"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    disabled={!isEditing}
                    className="input disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                {/* Emergency Contact */}
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Emergency Contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="label">Name</label>
                      <input
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                        disabled={!isEditing}
                        className="input disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Contact name"
                      />
                    </div>

                    <div>
                      <label className="label">Relationship</label>
                      <select
                        value={formData.emergencyContactRelationship}
                        onChange={(e) => handleInputChange('emergencyContactRelationship', e.target.value)}
                        disabled={!isEditing}
                        className="input disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        <option value="">Select relationship</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Child">Child</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Friend">Friend</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                        disabled={!isEditing}
                        className="input disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical Conditions */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <label className="label mb-2 block">Medical Conditions</label>
                <div className="space-y-3">
                  {formData.medicalConditions.map((condition, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="flex-1">
                        <MedicalConditionSelect
                          value={condition}
                          onChange={(value) => handleArrayChange('medicalConditions', index, value)}
                          disabled={!isEditing}
                          placeholder="Select or enter medical condition"
                        />
                      </div>
                      {isEditing && formData.medicalConditions.length > 1 && (
                        <button
                          onClick={() => removeArrayItem('medicalConditions', index)}
                          className="p-2 text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <button
                      onClick={() => addArrayItem('medicalConditions')}
                      className="btn-secondary flex items-center space-x-2 text-sm px-3 py-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Condition</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Allergies */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <label className="label mb-2 block">Allergies</label>
                <div className="space-y-3">
                  {formData.allergies.map((allergy, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="flex-1">
                        <AllergySelect
                          value={allergy}
                          onChange={(value) => handleArrayChange('allergies', index, value)}
                          disabled={!isEditing}
                          placeholder="Select or enter allergy"
                        />
                      </div>
                      {isEditing && formData.allergies.length > 1 && (
                        <button
                          onClick={() => removeArrayItem('allergies', index)}
                          className="p-2 text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <button
                      onClick={() => addArrayItem('allergies')}
                      className="btn-secondary flex items-center space-x-2 text-sm px-3 py-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Allergy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Care Team & Insurance) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Healthcare Providers Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Stethoscope className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Care Team</h2>
              </div>
              <HealthcareProvidersManager
                patientId={user?.id || ''}
                providers={healthcareProviders}
                facilities={medicalFacilities}
                onAddProvider={handleAddProvider}
                onUpdateProvider={handleUpdateProvider}
                onDeleteProvider={handleDeleteProvider}
                onAddFacility={handleAddFacility}
                onUpdateFacility={handleUpdateFacility}
                onDeleteFacility={handleDeleteFacility}
                isLoading={isLoadingProviders}
              />
            </div>

            {/* Insurance Information Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Insurance</h2>
                </div>
                <PermissionGate requiredPermission="canCreate">
                  <button
                    onClick={() => setIsAddingInsurance(true)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Add Insurance"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </PermissionGate>
              </div>

              {isLoadingInsurance ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-500 mt-2">Loading insurance info...</p>
                </div>
              ) : insuranceCards.length > 0 ? (
                <div className="space-y-4">
                  {insuranceCards.map((insurance) => (
                    <InsuranceCardViewer
                      key={insurance.id}
                      insurance={insurance}
                      onEdit={() => handleEditInsurance(insurance)}
                      onDelete={() => handleDeleteInsurance(insurance.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No insurance added</p>
                </div>
              )}
            </div>

            {/* Preferred Pharmacy Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Preferred Pharmacy</h2>
              </div>
              
              {preferredPharmacy && !isChangingPharmacy ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium text-gray-900">{preferredPharmacy.name}</h3>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{preferredPharmacy.address}</span>
                        </div>
                        
                        {preferredPharmacy.phoneNumber && (
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            <span>{preferredPharmacy.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setIsChangingPharmacy(true)}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <PharmacyAutocomplete
                    onSelect={handlePharmacySelect}
                    placeholder="Search for preferred pharmacy..."
                  />
                  {preferredPharmacy && isChangingPharmacy && (
                    <button
                      onClick={() => setIsChangingPharmacy(false)}
                      className="mt-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* Insurance Form Modal */}
        {isAddingInsurance && (
          <InsuranceFormModal
            patientId={user?.id || ''}
            insurance={editingInsurance}
            onSave={handleSaveInsurance}
            onClose={() => {
              setIsAddingInsurance(false);
              setEditingInsurance(null);
            }}
          />
        )}

      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
