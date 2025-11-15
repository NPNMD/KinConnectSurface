/**
 * Legacy Medication Migration Script
 * 
 * Migrates existing medications from legacy format to unified format.
 * Reads from `medications` and `medication_schedules` collections and
 * transforms to unified `medication_commands` format.
 * 
 * Features:
 * - Dry-run mode to preview changes without applying
 * - Backup creation before migration
 * - Comprehensive logging and error handling
 * - Progress tracking and reporting
 * - Handles missing fields with sensible defaults
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ===== TYPES =====

interface MigrationOptions {
  dryRun: boolean;
  patientId?: string;
  createBackup: boolean;
  batchSize: number;
  verbose: boolean;
}

interface MigrationStats {
  totalMedications: number;
  successful: number;
  failed: number;
  skipped: number;
  backupCreated: boolean;
  backupPath?: string;
  errors: Array<{
    medicationId: string;
    medicationName: string;
    error: string;
    timestamp: Date;
  }>;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

interface LegacyMedication {
  id: string;
  patientId: string;
  name: string;
  genericName?: string;
  brandName?: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedBy?: string;
  prescribedDate?: admin.firestore.Timestamp;
  startDate?: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  isActive: boolean;
  isPRN?: boolean;
  hasReminders?: boolean;
  reminderTimes?: string[];
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  [key: string]: any;
}

interface LegacySchedule {
  id: string;
  medicationId: string;
  frequency: string;
  times: string[];
  daysOfWeek?: number[];
  startDate?: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  dosageAmount?: string;
  isActive: boolean;
  isPaused?: boolean;
  pausedUntil?: admin.firestore.Timestamp;
  [key: string]: any;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Classify medication type based on name and frequency
 */
function classifyMedicationType(name: string, frequency: string): 'critical' | 'standard' | 'vitamin' | 'prn' {
  const nameLower = name.toLowerCase();
  
  if (frequency === 'as_needed' || frequency.includes('prn')) return 'prn';
  
  const criticalMeds = ['insulin', 'warfarin', 'digoxin', 'levothyroxine', 'phenytoin', 'heart', 'cardiac'];
  if (criticalMeds.some(med => nameLower.includes(med))) return 'critical';
  
  const vitaminMeds = ['vitamin', 'multivitamin', 'calcium', 'iron', 'supplement', 'omega'];
  if (vitaminMeds.some(med => nameLower.includes(med))) return 'vitamin';
  
  return 'standard';
}

/**
 * Map legacy frequency to unified frequency
 */
function mapFrequency(frequency: string): string {
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
 * Generate default times based on frequency
 */
function generateDefaultTimes(frequency: string): string[] {
  switch (frequency) {
    case 'daily': return ['08:00'];
    case 'twice_daily': return ['08:00', '20:00'];
    case 'three_times_daily': return ['08:00', '14:00', '20:00'];
    case 'four_times_daily': return ['08:00', '12:00', '17:00', '22:00'];
    case 'weekly':
    case 'monthly': return ['08:00'];
    case 'as_needed': return [];
    default: return ['08:00'];
  }
}

/**
 * Get grace period based on medication type
 */
function getGracePeriod(type: 'critical' | 'standard' | 'vitamin' | 'prn'): number {
  const periods = {
    critical: 15,
    standard: 30,
    vitamin: 120,
    prn: 0
  };
  return periods[type];
}

/**
 * Determine time slot based on time
 */
function determineTimeSlot(time: string): 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom' {
  const hour = parseInt(time.split(':')[0]);
  
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 6) return 'beforeBed';
  
  return 'custom';
}

/**
 * Generate checksum for data integrity
 */
function generateChecksum(id: string, name: string, frequency: string): string {
  const data = `${id}_${name}_${frequency}_${Date.now()}`;
  return Buffer.from(data).toString('base64').slice(0, 16);
}

/**
 * Create backup of collections
 */
async function createBackup(patientId?: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', 'medication-migration');
  const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
  
  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log('📦 Creating backup...');
  
  const backup: any = {
    timestamp: new Date().toISOString(),
    patientId: patientId || 'all',
    collections: {}
  };
  
  // Backup medications
  let medicationsQuery = db.collection('medications');
  if (patientId) {
    medicationsQuery = medicationsQuery.where('patientId', '==', patientId) as any;
  }
  const medicationsSnapshot = await medicationsQuery.get();
  backup.collections.medications = medicationsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Backup medication_schedules
  const schedulesSnapshot = await db.collection('medication_schedules').get();
  backup.collections.medication_schedules = schedulesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Backup medication_reminders
  const remindersSnapshot = await db.collection('medication_reminders').get();
  backup.collections.medication_reminders = remindersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Write backup file
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  
  console.log(`✅ Backup created: ${backupPath}`);
  console.log(`   - Medications: ${backup.collections.medications.length}`);
  console.log(`   - Schedules: ${backup.collections.medication_schedules.length}`);
  console.log(`   - Reminders: ${backup.collections.medication_reminders.length}`);
  
  return backupPath;
}

