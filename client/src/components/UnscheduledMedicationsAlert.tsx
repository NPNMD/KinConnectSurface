import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, CheckCircle, Loader2, Bell } from 'lucide-react';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import type { Medication } from '@shared/types';

interface UnscheduledMedicationsAlertProps {
  medications: Medication[];
  onSchedulesCreated?: () => void;
}

export default function UnscheduledMedicationsAlert({ 
  medications, 
  onSchedulesCreated 
}: UnscheduledMedicationsAlertProps) {
  const [unscheduledMedications, setUnscheduledMedications] = useState<Medication[]>([]);
  const [isCreatingSchedules, setIsCreatingSchedules] = useState(false);
  const [bulkCreateResult, setBulkCreateResult] = useState<any>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Check for unscheduled medications
  useEffect(() => {
    const checkUnscheduledMedications = async () => {
      try {
        // Find medications with reminders enabled but no schedules
        const medicationsWithReminders = medications.filter(med => 
          med.hasReminders && 
          med.isActive && 
          !med.isPRN
        );

        if (medicationsWithReminders.length === 0) {
          setShowAlert(false);
          return;
        }

        // Check which medications have schedules
        const unscheduled: Medication[] = [];
        
        for (const medication of medicationsWithReminders) {
          try {
            const schedulesResponse = await medicationCalendarApi.getMedicationSchedulesByMedicationId(medication.id);
            if (schedulesResponse.success && schedulesResponse.data && schedulesResponse.data.length === 0) {
              unscheduled.push(medication);
            }
          } catch (error) {
            console.warn('Error checking schedules for medication:', medication.name, error);
            // Assume unscheduled if we can't check
            unscheduled.push(medication);
          }
        }

        setUnscheduledMedications(unscheduled);
        setShowAlert(unscheduled.length > 0);
        
      } catch (error) {
        console.error('Error checking unscheduled medications:', error);
      }
    };

    if (medications.length > 0) {
      checkUnscheduledMedications();
    }
  }, [medications]);

  const handleCreateSchedules = async () => {
    setIsCreatingSchedules(true);
    setBulkCreateResult(null);

    try {
      const result = await medicationCalendarApi.createBulkSchedules();
      setBulkCreateResult(result);
      
      if (result.success && result.data && result.data.created > 0) {
        // Wait a moment for the backend to process, then refresh
        setTimeout(() => {
          setShowAlert(false);
          setUnscheduledMedications([]);
          onSchedulesCreated?.();
        }, 1000);
      }
    } catch (error) {
      console.error('Error creating bulk schedules:', error);
      setBulkCreateResult({
        success: false,
        error: 'Failed to create schedules'
      });
    } finally {
      setIsCreatingSchedules(false);
    }
  };

  if (!showAlert || unscheduledMedications.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">
            Medications Need Scheduling
          </h3>
          <p className="text-sm text-yellow-700 mb-3">
            You have {unscheduledMedications.length} medication{unscheduledMedications.length !== 1 ? 's' : ''} with reminders enabled 
            that {unscheduledMedications.length !== 1 ? 'don\'t' : 'doesn\'t'} have schedules yet. 
            These won't appear in your daily medication view until scheduled.
          </p>
          
          <div className="space-y-2 mb-4">
            <p className="text-xs text-yellow-600 font-medium">Unscheduled medications:</p>
            <div className="flex flex-wrap gap-2">
              {unscheduledMedications.map((med) => (
                <span
                  key={med.id}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800"
                >
                  <Bell className="w-3 h-3 mr-1" />
                  {med.name}
                </span>
              ))}
            </div>
          </div>

          {bulkCreateResult && (
            <div className={`p-3 rounded-md mb-3 ${
              bulkCreateResult.success 
                ? 'bg-green-100 border border-green-200' 
                : 'bg-red-100 border border-red-200'
            }`}>
              {bulkCreateResult.success ? (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    Successfully created {bulkCreateResult.data?.created || 0} schedule{bulkCreateResult.data?.created !== 1 ? 's' : ''}!
                    {bulkCreateResult.data?.skipped > 0 && ` (${bulkCreateResult.data.skipped} skipped)`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-800">
                    {bulkCreateResult.error || 'Failed to create schedules'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCreateSchedules}
              disabled={isCreatingSchedules}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingSchedules ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Schedules...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Create Schedules Automatically
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowAlert(false)}
              className="text-sm text-yellow-600 hover:text-yellow-800 underline"
            >
              Dismiss
            </button>
          </div>

          <div className="mt-3 p-2 bg-yellow-100 rounded-md">
            <p className="text-xs text-yellow-800">
              <Calendar className="w-3 h-3 inline mr-1" />
              This will automatically create medication schedules based on your reminder preferences and make them appear in today's view.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}