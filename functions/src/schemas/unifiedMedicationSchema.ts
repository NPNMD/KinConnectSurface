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

import * as admin from 'firebase-admin';

// ===== UNIFIED COLLECTION 1: MEDICATION_COMMANDS =====
// Single authoritative source for all medication state

export interface MedicationCommand {
  // Primary Keys
  id: string;
  patientId: string;
  
  // Core Medication Data (consolidated from medications collection)
  medication: {
    name: string;
    genericName?: string;
    brandName?: string;
    rxcui?: string;
    ndc?: string;
    dosage: string;
    strength?: string;
    dosageForm?: string;
    route?: string;
    instructions?: string;
    prescribedBy?: string;
    prescribedDate?: Date;
    pharmacy?: string;
    prescriptionNumber?: string;
    refillsRemaining?: number;
    maxDailyDose?: string;
    sideEffects?: string[];
    notes?: string;
  };
  
  // Enhanced Schedule Configuration with flexible time scheduling
  schedule: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' | 'custom';
    times: string[]; // HH:MM format - computed from time preferences
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
    startDate: Date;
    endDate?: Date;
    isIndefinite: boolean;
    dosageAmount: string;
    scheduleInstructions?: string;
    timezone?: string; // IANA timezone (e.g., "America/Chicago")
    
    // Flexible time scheduling configuration (optional for backward compatibility)
    flexibleScheduling?: FlexibleScheduleConfiguration;
    
    // Legacy timing types (maintained for backward compatibility)
    timingType?: 'absolute' | 'meal_relative' | 'sleep_relative' | 'interval' | 'time_buckets';
    mealRelativeTiming?: {
      mealType: 'breakfast' | 'lunch' | 'dinner';
      offsetMinutes: number;
      isFlexible: boolean;
      fallbackTime?: string;
    };
    intervalTiming?: {
      intervalHours: number;
      startTime: string;
      endTime?: string;
      avoidSleepHours: boolean;
      maxDosesPerDay?: number;
    };
    
    // Time bucket overrides for this specific medication
    timeBucketOverrides?: {
      morning?: string; // HH:MM format
      lunch?: string; // HH:MM format
      evening?: string; // HH:MM format
      beforeBed?: string; // HH:MM format
    };
    
    // Computed scheduling metadata
    computedSchedule?: {
      lastComputedAt: Date;
      computedBy: string;
      basedOnPreferencesVersion: number;
      nextRecomputeAt?: Date;
    };
  };
  
  // Reminder Configuration (consolidated from medication_reminders)
  reminders: {
    enabled: boolean;
    minutesBefore: number[]; // [15, 5] = 15 min and 5 min before
    notificationMethods: ('email' | 'sms' | 'push' | 'browser')[];
    quietHours?: {
      start: string;
      end: string;
      enabled: boolean;
    };
  };
  
  // Grace Period Configuration (consolidated from medication_grace_periods)
  gracePeriod: {
    defaultMinutes: number;
    timeSlotOverrides?: {
      morning?: number;
      noon?: number;
      evening?: number;
      bedtime?: number;
    };
    medicationType: 'critical' | 'standard' | 'vitamin' | 'prn';
    weekendMultiplier?: number;
    holidayMultiplier?: number;
  };
  
  // Status and Lifecycle (consolidated from medication_status_changes)
  status: {
    current: 'active' | 'paused' | 'held' | 'discontinued' | 'completed';
    isActive: boolean;
    isPRN: boolean;
    pausedUntil?: Date;
    holdReason?: string;
    discontinueReason?: string;
    discontinueDate?: Date;
    lastStatusChange: Date;
    statusChangedBy: string;
  };
  
  // Enhanced Preferences with time bucket integration
  preferences: {
    // Time bucket preferences
    timeSlot: 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom';
    customTime?: string;
    
    // Time bucket assignment (new flexible system)
    timeBucketAssignment?: {
      primaryBucket: 'morning' | 'lunch' | 'evening' | 'beforeBed';
      secondaryBuckets?: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      allowBucketFlexibility: boolean; // Allow moving between buckets
      preferPatientDefaults: boolean; // Use patient's default times vs custom
    };
    
    // Medication-specific time preferences
    timePreferences?: {
      preferredTimeOfDay: 'early_morning' | 'morning' | 'late_morning' | 'early_afternoon' | 'afternoon' | 'late_afternoon' | 'early_evening' | 'evening' | 'late_evening' | 'bedtime' | 'any';
      avoidTimes?: string[]; // HH:MM format times to avoid
      mustTakeWith?: 'food' | 'empty_stomach' | 'water' | 'milk';
      temperaturePreference?: 'room_temp' | 'cold' | 'warm';
    };
    
    // Medication packs and organization
    packId?: string; // For medication packs
    packPosition?: number;
    
    // Drug interaction and separation rules
    separationRules?: Array<{
      separateFrom: string; // medication name or ingredient
      minimumMinutes: number;
      reason: string;
      type: 'absorption' | 'interaction' | 'effectiveness';
      severity: 'info' | 'warning' | 'critical';
    }>;
    
    // Patient convenience preferences
    conveniencePreferences?: {
      allowSnooze: boolean;
      maxSnoozeMinutes: number;
      allowSkip: boolean;
      requireNotes: boolean;
      reminderStyle: 'gentle' | 'standard' | 'persistent';
    };
  };
  
  // Metadata and Audit
  metadata: {
    version: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string;
    lastEventId?: string; // Reference to last event that modified this command
    checksum?: string; // For data integrity validation
  };
}

