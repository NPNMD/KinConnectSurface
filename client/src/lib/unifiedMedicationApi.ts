/**
 * Unified Medication API Client
 * 
 * Frontend adapter for the unified medication data flow.
 * Replaces the fragmented medicationCalendarApi with a clean, unified interface.
 * 
 * Key Features:
 * - Single source of truth for medication data
 * - Event-driven architecture
 * - Transactional consistency
 * - Simplified API surface
 * - Backward compatibility during transition
 * - Flexible time scheduling capabilities
 */

import type { ApiResponse } from '@shared/types';
import { getIdToken, validateAuthState } from './firebase';

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// ===== UNIFIED TYPES =====

export interface UnifiedMedicationCommand {
  id: string;
  patientId: string;
  medication: {
    name: string;
    genericName?: string;
    brandName?: string;
    rxcui?: string;
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
  schedule: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
    times: string[];
    daysOfWeek?: number[];
    dayOfMonth?: number;
    startDate: Date;
    endDate?: Date;
    isIndefinite: boolean;
    dosageAmount: string;
    scheduleInstructions?: string;
  };
  reminders: {
    enabled: boolean;
    minutesBefore: number[];
    notificationMethods: ('email' | 'sms' | 'push' | 'browser')[];
    quietHours?: {
      start: string;
      end: string;
      enabled: boolean;
    };
  };
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
  preferences: {
    timeSlot: 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom';
    customTime?: string;
    packId?: string;
    packPosition?: number;
  };
  metadata: {
    version: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string;
    lastEventId?: string;
    checksum?: string;
  };
}

export interface UnifiedMedicationEvent {
  id: string;
  commandId: string;
  patientId: string;
  eventType: string;
  eventData: {
    scheduledDateTime?: Date;
    actualDateTime?: Date;
    dosageAmount?: string;
    takenBy?: string;
    actionReason?: string;
    actionNotes?: string;
    snoozeMinutes?: number;
    newScheduledTime?: Date;
    skipReason?: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other';
    additionalData?: Record<string, any>;
  };
  context: {
    medicationName: string;
    scheduleId?: string;
    calendarEventId?: string;
    triggerSource: 'user_action' | 'system_detection' | 'scheduled_task' | 'api_call';
  };
  timing: {
    eventTimestamp: Date;
    scheduledFor?: Date;
    gracePeriodEnd?: Date;
    isWithinGracePeriod?: boolean;
    minutesLate?: number;
    isOnTime?: boolean;
  };
  metadata: {
    eventVersion: number;
    createdAt: Date;
    createdBy: string;
    correlationId?: string;
    sessionId?: string;
  };
}

export interface TodayMedicationBuckets {
  now: Array<{
    commandId: string;
    eventId: string;
    medicationName: string;
    dosageAmount: string;
    scheduledTime: Date;
    minutesUntilDue: number;
    isOverdue: boolean;
    gracePeriodEnd?: Date;
    instructions?: string;
    timeSlot: string;
  }>;
  dueSoon: Array<any>;
  morning: Array<any>;
  lunch: Array<any>; // Updated from 'noon'
  evening: Array<any>;
  beforeBed: Array<any>; // Updated from 'bedtime'
  overdue: Array<any>;
  completed: Array<any>;
  lastUpdated: Date;
}

// ===== TIME BUCKET TYPES =====

export interface PatientTimePreferences {
  id: string;
  patientId: string;
  timeBuckets: {
    morning: {
      defaultTime: string;
      label: string;
      timeRange: { earliest: string; latest: string };
      isActive: boolean;
    };
    lunch: {
      defaultTime: string;
      label: string;
      timeRange: { earliest: string; latest: string };
      isActive: boolean;
    };
    evening: {
      defaultTime: string;
      label: string;
      timeRange: { earliest: string; latest: string };
      isActive: boolean;
    };
    beforeBed: {
      defaultTime: string;
      label: string;
      timeRange: { earliest: string; latest: string };
      isActive: boolean;
    };
  };
  frequencyMapping: {
    daily: {
      preferredBucket: 'morning' | 'lunch' | 'evening' | 'beforeBed';
      fallbackBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
    };
    twiceDaily: {
      preferredBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      spacing: { minimumHours: number; preferredHours: number };
    };
    threeTimes: {
      preferredBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      spacing: { minimumHours: number; preferredHours: number };
    };
    fourTimes: {
      preferredBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
      spacing: { minimumHours: number; preferredHours: number };
    };
  };
  lifestyle: {
    wakeUpTime: string;
    bedTime: string;
    workSchedule?: {
      workDays: number[];
      startTime: string;
      endTime: string;
      lunchTime?: string;
    };
    mealTimes?: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
    };
    timezone: string;
  };
  metadata: {
    version: number;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string;
    lastSyncedAt?: Date;
  };
}

