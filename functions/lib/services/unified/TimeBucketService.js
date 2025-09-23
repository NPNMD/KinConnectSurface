"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeBucketService = void 0;
const admin = __importStar(require("firebase-admin"));
const unifiedMedicationSchema_1 = require("../../schemas/unifiedMedicationSchema");
class TimeBucketService {
    firestore;
    collection;
    constructor() {
        this.firestore = admin.firestore();
        this.collection = this.firestore.collection('patient_time_preferences');
    }
    // ===== PATIENT TIME PREFERENCES MANAGEMENT =====
    /**
     * Create patient time preferences
     */
    async createTimePreferences(request) {
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
            const preferences = {
                id: preferencesId,
                patientId: request.patientId,
                timeBuckets: {
                    ...unifiedMedicationSchema_1.DEFAULT_PATIENT_TIME_PREFERENCES.timeBuckets,
                    ...request.timeBuckets
                },
                frequencyMapping: {
                    ...unifiedMedicationSchema_1.DEFAULT_PATIENT_TIME_PREFERENCES.frequencyMapping,
                    ...request.frequencyMapping
                },
                lifestyle: {
                    ...unifiedMedicationSchema_1.DEFAULT_PATIENT_TIME_PREFERENCES.lifestyle,
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
            const validation = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.validateTimeBuckets(preferences);
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
        }
        catch (error) {
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
    async getTimePreferences(patientId) {
        try {
            const query = await this.collection.where('patientId', '==', patientId).limit(1).get();
            if (query.empty) {
                // Return default preferences if none exist
                const defaultPrefs = {
                    id: this.generatePreferencesId(patientId),
                    patientId,
                    ...unifiedMedicationSchema_1.DEFAULT_PATIENT_TIME_PREFERENCES,
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
        }
        catch (error) {
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
    async updateTimePreferences(request) {
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
            const updatedPrefs = {
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
            const validation = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.validateTimeBuckets(updatedPrefs);
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
        }
        catch (error) {
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
    async computeMedicationSchedule(request) {
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
                            times: flexibleResult.times,
                            timeBuckets: flexibleResult.timeBuckets,
                            computedAt: new Date(),
                            basedOnPreferencesVersion: preferences.metadata.version
                        }
                    };
                }
            }
            // Generate times using patient preferences
            const times = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.generateTimesForFrequency(request.frequency, preferences);
            // Apply custom overrides if provided
            const finalTimes = this.applyCustomOverrides(times, request.customOverrides, preferences);
            // Determine time buckets for each time
            const timeBuckets = finalTimes.map(time => unifiedMedicationSchema_1.TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences)).filter(bucket => bucket !== 'custom');
            return {
                success: true,
                data: {
                    times: finalTimes,
                    timeBuckets,
                    computedAt: new Date(),
                    basedOnPreferencesVersion: preferences.metadata.version
                }
            };
        }
        catch (error) {
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
    async getTimeBucketStatus(options) {
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
            const bucketStatus = Object.entries(preferences.timeBuckets).map(([bucketName, bucket]) => ({
                bucketName: bucketName,
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
        }
        catch (error) {
            console.error('❌ TimeBucketService: Error getting bucket status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get time bucket status'
            };
        }
    }
    // ===== UTILITY METHODS =====
    /**
     * Validate time bucket configuration
     */
    validateTimeBuckets(preferences) {
        return unifiedMedicationSchema_1.TIME_BUCKET_UTILS.validateTimeBuckets(preferences);
    }
    /**
     * Get optimal time for a medication based on patient lifestyle
     */
    async getOptimalMedicationTime(patientId, medicationName, constraints) {
        try {
            const prefsResult = await this.getTimePreferences(patientId);
            if (!prefsResult.success || !prefsResult.data) {
                return {
                    success: false,
                    error: 'Failed to get patient preferences'
                };
            }
            const preferences = prefsResult.data;
            const reasoning = [];
            // Start with default morning time
            let recommendedBucket = 'morning';
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
                }
                else if (preferences.lifestyle.mealTimes?.lunch && recommendedBucket === 'lunch') {
                    recommendedTime = preferences.lifestyle.mealTimes.lunch;
                    reasoning.push('Adjusted to lunch time for food requirement');
                }
                else if (preferences.lifestyle.mealTimes?.dinner && recommendedBucket === 'evening') {
                    recommendedTime = preferences.lifestyle.mealTimes.dinner;
                    reasoning.push('Adjusted to dinner time for food requirement');
                }
            }
            // Avoid specified times
            if (constraints?.avoidTimes && constraints.avoidTimes.includes(recommendedTime)) {
                // Find alternative time in same bucket
                const bucket = preferences.timeBuckets[recommendedBucket];
                const earliestMinutes = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.timeToMinutes(bucket.timeRange.earliest);
                const latestMinutes = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.timeToMinutes(bucket.timeRange.latest);
                const currentMinutes = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.timeToMinutes(recommendedTime);
                // Try 30 minutes later
                const alternativeMinutes = Math.min(currentMinutes + 30, latestMinutes);
                recommendedTime = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.minutesToTime(alternativeMinutes);
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
        }
        catch (error) {
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
    computeFlexibleSchedule(config, preferences) {
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
                        const timeBuckets = times.map(time => unifiedMedicationSchema_1.TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences)).filter(bucket => bucket !== 'custom');
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
                        const timeBuckets = times.map(time => unifiedMedicationSchema_1.TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences)).filter(bucket => bucket !== 'custom');
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
                            const timeBuckets = [unifiedMedicationSchema_1.TIME_BUCKET_UTILS.getTimeBucketForTime(mealTime, preferences)]
                                .filter(bucket => bucket !== 'custom');
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to compute flexible schedule'
            };
        }
    }
    /**
     * Apply custom time overrides
     */
    applyCustomOverrides(times, overrides, preferences) {
        if (!overrides || !preferences)
            return times;
        return times.map(time => {
            const bucket = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.getTimeBucketForTime(time, preferences);
            // Only apply override if bucket is not 'custom'
            if (bucket === 'custom')
                return time;
            return overrides[bucket] || time;
        });
    }
    /**
     * Generate interval-based times
     */
    generateIntervalTimes(intervalHours, startTime, endTime, maxDoses) {
        const times = [];
        const startMinutes = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.timeToMinutes(startTime);
        const endMinutes = endTime ? unifiedMedicationSchema_1.TIME_BUCKET_UTILS.timeToMinutes(endTime) : 24 * 60;
        const intervalMinutes = intervalHours * 60;
        let currentMinutes = startMinutes;
        let doseCount = 0;
        while (currentMinutes < endMinutes && (!maxDoses || doseCount < maxDoses)) {
            times.push(unifiedMedicationSchema_1.TIME_BUCKET_UTILS.minutesToTime(currentMinutes));
            currentMinutes += intervalMinutes;
            doseCount++;
        }
        return times;
    }
    /**
     * Get meal time based on meal-relative configuration
     */
    getMealTime(mealConfig, preferences) {
        if (!mealConfig)
            return null;
        let baseMealTime;
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
        const baseMealMinutes = unifiedMedicationSchema_1.TIME_BUCKET_UTILS.timeToMinutes(baseMealTime);
        const offsetMinutes = mealConfig.timing === 'before' ? -mealConfig.offsetMinutes :
            mealConfig.timing === 'after' ? mealConfig.offsetMinutes : 0;
        const finalMinutes = baseMealMinutes + offsetMinutes;
        return unifiedMedicationSchema_1.TIME_BUCKET_UTILS.minutesToTime(Math.max(0, Math.min(finalMinutes, 24 * 60 - 1)));
    }
    /**
     * Generate preferences ID
     */
    generatePreferencesId(patientId) {
        return `prefs_${patientId}_${Date.now()}`;
    }
    /**
     * Serialize preferences for Firestore
     */
    serializePreferences(preferences) {
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
    deserializePreferences(id, data) {
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
exports.TimeBucketService = TimeBucketService;