// ===== UNIFIED COLLECTION 2: MEDICATION_EVENTS =====
// Immutable event log for audit trail and state derivation

export interface MedicationEvent {
  // Primary Keys
  id: string;
  commandId: string; // Reference to medication_commands
  patientId: string;
  
  // Event Classification
  eventType: MedicationEventType;
  
  // Archive Status (for daily reset system)
  archiveStatus?: {
    isArchived: boolean;
    archivedAt?: Date;
    archivedReason?: 'daily_reset' | 'manual_archive' | 'retention_policy';
    belongsToDate?: string; // ISO date string (YYYY-MM-DD) for the day this event belongs to
    dailySummaryId?: string; // Reference to the daily summary document
  };
  
  // Event Data (varies by event type)
  eventData: {
    // For dose events
    scheduledDateTime?: Date;
    actualDateTime?: Date;
    dosageAmount?: string;
    takenBy?: string;
    
    // For action events (snooze, skip, reschedule)
    actionReason?: string;
    actionNotes?: string;
    snoozeMinutes?: number;
    newScheduledTime?: Date;
    skipReason?: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other';
    
    // For status changes
    previousStatus?: string;
    newStatus?: string;
    statusReason?: string;
    
    // For reminders
    reminderType?: 'email' | 'sms' | 'push' | 'browser';
    reminderSentAt?: Date;
    reminderAcknowledged?: boolean;
    
    // For safety events
    alertType?: 'interaction' | 'duplicate' | 'contraindication' | 'allergy';
    alertSeverity?: 'info' | 'warning' | 'critical';
    alertDescription?: string;
    
    // For grace period events
    gracePeriodMinutes?: number;
    gracePeriodEnd?: Date;
    appliedRules?: string[];
    
    // Generic data for extensibility
    additionalData?: Record<string, any>;
    
    // Enhanced adherence tracking
    adherenceTracking?: {
      doseAccuracy: number;          // 0-100% of prescribed dose
      timingAccuracy: number;        // 0-100% timing accuracy
      circumstanceCompliance: number; // 0-100% instruction compliance
      overallScore: number;          // Composite adherence score
      
      // Dose details
      prescribedDose: string;        // Original prescribed dose
      actualDose: string;            // Actual dose taken
      dosePercentage: number;        // Percentage of prescribed dose (100 = full dose)
      adjustmentReason?: string;     // Why dose was adjusted
      
      // Timing analysis
      timingCategory: 'early' | 'on_time' | 'late' | 'very_late';
      minutesFromScheduled: number;  // Positive = late, negative = early
      
      // Context and circumstances
      circumstances?: {
        location?: string;           // Where medication was taken
        withFood?: boolean;          // Taken with or without food
        symptoms?: string[];         // Any symptoms at time of taking
        sideEffects?: string[];      // Any side effects experienced
        effectiveness?: 'very_effective' | 'somewhat_effective' | 'not_effective' | 'unknown';
      };
    };
    
    // Undo chain tracking
    undoData?: {
      isUndo: boolean;
      originalEventId?: string;     // Event being undone
      undoEventId?: string;         // The undo event ID
      undoReason?: string;          // Why the undo was performed
      undoTimestamp?: Date;         // When the undo occurred
      correctedAction?: 'taken' | 'missed' | 'skipped' | 'rescheduled';
      correctedData?: any;          // Data for corrected action
    };
    
    // Family interaction
    familyInteraction?: {
      assistedBy?: string;          // Family member who helped
      assistanceType?: 'reminder' | 'physical_help' | 'verification' | 'encouragement';
      assistanceNotes?: string;
      notifiedFamilyMembers?: string[];
      familyResponseTime?: number;  // Minutes until family responded
      interventionType?: string;
      interventionEffectiveness?: number;
    };
  };
  
