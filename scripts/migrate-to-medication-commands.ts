/**
 * Migration Script: Legacy Medications → Unified medication_commands
 *
 * This script migrates data from the legacy medication system to the new unified system:
 * - Source: medications, medication_schedules, medication_reminders collections
 * - Target: medication_commands collection
 *
 * Run with: npx ts-node scripts/migrate-to-medication-commands.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (uses default credentials from environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

interface MigrationStats {
  totalMedications: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ medicationId: string; error: string }>;
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
  isActive: boolean;
  isPRN?: boolean;
  hasReminders?: boolean;
  reminderTimes?: string[];
  startDate?: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  prescribedBy?: string;
  prescribedDate?: admin.firestore.Timestamp;
}

async function migrateMedications(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalMedications: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  console.log('🚀 Starting migration from legacy medications to medication_commands...\n');

  try {
    // Get all medications from legacy collection
    const medicationsSnapshot = await firestore.collection('medications').get();
    stats.totalMedications = medicationsSnapshot.docs.length;

    console.log(`📊 Found ${stats.totalMedications} medications to migrate\n`);

    // Process each medication
    for (const medDoc of medicationsSnapshot.docs) {
      const medicationId = medDoc.id;
      const medicationData = medDoc.data() as LegacyMedication;

      try {
        console.log(`🔄 Migrating: ${medicationData.name} (${medicationId})`);

        // Check if already migrated
        const existingCommand = await firestore
          .collection('medication_commands')
          .doc(medicationId)
          .get();

        if (existingCommand.exists) {
          console.log(`  ⏭️  Already migrated, skipping...`);
          stats.skipped++;
          continue;
        }

        // Get associated schedule
        const scheduleSnapshot = await firestore
          .collection('medication_schedules')
          .where('medicationId', '==', medicationId)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        const scheduleData = scheduleSnapshot.empty ? null : scheduleSnapshot.docs[0].data();

        // Get associated reminder
        const reminderSnapshot = await firestore
          .collection('medication_reminders')
          .where('medicationId', '==', medicationId)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        const reminderData = reminderSnapshot.empty ? null : reminderSnapshot.docs[0].data();

        // Determine medication type for grace period
        const medicationType = classifyMedicationType(medicationData.name, medicationData.frequency);

        // Map frequency to unified format
        const unifiedFrequency = mapFrequency(medicationData.frequency || scheduleData?.frequency || 'daily');

        // Generate times
        const times = scheduleData?.times || 
                     medicationData.reminderTimes || 
                     generateDefaultTimes(unifiedFrequency);

        // Build unified medication command
        const medicationCommand = {
          id: medicationId,
          patientId: medicationData.patientId,
          
          medication: {
            name: medicationData.name,
            genericName: medicationData.genericName,
            brandName: medicationData.brandName,
            dosage: medicationData.dosage || '1 tablet',
            instructions: medicationData.instructions,
            prescribedBy: medicationData.prescribedBy,
            prescribedDate: medicationData.prescribedDate?.toDate() || null
          },
          
          schedule: {
            frequency: unifiedFrequency,
            times: times,
            startDate: scheduleData?.startDate?.toDate() || 
                      medicationData.startDate?.toDate() || 
                      medicationData.createdAt?.toDate() || 
                      new Date(),
            endDate: scheduleData?.endDate?.toDate() || medicationData.endDate?.toDate() || null,
            isIndefinite: scheduleData?.isIndefinite !== false,
            dosageAmount: scheduleData?.dosageAmount || medicationData.dosage || '1 tablet',
            timingType: 'absolute'
          },
          
          reminders: {
            enabled: reminderData?.isActive || medicationData.hasReminders || false,
            minutesBefore: reminderData?.reminderTimes || [15, 5],
            notificationMethods: reminderData?.notificationMethods || ['browser'],
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
            current: medicationData.isActive === false ? 'discontinued' : 
                    scheduleData?.isPaused ? 'paused' : 'active',
            isActive: medicationData.isActive !== false,
            isPRN: medicationData.isPRN || medicationData.frequency === 'as_needed' || false,
            lastStatusChange: new Date(),
            statusChangedBy: 'migration_script'
          },
          
          preferences: {
            timeSlot: determineTimeSlot(times[0]),
            separationRules: []
          },
          
          metadata: {
            version: 1,
            createdAt: medicationData.createdAt?.toDate() || new Date(),
            createdBy: 'migration_script',
            updatedAt: new Date(),
            updatedBy: 'migration_script',
            checksum: generateChecksum(medicationId, medicationData.name, unifiedFrequency),
            migratedFrom: {
              medicationId: medicationId,
              scheduleId: scheduleSnapshot.empty ? null : scheduleSnapshot.docs[0].id,
              reminderId: reminderSnapshot.empty ? null : reminderSnapshot.docs[0].id,
              migratedAt: admin.firestore.Timestamp.now()
            }
          }
        };

        // Write to medication_commands collection
        await firestore
          .collection('medication_commands')
          .doc(medicationId)
          .set(medicationCommand);

        console.log(`  ✅ Successfully migrated`);
        stats.successful++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed: ${errorMessage}`);
        stats.failed++;
        stats.errors.push({ medicationId, error: errorMessage });
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  Total: ${stats.totalMedications}`);
    console.log(`  ✅ Successful: ${stats.successful}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  ❌ Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(({ medicationId, error }) => {
        console.log(`  - ${medicationId}: ${error}`);
      });
    }

    return stats;

  } catch (error) {
    console.error('❌ Fatal migration error:', error);
    throw error;
  }
}

// Helper functions
function classifyMedicationType(name: string, frequency: string): 'critical' | 'standard' | 'vitamin' | 'prn' {
  const nameLower = name.toLowerCase();
  
  if (frequency === 'as_needed') return 'prn';
  
  const criticalMeds = ['insulin', 'warfarin', 'digoxin', 'levothyroxine', 'phenytoin'];
  if (criticalMeds.some(med => nameLower.includes(med))) return 'critical';
  
  const vitaminMeds = ['vitamin', 'multivitamin', 'calcium', 'iron', 'supplement'];
  if (vitaminMeds.some(med => nameLower.includes(med))) return 'vitamin';
  
  return 'standard';
}

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

function getGracePeriod(type: 'critical' | 'standard' | 'vitamin' | 'prn'): number {
  const periods = {
    critical: 15,
    standard: 30,
    vitamin: 120,
    prn: 0
  };
  return periods[type];
}

function determineTimeSlot(time: string): 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom' {
  const hour = parseInt(time.split(':')[0]);
  
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 6) return 'beforeBed';
  
  return 'custom';
}

function generateChecksum(id: string, name: string, frequency: string): string {
  const data = `${id}_${name}_${frequency}_${Date.now()}`;
  return Buffer.from(data).toString('base64').slice(0, 16);
}

// Run migration
migrateMedications()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });