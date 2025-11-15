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
 * - Enhanced error handling and logging
 */

import type { ApiResponse } from '@shared/types';
import { getIdToken, validateAuthState } from './firebase';
import { deepStripUndefined } from '@shared/utils/serialization';

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Enhanced error types for better error handling
export class ValidationError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ServerError extends Error {
  constructor(message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = 'ServerError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

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

// ===== HELPER FUNCTIONS =====

/**
 * Parse error response and throw appropriate error type
 */
function parseErrorResponse(error: any, response?: Response): never {
  console.error('🔍 [API Client] Parsing error response:', { error, status: response?.status });
  
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    throw new NetworkError('Network request failed. Please check your internet connection.', error);
  }
  
  // Timeout errors
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    throw new TimeoutError('Request timed out. Please try again.');
  }
  
  // Server errors (5xx)
  if (response && response.status >= 500) {
    throw new ServerError(
      error.error || 'Server error occurred. Please try again later.',
      response.status,
      error
    );
  }
  
  // Validation errors (400, 422)
  if (response && (response.status === 400 || response.status === 422)) {
    throw new ValidationError(
      error.error || 'Validation failed',
      error.fieldErrors || error.validation
    );
  }
  
  // Authentication errors (401)
  if (response && response.status === 401) {
    throw new ValidationError('Authentication required. Please log in again.');
  }
  
  // Permission errors (403)
  if (response && response.status === 403) {
    throw new ValidationError('You do not have permission to perform this action.');
  }
  
  // Generic error
  throw new Error(error.error || error.message || 'An unexpected error occurred');
}

/**
 * Make API request with timeout and enhanced error handling
 */