  // Context and Relationships
  context: {
    medicationName: string;
    scheduleId?: string;
    calendarEventId?: string;
    relatedEventIds?: string[]; // For event chains
    triggerSource: 'user_action' | 'system_detection' | 'scheduled_task' | 'api_call';
    userAgent?: string;
    ipAddress?: string;
  };
  
  // Timing and Grace Period
  timing: {
    eventTimestamp: Date;
    scheduledFor?: Date;
    gracePeriodEnd?: Date;
    isWithinGracePeriod?: boolean;
    minutesLate?: number;
    isOnTime?: boolean;
  };
  
  // Metadata (immutable)
  metadata: {
    eventVersion: number;
    createdAt: Date;
    createdBy: string;
    correlationId?: string; // For tracking related events
    sessionId?: string;
    deviceInfo?: {
      platform: string;
      userAgent: string;
      timestamp: Date;
    };
  };
}

// ===== UNIFIED COLLECTION 3: FAMILY_ACCESS =====
// Simplified permissions only (reuse existing family_calendar_access but simplified)

export interface UnifiedFamilyAccess {
  // Primary Keys
  id: string;
  patientId: string;
  familyMemberId: string;
  
  // Basic Information
  familyMemberName: string;
  familyMemberEmail: string;
  relationship: string;
  
  // Simplified Permissions (consolidated)
  permissions: {
    // Core permissions
    canView: boolean;
    canEdit: boolean;
    canManage: boolean; // Combines create/delete/manage
    
    // Medication-specific permissions
    canViewMedications: boolean;
    canEditMedications: boolean;
    canMarkTaken: boolean;
    canReceiveAlerts: boolean;
    
    // Emergency permissions
    isEmergencyContact: boolean;
    emergencyAccessLevel: 'none' | 'view_only' | 'full_access';
  };
  
  // Access Control
  accessLevel: 'full' | 'limited' | 'emergency_only';
  status: 'active' | 'suspended' | 'revoked' | 'pending';
  
  // Invitation System
  invitationToken?: string;
  invitationExpiresAt?: Date;
  
