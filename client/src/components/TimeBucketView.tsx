import React, { useState, useEffect } from 'react';
import {
  Clock,
  Sun,
  Sunset,
  Moon,
  AlertTriangle,
  CheckCircle,
  Bell,
  Package,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Wifi,
  WifiOff,
  Lock
} from 'lucide-react';
import type {
  EnhancedMedicationCalendarEvent,
  TodayMedicationBuckets,
  PatientMedicationPreferences
} from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { createSmartRefresh } from '@/lib/requestDebouncer';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from './LoadingSpinner';
import QuickActionButtons from '@/components/QuickActionButtons';

interface TimeBucketViewProps {
  patientId: string;
  date?: Date;
  onMedicationAction?: (eventId: string, action: 'take' | 'snooze' | 'skip' | 'reschedule') => void;
  compactMode?: boolean;
  refreshTrigger?: number; // Add this to force refresh from parent
}

interface TimeBucket {
  key: string;
  label: string;
  icon: React.ReactNode;
  events: EnhancedMedicationCalendarEvent[];
  timeRange?: string;
  priority: number;
  color: string;
}

export default function TimeBucketView({
  patientId,
  date = new Date(),
  onMedicationAction,
  compactMode = false,
  refreshTrigger = 0
}: TimeBucketViewProps) {
  const [buckets, setBuckets] = useState<TodayMedicationBuckets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['now', 'overdue', 'completed']));
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Add family context for permission checks
  const { hasPermission, userRole, activePatientAccess } = useFamily();

  // Create smart refresh function with shorter interval for user actions
  const smartLoadTodaysBuckets = createSmartRefresh(
    async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use the new time buckets API endpoint with proper patient ID
        const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(date, {
          patientId: patientId || undefined,
          forceFresh: false
        });

        if (!bucketsResult.success || !bucketsResult.data) {
          console.error('Failed to load medication buckets:', bucketsResult.error);
          setError(bucketsResult.error || 'Failed to load medications');
          return;
        }

        setBuckets(bucketsResult.data);
        setError(null); // Clear any previous errors
        
        // Add debugging for medication display
        console.log('🔍 TimeBucketView: Loaded medication buckets:', {
          now: bucketsResult.data.now?.length || 0,
          dueSoon: bucketsResult.data.dueSoon?.length || 0,
          morning: bucketsResult.data.morning?.length || 0,
          noon: bucketsResult.data.noon?.length || 0,
          evening: bucketsResult.data.evening?.length || 0,
          bedtime: bucketsResult.data.bedtime?.length || 0,
          overdue: bucketsResult.data.overdue?.length || 0,
          completed: bucketsResult.data.completed?.length || 0,
          total: (bucketsResult.data.now?.length || 0) +
                 (bucketsResult.data.dueSoon?.length || 0) +
                 (bucketsResult.data.morning?.length || 0) +
                 (bucketsResult.data.noon?.length || 0) +
                 (bucketsResult.data.evening?.length || 0) +
                 (bucketsResult.data.bedtime?.length || 0) +
                 (bucketsResult.data.overdue?.length || 0) +
                 (bucketsResult.data.completed?.length || 0)
        });
        
        // Log completed medications specifically
        if (bucketsResult.data.completed && bucketsResult.data.completed.length > 0) {
          console.log('🔍 TimeBucketView: Completed medications found:',
            bucketsResult.data.completed.map(event => ({
              id: event.id,
              medicationName: event.medicationName,
              status: event.status,
              scheduledDateTime: event.scheduledDateTime,
              actualTakenDateTime: event.actualTakenDateTime
            }))
          );
        }
        
      } catch (error) {
        console.error('Error loading today\'s medication buckets:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load medications';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    5000, // 5 seconds minimum between refreshes (shorter for user actions)
    `today_buckets_${patientId}_${date.toISOString().split('T')[0]}`
  );

  const loadTodaysBuckets = async () => {
    const result = await smartLoadTodaysBuckets();
    // If smart refresh skipped the call, don't change loading state
    if (result === null && buckets) {
      console.log('🚫 Skipped redundant bucket refresh');
    }
  };

  useEffect(() => {
    loadTodaysBuckets();
    
    // Refresh every 5 minutes instead of every minute to reduce API calls
    const interval = setInterval(loadTodaysBuckets, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [patientId, date]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Refresh data when coming back online
      if (!isLoading) {
        loadTodaysBuckets();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isLoading]);

  // Refresh when refreshTrigger changes (triggered by parent component)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 TimeBucketView: Refresh triggered by parent');
      loadTodaysBuckets();
    }
  }, [refreshTrigger]);

  const handleMedicationAction = async (
    eventId: string,
    action: 'take' | 'snooze' | 'skip' | 'reschedule',
    actionData?: any
  ) => {
    try {
      setProcessingAction(eventId);
      setError(null); // Clear any previous errors
      
      // Check if online
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
      
      // Check if the action was successful
      if (result && result.success) {
        console.log(`✅ ${action} action successful for event:`, eventId);
        
        // Optimistically remove event from current buckets
        setBuckets(prev => {
          if (!prev) return prev;
          const removeFrom = (arr: EnhancedMedicationCalendarEvent[]) => arr.filter(e => e.id !== eventId);
          return {
            ...prev,
            overdue: removeFrom(prev.overdue),
            now: removeFrom(prev.now),
            dueSoon: removeFrom(prev.dueSoon),
            morning: removeFrom(prev.morning),
            noon: removeFrom(prev.noon),
            evening: removeFrom(prev.evening),
            bedtime: removeFrom(prev.bedtime),
            completed: removeFrom(prev.completed || []),
            lastUpdated: new Date()
          } as TodayMedicationBuckets;
        });

        // Force immediate refresh by bypassing smart refresh cache
        setTimeout(async () => {
          try {
            setIsLoading(true);
            console.log('🔄 Force refreshing buckets after medication action');
            
            // Directly call the API without smart refresh to ensure fresh data
            const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(date, {
              forceFresh: true,
              patientId: patientId || undefined
            });
            if (bucketsResult.success && bucketsResult.data) {
              setBuckets(bucketsResult.data);
              setError(null);
              console.log('✅ Buckets refreshed successfully after action');
            } else {
              console.error('❌ Failed to refresh buckets:', bucketsResult.error);
              setError(bucketsResult.error || 'Failed to refresh medication data');
            }
          } catch (error) {
            console.error('❌ Error refreshing after action:', error);
            setError(error instanceof Error ? error.message : 'Failed to refresh medication data');
          } finally {
            setIsLoading(false);
          }
        }, 500); // Reduced delay to 500ms for faster UI response
        
        onMedicationAction?.(eventId, action);
      } else {
        console.error(`❌ ${action} action failed:`, result?.error);
        const errorMessage = result?.error || 'Unknown error occurred';
        setError(`Failed to ${action} medication: ${errorMessage}`);
      }
      
    } catch (error) {
      console.error('Error performing medication action:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Handle specific error types
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

  const getBucketIcon = (bucketKey: string) => {
    switch (bucketKey) {
      case 'now':
        return <Bell className="w-5 h-5 text-red-600" />;
      case 'dueSoon':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'morning':
        return <Sun className="w-5 h-5 text-yellow-600" />;
      case 'noon':
        return <Sun className="w-5 h-5 text-orange-500" />;
      case 'evening':
        return <Sunset className="w-5 h-5 text-purple-600" />;
      case 'bedtime':
        return <Moon className="w-5 h-5 text-indigo-600" />;
      case 'overdue':
        return <AlertTriangle className="w-5 h-5 text-red-700" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBucketColor = (bucketKey: string) => {
    switch (bucketKey) {
      case 'now':
        return 'border-red-200 bg-red-50';
      case 'dueSoon':
        return 'border-orange-200 bg-orange-50';
      case 'morning':
        return 'border-yellow-200 bg-yellow-50';
      case 'noon':
        return 'border-orange-200 bg-orange-50';
      case 'evening':
        return 'border-purple-200 bg-purple-50';
      case 'bedtime':
        return 'border-indigo-200 bg-indigo-50';
      case 'overdue':
        return 'border-red-300 bg-red-100';
      case 'completed':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-gray-600 text-sm">Loading today's medications...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-red-900 mb-2">Error Loading Medications</h4>
        <p className="text-red-700 mb-4">{error}</p>
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => loadTodaysBuckets()}
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
    );
  }

  if (!buckets) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No medications scheduled</h4>
        <p className="text-gray-500">
          No medications are scheduled for today.
        </p>
      </div>
    );
  }

  // Create ordered buckets for display
  const orderedBuckets: TimeBucket[] = [
    {
      key: 'overdue',
      label: 'Overdue',
      icon: <AlertTriangle className="w-5 h-5 text-red-700" />,
      events: buckets.overdue,
      priority: 1,
      color: 'border-red-300 bg-red-100'
    },
    {
      key: 'now',
      label: 'Take Now',
      icon: <Bell className="w-5 h-5 text-red-600" />,
      events: buckets.now,
      priority: 2,
      color: 'border-red-200 bg-red-50'
    },
    {
      key: 'dueSoon',
      label: 'Due Soon',
      icon: <Clock className="w-5 h-5 text-orange-600" />,
      events: buckets.dueSoon,
      timeRange: 'Next hour',
      priority: 3,
      color: 'border-orange-200 bg-orange-50'
    },
    {
      key: 'morning',
      label: buckets.patientPreferences.timeSlots.morning.label,
      icon: <Sun className="w-5 h-5 text-yellow-600" />,
      events: buckets.morning,
      timeRange: `${buckets.patientPreferences.timeSlots.morning.start} - ${buckets.patientPreferences.timeSlots.morning.end}`,
      priority: 4,
      color: 'border-yellow-200 bg-yellow-50'
    },
    {
      key: 'noon',
      label: buckets.patientPreferences.timeSlots.noon.label,
      icon: <Sun className="w-5 h-5 text-orange-500" />,
      events: buckets.noon,
      timeRange: `${buckets.patientPreferences.timeSlots.noon.start} - ${buckets.patientPreferences.timeSlots.noon.end}`,
      priority: 5,
      color: 'border-orange-200 bg-orange-50'
    },
    {
      key: 'evening',
      label: buckets.patientPreferences.timeSlots.evening.label,
      icon: <Sunset className="w-5 h-5 text-purple-600" />,
      events: buckets.evening,
      timeRange: `${buckets.patientPreferences.timeSlots.evening.start} - ${buckets.patientPreferences.timeSlots.evening.end}`,
      priority: 6,
      color: 'border-purple-200 bg-purple-50'
    },
    {
      key: 'bedtime',
      label: buckets.patientPreferences.timeSlots.bedtime.label,
      icon: <Moon className="w-5 h-5 text-indigo-600" />,
      events: buckets.bedtime,
      timeRange: `${buckets.patientPreferences.timeSlots.bedtime.start} - ${buckets.patientPreferences.timeSlots.bedtime.end}`,
      priority: 7,
      color: 'border-indigo-200 bg-indigo-50'
    },
    {
      key: 'completed',
      label: 'Completed Today',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      events: buckets.completed || [],
      timeRange: 'Taken, missed, or skipped',
      priority: 8,
      color: 'border-green-200 bg-green-50'
    }
  ].filter(bucket => bucket.events.length > 0); // Only show buckets with medications

  const totalMedications = orderedBuckets.reduce((sum, bucket) => sum + bucket.events.length, 0);
  const overdueMedications = buckets.overdue.length;
  const nowMedications = buckets.now.length;

  return (
    <div className="space-y-4">
      {/* Simplified Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {overdueMedications > 0 && (
            <span className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 rounded-md text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{overdueMedications} overdue</span>
            </span>
          )}
          {nowMedications > 0 && (
            <span className="flex items-center space-x-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-sm">
              <Bell className="w-4 h-4" />
              <span>{nowMedications} due now</span>
            </span>
          )}
          {overdueMedications === 0 && nowMedications === 0 && totalMedications > 0 && (
            <span className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>All caught up!</span>
            </span>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          {totalMedications} medication{totalMedications !== 1 ? 's' : ''} today
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  loadTodaysBuckets();
                }}
                className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Time Buckets */}
      {orderedBuckets.length === 0 ? (
        <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h4>
          <p className="text-gray-500">
            No pending medications for today. Great job staying on track!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orderedBuckets.map((bucket) => (
            <div
              key={bucket.key}
              className={`rounded-lg border ${bucket.color} transition-all duration-200`}
            >
              {/* Simplified Bucket Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => toggleBucketExpansion(bucket.key)}
              >
                <div className="flex items-center space-x-3">
                  {bucket.icon}
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {bucket.label}
                    </h4>
                    {bucket.timeRange && (
                      <p className="text-xs text-gray-600">{bucket.timeRange}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    {bucket.events.length}
                  </span>
                  {expandedBuckets.has(bucket.key) ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Simplified Bucket Content */}
              {expandedBuckets.has(bucket.key) && (
                <div className="px-3 pb-3 space-y-2">
                  {bucket.events.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="font-medium text-gray-900">
                              {event.medicationName}
                            </h5>
                            {event.isPartOfPack && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Pack
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-1">
                            {event.dosageAmount}
                          </p>
                          
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="flex items-center space-x-1 text-blue-600">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(new Date(event.scheduledDateTime))}</span>
                            </span>
                            
                            <span className={`text-xs ${
                              event.isOverdue ? 'text-red-500' : 'text-gray-500'
                            }`}>
                              {getTimeUntil(new Date(event.scheduledDateTime))}
                            </span>
                          </div>
                        </div>
                        
                        {/* Permission-based Actions */}
                        {bucket.key !== 'completed' && (() => {
                          const canEdit = hasPermission('canEdit');
                          
                          // Debug logging for permission issues
                          console.log('🔍 TimeBucketView: Permission check for medication action buttons:', {
                            eventId: event.id,
                            medicationName: event.medicationName,
                            userRole,
                            canEdit,
                            bucketKey: bucket.key,
                            activePatientAccess: activePatientAccess ? {
                              patientName: activePatientAccess.patientName,
                              permissions: activePatientAccess.permissions,
                              accessLevel: activePatientAccess.accessLevel
                            } : null
                          });
                          
                          if (canEdit) {
                            return (
                              <QuickActionButtons
                                event={event}
                                onTake={() => handleTake(event.id)}
                                onSnooze={(minutes: number, reason?: string) => handleSnooze(event.id, minutes, reason)}
                                onSkip={(reason: string, notes?: string) => handleSkip(event.id, reason, notes)}
                                onReschedule={(newTime: Date, reason: string, isOneTime: boolean) => handleReschedule(event.id, newTime, reason, isOneTime)}
                                isProcessing={processingAction === event.id}
                                compactMode={true}
                                useEnhancedTakeButton={true}
                                error={processingAction === event.id && error ? error : undefined}
                                onClearError={() => setError(null)}
                              />
                            );
                          } else {
                            // Show permission message for family members without edit access
                            return (
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <Lock className="w-3 h-3" />
                                <span>View only access</span>
                              </div>
                            );
                          }
                        })()}
                        
                        {/* Simplified Status for completed medications */}
                        {bucket.key === 'completed' && (
                          <div className="flex items-center">
                            {event.status === 'taken' && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {event.status === 'missed' && (
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                            )}
                            {event.status === 'skipped' && (
                              <Package className="w-5 h-5 text-yellow-600" />
                            )}
                            {event.status === 'late' && (
                              <Clock className="w-5 h-5 text-orange-600" />
                            )}
                          </div>
                        )}
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
  );
}