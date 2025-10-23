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
  Lock,
  Utensils,
  HelpCircle,
  X,
  Info
} from 'lucide-react';
import type {
  EnhancedMedicationCalendarEvent,
  TodayMedicationBuckets as LegacyTodayMedicationBuckets,
  PatientMedicationPreferences
} from '@shared/types';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
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
  const [buckets, setBuckets] = useState<LegacyTodayMedicationBuckets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['now', 'overdue', 'completed']));
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showHelp, setShowHelp] = useState(false);
  
  // Add family context for permission checks
  const { hasPermission, userRole, activePatientAccess } = useFamily();

  // Create smart refresh function with shorter interval for user actions
  const smartLoadTodaysBuckets = createSmartRefresh(
    async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use the new time buckets API endpoint with proper patient ID
        const bucketsResult = await unifiedMedicationApi.getTodayMedicationBuckets(date, {
          patientId: patientId || undefined,
          forceFresh: false
        });

        if (!bucketsResult.success || !bucketsResult.data) {
          console.error('Failed to load medication buckets:', bucketsResult.error);
          setError(bucketsResult.error || 'Failed to load medications');
          return;
        }

        // Filter out PRN medications from all buckets (they have their own section)
        const filterPRN = (events: any[]) => events.filter((event: any) => !event.isPRN);

        // Map unified API response to legacy format for compatibility
        const mappedData: LegacyTodayMedicationBuckets = {
          now: filterPRN(bucketsResult.data.now as any || []),
          dueSoon: filterPRN(bucketsResult.data.dueSoon as any || []),
          morning: filterPRN(bucketsResult.data.morning as any || []),
          noon: filterPRN(bucketsResult.data.lunch as any || []),
          evening: filterPRN(bucketsResult.data.evening as any || []),
          bedtime: filterPRN(bucketsResult.data.beforeBed as any || []),
          overdue: filterPRN(bucketsResult.data.overdue as any || []),
          completed: filterPRN(bucketsResult.data.completed as any || []),
          patientPreferences: {
            timeSlots: {
              morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
              noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Lunch' },
              evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
              bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Before Bed' }
            }
          } as any,
          lastUpdated: bucketsResult.data.lastUpdated
        };
        setBuckets(mappedData);
        setError(null); // Clear any previous errors
        
        // Add debugging for medication display
        console.log('🔍 TimeBucketView: Loaded medication buckets:', {
          now: bucketsResult.data.now?.length || 0,
          dueSoon: bucketsResult.data.dueSoon?.length || 0,
          morning: bucketsResult.data.morning?.length || 0,
          noon: bucketsResult.data.lunch?.length || 0,
          evening: bucketsResult.data.evening?.length || 0,
          bedtime: bucketsResult.data.beforeBed?.length || 0,
          overdue: bucketsResult.data.overdue?.length || 0,
          completed: bucketsResult.data.completed?.length || 0,
          total: (bucketsResult.data.now?.length || 0) +
                 (bucketsResult.data.dueSoon?.length || 0) +
                 (bucketsResult.data.morning?.length || 0) +
                 (bucketsResult.data.lunch?.length || 0) +
                 (bucketsResult.data.evening?.length || 0) +
                 (bucketsResult.data.beforeBed?.length || 0) +
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
          // Find the event to get commandId and scheduledDateTime
          const event = Object.values(buckets || {})
            .flat()
            .find((e: any) => e.id === eventId);
          
          if (event) {
            result = await unifiedMedicationApi.markMedicationTaken(event.commandId || event.medicationId, {
              scheduledDateTime: new Date(event.scheduledDateTime),
              takenAt: new Date()
            });
          }
          break;
        case 'snooze':
          if (actionData?.minutes) {
            const event = Object.values(buckets || {})
              .flat()
              .find((e: any) => e.id === eventId);
            
            if (event) {
              result = await unifiedMedicationApi.snoozeDose(
                event.commandId || event.medicationId,
                eventId,
                actionData.minutes,
                { notes: actionData.reason }
              );
            }
          }
          break;
        case 'skip':
          if (actionData?.reason) {
            const event = Object.values(buckets || {})
              .flat()
              .find((e: any) => e.id === eventId);
            
            if (event) {
              result = await unifiedMedicationApi.skipDose(
                event.commandId || event.medicationId,
                eventId,
                actionData.reason,
                { notes: actionData.notes }
              );
            }
          }
          break;
        case 'reschedule':
          if (actionData?.newTime && actionData?.reason) {
            // Reschedule is not yet implemented in unified API
            // For now, we'll skip this and add a TODO
            console.warn('Reschedule not yet implemented in unified API');
            result = { success: false, error: 'Reschedule feature coming soon' };
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
          } as LegacyTodayMedicationBuckets;
        });

        // Force immediate refresh by bypassing smart refresh cache
        setTimeout(async () => {
          try {
            setIsLoading(true);
            console.log('🔄 Force refreshing buckets after medication action');
            
            // Directly call the API without smart refresh to ensure fresh data
            const bucketsResult = await unifiedMedicationApi.getTodayMedicationBuckets(date, {
              forceFresh: true,
              patientId: patientId || undefined
            });
            if (bucketsResult.success && bucketsResult.data) {
              // Filter out PRN medications from all buckets
              const filterPRN = (events: any[]) => events.filter((event: any) => !event.isPRN);
              
              // Map unified API response to legacy format for compatibility
              const mappedData: LegacyTodayMedicationBuckets = {
                now: filterPRN(bucketsResult.data.now as any || []),
                dueSoon: filterPRN(bucketsResult.data.dueSoon as any || []),
                morning: filterPRN(bucketsResult.data.morning as any || []),
                noon: filterPRN(bucketsResult.data.lunch as any || []),
                evening: filterPRN(bucketsResult.data.evening as any || []),
                bedtime: filterPRN(bucketsResult.data.beforeBed as any || []),
                overdue: filterPRN(bucketsResult.data.overdue as any || []),
                completed: filterPRN(bucketsResult.data.completed as any || []),
                patientPreferences: {
                  timeSlots: {
                    morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
                    noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Lunch' },
                    evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
                    bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Before Bed' }
                  }
                } as any,
                lastUpdated: bucketsResult.data.lastUpdated
              };
              setBuckets(mappedData);
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
        return <Bell className="w-6 h-6 text-red-600" />;
      case 'dueSoon':
        return <Clock className="w-6 h-6 text-orange-600" />;
      case 'morning':
        return <Sun className="w-6 h-6 text-yellow-500" />;
      case 'noon':
        return <Utensils className="w-6 h-6 text-orange-500" />;
      case 'evening':
        return <Sunset className="w-6 h-6 text-purple-500" />;
      case 'bedtime':
        return <Moon className="w-6 h-6 text-indigo-500" />;
      case 'overdue':
        return <AlertTriangle className="w-6 h-6 text-red-700" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      default:
        return <Clock className="w-6 h-6 text-gray-600" />;
    }
  };

  const getBucketColor = (bucketKey: string) => {
    switch (bucketKey) {
      case 'now':
        return 'border-red-300 bg-red-50 shadow-sm';
      case 'dueSoon':
        return 'border-orange-300 bg-orange-50';
      case 'morning':
        return 'border-yellow-300 bg-yellow-50';
      case 'noon':
        return 'border-orange-300 bg-orange-50';
      case 'evening':
        return 'border-purple-300 bg-purple-50';
      case 'bedtime':
        return 'border-indigo-300 bg-indigo-50';
      case 'overdue':
        return 'border-red-400 bg-red-100 shadow-md ring-2 ring-red-200';
      case 'completed':
        return 'border-green-300 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatTime = (date: Date): string => {
    const formatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Debug logging for timezone issues
    console.log('🔍 TIMEZONE DEBUG - formatTime:', {
      inputDate: date,
      inputISO: date.toISOString(),
      inputTimestamp: date.getTime(),
      formatted: formatted,
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: date.getTimezoneOffset(),
      localeDateString: date.toLocaleDateString(),
      localeTimeString: date.toLocaleTimeString()
    });
    
    return formatted;
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

  const formatTimeRange = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
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
        <p className="text-sm text-gray-400 mt-2">
          Medications from previous days have been archived.
        </p>
      </div>
    );
  }

  // Create ordered buckets for display with enhanced visual indicators
  const orderedBuckets: TimeBucket[] = [
    {
      key: 'overdue',
      label: '⚠️ Overdue',
      icon: <AlertTriangle className="w-6 h-6 text-red-700" />,
      events: buckets.overdue,
      timeRange: 'Past due time',
      priority: 1,
      color: 'border-red-400 bg-red-100 shadow-md ring-2 ring-red-200'
    },
    {
      key: 'now',
      label: '🔔 Take Now',
      icon: <Bell className="w-6 h-6 text-red-600" />,
      events: buckets.now,
      timeRange: 'Due within 15 minutes',
      priority: 2,
      color: 'border-red-300 bg-red-50 shadow-sm'
    },
    {
      key: 'dueSoon',
      label: '⏰ Due Soon',
      icon: <Clock className="w-6 h-6 text-orange-600" />,
      events: buckets.dueSoon,
      timeRange: 'Due in the next hour',
      priority: 3,
      color: 'border-orange-300 bg-orange-50'
    },
    {
      key: 'morning',
      label: `☀️ ${buckets.patientPreferences.timeSlots.morning.label}`,
      icon: <Sun className="w-6 h-6 text-yellow-500" />,
      events: buckets.morning,
      timeRange: `${formatTimeRange(buckets.patientPreferences.timeSlots.morning.start)} - ${formatTimeRange(buckets.patientPreferences.timeSlots.morning.end)}`,
      priority: 4,
      color: 'border-yellow-300 bg-yellow-50'
    },
    {
      key: 'noon',
      label: `🍽️ ${buckets.patientPreferences.timeSlots.noon.label}`,
      icon: <Utensils className="w-6 h-6 text-orange-500" />,
      events: buckets.noon,
      timeRange: `${formatTimeRange(buckets.patientPreferences.timeSlots.noon.start)} - ${formatTimeRange(buckets.patientPreferences.timeSlots.noon.end)}`,
      priority: 5,
      color: 'border-orange-300 bg-orange-50'
    },
    {
      key: 'evening',
      label: `🌆 ${buckets.patientPreferences.timeSlots.evening.label}`,
      icon: <Sunset className="w-6 h-6 text-purple-500" />,
      events: buckets.evening,
      timeRange: `${formatTimeRange(buckets.patientPreferences.timeSlots.evening.start)} - ${formatTimeRange(buckets.patientPreferences.timeSlots.evening.end)}`,
      priority: 6,
      color: 'border-purple-300 bg-purple-50'
    },
    {
      key: 'bedtime',
      label: `🌙 ${buckets.patientPreferences.timeSlots.bedtime.label}`,
      icon: <Moon className="w-6 h-6 text-indigo-500" />,
      events: buckets.bedtime,
      timeRange: `${formatTimeRange(buckets.patientPreferences.timeSlots.bedtime.start)} - ${formatTimeRange(buckets.patientPreferences.timeSlots.bedtime.end)}`,
      priority: 7,
      color: 'border-indigo-300 bg-indigo-50'
    },
    {
      key: 'completed',
      label: '✅ Completed Today',
      icon: <CheckCircle className="w-6 h-6 text-green-600" />,
      events: buckets.completed || [],
      timeRange: 'Taken, missed, or skipped',
      priority: 8,
      color: 'border-green-300 bg-green-50'
    }
  ].filter(bucket => bucket.events.length > 0); // Only show buckets with medications

  const totalMedications = orderedBuckets.reduce((sum, bucket) => sum + bucket.events.length, 0);
  const overdueMedications = buckets.overdue.length;
  const nowMedications = buckets.now.length;

  return (
    <div className="space-y-4 pb-4">
      {/* Enhanced Summary Header with Help Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-2">
          {overdueMedications > 0 && (
            <span className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm font-medium animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>{overdueMedications} overdue</span>
            </span>
          )}
          {nowMedications > 0 && (
            <span className="flex items-center space-x-1 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg text-sm font-medium">
              <Bell className="w-4 h-4" />
              <span>{nowMedications} due now</span>
            </span>
          )}
          {overdueMedications === 0 && nowMedications === 0 && totalMedications > 0 && (
            <span className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>All caught up!</span>
            </span>
          )}
        </div>
        
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center space-x-1 px-4 py-2.5 min-h-[44px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
          aria-label="What are time buckets?"
        >
          <HelpCircle className="w-5 h-5" />
          <span>What are time buckets?</span>
        </button>
      </div>

      {/* Help Section */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <h3 className="font-semibold text-blue-900">What are Time Buckets?</h3>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors"
              aria-label="Close help"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3 text-sm text-blue-800">
            <p>
              Time buckets organize your medications by when they should be taken throughout the day, making it easier to stay on track.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="flex items-start space-x-2">
                <Sun className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Morning</p>
                  <p className="text-xs text-blue-700">Medications to take when you wake up</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <Utensils className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Lunch</p>
                  <p className="text-xs text-blue-700">Midday medications with or after meals</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <Sunset className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Evening</p>
                  <p className="text-xs text-blue-700">Medications for dinner time</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <Moon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Before Bed</p>
                  <p className="text-xs text-blue-700">Medications to take at bedtime</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-blue-200">
              <p className="font-medium text-blue-900 mb-2">Special Buckets:</p>
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs"><span className="font-medium">Overdue:</span> Medications past their scheduled time</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Bell className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs"><span className="font-medium">Take Now:</span> Due within the next 15 minutes</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs"><span className="font-medium">Due Soon:</span> Coming up in the next hour</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="mt-2 px-4 py-2 min-h-[44px] bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
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
          <p className="text-gray-500 mb-2">
            No pending medications for today. Great job staying on track!
          </p>
          <p className="text-sm text-gray-400">
            View your medication history to see past doses.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderedBuckets.map((bucket, index) => (
            <div
              key={bucket.key}
              className={`rounded-lg border ${bucket.color} transition-all duration-300 hover:shadow-md ${
                bucket.key === 'overdue' ? 'animate-pulse' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Enhanced Bucket Header */}
              <div
                className="flex items-center justify-between p-4 min-h-[60px] cursor-pointer hover:bg-opacity-80 transition-colors active:bg-opacity-70"
                onClick={() => toggleBucketExpansion(bucket.key)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {bucket.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-base">
                      {bucket.label}
                    </h4>
                    {bucket.timeRange && (
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">{bucket.timeRange}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${
                    bucket.key === 'overdue' ? 'bg-red-200 text-red-900' :
                    bucket.key === 'now' ? 'bg-red-100 text-red-800' :
                    bucket.key === 'completed' ? 'bg-green-200 text-green-900' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {bucket.events.length}
                  </span>
                  {expandedBuckets.has(bucket.key) ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 transition-transform" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform" />
                  )}
                </div>
              </div>

              {/* Enhanced Bucket Content with Animation */}
              {expandedBuckets.has(bucket.key) && (
                <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top duration-200">
                  {bucket.events.map((event, eventIndex) => (
                    <div
                      key={event.id}
                      className={`bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-sm ${
                        event.isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      style={{ animationDelay: `${eventIndex * 30}ms` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-1">
                          <h5 className="font-semibold text-gray-900 text-base leading-tight">
                            {event.medicationName}
                          </h5>
                            {event.isPartOfPack && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                📦 Pack
                              </span>
                            )}
                            {event.isOverdue && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-900 animate-pulse">
                                ⚠️ OVERDUE
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3 font-medium">
                            {event.dosageAmount}
                          </p>
                          
                          <div className="flex items-center space-x-3 text-sm flex-wrap gap-2 mb-1">
                            <span className={`flex items-center space-x-1 px-2 py-1 rounded ${
                              event.isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-medium">{(() => {
                                const scheduledDate = new Date(event.scheduledDateTime);
                                return formatTime(scheduledDate);
                              })()}</span>
                            </span>
                            
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                              event.isOverdue ? 'bg-red-200 text-red-900' : 'bg-gray-100 text-gray-700'
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
                              <div className="flex items-center space-x-2 px-3 py-2 min-h-[44px] text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md">
                                <Lock className="w-4 h-4" />
                                <span>View only</span>
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