export interface TimeBucketStatus {
  bucketName: 'morning' | 'lunch' | 'evening' | 'beforeBed';
  label: string;
  defaultTime: string;
  timeRange: { earliest: string; latest: string };
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

// ===== AUTHENTICATION HELPER =====

async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const authValidation = await validateAuthState();
    if (!authValidation.isValid) {
      throw new Error(authValidation.error || 'Authentication required');
    }

    const token = await getIdToken();
    if (!token) {
      throw new Error('Failed to obtain authentication token');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  } catch (error) {
    console.error('🔐 Error preparing auth headers:', error);
    throw error;
  }
}

// ===== UNIFIED MEDICATION API CLIENT =====

export class UnifiedMedicationApi {
  
  // ===== MEDICATION COMMANDS API =====

  /**
   * Create a new medication with complete workflow
   */
  async createMedication(medicationData: {
    name: string;
    genericName?: string;
    dosage: string;
    frequency: string;
    instructions?: string;
    prescribedBy?: string;
    prescribedDate?: Date;
    startDate?: Date;
    endDate?: Date;
    reminderTimes?: string[];
    hasReminders?: boolean;
    usePatientTimePreferences?: boolean;
  }): Promise<ApiResponse<{
    command: UnifiedMedicationCommand;
    workflow: {
      workflowId: string;
      correlationId: string;
      eventsCreated: number;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('🚀 UnifiedMedicationApi: Creating medication:', medicationData.name);

      const headers = await getAuthHeaders();
      
      // Map legacy data to unified structure
      const requestData = {
        medicationData: {
          name: medicationData.name,
          genericName: medicationData.genericName,
          dosage: medicationData.dosage,
          instructions: medicationData.instructions,
          prescribedBy: medicationData.prescribedBy,
          prescribedDate: medicationData.prescribedDate
        },
        scheduleData: {
          frequency: this.mapFrequencyToUnified(medicationData.frequency),
          times: medicationData.reminderTimes,
          startDate: medicationData.startDate || new Date(),
          endDate: medicationData.endDate,
          dosageAmount: medicationData.dosage,
          usePatientTimePreferences: medicationData.usePatientTimePreferences ?? true
        },
        reminderSettings: {
          enabled: medicationData.hasReminders ?? true,
          minutesBefore: [15, 5],
          notificationMethods: ['browser', 'push']
        },
        notifyFamily: false
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication created successfully:', result.data?.id);

      return result;

    } catch (error) {
      console.error('❌ Error creating medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication'
      };
    }
  }

  /**
   * Get medications for a patient
   */
  async getMedications(options: {
    patientId?: string;
    status?: string;
    isActive?: boolean;
    isPRN?: boolean;
  } = {}): Promise<ApiResponse<UnifiedMedicationCommand[]>> {
    try {
      console.log('🔍 UnifiedMedicationApi: Getting medications');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.status) params.append('status', options.status);
      if (options.isActive !== undefined) params.append('isActive', options.isActive.toString());
      if (options.isPRN !== undefined) params.append('isPRN', options.isPRN.toString());

      const url = `${API_BASE}/unified-medication/medication-commands${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log(`✅ Found ${result.data?.length || 0} medications`);

      return result;

    } catch (error) {
      console.error('❌ Error getting medications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get medications'
      };
    }
  }

  /**
   * Enhanced mark medication as taken with comprehensive adherence tracking
   */
  async markMedicationTaken(
    commandId: string,
    options: {
      takenAt?: Date;
      notes?: string;
      scheduledDateTime: Date;
      notifyFamily?: boolean;
      doseDetails?: {
        prescribedDose?: string;
        actualDose?: string;
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
      };
    }
  ): Promise<ApiResponse<{
    eventId: string;
    commandId: string;
    takenAt: Date;
    adherenceScore: number;
    timingCategory: string;
    undoAvailableUntil: Date;
    streakUpdated?: {
      previousStreak: number;
      newStreak: number;
      milestone?: string;
    };
    newMilestones?: Array<{
      milestone: string;
      achievedAt: Date;
      description: string;
      icon: string;
    }>;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('💊 UnifiedMedicationApi: Enhanced marking medication as taken:', commandId);

      const headers = await getAuthHeaders();
      
      const requestData = {
        takenAt: options.takenAt?.toISOString(),
        notes: options.notes,
        scheduledDateTime: options.scheduledDateTime.toISOString(),
        notifyFamily: options.notifyFamily || false,
        doseDetails: options.doseDetails,
        circumstances: options.circumstances,
        deviceContext: {
          platform: navigator.platform || 'web',
          userAgent: navigator.userAgent,
          timestamp: new Date()
        }
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}/take`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication marked as taken successfully with adherence tracking');

      return result;

    } catch (error) {
      console.error('❌ Error marking medication as taken:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark medication as taken'
      };
    }
  }

