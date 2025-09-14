import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Sun, 
  Sunset, 
  Moon, 
  AlertTriangle, 
  CheckCircle,
  Bell,
  BellOff,
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { 
  EnhancedMedicationCalendarEvent, 
  TodayMedicationBuckets, 
  PatientMedicationPreferences,
  TimeSlot 
} from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import LoadingSpinner from './LoadingSpinner';
import QuickActionButtons from './QuickActionButtons';

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
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['now', 'overdue']));
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  useEffect(() => {
    loadTodaysBuckets();
    
    // Refresh every minute to keep "now" and "due soon" accurate
    const interval = setInterval(loadTodaysBuckets, 60000);
    return () => clearInterval(interval);
  }, [patientId, date]);

  // Refresh when refreshTrigger changes (triggered by parent component)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 TimeBucketView: Refresh triggered by parent');
      loadTodaysBuckets();
    }
  }, [refreshTrigger]);

  const loadTodaysBuckets = async () => {
    try {
      setIsLoading(true);
      
      // Use the new time buckets API endpoint
      const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(date);

      if (!bucketsResult.success || !bucketsResult.data) {
        console.error('Failed to load medication buckets:', bucketsResult.error);
        return;
      }

      setBuckets(bucketsResult.data);
      
    } catch (error) {
      console.error('Error loading today\'s medication buckets:', error);
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
        
        // Force refresh buckets after successful action
        setTimeout(async () => {
          await loadTodaysBuckets();
        }, 500); // Small delay to ensure backend is updated
        
        onMedicationAction?.(eventId, action);
      } else {
        console.error(`❌ ${action} action failed:`, result?.error);
        alert(`Failed to ${action} medication: ${result?.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error performing medication action:', error);
      alert(`Failed to ${action} medication. Please try again.`);
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
    }
  ].filter(bucket => bucket.events.length > 0); // Only show buckets with medications

  const totalMedications = orderedBuckets.reduce((sum, bucket) => sum + bucket.events.length, 0);
  const overdueMedications = buckets.overdue.length;
  const nowMedications = buckets.now.length;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Today's Medications</h3>
          <div className="flex items-center space-x-2 text-sm">
            {overdueMedications > 0 && (
              <span className="flex items-center space-x-1 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                <span>{overdueMedications} overdue</span>
              </span>
            )}
            {nowMedications > 0 && (
              <span className="flex items-center space-x-1 text-orange-600">
                <Bell className="w-3 h-3" />
                <span>{nowMedications} due now</span>
              </span>
            )}
            <span className="text-gray-500">
              {totalMedications} total
            </span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500">
          Last updated: {new Date(buckets.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Time Buckets */}
      {orderedBuckets.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
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
                    {bucket.timeRange && (
                      <p className="text-sm text-gray-600">{bucket.timeRange}</p>
                    )}
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
                          compactMode={compactMode}
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
  );
}