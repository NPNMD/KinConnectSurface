import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Heart,
  ArrowLeft,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  User,
  Users,
  Calendar,
  Pill,
  Settings
} from 'lucide-react';
import {
  HealthcareProvider,
  NewHealthcareProvider,
  MedicalFacility,
  NewMedicalFacility
} from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import MedicalConditionSelect from '@/components/MedicalConditionSelect';
import AllergySelect from '@/components/AllergySelect';
import HealthcareProvidersManager from '@/components/HealthcareProvidersManager';

export default function PatientProfile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [healthcareProviders, setHealthcareProviders] = useState<HealthcareProvider[]>([]);
  const [medicalFacilities, setMedicalFacilities] = useState<MedicalFacility[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    gender: '',
    address: '',
    phoneNumber: '',
    emergencyContact: '',
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
      // Prepare the data for the API
      const profileData = {
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        address: formData.address || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        emergencyContact: formData.emergencyContact || undefined,
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
        
        // Update form data with the saved data to ensure consistency
        if (response.data) {
          const savedData = response.data;
          setFormData({
            dateOfBirth: savedData.dateOfBirth || '',
            gender: savedData.gender || '',
            address: savedData.address || '',
            phoneNumber: savedData.phoneNumber || '',
            emergencyContact: savedData.emergencyContact || '',
            medicalConditions: savedData.medicalConditions && savedData.medicalConditions.length > 0 ? savedData.medicalConditions : [''],
            allergies: savedData.allergies && savedData.allergies.length > 0 ? savedData.allergies : [''],
          });
        }
      } else {
        throw new Error(response.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values
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
          setFormData({
            dateOfBirth: profileData.dateOfBirth || '',
            gender: profileData.gender || '',
            address: profileData.address || '',
            phoneNumber: profileData.phoneNumber || '',
            emergencyContact: profileData.emergencyContact || '',
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

    if (user?.id) {
      loadProfileData();
      loadHealthcareProviders();
      loadMedicalFacilities();
    }
  }, [user?.id]);


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
        setHealthcareProviders(prev =>
          prev.map(provider =>
            provider.id === id ? response.data : provider
          )
        );
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-First Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-2">
                <User className="w-6 h-6 text-primary-600" />
                <span className="text-lg font-bold text-gray-900">Profile</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSave}
                    className="p-2 text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 pb-20">
        {/* Profile Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                {user?.name || 'Patient Profile'}
              </h1>
              <p className="text-gray-600 text-sm mb-1">{user?.email}</p>
              <p className="text-xs text-gray-500">
                {user?.userType?.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
          
          <div className="space-y-4">
            {/* Date of Birth */}
            <div>
              <label className="label">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                disabled={!isEditing}
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
            <div>
              <label className="label">Emergency Contact</label>
              <input
                type="text"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                disabled={!isEditing}
                className="input disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Name and phone number"
              />
            </div>
          </div>

          {/* Medical Conditions */}
          <div className="mt-6">
            <label className="label">Medical Conditions</label>
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
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Condition</span>
                </button>
              )}
            </div>
          </div>

          {/* Allergies */}
          <div className="mt-6">
            <label className="label">Allergies</label>
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
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Allergy</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Healthcare Providers Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
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

      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-around">
          <Link
            to="/dashboard"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pill className="w-5 h-5" />
            <span className="text-xs">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex flex-col items-center space-y-1 p-2 text-primary-600"
          >
            <User className="w-5 h-5" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Family</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
