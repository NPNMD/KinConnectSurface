"use strict";
/**
 * Unified Medication Data Flow Schema
 *
 * This schema reduces 7+ fragmented collections to 3 unified collections:
 * 1. medication_commands - Single authoritative source for all medication state
 * 2. medication_events - Immutable event log for audit trail and state derivation
 * 3. family_access - Simplified permissions only
 *
 * Key Benefits:
 * - Single source of truth eliminates synchronization issues
 * - Event sourcing provides complete audit trail
 * - ACID transactions ensure data consistency
 * - Simplified permissions model
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADHERENCE_RISK_LEVELS = exports.ADHERENCE_MILESTONES = exports.TIME_BUCKET_UTILS = exports.DEFAULT_PATIENT_TIME_PREFERENCES = exports.LEGACY_TIME_SLOTS_MAPPING = exports.DEFAULT_TIME_SLOTS = exports.DEFAULT_REMINDER_SETTINGS = exports.DEFAULT_GRACE_PERIODS = exports.UNIFIED_SECURITY_RULES = exports.UNIFIED_INDEXES = exports.MIGRATION_MAPPING = exports.ALL_MEDICATION_EVENT_TYPES = exports.ENHANCED_ADHERENCE_EVENT_TYPES = exports.MEDICATION_EVENT_TYPES = void 0;
exports.validateMedicationCommand = validateMedicationCommand;
exports.validateMedicationEvent = validateMedicationEvent;
exports.generateCommandId = generateCommandId;
exports.generateEventId = generateEventId;
exports.generateCorrelationId = generateCorrelationId;
// ===== EVENT SOURCING PATTERNS =====
// Event types for medication lifecycle
exports.MEDICATION_EVENT_TYPES = {
    // Lifecycle events
    MEDICATION_CREATED: 'medication_created',
    MEDICATION_UPDATED: 'medication_updated',
    MEDICATION_DELETED: 'medication_deleted',
    // Schedule events
    SCHEDULE_CREATED: 'schedule_created',
    SCHEDULE_UPDATED: 'schedule_updated',
    SCHEDULE_PAUSED: 'schedule_paused',
    SCHEDULE_RESUMED: 'schedule_resumed',
    // Dose events
    DOSE_SCHEDULED: 'dose_scheduled',
    DOSE_TAKEN: 'dose_taken',
    DOSE_MISSED: 'dose_missed',
    DOSE_SKIPPED: 'dose_skipped',
    DOSE_SNOOZED: 'dose_snoozed',
    DOSE_RESCHEDULED: 'dose_rescheduled',
    // Status events
    MEDICATION_PAUSED: 'medication_paused',
    MEDICATION_RESUMED: 'medication_resumed',
    MEDICATION_HELD: 'medication_held',
    MEDICATION_DISCONTINUED: 'medication_discontinued',
    // Notification events
    REMINDER_SENT: 'reminder_sent',
    REMINDER_ACKNOWLEDGED: 'reminder_acknowledged',
    ALERT_TRIGGERED: 'alert_triggered',
    // System events
    GRACE_PERIOD_EXPIRED: 'grace_period_expired',
    MISSED_DETECTION_RUN: 'missed_detection_run',
    DATA_MIGRATION: 'data_migration'
};
// Enhanced adherence tracking event types
exports.ENHANCED_ADHERENCE_EVENT_TYPES = {
    // Enhanced dose events
    DOSE_TAKEN_FULL: 'dose_taken_full', // Full dose taken as prescribed
    DOSE_TAKEN_PARTIAL: 'dose_taken_partial', // Partial dose taken
    DOSE_TAKEN_ADJUSTED: 'dose_taken_adjusted', // Dose taken with adjustment
    DOSE_TAKEN_LATE: 'dose_taken_late', // Dose taken after grace period
    DOSE_TAKEN_EARLY: 'dose_taken_early', // Dose taken before scheduled time
    // Undo events
    DOSE_TAKEN_UNDONE: 'dose_taken_undone', // Undo accidental marking
    DOSE_MISSED_CORRECTED: 'dose_missed_corrected', // Correct missed to taken
    DOSE_SKIPPED_CORRECTED: 'dose_skipped_corrected', // Correct skipped to taken
    // Enhanced adherence events
    ADHERENCE_PATTERN_DETECTED: 'adherence_pattern_detected', // Poor adherence pattern
    ADHERENCE_IMPROVEMENT: 'adherence_improvement', // Adherence improving
    ADHERENCE_MILESTONE: 'adherence_milestone', // Achievement milestone
    // Family interaction events
    FAMILY_REMINDER_SENT: 'family_reminder_sent', // Family notified of missed dose
    FAMILY_ADHERENCE_ALERT: 'family_adherence_alert', // Family alerted to poor adherence
    CAREGIVER_ASSISTANCE: 'caregiver_assistance', // Family member helped with dose
    // System intelligence events
    SMART_REMINDER_SENT: 'smart_reminder_sent', // AI-optimized reminder
    ADHERENCE_PREDICTION: 'adherence_prediction', // Predictive adherence alert
    SCHEDULE_OPTIMIZATION: 'schedule_optimization' // Schedule auto-optimization
};
// Combined event types
exports.ALL_MEDICATION_EVENT_TYPES = {
    ...exports.MEDICATION_EVENT_TYPES,
    ...exports.ENHANCED_ADHERENCE_EVENT_TYPES
};
// ===== MIGRATION MAPPING =====
// Maps old collections to new unified structure
exports.MIGRATION_MAPPING = {
    // Old -> New Command fields
    medications: {
        targetCollection: 'medication_commands',
        fieldMapping: {
            'name': 'medication.name',
            'genericName': 'medication.genericName',
            'brandName': 'medication.brandName',
            'dosage': 'medication.dosage',
            'frequency': 'schedule.frequency',
            'hasReminders': 'reminders.enabled',
            'reminderTimes': 'schedule.times',
            'isActive': 'status.isActive',
            'isPRN': 'status.isPRN',
            'prescribedDate': 'medication.prescribedDate',
            'startDate': 'schedule.startDate',
            'endDate': 'schedule.endDate'
        }
    },
    medication_schedules: {
        targetCollection: 'medication_commands',
        fieldMapping: {
            'frequency': 'schedule.frequency',
            'times': 'schedule.times',
            'daysOfWeek': 'schedule.daysOfWeek',
            'startDate': 'schedule.startDate',
            'endDate': 'schedule.endDate',
            'dosageAmount': 'schedule.dosageAmount',
            'isActive': 'status.isActive',
            'isPaused': 'status.current',
            'pausedUntil': 'status.pausedUntil'
        }
    },
    medication_calendar_events: {
        targetCollection: 'medication_events',
        eventTypeMapping: {
            'scheduled': 'dose_scheduled',
            'taken': 'dose_taken',
            'missed': 'dose_missed',
            'skipped': 'dose_skipped'
        },
        fieldMapping: {
            'scheduledDateTime': 'eventData.scheduledDateTime',
            'actualTakenDateTime': 'eventData.actualDateTime',
            'status': 'eventType',
            'takenBy': 'eventData.takenBy',
            'notes': 'eventData.actionNotes'
        }
    },
    family_calendar_access: {
        targetCollection: 'family_access',
        fieldMapping: {
            'permissions': 'permissions',
            'accessLevel': 'accessLevel',
            'status': 'status',
            'familyMemberName': 'familyMemberName',
            'familyMemberEmail': 'familyMemberEmail'
        }
    }
};
// ===== INDEXES FOR PERFORMANCE =====
exports.UNIFIED_INDEXES = {
    medication_commands: [
        // Primary queries
        { fields: ['patientId', 'status.isActive'], order: ['ASC', 'ASC'] },
        { fields: ['patientId', 'status.current'], order: ['ASC', 'ASC'] },
        { fields: ['patientId', 'schedule.frequency'], order: ['ASC', 'ASC'] },
        // Medication lookup
        { fields: ['medication.name'], order: ['ASC'] },
        { fields: ['medication.rxcui'], order: ['ASC'] },
        // Schedule queries
        { fields: ['patientId', 'schedule.startDate'], order: ['ASC', 'ASC'] },
        { fields: ['patientId', 'reminders.enabled'], order: ['ASC', 'ASC'] },
        // Status queries
        { fields: ['status.current', 'metadata.updatedAt'], order: ['ASC', 'DESC'] }
    ],
    medication_events: [
        // Primary event queries
        { fields: ['patientId', 'eventType', 'timing.eventTimestamp'], order: ['ASC', 'ASC', 'DESC'] },
        { fields: ['commandId', 'timing.eventTimestamp'], order: ['ASC', 'DESC'] },
        // Dose tracking
        { fields: ['patientId', 'eventType', 'timing.scheduledFor'], order: ['ASC', 'ASC', 'ASC'] },
        { fields: ['patientId', 'timing.scheduledFor', 'eventType'], order: ['ASC', 'ASC', 'ASC'] },
        // Missed medication detection
        { fields: ['patientId', 'eventType', 'timing.gracePeriodEnd'], order: ['ASC', 'ASC', 'ASC'] },
        { fields: ['timing.gracePeriodEnd', 'eventType'], order: ['ASC', 'ASC'] },
        // Audit and correlation
        { fields: ['metadata.correlationId', 'timing.eventTimestamp'], order: ['ASC', 'DESC'] },
        { fields: ['context.triggerSource', 'timing.eventTimestamp'], order: ['ASC', 'DESC'] }
    ],
    family_access: [
        // Family member queries
        { fields: ['familyMemberId', 'status'], order: ['ASC', 'ASC'] },
        { fields: ['patientId', 'status'], order: ['ASC', 'ASC'] },
        // Permission queries
        { fields: ['patientId', 'permissions.canView'], order: ['ASC', 'ASC'] },
        { fields: ['familyMemberId', 'permissions.canEdit'], order: ['ASC', 'ASC'] },
        // Emergency access
        { fields: ['permissions.isEmergencyContact', 'status'], order: ['ASC', 'ASC'] }
    ]
};
// ===== FIRESTORE SECURITY RULES =====
exports.UNIFIED_SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Medication Commands - Single source of truth
    match /medication_commands/{commandId} {
      // Patients can read/write their own medication commands
      allow read, write: if request.auth != null && 
        resource.data.patientId == request.auth.uid;
      
      // Family members can read/write based on permissions
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)) &&
        get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)).data.permissions.canViewMedications == true &&
        get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)).data.status == 'active';
        
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)) &&
        get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)).data.permissions.canEditMedications == true &&
        get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)).data.status == 'active';
    }
    
    // Medication Events - Immutable audit log
    match /medication_events/{eventId} {
      // Read access same as commands
      allow read: if request.auth != null && (
        resource.data.patientId == request.auth.uid ||
        (exists(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)) &&
         get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)).data.permissions.canView == true &&
         get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + resource.data.patientId)).data.status == 'active')
      );
      
      // Only allow creation (events are immutable)
      allow create: if request.auth != null && (
        request.resource.data.patientId == request.auth.uid ||
        (exists(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + request.resource.data.patientId)) &&
         get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + request.resource.data.patientId)).data.permissions.canEdit == true &&
         get(/databases/$(database)/documents/family_access/$(request.auth.uid + '_' + request.resource.data.patientId)).data.status == 'active')
      );
      
      // No updates or deletes allowed (immutable)
      allow update, delete: if false;
    }
    
    // Family Access - Simplified permissions
    match /family_access/{accessId} {
      // Patients can manage their family access
      allow read, write: if request.auth != null && 
        resource.data.patientId == request.auth.uid;
      
      // Family members can read their own access records
      allow read: if request.auth != null && 
        resource.data.familyMemberId == request.auth.uid;
        
      // Family members can update their last access time
      allow update: if request.auth != null && 
        resource.data.familyMemberId == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastAccessAt']);
    }
  }
}
`;
// ===== VALIDATION FUNCTIONS =====
function validateMedicationCommand(command) {
    const errors = [];
    const warnings = [];
    const repairSuggestions = [];
    // Required fields validation
    if (!command.patientId) {
        errors.push('Patient ID is required');
    }
    if (!command.medication?.name) {
        errors.push('Medication name is required');
    }
    if (!command.schedule?.frequency) {
        errors.push('Schedule frequency is required');
    }
    if (!command.schedule?.times || command.schedule.times.length === 0) {
        errors.push('Schedule times are required');
        repairSuggestions.push('Add at least one reminder time in HH:MM format');
    }
    if (!command.schedule?.dosageAmount) {
        errors.push('Dosage amount is required');
        repairSuggestions.push('Specify dosage (e.g., "1 tablet", "5mg")');
    }
    if (!command.schedule?.startDate) {
        errors.push('Start date is required');
        repairSuggestions.push('Set when the medication schedule should begin');
    }
    // Data consistency validation
    if (command.schedule?.times) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const invalidTimes = command.schedule.times.filter(time => !timeRegex.test(time));
        if (invalidTimes.length > 0) {
            errors.push(`Invalid time format: ${invalidTimes.join(', ')}`);
            repairSuggestions.push('Use 24-hour HH:MM format (e.g., 07:00, 19:30)');
        }
    }
    // Frequency consistency validation
    if (command.schedule?.frequency && command.schedule?.times) {
        const expectedCounts = {
            'daily': 1,
            'twice_daily': 2,
            'three_times_daily': 3,
            'four_times_daily': 4
        };
        const expectedCount = expectedCounts[command.schedule.frequency];
        if (expectedCount && command.schedule.times.length !== expectedCount) {
            warnings.push(`${command.schedule.frequency} typically uses ${expectedCount} time(s), but ${command.schedule.times.length} provided`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        repairSuggestions
    };
}
function validateMedicationEvent(event) {
    const errors = [];
    // Required fields
    if (!event.commandId)
        errors.push('Command ID is required');
    if (!event.patientId)
        errors.push('Patient ID is required');
    if (!event.eventType)
        errors.push('Event type is required');
    if (!event.timing?.eventTimestamp)
        errors.push('Event timestamp is required');
    if (!event.metadata?.createdBy)
        errors.push('Created by is required');
    // Event type validation
    const validEventTypes = Object.values(exports.MEDICATION_EVENT_TYPES);
    if (event.eventType && !validEventTypes.includes(event.eventType)) {
        errors.push(`Invalid event type: ${event.eventType}`);
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
// ===== HELPER FUNCTIONS =====
function generateCommandId(patientId, medicationName) {
    const timestamp = Date.now();
    const hash = Buffer.from(`${patientId}_${medicationName}_${timestamp}`).toString('base64').slice(0, 8);
    return `cmd_${hash}`;
}
function generateEventId(commandId, eventType) {
    const timestamp = Date.now();
    const hash = Buffer.from(`${commandId}_${eventType}_${timestamp}`).toString('base64').slice(0, 8);
    return `evt_${hash}`;
}
function generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// ===== DEFAULT CONFIGURATIONS =====
exports.DEFAULT_GRACE_PERIODS = {
    critical: 15, // Heart meds, insulin
    standard: 30, // Blood pressure, cholesterol
    vitamin: 120, // Vitamins, supplements
    prn: 0 // No grace period for PRN
};
exports.DEFAULT_REMINDER_SETTINGS = {
    enabled: true,
    minutesBefore: [15, 5],
    notificationMethods: ['browser', 'push'],
    quietHours: {
        start: '22:00',
        end: '07:00',
        enabled: true
    }
};
exports.DEFAULT_TIME_SLOTS = {
    morning: '07:00',
    lunch: '12:00', // Updated from 'noon' to 'lunch'
    evening: '18:00',
    beforeBed: '22:00' // Updated from 'bedtime' to 'beforeBed'
};
// Legacy time slots mapping for backward compatibility
exports.LEGACY_TIME_SLOTS_MAPPING = {
    noon: 'lunch',
    bedtime: 'beforeBed'
};
/**
 * Default patient time preferences
 */
