import { Medication, MedicationCalendarEvent, MedicationSchedule } from '@shared/types';

// Enhanced medication with schedule status
export interface MedicationWithStatus extends Medication {
  scheduleStatus: 'scheduled' | 'unscheduled' | 'paused';
  todaysEvents: MedicationCalendarEvent[];
  nextDose?: MedicationCalendarEvent;
  schedules: MedicationSchedule[];
  hasActiveSchedule: boolean;
}

