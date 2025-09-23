import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Bell,
  Pill,
  Package,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { TodayMedicationBuckets, EnhancedMedicationCalendarEvent } from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from './LoadingSpinner';
import QuickActionButtons from './QuickActionButtons';

interface EnhancedMedicationReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMedicationAction?: (eventId: string, action: 'take' | 'snooze' | 'skip' | 'reschedule') => void;
}

export default function EnhancedMedicationReminderModal({
  isOpen,
  onClose,
  onMedicationAction
}: EnhancedMedicationReminderModalProps) {
  const { getEffectivePatientId, activePatientAccess, userRole } = useFamily();
  const [buckets, setBuckets] = useState<TodayMedicationBuckets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['overdue', 'now', 'dueSoon']));
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load today's medications when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTodaysMedications();
    }
  }, [isOpen]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isOpen) {
        loadTodaysMedications();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  const loadTodaysMedications = async (forceFresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const effectivePatientId = getEffectivePatientId();
      console.log('🔍 EnhancedMedicationReminderModal: Loading medications for patient:', effectivePatientId);
      
      if (!effectivePatientId) {
        setError('Unable to determine patient ID. Please refresh and try again.');
        return;
      }

      // First, validate and repair the data pipeline
      const pipelineValidation = await medicationCalendarApi.validateAndRepairDataPipeline(effectivePatientId);
      
      if (!pipelineValidation.isValid && pipelineValidation.issues.length > 0) {
        console.warn('⚠️ Data pipeline issues detected:', pipelineValidation.issues);
        if (pipelineValidation.repaired.length > 0) {
          console.log('✅ Pipeline repairs applied:', pipelineValidation.repaired);
        }
      }

      // Load today's medication buckets
      const result = await medicationCalendarApi.getTodayMedicationBuckets(new Date(), {
        patientId: effectivePatientId,
        forceFresh
      });

      if (result.success && result.data) {
        setBuckets(result.data);
        setLastRefresh(new Date());
        
        console.log('✅ EnhancedMedicationReminderModal: Medications loaded successfully:', {
          overdue: result.data.overdue?.length || 0,
          now: result.data.now?.length || 0,
          dueSoon: result.data.dueSoon?.length || 0,
          total: (result.data.overdue?.length || 0) + 
                 (result.data.now?.length || 0) + 
                 (result.data.dueSoon?.length || 0) +
                 (result.data.morning?.length || 0) +
                 (result.data.noon?.length || 0) +
                 (result.data.evening?.length || 0) +
                 (result.data.bedtime?.length || 0) +
                 (result.data.completed?.length || 0)
        });
      } else {
        console.error('❌ Failed to load medications:', result.error);
        setError(result.error || 'Failed to load today\'s medications');
      }
    } catch (error) {
      console.error('❌ Error loading medications:', error);
      setError(error instanceof Error ? error.message : 'Failed to load medications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMedicationAction = async (
    eventId: string,
    action: 'take' | 'snooze' | 'skip' | 'reschedule',
    actionData?: any
  ) => {
    try {
      setProcessingAction(eventId);
      setError(null);
      
      if (!isOnline) {
        setError('You are offline. Please check your internet connection and try again.');
        return;
      }
      
      let result;
      switch (action) {
        case 'take':
          result = await medicationCalendarApi.markMedicationTaken(eventId, new Date());
          break;
        case 'snooze':
          if (actionData?.minutes) {
            result = await medicationCalendarApi.snoozeMedication(eventId, actionData.minutes, actionData.reason);
          }
          break;
        case 'skip':
          if (actionData?.reason) {
            result = await medicationCalendarApi.skipMedication(eventId, actionData.reason, actionData.notes);
          }
          break;
        case 'reschedule':
          if (actionData?.newTime && actionData?.reason) {
            result = await medicationCalendarApi.rescheduleMedication(
              eventId,
              actionData.newTime,
              actionData.reason,
              actionData.isOneTime || false
            );
          }
          break;
      }
      
      if (result && result.success) {
        console.log(`✅ ${action} action successful for event:`, eventId);
        
        // Refresh medications after successful action
        await loadTodaysMedications(true);
        
        onMedicationAction?.(eventId, action);
      } else {
        console.error(`❌ ${action} action failed:`, result?.error);
        setError(result?.error || `Failed to ${action} medication`);
      }
      
    } catch (error) {
      console.error('Error performing medication action:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('Authentication')) {
        setError('Your session has expired. Please sign in again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(`Failed to ${action} medication: ${errorMessage}`);
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handleTake = (eventId: string) => {
    handleMedicationAction(eventId, 'take');
  };

  const handleSnooze = (eventId: string, minutes: number, reason?: string) => {
    handleMedicationAction(eventId, 'snooze', { minutes, reason });
  };

  const handleSkip = (eventId: string, reason: string, notes?: string) => {
    handleMedicationAction(eventId, 'skip', { reason, notes });
  };

  const handleReschedule = (eventId: string, newTime: Date, reason: string, isOneTime: boolean) => {
    handleMedicationAction(eventId, 'reschedule', { newTime, reason, isOneTime });
  };

  const toggleBucketExpansion = (bucketKey: string) => {
    setExpandedBuckets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bucketKey)) {
        newSet.delete(bucketKey);
      } else {
        newSet.add(bucketKey);
      }
      return newSet;
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs < 0) {
      const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
      if (overdueMins < 60) {
        return `${overdueMins}m overdue`;
      } else {
        const overdueHours = Math.floor(overdueMins / 60);
        return `${overdueHours}h overdue`;
      }
    }
    
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) {
      return `in ${mins}m`;
    } else {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `in ${hours}h ${remainingMins}m` : `in ${hours}h`;
    }
  };

  if (!isOpen) return null;

  // Create priority buckets for display
  const priorityBuckets = buckets ? [
    {
      key: 'overdue',
      label: 'Overdue',
      icon: <AlertTriangle className="w-5 h-5 text-red-700" />,
      events: buckets.overdue || [],
      color: 'border-red-300 bg-red-100',
      priority: 1
    },
    {
      key: 'now',
      label: 'Take Now',
      icon: <Bell className="w-5 h-5 text-red-600" />,
      events: buckets.now || [],
      color: 'border-red-200 bg-red-50',
      priority: 2
    },
    {
      key: 'dueSoon',
      label: 'Due Soon',
      icon: <Clock className="w-5 h-5 text-orange-600" />,
      events: buckets.dueSoon || [],
      color: 'border-orange-200 bg-orange-50',
      priority: 3
    }
  ].filter(bucket => bucket.events.length > 0) : [];

  const totalUrgentMedications = priorityBuckets.reduce((sum, bucket) => sum + bucket.events.length, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Pill className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Today's Medication Reminders</h2>
              <p className="text-sm text-gray-600">
                {userRole === 'family_member' && activePatientAccess ? (
                  <>Viewing {activePatientAccess.patientName}'s medications for today</>
                ) : (
                  <>Your medications for today</>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              {isOnline ? (
                <Wifi className="w-3 h-3 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-500" />
              )}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            
            <button
              onClick={() => loadTodaysMedications(true)}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              title="Refresh medications"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="sm" />
              <span className="ml-3 text-gray-600">Loading today's medications...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 m-6 rounded-lg border border-red-200">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Medications</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => loadTodaysMedications(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
                {!isOnline && (
                  <div className="flex items-center text-red-600">
                    <WifiOff className="w-4 h-4 mr-1" />
                    <span className="text-sm">Offline</span>
                  </div>
                )}
              </div>
            </div>
          ) : totalUrgentMedications === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
              <p className="text-gray-600">
                No urgent medications right now. Great job staying on track!
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="font-medium text-gray-900">Urgent Medications</h3>
                    <div className="flex items-center space-x-2 text-sm">
                      {priorityBuckets.map(bucket => (
                        bucket.events.length > 0 && (
                          <span key={bucket.key} className="flex items-center space-x-1 text-gray-600">
                            {bucket.icon}
                            <span>{bucket.events.length} {bucket.label.toLowerCase()}</span>
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Priority Buckets */}
              {priorityBuckets.map((bucket) => (
                <div
                  key={bucket.key}
                  className={`rounded-lg border ${bucket.color} transition-all duration-200`}
                >
                  {/* Bucket Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleBucketExpansion(bucket.key)}
                  >
                    <div className="flex items-center space-x-3">
                      {bucket.icon}
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {bucket.label} ({bucket.events.length})
                        </h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {bucket.key === 'overdue' && bucket.events.length > 0 && (
                        <span className="text-xs text-red-600 font-medium">
                          Action needed
                        </span>
                      )}
                      {bucket.key === 'now' && bucket.events.length > 0 && (
                        <span className="text-xs text-orange-600 font-medium">
                          Due now
                        </span>
                      )}
                      {expandedBuckets.has(bucket.key) ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Bucket Content */}
                  {expandedBuckets.has(bucket.key) && (
                    <div className="px-4 pb-4 space-y-3">
                      {bucket.events.map((event) => (
                        <div
                          key={event.id}
                          className="bg-white rounded-lg border border-gray-200 p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h5 className="font-medium text-gray-900">
                                  {event.medicationName}
                                </h5>
                                {event.isPartOfPack && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Package className="w-3 h-3 mr-1" />
                                    {event.packName}
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 mb-2">
                                {event.dosageAmount}
                              </p>
                              
                              {event.instructions && (
                                <p className="text-xs text-gray-500 mb-2">
                                  {event.instructions}
                                </p>
                              )}
                              
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center space-x-1 text-blue-600">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatTime(new Date(event.scheduledDateTime))}</span>
                                </span>
                                
                                <span className={`text-xs ${
                                  event.isOverdue ? 'text-red-500' : 'text-gray-500'
                                }`}>
                                  {getTimeUntil(new Date(event.scheduledDateTime))}
                                </span>
                                
                                {event.snoozeCount > 0 && (
                                  <span className="text-xs text-yellow-600">
                                    Snoozed {event.snoozeCount}x
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Quick Actions */}
                            <QuickActionButtons
                              event={event}
                              onTake={() => handleTake(event.id)}
                              onSnooze={(minutes: number, reason?: string) => handleSnooze(event.id, minutes, reason)}
                              onSkip={(reason: string, notes?: string) => handleSkip(event.id, reason, notes)}
                              onReschedule={(newTime: Date, reason: string, isOneTime: boolean) => handleReschedule(event.id, newTime, reason, isOneTime)}
                              isProcessing={processingAction === event.id}
                              compactMode={false}
                              error={processingAction === event.id && error ? error : undefined}
                              onClearError={() => setError(null)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Medications are automatically organized by urgency and time.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}