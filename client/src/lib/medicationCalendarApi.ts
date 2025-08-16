import type { 
  MedicationSchedule, 
  NewMedicationSchedule, 
  MedicationCalendarEvent, 
  MedicationAdherence,
  ApiResponse 
} from '@shared/types';

const API_BASE = '/api/medication-calendar';

class MedicationCalendarApi {
  // ===== MEDICATION SCHEDULE API =====

  // Get medication schedules for the current user
  async getMedicationSchedules(): Promise<ApiResponse<MedicationSchedule[]>> {
    try {
      const response = await fetch(`${API_BASE}/schedules`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      return await response.json();
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
      const response = await fetch(`${API_BASE}/schedules/medication/${medicationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(scheduleData),
      });

      return await response.json();
    } catch (error) {
      console.error('Error creating medication schedule:', error);
      return {
        success: false,
        error: 'Failed to create medication schedule'
      };
    }
  }

  // Update a medication schedule
  async updateMedicationSchedule(
    scheduleId: string, 
    updates: Partial<MedicationSchedule>
  ): Promise<ApiResponse<MedicationSchedule>> {
    try {
      const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE}/schedules/${scheduleId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE}/schedules/${scheduleId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const url = `${API_BASE}/events${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      return await response.json();
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
      const response = await fetch(`${API_BASE}/events/${eventId}/taken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          takenAt: takenAt?.toISOString(),
          notes
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      return {
        success: false,
        error: 'Failed to mark medication as taken'
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
      const url = `${API_BASE}/adherence${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE}/adherence/summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
        return ['08:00'];
      case 'twice_daily':
        return ['08:00', '20:00'];
      case 'three_times_daily':
        return ['08:00', '14:00', '20:00'];
      case 'four_times_daily':
        return ['08:00', '12:00', '16:00', '20:00'];
      case 'weekly':
        return ['08:00'];
      case 'monthly':
        return ['08:00'];
      default:
        return ['08:00'];
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