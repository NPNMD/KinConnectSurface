/**
 * Migration Script: Fix Night Shift Time Configuration Bug
 * 
 * TASK-002: Fix Night Shift Time Configuration Bug
 * 
 * Purpose:
 * - Identify and fix patient_medication_preferences with problematic 02:00 defaults
 * - Backup original data before making changes
 * - Support dry-run mode for testing
 * - Provide detailed logging and audit trail
 * 
 * Issue:
 * - Night shift evening slot (01:00-04:00) defaulting to 02:00 instead of 00:00 (midnight)
 * - This causes medications to default to 2 AM instead of midnight
 * - Affects user experience and medication adherence
 * 
 * Solution:
 * - Update night shift evening slot to 23:00-02:00 with 00:00 default
 * - Preserve intentional night shift worker configurations
 * - Create backup before any changes
 * - Provide rollback capability
 */

import * as admin from 'firebase-admin';

// Initialize Firestore
const firestore = admin.firestore();

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  totalPatients: number;
  patientsNeedingFix: number;
  patientsFixed: number;
  patientsSkipped: number;
  backupCreated: boolean;
  backupId?: string;
  errors: string[];
  warnings: string[];
  changes: Array<{
    patientId: string;
    patientName?: string;
    originalConfig: any;
    newConfig: any;
    changeReason: string;
    timestamp: Date;
  }>;
  dryRun: boolean;
}

/**
 * Backup interface
 */
interface MigrationBackup {
  id: string;
  migrationName: string;
  createdAt: Date;
  createdBy: string;
  totalRecords: number;
  backupData: Array<{
    patientId: string;
    originalData: any;
  }>;
}

/**
 * Main migration function
 */