/**
 * Migrate a single medication
 */
async function migrateMedication(
  medication: LegacyMedication,
  schedule: LegacySchedule | null,
  reminder: any | null,
  dryRun: boolean,
  verbose: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const medicationType = classifyMedicationType(medication.name, medication.frequency || 'daily');
    const unifiedFrequency = mapFrequency(medication.frequency || schedule?.frequency || 'daily');
    const times = schedule?.times || medication.reminderTimes || generateDefaultTimes(unifiedFrequency);
    
    // Build unified medication command
    const medicationCommand = {
      id: medication.id,
      patientId: medication.patientId,
      
      medication: {
        name: medication.name,
        genericName: medication.genericName || null,
        brandName: medication.brandName || null,
        dosage: medication.dosage || '1 tablet',
        instructions: medication.instructions || null,
        prescribedBy: medication.prescribedBy || null,
        prescribedDate: medication.prescribedDate?.toDate() || null
      },
      
      schedule: {
        frequency: unifiedFrequency,
        times: times,
        startDate: schedule?.startDate?.toDate() || 
                  medication.startDate?.toDate() || 
                  medication.createdAt?.toDate() || 
                  new Date(),
        endDate: schedule?.endDate?.toDate() || medication.endDate?.toDate() || null,
        isIndefinite: !(schedule?.endDate || medication.endDate),
        dosageAmount: schedule?.dosageAmount || medication.dosage || '1 tablet',
        timingType: 'absolute'
      },
      
      reminders: {
        enabled: reminder?.isActive || medication.hasReminders || false,
        minutesBefore: reminder?.reminderTimes || [15, 5],
        notificationMethods: reminder?.notificationMethods || ['browser'],
        quietHours: {
          start: '22:00',
          end: '07:00',
          enabled: true
        }
      },
      
      gracePeriod: {
        defaultMinutes: getGracePeriod(medicationType),
        medicationType: medicationType,
        weekendMultiplier: 1.5,
        holidayMultiplier: 2.0
      },
      
      status: {
        current: medication.isActive === false ? 'discontinued' : 
                schedule?.isPaused ? 'paused' : 'active',
        isActive: medication.isActive !== false,
        isPRN: medication.isPRN || medication.frequency === 'as_needed' || false,
        pausedUntil: schedule?.pausedUntil?.toDate() || null,
        lastStatusChange: admin.firestore.Timestamp.now(),
        statusChangedBy: 'migration_script'
      },
      
      preferences: {
        timeSlot: determineTimeSlot(times[0] || '08:00'),
        separationRules: []
      },
      
      metadata: {
        version: 1,
        createdAt: medication.createdAt?.toDate() || new Date(),
        createdBy: 'migration_script',
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: 'migration_script',
        checksum: generateChecksum(medication.id, medication.name, unifiedFrequency),
        migratedFrom: {
          medicationId: medication.id,
          scheduleId: schedule?.id || null,
          reminderId: reminder?.id || null,
          migratedAt: admin.firestore.Timestamp.now()
        }
      }
    };
    
    if (verbose) {
      console.log(`   📋 Medication: ${medication.name}`);
      console.log(`      - Frequency: ${unifiedFrequency}`);
      console.log(`      - Times: ${times.join(', ')}`);
      console.log(`      - Type: ${medicationType}`);
    }
    
    if (!dryRun) {
      await db.collection('medication_commands').doc(medication.id).set(medicationCommand);
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main migration function
 */
async function migrate(options: MigrationOptions): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalMedications: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    backupCreated: false,
    errors: [],
    startTime: new Date()
  };
  
  console.log('\n🚀 Starting Legacy Medication Migration');
  console.log('==========================================');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Patient ID: ${options.patientId || 'ALL'}`);
  console.log(`Batch Size: ${options.batchSize}`);
  console.log(`Create Backup: ${options.createBackup}`);
  console.log('==========================================\n');
  
  // Create backup if requested
  if (options.createBackup && !options.dryRun) {
    try {
      stats.backupPath = await createBackup(options.patientId);
      stats.backupCreated = true;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      throw new Error('Backup creation failed. Migration aborted.');
    }
  }
  
  // Get all medications to migrate
  let medicationsQuery = db.collection('medications');
  if (options.patientId) {
    medicationsQuery = medicationsQuery.where('patientId', '==', options.patientId) as any;
  }
  
  const medicationsSnapshot = await medicationsQuery.get();
  stats.totalMedications = medicationsSnapshot.docs.length;
  
  console.log(`📊 Found ${stats.totalMedications} medications to migrate\n`);
  
  // Process medications in batches
  const medications = medicationsSnapshot.docs;
  for (let i = 0; i < medications.length; i += options.batchSize) {
    const batch = medications.slice(i, i + options.batchSize);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / options.batchSize) + 1} (${i + 1}-${Math.min(i + options.batchSize, medications.length)} of ${medications.length})`);
    
    for (const medDoc of batch) {
      const medicationId = medDoc.id;
      const medicationData = medDoc.data() as LegacyMedication;
      
      try {
        // Check if already migrated
        const existingCommand = await db.collection('medication_commands')
          .doc(medicationId)
          .get();
        
        if (existingCommand.exists && !options.dryRun) {
          console.log(`  ⏭️  ${medicationData.name} - Already migrated, skipping...`);
          stats.skipped++;
          continue;
        }
        
        // Get associated schedule
        const scheduleSnapshot = await db.collection('medication_schedules')
          .where('medicationId', '==', medicationId)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        
        const scheduleData = scheduleSnapshot.empty ? null : scheduleSnapshot.docs[0].data() as LegacySchedule;
        
        // Get associated reminder
        const reminderSnapshot = await db.collection('medication_reminders')
          .where('medicationId', '==', medicationId)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        
        const reminderData = reminderSnapshot.empty ? null : reminderSnapshot.docs[0].data();
        
        // Migrate medication
        const result = await migrateMedication(
          medicationData,
          scheduleData,
          reminderData,
          options.dryRun,
          options.verbose
        );
        
        if (result.success) {
          console.log(`  ✅ ${medicationData.name} - ${options.dryRun ? 'Would migrate' : 'Migrated'}`);
          stats.successful++;
        } else {
          console.error(`  ❌ ${medicationData.name} - Failed: ${result.error}`);
          stats.failed++;
          stats.errors.push({
            medicationId,
            medicationName: medicationData.name,
            error: result.error || 'Unknown error',
            timestamp: new Date()
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ ${medicationData.name} - Failed: ${errorMessage}`);
        stats.failed++;
        stats.errors.push({
          medicationId,
          medicationName: medicationData.name,
          error: errorMessage,
          timestamp: new Date()
        });
      }
    }
  }
  
  stats.endTime = new Date();
  stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
  
  // Print summary
  console.log('\n==========================================');
  console.log('📊 Migration Summary');
  console.log('==========================================');
  console.log(`Total Medications: ${stats.totalMedications}`);
  console.log(`✅ Successful: ${stats.successful}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⏱️  Duration: ${(stats.duration / 1000).toFixed(2)}s`);
  
  if (stats.backupCreated) {
    console.log(`📦 Backup: ${stats.backupPath}`);
  }
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(err => {
      console.log(`   - ${err.medicationName} (${err.medicationId}): ${err.error}`);
    });
  }
  
  console.log('==========================================\n');
  
  return stats;
}

// ===== CLI INTERFACE =====

async function main() {
  const args = process.argv.slice(2);
  
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    patientId: args.find(arg => arg.startsWith('--patient='))?.split('=')[1],
    createBackup: !args.includes('--no-backup'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Legacy Medication Migration Script

Usage:
  npm run migrate:medications [options]

Options:
  --dry-run, -d              Preview changes without applying them
  --patient=<id>             Migrate medications for specific patient only
  --no-backup                Skip backup creation (not recommended)
  --batch-size=<n>           Process medications in batches of n (default: 10)
  --verbose, -v              Show detailed migration information
  --help, -h                 Show this help message

Examples:
  npm run migrate:medications --dry-run
  npm run migrate:medications --patient=user123
  npm run migrate:medications --batch-size=20 --verbose
    `);
    process.exit(0);
  }
  
  try {
    const stats = await migrate(options);
    
    // Exit with error code if there were failures
    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { migrate, MigrationOptions, MigrationStats };