exports.DEFAULT_PATIENT_TIME_PREFERENCES = {
    timeBuckets: {
        morning: {
            defaultTime: '08:00',
            label: 'Morning',
            timeRange: {
                earliest: '06:00',
                latest: '10:00'
            },
            isActive: true
        },
        lunch: {
            defaultTime: '12:00',
            label: 'Lunch',
            timeRange: {
                earliest: '11:00',
                latest: '14:00'
            },
            isActive: true
        },
        evening: {
            defaultTime: '18:00',
            label: 'Evening',
            timeRange: {
                earliest: '17:00',
                latest: '20:00'
            },
            isActive: true
        },
        beforeBed: {
            defaultTime: '22:00',
            label: 'Before Bed',
            timeRange: {
                earliest: '21:00',
                latest: '23:30'
            },
            isActive: true
        }
    },
    frequencyMapping: {
        daily: {
            preferredBucket: 'morning',
            fallbackBuckets: ['evening', 'lunch', 'beforeBed']
        },
        twiceDaily: {
            preferredBuckets: ['morning', 'evening'],
            spacing: {
                minimumHours: 8,
                preferredHours: 12
            }
        },
        threeTimes: {
            preferredBuckets: ['morning', 'lunch', 'evening'],
            spacing: {
                minimumHours: 6,
                preferredHours: 8
            }
        },
        fourTimes: {
            preferredBuckets: ['morning', 'lunch', 'evening', 'beforeBed'],
            spacing: {
                minimumHours: 4,
                preferredHours: 6
            }
        }
    },
    lifestyle: {
        wakeUpTime: '07:00',
        bedTime: '23:00',
        timezone: 'America/Chicago'
    }
};
/**
 * Time bucket utility functions
 */
