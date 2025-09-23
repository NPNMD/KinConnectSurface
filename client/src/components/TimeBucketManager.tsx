/**
 * TimeBucketManager Component
 * 
 * Provides a comprehensive UI for managing patient time preferences and time buckets:
 * - Display current time bucket configuration
 * - Allow customization of time buckets (morning, lunch, evening, before bed)
 * - Configure frequency mapping preferences
 * - Set lifestyle preferences (wake up time, bed time, meal times)
 * - Real-time validation and preview of changes
 */

import React, { useState, useEffect } from 'react';
import { unifiedMedicationApi, PatientTimePreferences, TimeBucketStatus } from '../lib/unifiedMedicationApi';

interface TimeBucketManagerProps {
  patientId?: string;
  onPreferencesUpdated?: (preferences: PatientTimePreferences) => void;
  onError?: (error: string) => void;
}

interface TimeBucketFormData {
  morning: {
    defaultTime: string;
    label: string;
    earliest: string;
    latest: string;
    isActive: boolean;
  };
  lunch: {
    defaultTime: string;
    label: string;
    earliest: string;
    latest: string;
    isActive: boolean;
  };
  evening: {
    defaultTime: string;
    label: string;
    earliest: string;
    latest: string;
    isActive: boolean;
  };
  beforeBed: {
    defaultTime: string;
    label: string;
    earliest: string;
    latest: string;
    isActive: boolean;
  };
}

interface LifestyleFormData {
  wakeUpTime: string;
  bedTime: string;
  timezone: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  workDays: number[];
  workStartTime?: string;
  workEndTime?: string;
  workLunchTime?: string;
}

