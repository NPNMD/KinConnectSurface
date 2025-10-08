/**
 * TimeBucketService
 * 
 * Single Responsibility: ONLY manages patient time preferences and time bucket logic
 * 
 * This service is responsible for:
 * - Managing patient time preferences (CRUD operations)
 * - Computing medication times based on patient preferences
 * - Mapping frequencies to patient's preferred time buckets
 * - Validating time bucket configurations
 * - Generating flexible schedules based on patient lifestyle
 * 
 * This service does NOT:
 * - Manage medication commands (handled by MedicationCommandService)
 * - Process events (handled by MedicationEventService)
 * - Send notifications (handled by MedicationNotificationService)
 * - Manage transactions (handled by MedicationTransactionManager)
 */

import * as admin from 'firebase-admin';
import {
  PatientTimePreferences,
  FlexibleScheduleConfiguration,
  TimeBucketStatus,
  DEFAULT_PATIENT_TIME_PREFERENCES,
  TIME_BUCKET_UTILS,
  MedicationCommand
} from '../../schemas/unifiedMedicationSchema';

export interface CreateTimePreferencesRequest {
  patientId: string;
  timeBuckets?: Partial<PatientTimePreferences['timeBuckets']>;
  frequencyMapping?: Partial<PatientTimePreferences['frequencyMapping']>;
  lifestyle?: Partial<PatientTimePreferences['lifestyle']>;
  createdBy: string;
}

export interface UpdateTimePreferencesRequest {
  patientId: string;
  updates: Partial<Omit<PatientTimePreferences, 'id' | 'patientId' | 'metadata'>>;
  updatedBy: string;
  reason?: string;
}

export interface ComputeScheduleRequest {
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily';
  patientId: string;
  medicationName: string;
  customOverrides?: {
    morning?: string;
    lunch?: string;
    evening?: string;
    beforeBed?: string;
  };
  flexibleScheduling?: FlexibleScheduleConfiguration;
}

export interface TimeBucketQueryOptions {
  patientId: string;
  date?: Date;
  includeMedications?: boolean;
  includeCompleted?: boolean;
}