  /**
   * Undo accidental medication marking
   */
  async undoMedicationTaken(
    commandId: string,
    options: {
      originalEventId: string;
      undoReason: string;
      correctedAction?: 'missed' | 'skipped' | 'rescheduled' | 'none';
      correctedData?: any;
      notifyFamily?: boolean;
      undoNotes?: string;
    }
  ): Promise<ApiResponse<{
    undoEventId: string;
    originalEventId: string;
    correctedAction?: string;
    adherenceImpact: {
      previousScore: number;
      newScore: number;
      streakImpact: string;
    };
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('🔄 UnifiedMedicationApi: Undoing medication taken:', commandId);

      const headers = await getAuthHeaders();
      
      const requestData = {
        originalEventId: options.originalEventId,
        undoReason: options.undoReason,
        correctedAction: options.correctedAction,
        correctedData: options.correctedData,
        notifyFamily: options.notifyFamily || false,
        undoNotes: options.undoNotes
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}/undo-take`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication take action undone successfully');

      return result;

    } catch (error) {
      console.error('❌ Error undoing medication taken:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to undo medication taken'
      };
    }
  }

  /**
   * Get comprehensive adherence analytics
   */
  async getComprehensiveAdherence(options: {
    patientId?: string;
    medicationId?: string;
    startDate?: Date;
    endDate?: Date;
    includePatterns?: boolean;
    includePredictions?: boolean;
    includeFamilyData?: boolean;
  } = {}): Promise<ApiResponse<any>> {
    try {
      console.log('📊 UnifiedMedicationApi: Getting comprehensive adherence analytics');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.medicationId) params.append('medicationId', options.medicationId);
      if (options.startDate) params.append('startDate', options.startDate.toISOString());
      if (options.endDate) params.append('endDate', options.endDate.toISOString());
      if (options.includePatterns !== undefined) params.append('includePatterns', options.includePatterns.toString());
      if (options.includePredictions !== undefined) params.append('includePredictions', options.includePredictions.toString());
      if (options.includeFamilyData !== undefined) params.append('includeFamilyData', options.includeFamilyData.toString());

      const url = `${API_BASE}/unified-medication/medication-events/adherence/comprehensive${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Comprehensive adherence analytics retrieved successfully');

      return result;

    } catch (error) {
      console.error('❌ Error getting comprehensive adherence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get comprehensive adherence analytics'
      };
    }
  }

  /**
   * Generate adherence report
   */
  async generateAdherenceReport(options: {
    patientId?: string;
    reportType?: 'daily' | 'weekly' | 'monthly' | 'custom';
    format?: 'summary' | 'detailed' | 'family_friendly';
    includeCharts?: boolean;
    medicationIds?: string[];
  } = {}): Promise<ApiResponse<any>> {
    try {
      console.log('📋 UnifiedMedicationApi: Generating adherence report');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.reportType) params.append('reportType', options.reportType);
      if (options.format) params.append('format', options.format);
      if (options.includeCharts !== undefined) params.append('includeCharts', options.includeCharts.toString());
      if (options.medicationIds) params.append('medicationIds', options.medicationIds.join(','));

      const url = `${API_BASE}/unified-medication/medication-events/adherence/report${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Adherence report generated successfully');

      return result;

    } catch (error) {
      console.error('❌ Error generating adherence report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate adherence report'
      };
    }
  }

  /**
   * Check adherence milestones
   */
  async checkAdherenceMilestones(options: {
    patientId?: string;
    medicationId?: string;
  } = {}): Promise<ApiResponse<{
    newMilestones: Array<{
      milestone: string;
      achievedAt: Date;
      description: string;
      icon: string;
    }>;
    currentStreaks: Array<{
      medicationId: string;
      medicationName: string;
      streakDays: number;
      nextMilestone?: string;
    }>;
  }>> {
    try {
      console.log('🏆 UnifiedMedicationApi: Checking adherence milestones');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.medicationId) params.append('medicationId', options.medicationId);

      const url = `${API_BASE}/unified-medication/medication-events/adherence/milestones${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Adherence milestones checked successfully');

      return result;

    } catch (error) {
      console.error('❌ Error checking adherence milestones:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check adherence milestones'
      };
    }
  }