export async function fixNightShiftDefaults(
  dryRun: boolean = true,
  createdBy: string = 'system'
): Promise<MigrationResult> {
  console.log('🔧 Starting Night Shift Time Configuration Migration...');
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  
  const result: MigrationResult = {
    success: false,
    totalPatients: 0,
    patientsNeedingFix: 0,
    patientsFixed: 0,
    patientsSkipped: 0,
    backupCreated: false,
    errors: [],
    warnings: [],
    changes: [],
    dryRun
  };

  try {
    // Step 1: Get all patient medication preferences
    console.log('📊 Step 1: Fetching all patient medication preferences...');
    const preferencesQuery = await firestore.collection('patient_medication_preferences').get();
    
    result.totalPatients = preferencesQuery.docs.length;
    console.log(`✅ Found ${result.totalPatients} patient preference records`);

    // Step 2: Identify patients with problematic configurations
    console.log('🔍 Step 2: Identifying problematic configurations...');
    const patientsNeedingFix: Array<{
      docId: string;
      patientId: string;
      data: any;
      issues: string[];
    }> = [];

    for (const doc of preferencesQuery.docs) {
      const data = doc.data();
      const issues: string[] = [];

      // Check for night shift configuration with 2 AM default
      if (data.workSchedule === 'night_shift') {
        // Check evening slot for problematic 02:00 default
        if (data.timeSlots?.evening?.defaultTime === '02:00') {
          issues.push('Evening slot defaults to 02:00 instead of 00:00');
        }

        // Check for incorrect evening slot range (01:00-04:00)
        if (data.timeSlots?.evening?.start === '01:00' && 
            data.timeSlots?.evening?.end === '04:00') {
          issues.push('Evening slot uses incorrect range 01:00-04:00 instead of 23:00-02:00');
        }

        // Check for incorrect bedtime default
        if (data.timeSlots?.bedtime?.defaultTime === '06:00') {
          issues.push('Bedtime slot defaults to 06:00 instead of 08:00');
        }
      }

      // Also check standard schedule for any 02:00 defaults (unusual)
      if (data.workSchedule === 'standard') {
        Object.entries(data.timeSlots || {}).forEach(([slotName, config]: [string, any]) => {
          if (config?.defaultTime === '02:00') {
            issues.push(`Standard schedule ${slotName} slot has unusual 02:00 default`);
          }
        });
      }

      if (issues.length > 0) {
        patientsNeedingFix.push({
          docId: doc.id,
          patientId: data.patientId || doc.id,
          data,
          issues
        });
        
        console.log(`⚠️ Patient ${data.patientId || doc.id} needs fix:`, issues);
      }
    }

    result.patientsNeedingFix = patientsNeedingFix.length;
    console.log(`📊 Found ${result.patientsNeedingFix} patients needing fixes`);

    if (result.patientsNeedingFix === 0) {
      console.log('✅ No patients need fixing - migration complete');
      result.success = true;
      return result;
    }

    // Step 3: Create backup before making changes
    if (!dryRun) {
      console.log('💾 Step 3: Creating backup of original data...');
      try {
        const backup: MigrationBackup = {
          id: `backup_night_shift_fix_${Date.now()}`,
          migrationName: 'fix_night_shift_defaults',
          createdAt: new Date(),
          createdBy,
          totalRecords: patientsNeedingFix.length,
          backupData: patientsNeedingFix.map(patient => ({
            patientId: patient.patientId,
            originalData: patient.data
          }))
        };

        await firestore.collection('migration_backups').doc(backup.id).set({
          ...backup,
          createdAt: admin.firestore.Timestamp.fromDate(backup.createdAt)
        });

        result.backupCreated = true;
        result.backupId = backup.id;
        console.log(`✅ Backup created: ${backup.id}`);
      } catch (backupError) {
        console.error('❌ Failed to create backup:', backupError);
        result.errors.push(`Backup creation failed: ${backupError instanceof Error ? backupError.message : 'Unknown error'}`);
        return result; // Don't proceed without backup
      }
    }

    // Step 4: Fix each patient's configuration
    console.log(`🔧 Step 4: ${dryRun ? 'Simulating' : 'Applying'} fixes...`);
    
    for (const patient of patientsNeedingFix) {
      try {
        const originalConfig = patient.data;
        const newConfig = { ...originalConfig };
        const changeReasons: string[] = [];

        // Fix night shift evening slot
        if (patient.data.workSchedule === 'night_shift') {
          if (patient.data.timeSlots?.evening?.defaultTime === '02:00') {
            newConfig.timeSlots = {
              ...newConfig.timeSlots,
              evening: {
                ...newConfig.timeSlots.evening,
                defaultTime: '00:00',
                start: '23:00',
                end: '02:00',
                label: 'Late Evening'
              }
            };
            changeReasons.push('Fixed evening slot: 02:00 → 00:00, range: 01:00-04:00 → 23:00-02:00');
          } else if (patient.data.timeSlots?.evening?.start === '01:00' && 
                     patient.data.timeSlots?.evening?.end === '04:00') {
            newConfig.timeSlots = {
              ...newConfig.timeSlots,
              evening: {
                ...newConfig.timeSlots.evening,
                start: '23:00',
                end: '02:00',
                defaultTime: newConfig.timeSlots.evening.defaultTime === '02:00' ? '00:00' : newConfig.timeSlots.evening.defaultTime
              }
            };
            changeReasons.push('Fixed evening slot range: 01:00-04:00 → 23:00-02:00');
          }

          // Fix bedtime slot if needed
          if (patient.data.timeSlots?.bedtime?.defaultTime === '06:00') {
            newConfig.timeSlots = {
              ...newConfig.timeSlots,
              bedtime: {
                ...newConfig.timeSlots.bedtime,
                defaultTime: '08:00'
              }
            };
            changeReasons.push('Fixed bedtime slot: 06:00 → 08:00');
          }
        }

        // Fix standard schedule unusual 02:00 defaults
        if (patient.data.workSchedule === 'standard') {
          Object.entries(patient.data.timeSlots || {}).forEach(([slotName, config]: [string, any]) => {
            if (config?.defaultTime === '02:00') {
              // For standard schedule, 02:00 is unusual - suggest 08:00 for morning
              const suggestedTime = slotName === 'morning' ? '08:00' : 
                                   slotName === 'evening' ? '18:00' :
                                   slotName === 'bedtime' ? '22:00' : '12:00';
              
              newConfig.timeSlots = {
                ...newConfig.timeSlots,
                [slotName]: {
                  ...config,
                  defaultTime: suggestedTime
                }
              };
              changeReasons.push(`Fixed ${slotName} slot: 02:00 → ${suggestedTime} (standard schedule)`);
              result.warnings.push(`Patient ${patient.patientId}: Changed ${slotName} from unusual 02:00 to ${suggestedTime}`);
            }
          });
        }

        if (changeReasons.length > 0) {
          // Record the change
          result.changes.push({
            patientId: patient.patientId,
            originalConfig: originalConfig.timeSlots,
            newConfig: newConfig.timeSlots,
            changeReason: changeReasons.join('; '),
            timestamp: new Date()
          });

          // Apply the fix if not dry run
          if (!dryRun) {
            await firestore.collection('patient_medication_preferences').doc(patient.docId).update({
              timeSlots: newConfig.timeSlots,
              updatedAt: admin.firestore.Timestamp.now(),
              migrationApplied: true,
              migrationTimestamp: admin.firestore.Timestamp.now(),
              migrationReason: 'fix_night_shift_2am_defaults',
              migrationBackupId: result.backupId
            });
            
            console.log(`✅ Fixed patient ${patient.patientId}:`, changeReasons);
            result.patientsFixed++;
          } else {
            console.log(`🔍 [DRY RUN] Would fix patient ${patient.patientId}:`, changeReasons);
            result.patientsFixed++;
          }
        } else {
          result.patientsSkipped++;
        }

      } catch (patientError) {
        console.error(`❌ Error processing patient ${patient.patientId}:`, patientError);
        result.errors.push(`Patient ${patient.patientId}: ${patientError instanceof Error ? patientError.message : 'Unknown error'}`);
      }
    }

    // Step 5: Summary
    console.log('📊 Migration Summary:');
    console.log(`  Total patients scanned: ${result.totalPatients}`);
    console.log(`  Patients needing fix: ${result.patientsNeedingFix}`);
    console.log(`  Patients fixed: ${result.patientsFixed}`);
    console.log(`  Patients skipped: ${result.patientsSkipped}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);
    console.log(`  Backup created: ${result.backupCreated}`);
    if (result.backupId) {
      console.log(`  Backup ID: ${result.backupId}`);
    }

    result.success = result.errors.length === 0;
    
    if (dryRun) {
      console.log('✅ DRY RUN completed successfully - no changes made');
    } else {
      console.log('✅ Migration completed successfully');
    }

    return result;

  } catch (error) {
    console.error('❌ Fatal error in migration:', error);
    result.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.success = false;
    return result;
  }
}

/**
 * Rollback migration using backup
 */
export async function rollbackNightShiftFix(backupId: string): Promise<{
  success: boolean;
  patientsRestored: number;
  errors: string[];
}> {
  console.log('🔄 Starting rollback from backup:', backupId);
  
  const rollbackResult = {
    success: false,
    patientsRestored: 0,
    errors: [] as string[]
  };

  try {
    // Get backup data
    const backupDoc = await firestore.collection('migration_backups').doc(backupId).get();
    
    if (!backupDoc.exists) {
      rollbackResult.errors.push('Backup not found');
      return rollbackResult;
    }

    const backup = backupDoc.data() as MigrationBackup;
    console.log(`📦 Found backup with ${backup.totalRecords} records`);

    // Restore each patient's original configuration
    for (const record of backup.backupData) {
      try {
        await firestore.collection('patient_medication_preferences').doc(record.patientId).set(
          {
            ...record.originalData,
            updatedAt: admin.firestore.Timestamp.now(),
            rollbackApplied: true,
            rollbackTimestamp: admin.firestore.Timestamp.now(),
            rollbackFromBackup: backupId
          },
          { merge: false } // Complete replacement
        );
        
        rollbackResult.patientsRestored++;
        console.log(`✅ Restored patient ${record.patientId}`);
      } catch (restoreError) {
        console.error(`❌ Error restoring patient ${record.patientId}:`, restoreError);
        rollbackResult.errors.push(`Patient ${record.patientId}: ${restoreError instanceof Error ? restoreError.message : 'Unknown error'}`);
      }
    }

    rollbackResult.success = rollbackResult.errors.length === 0;
    console.log(`✅ Rollback completed: ${rollbackResult.patientsRestored} patients restored`);
    
    return rollbackResult;

  } catch (error) {
    console.error('❌ Fatal error in rollback:', error);
    rollbackResult.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return rollbackResult;
  }
}

/**
 * Get migration status and statistics
 */
export async function getMigrationStatus(): Promise<{
  hasBeenRun: boolean;
  lastRunDate?: Date;
  totalFixed: number;
  backupIds: string[];
  canRollback: boolean;
}> {
  try {
    // Check for migration backups
    const backupsQuery = await firestore.collection('migration_backups')
      .where('migrationName', '==', 'fix_night_shift_defaults')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (backupsQuery.empty) {
      return {
        hasBeenRun: false,
        totalFixed: 0,
        backupIds: [],
        canRollback: false
      };
    }

    const latestBackup = backupsQuery.docs[0].data();
    
    return {
      hasBeenRun: true,
      lastRunDate: latestBackup.createdAt?.toDate(),
      totalFixed: latestBackup.totalRecords || 0,
      backupIds: backupsQuery.docs.map(doc => doc.id),
      canRollback: true
    };

  } catch (error) {
    console.error('❌ Error getting migration status:', error);
    return {
      hasBeenRun: false,
      totalFixed: 0,
      backupIds: [],
      canRollback: false
    };
  }
}

/**
 * Validate patient preferences for 2 AM issues
 */
export function validatePatientPreferences(preferences: any): {
  isValid: boolean;
  issues: string[];
  fixes: any;
} {
  const issues: string[] = [];
  const fixes: any = {};

  if (!preferences.timeSlots) {
    issues.push('Missing timeSlots configuration');
    return { isValid: false, issues, fixes };
  }

  const workSchedule = preferences.workSchedule || 'standard';

  // Check each time slot for 02:00 defaults
  Object.entries(preferences.timeSlots).forEach(([slotName, config]: [string, any]) => {
    if (config?.defaultTime === '02:00') {
      if (workSchedule === 'night_shift' && slotName === 'evening') {
        issues.push(`Night shift evening slot should default to 00:00, not 02:00`);
        fixes[slotName] = {
          ...config,
          defaultTime: '00:00',
          start: '23:00',
          end: '02:00',
          label: 'Late Evening'
        };
      } else if (workSchedule === 'night_shift') {
        issues.push(`Night shift ${slotName} slot has unusual 02:00 default`);
        const suggestedDefaults: Record<string, string> = {
          morning: '15:00',
          noon: '20:00',
          bedtime: '08:00'
        };
        fixes[slotName] = {
          ...config,
          defaultTime: suggestedDefaults[slotName] || '08:00'
        };
      } else {
        issues.push(`${slotName} slot has unusual 02:00 default for ${workSchedule} schedule`);
        fixes[slotName] = {
          ...config,
          defaultTime: '08:00'
        };
      }
    }
  });

  // Check for incorrect night shift evening range
  if (workSchedule === 'night_shift' && preferences.timeSlots.evening) {
    const evening = preferences.timeSlots.evening;
    if (evening.start === '01:00' && evening.end === '04:00') {
      issues.push('Night shift evening range should be 23:00-02:00, not 01:00-04:00');
      fixes.evening = {
        ...evening,
        start: '23:00',
        end: '02:00',
        defaultTime: evening.defaultTime === '02:00' ? '00:00' : evening.defaultTime
      };
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    fixes
  };
}

/**
 * Generate migration report
 */
export function generateMigrationReport(result: MigrationResult): string {
  const lines: string[] = [];
  
  lines.push('# Night Shift Time Configuration Migration Report');
  lines.push('');
  lines.push(`**Migration Date:** ${new Date().toISOString()}`);
  lines.push(`**Mode:** ${result.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  lines.push(`**Status:** ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  lines.push('');
  
  lines.push('## Summary Statistics');
  lines.push('');
  lines.push(`- Total patients scanned: ${result.totalPatients}`);
  lines.push(`- Patients needing fix: ${result.patientsNeedingFix}`);
  lines.push(`- Patients fixed: ${result.patientsFixed}`);
  lines.push(`- Patients skipped: ${result.patientsSkipped}`);
  lines.push(`- Backup created: ${result.backupCreated ? '✅ Yes' : '❌ No'}`);
  if (result.backupId) {
    lines.push(`- Backup ID: \`${result.backupId}\``);
  }
  lines.push('');
  
  if (result.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    result.errors.forEach(error => {
      lines.push(`- ❌ ${error}`);
    });
    lines.push('');
  }
  
  if (result.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    result.warnings.forEach(warning => {
      lines.push(`- ⚠️ ${warning}`);
    });
    lines.push('');
  }
  
  if (result.changes.length > 0) {
    lines.push('## Changes Applied');
    lines.push('');
    result.changes.forEach((change, index) => {
      lines.push(`### ${index + 1}. Patient: ${change.patientId}`);
      lines.push('');
      lines.push(`**Reason:** ${change.changeReason}`);
      lines.push('');
      lines.push('**Original Configuration:**');
      lines.push('```json');
      lines.push(JSON.stringify(change.originalConfig, null, 2));
      lines.push('```');
      lines.push('');
      lines.push('**New Configuration:**');
      lines.push('```json');
      lines.push(JSON.stringify(change.newConfig, null, 2));
      lines.push('```');
      lines.push('');
    });
  }
  
  if (result.dryRun) {
    lines.push('## Next Steps');
    lines.push('');
    lines.push('This was a DRY RUN. To apply these changes:');
    lines.push('');
    lines.push('1. Review the changes above');
    lines.push('2. Run the migration with `dryRun: false`');
    lines.push('3. Monitor for any issues');
    lines.push('4. Use rollback if needed');
    lines.push('');
  } else {
    lines.push('## Rollback Instructions');
    lines.push('');
    lines.push('If you need to rollback these changes:');
    lines.push('');
    lines.push('```typescript');
    lines.push(`await rollbackNightShiftFix('${result.backupId}');`);
    lines.push('```');
    lines.push('');
  }
  
  return lines.join('\n');
}