export class TimeBucketService {
  private firestore: admin.firestore.Firestore;
  private collection: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.collection = this.firestore.collection('patient_time_preferences');
  }

  // ===== PATIENT TIME PREFERENCES MANAGEMENT =====

  /**
   * Create patient time preferences
   */
  async createTimePreferences(request: CreateTimePreferencesRequest): Promise<{
    success: boolean;
    data?: PatientTimePreferences;
    error?: string;
  }> {
    try {
      console.log('🕐 TimeBucketService: Creating time preferences for patient:', request.patientId);

      // Check if preferences already exist
      const existingPrefs = await this.getTimePreferences(request.patientId);
      if (existingPrefs.success && existingPrefs.data) {
        return {
          success: false,
          error: 'Time preferences already exist for this patient. Use updateTimePreferences instead.'
        };
      }

      // Generate preferences ID
      const preferencesId = this.generatePreferencesId(request.patientId);

      // Merge with defaults
      const preferences: PatientTimePreferences = {
        id: preferencesId,
        patientId: request.patientId,
        timeBuckets: {
          ...DEFAULT_PATIENT_TIME_PREFERENCES.timeBuckets,
          ...request.timeBuckets
        },
        frequencyMapping: {
          ...DEFAULT_PATIENT_TIME_PREFERENCES.frequencyMapping,
          ...request.frequencyMapping
        },
        lifestyle: {
          ...DEFAULT_PATIENT_TIME_PREFERENCES.lifestyle,
          ...request.lifestyle
        },
        metadata: {
          version: 1,
          createdAt: new Date(),
          createdBy: request.createdBy,
          updatedAt: new Date(),
          updatedBy: request.createdBy
        }
      };

      // Validate preferences
      const validation = TIME_BUCKET_UTILS.validateTimeBuckets(preferences);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Save to Firestore
      await this.collection.doc(preferencesId).set(this.serializePreferences(preferences));

      console.log('✅ TimeBucketService: Time preferences created successfully:', preferencesId);

      return {
        success: true,
        data: preferences
      };

    } catch (error) {
      console.error('❌ TimeBucketService: Error creating time preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create time preferences'
      };
    }
  }

  /**
   * Get patient time preferences
   */
  async getTimePreferences(patientId: string): Promise<{
    success: boolean;
    data?: PatientTimePreferences;
    error?: string;
  }> {
    try {
      const query = await this.collection.where('patientId', '==', patientId).limit(1).get();
      
      if (query.empty) {
        // Return default preferences if none exist
        const defaultPrefs: PatientTimePreferences = {
          id: this.generatePreferencesId(patientId),
          patientId,
          ...DEFAULT_PATIENT_TIME_PREFERENCES,
          metadata: {
            version: 1,
            createdAt: new Date(),
            createdBy: 'system',
            updatedAt: new Date(),
            updatedBy: 'system'
          }
        };

        return {
          success: true,
          data: defaultPrefs
        };
      }

      const doc = query.docs[0];
      const preferences = this.deserializePreferences(doc.id, doc.data());

      return {
        success: true,
        data: preferences
      };

    } catch (error) {
      console.error('❌ TimeBucketService: Error getting time preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time preferences'
      };
    }
  }

  /**
   * Update patient time preferences
   */
  async updateTimePreferences(request: UpdateTimePreferencesRequest): Promise<{
    success: boolean;
    data?: PatientTimePreferences;
    error?: string;
  }> {
    try {
      console.log('🕐 TimeBucketService: Updating time preferences for patient:', request.patientId);

      // Get current preferences
      const currentResult = await this.getTimePreferences(request.patientId);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Time preferences not found'
        };
      }

      const currentPrefs = currentResult.data;

      // Merge updates
      const updatedPrefs: PatientTimePreferences = {
        ...currentPrefs,
        ...request.updates,
        metadata: {
          ...currentPrefs.metadata,
          version: currentPrefs.metadata.version + 1,
          updatedAt: new Date(),
          updatedBy: request.updatedBy
        }
      };

      // Validate updated preferences
      const validation = TIME_BUCKET_UTILS.validateTimeBuckets(updatedPrefs);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Save updated preferences
      await this.collection.doc(currentPrefs.id).set(this.serializePreferences(updatedPrefs));

      console.log('✅ TimeBucketService: Time preferences updated successfully:', currentPrefs.id);

      return {
        success: true,
        data: updatedPrefs
      };

    } catch (error) {
      console.error('❌ TimeBucketService: Error updating time preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update time preferences'
      };
    }
  }

  // ===== SCHEDULE COMPUTATION =====

  /**
   * Compute medication schedule based on patient preferences
   */
  async computeMedicationSchedule(request: ComputeScheduleRequest): Promise<{
    success: boolean;
    data?: {
      times: string[];
      timeBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      computedAt: Date;
      basedOnPreferencesVersion: number;
    };
    error?: string;
  }> {
    try {
      console.log('🕐 TimeBucketService: Computing schedule for:', request.medicationName, request.frequency);

      // Get patient preferences
      const prefsResult = await this.getTimePreferences(request.patientId);
      if (!prefsResult.success || !prefsResult.data) {
        return {
          success: false,
          error: 'Failed to get patient time preferences'
        };
      }

      const preferences = prefsResult.data;

      // Use flexible scheduling if provided
      if (request.flexibleScheduling) {
        const flexibleResult = this.computeFlexibleSchedule(request.flexibleScheduling, preferences);
        if (flexibleResult.success) {
          return {
            success: true,
            data: {
              times: flexibleResult.times!,
              timeBuckets: flexibleResult.timeBuckets!,
              computedAt: new Date(),
              basedOnPreferencesVersion: preferences.metadata.version
            }
          };
        }
      }

      // Generate times using patient preferences
      const times = TIME_BUCKET_UTILS.generateTimesForFrequency(request.frequency, preferences);
      
      // Apply custom overrides if provided
      const finalTimes = this.applyCustomOverrides(times, request.customOverrides, preferences);
      
      // Determine time buckets for each time
      const timeBuckets = finalTimes.map(time => 
        TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences)
      ).filter(bucket => bucket !== 'custom') as ('morning' | 'lunch' | 'evening' | 'beforeBed')[];

      return {
        success: true,
        data: {
          times: finalTimes,
          timeBuckets,
          computedAt: new Date(),
          basedOnPreferencesVersion: preferences.metadata.version
        }
      };

    } catch (error) {
      console.error('❌ TimeBucketService: Error computing schedule:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compute medication schedule'
      };
    }
  }

  /**
   * Get time bucket status for a specific date
   */
  async getTimeBucketStatus(options: TimeBucketQueryOptions): Promise<{
    success: boolean;
    data?: TimeBucketStatus[];
    error?: string;
  }> {
    try {
      console.log('🗂️ TimeBucketService: Getting time bucket status for patient:', options.patientId);

      // Get patient preferences
      const prefsResult = await this.getTimePreferences(options.patientId);
      if (!prefsResult.success || !prefsResult.data) {
        return {
          success: false,
          error: 'Failed to get patient time preferences'
        };
      }

      const preferences = prefsResult.data;
      const targetDate = options.date || new Date();

      // Initialize bucket status
      const bucketStatus: TimeBucketStatus[] = Object.entries(preferences.timeBuckets).map(([bucketName, bucket]) => ({
        bucketName: bucketName as 'morning' | 'lunch' | 'evening' | 'beforeBed',
        label: bucket.label,
        defaultTime: bucket.defaultTime,
        timeRange: bucket.timeRange,
        medications: [],
        totalMedications: 0,
        completedMedications: 0,
        overdueMedications: 0,
        isComplete: false
      }));

      // If medications should be included, fetch and organize them
      if (options.includeMedications) {
        // This would integrate with MedicationCommandService to get medications
        // For now, return empty medication arrays
        console.log('📊 Medication integration would happen here');
      }

      return {
        success: true,
        data: bucketStatus
      };

    } catch (error) {
      console.error('❌ TimeBucketService: Error getting bucket status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time bucket status'
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Validate time bucket configuration with enhanced 2 AM default prevention
   */
  validateTimeBuckets(preferences: PatientTimePreferences): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const baseValidation = TIME_BUCKET_UTILS.validateTimeBuckets(preferences);
    
    // Enhanced validation to prevent 2 AM defaults
    const twoAMValidation = this.validateAndPrevent2AMDefaults(preferences);
    
    return {
      isValid: baseValidation.isValid && twoAMValidation.isValid,
      errors: [...baseValidation.errors, ...twoAMValidation.errors],
      warnings: [...baseValidation.warnings, ...twoAMValidation.warnings]
    };
  }

  /**
   * Validate and prevent 2 AM default time issues
   * CRITICAL: Prevents the night shift 2 AM default bug
   */
  private validateAndPrevent2AMDefaults(preferences: PatientTimePreferences): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Determine work schedule type from lifestyle or default to standard
    const workSchedule = this.inferWorkSchedule(preferences);

    // Check each time bucket for problematic 02:00 defaults
    Object.entries(preferences.timeBuckets).forEach(([bucketName, bucket]) => {
      if (bucket.defaultTime === '02:00') {
        if (workSchedule === 'night_shift' && bucketName === 'evening') {
          // CRITICAL ERROR: This is the exact bug we're preventing
          errors.push(
            `CRITICAL: Night shift evening slot cannot default to 02:00. ` +
            `Must use 00:00 (midnight) for evening slot (23:00-02:00 range).`
          );
        } else if (workSchedule === 'night_shift') {
          // WARNING: Other night shift slots with 02:00 are unusual
          warnings.push(
            `Night shift ${bucketName} slot defaulting to 02:00 may cause confusion. ` +
            `Consider using appropriate defaults: morning=15:00, lunch=20:00, beforeBed=08:00.`
          );
        } else {
          // WARNING: Standard schedule with 02:00 is very unusual
          warnings.push(
            `${bucketName} slot defaulting to 02:00 is unusual for ${workSchedule} schedule. ` +
            `This may indicate a configuration error. Verify this is intentional.`
          );
        }
      }
    });

    // Specific validation for night shift evening slot configuration
    if (workSchedule === 'night_shift' && preferences.timeBuckets.evening) {
      const evening = preferences.timeBuckets.evening;

      // Check for the exact problematic configuration
      if (evening.timeRange.earliest === '01:00' &&
          evening.timeRange.latest === '04:00' &&
          evening.defaultTime === '02:00') {
        errors.push(
          `CRITICAL: Detected exact problematic night shift configuration. ` +
          `Evening slot must be 23:00-02:00 with 00:00 default, not 01:00-04:00 with 02:00 default.`
        );
      }

      // Ensure correct range and default for night shift evening
      if (evening.timeRange.earliest === '23:00' &&
          evening.timeRange.latest === '02:00' &&
          evening.defaultTime !== '00:00') {
        errors.push(
          `Night shift evening slot (23:00-02:00) must default to 00:00 (midnight), not ${evening.defaultTime}.`
        );
      }

      // Warn about any evening slot not using recommended configuration
      if (evening.timeRange.earliest !== '23:00' || evening.timeRange.latest !== '02:00') {
        warnings.push(
          `Night shift evening slot uses non-standard range ${evening.timeRange.earliest}-${evening.timeRange.latest}. ` +
          `Recommended: 23:00-02:00 with 00:00 default.`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Infer work schedule type from patient preferences
   */
  private inferWorkSchedule(preferences: PatientTimePreferences): 'standard' | 'night_shift' | 'custom' {
    // Check if morning slot is in afternoon (indicates night shift)
    const morningTime = TIME_BUCKET_UTILS.timeToMinutes(preferences.timeBuckets.morning.defaultTime);
    
    // Night shift typically has morning in afternoon (14:00-18:00)
    if (morningTime >= 14 * 60 && morningTime <= 18 * 60) {
      return 'night_shift';
    }

    // Check if evening slot crosses midnight (indicates night shift)
    const eveningStart = TIME_BUCKET_UTILS.timeToMinutes(preferences.timeBuckets.evening.timeRange.earliest);
    const eveningEnd = TIME_BUCKET_UTILS.timeToMinutes(preferences.timeBuckets.evening.timeRange.latest);
    
    if (eveningStart > eveningEnd) {
      // Range crosses midnight (e.g., 23:00-02:00)
      return 'night_shift';
    }

    // Standard schedule
    return 'standard';
  }

  /**
   * Get optimal time for a medication based on patient lifestyle
   */
  async getOptimalMedicationTime(
    patientId: string,
    medicationName: string,
    constraints?: {
      mustTakeWith?: 'food' | 'empty_stomach';
      avoidTimes?: string[];
      preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'bedtime';
    }
  ): Promise<{
    success: boolean;
    data?: {
      recommendedTime: string;
      recommendedBucket: 'morning' | 'lunch' | 'evening' | 'beforeBed';
      reasoning: string[];
    };
    error?: string;
  }> {
    try {
      const prefsResult = await this.getTimePreferences(patientId);
      if (!prefsResult.success || !prefsResult.data) {
        return {
          success: false,
          error: 'Failed to get patient preferences'
        };
      }

      const preferences = prefsResult.data;
      const reasoning: string[] = [];

      // Start with default morning time
      let recommendedBucket: 'morning' | 'lunch' | 'evening' | 'beforeBed' = 'morning';
      let recommendedTime = preferences.timeBuckets.morning.defaultTime;

      // Apply constraints
      if (constraints?.preferredTimeOfDay) {
        switch (constraints.preferredTimeOfDay) {
          case 'morning':
            recommendedBucket = 'morning';
            recommendedTime = preferences.timeBuckets.morning.defaultTime;
            reasoning.push('Preferred time of day: morning');
            break;
          case 'afternoon':
            recommendedBucket = 'lunch';
            recommendedTime = preferences.timeBuckets.lunch.defaultTime;
            reasoning.push('Preferred time of day: afternoon');
            break;
          case 'evening':
            recommendedBucket = 'evening';
            recommendedTime = preferences.timeBuckets.evening.defaultTime;
            reasoning.push('Preferred time of day: evening');
            break;
          case 'bedtime':
            recommendedBucket = 'beforeBed';
            recommendedTime = preferences.timeBuckets.beforeBed.defaultTime;
            reasoning.push('Preferred time of day: bedtime');
            break;
        }
      }

      // Consider meal timing
      if (constraints?.mustTakeWith === 'food') {
        if (preferences.lifestyle.mealTimes?.breakfast && recommendedBucket === 'morning') {
          recommendedTime = preferences.lifestyle.mealTimes.breakfast;
          reasoning.push('Adjusted to breakfast time for food requirement');
        } else if (preferences.lifestyle.mealTimes?.lunch && recommendedBucket === 'lunch') {
          recommendedTime = preferences.lifestyle.mealTimes.lunch;
          reasoning.push('Adjusted to lunch time for food requirement');
        } else if (preferences.lifestyle.mealTimes?.dinner && recommendedBucket === 'evening') {
          recommendedTime = preferences.lifestyle.mealTimes.dinner;
          reasoning.push('Adjusted to dinner time for food requirement');
        }
      }

      // Avoid specified times
      if (constraints?.avoidTimes && constraints.avoidTimes.includes(recommendedTime)) {
        // Find alternative time in same bucket
        const bucket = preferences.timeBuckets[recommendedBucket];
        const earliestMinutes = TIME_BUCKET_UTILS.timeToMinutes(bucket.timeRange.earliest);
        const latestMinutes = TIME_BUCKET_UTILS.timeToMinutes(bucket.timeRange.latest);
        const currentMinutes = TIME_BUCKET_UTILS.timeToMinutes(recommendedTime);
        
        // Try 30 minutes later
        const alternativeMinutes = Math.min(currentMinutes + 30, latestMinutes);
        recommendedTime = TIME_BUCKET_UTILS.minutesToTime(alternativeMinutes);
        reasoning.push('Adjusted to avoid specified time conflict');
      }

      return {
        success: true,
        data: {
          recommendedTime,
          recommendedBucket,
          reasoning
        }
      };

    } catch (error) {
      console.error('❌ TimeBucketService: Error getting optimal time:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get optimal medication time'
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Compute flexible schedule based on configuration
   */
  private computeFlexibleSchedule(
    config: FlexibleScheduleConfiguration,
    preferences: PatientTimePreferences
  ): {
    success: boolean;
    times?: string[];
    timeBuckets?: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
    error?: string;
  } {
    try {
      const { timeSpecification } = config;

      switch (timeSpecification.method) {
        case 'time_buckets':
          if (timeSpecification.timeBuckets) {
            const buckets = timeSpecification.timeBuckets.buckets;
            const times = buckets.map(bucket => {
              // Use custom time if provided, otherwise patient default
              const customTime = timeSpecification.timeBuckets?.customTimes?.[bucket];
              return customTime || preferences.timeBuckets[bucket].defaultTime;
            });
            
            return {
              success: true,
              times,
              timeBuckets: buckets
            };
          }
          break;

        case 'specific_times':
          if (timeSpecification.specificTimes) {
            const times = timeSpecification.specificTimes.times;
            const timeBuckets = times.map(time => 
              TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences)
            ).filter(bucket => bucket !== 'custom') as ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
            
            return {
              success: true,
              times,
              timeBuckets
            };
          }
          break;

        case 'interval_based':
          if (timeSpecification.intervalBased) {
            const { intervalHours, startTime, endTime, maxDosesPerDay } = timeSpecification.intervalBased;
            const times = this.generateIntervalTimes(intervalHours, startTime, endTime, maxDosesPerDay);
            const timeBuckets = times.map(time => 
              TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences)
            ).filter(bucket => bucket !== 'custom') as ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
            
            return {
              success: true,
              times,
              timeBuckets
            };
          }
          break;

        case 'meal_relative':
          if (timeSpecification.mealRelative) {
            const mealTime = this.getMealTime(timeSpecification.mealRelative, preferences);
            if (mealTime) {
              const times = [mealTime];
              const timeBuckets = [TIME_BUCKET_UTILS.getTimeBucketForTime(mealTime, preferences)]
                .filter(bucket => bucket !== 'custom') as ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
              
              return {
                success: true,
                times,
                timeBuckets
              };
            }
          }
          break;
      }

      return {
        success: false,
        error: 'Invalid flexible schedule configuration'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compute flexible schedule'
      };
    }
  }

  /**
   * Apply custom time overrides
   */
  private applyCustomOverrides(
    times: string[],
    overrides?: { morning?: string; lunch?: string; evening?: string; beforeBed?: string },
    preferences?: PatientTimePreferences
  ): string[] {
    if (!overrides || !preferences) return times;

    return times.map(time => {
      const bucket = TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences);
      
      // Only apply override if bucket is not 'custom'
      if (bucket === 'custom') return time;
      
      return overrides[bucket] || time;
    });
  }

  /**
   * Generate interval-based times
   */
  private generateIntervalTimes(
    intervalHours: number,
    startTime: string,
    endTime?: string,
    maxDoses?: number
  ): string[] {
    const times: string[] = [];
    const startMinutes = TIME_BUCKET_UTILS.timeToMinutes(startTime);
    const endMinutes = endTime ? TIME_BUCKET_UTILS.timeToMinutes(endTime) : 24 * 60;
    const intervalMinutes = intervalHours * 60;

    let currentMinutes = startMinutes;
    let doseCount = 0;

    while (currentMinutes < endMinutes && (!maxDoses || doseCount < maxDoses)) {
      times.push(TIME_BUCKET_UTILS.minutesToTime(currentMinutes));
      currentMinutes += intervalMinutes;
      doseCount++;
    }

    return times;
  }

  /**
   * Get meal time based on meal-relative configuration
   */
  private getMealTime(
    mealConfig: FlexibleScheduleConfiguration['timeSpecification']['mealRelative'],
    preferences: PatientTimePreferences
  ): string | null {
    if (!mealConfig) return null;

    let baseMealTime: string | undefined;

    switch (mealConfig.mealType) {
      case 'breakfast':
        baseMealTime = preferences.lifestyle.mealTimes?.breakfast;
        break;
      case 'lunch':
        baseMealTime = preferences.lifestyle.mealTimes?.lunch;
        break;
      case 'dinner':
        baseMealTime = preferences.lifestyle.mealTimes?.dinner;
        break;
      case 'any_meal':
        baseMealTime = preferences.lifestyle.mealTimes?.breakfast || 
                      preferences.lifestyle.mealTimes?.lunch || 
                      preferences.lifestyle.mealTimes?.dinner;
        break;
    }

    if (!baseMealTime) {
      return mealConfig.fallbackTime || null;
    }

    // Apply offset
    const baseMealMinutes = TIME_BUCKET_UTILS.timeToMinutes(baseMealTime);
    const offsetMinutes = mealConfig.timing === 'before' ? -mealConfig.offsetMinutes : 
                         mealConfig.timing === 'after' ? mealConfig.offsetMinutes : 0;
    
    const finalMinutes = baseMealMinutes + offsetMinutes;
    return TIME_BUCKET_UTILS.minutesToTime(Math.max(0, Math.min(finalMinutes, 24 * 60 - 1)));
  }

  /**
   * Generate preferences ID
   */
  private generatePreferencesId(patientId: string): string {
    return `prefs_${patientId}_${Date.now()}`;
  }

  /**
   * Serialize preferences for Firestore
   */
  private serializePreferences(preferences: PatientTimePreferences): any {
    return {
      ...preferences,
      'metadata.createdAt': admin.firestore.Timestamp.fromDate(preferences.metadata.createdAt),
      'metadata.updatedAt': admin.firestore.Timestamp.fromDate(preferences.metadata.updatedAt),
      'metadata.lastSyncedAt': preferences.metadata.lastSyncedAt ? 
        admin.firestore.Timestamp.fromDate(preferences.metadata.lastSyncedAt) : null
    };
  }

  /**
   * Deserialize preferences from Firestore
   */
  private deserializePreferences(id: string, data: any): PatientTimePreferences {
    return {
      ...data,
      id,
      metadata: {
        ...data.metadata,
        createdAt: data.metadata.createdAt.toDate(),
        updatedAt: data.metadata.updatedAt.toDate(),
        lastSyncedAt: data.metadata.lastSyncedAt?.toDate()
      }
    };
  }
}