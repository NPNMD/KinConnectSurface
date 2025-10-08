/**
 * Unified Medication Types for Frontend
 * 
 * These types match the backend unified medication model and provide
 * type safety for the frontend application.
 */

// ===== UNIFIED MEDICATION TYPES =====

export interface UnifiedMedication {
  id: string;
  patientId: string;
  
  // Core Medication Data
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  
  // Status
  status: {
    isActive: boolean;
    isPRN: boolean;
    current: 'active' | 'paused' | 'discontinued';
  };
  
  // Schedule Data (embedded)
  schedule: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
    times: string[]; // HH:MM format
    startDate: Date;
    endDate?: Date;
    isIndefinite: boolean;
    dosageAmount: string;
  };
  
  // Reminders Data (embedded)
  reminders: {
    enabled: boolean;
    minutesBefore: number[]; // e.g., [15, 5]
    notificationMethods: string[];
  };
  
  // Grace Period
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

// ===== LEGACY MEDICATION TYPE (for backward compatibility) =====

export interface LegacyMedication {
  id: string;
  patientId: string;
  name: string;
  genericName?: string;
  brandName?: string;
  rxcui?: string;
  ndc?: string;
  dosage: string;
  strength?: string;
  dosageForm?: string;
  frequency: string;
  route?: string;
  instructions?: string;
  prescribedBy?: string;
  prescribedDate: Date;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isPRN?: boolean;
  maxDailyDose?: string;
  sideEffects?: string[];
  notes?: string;
  pharmacy?: string;
  prescriptionNumber?: string;
  refillsRemaining?: number;
  hasReminders?: boolean;
  reminderTimes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ===== TYPE GUARDS =====

/**
 * Check if a medication is using the unified format
 */
export function isUnifiedMedication(med: any): med is UnifiedMedication {
  return (
    med &&
    typeof med === 'object' &&
    'schedule' in med &&
    'reminders' in med &&
    'gracePeriod' in med &&
    'metadata' in med &&
    typeof med.metadata === 'object' &&
    'version' in med.metadata
  );
}

/**
 * Check if a medication is using the legacy format
 */
export function isLegacyMedication(med: any): med is LegacyMedication {
  return (
    med &&
    typeof med === 'object' &&
    'id' in med &&
    'patientId' in med &&
    'name' in med &&
    !isUnifiedMedication(med)
  );
}

// ===== CONVERSION HELPERS =====

/**
 * Convert legacy medication to unified format
 */
export function toUnifiedFormat(legacy: LegacyMedication): UnifiedMedication {
  return {
    id: legacy.id,
    patientId: legacy.patientId,
    name: legacy.name,
    dosage: legacy.dosage,
    frequency: legacy.frequency,
    instructions: legacy.instructions,
    
    status: {
      isActive: legacy.isActive,
      isPRN: legacy.isPRN || false,
      current: legacy.isActive ? 'active' : 'discontinued'
    },
    
    schedule: {
      frequency: mapLegacyFrequency(legacy.frequency),
      times: legacy.reminderTimes || [],
      startDate: legacy.startDate || legacy.prescribedDate,
      endDate: legacy.endDate,
      isIndefinite: !legacy.endDate,
      dosageAmount: legacy.dosage
    },
    
    reminders: {
      enabled: legacy.hasReminders || false,
      minutesBefore: [15, 5],
      notificationMethods: ['browser']
    },
    
    gracePeriod: {
      defaultMinutes: 30,
      medicationType: determineMedicationType(legacy.name, legacy.frequency)
    },
    
    metadata: {
      version: 1,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      migratedFrom: {
        medicationId: legacy.id,
        migratedAt: new Date()
      }
    }
  };
}

/**
 * Convert unified medication to legacy format (for backward compatibility)
 */
export function fromUnifiedFormat(unified: UnifiedMedication): LegacyMedication {
  return {
    id: unified.id,
    patientId: unified.patientId,
    name: unified.name,
    dosage: unified.dosage,
    frequency: unified.frequency,
    instructions: unified.instructions,
    prescribedDate: unified.schedule.startDate,
    startDate: unified.schedule.startDate,
    endDate: unified.schedule.endDate,
    isActive: unified.status.isActive,
    isPRN: unified.status.isPRN,
    hasReminders: unified.reminders.enabled,
    reminderTimes: unified.schedule.times,
    createdAt: unified.metadata.createdAt,
    updatedAt: unified.metadata.updatedAt
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Map legacy frequency string to unified frequency type
 */
function mapLegacyFrequency(frequency: string): UnifiedMedication['schedule']['frequency'] {
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
 * Determine medication type for grace period
 */
function determineMedicationType(
  medicationName: string,
  frequency: string
): 'critical' | 'standard' | 'vitamin' | 'prn' {
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
 * Default grace periods by medication type (in minutes)
 */
export const DEFAULT_GRACE_PERIODS = {
  critical: 15,
  standard: 30,
  vitamin: 120,
  prn: 0
} as const;

// ===== MIGRATION HELPERS =====

/**
 * Batch convert medications to unified format
 */
export function batchToUnifiedFormat(medications: LegacyMedication[]): UnifiedMedication[] {
  return medications.map(toUnifiedFormat);
}

/**
 * Batch convert medications from unified format
 */
export function batchFromUnifiedFormat(medications: UnifiedMedication[]): LegacyMedication[] {
  return medications.map(fromUnifiedFormat);
}

/**
 * Normalize medication array to handle both formats
 */
export function normalizeMedications(medications: (UnifiedMedication | LegacyMedication)[]): UnifiedMedication[] {
  return medications.map(med => 
    isUnifiedMedication(med) ? med : toUnifiedFormat(med)
  );
}