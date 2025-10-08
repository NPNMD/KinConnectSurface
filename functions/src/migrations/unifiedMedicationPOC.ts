/**
 * Proof-of-Concept Migration for Unified Medication Model
 * 
 * This migration demonstrates:
 * 1. Reading from 3 separate collections (medications, schedules, reminders)
 * 2. Combining data into a single unified document
 * 3. Writing to a new POC collection
 * 4. Maintaining data integrity
 * 5. Providing before/after comparison
 */

import * as admin from 'firebase-admin';
import {
  UnifiedMedicationPOC,
  POCMigrationSourceData,
  POCMigrationResult,
  determineMedicationType,
  POC_DEFAULT_GRACE_PERIODS
} from '../types/unifiedMedication';

const firestore = admin.firestore();

/**
 * Migrate a single medication to the unified POC model
 * 
 * @param medicationId - ID of the medication to migrate
 * @returns Migration result with before/after comparison
 */
export async function migrateMedicationToPOC(medicationId: string): Promise<POCMigrationResult> {
  console.log('🔄 Starting POC migration for medication:', medicationId);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // STEP 1: Read from medications collection
    console.log('📖 Step 1: Reading medication document...');
    const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
    
    if (!medicationDoc.exists) {
      throw new Error(`Medication not found: ${medicationId}`);
    }
    
    const medicationData = medicationDoc.data() as any;
    console.log('✅ Medication found:', medicationData.name);
    
    // STEP 2: Read from medication_schedules collection
    console.log('📖 Step 2: Reading medication schedule...');
    const schedulesQuery = await firestore.collection('medication_schedules')
      .where('medicationId', '==', medicationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    let scheduleData: any = null;
    if (!schedulesQuery.empty) {
      scheduleData = schedulesQuery.docs[0].data();
      console.log('✅ Schedule found:', scheduleData.frequency);
    } else {
      warnings.push('No active schedule found - using medication data for schedule');
      console.log('⚠️ No active schedule found');
    }
    
    // STEP 3: Read from medication_reminders collection
    console.log('📖 Step 3: Reading medication reminders...');
    const remindersQuery = await firestore.collection('medication_reminders')
      .where('medicationId', '==', medicationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    let reminderData: any = null;
    if (!remindersQuery.empty) {
      reminderData = remindersQuery.docs[0].data();
      console.log('✅ Reminder found');
    } else {
      warnings.push('No active reminder found - using default reminder settings');
      console.log('⚠️ No active reminder found');
    }
    
    // STEP 4: Combine data into unified structure
    console.log('🔧 Step 4: Combining data into unified structure...');
    
    // Determine medication type for grace period
    const medicationType = determineMedicationType(
      medicationData.name,
      medicationData.frequency || scheduleData?.frequency || 'daily'
    );
    
    // Build unified document
    const unifiedDocument: UnifiedMedicationPOC = {
      id: medicationId,
      patientId: medicationData.patientId,
      
      // Core medication data
      name: medicationData.name,
      dosage: medicationData.dosage || '1 tablet',
      frequency: medicationData.frequency || scheduleData?.frequency || 'daily',
      instructions: medicationData.instructions,
      
      // Status
      status: {
        isActive: medicationData.isActive !== false,
        isPRN: medicationData.isPRN || false,
        current: medicationData.isActive === false ? 'discontinued' : 
                 scheduleData?.isPaused ? 'paused' : 'active'
      },
      
      // Schedule (from schedule or medication data)
      schedule: {
        frequency: scheduleData?.frequency || 
                   mapFrequencyToScheduleFormat(medicationData.frequency || 'daily'),
        times: scheduleData?.times || 
               medicationData.reminderTimes || 
               generateDefaultTimes(medicationData.frequency || 'daily'),
        startDate: scheduleData?.startDate?.toDate() || 
                   medicationData.startDate?.toDate() || 
                   medicationData.createdAt?.toDate() || 
                   new Date(),
        endDate: scheduleData?.endDate?.toDate() || medicationData.endDate?.toDate(),
        isIndefinite: scheduleData?.isIndefinite !== false,
        dosageAmount: scheduleData?.dosageAmount || medicationData.dosage || '1 tablet'
      },
      
      // Reminders (from reminder or medication data)
      reminders: {
        enabled: reminderData?.isActive || medicationData.hasReminders || false,
        minutesBefore: reminderData?.reminderTimes || [15, 5],
        notificationMethods: reminderData?.notificationMethods || ['browser']
      },
      
      // Grace period
      gracePeriod: {
        defaultMinutes: POC_DEFAULT_GRACE_PERIODS[medicationType],
        medicationType: medicationType
      },
      
      // Metadata
      metadata: {
        version: 1,
        createdAt: medicationData.createdAt?.toDate() || new Date(),
        updatedAt: new Date(),
        migratedFrom: {
          medicationId: medicationId,
          scheduleId: schedulesQuery.empty ? undefined : schedulesQuery.docs[0].id,
          reminderId: remindersQuery.empty ? undefined : remindersQuery.docs[0].id,
          migratedAt: new Date()
        }
      }
    };
    
    console.log('✅ Unified document created');
    
    // STEP 5: Write to POC collection
    console.log('💾 Step 5: Writing to medications_unified_poc collection...');
    await firestore.collection('medications_unified_poc').doc(medicationId).set(unifiedDocument);
    console.log('✅ POC document written successfully');
    
    // STEP 6: Build comparison metrics
    const sourceData: POCMigrationSourceData = {
      medication: {
        id: medicationDoc.id,
        patientId: medicationData.patientId,
        name: medicationData.name,
        dosage: medicationData.dosage,
        frequency: medicationData.frequency,
        instructions: medicationData.instructions,
        isActive: medicationData.isActive,
        isPRN: medicationData.isPRN,
        hasReminders: medicationData.hasReminders,
        reminderTimes: medicationData.reminderTimes,
        createdAt: medicationData.createdAt,
        updatedAt: medicationData.updatedAt
      },
      schedule: scheduleData ? {
        id: schedulesQuery.docs[0].id,
        medicationId: scheduleData.medicationId,
        patientId: scheduleData.patientId,
        frequency: scheduleData.frequency,
        times: scheduleData.times,
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        isIndefinite: scheduleData.isIndefinite,
        dosageAmount: scheduleData.dosageAmount,
        isActive: scheduleData.isActive,
        isPaused: scheduleData.isPaused
      } : undefined,
      reminder: reminderData ? {
        id: remindersQuery.docs[0].id,
        medicationId: reminderData.medicationId,
        patientId: reminderData.patientId,
        reminderTimes: reminderData.reminderTimes,
        notificationMethods: reminderData.notificationMethods,
        isActive: reminderData.isActive
      } : undefined
    };
    
    // Calculate metrics
    const collectionsUsedBefore = 1 + (scheduleData ? 1 : 0) + (reminderData ? 1 : 0);
    const readOperationsBefore = collectionsUsedBefore; // One read per collection
    const collectionsUsedAfter = 1; // Single unified collection
    const readOperationsAfter = 1; // Single read operation
    
    const result: POCMigrationResult = {
      success: true,
      unifiedDocument,
      sourceData,
      errors,
      warnings,
      comparison: {
        before: {
          collections: collectionsUsedBefore,
          totalFields: countFields(sourceData),
          readOperations: readOperationsBefore
        },
        after: {
          collections: collectionsUsedAfter,
          totalFields: countFields({ unified: unifiedDocument }),
          readOperations: readOperationsAfter
        },
        improvement: {
          collectionsReduced: collectionsUsedBefore - collectionsUsedAfter,
          readOperationsReduced: readOperationsBefore - readOperationsAfter,
          percentageImprovement: Math.round(
            ((readOperationsBefore - readOperationsAfter) / readOperationsBefore) * 100
          )
        }
      }
    };
    
    console.log('📊 Migration completed successfully:', {
      collectionsReduced: result.comparison.improvement.collectionsReduced,
      readOpsReduced: result.comparison.improvement.readOperationsReduced,
      improvement: `${result.comparison.improvement.percentageImprovement}%`
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ POC migration failed:', error);
    
    return {
      success: false,
      sourceData: {} as any,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      warnings,
      comparison: {
        before: { collections: 0, totalFields: 0, readOperations: 0 },
        after: { collections: 0, totalFields: 0, readOperations: 0 },
        improvement: { collectionsReduced: 0, readOperationsReduced: 0, percentageImprovement: 0 }
      }
    };
  }
}

/**
 * Helper: Map frequency string to schedule format
 */
function mapFrequencyToScheduleFormat(frequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' {
  const freqLower = frequency.toLowerCase().trim();
  
  if (freqLower.includes('twice') || freqLower.includes('bid') || freqLower.includes('2x')) {
    return 'twice_daily';
  } else if (freqLower.includes('three') || freqLower.includes('tid') || freqLower.includes('3x')) {
    return 'three_times_daily';
  } else if (freqLower.includes('four') || freqLower.includes('qid') || freqLower.includes('4x')) {
    return 'four_times_daily';
  } else if (freqLower.includes('weekly')) {
    return 'weekly';
  } else if (freqLower.includes('monthly')) {
    return 'monthly';
  } else if (freqLower.includes('needed') || freqLower.includes('prn')) {
    return 'as_needed';
  }
  
  return 'daily';
}

/**
 * Helper: Generate default times based on frequency
 */
function generateDefaultTimes(frequency: string): string[] {
  const freqLower = frequency.toLowerCase().trim();
  
  if (freqLower.includes('twice') || freqLower.includes('bid') || freqLower.includes('2x')) {
    return ['07:00', '19:00'];
  } else if (freqLower.includes('three') || freqLower.includes('tid') || freqLower.includes('3x')) {
    return ['07:00', '13:00', '19:00'];
  } else if (freqLower.includes('four') || freqLower.includes('qid') || freqLower.includes('4x')) {
    return ['07:00', '12:00', '17:00', '22:00'];
  }
  
  return ['07:00']; // Default to morning
}

/**
 * Helper: Count total fields in data structure
 */
function countFields(data: any): number {
  let count = 0;
  
  function countRecursive(obj: any): void {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        count += obj.length;
        obj.forEach(item => countRecursive(item));
      } else {
        const keys = Object.keys(obj);
        count += keys.length;
        keys.forEach(key => countRecursive(obj[key]));
      }
    }
  }
  
  countRecursive(data);
  return count;
}

/**
 * Read a unified medication from POC collection
 * Demonstrates single-read efficiency
 */
export async function readUnifiedMedicationPOC(medicationId: string): Promise<UnifiedMedicationPOC | null> {
  console.log('📖 Reading unified medication from POC collection:', medicationId);
  
  const startTime = Date.now();
  const doc = await firestore.collection('medications_unified_poc').doc(medicationId).get();
  const readTime = Date.now() - startTime;
  
  if (!doc.exists) {
    console.log('❌ Unified medication not found in POC collection');
    return null;
  }
  
  const data = doc.data() as UnifiedMedicationPOC;
  
  console.log('✅ Unified medication read successfully in', readTime, 'ms');
  console.log('📊 Single read retrieved:', {
    medication: data.name,
    schedule: `${data.schedule.frequency} at ${data.schedule.times.join(', ')}`,
    reminders: data.reminders.enabled ? 'enabled' : 'disabled',
    gracePeriod: `${data.gracePeriod.defaultMinutes} minutes`,
    readTime: `${readTime}ms`
  });
  
  return data;
}

/**
 * Compare read performance: Old way vs Unified way
 */
export async function compareReadPerformance(medicationId: string): Promise<{
  oldWay: { time: number; reads: number; collections: number };
  newWay: { time: number; reads: number; collections: number };
  improvement: { timeReduction: number; readsReduced: number; percentageFaster: number };
}> {
  console.log('⚡ Comparing read performance for medication:', medicationId);
  
  // OLD WAY: Read from 3 separate collections
  const oldWayStart = Date.now();
  
  const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
  const schedulesQuery = await firestore.collection('medication_schedules')
    .where('medicationId', '==', medicationId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  const remindersQuery = await firestore.collection('medication_reminders')
    .where('medicationId', '==', medicationId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  const oldWayTime = Date.now() - oldWayStart;
  const oldWayReads = 3; // 3 separate read operations
  const oldWayCollections = 3;
  
  console.log('📊 Old way:', {
    time: `${oldWayTime}ms`,
    reads: oldWayReads,
    collections: oldWayCollections
  });
  
  // NEW WAY: Single read from unified collection
  const newWayStart = Date.now();
  
  const unifiedDoc = await firestore.collection('medications_unified_poc').doc(medicationId).get();
  
  const newWayTime = Date.now() - newWayStart;
  const newWayReads = 1; // Single read operation
  const newWayCollections = 1;
  
  console.log('📊 New way:', {
    time: `${newWayTime}ms`,
    reads: newWayReads,
    collections: newWayCollections
  });
  
  // Calculate improvement
  const timeReduction = oldWayTime - newWayTime;
  const readsReduced = oldWayReads - newWayReads;
  const percentageFaster = oldWayTime > 0 ? Math.round((timeReduction / oldWayTime) * 100) : 0;
  
  console.log('✅ Performance improvement:', {
    timeReduction: `${timeReduction}ms`,
    readsReduced,
    percentageFaster: `${percentageFaster}%`
  });
  
  return {
    oldWay: {
      time: oldWayTime,
      reads: oldWayReads,
      collections: oldWayCollections
    },
    newWay: {
      time: newWayTime,
      reads: newWayReads,
      collections: newWayCollections
    },
    improvement: {
      timeReduction,
      readsReduced,
      percentageFaster
    }
  };
}

/**
 * Validate unified document integrity
 */
export function validateUnifiedDocument(doc: UnifiedMedicationPOC): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!doc.id) errors.push('Missing id');
  if (!doc.patientId) errors.push('Missing patientId');
  if (!doc.name) errors.push('Missing medication name');
  if (!doc.dosage) errors.push('Missing dosage');
  if (!doc.frequency) errors.push('Missing frequency');
  
  // Schedule validation
  if (!doc.schedule.times || doc.schedule.times.length === 0) {
    errors.push('Schedule must have at least one time');
  }
  if (!doc.schedule.dosageAmount) {
    errors.push('Schedule must have dosage amount');
  }
  if (!doc.schedule.startDate) {
    errors.push('Schedule must have start date');
  }
  
  // Time format validation
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  doc.schedule.times.forEach((time, index) => {
    if (!timeRegex.test(time)) {
      errors.push(`Invalid time format at index ${index}: ${time}`);
    }
  });
  
  // Frequency consistency
  const expectedTimeCounts: Record<string, number> = {
    'daily': 1,
    'twice_daily': 2,
    'three_times_daily': 3,
    'four_times_daily': 4
  };
  
  const expectedCount = expectedTimeCounts[doc.schedule.frequency];
  if (expectedCount && doc.schedule.times.length !== expectedCount) {
    warnings.push(
      `Frequency ${doc.schedule.frequency} typically uses ${expectedCount} time(s), ` +
      `but ${doc.schedule.times.length} provided`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}