  // Audit Trail
  invitedAt: Date;
  acceptedAt?: Date;
  lastAccessAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== EVENT SOURCING PATTERNS =====

// Event types for medication lifecycle
export const MEDICATION_EVENT_TYPES = {
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
} as const;

// Enhanced adherence tracking event types
export const ENHANCED_ADHERENCE_EVENT_TYPES = {
  // Enhanced dose events
  DOSE_TAKEN_FULL: 'dose_taken_full',           // Full dose taken as prescribed
  DOSE_TAKEN_PARTIAL: 'dose_taken_partial',     // Partial dose taken
  DOSE_TAKEN_ADJUSTED: 'dose_taken_adjusted',   // Dose taken with adjustment
  DOSE_TAKEN_LATE: 'dose_taken_late',           // Dose taken after grace period
  DOSE_TAKEN_EARLY: 'dose_taken_early',         // Dose taken before scheduled time
  
  // Undo events
  DOSE_TAKEN_UNDONE: 'dose_taken_undone',       // Undo accidental marking
  DOSE_MISSED_CORRECTED: 'dose_missed_corrected', // Correct missed to taken
  DOSE_SKIPPED_CORRECTED: 'dose_skipped_corrected', // Correct skipped to taken
  
  // Enhanced adherence events
  ADHERENCE_PATTERN_DETECTED: 'adherence_pattern_detected', // Poor adherence pattern
  ADHERENCE_IMPROVEMENT: 'adherence_improvement',           // Adherence improving
  ADHERENCE_MILESTONE: 'adherence_milestone',               // Achievement milestone
  
  // Family interaction events
  FAMILY_REMINDER_SENT: 'family_reminder_sent',             // Family notified of missed dose
  FAMILY_ADHERENCE_ALERT: 'family_adherence_alert',         // Family alerted to poor adherence
  CAREGIVER_ASSISTANCE: 'caregiver_assistance',             // Family member helped with dose
  
  // System intelligence events
  SMART_REMINDER_SENT: 'smart_reminder_sent',               // AI-optimized reminder
  ADHERENCE_PREDICTION: 'adherence_prediction',             // Predictive adherence alert
  SCHEDULE_OPTIMIZATION: 'schedule_optimization'            // Schedule auto-optimization
} as const;

// Combined event types
export const ALL_MEDICATION_EVENT_TYPES = {
  ...MEDICATION_EVENT_TYPES,
  ...ENHANCED_ADHERENCE_EVENT_TYPES
} as const;

export type MedicationEventType = typeof ALL_MEDICATION_EVENT_TYPES[keyof typeof ALL_MEDICATION_EVENT_TYPES];

// ===== COMMAND VALIDATION SCHEMAS =====

export interface MedicationCommandValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  repairSuggestions: string[];
}

// ===== MIGRATION MAPPING =====

// Maps old collections to new unified structure
export const MIGRATION_MAPPING = {
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
} as const;

// ===== INDEXES FOR PERFORMANCE =====

export const UNIFIED_INDEXES = {
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
} as const;

// ===== FIRESTORE SECURITY RULES =====

export const UNIFIED_SECURITY_RULES = `
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

export function validateMedicationCommand(command: Partial<MedicationCommand>): MedicationCommandValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const repairSuggestions: string[] = [];
  
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
    const expectedCounts: Record<string, number> = {
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

export function validateMedicationEvent(event: Partial<MedicationEvent>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!event.commandId) errors.push('Command ID is required');
  if (!event.patientId) errors.push('Patient ID is required');
  if (!event.eventType) errors.push('Event type is required');
  if (!event.timing?.eventTimestamp) errors.push('Event timestamp is required');
  if (!event.metadata?.createdBy) errors.push('Created by is required');
  
  // Event type validation
  const validEventTypes = Object.values(MEDICATION_EVENT_TYPES);
  if (event.eventType && !validEventTypes.includes(event.eventType as any)) {
    errors.push(`Invalid event type: ${event.eventType}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ===== HELPER FUNCTIONS =====

export function generateCommandId(patientId: string, medicationName: string): string {
  const timestamp = Date.now();
  const hash = Buffer.from(`${patientId}_${medicationName}_${timestamp}`).toString('base64').slice(0, 8);
  return `cmd_${hash}`;
}

export function generateEventId(commandId: string, eventType: string): string {
  const timestamp = Date.now();
  const hash = Buffer.from(`${commandId}_${eventType}_${timestamp}`).toString('base64').slice(0, 8);
  return `evt_${hash}`;
}

export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===== DEFAULT CONFIGURATIONS =====

export const DEFAULT_GRACE_PERIODS = {
  critical: 15,  // Heart meds, insulin
  standard: 30,  // Blood pressure, cholesterol
  vitamin: 120,  // Vitamins, supplements
  prn: 0        // No grace period for PRN
} as const;

export const DEFAULT_REMINDER_SETTINGS = {
  enabled: true,
  minutesBefore: [15, 5] as number[],
  notificationMethods: ['browser', 'push'] as ('email' | 'sms' | 'push' | 'browser')[],
  quietHours: {
    start: '22:00',
    end: '07:00',
    enabled: true
  }
};

export const DEFAULT_TIME_SLOTS = {
  morning: '07:00',
  lunch: '12:00', // Updated from 'noon' to 'lunch'
  evening: '18:00',
  beforeBed: '22:00' // Updated from 'bedtime' to 'beforeBed'
} as const;

