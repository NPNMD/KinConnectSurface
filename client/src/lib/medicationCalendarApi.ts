import type {
  MedicationSchedule,
  NewMedicationSchedule,
  MedicationCalendarEvent,
  MedicationAdherence,
  ApiResponse,
  TodayMedicationBuckets,
  PatientMedicationPreferences,
  NewPatientMedicationPreferences,
  EnhancedMedicationCalendarEvent,
  SkipReason
} from '@shared/types';
import { getIdToken, validateAuthState } from './firebase';
import { rateLimitedFetch, RateLimitedAPI } from './rateLimiter';
import { requestDebouncer } from './requestDebouncer';

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Add diagnostic logging
console.log('🔧 MedicationCalendarApi: Using API base URL:', API_BASE);

// Enhanced helper function to get authenticated headers with validation
async function getAuthHeaders(forceRefresh: boolean = false): Promise<HeadersInit> {
  try {
    // Validate auth state first
    const authValidation = await validateAuthState();
    if (!authValidation.isValid) {
      console.error('🔐 Authentication validation failed:', authValidation.error);
      throw new Error(authValidation.error || 'Authentication required');
    }

    const token = await getIdToken(forceRefresh);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!token) {
      console.error('🔐 Failed to obtain authentication token');
      throw new Error('Failed to obtain authentication token');
    }

    headers.Authorization = `Bearer ${token}`;
    console.log('🔐 Authentication headers prepared successfully');
    
    return headers;
  } catch (error) {
    console.error('🔐 Error preparing auth headers:', error);
    throw error;
  }
}

// Enhanced error handling for API responses
function handleApiError(error: any, context: string): ApiResponse<any> {
  console.error(`❌ ${context}:`, error);
  
  // Handle authentication errors specifically
  if (error.status === 401 || error.statusCode === 401 || error.message?.includes('Authentication')) {
    return {
      success: false,
      error: 'Authentication expired. Please sign in again.'
    };
  }
  
  if (error.status === 403 || error.statusCode === 403) {
    return {
      success: false,
      error: 'Access denied. You may not have permission for this action.'
    };
  }
  
  if (error.status === 429 || error.statusCode === 429) {
    return {
      success: false,
      error: 'Too many requests. Please wait a moment and try again.'
    };
  }
  
  if (error.status >= 500 || error.statusCode >= 500) {
    return {
      success: false,
      error: 'Server error. Please try again in a few moments.'
    };
  }
  
  // Network or other errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return {
      success: false,
      error: 'Network error. Please check your connection and try again.'
    };
  }
  
  return {
    success: false,
    error: error.message || 'An unexpected error occurred. Please try again.'
  };
}

class MedicationCalendarApi {
  // ===== MEDICATION SCHEDULE API =====