async function makeRequest<T>(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    console.log(`🌐 [API Client] Making request to: ${url}`, {
      method: options.method,
      timeout: `${timeoutMs}ms`
    });
    
    const startTime = performance.now();
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const endTime = performance.now();
    
    console.log(`📊 [API Client] Response received:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseTime: `${(endTime - startTime).toFixed(2)}ms`
    });
    
    clearTimeout(timeoutId);
    
    // Parse response
    const result = await response.json();
    
    // Log response details
    console.log(`📦 [API Client] Response data:`, {
      success: result.success,
      hasData: !!result.data,
      hasError: !!result.error,
      dataKeys: result.data ? Object.keys(result.data) : []
    });
    
    if (!response.ok) {
      parseErrorResponse(result, response);
    }
    
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏱️ [API Client] Request timed out');
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
    }
    
    // Re-throw our custom errors
    if (error instanceof ValidationError ||
        error instanceof NetworkError ||
        error instanceof ServerError ||
        error instanceof TimeoutError) {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError) {
      console.error('🌐 [API Client] Network error:', error);
      throw new NetworkError('Network request failed. Please check your connection.', error);
    }
    
    // Generic error
    console.error('❌ [API Client] Unexpected error:', error);
    throw error;
  }
}

/**
 * Get authentication headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const authValidation = await validateAuthState();
    if (!authValidation.isValid) {
      throw new ValidationError(authValidation.error || 'Authentication required');
    }

    const token = await getIdToken();
    if (!token) {
      throw new ValidationError('Failed to obtain authentication token');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  } catch (error) {
    console.error('🔐 [API Client] Error preparing auth headers:', error);
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
      console.log('🚀 [API Client] Creating medication:', {
        name: medicationData.name,
        timestamp: new Date().toISOString()
      });

      console.log('🔍 [API Client] Input validation:', {
        name: medicationData.name,
        frequency: medicationData.frequency,
        frequencyType: typeof medicationData.frequency,
        hasReminders: medicationData.hasReminders,
        reminderTimes: medicationData.reminderTimes,
        reminderTimesIsArray: Array.isArray(medicationData.reminderTimes),
        reminderTimesLength: medicationData.reminderTimes?.length,
        usePatientTimePreferences: medicationData.usePatientTimePreferences
      });

      const headers = await getAuthHeaders();
      
      // Map frequency BEFORE using it
      const mappedFrequency = this.mapFrequencyToUnified(medicationData.frequency);
      console.log('🔍 [API Client] Frequency mapping:', {
        original: medicationData.frequency,
        mapped: mappedFrequency
      });
      
      // Map legacy data to unified structure
      // CRITICAL: Always provide times array - use defaults if empty
      const times = medicationData.reminderTimes && medicationData.reminderTimes.length > 0
        ? medicationData.reminderTimes
        : this.getDefaultTimesForFrequency(mappedFrequency);
      
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
          frequency: mappedFrequency,
          times: times, // ALWAYS provide times array
          startDate: medicationData.startDate || new Date(),
          ...(medicationData.endDate ? { endDate: medicationData.endDate } : {}),
          dosageAmount: medicationData.dosage,
          usePatientTimePreferences: medicationData.usePatientTimePreferences ?? true,
          flexibleScheduling: false // Explicitly set default to prevent undefined
        },
        reminderSettings: {
          enabled: medicationData.hasReminders ?? true,
          minutesBefore: [15, 5],
          notificationMethods: ['browser', 'push']
        },
        notifyFamily: false
      };
      
      // Strip undefined values before sending to Firestore
      const cleanedRequestData = deepStripUndefined(requestData);

      console.log('📤 [API Client] Request payload:', {
        endpoint: '/unified-medication/medication-commands',
        method: 'POST',
        scheduleFrequency: requestData.scheduleData.frequency,
        scheduleTimes: requestData.scheduleData.times,
        usePatientPrefs: requestData.scheduleData.usePatientTimePreferences,
        remindersEnabled: requestData.reminderSettings.enabled
      });

      const endpoint = `${API_BASE}/unified-medication/medication-commands`;
      
      // Use enhanced request handler with timeout
      const result = await makeRequest<ApiResponse<{
        command: UnifiedMedicationCommand;
        workflow: {
          workflowId: string;
          correlationId: string;
          eventsCreated: number;
          notificationsSent: number;
          executionTimeMs: number;
        };
      }>>(endpoint, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(cleanedRequestData)
      }, 30000); // 30 second timeout

      console.log('✅ [API Client] Medication created successfully:', {
        commandId: result.data?.id || result.data?.command?.id,
        timestamp: result.data?.timestamp,
        hasFullCommand: !!result.data?.command,
        workflowId: result.data?.workflow?.workflowId,
        eventsCreated: result.data?.workflow?.eventsCreated
      });

      return result;

    } catch (error) {
      console.error('❌ [API Client] Error creating medication:', {
        error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      // Return structured error response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication',
        ...(error instanceof ValidationError && error.fieldErrors ? { fieldErrors: error.fieldErrors } : {})
      } as ApiResponse<any>;
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

  /**
   * Pause a medication
   */
  async pauseMedication(
    commandId: string,
    reason: string,
    options: {
      pauseUntil?: Date;
      notifyFamily?: boolean;
      notes?: string;
    } = {}
  ): Promise<ApiResponse<{
    commandId: string;
    pausedUntil?: Date;
    reason: string;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('⏸️ UnifiedMedicationApi: Pausing medication:', commandId);

      const headers = await getAuthHeaders();
      
      const requestData = {
        reason,
        pauseUntil: options.pauseUntil?.toISOString(),
        notifyFamily: options.notifyFamily || false,
        notes: options.notes
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}/pause`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication paused successfully');

      return result;

    } catch (error) {
      console.error('❌ Error pausing medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause medication'
      };
    }
  }

  /**
   * Resume a paused medication
   */
  async resumeMedication(
    commandId: string,
    options: {
      notifyFamily?: boolean;
      notes?: string;
    } = {}
  ): Promise<ApiResponse<{
    commandId: string;
    resumedAt: Date;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('▶️ UnifiedMedicationApi: Resuming medication:', commandId);

      const headers = await getAuthHeaders();
      
      const requestData = {
        notifyFamily: options.notifyFamily || false,
        notes: options.notes
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}/resume`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication resumed successfully');

      return result;

    } catch (error) {
      console.error('❌ Error resuming medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume medication'
      };
    }
  }

  /**
   * Skip a dose
   */
  async skipDose(
    commandId: string,
    eventId: string,
    reason: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other',
    options: {
      notes?: string;
      notifyFamily?: boolean;
    } = {}
  ): Promise<ApiResponse<{
    eventId: string;
    commandId: string;
    skippedAt: Date;
    reason: string;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('⏭️ UnifiedMedicationApi: Skipping dose:', commandId, eventId);

      const headers = await getAuthHeaders();
      
      const requestData = {
        eventId,
        reason,
        notes: options.notes,
        notifyFamily: options.notifyFamily || false
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}/skip`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Dose skipped successfully');

      return result;

    } catch (error) {
      console.error('❌ Error skipping dose:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to skip dose'
      };
    }
  }

  /**
   * Snooze a dose
   */
  async snoozeDose(
    commandId: string,
    eventId: string,
    snoozeMinutes: number,
    options: {
      notes?: string;
      notifyFamily?: boolean;
    } = {}
  ): Promise<ApiResponse<{
    eventId: string;
    commandId: string;
    snoozedAt: Date;
    snoozeMinutes: number;
    newScheduledTime: Date;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('⏰ UnifiedMedicationApi: Snoozing dose:', commandId, eventId, snoozeMinutes);

      const headers = await getAuthHeaders();
      
      const requestData = {
        eventId,
        snoozeMinutes,
        notes: options.notes,
        notifyFamily: options.notifyFamily || false
      };

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}/snooze`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Dose snoozed successfully');

      return result;

    } catch (error) {
      console.error('❌ Error snoozing dose:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to snooze dose'
      };
    }
  }

  /**
   * Update a medication
   */
  async updateMedication(
    commandId: string,
    updates: Partial<{
      medicationData: Partial<{
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
      }>;
      scheduleData: Partial<{
        frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
        times: string[];
        daysOfWeek?: number[];
        dayOfMonth?: number;
        startDate: Date;
        endDate?: Date;
        isIndefinite: boolean;
        dosageAmount: string;
        scheduleInstructions?: string;
      }>;
      reminderSettings: Partial<{
        enabled: boolean;
        minutesBefore: number[];
        notificationMethods: ('email' | 'sms' | 'push' | 'browser')[];
        quietHours?: {
          start: string;
          end: string;
          enabled: boolean;
        };
      }>;
      status: Partial<{
        current: 'active' | 'paused' | 'held' | 'discontinued' | 'completed';
        isActive: boolean;
        isPRN: boolean;
        pausedUntil?: Date;
        holdReason?: string;
        discontinueReason?: string;
        discontinueDate?: Date;
      }>;
      preferences: Partial<{
        timeSlot: 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom';
        customTime?: string;
        packId?: string;
        packPosition?: number;
      }>;
    }>,
    options: {
      reason?: string;
      notifyFamily?: boolean;
    } = {}
  ): Promise<ApiResponse<{
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
      console.log('📝 [UnifiedMedicationApi] updateMedication called:', {
        commandId,
        updatesPayload: JSON.stringify(updates, null, 2),
        hasScheduleData: !!updates.scheduleData,
        hasReminderSettings: !!updates.reminderSettings,
        scheduleTimes: updates.scheduleData?.times,
        reminderEnabled: updates.reminderSettings?.enabled,
        options
      });

      const headers = await getAuthHeaders();
      
      const requestData = {
        updates,
        reason: options.reason,
        notifyFamily: options.notifyFamily || false
      };

      console.log('📤 [UnifiedMedicationApi] Sending PUT request:', {
        url: `${API_BASE}/unified-medication/medication-commands/${commandId}`,
        method: 'PUT',
        requestBody: JSON.stringify(requestData, null, 2),
        hasScheduleData: !!requestData.updates.scheduleData,
        scheduleTimes: requestData.updates.scheduleData?.times,
        hasReminderSettings: !!requestData.updates.reminderSettings
      });

      const response = await fetch(`${API_BASE}/unified-medication/medication-commands/${commandId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      console.log('📥 [UnifiedMedicationApi] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const result = await response.json();

      console.log('📥 [UnifiedMedicationApi] Response body:', {
        success: result.success,
        hasData: !!result.data,
        hasCommand: !!result.data?.command,
        hasWorkflow: !!result.data?.workflow,
        workflowEventsDeleted: result.data?.workflow?.eventsDeleted,
        workflowEventsCreated: result.data?.workflow?.eventsCreated,
        error: result.error,
        fullResponse: JSON.stringify(result, null, 2)
      });

      if (!response.ok) {
        console.error('❌ [UnifiedMedicationApi] Update failed:', {
          status: response.status,
          error: result.error,
          fullError: result
        });
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ [UnifiedMedicationApi] Medication updated successfully:', {
        commandId: result.data?.command?.id,
        scheduleTimes: result.data?.command?.schedule?.times,
        remindersEnabled: result.data?.command?.reminders?.enabled,
        eventsDeleted: result.data?.workflow?.eventsDeleted,
        eventsCreated: result.data?.workflow?.eventsCreated
      });

      return result;

    } catch (error) {
      console.error('❌ Error updating medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update medication'
      };
    }
  }

  /**
   * Create a medication schedule for an existing medication
   * 
   * @deprecated Schedules are now embedded in medications. Use updateMedication() with scheduleData instead.
   * This method is kept for backward compatibility but internally uses updateMedication.
   * 
   * In the unified medication system, schedules are part of medication commands.
   * When you need to add or update a schedule, update the medication with scheduleData.
   */
  async createMedicationSchedule(scheduleData: {
    medicationId: string;
    patientId: string;
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
    times: string[];
    dosageAmount: string;
    instructions?: string;
    startDate?: Date;
    endDate?: Date;
    isIndefinite?: boolean;
    generateCalendarEvents?: boolean;
    reminderMinutesBefore?: number[];
    isActive?: boolean;
  }): Promise<ApiResponse<{
    scheduleId: string;
    medicationId: string;
    patientId: string;
    eventsCreated: number;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.warn('⚠️ createMedicationSchedule is deprecated. Use updateMedication() with scheduleData instead.');
      console.log('📅 UnifiedMedicationApi: Creating medication schedule for:', scheduleData.medicationId);

      // Convert to unified update format - schedules are embedded in medications
      const updateResult = await this.updateMedication(
        scheduleData.medicationId,
        {
          scheduleData: {
            frequency: scheduleData.frequency,
            times: scheduleData.times,
            startDate: scheduleData.startDate || new Date(),
            endDate: scheduleData.endDate,
            isIndefinite: scheduleData.isIndefinite ?? true,
            dosageAmount: scheduleData.dosageAmount,
            scheduleInstructions: scheduleData.instructions
          },
          reminderSettings: {
            enabled: true,
            minutesBefore: scheduleData.reminderMinutesBefore ?? [15, 5]
          },
          status: {
            isActive: scheduleData.isActive ?? true
          }
        },
        {
          reason: 'Creating schedule for existing medication via createMedicationSchedule (deprecated)',
          notifyFamily: false
        }
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error || 'Failed to create medication schedule'
        };
      }

      // Map response to expected format for backward compatibility
      const workflow = updateResult.data?.workflow || {
        workflowId: '',
        correlationId: '',
        notificationsSent: 0,
        executionTimeMs: 0
      };

      console.log('✅ Medication schedule created successfully via updateMedication');

      return {
        success: true,
        data: {
          scheduleId: scheduleData.medicationId, // In unified system, medication ID is the schedule ID
          medicationId: scheduleData.medicationId,
          patientId: scheduleData.patientId,
          eventsCreated: workflow.eventsCreated || 0,
          workflow
        },
        message: 'Medication schedule created successfully'
      };

    } catch (error) {
      console.error('❌ Error creating medication schedule:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication schedule'
      };
    }
  }

  /**
   * Delete a medication
   */
  async deleteMedication(
    commandId: string,
    hardDelete: boolean = false,
    options: {
      reason?: string;
      notifyFamily?: boolean;
    } = {}
  ): Promise<ApiResponse<{
    commandId: string;
    deletedAt: Date;
    hardDelete: boolean;
    eventsDeleted?: number;
    workflow: {
      workflowId: string;
      correlationId: string;
      notificationsSent: number;
      executionTimeMs: number;
    };
  }>> {
    try {
      console.log('🗑️ UnifiedMedicationApi: Deleting medication:', commandId, hardDelete ? '(hard)' : '(soft)');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (hardDelete) params.append('hardDelete', 'true');

      const url = `${API_BASE}/unified-medication/medication-commands/${commandId}${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          reason: options.reason,
          notifyFamily: options.notifyFamily || false
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      console.log('✅ Medication deleted successfully');

      return result;

    } catch (error) {
      console.error('❌ Error deleting medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete medication'
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
   * Get default times for a given frequency
   */
  private getDefaultTimesForFrequency(frequency: string): string[] {
    switch (frequency) {
      case 'daily':
        return ['08:00'];
      case 'twice_daily':
        return ['08:00', '20:00'];
      case 'three_times_daily':
        return ['08:00', '14:00', '20:00'];
      case 'four_times_daily':
        return ['08:00', '12:00', '16:00', '20:00'];
      case 'as_needed':
        return []; // PRN medications don't need scheduled times
      default:
        return ['08:00'];
    }
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