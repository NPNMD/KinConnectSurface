/**
 * TimeBucketDisplay Component
 * 
 * Displays today's medications organized by time buckets with patient's custom preferences:
 * - Shows medications grouped by morning, lunch, evening, before bed
 * - Uses patient's custom time bucket labels and times
 * - Displays medication status (pending, taken, overdue)
 * - Allows quick actions (mark as taken, snooze, skip)
 * - Real-time updates and status indicators
 */

import React, { useState, useEffect } from 'react';
import { unifiedMedicationApi, TimeBucketStatus, PatientTimePreferences } from '../lib/unifiedMedicationApi';

interface TimeBucketDisplayProps {
  patientId?: string;
  date?: Date;
  onMedicationTaken?: (commandId: string, medicationName: string) => void;
  onError?: (error: string) => void;
}

interface BucketDisplayData extends TimeBucketStatus {
  icon: string;
  colorClass: string;
  progressPercentage: number;
}

export const TimeBucketDisplay: React.FC<TimeBucketDisplayProps> = ({
  patientId,
  date = new Date(),
  onMedicationTaken,
  onError
}) => {
  const [buckets, setBuckets] = useState<BucketDisplayData[]>([]);
  const [preferences, setPreferences] = useState<PatientTimePreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Load data on mount and set up refresh interval
  useEffect(() => {
    loadBucketData();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadBucketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [patientId, date]);

  const loadBucketData = async () => {
    try {
      setIsLoading(true);

      // Load time preferences and bucket status in parallel
      const [preferencesResult, statusResult] = await Promise.all([
        unifiedMedicationApi.getTimePreferences(patientId),
        unifiedMedicationApi.getTimeBucketStatus({
          patientId,
          date,
          includeMedications: true,
          includeCompleted: false
        })
      ]);

      if (preferencesResult.success && preferencesResult.data) {
        setPreferences(preferencesResult.data);
      }

      if (statusResult.success && statusResult.data) {
        const enhancedBuckets = statusResult.data.map(bucket => ({
          ...bucket,
          ...getBucketDisplayInfo(bucket.bucketName),
          progressPercentage: bucket.totalMedications > 0 
            ? Math.round((bucket.completedMedications / bucket.totalMedications) * 100)
            : 0
        }));

        setBuckets(enhancedBuckets);
      } else {
        onError?.(statusResult.error || 'Failed to load time bucket status');
      }

      setLastUpdated(new Date());

    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to load bucket data');
    } finally {
      setIsLoading(false);
    }
  };

  const getBucketDisplayInfo = (bucketName: 'morning' | 'lunch' | 'evening' | 'beforeBed') => {
    const bucketInfo = {
      morning: { icon: '🌅', colorClass: 'bg-yellow-50 border-yellow-200' },
      lunch: { icon: '☀️', colorClass: 'bg-orange-50 border-orange-200' },
      evening: { icon: '🌆', colorClass: 'bg-blue-50 border-blue-200' },
      beforeBed: { icon: '🌙', colorClass: 'bg-purple-50 border-purple-200' }
    };

    return bucketInfo[bucketName];
  };

  const handleMarkTaken = async (commandId: string, medicationName: string, scheduledTime: Date) => {
    try {
      const result = await unifiedMedicationApi.markMedicationTaken(commandId, {
        takenAt: new Date(),
        scheduledDateTime: scheduledTime,
        notifyFamily: false
      });

      if (result.success) {
        onMedicationTaken?.(commandId, medicationName);
        // Refresh bucket data
        await loadBucketData();
      } else {
        onError?.(result.error || 'Failed to mark medication as taken');
      }

    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to mark medication as taken');
    }
  };

  const formatTime = (time: string): string => {
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

  const getTimeUntilDue = (minutesUntilDue: number): string => {
    if (minutesUntilDue < 0) {
      const minutesOverdue = Math.abs(minutesUntilDue);
      if (minutesOverdue < 60) {
        return `${minutesOverdue}m overdue`;
      } else {
        const hoursOverdue = Math.floor(minutesOverdue / 60);
        const remainingMinutes = minutesOverdue % 60;
        return `${hoursOverdue}h ${remainingMinutes}m overdue`;
      }
    } else if (minutesUntilDue < 60) {
      return `${minutesUntilDue}m`;
    } else {
      const hours = Math.floor(minutesUntilDue / 60);
      const minutes = minutesUntilDue % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading medication schedule...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Today's Medications</h2>
          <p className="text-gray-600">
            {date.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={loadBucketData}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            🔄 Refresh
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Time Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {buckets.map((bucket) => (
          <div
            key={bucket.bucketName}
            className={`border rounded-lg p-4 ${bucket.colorClass} ${
              bucket.isComplete ? 'opacity-75' : ''
            }`}
          >
            {/* Bucket Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="text-2xl mr-2">{bucket.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{bucket.label}</h3>
                  <p className="text-sm text-gray-600">
                    {formatTime(bucket.defaultTime)}
                  </p>
                </div>
              </div>
              {bucket.isComplete && (
                <span className="text-green-600 text-xl">✅</span>
              )}
            </div>

            {/* Progress Bar */}
            {bucket.totalMedications > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{bucket.completedMedications} of {bucket.totalMedications}</span>
                  <span>{bucket.progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      bucket.isComplete ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${bucket.progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Medications List */}
            <div className="space-y-2">
              {bucket.medications.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No medications scheduled</p>
              ) : (
                bucket.medications.map((medication) => (
                  <div
                    key={medication.commandId}
                    className={`p-3 bg-white rounded border ${
                      medication.isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {medication.medicationName}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {medication.dosageAmount}
                        </p>
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-gray-500">
                            {formatTime(medication.scheduledTime)}
                          </span>
                          {medication.minutesUntilDue !== 0 && (
                            <span className={`ml-2 text-xs px-2 py-1 rounded ${
                              medication.isOverdue 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {getTimeUntilDue(medication.minutesUntilDue)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      {medication.status === 'pending' && (
                        <button
                          onClick={() => handleMarkTaken(
                            medication.commandId,
                            medication.medicationName,
                            new Date(medication.scheduledTime)
                          )}
                          className={`px-3 py-1 text-sm rounded transition-colors ${
                            medication.isOverdue
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          ✓ Taken
                        </button>
                      )}

                      {medication.status === 'taken' && (
                        <span className="text-green-600 text-sm font-medium">
                          ✅ Taken
                        </span>
                      )}

                      {medication.status === 'missed' && (
                        <span className="text-red-600 text-sm font-medium">
                          ❌ Missed
                        </span>
                      )}

                      {medication.status === 'skipped' && (
                        <span className="text-yellow-600 text-sm font-medium">
                          ⏭️ Skipped
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Next Due Time */}
            {bucket.nextDueTime && !bucket.isComplete && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Next: {formatTime(bucket.nextDueTime)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Today's Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {buckets.reduce((sum, bucket) => sum + bucket.totalMedications, 0)}
            </div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {buckets.reduce((sum, bucket) => sum + bucket.completedMedications, 0)}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {buckets.reduce((sum, bucket) => sum + bucket.overdueMedications, 0)}
            </div>
            <div className="text-sm text-gray-600">Overdue</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">
              {buckets.filter(bucket => bucket.isComplete).length}
            </div>
            <div className="text-sm text-gray-600">Buckets Complete</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={loadBucketData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh Status
        </button>
        <button
          onClick={() => {
            // This would open the TimeBucketManager component
            console.log('Open time bucket preferences');
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          ⚙️ Customize Times
        </button>
      </div>
    </div>
  );
};

export default TimeBucketDisplay;