// Legacy time slots mapping for backward compatibility
export const LEGACY_TIME_SLOTS_MAPPING = {
  noon: 'lunch',
  bedtime: 'beforeBed'
} as const;

// ===== FLEXIBLE TIME SCHEDULING SYSTEM =====

/**
 * Patient Time Preferences - Customizable time buckets per patient
 * Each patient can define their own preferred times for standard time buckets
 */
export interface PatientTimePreferences {
  id: string;
  patientId: string;
  
  // Default time buckets with patient customization
  timeBuckets: {
    morning: {
      defaultTime: string; // HH:MM format (e.g., "08:00")
      label: string; // Custom label (e.g., "Morning", "Wake Up")
      timeRange: {
        earliest: string; // HH:MM format
        latest: string; // HH:MM format
      };
      isActive: boolean;
    };
    lunch: {
      defaultTime: string; // HH:MM format (e.g., "12:00")
      label: string; // Custom label (e.g., "Lunch", "Midday")
      timeRange: {
        earliest: string; // HH:MM format
        latest: string; // HH:MM format
      };
      isActive: boolean;
    };
    evening: {
      defaultTime: string; // HH:MM format (e.g., "18:00")
      label: string; // Custom label (e.g., "Evening", "Dinner")
      timeRange: {
        earliest: string; // HH:MM format
        latest: string; // HH:MM format
      };
      isActive: boolean;
    };
    beforeBed: {
      defaultTime: string; // HH:MM format (e.g., "22:00")
      label: string; // Custom label (e.g., "Before Bed", "Bedtime")
      timeRange: {
        earliest: string; // HH:MM format
        latest: string; // HH:MM format
      };
      isActive: boolean;
    };
  };
  
  // Frequency mapping - how "daily", "twice daily", etc. map to patient's times
  frequencyMapping: {
    daily: {
      preferredBucket: 'morning' | 'lunch' | 'evening' | 'beforeBed';
      fallbackBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
    };
    twiceDaily: {
      preferredBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      spacing: {
        minimumHours: number; // Minimum hours between doses
        preferredHours: number; // Preferred hours between doses
      };
    };
    threeTimes: {
      preferredBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      spacing: {
        minimumHours: number;
        preferredHours: number;
      };
    };
    fourTimes: {
      preferredBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      spacing: {
        minimumHours: number;
        preferredHours: number;
      };
    };
  };
  
  // Patient lifestyle preferences
  lifestyle: {
    wakeUpTime: string; // HH:MM format
    bedTime: string; // HH:MM format
    workSchedule?: {
      workDays: number[]; // 0-6, Sunday = 0
      startTime: string; // HH:MM format
      endTime: string; // HH:MM format
      lunchTime?: string; // HH:MM format
    };
    mealTimes?: {
      breakfast?: string; // HH:MM format
      lunch?: string; // HH:MM format
      dinner?: string; // HH:MM format
    };
    timezone: string; // IANA timezone (e.g., "America/Chicago") - REQUIRED for daily reset
  };
  
  // Metadata
  metadata: {
    version: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string;
    lastSyncedAt?: Date;
  };
}

/**
 * Enhanced schedule configuration with flexible time scheduling
 */
export interface FlexibleScheduleConfiguration {
  // Base schedule information
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' | 'custom';
  
  // Time specification method
  timeSpecification: {
    method: 'time_buckets' | 'specific_times' | 'interval_based' | 'meal_relative';
    
    // Time bucket method - uses patient's preferred time buckets
    timeBuckets?: {
      buckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      usePatientDefaults: boolean; // If true, use patient's default times
      customTimes?: { // Override patient defaults for this medication
        morning?: string;
        lunch?: string;
        evening?: string;
        beforeBed?: string;
      };
    };
    
    // Specific times method - exact times specified
    specificTimes?: {
      times: string[]; // HH:MM format
      allowFlexibility: boolean; // Allow ±30 minutes flexibility
      flexibilityMinutes?: number; // Custom flexibility window
    };
    
    // Interval-based method - every X hours
    intervalBased?: {
      intervalHours: number;
      startTime: string; // HH:MM format
      endTime?: string; // HH:MM format (if null, continues 24/7)
      respectSleepHours: boolean;
      maxDosesPerDay?: number;
    };
    
    // Meal-relative method - relative to meal times
    mealRelative?: {
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'any_meal';
      timing: 'before' | 'with' | 'after';
      offsetMinutes: number; // Minutes before/after meal
      fallbackTime?: string; // HH:MM format if meal time unknown
    };
  };
  