  /**
   * Get time bucket status for a date
   */
  async getTimeBucketStatus(options: {
    patientId?: string;
    date?: Date;
    includeMedications?: boolean;
    includeCompleted?: boolean;
  } = {}): Promise<ApiResponse<TimeBucketStatus[]>> {
    try {
      console.log('🗂️ UnifiedMedicationApi: Getting time bucket status');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.date) params.append('date', options.date.toISOString());
      if (options.includeMedications !== undefined) params.append('includeMedications', options.includeMedications.toString());
      if (options.includeCompleted !== undefined) params.append('includeCompleted', options.includeCompleted.toString());

      const url = `${API_BASE}/unified-medication/time-buckets/status${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Time bucket status retrieved successfully');

      return result;

    } catch (error) {
      console.error('❌ Error getting time bucket status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time bucket status'
      };
    }
  }

  /**
   * Get today's medication buckets
   */
  async getTodayMedicationBuckets(
    date?: Date,
    options: { patientId?: string; forceFresh?: boolean } = {}
  ): Promise<ApiResponse<TodayMedicationBuckets>> {
    try {
      console.log('🗂️ UnifiedMedicationApi: Getting today\'s medication buckets');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (date) params.append('date', date.toISOString().split('T')[0]);
      if (options.patientId) params.append('patientId', options.patientId);

      const url = `${API_BASE}/unified-medication/medication-views/today-buckets${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Today\'s medication buckets retrieved successfully');

      return result;

    } catch (error) {
      console.error('❌ Error getting today\'s medication buckets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get today\'s medication buckets'
      };
    }
  }

  // ===== TIME BUCKET API METHODS =====

  /**
   * Get patient time preferences
   */
  async getTimePreferences(patientId?: string): Promise<ApiResponse<PatientTimePreferences>> {
    try {
      console.log('🕐 UnifiedMedicationApi: Getting time preferences');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (patientId) params.append('patientId', patientId);

      const url = `${API_BASE}/unified-medication/time-buckets/preferences${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Time preferences retrieved successfully');

      return result;

    } catch (error) {
      console.error('❌ Error getting time preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time preferences'
      };
    }
  }

  /**
   * Update patient time preferences
   */
  async updateTimePreferences(
    updates: Partial<Omit<PatientTimePreferences, 'id' | 'patientId' | 'metadata'>>,
    options: {
      patientId?: string;
      reason?: string;
    } = {}
  ): Promise<ApiResponse<PatientTimePreferences>> {
    try {
      console.log('🕐 UnifiedMedicationApi: Updating time preferences');

      const headers = await getAuthHeaders();

      const requestData = {
        patientId: options.patientId,
        updates,
        reason: options.reason
      };

      const response = await fetch(`${API_BASE}/unified-medication/time-buckets/preferences`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Time preferences updated successfully');

      return result;

    } catch (error) {
      console.error('❌ Error updating time preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update time preferences'
      };
    }
  }

  /**
   * Compute medication schedule based on patient preferences
   */
  async computeMedicationSchedule(options: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily';
    medicationName: string;
    patientId?: string;
    customOverrides?: {
      morning?: string;
      lunch?: string;
      evening?: string;
      beforeBed?: string;
    };
  }): Promise<ApiResponse<{
    times: string[];
    timeBuckets: ('morning' | 'lunch' | 'evening' | 'beforeBed')[];
    computedAt: Date;
    basedOnPreferencesVersion: number;
  }>> {
    try {
      console.log('🕐 UnifiedMedicationApi: Computing medication schedule');

      const headers = await getAuthHeaders();

      const requestData = {
        patientId: options.patientId,
        frequency: options.frequency,
        medicationName: options.medicationName,
        customOverrides: options.customOverrides
      };

      const response = await fetch(`${API_BASE}/unified-medication/time-buckets/compute-schedule`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication schedule computed successfully');

      return result;

    } catch (error) {
      console.error('❌ Error computing medication schedule:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compute medication schedule'
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Map legacy frequency to unified frequency
   */
  private mapFrequencyToUnified(frequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' {
    const freq = frequency.toLowerCase();
    
    if (freq.includes('twice') || freq.includes('bid')) return 'twice_daily';
    if (freq.includes('three') || freq.includes('tid')) return 'three_times_daily';
    if (freq.includes('four') || freq.includes('qid')) return 'four_times_daily';
    if (freq.includes('weekly')) return 'weekly';
    if (freq.includes('monthly')) return 'monthly';
    if (freq.includes('needed') || freq.includes('prn')) return 'as_needed';
    
    return 'daily';
  }

  /**
   * Check system health
   */
  async getSystemHealth(): Promise<ApiResponse<{
    status: string;
    version: string;
    services: Record<string, string>;
    endpoints: {
      commands: number;
      events: number;
      views: number;
      timeBuckets: number;
      total: number;
    };
    features: Record<string, boolean>;
  }>> {
    try {
      const response = await fetch(`${API_BASE}/unified-medication/health`, {
        method: 'GET',
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;

    } catch (error) {
      console.error('❌ Error getting system health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get system health'
      };
    }
  }
}

// Export singleton instance
export const unifiedMedicationApi = new UnifiedMedicationApi();

// ===== BACKWARD COMPATIBILITY ADAPTER =====

/**
 * Backward compatibility adapter for existing medicationCalendarApi
 * This allows existing frontend code to work during the transition
 */
export class BackwardCompatibilityAdapter {
  
  /**
   * Adapter for getTodayMedicationBuckets (legacy format)
   */
  async getTodayMedicationBuckets(
    date?: Date,
    options: { patientId?: string; forceFresh?: boolean } = {}
  ): Promise<ApiResponse<any>> {
    try {
      const result = await unifiedMedicationApi.getTodayMedicationBuckets(date, options);
      
      if (!result.success) {
        return result;
      }

      // Convert unified format to legacy format for compatibility
      const legacyBuckets = {
        now: result.data?.now || [],
        dueSoon: result.data?.dueSoon || [],
        morning: result.data?.morning || [],
        noon: result.data?.lunch || [], // Map 'lunch' to legacy 'noon'
        evening: result.data?.evening || [],
        bedtime: result.data?.beforeBed || [], // Map 'beforeBed' to legacy 'bedtime'
        overdue: result.data?.overdue || [],
        completed: result.data?.completed || [],
        patientPreferences: {
          timeSlots: {
            morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
            noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Lunch' },
            evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
            bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Before Bed' }
          }
        },
        lastUpdated: result.data?.lastUpdated || new Date()
      };

      return {
        success: true,
        data: legacyBuckets,
        message: result.message
      };

    } catch (error) {
      console.error('❌ Compatibility adapter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compatibility adapter failed'
      };
    }
  }
}

// Export backward compatibility adapter
export const legacyMedicationApi = new BackwardCompatibilityAdapter();

// ===== MIGRATION HELPER =====

/**
 * Helper to gradually migrate frontend components to unified API
 */
export function createMigrationHelper() {
  return {
    // Check if unified API is available
    async isUnifiedApiAvailable(): Promise<boolean> {
      try {
        const healthResult = await unifiedMedicationApi.getSystemHealth();
        return healthResult.success;
      } catch {
        return false;
      }
    },

    // Get appropriate API instance based on availability
    async getApiInstance(): Promise<UnifiedMedicationApi | BackwardCompatibilityAdapter> {
      const isUnified = await this.isUnifiedApiAvailable();
      return isUnified ? unifiedMedicationApi : legacyMedicationApi;
    },

    // Migrate component to use unified API
    migrateComponent(componentName: string) {
      console.log(`🔄 Migrating component ${componentName} to unified medication API`);
      // This would contain component-specific migration logic
    }
  };
}