exports.TIME_BUCKET_UTILS = {
    /**
     * Get time bucket for a given time
     */
    getTimeBucketForTime(time, preferences) {
        const timeMinutes = this.timeToMinutes(time);
        for (const [bucketName, bucket] of Object.entries(preferences.timeBuckets)) {
            const earliestMinutes = this.timeToMinutes(bucket.timeRange.earliest);
            const latestMinutes = this.timeToMinutes(bucket.timeRange.latest);
            if (timeMinutes >= earliestMinutes && timeMinutes <= latestMinutes) {
                return bucketName;
            }
        }
        return 'custom';
    },
    /**
     * Convert HH:MM time to minutes since midnight
     */
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    },
    /**
     * Convert minutes since midnight to HH:MM time
     */
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    },
    /**
     * Generate times for frequency using patient preferences
     */
    generateTimesForFrequency(frequency, preferences) {
        const mapping = preferences.frequencyMapping;
        switch (frequency) {
            case 'daily':
                return [preferences.timeBuckets[mapping.daily.preferredBucket].defaultTime];
            case 'twice_daily':
                return mapping.twiceDaily.preferredBuckets.map(bucket => preferences.timeBuckets[bucket].defaultTime);
            case 'three_times_daily':
                return mapping.threeTimes.preferredBuckets.map(bucket => preferences.timeBuckets[bucket].defaultTime);
            case 'four_times_daily':
                return mapping.fourTimes.preferredBuckets.map(bucket => preferences.timeBuckets[bucket].defaultTime);
            default:
                return [preferences.timeBuckets.morning.defaultTime];
        }
    },
    /**
     * Validate time bucket configuration
     */
    validateTimeBuckets(preferences) {
        const errors = [];
        const warnings = [];
        // Check time format
        for (const [bucketName, bucket] of Object.entries(preferences.timeBuckets)) {
            if (!this.isValidTimeFormat(bucket.defaultTime)) {
                errors.push(`Invalid default time format for ${bucketName}: ${bucket.defaultTime}`);
            }
            if (!this.isValidTimeFormat(bucket.timeRange.earliest)) {
                errors.push(`Invalid earliest time format for ${bucketName}: ${bucket.timeRange.earliest}`);
            }
            if (!this.isValidTimeFormat(bucket.timeRange.latest)) {
                errors.push(`Invalid latest time format for ${bucketName}: ${bucket.timeRange.latest}`);
            }
            // Check time range logic
            const earliestMinutes = this.timeToMinutes(bucket.timeRange.earliest);
            const latestMinutes = this.timeToMinutes(bucket.timeRange.latest);
            const defaultMinutes = this.timeToMinutes(bucket.defaultTime);
            if (earliestMinutes >= latestMinutes) {
                errors.push(`Invalid time range for ${bucketName}: earliest must be before latest`);
            }
            if (defaultMinutes < earliestMinutes || defaultMinutes > latestMinutes) {
                warnings.push(`Default time for ${bucketName} is outside the time range`);
            }
        }
        // Check for overlapping time ranges
        const buckets = Object.entries(preferences.timeBuckets);
        for (let i = 0; i < buckets.length; i++) {
            for (let j = i + 1; j < buckets.length; j++) {
                const [name1, bucket1] = buckets[i];
                const [name2, bucket2] = buckets[j];
                const range1 = {
                    start: this.timeToMinutes(bucket1.timeRange.earliest),
                    end: this.timeToMinutes(bucket1.timeRange.latest)
                };
                const range2 = {
                    start: this.timeToMinutes(bucket2.timeRange.earliest),
                    end: this.timeToMinutes(bucket2.timeRange.latest)
                };
                if (this.rangesOverlap(range1, range2)) {
                    warnings.push(`Time ranges overlap between ${name1} and ${name2}`);
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    },
    /**
     * Check if time format is valid (HH:MM)
     */
    isValidTimeFormat(time) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    },
    /**
     * Check if two time ranges overlap
     */
    rangesOverlap(range1, range2) {
        return range1.start < range2.end && range2.start < range1.end;
    }
};
/**
 * Adherence milestone definitions
 */
exports.ADHERENCE_MILESTONES = {
    FIRST_DOSE: {
        name: 'First Dose',
        description: 'Took your first dose!',
        icon: '🎯',
        requirement: { type: 'dose_count', value: 1 }
    },
    WEEK_STREAK: {
        name: 'Week Warrior',
        description: '7 days of perfect adherence!',
        icon: '🔥',
        requirement: { type: 'streak_days', value: 7 }
    },
    MONTH_CHAMPION: {
        name: 'Month Champion',
        description: '30 days of excellent adherence!',
        icon: '🏆',
        requirement: { type: 'streak_days', value: 30 }
    },
    PERFECT_WEEK: {
        name: 'Perfect Week',
        description: '100% adherence for a full week!',
        icon: '⭐',
        requirement: { type: 'weekly_adherence', value: 100 }
    },
    TIMING_MASTER: {
        name: 'Timing Master',
        description: '95% on-time doses this month!',
        icon: '⏰',
        requirement: { type: 'timing_accuracy', value: 95 }
    }
};
/**
 * Adherence risk levels and thresholds
 */
exports.ADHERENCE_RISK_LEVELS = {
    LOW: {
        threshold: 90,
        color: 'green',
        description: 'Excellent adherence',
        interventions: ['continue_current_approach']
    },
    MEDIUM: {
        threshold: 70,
        color: 'yellow',
        description: 'Good adherence with room for improvement',
        interventions: ['gentle_reminders', 'schedule_optimization']
    },
    HIGH: {
        threshold: 50,
        color: 'orange',
        description: 'Poor adherence requiring attention',
        interventions: ['family_notification', 'schedule_review', 'barrier_assessment']
    },
    CRITICAL: {
        threshold: 0,
        color: 'red',
        description: 'Very poor adherence requiring immediate intervention',
        interventions: ['immediate_family_alert', 'provider_notification', 'urgent_review']
    }
};