  // Advanced scheduling options
  advancedOptions?: {
    // Skip weekends
    skipWeekends?: boolean;
    
    // Custom days of week (overrides frequency)
    customDaysOfWeek?: number[]; // 0-6, Sunday = 0
    
    // Holiday handling
    holidayHandling?: {
      skipHolidays: boolean;
      customHolidayDates?: Date[];
    };
    
    // Dose spacing rules
    doseSpacing?: {
      minimumHoursBetweenDoses: number;
      maximumHoursBetweenDoses?: number;
      enforceSpacing: boolean;
    };
    
    // Medication interaction timing
    interactionTiming?: {
      separateFromMeals: boolean;
      separateFromOtherMeds: boolean;
      separationMinutes: number;
    };
  };
}

/**
 * Time bucket status for UI display
 */
export interface TimeBucketStatus {
  bucketName: 'morning' | 'lunch' | 'evening' | 'beforeBed';
  label: string;
  defaultTime: string;
  timeRange: {
    earliest: string;
    latest: string;
  };
  medications: Array<{
    commandId: string;
    medicationName: string;
    dosageAmount: string;
    scheduledTime: string;
    actualTime?: string;
    status: 'pending' | 'taken' | 'missed' | 'skipped';
    isOverdue: boolean;
    minutesUntilDue: number;
    gracePeriodEnd?: Date;
  }>;
  totalMedications: number;
  completedMedications: number;
  overdueMedications: number;
  isComplete: boolean;
  nextDueTime?: string;
}

/**
 * Default patient time preferences
 */
export const DEFAULT_PATIENT_TIME_PREFERENCES: Omit<PatientTimePreferences, 'id' | 'patientId' | 'metadata'> = {
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
} as const;

/**
 * Time bucket utility functions
 */
export const TIME_BUCKET_UTILS = {
  /**
   * Get time bucket for a given time
   */
  getTimeBucketForTime(time: string, preferences: PatientTimePreferences): 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom' {
    const timeMinutes = this.timeToMinutes(time);
    
    for (const [bucketName, bucket] of Object.entries(preferences.timeBuckets)) {
      const earliestMinutes = this.timeToMinutes(bucket.timeRange.earliest);
      const latestMinutes = this.timeToMinutes(bucket.timeRange.latest);
      
      if (timeMinutes >= earliestMinutes && timeMinutes <= latestMinutes) {
        return bucketName as 'morning' | 'lunch' | 'evening' | 'beforeBed';
      }
    }
    
    return 'custom';
  },
  
  /**
   * Convert HH:MM time to minutes since midnight
   */
  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },
  
  /**
   * Convert minutes since midnight to HH:MM time
   */
  minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },
  
  /**
   * Generate times for frequency using patient preferences
   */
  generateTimesForFrequency(
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily',
    preferences: PatientTimePreferences
  ): string[] {
    const mapping = preferences.frequencyMapping;
    
    switch (frequency) {
      case 'daily':
        return [preferences.timeBuckets[mapping.daily.preferredBucket].defaultTime];
      
      case 'twice_daily':
        return mapping.twiceDaily.preferredBuckets.map(
          bucket => preferences.timeBuckets[bucket].defaultTime
        );
      
      case 'three_times_daily':
        return mapping.threeTimes.preferredBuckets.map(
          bucket => preferences.timeBuckets[bucket].defaultTime
        );
      
      case 'four_times_daily':
        return mapping.fourTimes.preferredBuckets.map(
          bucket => preferences.timeBuckets[bucket].defaultTime
        );
      
      default:
        return [preferences.timeBuckets.morning.defaultTime];
    }
  },
  
  /**
   * Validate time bucket configuration
   */
  validateTimeBuckets(preferences: PatientTimePreferences): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
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
  isValidTimeFormat(time: string): boolean {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  },
  
  /**
   * Check if two time ranges overlap
   */
  rangesOverlap(range1: { start: number; end: number }, range2: { start: number; end: number }): boolean {
    return range1.start < range2.end && range2.start < range1.end;
  }
} as const;

