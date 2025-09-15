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
import { getIdToken } from './firebase';
import { rateLimitedFetch, RateLimitedAPI } from './rateLimiter';
import { requestDebouncer } from './requestDebouncer';

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Add diagnostic logging
console.log('🔧 MedicationCalendarApi: Using API base URL:', API_BASE);

// Helper function to get authenticated headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getIdToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

class MedicationCalendarApi {
  // ===== MEDICATION SCHEDULE API =====

  // Get medication schedules for the current user
  async getMedicationSchedules(): Promise<ApiResponse<MedicationSchedule[]>> {
    try {
      const headers = await getAuthHeaders();
      
      return await rateLimitedFetch<ApiResponse<MedicationSchedule[]>>(
        `${API_BASE}/medication-calendar/schedules`,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        },
        {
          priority: 'medium',
          cacheKey: 'medication_schedules',
          cacheTTL: 120000 // 2 minutes
        }
      );
    } catch (error) {
      console.error('Error fetching medication schedules:', error);
      return {
        success: false,
        error: 'Failed to fetch medication schedules'
      };
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
      console.log('🔧 MedicationCalendarApi: Schedule data:', scheduleData);
      
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
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const result = await response.json();
      console.log('🔧 MedicationCalendarApi: Response data:', result);
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error creating medication schedule:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication schedule'
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
          cacheKey: `calendar_events_${queryString}`,
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

  // Mark medication as taken
  async markMedicationTaken(
    eventId: string,
    takenAt?: Date,
    notes?: string
  ): Promise<ApiResponse<MedicationCalendarEvent>> {
    try {
      console.log('🔧 MedicationCalendarApi: Marking medication as taken:', { eventId, takenAt, notes });
      
      const headers = await getAuthHeaders();
      console.log('🔧 MedicationCalendarApi: Headers prepared for mark taken request');
      
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
      }
      
      return result;
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error marking medication as taken:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark medication as taken'
      };
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

  // Get today's medications organized by time buckets
  async getTodayMedicationBuckets(
    date?: Date,
    options?: { forceFresh?: boolean }
  ): Promise<ApiResponse<TodayMedicationBuckets>> {
    try {
      const targetDate = date || new Date();
      const headers = await getAuthHeaders();
      
      const params = new URLSearchParams();
      params.append('date', targetDate.toISOString().split('T')[0]);

      const url = `${API_BASE}/medication-calendar/events/today-buckets?${params}`;

      // Allow bypassing cache for immediate post-action refreshes
      if (options?.forceFresh) {
        return await rateLimitedFetch<ApiResponse<TodayMedicationBuckets>>(
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

      return await rateLimitedFetch<ApiResponse<TodayMedicationBuckets>>(
        url,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        },
        {
          priority: 'high', // High priority for today's medications
          cacheKey: `today_buckets_${targetDate.toISOString().split('T')[0]}`,
          cacheTTL: 30000 // 30 seconds cache for today's data
        }
      );
    } catch (error) {
      console.error('❌ MedicationCalendarApi: Error fetching time buckets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch time buckets'
      };
    }
  }

  // ===== PATIENT PREFERENCES API =====

  // Get patient medication timing preferences
  async getPatientMedicationPreferences(): Promise<ApiResponse<PatientMedicationPreferences>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/preferences/medication-timing`, {
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
      default:
        return ['07:00'];
    }
  }

  // Generate default reminder times (in minutes before dose)
  generateDefaultReminders(): number[] {
    return [15, 5]; // 15 minutes and 5 minutes before
  }

  // Validate schedule data before submission
  validateScheduleData(scheduleData: Partial<NewMedicationSchedule>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!scheduleData.medicationId) {
      errors.push('Medication ID is required');
    }

    if (!scheduleData.frequency) {
      errors.push('Frequency is required');
    }

    if (!scheduleData.times || scheduleData.times.length === 0) {
      errors.push('At least one time is required');
    } else {
      // Validate time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      for (const time of scheduleData.times) {
        if (!timeRegex.test(time)) {
          errors.push(`Invalid time format: ${time}. Use HH:MM format`);
        }
      }
    }

    if (!scheduleData.dosageAmount) {
      errors.push('Dosage amount is required');
    }

    if (!scheduleData.startDate) {
      errors.push('Start date is required');
    }

    if (scheduleData.frequency === 'weekly' && (!scheduleData.daysOfWeek || scheduleData.daysOfWeek.length === 0)) {
      errors.push('Days of week are required for weekly frequency');
    }

    if (scheduleData.frequency === 'monthly' && !scheduleData.dayOfMonth) {
      errors.push('Day of month is required for monthly frequency');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const medicationCalendarApi = new MedicationCalendarApi();