  // Get medication schedules for a specific patient (or current user if no patientId provided)
  async getMedicationSchedules(patientId?: string): Promise<ApiResponse<MedicationSchedule[]>> {
    try {
      const headers = await getAuthHeaders();
      
      const url = patientId
        ? `${API_BASE}/medication-calendar/schedules?patientId=${patientId}`
        : `${API_BASE}/medication-calendar/schedules`;
      
      return await rateLimitedFetch<ApiResponse<MedicationSchedule[]>>(
        url,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        },
        {
          priority: 'medium',
          cacheKey: `medication_schedules_${patientId || 'current'}`,
          cacheTTL: 120000 // 2 minutes
        }
      );
    } catch (error) {
      return handleApiError(error, 'Get medication schedules');
    }
  }

  // Get medication schedules for a specific medication
  async getMedicationSchedulesByMedicationId(medicationId: string): Promise<ApiResponse<MedicationSchedule[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/schedules/medication/${medicationId}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching medication schedules by medication ID:', error);
      return {
        success: false,
        error: 'Failed to fetch medication schedules'
      };
    }
  }

  // Create a new medication schedule
  async createMedicationSchedule(scheduleData: NewMedicationSchedule): Promise<ApiResponse<MedicationSchedule>> {
    try {
      console.log('🔧 MedicationCalendarApi: Creating medication schedule');
      console.log('🔧 MedicationCalendarApi: Schedule data:', JSON.stringify(scheduleData, null, 2));
      
      // Enhanced validation and debugging
      const validation = this.validateScheduleData(scheduleData);
      if (!validation.isValid) {
        console.error('❌ MedicationCalendarApi: Schedule validation failed:', validation.errors);
        console.warn('⚠️ MedicationCalendarApi: Validation warnings:', validation.warnings);
        console.info('💡 MedicationCalendarApi: Repair suggestions:', validation.repairSuggestions);
        console.error('❌ MedicationCalendarApi: Full schedule data that failed validation:', JSON.stringify(scheduleData, null, 2));
        
        // Return user-friendly error message with repair suggestions
        const errorMessage = validation.errors.length > 0
          ? `Schedule validation failed: ${validation.errors.join(', ')}`
          : 'Schedule validation failed';
        
        const suggestions = validation.repairSuggestions.length > 0
          ? ` Suggestions: ${validation.repairSuggestions.join('; ')}`
          : '';
        
        return {
          success: false,
          error: errorMessage + suggestions
        };
      }
      
      // Log warnings even if validation passes
      if (validation.warnings.length > 0) {
        console.warn('⚠️ MedicationCalendarApi: Schedule validation warnings:', validation.warnings);
      }
      
      console.log('✅ MedicationCalendarApi: Schedule validation passed');
      
      // Log frequency and time generation details
      console.log('🔍 MedicationCalendarApi: Schedule creation details:', {
        frequency: scheduleData.frequency,
        times: scheduleData.times,
        timesCount: scheduleData.times?.length || 0,
        medicationId: scheduleData.medicationId,
        patientId: scheduleData.patientId,
        generateCalendarEvents: scheduleData.generateCalendarEvents,
        isIndefinite: scheduleData.isIndefinite,
        startDate: scheduleData.startDate?.toISOString(),
        endDate: scheduleData.endDate?.toISOString(),
        hasInstructions: !!scheduleData.instructions
      });
      
      const headers = await getAuthHeaders();
      console.log('🔧 MedicationCalendarApi: Headers prepared');
      
      const response = await fetch(`${API_BASE}/medication-calendar/schedules`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(scheduleData),
      });

      console.log('🔧 MedicationCalendarApi: Response status:', response.status);
      console.log('🔧 MedicationCalendarApi: Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ MedicationCalendarApi: HTTP error:', response.status, errorText);
        
        // Provide user-friendly error messages based on status code
        let userFriendlyError = 'Failed to create medication schedule';
        
        if (response.status === 400) {
          userFriendlyError = 'Invalid schedule data. Please check your medication details and try again.';
        } else if (response.status === 401) {
          userFriendlyError = 'Authentication expired. Please sign in again.';
        } else if (response.status === 403) {
          userFriendlyError = 'You do not have permission to create schedules.';
        } else if (response.status === 500) {
          userFriendlyError = 'Server error. Please try again in a few moments.';
        }
        
        return {
          success: false,
          error: `${userFriendlyError} (Error ${response.status})`
        };
      }

      const result = await response.json();
      console.log('🔧 MedicationCalendarApi: Response data:', result);
      
      if (result.success) {
        console.log('✅ MedicationCalendarApi: Schedule created successfully:', {
          scheduleId: result.data?.id,
          frequency: result.data?.frequency,
          times: result.data?.times,
          generateCalendarEvents: result.data?.generateCalendarEvents
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error creating medication schedule:', error);
      
      // Provide detailed error information for debugging
      if (error instanceof Error) {
        console.error('❌ MedicationCalendarApi: Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      return {
        success: false,
        error: error instanceof Error
          ? `Failed to create medication schedule: ${error.message}`
          : 'Failed to create medication schedule. Please try again.'
      };
    }
  }

  // Update a medication schedule
  async updateMedicationSchedule(
    scheduleId: string,
    updates: Partial<MedicationSchedule>
  ): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/schedules/${scheduleId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      return await response.json();
    } catch (error) {
      console.error('Error updating medication schedule:', error);
      return {
        success: false,
        error: 'Failed to update medication schedule'
      };
    }
  }

  // Pause a medication schedule
  async pauseMedicationSchedule(scheduleId: string, pausedUntil?: Date): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/schedules/${scheduleId}/pause`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ pausedUntil: pausedUntil?.toISOString() }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error pausing medication schedule:', error);
      return {
        success: false,
        error: 'Failed to pause medication schedule'
      };
    }
  }

  // Resume a medication schedule
  async resumeMedicationSchedule(scheduleId: string): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/schedules/${scheduleId}/resume`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error resuming medication schedule:', error);
      return {
        success: false,
        error: 'Failed to resume medication schedule'
      };
    }
  }

  // ===== MEDICATION CALENDAR EVENTS API =====

  // Get medication calendar events
  async getMedicationCalendarEvents(options: {
    startDate?: Date;
    endDate?: Date;
    medicationId?: string;
    status?: string;
    forceFresh?: boolean;
    patientId?: string;
  } = {}): Promise<ApiResponse<MedicationCalendarEvent[]>> {
    try {
      const params = new URLSearchParams();
      
      if (options.startDate) {
        params.append('startDate', options.startDate.toISOString());
      }
      if (options.endDate) {
        params.append('endDate', options.endDate.toISOString());
      }
      if (options.medicationId) {
        params.append('medicationId', options.medicationId);
      }
      if (options.status) {
        params.append('status', options.status);
      }
      if (options.patientId) {
        params.append('patientId', options.patientId);
      }

      const queryString = params.toString();
      const url = `${API_BASE}/medication-calendar/events${queryString ? `?${queryString}` : ''}`;
      const headers = await getAuthHeaders();

      if (options.forceFresh) {
        return await rateLimitedFetch<ApiResponse<MedicationCalendarEvent[]>>(
          url,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          },
          {
            priority: 'high'
          }
        );
      }
      
      return await rateLimitedFetch<ApiResponse<MedicationCalendarEvent[]>>(
        url,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        },
        {
          priority: 'medium',
          cacheKey: `calendar_events_${options.patientId || 'current'}_${queryString}`,
          cacheTTL: 60000 // 1 minute cache
        }
      );
    } catch (error) {
      console.error('Error fetching medication calendar events:', error);
      return {
        success: false,
        error: 'Failed to fetch medication calendar events'
      };
    }
  }

  // Mark medication as taken with enhanced error handling and user feedback
  async markMedicationTaken(
    eventId: string,
    takenAt?: Date,
    notes?: string
  ): Promise<ApiResponse<MedicationCalendarEvent>> {
    try {
      console.log('🔧 MedicationCalendarApi: Marking medication as taken:', { eventId, takenAt, notes });
      
      // Validate eventId
      if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
        console.error('❌ Invalid eventId provided:', eventId);
        return {
          success: false,
          error: 'Invalid medication event ID. Please refresh the page and try again.'
        };
      }
      
      // Get authenticated headers (will throw if auth fails)
      const headers = await getAuthHeaders();
      console.log('🔧 MedicationCalendarApi: Authentication validated for mark taken request');
      
      // Build request body without undefined values
      const requestBody: any = {};
      
      if (takenAt) {
        requestBody.takenAt = takenAt.toISOString();
      }
      
      // Only include notes if it's a non-empty string
      if (notes && typeof notes === 'string' && notes.trim().length > 0) {
        requestBody.notes = notes.trim();
      }
      
      console.log('🔧 MedicationCalendarApi: Request body (cleaned):', requestBody);
      
      const result = await RateLimitedAPI.urgent<ApiResponse<MedicationCalendarEvent>>(
        `${API_BASE}/medication-calendar/events/${eventId}/taken`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestBody),
        }
      );

      console.log('🔧 MedicationCalendarApi: Mark taken response:', result);
      
      // Handle authentication errors in response
      if (!result.success && (result.error?.includes('Authentication') || result.error?.includes('Unauthorized'))) {
        console.error('🔐 Authentication error in mark taken response');
        return handleApiError({ status: 401, message: result.error }, 'Mark medication taken');
      }
      
      // If successful, clear relevant caches to force refresh
      if (result.success) {
        console.log('🗑️ Clearing medication caches after successful mark taken');
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        RateLimitedAPI.clearCache('medication_schedules');
        // Temporarily suppress cache sets for freshly invalidated keys
        try {
          // @ts-ignore access helper
          rateLimiter.suppressCacheFor?.('today_buckets', 2000);
          // @ts-ignore access helper
          rateLimiter.suppressCacheFor?.('calendar_events', 2000);
        } catch {}
        
        // Also reset the request debouncer for today's buckets to allow immediate refresh
        const today = new Date().toISOString().split('T')[0];
        requestDebouncer.reset();
        
        console.log('✅ Caches cleared, UI should refresh immediately');
      } else {
        console.error('❌ Mark taken failed:', result.error);
      }
      
      return result;
    } catch (error) {
      return handleApiError(error, 'Mark medication taken');
    }
  }

  // ===== ENHANCED MEDICATION ACTIONS API =====

  // Snooze a medication
  async snoozeMedication(
    eventId: string,
    snoozeMinutes: number,
    reason?: string
  ): Promise<ApiResponse<EnhancedMedicationCalendarEvent>> {
    try {
      console.log('🔧 MedicationCalendarApi: Snoozing medication:', { eventId, snoozeMinutes, reason });
      
      const headers = await getAuthHeaders();
      const requestBody = {
        snoozeMinutes,
        reason: reason?.trim() || undefined
      };
      
      const result = await RateLimitedAPI.urgent<ApiResponse<EnhancedMedicationCalendarEvent>>(
        `${API_BASE}/medication-calendar/events/${eventId}/snooze`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestBody),
        }
      );

      console.log('🔧 MedicationCalendarApi: Snooze response:', result);
      
      // If successful, clear relevant caches to force refresh
      if (result.success) {
        console.log('🗑️ Clearing medication caches after successful snooze');
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error snoozing medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to snooze medication'
      };
    }
  }

  // Skip a medication
  async skipMedication(
    eventId: string,
    reason: SkipReason,
    notes?: string
  ): Promise<ApiResponse<EnhancedMedicationCalendarEvent>> {
    try {
      console.log('🔧 MedicationCalendarApi: Skipping medication:', { eventId, reason, notes });
      
      const headers = await getAuthHeaders();
      const requestBody = {
        reason,
        notes: notes?.trim() || undefined
      };
      
      const result = await RateLimitedAPI.urgent<ApiResponse<EnhancedMedicationCalendarEvent>>(
        `${API_BASE}/medication-calendar/events/${eventId}/skip`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestBody),
        }
      );

      console.log('🔧 MedicationCalendarApi: Skip response:', result);
      
      // If successful, clear relevant caches to force refresh
      if (result.success) {
        console.log('🗑️ Clearing medication caches after successful skip');
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error skipping medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to skip medication'
      };
    }
  }

  // Reschedule a medication
  async rescheduleMedication(
    eventId: string,
    newDateTime: Date,
    reason: string,
    isOneTime: boolean
  ): Promise<ApiResponse<EnhancedMedicationCalendarEvent>> {
    try {
      console.log('🔧 MedicationCalendarApi: Rescheduling medication:', { eventId, newDateTime, reason, isOneTime });
      
      const headers = await getAuthHeaders();
      const requestBody = {
        newDateTime: newDateTime.toISOString(),
        reason: reason.trim(),
        isOneTime
      };
      
      const result = await RateLimitedAPI.urgent<ApiResponse<EnhancedMedicationCalendarEvent>>(
        `${API_BASE}/medication-calendar/events/${eventId}/reschedule`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestBody),
        }
      );

      console.log('🔧 MedicationCalendarApi: Reschedule response:', result);
      
      // If successful, clear relevant caches to force refresh
      if (result.success) {
        console.log('🗑️ Clearing medication caches after successful reschedule');
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error rescheduling medication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reschedule medication'
      };
    }
  }

  // ===== TIME BUCKET ORGANIZATION API =====

  // Get today's medications organized by time buckets with enhanced patient ID handling
  async getTodayMedicationBuckets(
    date?: Date,
    options?: { forceFresh?: boolean; patientId?: string; retryCount?: number }
  ): Promise<ApiResponse<TodayMedicationBuckets>> {
    const retryCount = options?.retryCount || 0;
    const maxRetries = 3;
    
    try {
      const targetDate = date || new Date();
      console.log('🔍 MedicationCalendarApi: Getting today\'s medication buckets', {
        date: targetDate.toISOString().split('T')[0],
        patientId: options?.patientId,
        forceFresh: options?.forceFresh,
        retryCount
      });
      
      const headers = await getAuthHeaders();
      
      const params = new URLSearchParams();
      params.append('date', targetDate.toISOString().split('T')[0]);
      
      // Always include patientId if provided
      if (options?.patientId) {
        params.append('patientId', options.patientId);
        console.log('🔍 MedicationCalendarApi: Using explicit patientId:', options.patientId);
      }

      const url = `${API_BASE}/medication-calendar/events/today-buckets?${params}`;
      console.log('🔍 MedicationCalendarApi: Request URL:', url);

      // Allow bypassing cache for immediate post-action refreshes
      if (options?.forceFresh) {
        console.log('🔄 MedicationCalendarApi: Force fresh request (bypassing cache)');
        const result = await rateLimitedFetch<ApiResponse<TodayMedicationBuckets>>(
          url,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          },
          {
            priority: 'high'
          }
        );
        
        // If successful, try to generate missing calendar events
        if (result.success && result.data) {
          console.log('✅ MedicationCalendarApi: Successfully loaded buckets, checking for missing events');
          this.ensureMissingCalendarEventsInBackground();
        }
        
        return result;
      }

      const result = await rateLimitedFetch<ApiResponse<TodayMedicationBuckets>>(
        url,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        },
        {
          priority: 'high', // High priority for today's medications
          cacheKey: `today_buckets_${options?.patientId || 'current'}_${targetDate.toISOString().split('T')[0]}`,
          cacheTTL: 30000 // 30 seconds cache for today's data
        }
      );
      
      // If successful, try to generate missing calendar events in background
      if (result.success && result.data) {
        console.log('✅ MedicationCalendarApi: Successfully loaded buckets from cache/API');
        this.ensureMissingCalendarEventsInBackground();
      } else if (!result.success && retryCount < maxRetries) {
        console.warn(`⚠️ MedicationCalendarApi: Bucket fetch failed, retrying (${retryCount + 1}/${maxRetries})`);
        // Exponential backoff retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.getTodayMedicationBuckets(date, { ...options, retryCount: retryCount + 1 });
      }
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error fetching time buckets:', error);
      
      // Retry logic for network errors
      if (retryCount < maxRetries && (
        error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('timeout')
        )
      )) {
        console.warn(`⚠️ MedicationCalendarApi: Network error, retrying (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.getTodayMedicationBuckets(date, { ...options, retryCount: retryCount + 1 });
      }
      
      return handleApiError(error, 'Get today\'s medication buckets');
    }
  }

  // ===== PATIENT PREFERENCES API =====

  // Get patient medication timing preferences
  async getPatientMedicationPreferences(patientId?: string): Promise<ApiResponse<PatientMedicationPreferences>> {
    try {
      const headers = await getAuthHeaders();
      
      const url = patientId
        ? `${API_BASE}/patients/preferences/medication-timing?patientId=${patientId}`
        : `${API_BASE}/patients/preferences/medication-timing`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching patient medication preferences:', error);
      return {
        success: false,
        error: 'Failed to fetch patient medication preferences'
      };
    }
  }

  // Update patient medication timing preferences
  async updatePatientMedicationPreferences(
    preferences: Partial<NewPatientMedicationPreferences>
  ): Promise<ApiResponse<PatientMedicationPreferences>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/preferences/medication-timing`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(preferences),
      });

      return await response.json();
    } catch (error) {
      console.error('Error updating patient medication preferences:', error);
      return {
        success: false,
        error: 'Failed to update patient medication preferences'
      };
    }
  }

  // Reset patient preferences to defaults
  async resetPatientMedicationPreferences(
    workSchedule: 'standard' | 'night_shift' = 'standard'
  ): Promise<ApiResponse<PatientMedicationPreferences>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/preferences/medication-timing/reset-defaults`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ workSchedule }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error resetting patient medication preferences:', error);
      return {
        success: false,
        error: 'Failed to reset patient medication preferences'
      };
    }
  }

  // ===== MEAL LOGGING API =====

  // Get meal logs for a date or date range
  async getMealLogs(options: {
    date?: Date;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<ApiResponse<any[]>> {
    try {
      const params = new URLSearchParams();
      
      if (options.date) {
        params.append('date', options.date.toISOString().split('T')[0]);
      }
      if (options.startDate) {
        params.append('startDate', options.startDate.toISOString().split('T')[0]);
      }
      if (options.endDate) {
        params.append('endDate', options.endDate.toISOString().split('T')[0]);
      }

      const queryString = params.toString();
      const url = `${API_BASE}/meal-logs${queryString ? `?${queryString}` : ''}`;

      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching meal logs:', error);
      return {
        success: false,
        error: 'Failed to fetch meal logs'
      };
    }
  }

  // Create a new meal log
  async createMealLog(mealLogData: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/meal-logs`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(mealLogData),
      });

      return await response.json();
    } catch (error) {
      console.error('Error creating meal log:', error);
      return {
        success: false,
        error: 'Failed to create meal log'
      };
    }
  }

  // Update a meal log
  async updateMealLog(mealLogId: string, updates: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/meal-logs/${mealLogId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      return await response.json();
    } catch (error) {
      console.error('Error updating meal log:', error);
      return {
        success: false,
        error: 'Failed to update meal log'
      };
    }
  }

  // Delete a meal log
  async deleteMealLog(mealLogId: string): Promise<ApiResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/meal-logs/${mealLogId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error deleting meal log:', error);
      return {
        success: false,
        error: 'Failed to delete meal log'
      };
    }
  }

  // ===== ADHERENCE TRACKING API =====

  // Get medication adherence analytics
  async getMedicationAdherence(options: {
    medicationId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<ApiResponse<MedicationAdherence[]>> {
    try {
      const params = new URLSearchParams();
      
      if (options.medicationId) {
        params.append('medicationId', options.medicationId);
      }
      if (options.startDate) {
        params.append('startDate', options.startDate.toISOString());
      }
      if (options.endDate) {
        params.append('endDate', options.endDate.toISOString());
      }

      const queryString = params.toString();
      const url = `${API_BASE}/medication-calendar/adherence${queryString ? `?${queryString}` : ''}`;

      const headers = await getAuthHeaders();
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching medication adherence:', error);
      return {
        success: false,
        error: 'Failed to fetch medication adherence'
      };
    }
  }

  // Get adherence summary for dashboard
  async getAdherenceSummary(): Promise<ApiResponse<{
    summary: {
      totalMedications: number;
      overallAdherenceRate: number;
      totalScheduledDoses: number;
      totalTakenDoses: number;
      totalMissedDoses: number;
      medicationsWithPoorAdherence: number;
      period: {
        startDate: Date;
        endDate: Date;
        days: number;
      };
    };
    medications: MedicationAdherence[];
  }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/adherence/summary`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching adherence summary:', error);
      return {
        success: false,
        error: 'Failed to fetch adherence summary'
      };
    }
  }

  // ===== UTILITY METHODS =====

  // Generate default schedule times based on frequency
  generateDefaultTimes(frequency: string): string[] {
    console.log('🔍 MedicationCalendarApi: Generating default times for frequency:', frequency);
    
    const times = (() => {
      switch (frequency) {
        case 'daily':
          return ['07:00'];
        case 'twice_daily':
          return ['07:00', '19:00'];
        case 'three_times_daily':
          return ['07:00', '13:00', '19:00'];
        case 'four_times_daily':
          return ['07:00', '12:00', '17:00', '22:00'];
        case 'weekly':
          return ['07:00'];
        case 'monthly':
          return ['07:00'];
        case 'as_needed':
          return []; // PRN medications don't have scheduled times
        default:
          console.warn(`⚠️ MedicationCalendarApi: Unknown frequency "${frequency}", defaulting to daily`);
          return ['07:00'];
      }
    })();
    
    console.log('🔍 MedicationCalendarApi: Generated default times:', times);
    return times;
  }

  // Generate default reminder times (in minutes before dose)
  generateDefaultReminders(): number[] {
    return [15, 5]; // 15 minutes and 5 minutes before
  }

  // Enhanced validation with detailed feedback and repair suggestions
  validateScheduleData(scheduleData: Partial<NewMedicationSchedule>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    repairSuggestions: string[];
  } {
    console.log('🔍 MedicationCalendarApi: Validating schedule data:', scheduleData);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const repairSuggestions: string[] = [];

    // Critical validation errors
    if (!scheduleData.medicationId) {
      errors.push('Medication ID is required');
      repairSuggestions.push('Ensure the medication exists and has a valid ID');
    }

    if (!scheduleData.frequency) {
      errors.push('Frequency is required');
      repairSuggestions.push('Set a valid frequency (daily, twice_daily, weekly, etc.)');
    } else {
      // Validate frequency format
      const validFrequencies = ['daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'weekly', 'monthly', 'as_needed'];
      if (!validFrequencies.includes(scheduleData.frequency)) {
        warnings.push(`Unusual frequency: ${scheduleData.frequency}. Consider using standard frequencies.`);
      }
    }

    if (!scheduleData.times || scheduleData.times.length === 0) {
      errors.push('At least one time is required');
      repairSuggestions.push('Add reminder times (e.g., ["07:00", "19:00"] for twice daily)');
    } else {
      // Validate time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const invalidTimes: string[] = [];
      
      for (const time of scheduleData.times) {
        if (!timeRegex.test(time)) {
          invalidTimes.push(time);
        }
      }
      
      if (invalidTimes.length > 0) {
        errors.push(`Invalid time format: ${invalidTimes.join(', ')}. Use HH:MM format (e.g., 07:00, 19:30)`);
        repairSuggestions.push('Fix time formats to use 24-hour HH:MM format');
      }
      
      // Check for duplicate times
      const uniqueTimes = new Set(scheduleData.times);
      if (uniqueTimes.size !== scheduleData.times.length) {
        errors.push('Duplicate times are not allowed');
        repairSuggestions.push('Remove duplicate reminder times');
      }
      
      // Validate frequency vs times count consistency
      if (scheduleData.frequency && scheduleData.times.length > 0) {
        const expectedCounts: Record<string, number> = {
          'daily': 1,
          'twice_daily': 2,
          'three_times_daily': 3,
          'four_times_daily': 4
        };
        
        const expectedCount = expectedCounts[scheduleData.frequency];
        if (expectedCount && scheduleData.times.length !== expectedCount) {
          warnings.push(`${scheduleData.frequency} typically uses ${expectedCount} time${expectedCount !== 1 ? 's' : ''}, but ${scheduleData.times.length} provided`);
        }
      }
    }

    if (!scheduleData.dosageAmount) {
      errors.push('Dosage amount is required');
      repairSuggestions.push('Specify dosage amount (e.g., "1 tablet", "5mg", "2 capsules")');
    } else if (typeof scheduleData.dosageAmount !== 'string' || scheduleData.dosageAmount.trim().length === 0) {
      errors.push('Dosage amount must be a non-empty string');
      repairSuggestions.push('Provide a valid dosage description');
    }
    
    // Instructions field is now truly optional - no validation needed
    if (scheduleData.instructions !== undefined && scheduleData.instructions !== null) {
      if (typeof scheduleData.instructions !== 'string') {
        warnings.push('Instructions should be a string if provided');
      }
    }

    if (!scheduleData.startDate) {
      errors.push('Start date is required');
      repairSuggestions.push('Set a start date for the medication schedule');
    } else {
      // Validate start date is not in the past (allow today)
      const startDate = new Date(scheduleData.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        warnings.push('Start date is in the past. Schedule will begin from today.');
      }
    }

    // Frequency-specific validation
    if (scheduleData.frequency === 'weekly') {
      if (!scheduleData.daysOfWeek || scheduleData.daysOfWeek.length === 0) {
        errors.push('Days of week are required for weekly frequency');
        repairSuggestions.push('Select which days of the week to take this medication');
      } else {
        // Validate days of week format
        const validDays = [0, 1, 2, 3, 4, 5, 6];
        const invalidDays = scheduleData.daysOfWeek.filter(day => !validDays.includes(day));
        if (invalidDays.length > 0) {
          errors.push(`Invalid days of week: ${invalidDays.join(', ')}. Use 0-6 (Sunday=0)`);
        }
      }
    }

    if (scheduleData.frequency === 'monthly') {
      if (!scheduleData.dayOfMonth) {
        errors.push('Day of month is required for monthly frequency');
        repairSuggestions.push('Select which day of the month to take this medication');
      } else if (scheduleData.dayOfMonth < 1 || scheduleData.dayOfMonth > 31) {
        errors.push('Day of month must be between 1 and 31');
        repairSuggestions.push('Choose a valid day of the month (1-31)');
      }
    }

    // Validate end date if provided
    if (scheduleData.endDate && scheduleData.startDate) {
      const startDate = new Date(scheduleData.startDate);
      const endDate = new Date(scheduleData.endDate);
      
      if (endDate <= startDate) {
        errors.push('End date must be after start date');
        repairSuggestions.push('Set an end date that comes after the start date');
      }
    }

    // Validate reminder settings
    if (scheduleData.reminderMinutesBefore) {
      const invalidReminders = scheduleData.reminderMinutesBefore.filter(minutes =>
        typeof minutes !== 'number' || minutes < 0 || minutes > 1440
      );
      
      if (invalidReminders.length > 0) {
        errors.push('Reminder minutes must be numbers between 0 and 1440 (24 hours)');
        repairSuggestions.push('Set valid reminder times (e.g., [15, 5] for 15 and 5 minutes before)');
      }
    }

    const validationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      repairSuggestions
    };
    
    console.log('🔍 MedicationCalendarApi: Enhanced validation result:', validationResult);
    
    return validationResult;
  }

  // Lenient validation for existing schedules - only checks critical functionality fields
  validateExistingSchedule(schedule: Partial<MedicationSchedule>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    console.log('🔍 MedicationCalendarApi: Validating existing schedule (lenient mode):', schedule.id);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Critical checks - only what affects functionality
    
    // 1. Check if schedule is active
    if (schedule.isActive === false) {
      warnings.push('Schedule is inactive - will not generate events');
    }
    
    // 2. Check if schedule is paused
    if (schedule.isPaused === true) {
      warnings.push('Schedule is paused - events will not be active');
    }
    
    // 3. Check if schedule has reminder times (critical for functionality)
    if (!schedule.times || schedule.times.length === 0) {
      errors.push('Schedule has no reminder times - cannot generate events');
    }
    
    // 4. Validate that times are in correct format (if they exist)
    if (schedule.times && schedule.times.length > 0) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const invalidTimes = schedule.times.filter(time => !timeRegex.test(time));
      
      if (invalidTimes.length > 0) {
        errors.push(`Invalid time format in existing schedule: ${invalidTimes.join(', ')}`);
      }
    }
    
    // 5. Check if schedule has a frequency (needed for event generation)
    if (!schedule.frequency) {
      errors.push('Schedule has no frequency - cannot determine when to generate events');
    }
    
    const validationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };
    
    console.log('🔍 MedicationCalendarApi: Lenient validation result:', validationResult);
    
    return validationResult;
  }

  // ===== GRACE PERIOD MANAGEMENT API =====

  // Get grace period configuration
  async getGracePeriodConfig(): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/grace-periods`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching grace period config:', error);
      return { success: false, error: 'Failed to fetch grace period configuration' };
    }
  }

  // Update grace period configuration
  async updateGracePeriodConfig(config: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/grace-periods`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(config),
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating grace period config:', error);
      return { success: false, error: 'Failed to update grace period configuration' };
    }
  }

  // ===== MISSED MEDICATION MANAGEMENT API =====

  // Get missed medications
  async getMissedMedications(options: {
    patientId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<ApiResponse<MedicationCalendarEvent[]>> {
    try {
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.startDate) params.append('startDate', options.startDate.toISOString());
      if (options.endDate) params.append('endDate', options.endDate.toISOString());
      if (options.limit) params.append('limit', options.limit.toString());

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/missed?${params}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching missed medications:', error);
      return { success: false, error: 'Failed to fetch missed medications' };
    }
  }

  // Trigger missed medication detection manually
  async triggerMissedDetection(): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/detect-missed`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error triggering missed detection:', error);
      return { success: false, error: 'Failed to trigger missed detection' };
    }
  }

  // Mark medication as missed manually
  async markMedicationAsMissed(eventId: string, reason?: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/events/${eventId}/mark-missed`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ reason: reason || 'manual_mark' }),
      });
      
      const result = await response.json();
      
      // Clear caches on successful update
      if (result.success) {
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      console.error('Error marking medication as missed:', error);
      return { success: false, error: 'Failed to mark medication as missed' };
    }
  }

  // Get missed medication statistics
  async getMissedMedicationStats(options: {
    patientId?: string;
    days?: number;
  } = {}): Promise<ApiResponse<{
    totalMissed: number;
    missedByMedication: Array<{ medicationId: string; medicationName: string; count: number }>;
    missedByTimeSlot: { morning: number; noon: number; evening: number; bedtime: number };
    averageGracePeriod: number;
    mostCommonReasons: Array<{ reason: string; count: number }>;
  }>> {
    try {
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.days) params.append('days', options.days.toString());

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/missed-stats?${params}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching missed medication statistics:', error);
      return { success: false, error: 'Failed to fetch missed medication statistics' };
    }
  }

  // ===== BULK OPERATIONS API =====

  // Create schedules for existing medications that don't have them
  async createBulkSchedules(): Promise<ApiResponse<{
    processed: number;
    created: number;
    skipped: number;
    errors: string[];
  }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medications/bulk-create-schedules`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      
      const result = await response.json();
      
      // Clear caches on successful bulk creation
      if (result.success && result.data.created > 0) {
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        RateLimitedAPI.clearCache('medication_schedules');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      console.error('Error creating bulk schedules:', error);
      return { success: false, error: 'Failed to create bulk schedules' };
    }
  }

  // Generate missing calendar events for existing schedules
  async generateMissingCalendarEvents(): Promise<ApiResponse<{
    processed: number;
    generated: number;
    skipped: number;
    errors: string[];
  }>> {
    try {
      console.log('🔧 MedicationCalendarApi: Generating missing calendar events');
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/generate-missing-events`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      
      const result = await response.json();
      
      console.log('🔧 MedicationCalendarApi: Generate missing events response:', result);
      
      // Clear caches on successful generation
      if (result.success && result.data && result.data.generated > 0) {
        console.log(`✅ Generated ${result.data.generated} missing calendar events`);
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        RateLimitedAPI.clearCache('medication_schedules');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      return handleApiError(error, 'Generate missing calendar events');
    }
  }

  // Check for medications with schedules but no calendar events
  async checkMissingCalendarEvents(): Promise<ApiResponse<{
    medicationsWithoutEvents: Array<{
      medicationId: string;
      medicationName: string;
      scheduleId: string;
      frequency: string;
      lastEventDate?: string;
    }>;
    totalCount: number;
  }>> {
    try {
      console.log('🔧 MedicationCalendarApi: Checking for missing calendar events');
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/check-missing-events`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      
      const result = await response.json();
      
      console.log('🔧 MedicationCalendarApi: Missing events check response:', result);
      
      if (result.success && result.data && result.data.totalCount > 0) {
        console.warn(`⚠️ Found ${result.data.totalCount} medications with schedules but no calendar events`);
      }
      
      return result;
    } catch (error) {
      return handleApiError(error, 'Check missing calendar events');
    }
  }

  // Ensure calendar events exist for a specific medication schedule
  async ensureCalendarEventsForSchedule(scheduleId: string): Promise<ApiResponse<{
    generated: number;
    alreadyExists: boolean;
  }>> {
    try {
      console.log('🔧 MedicationCalendarApi: Ensuring calendar events for schedule:', scheduleId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/schedules/${scheduleId}/ensure-events`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      
      const result = await response.json();
      
      console.log('🔧 MedicationCalendarApi: Ensure events response:', result);
      
      // Clear caches if events were generated
      if (result.success && result.data && result.data.generated > 0) {
        console.log(`✅ Generated ${result.data.generated} calendar events for schedule ${scheduleId}`);
        RateLimitedAPI.clearCache('today_buckets');
        RateLimitedAPI.clearCache('calendar_events');
        requestDebouncer.reset();
      }
      
      return result;
    } catch (error) {
      return handleApiError(error, 'Ensure calendar events for schedule');
    }
  }

  // ===== BACKGROUND OPERATIONS =====

  // Ensure missing calendar events are generated in the background
  private async ensureMissingCalendarEventsInBackground(): Promise<void> {
    try {
      console.log('🔍 MedicationCalendarApi: Checking for missing calendar events in background');
      
      // Check if there are medications with schedules but no calendar events
      const checkResult = await this.checkMissingCalendarEvents();
      
      if (checkResult.success && checkResult.data && checkResult.data.totalCount > 0) {
        console.log(`⚠️ Found ${checkResult.data.totalCount} medications with missing calendar events`);
        
        // Generate missing events
        const generateResult = await this.generateMissingCalendarEvents();
        
        if (generateResult.success && generateResult.data && generateResult.data.generated > 0) {
          console.log(`✅ Generated ${generateResult.data.generated} missing calendar events in background`);
        }
      } else {
        console.log('✅ No missing calendar events found');
      }
    } catch (error) {
      console.warn('⚠️ Background calendar event generation failed:', error);
      // Don't throw - this is a background operation
    }
  }

  // Enhanced method to get effective patient ID with better error handling
  async getEffectivePatientId(): Promise<string | null> {
    try {
      // Import auth here to avoid circular dependency
      const { auth } = await import('./firebase');
      
      // Try to get from current user context
      const user = auth.currentUser;
      if (!user) {
        console.warn('🔐 No authenticated user found');
        return null;
      }

      // For now, return the user's UID as the patient ID
      // This will be enhanced when family context is properly integrated
      return user.uid;
    } catch (error) {
      console.error('❌ Error getting effective patient ID:', error);
      return null;
    }
  }

  // Enhanced cache management with selective clearing
  clearMedicationCaches(patientId?: string): void {
    try {
      console.log('🗑️ Clearing medication caches', { patientId });
      
      // Clear all medication-related caches
      RateLimitedAPI.clearCache('today_buckets');
      RateLimitedAPI.clearCache('calendar_events');
      RateLimitedAPI.clearCache('medication_schedules');
      
      // Clear patient-specific caches if patientId provided
      if (patientId) {
        RateLimitedAPI.clearCache(`today_buckets_${patientId}`);
        RateLimitedAPI.clearCache(`calendar_events_${patientId}`);
        RateLimitedAPI.clearCache(`medication_schedules_${patientId}`);
      }
      
      // Reset request debouncer
      requestDebouncer.reset();
      
      console.log('✅ Medication caches cleared successfully');
    } catch (error) {
      console.warn('⚠️ Error clearing medication caches:', error);
    }
  }

  // Enhanced method to validate and repair data pipeline
  async validateAndRepairDataPipeline(patientId?: string): Promise<{
    isValid: boolean;
    issues: string[];
    repaired: string[];
  }> {
    const issues: string[] = [];
    const repaired: string[] = [];
    
    try {
      console.log('🔍 Validating medication data pipeline', { patientId });
      
      // Step 1: Check for medications with schedules but no calendar events
      const missingEventsCheck = await this.checkMissingCalendarEvents();
      if (missingEventsCheck.success && missingEventsCheck.data && missingEventsCheck.data.totalCount > 0) {
        issues.push(`${missingEventsCheck.data.totalCount} medications have schedules but no calendar events`);
        
        // Attempt to repair by generating missing events
        const generateResult = await this.generateMissingCalendarEvents();
        if (generateResult.success && generateResult.data && generateResult.data.generated > 0) {
          repaired.push(`Generated ${generateResult.data.generated} missing calendar events`);
        }
      }
      
      // Step 2: Validate today's medication buckets
      const bucketsResult = await this.getTodayMedicationBuckets(new Date(), {
        forceFresh: true,
        patientId
      });
      
      if (!bucketsResult.success) {
        issues.push(`Failed to load today's medication buckets: ${bucketsResult.error}`);
      } else if (bucketsResult.data) {
        const totalMeds = (bucketsResult.data.now?.length || 0) +
                         (bucketsResult.data.dueSoon?.length || 0) +
                         (bucketsResult.data.morning?.length || 0) +
                         (bucketsResult.data.noon?.length || 0) +
                         (bucketsResult.data.evening?.length || 0) +
                         (bucketsResult.data.bedtime?.length || 0) +
                         (bucketsResult.data.overdue?.length || 0) +
                         (bucketsResult.data.completed?.length || 0);
        
        console.log(`✅ Today's medication buckets loaded successfully (${totalMeds} total medications)`);
      }
      
      // Step 3: Clear caches to ensure fresh data
      this.clearMedicationCaches(patientId);
      repaired.push('Cleared medication caches for fresh data');
      
      const isValid = issues.length === 0;
      
      console.log('🔍 Data pipeline validation complete', {
        isValid,
        issuesCount: issues.length,
        repairedCount: repaired.length
      });
      
      return { isValid, issues, repaired };
      
    } catch (error) {
      console.error('❌ Error validating data pipeline:', error);
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, issues, repaired };
    }
  }

  // ===== SCHEDULE REPAIR AND DIAGNOSTIC TOOLS =====

  // Diagnose schedule issues for a specific medication
  async diagnoseMedicationScheduleIssues(medicationId: string): Promise<ApiResponse<{
    medicationId: string;
    medicationName: string;
    hasSchedules: boolean;
    scheduleCount: number;
    validSchedules: number;
    invalidSchedules: number;
    issues: Array<{
      scheduleId: string;
      type: 'validation' | 'inactive' | 'paused' | 'missing_events';
      severity: 'error' | 'warning' | 'info';
      description: string;
      repairAction: string;
    }>;
    recommendations: string[];
  }>> {
    try {
      console.log('🔍 Diagnosing schedule issues for medication:', medicationId);
      
      // Get schedules for this medication
      const schedulesResponse = await this.getMedicationSchedulesByMedicationId(medicationId);
      
      if (!schedulesResponse.success) {
        return {
          success: false,
          error: 'Failed to fetch medication schedules'
        };
      }
      
      const schedules = schedulesResponse.data || [];
      const issues: any[] = [];
      const recommendations: string[] = [];
      let validSchedules = 0;
      let invalidSchedules = 0;
      
      // Analyze each schedule
      for (const schedule of schedules) {
        const validation = this.validateScheduleData(schedule);
        
        if (!validation.isValid) {
          invalidSchedules++;
          issues.push({
            scheduleId: schedule.id,
            type: 'validation',
            severity: 'error',
            description: `Validation errors: ${validation.errors.join(', ')}`,
            repairAction: `Fix validation issues: ${validation.repairSuggestions.join('; ')}`
          });
        } else {
          validSchedules++;
        }
        
        // Check if schedule is inactive
        if (!schedule.isActive) {
          issues.push({
            scheduleId: schedule.id,
            type: 'inactive',
            severity: 'warning',
            description: 'Schedule is marked as inactive',
            repairAction: 'Activate the schedule or remove it if no longer needed'
          });
        }
        
        // Check if schedule is paused
        if (schedule.isPaused) {
          const pausedUntil = schedule.pausedUntil ? new Date(schedule.pausedUntil) : null;
          const isPermanentlyPaused = !pausedUntil || pausedUntil < new Date();
          
          issues.push({
            scheduleId: schedule.id,
            type: 'paused',
            severity: isPermanentlyPaused ? 'warning' : 'info',
            description: pausedUntil
              ? `Schedule paused until ${pausedUntil.toLocaleDateString()}`
              : 'Schedule is paused indefinitely',
            repairAction: isPermanentlyPaused
              ? 'Resume the schedule or set a specific resume date'
              : 'Schedule will auto-resume on the specified date'
          });
        }
      }
      
      // Generate recommendations
      if (schedules.length === 0) {
        recommendations.push('Create a medication schedule to enable reminders');
      } else if (validSchedules === 0) {
        recommendations.push('Fix validation issues in existing schedules');
      } else if (invalidSchedules > 0) {
        recommendations.push(`Fix ${invalidSchedules} invalid schedule${invalidSchedules !== 1 ? 's' : ''}`);
      }
      
      const diagnosticResult = {
        medicationId,
        medicationName: 'Unknown', // Will be filled by caller if needed
        hasSchedules: schedules.length > 0,
        scheduleCount: schedules.length,
        validSchedules,
        invalidSchedules,
        issues,
        recommendations
      };
      
      console.log('🔍 Diagnostic complete for medication:', medicationId, diagnosticResult);
      
      return {
        success: true,
        data: diagnosticResult
      };
      
    } catch (error) {
      return handleApiError(error, 'Diagnose medication schedule issues');
    }
  }

  // Repair schedule issues for a specific medication
  async repairMedicationScheduleIssues(medicationId: string, repairOptions?: {
    createMissingSchedule?: boolean;
    fixValidationIssues?: boolean;
    activateInactiveSchedules?: boolean;
    resumePausedSchedules?: boolean;
  }): Promise<ApiResponse<{
    medicationId: string;
    repairsApplied: string[];
    issuesRemaining: string[];
    newScheduleCreated: boolean;
    schedulesFixed: number;
  }>> {
    try {
      console.log('🔧 Repairing schedule issues for medication:', medicationId, repairOptions);
      
      const repairsApplied: string[] = [];
      const issuesRemaining: string[] = [];
      let newScheduleCreated = false;
      let schedulesFixed = 0;
      
      // First, diagnose the issues
      const diagnosticResponse = await this.diagnoseMedicationScheduleIssues(medicationId);
      
      if (!diagnosticResponse.success || !diagnosticResponse.data) {
        return {
          success: false,
          error: 'Failed to diagnose medication issues'
        };
      }
      
      const diagnostic = diagnosticResponse.data;
      
      // Repair 1: Create missing schedule if needed
      if (!diagnostic.hasSchedules && repairOptions?.createMissingSchedule) {
        try {
          const bulkResult = await this.createBulkSchedules();
          if (bulkResult.success && bulkResult.data && bulkResult.data.created > 0) {
            repairsApplied.push('Created missing medication schedule');
            newScheduleCreated = true;
            schedulesFixed++;
          }
        } catch (error) {
          issuesRemaining.push('Failed to create missing schedule');
        }
      }
      
      // Repair 2: Fix validation issues (would require backend support)
      if (diagnostic.invalidSchedules > 0 && repairOptions?.fixValidationIssues) {
        issuesRemaining.push(`${diagnostic.invalidSchedules} schedule(s) have validation issues that require manual review`);
      }
      
      // Repair 3: Activate inactive schedules (would require backend support)
      if (repairOptions?.activateInactiveSchedules) {
        const inactiveIssues = diagnostic.issues.filter(issue => issue.type === 'inactive');
        if (inactiveIssues.length > 0) {
          issuesRemaining.push(`${inactiveIssues.length} inactive schedule(s) require manual activation`);
        }
      }
      
      // Repair 4: Resume paused schedules (would require backend support)
      if (repairOptions?.resumePausedSchedules) {
        const pausedIssues = diagnostic.issues.filter(issue => issue.type === 'paused');
        if (pausedIssues.length > 0) {
          issuesRemaining.push(`${pausedIssues.length} paused schedule(s) require manual resumption`);
        }
      }
      
      const repairResult = {
        medicationId,
        repairsApplied,
        issuesRemaining,
        newScheduleCreated,
        schedulesFixed
      };
      
      console.log('🔧 Repair complete for medication:', medicationId, repairResult);
      
      return {
        success: true,
        data: repairResult
      };
      
    } catch (error) {
      return handleApiError(error, 'Repair medication schedule issues');
    }
  }

  // Comprehensive schedule health check for all medications
  async performScheduleHealthCheck(patientId?: string): Promise<ApiResponse<{
    patientId: string | null;
    totalMedications: number;
    medicationsWithReminders: number;
    medicationsWithValidSchedules: number;
    medicationsNeedingRepair: number;
    overallHealthScore: number;
    issues: Array<{
      medicationId: string;
      medicationName: string;
      issueType: string;
      severity: string;
      description: string;
    }>;
    recommendations: string[];
    repairActions: string[];
  }>> {
    try {
      console.log('🏥 Performing comprehensive schedule health check...');
      
      const effectivePatientId = patientId || await this.getEffectivePatientId();
      
      if (!effectivePatientId) {
        return {
          success: false,
          error: 'Unable to determine patient ID'
        };
      }
      
      // Get all medications
      const headers = await getAuthHeaders();
      const medicationsResponse = await fetch(`${API_BASE}/medications?patientId=${effectivePatientId}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      
      if (!medicationsResponse.ok) {
        return {
          success: false,
          error: 'Failed to fetch medications'
        };
      }
      
      const medicationsData = await medicationsResponse.json();
      const medications = medicationsData.data || [];
      
      const medicationsWithReminders = medications.filter((med: any) =>
        med.hasReminders && med.isActive && !med.isPRN
      );
      
      const issues: any[] = [];
      const recommendations: string[] = [];
      const repairActions: string[] = [];
      let medicationsWithValidSchedules = 0;
      
      // Check each medication with reminders
      for (const medication of medicationsWithReminders) {
        const diagnosticResponse = await this.diagnoseMedicationScheduleIssues(medication.id);
        
        if (diagnosticResponse.success && diagnosticResponse.data) {
          const diagnostic = diagnosticResponse.data;
          
          if (diagnostic.validSchedules > 0) {
            medicationsWithValidSchedules++;
          }
          
          // Add issues to overall report
          diagnostic.issues.forEach(issue => {
            issues.push({
              medicationId: medication.id,
              medicationName: medication.name,
              issueType: issue.type,
              severity: issue.severity,
              description: issue.description
            });
          });
          
          // Add recommendations
          diagnostic.recommendations.forEach(rec => {
            if (!recommendations.includes(rec)) {
              recommendations.push(rec);
            }
          });
        }
      }
      
      // Calculate health score (0-100)
      const healthScore = medicationsWithReminders.length > 0
        ? Math.round((medicationsWithValidSchedules / medicationsWithReminders.length) * 100)
        : 100;
      
      // Generate repair actions
      if (medicationsWithValidSchedules < medicationsWithReminders.length) {
        repairActions.push('Run bulk schedule creation to fix missing schedules');
      }
      
      if (issues.filter(i => i.severity === 'error').length > 0) {
        repairActions.push('Review and fix validation errors in existing schedules');
      }
      
      if (issues.filter(i => i.issueType === 'paused').length > 0) {
        repairActions.push('Resume paused schedules that should be active');
      }
      
      const healthCheckResult = {
        patientId: effectivePatientId,
        totalMedications: medications.length,
        medicationsWithReminders: medicationsWithReminders.length,
        medicationsWithValidSchedules,
        medicationsNeedingRepair: medicationsWithReminders.length - medicationsWithValidSchedules,
        overallHealthScore: healthScore,
        issues,
        recommendations,
        repairActions
      };
      
      console.log('🏥 Schedule health check complete:', healthCheckResult);
      
      return {
        success: true,
        data: healthCheckResult
      };
      
    } catch (error) {
      return handleApiError(error, 'Perform schedule health check');
    }
  }
  // ===== ARCHIVE MANAGEMENT API =====

  // Get archived medication events
  async getArchivedEvents(
    patientId: string,
    startDate: Date,
    endDate: Date,
    medicationId?: string
  ): Promise<ApiResponse<MedicationCalendarEvent[]>> {
    try {
      const params = new URLSearchParams();
      params.append('patientId', patientId);
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      
      if (medicationId) {
        params.append('medicationId', medicationId);
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/archived-events?${params}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching archived events:', error);
      return {
        success: false,
        error: 'Failed to fetch archived medication events'
      };
    }
  }

  // Get daily summaries for a date range
  async getDailySummaries(
    patientId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<ApiResponse<Array<{
    date: string;
    totalScheduled: number;
    totalTaken: number;
    totalMissed: number;
    totalSkipped: number;
    adherenceRate: number;
    medications: Array<{
      medicationId: string;
      medicationName: string;
      scheduled: number;
      taken: number;
      missed: number;
      skipped: number;
    }>;
  }>>> {
    try {
      const params = new URLSearchParams();
      params.append('patientId', patientId);
      
      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      if (limit) {
        params.append('limit', limit.toString());
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/daily-summaries?${params}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching daily summaries:', error);
      return {
        success: false,
        error: 'Failed to fetch daily summaries'
      };
    }
  }

  // Get daily summary for a specific date
  async getDailySummary(
    patientId: string,
    date: Date
  ): Promise<ApiResponse<{
    date: string;
    totalScheduled: number;
    totalTaken: number;
    totalMissed: number;
    totalSkipped: number;
    adherenceRate: number;
    medications: Array<{
      medicationId: string;
      medicationName: string;
      scheduled: number;
      taken: number;
      missed: number;
      skipped: number;
    }>;
  }>> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/medication-calendar/daily-summary/${patientId}/${dateStr}`,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Error fetching daily summary:', error);
      return {
        success: false,
        error: 'Failed to fetch daily summary'
      };
    }
  }
}

// Export singleton instance
export const medicationCalendarApi = new MedicationCalendarApi();