export const TimeBucketManager: React.FC<TimeBucketManagerProps> = ({
  patientId,
  onPreferencesUpdated,
  onError
}) => {
  const [preferences, setPreferences] = useState<PatientTimePreferences | null>(null);
  const [formData, setFormData] = useState<TimeBucketFormData | null>(null);
  const [lifestyleData, setLifestyleData] = useState<LifestyleFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'buckets' | 'frequency' | 'lifestyle'>('buckets');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewSchedule, setPreviewSchedule] = useState<{
    daily?: string[];
    twiceDaily?: string[];
    threeTimes?: string[];
    fourTimes?: string[];
  }>({});

  // Load current preferences on mount
  useEffect(() => {
    loadTimePreferences();
  }, [patientId]);

  // Update preview when form data changes
  useEffect(() => {
    if (formData) {
      updatePreviewSchedule();
    }
  }, [formData]);

  const loadTimePreferences = async () => {
    try {
      setIsLoading(true);
      const result = await unifiedMedicationApi.getTimePreferences(patientId);
      
      if (result.success && result.data) {
        setPreferences(result.data);
        setFormData(mapPreferencesToFormData(result.data));
        setLifestyleData(mapLifestyleToFormData(result.data));
      } else {
        onError?.(result.error || 'Failed to load time preferences');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to load time preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const mapPreferencesToFormData = (prefs: PatientTimePreferences): TimeBucketFormData => {
    return {
      morning: {
        defaultTime: prefs.timeBuckets.morning.defaultTime,
        label: prefs.timeBuckets.morning.label,
        earliest: prefs.timeBuckets.morning.timeRange.earliest,
        latest: prefs.timeBuckets.morning.timeRange.latest,
        isActive: prefs.timeBuckets.morning.isActive
      },
      lunch: {
        defaultTime: prefs.timeBuckets.lunch.defaultTime,
        label: prefs.timeBuckets.lunch.label,
        earliest: prefs.timeBuckets.lunch.timeRange.earliest,
        latest: prefs.timeBuckets.lunch.timeRange.latest,
        isActive: prefs.timeBuckets.lunch.isActive
      },
      evening: {
        defaultTime: prefs.timeBuckets.evening.defaultTime,
        label: prefs.timeBuckets.evening.label,
        earliest: prefs.timeBuckets.evening.timeRange.earliest,
        latest: prefs.timeBuckets.evening.timeRange.latest,
        isActive: prefs.timeBuckets.evening.isActive
      },
      beforeBed: {
        defaultTime: prefs.timeBuckets.beforeBed.defaultTime,
        label: prefs.timeBuckets.beforeBed.label,
        earliest: prefs.timeBuckets.beforeBed.timeRange.earliest,
        latest: prefs.timeBuckets.beforeBed.timeRange.latest,
        isActive: prefs.timeBuckets.beforeBed.isActive
      }
    };
  };

  const mapLifestyleToFormData = (prefs: PatientTimePreferences): LifestyleFormData => {
    return {
      wakeUpTime: prefs.lifestyle.wakeUpTime,
      bedTime: prefs.lifestyle.bedTime,
      timezone: prefs.lifestyle.timezone,
      breakfast: prefs.lifestyle.mealTimes?.breakfast,
      lunch: prefs.lifestyle.mealTimes?.lunch,
      dinner: prefs.lifestyle.mealTimes?.dinner,
      workDays: prefs.lifestyle.workSchedule?.workDays || [],
      workStartTime: prefs.lifestyle.workSchedule?.startTime,
      workEndTime: prefs.lifestyle.workSchedule?.endTime,
      workLunchTime: prefs.lifestyle.workSchedule?.lunchTime
    };
  };

  const updatePreviewSchedule = async () => {
    if (!formData) return;

    try {
      // Simulate schedule computation for preview
      const frequencies: ('daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily')[] = 
        ['daily', 'twice_daily', 'three_times_daily', 'four_times_daily'];
      
      const preview: typeof previewSchedule = {};
      
      for (const frequency of frequencies) {
        // For preview, use simple logic based on current form data
        switch (frequency) {
          case 'daily':
            preview.daily = [formData.morning.defaultTime];
            break;
          case 'twice_daily':
            preview.twiceDaily = [formData.morning.defaultTime, formData.evening.defaultTime];
            break;
          case 'three_times_daily':
            preview.threeTimes = [formData.morning.defaultTime, formData.lunch.defaultTime, formData.evening.defaultTime];
            break;
          case 'four_times_daily':
            preview.fourTimes = [formData.morning.defaultTime, formData.lunch.defaultTime, formData.evening.defaultTime, formData.beforeBed.defaultTime];
            break;
        }
      }
      
      setPreviewSchedule(preview);
    } catch (error) {
      console.error('Error updating preview:', error);
    }
  };

  const validateFormData = (): string[] => {
    const errors: string[] = [];
    
    if (!formData) return ['Form data not loaded'];

    // Validate time formats
    Object.entries(formData).forEach(([bucketName, bucket]) => {
      if (!isValidTimeFormat(bucket.defaultTime)) {
        errors.push(`Invalid default time for ${bucketName}: ${bucket.defaultTime}`);
      }
      if (!isValidTimeFormat(bucket.earliest)) {
        errors.push(`Invalid earliest time for ${bucketName}: ${bucket.earliest}`);
      }
      if (!isValidTimeFormat(bucket.latest)) {
        errors.push(`Invalid latest time for ${bucketName}: ${bucket.latest}`);
      }

      // Validate time ranges
      const earliestMinutes = timeToMinutes(bucket.earliest);
      const latestMinutes = timeToMinutes(bucket.latest);
      const defaultMinutes = timeToMinutes(bucket.defaultTime);

      if (earliestMinutes >= latestMinutes) {
        errors.push(`${bucketName}: earliest time must be before latest time`);
      }

      if (defaultMinutes < earliestMinutes || defaultMinutes > latestMinutes) {
        errors.push(`${bucketName}: default time must be within the time range`);
      }
    });

    return errors;
  };

  const isValidTimeFormat = (time: string): boolean => {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleSavePreferences = async () => {
    if (!formData || !lifestyleData) return;

    const errors = validateFormData();
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      return;
    }

    try {
      setIsSaving(true);

      const updates = {
        timeBuckets: {
          morning: {
            defaultTime: formData.morning.defaultTime,
            label: formData.morning.label,
            timeRange: {
              earliest: formData.morning.earliest,
              latest: formData.morning.latest
            },
            isActive: formData.morning.isActive
          },
          lunch: {
            defaultTime: formData.lunch.defaultTime,
            label: formData.lunch.label,
            timeRange: {
              earliest: formData.lunch.earliest,
              latest: formData.lunch.latest
            },
            isActive: formData.lunch.isActive
          },
          evening: {
            defaultTime: formData.evening.defaultTime,
            label: formData.evening.label,
            timeRange: {
              earliest: formData.evening.earliest,
              latest: formData.evening.latest
            },
            isActive: formData.evening.isActive
          },
          beforeBed: {
            defaultTime: formData.beforeBed.defaultTime,
            label: formData.beforeBed.label,
            timeRange: {
              earliest: formData.beforeBed.earliest,
              latest: formData.beforeBed.latest
            },
            isActive: formData.beforeBed.isActive
          }
        },
        lifestyle: {
          wakeUpTime: lifestyleData.wakeUpTime,
          bedTime: lifestyleData.bedTime,
          timezone: lifestyleData.timezone,
          mealTimes: {
            breakfast: lifestyleData.breakfast,
            lunch: lifestyleData.lunch,
            dinner: lifestyleData.dinner
          },
          workSchedule: lifestyleData.workDays.length > 0 ? {
            workDays: lifestyleData.workDays,
            startTime: lifestyleData.workStartTime || '09:00',
            endTime: lifestyleData.workEndTime || '17:00',
            lunchTime: lifestyleData.workLunchTime
          } : undefined
        }
      };

      const result = await unifiedMedicationApi.updateTimePreferences(updates, {
        patientId,
        reason: 'User updated time bucket preferences'
      });

      if (result.success && result.data) {
        setPreferences(result.data);
        onPreferencesUpdated?.(result.data);
        console.log('✅ Time preferences updated successfully');
      } else {
        onError?.(result.error || 'Failed to update time preferences');
      }

    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeBucketChange = (
    bucket: keyof TimeBucketFormData,
    field: keyof TimeBucketFormData[keyof TimeBucketFormData],
    value: string | boolean
  ) => {
    if (!formData) return;

    setFormData({
      ...formData,
      [bucket]: {
        ...formData[bucket],
        [field]: value
      }
    });
  };

  const handleLifestyleChange = (field: keyof LifestyleFormData, value: any) => {
    if (!lifestyleData) return;

    setLifestyleData({
      ...lifestyleData,
      [field]: value
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading time preferences...</span>
      </div>
    );
  }

  if (!formData || !lifestyleData) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Failed to load time preferences</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Time Bucket Preferences</h2>
        <p className="text-gray-600">
          Customize your medication timing to fit your lifestyle. Set your preferred times for different parts of the day.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'buckets', label: 'Time Buckets', icon: '🕐' },
            { id: 'frequency', label: 'Frequency Mapping', icon: '📅' },
            { id: 'lifestyle', label: 'Lifestyle', icon: '🏠' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-600 text-sm">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Time Buckets Tab */}
      {activeTab === 'buckets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(formData).map(([bucketName, bucket]) => (
              <div key={bucketName} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 capitalize">
                    {bucketName === 'beforeBed' ? 'Before Bed' : bucketName}
                  </h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={bucket.isActive}
                      onChange={(e) => handleTimeBucketChange(bucketName as keyof TimeBucketFormData, 'isActive', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">Active</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Label
                    </label>
                    <input
                      type="text"
                      value={bucket.label}
                      onChange={(e) => handleTimeBucketChange(bucketName as keyof TimeBucketFormData, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`${bucketName} label`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Time
                    </label>
                    <input
                      type="time"
                      value={bucket.defaultTime}
                      onChange={(e) => handleTimeBucketChange(bucketName as keyof TimeBucketFormData, 'defaultTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Earliest
                      </label>
                      <input
                        type="time"
                        value={bucket.earliest}
                        onChange={(e) => handleTimeBucketChange(bucketName as keyof TimeBucketFormData, 'earliest', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Latest
                      </label>
                      <input
                        type="time"
                        value={bucket.latest}
                        onChange={(e) => handleTimeBucketChange(bucketName as keyof TimeBucketFormData, 'latest', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Schedule Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(previewSchedule).map(([frequency, times]) => (
                <div key={frequency} className="bg-white p-3 rounded border">
                  <h4 className="font-medium text-gray-700 mb-2 capitalize">
                    {frequency.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </h4>
                  <div className="text-sm text-gray-600">
                    {times?.join(', ') || 'No times'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lifestyle Tab */}
      {activeTab === 'lifestyle' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wake Up Time
              </label>
              <input
                type="time"
                value={lifestyleData.wakeUpTime}
                onChange={(e) => handleLifestyleChange('wakeUpTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bed Time
              </label>
              <input
                type="time"
                value={lifestyleData.bedTime}
                onChange={(e) => handleLifestyleChange('bedTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              value={lifestyleData.timezone}
              onChange={(e) => handleLifestyleChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="America/Chicago">Central Time (Chicago)</option>
              <option value="America/New_York">Eastern Time (New York)</option>
              <option value="America/Denver">Mountain Time (Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
            </select>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Meal Times (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Breakfast
                </label>
                <input
                  type="time"
                  value={lifestyleData.breakfast || ''}
                  onChange={(e) => handleLifestyleChange('breakfast', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lunch
                </label>
                <input
                  type="time"
                  value={lifestyleData.lunch || ''}
                  onChange={(e) => handleLifestyleChange('lunch', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dinner
                </label>
                <input
                  type="time"
                  value={lifestyleData.dinner || ''}
                  onChange={(e) => handleLifestyleChange('dinner', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-8 flex justify-end space-x-3">
        <button
          onClick={loadTimePreferences}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Reset
        </button>
        <button
          onClick={handleSavePreferences}
          disabled={isSaving || validationErrors.length > 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default TimeBucketManager;