const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✅ Service account JSON parsed successfully');
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
    process.exit(1);
  }
}

if (!serviceAccount) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'claritystream-uldp9'
});

const db = admin.firestore();

async function initMigrationTracking() {
  console.log('🚀 Initializing migration tracking...\n');

  const migrationId = 'medication-system-migration-' + new Date().toISOString().replace(/[:.]/g, '-');
  const timestamp = admin.firestore.Timestamp.now();

  const migrationDoc = {
    migrationId,
    migrationName: 'Medication System Unified Migration',
    description: 'Migration from legacy medication collections to unified event-sourced system',
    status: 'preparation',
    phase: 'phase_1_pre_migration',
    startedAt: timestamp,
    lastUpdatedAt: timestamp,
    completedAt: null,
    
    phases: {
      phase_1_pre_migration: {
        status: 'in_progress',
        startedAt: timestamp,
        completedAt: null,
        tasks: {
          backup_created: {
            status: 'completed',
            completedAt: timestamp,
            details: {
              backup_location: 'backups/medication-migration-2025-10-09T15-38-13-208Z',
              document_counts: {
                legacy: {
                  medications: 0,
                  medication_schedules: 3,
                  medication_reminders: 0,
                  medication_calendar_events: 181,
                  prn_medication_logs: 0,
                  medication_status_changes: 0,
                  medication_reminder_sent_log: 0,
                  medication_notification_delivery_log: 0
                },
                unified: {
                  medication_commands: 0,
                  medication_events: 0,
                  medication_events_archive: 0
                }
              }
            }
          },
          current_state_audit: {
            status: 'completed',
            completedAt: timestamp,
            details: {
              total_legacy_documents: 184,
              total_unified_documents: 0,
              primary_data_source: 'medication_calendar_events',
              migration_complexity: 'low_to_medium'
            }
          },
          environment_preparation: {
            status: 'completed',
            completedAt: timestamp,
            details: {
              indexes_deployed: true,
              new_indexes_added: [
                'medication_events_archive (patientId, archiveStatus.archivedAt)',
                'medication_events_archive (patientId, archiveStatus.belongsToDate)',
                'migration_tracking (migrationName, startedAt)',
                'migration_tracking (status, startedAt)'
              ]
            }
          },
          migration_tracking_created: {
            status: 'completed',
            completedAt: timestamp
          }
        }
      },
      phase_2_data_transformation: {
        status: 'pending',
        startedAt: null,
        completedAt: null
      },
      phase_3_dual_write: {
        status: 'pending',
        startedAt: null,
        completedAt: null
      },
      phase_4_validation: {
        status: 'pending',
        startedAt: null,
        completedAt: null
      },
      phase_5_cutover: {
        status: 'pending',
        startedAt: null,
        completedAt: null
      },
      phase_6_cleanup: {
        status: 'pending',
        startedAt: null,
        completedAt: null
      }
    },

    statistics: {
      total_documents_to_migrate: 184,
      documents_migrated: 0,
      migration_progress_percentage: 0,
      errors_encountered: 0
    },

    metadata: {
      created_by: 'migration_script',
      environment: process.env.NODE_ENV || 'development',
      firebase_project: 'claritystream-uldp9'
    }
  };

  try {
    await db.collection('migration_tracking').doc(migrationId).set(migrationDoc);
    console.log('✅ Migration tracking document created successfully!');
    console.log('\nMigration ID:', migrationId);
    console.log('\nPhase 1 Status:');
    console.log('  ✅ Backup created');
    console.log('  ✅ Current state audit completed');
    console.log('  ✅ Environment preparation completed');
    console.log('  ✅ Migration tracking initialized');
    console.log('\n📊 Migration Statistics:');
    console.log('  Total documents to migrate:', migrationDoc.statistics.total_documents_to_migrate);
    console.log('  Current progress:', migrationDoc.statistics.migration_progress_percentage + '%');
    console.log('\n🎯 Next Phase: Phase 2 - Data Transformation');
    
    return migrationDoc;
  } catch (error) {
    console.error('❌ Error creating migration tracking document:', error);
    throw error;
  }
}

// Run initialization
initMigrationTracking()
  .then(() => {
    console.log('\n✅ Migration tracking initialization complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration tracking initialization failed:', error);
    process.exit(1);
  });