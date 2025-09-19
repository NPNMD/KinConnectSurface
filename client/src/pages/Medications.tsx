import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import {
  Heart,
  ArrowLeft,
  Pill,
  Plus,
  Search,
  Filter,
  Clock,
  Bell,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Settings,
  User,
  Users
} from 'lucide-react';
import { Medication, NewMedication } from '@shared/types';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { createSmartRefresh, createDebouncedFunction } from '@/lib/requestDebouncer';
import MedicationManager from '@/components/MedicationManager';
import MedicationReminders from '@/components/MedicationReminders';
import UnifiedMedicationView from '@/components/UnifiedMedicationView';
import TimeBucketView from '@/components/TimeBucketView';
import LoadingSpinner from '@/components/LoadingSpinner';
import PatientSwitcher from '@/components/PatientSwitcher';
import { CreatePermissionWrapper, EditPermissionWrapper } from '@/components/PermissionWrapper';

export default function Medications() {
  const {
    getEffectivePatientId,
    userRole,
    activePatientAccess,
    hasPermission
  } = useFamily();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoadingMedications, setIsLoadingMedications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showReminders, setShowReminders] = useState(true);
  const [useTimeBuckets, setUseTimeBuckets] = useState(true); // New enhanced view
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for TimeBucketView refresh

  // Create smart refresh function for medications
  const smartLoadMedications = createSmartRefresh(
    async () => {
      try {
        setIsLoadingMedications(true);
        const effectivePatientId = getEffectivePatientId();
        if (!effectivePatientId) return;
        
        const endpoint = userRole === 'family_member'
          ? API_ENDPOINTS.MEDICATIONS_FOR_PATIENT(effectivePatientId)
          : API_ENDPOINTS.MEDICATIONS;
        
        const response = await apiClient.get<{ success: boolean; data: Medication[] }>(endpoint);
        
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
    },
    60000, // 1 minute minimum between calls
    'medications_list'
  );

  // Load medications function with smart refresh
  const loadMedications = async () => {
    const result = await smartLoadMedications();
    if (result === null && medications.length > 0) {
      console.log('🚫 Skipped redundant medications refresh');
    }
  };

  // Load medications on component mount
  useEffect(() => {
    const effectivePatientId = getEffectivePatientId();
    if (effectivePatientId) {
      loadMedications();
    }
  }, [getEffectivePatientId()]);

  // Listen for medication schedule updates with debounced refresh
  useEffect(() => {
    const debouncedRefresh = createDebouncedFunction(
      async () => {
        console.log('🔍 Medications: Refreshing medications after schedule update');
        await loadMedications();
      },
      2000, // 2 second debounce
      'medications_schedule_update'
    );

    const handleScheduleUpdate = () => {
      console.log('🔍 Medications: Received schedule update event');
      debouncedRefresh();
    };

    window.addEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    
    return () => {
      window.removeEventListener('medicationScheduleUpdated', handleScheduleUpdate);
      debouncedRefresh.cancel();
    };
  }, []);

  // Medication management functions
  const handleAddMedication = async (medication: NewMedication) => {
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

  // Filter medications based on search and status
  const filteredMedications = medications.filter(medication => {
    const matchesSearch = medication.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         medication.genericName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         medication.brandName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && medication.isActive) ||
                         (filterStatus === 'inactive' && !medication.isActive);
    
    return matchesSearch && matchesStatus;
  });

  const activeMedications = filteredMedications.filter(med => med.isActive);
  const inactiveMedications = filteredMedications.filter(med => !med.isActive);

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
                <Pill className="w-6 h-6 text-primary-600" />
                <span className="text-lg font-bold text-gray-900">Medications</span>
              </div>
            </div>
            
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 pb-20">
        {/* Today's Medications Section */}
        {showReminders && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Today's Medications</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setUseTimeBuckets(!useTimeBuckets)}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                >
                  {useTimeBuckets ? 'Simple View' : 'Time Buckets'}
                </button>
                <button
                  onClick={() => setShowReminders(!showReminders)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {showReminders ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {useTimeBuckets ? (
                <TimeBucketView
                  patientId={getEffectivePatientId() || ''}
                  date={new Date()}
                  onMedicationAction={(eventId, action) => {
                    console.log('Medication action performed:', { eventId, action });
                    // Refresh medications and trigger TimeBucketView refresh with debouncing
                    setTimeout(() => {
                      loadMedications();
                      setRefreshTrigger(prev => prev + 1);
                    }, 1000); // 1 second delay to batch updates
                  }}
                  compactMode={false}
                  refreshTrigger={refreshTrigger}
                />
              ) : (
                <MedicationReminders
                  patientId={getEffectivePatientId() || ''}
                  maxItems={5}
                />
              )}
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-4">
          <div className="flex flex-col space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search medications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex rounded-lg border border-gray-200 bg-white">
              {[
                { key: 'all', label: 'All', count: medications.length },
                { key: 'active', label: 'Active', count: activeMedications.length },
                { key: 'inactive', label: 'Past', count: inactiveMedications.length }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key as any)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                    filterStatus === filter.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Unified Medications View with Management */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <UnifiedMedicationView
            patientId={getEffectivePatientId() || ''}
            medications={filteredMedications}
            showCreateScheduleButton={hasPermission('canCreate')}
            onScheduleCreated={() => {
              // Use debounced refresh and dispatch event
              setTimeout(() => {
                loadMedications();
                window.dispatchEvent(new CustomEvent('medicationScheduleUpdated'));
              }, 1000); // 1 second delay to batch updates
            }}
          />
        </div>

        {/* Medications Manager */}
        {hasPermission('canEdit') ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <MedicationManager
              patientId={getEffectivePatientId() || ''}
              medications={filteredMedications}
              onAddMedication={handleAddMedication}
              onUpdateMedication={handleUpdateMedication}
              onDeleteMedication={handleDeleteMedication}
              isLoading={isLoadingMedications}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-center py-8">
              <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">View-Only Access</h3>
              <p className="text-gray-600 text-sm">
                You have view-only access to {activePatientAccess?.patientName}'s medications.
                Contact them to request edit permissions if needed.
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">{activeMedications.length}</div>
            <div className="text-sm text-gray-600">Active Medications</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{medications.length}</div>
            <div className="text-sm text-gray-600">Total Medications</div>
          </div>
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
            className="flex flex-col items-center space-y-1 p-2 text-primary-600"
          >
            <Pill className="w-5 h-5" />
            <span className="text-xs font-medium">Medications</span>
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
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
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