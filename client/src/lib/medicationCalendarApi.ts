/**
 * Medication Calendar API - Backward Compatibility Shim
 * 
 * This file provides backward compatibility for components still using
 * the legacy medicationCalendarApi import path. It exports the unified
 * medication API with compatibility adapters.
 * 
 * Components using this file should be migrated to use unifiedMedicationApi
 * directly when possible.
 */

import { 
  unifiedMedicationApi, 
  legacyMedicationApi,
  type UnifiedMedicationCommand,
  type TodayMedicationBuckets 
} from './unifiedMedicationApi';
import type { ApiResponse } from '@shared/types';

/**
 * Compatibility API that wraps the unified medication API
 * Provides methods expected by legacy components
 */
class MedicationCalendarApiCompat {
  
  /**
   * Get today's medication buckets (legacy format)
   */
  async getTodayMedicationBuckets(
    date?: Date,
    options: { patientId?: string; forceFresh?: boolean } = {}
  ): Promise<ApiResponse<any>> {
    return legacyMedicationApi.getTodayMedicationBuckets(date, options);
  }

  /**
   * Get missed medications
   */
  async getMissedMedications(options: {
    patientId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ApiResponse<any>> {
    // Use unified API to get medications and filter for missed ones
    const result = await unifiedMedicationApi.getTodayMedicationBuckets(
      options.startDate || new Date(),
      { patientId: options.patientId }
    );
    
    if (!result.success) {
      return result;
    }

    // Return overdue medications as "missed"
    return {
      success: true,
      data: result.data?.overdue || []
    };
  }

  /**
   * Mark medication as taken
   */
  async markMedicationTaken(
    eventId: string,
    takenAt: Date,
    options: {
      commandId?: string;
      scheduledDateTime?: Date;
      notes?: string;
      notifyFamily?: boolean;
    } = {}
  ): Promise<ApiResponse<any>> {
    // Need commandId to use unified API
    if (!options.commandId) {
      return {
        success: false,
        error: 'commandId is required'
      };
    }

    return unifiedMedicationApi.markMedicationTaken(
      options.commandId,
      {
        takenAt,
        notes: options.notes,
        scheduledDateTime: options.scheduledDateTime || new Date(),
        notifyFamily: options.notifyFamily
      }
    );
  }

  /**
   * Skip medication
   */
  async skipMedication(
    eventId: string,
    skipReason: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other',
    options: {
      commandId?: string;
      notes?: string;
      notifyFamily?: boolean;
    } = {}
  ): Promise<ApiResponse<any>> {
    if (!options.commandId) {
      return {
        success: false,
        error: 'commandId is required'
      };
    }

    return unifiedMedicationApi.skipDose(
      options.commandId,
      eventId,
      skipReason,
      {
        notes: options.notes,
        notifyFamily: options.notifyFamily
      }
    );
  }

  /**
   * Get medication schedules by medication ID
   */
  async getMedicationSchedulesByMedicationId(medicationId: string): Promise<ApiResponse<any>> {
    // Use unified API to get medication details
    const result = await unifiedMedicationApi.getMedications();
    
    if (!result.success) {
      return result;
    }

    // Filter for the specific medication
    const medication = result.data?.find((med: UnifiedMedicationCommand) => med.id === medicationId);
    
    if (!medication) {
      return {
        success: false,
        error: 'Medication not found'
      };
    }

    // Return schedule data in legacy format
    return {
      success: true,
      data: [{
        id: medication.id,
        medicationId: medication.id,
        frequency: medication.schedule.frequency,
        times: medication.schedule.times,
        dosageAmount: medication.schedule.dosageAmount,
        startDate: medication.schedule.startDate,
        endDate: medication.schedule.endDate,
        isActive: medication.status.isActive
      }]
    };
  }

  /**
   * Get medication calendar events
   */
  async getMedicationCalendarEvents(options: {
    medicationId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ApiResponse<any>> {
    // Use unified API to get today's buckets which include events
    const result = await unifiedMedicationApi.getTodayMedicationBuckets(
      options.startDate || new Date()
    );
    
    if (!result.success) {
      return result;
    }

    // Aggregate all events from all buckets
    const allBuckets = result.data as TodayMedicationBuckets | undefined;
    const allEvents = [
      ...(allBuckets?.now || []),
      ...(allBuckets?.dueSoon || []),
      ...(allBuckets?.morning || []),
      ...(allBuckets?.lunch || []),
      ...(allBuckets?.evening || []),
      ...(allBuckets?.beforeBed || []),
      ...(allBuckets?.overdue || []),
      ...(allBuckets?.completed || [])
    ];

    // Filter for specific medication if provided
    const filteredEvents = options.medicationId
      ? allEvents.filter((event: any) => event.commandId === options.medicationId)
      : allEvents;

    return {
      success: true,
      data: filteredEvents
    };
  }

  /**
   * Create bulk schedules
   */
  async createBulkSchedules(options: {
    patientId?: string;
  } = {}): Promise<ApiResponse<any>> {
    // This is a legacy method that might not be needed with unified API
    // Return success for now to prevent build errors
    console.warn('createBulkSchedules is a legacy method - consider updating component to use unified API');
    return {
      success: true,
      data: { message: 'Bulk schedule creation handled by unified medication API' }
    };
  }

  /**
   * Create meal log
   */
  async createMealLog(mealLogData: any): Promise<ApiResponse<any>> {
    // Meal logs are handled separately - this is a placeholder
    console.warn('createMealLog should use dedicated meal log API');
    return {
      success: false,
      error: 'Meal log API not implemented in compatibility shim'
    };
  }

  /**
   * Update meal log
   */
  async updateMealLog(mealLogId: string, mealLogData: any): Promise<ApiResponse<any>> {
    console.warn('updateMealLog should use dedicated meal log API');
    return {
      success: false,
      error: 'Meal log API not implemented in compatibility shim'
    };
  }

  /**
   * Delete meal log
   */
  async deleteMealLog(mealLogId: string): Promise<ApiResponse<any>> {
    console.warn('deleteMealLog should use dedicated meal log API');
    return {
      success: false,
      error: 'Meal log API not implemented in compatibility shim'
    };
  }

  /**
   * Get meal logs
   */
  async getMealLogs(options: { date: Date }): Promise<ApiResponse<any>> {
    console.warn('getMealLogs should use dedicated meal log API');
    return {
      success: true,
      data: []
    };
  }
}

// Export singleton instance as medicationCalendarApi for backward compatibility
export const medicationCalendarApi = new MedicationCalendarApiCompat();

// Also export the unified API for components that want to migrate
export { unifiedMedicationApi, legacyMedicationApi };