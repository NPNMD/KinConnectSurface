/**
 * Production Migration for Unified Medication Model
 * 
 * This migration:
 * 1. Migrates ALL medications to the unified model
 * 2. Processes in batches for safety and performance
 * 3. Provides progress tracking and logging
 * 4. Includes error handling and rollback capability
 * 5. Writes to production 'medications' collection
 * 6. Preserves 'medication_calendar_events' as separate collection
 */

import * as admin from 'firebase-admin';
import {
  UnifiedMedicationPOC,
  determineMedicationType,
  POC_DEFAULT_GRACE_PERIODS
} from '../types/unifiedMedication';

const firestore = admin.firestore();

/**
 * Migration result for a single medication
 */
interface MedicationMigrationResult {
  medicationId: string;
  medicationName: string;
  success: boolean;
  error?: string;
  warning?: string;
}

/**
 * Overall migration progress
 */
interface MigrationProgress {
  totalMedications: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: MedicationMigrationResult[];
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

/**
 * Migrate all medications to unified model with batch processing
 * 
 * @param batchSize - Number of medications to process at once (default: 10)
 * @param dryRun - If true, don't write to production (default: false)
 * @returns Migration progress and results
 */
export async function migrateAllMedications(
  batchSize: number = 10,
  dryRun: boolean = false
): Promise<MigrationProgress> {
  console.log('🚀 Starting production medication migration...');
  console.log('📊 Configuration:', { batchSize, dryRun });
  
  const progress: MigrationProgress = {
    totalMedications: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: [],
    startTime: new Date(),
    errors: []
  };
  
  try {
    // Get all medications from the old structure
    const medicationsSnapshot = await firestore.collection('medications').get();
    progress.totalMedications = medicationsSnapshot.docs.length;
    
    console.log(`📊 Found ${progress.totalMedications} medications to migrate`);
    
    // Process in batches
    const medications = medicationsSnapshot.docs;
    
    for (let i = 0; i < medications.length; i += batchSize) {
      const batch = medications.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(medications.length / batchSize)}`);
      console.log(`📊 Medications ${i + 1}-${Math.min(i + batchSize, medications.length)} of ${medications.length}`);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(doc => migrateSingleMedication(doc.id, dryRun))
      );
      
      // Update progress
      batchResults.forEach(result => {
        progress.processed++;
        progress.results.push(result);
        
        if (result.success) {
          progress.successful++;
        } else if (result.error) {
          progress.failed++;
          progress.errors.push(`${result.medicationName}: ${result.error}`);
        } else if (result.warning) {
          progress.skipped++;
        }
      });
      
      // Log batch progress
      console.log(`✅ Batch completed: ${progress.successful} successful, ${progress.failed} failed, ${progress.skipped} skipped`);
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < medications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    progress.endTime = new Date();
    const durationSeconds = Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000);
    
    console.log('\n🎉 Migration completed!');
    console.log('📊 Final results:', {
      total: progress.totalMedications,
      successful: progress.successful,
      failed: progress.failed,
      skipped: progress.skipped,
      duration: `${durationSeconds}s`,
      dryRun
    });
    
    if (progress.errors.length > 0) {
      console.log('❌ Errors encountered:', progress.errors);
    }
    
    return progress;
    
  } catch (error) {
    console.error('❌ Fatal error in migration:', error);
    progress.endTime = new Date();
    progress.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
    return progress;
  }
}

/**
 * Migrate a single medication to unified model
 */
async function migrateSingleMedication(
  medicationId: string,
  dryRun: boolean
): Promise<MedicationMigrationResult> {
  const result: MedicationMigrationResult = {
    medicationId,
    medicationName: 'Unknown',
    success: false
  };
  
  try {
    // STEP 1: Read medication document
    const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
    
    if (!medicationDoc.exists) {
      result.error = 'Medication not found';
      return result;
    }
    
    const medicationData = medicationDoc.data() as any;
    result.medicationName = medicationData.name || 'Unknown';
    
    // Check if already migrated (has metadata.version field)
    if (medicationData.metadata?.version) {
      result.warning = 'Already migrated';
      console.log(`⏭️ Skipping ${result.medicationName} - already migrated`);
      return result;
    }
    
    console.log(`🔄 Migrating: ${result.medicationName}`);
    
    // STEP 2: Read schedule (if exists)
    const schedulesQuery = await firestore.collection('medication_schedules')
      .where('medicationId', '==', medicationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    const scheduleData = schedulesQuery.empty ? null : schedulesQuery.docs[0].data();
    
    // STEP 3: Read reminder (if exists)
    const remindersQuery = await firestore.collection('medication_reminders')
      .where('medicationId', '==', medicationId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    const reminderData = remindersQuery.empty ? null : remindersQuery.docs[0].data();
    
    // STEP 4: Build unified document
    const medicationType = determineMedicationType(
      medicationData.name,
      medicationData.frequency || scheduleData?.frequency || 'daily'
    );
    
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
    
    // STEP 5: Write to production (or skip if dry run)
    if (!dryRun) {
      await firestore.collection('medications').doc(medicationId).set(unifiedDocument);
      console.log(`✅ Migrated: ${result.medicationName}`);
    } else {
      console.log(`✅ [DRY RUN] Would migrate: ${result.medicationName}`);
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    console.error(`❌ Error migrating ${result.medicationName}:`, error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Rollback migration for a specific medication
 */
export async function rollbackMedication(medicationId: string): Promise<boolean> {
  try {
    console.log('🔄 Rolling back medication:', medicationId);
    
    const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
    
    if (!medicationDoc.exists) {
      console.log('❌ Medication not found');
      return false;
    }
    
    const data = medicationDoc.data() as any;
    
    // Check if this was migrated
    if (!data.metadata?.migratedFrom) {
      console.log('⚠️ Medication was not migrated, nothing to rollback');
      return false;
    }
    
    // Restore original structure by removing unified fields
    const originalData: any = {
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      instructions: data.instructions,
      patientId: data.patientId,
      isActive: data.status.isActive,
      isPRN: data.status.isPRN,
      hasReminders: data.reminders.enabled,
      reminderTimes: data.schedule.times,
      createdAt: admin.firestore.Timestamp.fromDate(data.metadata.createdAt),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    await firestore.collection('medications').doc(medicationId).set(originalData);
    
    console.log('✅ Rollback completed for:', medicationId);
    return true;
    
  } catch (error) {
    console.error('❌ Error rolling back medication:', error);
    return false;
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
 * Migrate medications for a specific patient
 */
export async function migrateMedicationsForPatient(
  patientId: string,
  dryRun: boolean = false
): Promise<MigrationProgress> {
  console.log('🔄 Migrating medications for patient:', patientId);
  
  const progress: MigrationProgress = {
    totalMedications: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: [],
    startTime: new Date(),
    errors: []
  };
  
  try {
    // Get all medications for this patient
    const medicationsSnapshot = await firestore.collection('medications')
      .where('patientId', '==', patientId)
      .get();
    
    progress.totalMedications = medicationsSnapshot.docs.length;
    console.log(`📊 Found ${progress.totalMedications} medications for patient`);
    
    // Process each medication
    for (const doc of medicationsSnapshot.docs) {
      const result = await migrateSingleMedication(doc.id, dryRun);
      
      progress.processed++;
      progress.results.push(result);
      
      if (result.success) {
        progress.successful++;
      } else if (result.error) {
        progress.failed++;
        progress.errors.push(`${result.medicationName}: ${result.error}`);
      } else if (result.warning) {
        progress.skipped++;
      }
    }
    
    progress.endTime = new Date();
    
    console.log('✅ Patient migration completed:', {
      patientId,
      successful: progress.successful,
      failed: progress.failed,
      skipped: progress.skipped
    });
    
    return progress;
    
  } catch (error) {
    console.error('❌ Error migrating patient medications:', error);
    progress.endTime = new Date();
    progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return progress;
  }
}

/**
 * Validate unified medication document
 */
export function validateUnifiedMedication(doc: UnifiedMedicationPOC): {
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

/**
 * Get migration status for all medications
 */
export async function getMigrationStatus(): Promise<{
  totalMedications: number;
  migratedCount: number;
  notMigratedCount: number;
  migrationPercentage: number;
}> {
  try {
    // Get all medications
    const allMedicationsSnapshot = await firestore.collection('medications').get();
    const totalMedications = allMedicationsSnapshot.docs.length;
    
    // Count migrated medications (those with metadata.version)
    const migratedCount = allMedicationsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.metadata?.version;
    }).length;
    
    const notMigratedCount = totalMedications - migratedCount;
    const migrationPercentage = totalMedications > 0 
      ? Math.round((migratedCount / totalMedications) * 100) 
      : 0;
    
    return {
      totalMedications,
      migratedCount,
      notMigratedCount,
      migrationPercentage
    };
    
  } catch (error) {
    console.error('❌ Error getting migration status:', error);
    return {
      totalMedications: 0,
      migratedCount: 0,
      notMigratedCount: 0,
      migrationPercentage: 0
    };
  }
}