// ===== ENHANCED ADHERENCE ANALYTICS SCHEMAS =====

/**
 * Comprehensive adherence analytics for advanced tracking and reporting
 */
export interface ComprehensiveAdherenceAnalytics {
  patientId: string;
  medicationId?: string;         // null for patient-wide analytics
  
  // Time period analysis
  analysisWindow: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    windowType: 'daily' | 'weekly' | 'monthly' | 'custom';
  };
  
  // Core adherence metrics
  adherenceMetrics: {
    totalScheduledDoses: number;
    totalTakenDoses: number;
    fullDosesTaken: number;
    partialDosesTaken: number;
    adjustedDosesTaken: number;
    missedDoses: number;
    skippedDoses: number;
    undoEvents: number;
    
    // Calculated rates
    overallAdherenceRate: number;      // (taken + partial) / scheduled
    fullDoseAdherenceRate: number;     // full doses / scheduled
    onTimeAdherenceRate: number;       // on-time doses / taken doses
    
    // Timing analysis
    averageDelayMinutes: number;
    medianDelayMinutes: number;
    maxDelayMinutes: number;
    earlyDoses: number;
    lateDoses: number;
    veryLateDoses: number;           // > 2 hours late
  };
  
  // Pattern analysis
  patterns: {
    // Time-based patterns
    mostMissedTimeSlot: 'morning' | 'lunch' | 'evening' | 'beforeBed' | null;
    mostMissedDayOfWeek: number | null; // 0-6, Sunday = 0
    weekendVsWeekdayAdherence: {
      weekday: number;
      weekend: number;
      difference: number;
    };
    
    // Behavioral patterns
    consecutiveMissedDoses: number;
    longestAdherenceStreak: number;
    currentAdherenceStreak: number;
    improvementTrend: 'improving' | 'stable' | 'declining';
    
    // Circumstantial patterns
    commonMissReasons: Array<{
      reason: string;
      count: number;
      percentage: number;
    }>;
    effectivenessReports: Array<{
      effectiveness: string;
      count: number;
      percentage: number;
    }>;
    
    // Undo patterns
    undoPatterns: {
      totalUndos: number;
      undoReasons: Array<{
        reason: string;
        count: number;
      }>;
      averageUndoTime: number;      // Seconds between take and undo
      mostCommonUndoTime: string;   // Time of day when undos happen most
    };
  };
  
  // Risk assessment
  riskAssessment: {
    currentRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
    protectiveFactors: string[];
    interventionRecommendations: string[];
    
    // Predictive analytics
    predictedAdherenceNext7Days: number;
    confidenceLevel: number;        // 0-100% confidence in prediction
    riskTrend: 'improving' | 'stable' | 'worsening';
  };
  
  // Family engagement
  familyEngagement: {
    familyNotificationsSent: number;
    familyInterventions: number;
    caregiverAssistance: number;
    familyMotivationalMessages: number;
    familyResponseRate: number;     // Percentage of notifications responded to
    averageFamilyResponseTime: number; // Minutes
  };
  
  // Metadata
  calculatedAt: Date;
  calculatedBy: string;
  dataVersion: number;
  nextCalculationDue: Date;
}

/**
 * Adherence analytics document for Firestore storage
 */
export interface AdherenceAnalyticsDocument {
  id: string;
  patientId: string;
  medicationId?: string;         // null for patient-wide analytics
  
  // Analysis window
  analysisWindow: {
    startDate: Date;
    endDate: Date;
    windowType: 'daily' | 'weekly' | 'monthly' | 'custom';
  };
  
  // Comprehensive metrics
  metrics: ComprehensiveAdherenceAnalytics;
  
  // Metadata
  calculatedAt: Date;
  calculatedBy: string;
  version: number;
  expiresAt: Date;               // For automatic cleanup
}

/**
 * Enhanced take button state for frontend
 */
export interface EnhancedTakeButtonState {
  // Button states
  buttonState: 'ready' | 'taking' | 'taken' | 'undoable' | 'processing_undo' | 'confirmed';
  
