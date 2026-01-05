import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, CheckCircle, Loader2, Bell, Wrench } from 'lucide-react';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { quickScheduleDiagnostic, autoRepairMedicationSchedules } from '@/lib/medicationScheduleFixes';
import { isUnifiedMedication } from '@/types/medication';
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
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  // Check for unscheduled medications with enhanced validation
  useEffect(() => {
    const checkUnscheduledMedications = async () => {
      try {
        // Find medications with reminders enabled but no valid schedules
        // Handle both unified and legacy medication formats
        const medicationsWithReminders = medications.filter(med => {
          if (isUnifiedMedication(med)) {
            // For unified medications: check reminders.enabled and status
            return (
              med.reminders?.enabled &&
              med.status?.isActive &&
              !med.status?.isPRN
            );
          } else {
            // For legacy medications: use existing logic
            return (
              med.hasReminders &&
              med.isActive &&
              !med.isPRN
            );
          }
        });

        if (medicationsWithReminders.length === 0) {
          setShowAlert(false);
          return;
        }

        console.log('🔍 Checking schedules for medications with reminders:', medicationsWithReminders.map(m => m.name));

        // Check which medications have valid schedules
        const unscheduled: Medication[] = [];
        const scheduledButInvalid: Medication[] = [];
        
        for (const medication of medicationsWithReminders) {
          try {
            const schedulesResponse = await medicationCalendarApi.getMedicationSchedulesByMedicationId(medication.id);
            
            if (!schedulesResponse.success) {
              console.warn('Failed to check schedules for medication:', medication.name, schedulesResponse.error);
              unscheduled.push(medication);
              continue;
            }

            const schedules = schedulesResponse.data || [];
            
            if (schedules.length === 0) {
              console.log('No schedules found for medication:', medication.name);
              unscheduled.push(medication);
              continue;
            }

            // Check if medication has actual calendar events (functionality check)
            // Instead of strict validation, we check if events exist for the next 7 days
            let hasValidSchedule = false;
            
            // FIX 2: Check for unified medications with embedded schedule times FIRST
            // Unified medications store schedule times directly in the medication object
            // and don't need separate calendar events validation
            if (isUnifiedMedication(medication)) {
              const hasScheduleTimes = medication.schedule?.times && medication.schedule.times.length > 0;
              if (hasScheduleTimes) {
                console.log('✅ Unified medication has embedded schedule times, skipping calendar validation:', medication.name);
                hasValidSchedule = true;
                continue; // Skip to next medication - this one is properly scheduled
              }
            } else if ((medication as any).times && Array.isArray((medication as any).times) && (medication as any).times.length > 0) {
              // Check for flattened unified format (from Medications.tsx)
              console.log('✅ Medication has schedule times configured (flattened format), skipping calendar validation:', medication.name);
              hasValidSchedule = true;
              continue;
            }
            
            try {
              const today = new Date();
              const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
              
              console.log('🔍 DEBUG: Checking calendar events for medication:', {
                medicationId: medication.id,
                medicationName: medication.name,
                startDate: today.toISOString(),
                endDate: nextWeek.toISOString()
              });
              
              const eventsResponse = await medicationCalendarApi.getMedicationCalendarEvents({
                medicationId: medication.id,
                startDate: today,
                endDate: nextWeek,
                forceFresh: true
              });
              
              console.log('🔍 DEBUG: Events response for', medication.name, ':', {
                success: eventsResponse.success,
                dataLength: eventsResponse.data?.length || 0,
                error: eventsResponse.error,
                events: eventsResponse.data?.map(e => ({
                  id: e.id,
                  scheduledDateTime: e.scheduledDateTime,
                  status: e.status,
                  medicationName: e.medicationName
                }))
              });
              
              if (eventsResponse.success && eventsResponse.data && eventsResponse.data.length > 0) {
                // Medication has calendar events - it IS scheduled
                hasValidSchedule = true;
                console.log('✅ Medication has calendar events:', medication.name, 'events:', eventsResponse.data.length);
              } else {
                // No calendar events found - check if schedule is at least active
                const activeSchedule = schedules.find(s => s.isActive && !s.isPaused);
                if (activeSchedule) {
                  console.warn('⚠️ Medication has active schedule but no calendar events:', medication.name);
                  console.warn('⚠️ Active schedule details:', {
                    scheduleId: activeSchedule.id,
                    frequency: activeSchedule.frequency,
                    times: activeSchedule.times,
                    isActive: activeSchedule.isActive,
                    isPaused: activeSchedule.isPaused,
                    generateCalendarEvents: activeSchedule.generateCalendarEvents
                  });
                  // Still consider it unscheduled since no events exist
                  hasValidSchedule = false;
                } else {
                  console.log('❌ No active schedules or events for medication:', medication.name);
                  hasValidSchedule = false;
                }
              }
            } catch (error) {
              console.warn('Error checking calendar events for medication:', medication.name, error);
              // Fallback to basic schedule check
              hasValidSchedule = schedules.some(s => s.isActive && !s.isPaused);
            }

            if (!hasValidSchedule) {
              // FIX 1: Add early continue for unified medications with schedule times
              // This is a fallback check in case the medication wasn't caught by the earlier check
              if (isUnifiedMedication(medication)) {
                const hasScheduleTimes = medication.schedule?.times && medication.schedule.times.length > 0;
                if (hasScheduleTimes) {
                  console.log('✅ Unified medication has schedule times configured (fallback check):', medication.name);
                  hasValidSchedule = true;
                  continue; // Skip to next medication - don't add to invalid lists
                } else {
                  console.log('❌ No valid active schedules for unified medication:', medication.name);
                  if (schedules.length > 0) {
                    scheduledButInvalid.push(medication);
                  } else {
                    unscheduled.push(medication);
                  }
                }
              } else if ((medication as any).times && Array.isArray((medication as any).times) && (medication as any).times.length > 0) {
                  // Fallback check for flattened unified format
                  console.log('✅ Medication has schedule times configured (flattened format fallback), skipping calendar validation:', medication.name);
                  hasValidSchedule = true;
                  continue;
              } else {
                // Legacy medication without valid schedule
                console.log('❌ No valid active schedules for legacy medication:', medication.name);
                if (schedules.length > 0) {
                  scheduledButInvalid.push(medication);
                } else {
                  unscheduled.push(medication);
                }
              }
            } else {
              console.log('Valid schedule found for medication:', medication.name);
            }
            
          } catch (error) {
            console.warn('Error checking schedules for medication:', medication.name, error);
            // Assume unscheduled if we can't check
            unscheduled.push(medication);
          }
        }

        // Combine truly unscheduled and those with invalid schedules
        const allProblematicMedications = [...unscheduled, ...scheduledButInvalid];
        
        console.log('🔍 Schedule check results:', {
          totalWithReminders: medicationsWithReminders.length,
          unscheduled: unscheduled.length,
          scheduledButInvalid: scheduledButInvalid.length,
          totalProblematic: allProblematicMedications.length
        });

        setUnscheduledMedications(allProblematicMedications);
        setShowAlert(allProblematicMedications.length > 0);
        
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
      console.log('🔧 Starting bulk schedule creation for medications:', unscheduledMedications.map(m => m.name));
      
      const result = await medicationCalendarApi.createBulkSchedules();
      console.log('🔧 Bulk schedule creation result:', result);
      
      setBulkCreateResult(result);
      
      if (result.success && result.data) {
        const { created, skipped, errors } = result.data;
        
        // Enhanced feedback based on results
        if (created > 0) {
          console.log(`✅ Successfully created ${created} schedules`);
          // Wait a moment for the backend to process, then refresh
          setTimeout(() => {
            setShowAlert(false);
            setUnscheduledMedications([]);
            onSchedulesCreated?.();
          }, 1500);
        } else if (skipped > 0 && created === 0) {
          console.log(`⚠️ No new schedules created - ${skipped} medications already have schedules`);
          // Force refresh the schedule detection to update the UI
          setTimeout(() => {
            // Re-run the schedule check to update the alert
            const recheckEvent = new Event('recheck-schedules');
            window.dispatchEvent(recheckEvent);
          }, 500);
        }
        
        if (errors && errors.length > 0) {
          console.warn('⚠️ Schedule creation errors:', errors);
        }
      }
    } catch (error) {
      console.error('Error creating bulk schedules:', error);
      setBulkCreateResult({
        success: false,
        error: 'Failed to create schedules. Please check your medication details and try again.'
      });
    } finally {
      setIsCreatingSchedules(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticResult(null);

    try {
      console.log('🔍 Running schedule diagnostic...');
      const diagnostic = await quickScheduleDiagnostic(medications);
      setDiagnosticResult(diagnostic);
      
      console.log('🔍 Diagnostic result:', diagnostic);
    } catch (error) {
      console.error('Error running diagnostic:', error);
      setDiagnosticResult({
        summary: 'Diagnostic failed',
        issues: ['Unable to run diagnostic'],
        recommendations: ['Check console for errors'],
        canAutoFix: false
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const handleAutoRepair = async () => {
    setIsCreatingSchedules(true);
    setBulkCreateResult(null);

    try {
      console.log('🔧 Running auto-repair...');
      const repairResult = await autoRepairMedicationSchedules(medications);
      
      setBulkCreateResult({
        success: repairResult.success,
        data: {
          created: repairResult.medicationsFixed,
          processed: repairResult.medicationsProcessed,
          skipped: repairResult.medicationsProcessed - repairResult.medicationsFixed,
          errors: repairResult.remainingIssues
        },
        message: repairResult.success
          ? `Auto-repair completed: ${repairResult.fixesApplied.join('; ')}`
          : `Auto-repair had issues: ${repairResult.remainingIssues.join('; ')}`
      });
      
      if (repairResult.success && repairResult.medicationsFixed > 0) {
        setTimeout(() => {
          setShowAlert(false);
          setUnscheduledMedications([]);
          onSchedulesCreated?.();
        }, 1500);
      }
      
    } catch (error) {
      console.error('Error running auto-repair:', error);
      setBulkCreateResult({
        success: false,
        error: 'Auto-repair failed. Please try manual schedule creation.'
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
                ? (bulkCreateResult.data?.created > 0 ? 'bg-green-100 border border-green-200' : 'bg-blue-100 border border-blue-200')
                : 'bg-red-100 border border-red-200'
            }`}>
              {bulkCreateResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-800">
                      {bulkCreateResult.data?.created > 0 ? (
                        <>Successfully created {bulkCreateResult.data.created} schedule{bulkCreateResult.data.created !== 1 ? 's' : ''}!</>
                      ) : (
                        <>Schedule creation completed</>
                      )}
                    </p>
                  </div>
                  
                  {bulkCreateResult.data?.skipped > 0 && (
                    <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                      <strong>{bulkCreateResult.data.skipped} medication{bulkCreateResult.data.skipped !== 1 ? 's' : ''} skipped:</strong>
                      <br />
                      {bulkCreateResult.data.created === 0 ? (
                        'These medications already have valid schedules. If you\'re still seeing them as unscheduled, there may be validation issues with the existing schedules.'
                      ) : (
                        'These medications already had valid schedules.'
                      )}
                    </div>
                  )}
                  
                  {bulkCreateResult.data?.errors && bulkCreateResult.data.errors.length > 0 && (
                    <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded">
                      <strong>Issues encountered:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {bulkCreateResult.data.errors.slice(0, 3).map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                        {bulkCreateResult.data.errors.length > 3 && (
                          <li>...and {bulkCreateResult.data.errors.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
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

          {diagnosticResult && (
            <div className="p-3 rounded-md mb-3 bg-gray-50 border border-gray-200">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-medium text-gray-800">Diagnostic Results</p>
                </div>
                
                <p className="text-sm text-gray-700">{diagnosticResult.summary}</p>
                
                {diagnosticResult.issues.length > 0 && (
                  <div className="text-xs text-gray-600">
                    <strong>Issues found:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {diagnosticResult.issues.map((issue: string, index: number) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {diagnosticResult.recommendations.length > 0 && (
                  <div className="text-xs text-blue-600">
                    <strong>Recommendations:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {diagnosticResult.recommendations.slice(0, 3).map((rec: string, index: number) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {diagnosticResult.canAutoFix && (
                  <button
                    onClick={handleAutoRepair}
                    disabled={isCreatingSchedules}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50"
                  >
                    <Wrench className="w-3 h-3 mr-1" />
                    Auto-Repair Issues
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <button
              onClick={handleCreateSchedules}
              disabled={isCreatingSchedules || isRunningDiagnostic}
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
              onClick={handleRunDiagnostic}
              disabled={isCreatingSchedules || isRunningDiagnostic}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunningDiagnostic ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Diagnosing...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Diagnose Issues
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