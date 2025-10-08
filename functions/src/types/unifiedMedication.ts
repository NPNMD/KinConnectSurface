/**
 * Proof-of-Concept Unified Medication Model
 * 
 * This is a simplified version of the full unified medication model
 * designed to validate the approach before full-scale migration.
 * 
 * POC Goals:
 * 1. Demonstrate combining 3 collections into 1 unified document
 * 2. Prove single-read efficiency
 * 3. Validate data integrity during migration
 * 4. Test ACID transaction capabilities
 */

import * as admin from 'firebase-admin';

/**
 * POC Unified Medication Document
 * Combines: medications + medication_schedules + medication_reminders
 */
export interface UnifiedMedicationPOC {
  // Primary Keys
  id: string;
  patientId: string;
  
  // Core Medication Data (from medications collection)
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  
  // Status (simplified from full model)
  status: {
    isActive: boolean;
    isPRN: boolean;
    current: 'active' | 'paused' | 'discontinued';
  };
  
  // Schedule Data (from medication_schedules collection)
  schedule: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
    times: string[]; // HH:MM format
    startDate: Date;
    endDate?: Date;
    isIndefinite: boolean;
    dosageAmount: string;
  };
  
  // Reminders Data (from medication_reminders collection)
  reminders: {
    enabled: boolean;
    minutesBefore: number[]; // e.g., [15, 5]
    notificationMethods: string[];
  };
  
  // Grace Period (simplified)
  gracePeriod: {
    defaultMinutes: number;
    medicationType: 'critical' | 'standard' | 'vitamin' | 'prn';
  };
  
  // Metadata
  metadata: {
    version: number;
    createdAt: Date;
    updatedAt: Date;
    migratedFrom?: {
      medicationId: string;
      scheduleId?: string;
      reminderId?: string;
      migratedAt: Date;
    };
  };
}

/**
 * POC Migration Source Data
 * Represents data from the 3 separate collections
 */
export interface POCMigrationSourceData {
  medication: {
    id: string;
    patientId: string;
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
    isActive: boolean;
    isPRN?: boolean;
    hasReminders?: boolean;
    reminderTimes?: string[];
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
  };
  
  schedule?: {
    id: string;
    medicationId: string;
    patientId: string;
    frequency: string;
    times: string[];
    startDate: admin.firestore.Timestamp;
    endDate?: admin.firestore.Timestamp;
    isIndefinite: boolean;
    dosageAmount: string;
    isActive: boolean;
    isPaused: boolean;
  };
  
  reminder?: {
    id: string;
    medicationId: string;
    patientId: string;
    reminderTimes: number[];
    notificationMethods: string[];
    isActive: boolean;
  };
}

/**
 * POC Migration Result
 */
export interface POCMigrationResult {
  success: boolean;
  unifiedDocument?: UnifiedMedicationPOC;
  sourceData: POCMigrationSourceData;
  errors?: string[];
  warnings?: string[];
  comparison: {
    before: {
      collections: number;
      totalFields: number;
      readOperations: number;
    };
    after: {
      collections: number;
      totalFields: number;
      readOperations: number;
    };
    improvement: {
      collectionsReduced: number;
      readOperationsReduced: number;
      percentageImprovement: number;
    };
  };
}

/**
 * Helper function to determine medication type for grace period
 */
export function determineMedicationType(medicationName: string, frequency: string): 'critical' | 'standard' | 'vitamin' | 'prn' {
  const nameLower = medicationName.toLowerCase();
  const freqLower = frequency.toLowerCase();
  
  // PRN medications
  if (freqLower.includes('as needed') || freqLower.includes('prn')) {
    return 'prn';
  }
  
  // Critical medications (examples)
  const criticalKeywords = ['insulin', 'heart', 'cardiac', 'blood thinner', 'warfarin', 'anticoagulant'];
  if (criticalKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'critical';
  }
  
  // Vitamins and supplements
  const vitaminKeywords = ['vitamin', 'supplement', 'multivitamin', 'calcium', 'iron', 'omega'];
  if (vitaminKeywords.some(keyword => nameLower.includes(keyword))) {
    return 'vitamin';
  }
  
  // Default to standard
  return 'standard';
}

/**
 * Default grace periods by medication type
 */
export const POC_DEFAULT_GRACE_PERIODS = {
  critical: 15,
  standard: 30,
  vitamin: 120,
  prn: 0
} as const;