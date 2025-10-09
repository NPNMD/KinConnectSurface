const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
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
  console.log('Please ensure .env file contains FIREBASE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'claritystream-uldp9'
});

const db = admin.firestore();

// Collections to backup
const LEGACY_COLLECTIONS = [
  'medications',
  'medication_schedules',
  'medication_reminders',
  'medication_calendar_events',
  'prn_medication_logs',
  'medication_status_changes',
  'medication_reminder_sent_log',
  'medication_notification_delivery_log'
];

const UNIFIED_COLLECTIONS = [
  'medication_commands',
  'medication_events',
  'medication_events_archive'
];

async function backupCollection(collectionName) {
  console.log('Backing up collection: ' + collectionName);
  const snapshot = await db.collection(collectionName).get();
  const documents = [];
  
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  console.log('  - Found ' + documents.length + ' documents');
  return { collection: collectionName, count: documents.length, documents };
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', 'medication-migration-' + timestamp);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log('Creating backup in: ' + backupDir + '\n');
  
  const backup = {
    timestamp,
    legacy_collections: [],
    unified_collections: [],
    summary: {}
  };
  
  // Backup legacy collections
  console.log('Backing up legacy collections...');
  for (const collection of LEGACY_COLLECTIONS) {
    try {
      const result = await backupCollection(collection);
      backup.legacy_collections.push(result);
      backup.summary[collection] = result.count;
    } catch (error) {
      console.error('Error backing up ' + collection + ':', error.message);
      backup.summary[collection] = { error: error.message };
    }
  }
  
  // Backup unified collections
  console.log('\nBacking up unified collections...');
  for (const collection of UNIFIED_COLLECTIONS) {
    try {
      const result = await backupCollection(collection);
      backup.unified_collections.push(result);
      backup.summary[collection] = result.count;
    } catch (error) {
      console.error('Error backing up ' + collection + ':', error.message);
      backup.summary[collection] = { error: error.message };
    }
  }
  
  // Save backup to file
  const backupFile = path.join(backupDir, 'backup.json');
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  
  // Save summary separately
  const summaryFile = path.join(backupDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    timestamp,
    backup_location: backupDir,
    summary: backup.summary
  }, null, 2));
  
  console.log('\n=== Backup Complete ===');
  console.log('Backup location: ' + backupDir);
  console.log('Backup file: ' + backupFile);
  console.log('\nDocument counts:');
  console.log(JSON.stringify(backup.summary, null, 2));
  
  return backup;
}

// Run backup
createBackup()
  .then(() => {
    console.log('\nBackup completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Backup failed:', error);
    process.exit(1);
  });