  // Visual feedback
  visualState: {
    showCheckmark: boolean;
    showUndoOption: boolean;
    undoTimeoutSeconds: number;    // Countdown for undo availability
    pulseAnimation: boolean;
    colorState: 'default' | 'success' | 'warning' | 'error';
    progressPercentage?: number;   // For undo countdown
  };
  
  // Interaction tracking
  interactionData: {
    buttonPressedAt?: Date;
    confirmationShownAt?: Date;
    undoAvailableUntil?: Date;
    lastActionType?: 'take' | 'undo' | 'skip' | 'snooze';
    eventId?: string;              // Associated event ID
  };
  
  // Error handling
  errorState?: {
    hasError: boolean;
    errorMessage: string;
    retryAvailable: boolean;
    retryCount: number;
    lastRetryAt?: Date;
  };
}

/**
 * Enhanced take medication request
 */
export interface EnhancedTakeMedicationRequest {
  // Existing fields
  takenAt?: Date;
  notes?: string;
  scheduledDateTime: Date;
  notifyFamily?: boolean;
  
  // Enhanced fields
  doseDetails?: {
    prescribedDose: string;
    actualDose: string;
    doseAdjustment?: {
      reason: string;
      approvedBy?: string;
      adjustmentType: 'reduced' | 'increased' | 'split' | 'combined';
    };
  };
  
  circumstances?: {
    location?: string;
    withFood?: boolean;
    symptoms?: string[];
    assistedBy?: string;
    assistanceType?: 'reminder' | 'physical_help' | 'verification';
    deviceUsed?: string;
  };
  
  deviceContext?: {
    platform: string;
    userAgent: string;
    timestamp: Date;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  };
  
  // Adherence context
  adherenceContext?: {
    isPartOfStreak: boolean;
    streakDay?: number;
    previousMissedDoses: number;
    recentAdherenceRate: number;
  };
}

/**
 * Undo medication request
 */
export interface UndoMedicationRequest {
  originalEventId: string;        // Event to undo
  undoReason: string;            // Why undoing
  correctedAction?: 'missed' | 'skipped' | 'rescheduled' | 'none';
  correctedData?: any;           // Data for corrected action
  notifyFamily?: boolean;
  undoNotes?: string;
}

/**
 * Adherence milestone definitions
 */
export const ADHERENCE_MILESTONES = {
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
} as const;

// ===== DAILY RESET AND ARCHIVING SYSTEM =====

/**
 * Daily Summary Document
 * Created at midnight (patient's timezone) to summarize the previous day's medication events
 */
export interface MedicationDailySummary {
  id: string;
  patientId: string;
  
  // Date information
  summaryDate: string; // ISO date string (YYYY-MM-DD) for the day being summarized
  timezone: string; // IANA timezone (e.g., "America/Chicago")
  
  // Summary statistics
  statistics: {
    totalScheduledDoses: number;
    totalTakenDoses: number;
    totalMissedDoses: number;
    totalSkippedDoses: number;
    totalSnoozedDoses: number;
    adherenceRate: number; // Percentage (0-100)
    onTimeRate: number; // Percentage of taken doses that were on time
    averageDelayMinutes: number;
  };
  
  // Medication breakdown
  medicationBreakdown: Array<{
    commandId: string;
    medicationName: string;
    scheduledDoses: number;
    takenDoses: number;
    missedDoses: number;
    skippedDoses: number;
    adherenceRate: number;
  }>;
  
  // Events archived
  archivedEvents: {
    totalArchived: number;
    eventIds: string[]; // References to archived events
    archivedAt: Date;
  };
  
  // Metadata
  metadata: {
    createdAt: Date;
    createdBy: string; // 'system' for automated creation
    version: number;
  };
}

/**
 * Archive Status for filtering queries
 */
export interface ArchiveStatusFilter {
  includeArchived?: boolean; // Default: false
  onlyArchived?: boolean; // Default: false
  archivedAfter?: Date;
  archivedBefore?: Date;
  belongsToDate?: string; // ISO date string
}

/**
 * Adherence risk levels and thresholds
 */
export const ADHERENCE_RISK_LEVELS = {
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
} as const;