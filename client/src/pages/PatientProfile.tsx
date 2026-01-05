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
  Trash2
} from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import MedicationManager from '@/components/MedicationManager';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import CalendarIntegration from '@/components/CalendarIntegration';
import MedicalConditionSelect from '@/components/MedicalConditionSelect';
import AllergySelect from '@/components/AllergySelect';

export default function PatientProfile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoadingMedications, setIsLoadingMedications] = useState(false);
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

    const loadMedications = async () => {
      try {
        setIsLoadingMedications(true);
        const response = await apiClient.get<{ success: boolean; data: Medication[] }>(
          API_ENDPOINTS.MEDICATIONS
        );
        
        if (response.success && response.data) {
          // Parse date strings back to Date objects
          const medicationsWithDates = response.data.map(med => ({
            ...med,
            prescribedDate: new Date(med.prescribedDate),
            startDate: med.startDate ? new Date(med.startDate) : undefined,
            endDate: med.endDate ? new Date(med.endDate) : undefined,
            createdAt: new Date(med.createdAt),
            updatedAt: new Date(med.updatedAt),
          }));
          setMedications(medicationsWithDates);
        }
      } catch (error) {
        console.error('Error loading medications:', error);
      } finally {
        setIsLoadingMedications(false);
      }
    };

    if (user?.id) {
      loadProfileData();
      loadMedications();
    }
  }, [user?.id]);

  // Medication management functions
  const handleAddMedication = async (medication: NewMedication): Promise<Medication | void> => {
    try {
      setIsLoadingMedications(true);
      const response = await apiClient.post<{ success: boolean; data: Medication }>(
        API_ENDPOINTS.MEDICATIONS,
        medication
      );
      
      if (response.success && response.data) {
        // Parse date strings back to Date objects for the new medication
        const medicationWithDates = {
          ...response.data,
          prescribedDate: new Date(response.data.prescribedDate),
          startDate: response.data.startDate ? new Date(response.data.startDate) : undefined,
          endDate: response.data.endDate ? new Date(response.data.endDate) : undefined,
          createdAt: new Date(response.data.createdAt),
          updatedAt: new Date(response.data.updatedAt),
        };
        setMedications(prev => [...prev, medicationWithDates]);
        return medicationWithDates;
      }
    } catch (error) {
      console.error('Error adding medication:', error);
      throw error; // Re-throw to let the component handle the error
    } finally {
      setIsLoadingMedications(false);
    }
  };

  const handleUpdateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      setIsLoadingMedications(true);
      const response = await apiClient.put<{ success: boolean; data: Medication }>(
        API_ENDPOINTS.MEDICATION_BY_ID(id),
        updates
      );
      
      if (response.success && response.data) {
        // Parse date strings back to Date objects for the updated medication
        const medicationWithDates = {
          ...response.data,
          prescribedDate: new Date(response.data.prescribedDate),
          startDate: response.data.startDate ? new Date(response.data.startDate) : undefined,
          endDate: response.data.endDate ? new Date(response.data.endDate) : undefined,
          createdAt: new Date(response.data.createdAt),
          updatedAt: new Date(response.data.updatedAt),
        };
        setMedications(prev =>
          prev.map(med =>
            med.id === id ? medicationWithDates : med
          )
        );
      }
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    } finally {
      setIsLoadingMedications(false);
    }
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      setIsLoadingMedications(true);
      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.MEDICATION_BY_ID(id)
      );
      
      if (response.success) {
        setMedications(prev => prev.filter(med => med.id !== id));
      }
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    } finally {
      setIsLoadingMedications(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <Heart className="w-8 h-8 text-primary-600" />
                <span className="text-2xl font-bold text-gray-900">KinConnect</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
              <Heart className="w-12 h-12 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {user?.name || 'Patient Profile'}
              </h1>
              <p className="text-gray-600 mb-1">{user?.email}</p>
              <p className="text-sm text-gray-500">
                {user?.userType?.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="md:col-span-2">
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
          <div className="mt-8">
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
          <div className="mt-8">
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

        {/* Medications Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <MedicationManager
            patientId={user?.id || ''}
            medications={medications}
            onAddMedication={handleAddMedication}
            onUpdateMedication={handleUpdateMedication}
            onDeleteMedication={handleDeleteMedication}
            isLoading={isLoadingMedications}
          />
        </div>

        {/* Calendar Integration Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <CalendarIntegration patientId={user?.id || ''} />
        </div>
      </main>
    </div>
  );
}
