# Medication Single Source of Truth - Deployment & Testing Guide

## Executive Summary

### The Problem
Deleted medications were continuing to show reminders to users, causing confusion and potential medication errors. The root cause was a critical architectural gap:

- **Deletion only affected the unified system** - When medications were deleted, only the `medication_commands` and `medication_events` collections were updated
- **Reminder services read from legacy collections** - The reminder detection and notification services were still reading from the legacy `medication_calendar_events` collection
- **No cross-system CASCADE DELETE** - There was no mechanism to propagate deletions from the unified system to legacy collections

**Impact on Users:**
- Users received reminders for medications they had already deleted
- Confusion about medication schedules and adherence tracking
- Potential medication safety issues from outdated information
- Loss of trust in the system's reliability

### The Solution
We've implemented a comprehensive single source of truth migration that ensures:

1. **Extended CASCADE DELETE** - Deletions now propagate to both unified AND legacy systems
2. **Unified System Migration** - All reminder services now read from `medication_events` (unified collection)
3. **Orphaned Data Cleanup** - Script to remove legacy data that has no corresponding unified records
4. **True Single Source of Truth** - The unified system is now the authoritative source for all medication data

**Expected Outcome:**
- Deleted medications will no longer trigger reminders
- All services read from the same authoritative data source
- Legacy collections are kept in sync for backward compatibility
- Clean, consistent medication data across the entire system

---

## Changes Made

### 1. Extended CASCADE DELETE Trigger
**File:** [`functions/src/triggers/medicationCascadeDelete.ts`](functions/src/triggers/medicationCascadeDelete.ts)

**What Changed:**
- Extended the Firestore trigger to delete from **both unified AND legacy collections**
- Added deletion logic for 3 legacy collections:
  - `medication_calendar_events` (legacy calendar events)
  - `medication_schedules` (legacy schedules)
  - `medication_reminders` (legacy reminders)
- Implemented batched deletion (500 records per batch) for performance
- Added comprehensive error handling and logging
- Tracks deletion statistics in `migration_tracking` collection

**Key Features:**
- Automatically triggers when a `medication_commands` document is deleted
- Deletes from 5 collections total (2 unified + 3 legacy)
- Handles large datasets with batch processing
- Continues execution even if individual deletions fail
- Provides detailed logging for monitoring and debugging

### 2. Missed Medication Detector Service
**File:** [`functions/src/services/missedMedicationDetector.ts`](functions/src/services/missedMedicationDetector.ts)

**What Changed:**
- **Migrated from legacy to unified system**
- Now queries `medication_events` collection instead of `medication_calendar_events`
- Uses unified event types: `dose_scheduled`, `dose_taken`, `dose_missed`, `dose_skipped`
- Reads grace period data from unified event structure
- Creates `dose_missed` events in the unified system

**Migration Details:**
- Query changed from `medication_calendar_events` → `medication_events`
- Event type filter: `eventType == 'dose_scheduled'`
- Grace period now read from `timing.gracePeriodEnd` field
- All new missed events created in unified `medication_events` collection

### 3. Medication Monitoring Service
**File:** [`functions/src/services/medicationMonitoringService.ts`](functions/src/services/medicationMonitoringService.ts)

**What Changed:**
- **Migrated to unified system for health checks**
- Monitors `medication_events` collection for stuck events
- Checks for `dose_scheduled` events that haven't been resolved
- Updated all queries to use unified collection structure

**Key Updates:**
- Health monitoring now checks unified `medication_events` collection
- Detects stuck events using `eventType == 'dose_scheduled'` filter
- Performance metrics track unified system operations
- Alert system monitors unified event processing

### 4. Medication Calendar Sync Service
**File:** [`functions/src/services/MedicationCalendarSyncService.ts`](functions/src/services/MedicationCalendarSyncService.ts)

**What Changed:**
- **Migrated to sync from unified system**
- Now syncs from `medication_events` → `medical_events` (calendar)
- Uses unified event structure for all operations
- Added `syncedFromUnifiedSystem` flag to track source

**Sync Flow:**
1. Reads `dose_scheduled` events from `medication_events` (unified)
2. Creates/updates corresponding `medical_events` (calendar)
3. Maps unified event types to calendar statuses
4. Maintains bidirectional sync with unified system as source of truth

### 5. Orphaned Data Cleanup Script
**File:** [`scripts/cleanup-orphaned-legacy-data.cjs`](scripts/cleanup-orphaned-legacy-data.cjs)

**What It Does:**
- Identifies orphaned legacy data (records without corresponding unified entries)
- Creates backup before any deletion
- Removes orphaned records from 3 legacy collections
- Provides detailed reporting and logging

**Features:**
- **Dry-run mode** (default) - Shows what would be deleted without actually deleting
- **Execute mode** (`--execute`) - Actually deletes orphaned data
- **Backup-only mode** (`--backup-only`) - Creates backup without deletion
- Batch processing (500 records per batch)
- Comprehensive logging and error handling
- Detailed JSON reports for audit trail

---

## Pre-Deployment Checklist

### ✅ Data Backup
- [ ] **Backup Firestore database**
  ```bash
  # Using gcloud CLI
  gcloud firestore export gs://[BUCKET_NAME]/backups/pre-single-source-migration
  ```
- [ ] **Verify backup completed successfully**
  ```bash
  gcloud firestore operations list
  ```
- [ ] **Document backup location and timestamp**

### ✅ Verify Unified System Health
- [ ] **Check medication_commands collection**
  - Verify all active medications have corresponding commands
  - Check for any corrupted or incomplete records
  
- [ ] **Check medication_events collection**
  - Verify events are being created properly
  - Check for any stuck or orphaned events
  
- [ ] **Run health check query:**
  ```javascript
  // In Firebase Console
  db.collection('medication_commands')
    .where('commandType', '==', 'CREATE_MEDICATION')
    .where('status.current', '==', 'active')
    .count()
    .get()
  ```

### ✅ Check Active Operations
- [ ] **Verify no active medication operations in progress**
  - Check for pending deletions
  - Check for in-progress updates
  - Verify no scheduled migrations running

- [ ] **Check Cloud Functions logs**
  ```bash
  gcloud functions logs read --limit 50
  ```

### ✅ Environment Preparation
- [ ] **Ensure Firebase Admin SDK is up to date**
- [ ] **Verify service account has necessary permissions**
- [ ] **Check Cloud Functions deployment status**
- [ ] **Verify environment variables are set:**
  - `FIREBASE_SERVICE_ACCOUNT_KEY`
  - Project ID configured correctly

---

## Deployment Steps

### Step 1: Deploy Updated CASCADE DELETE Trigger

**Purpose:** Enable cross-system deletion to prevent orphaned legacy data

**Commands:**
```bash
# Navigate to functions directory
cd functions

# Install dependencies (if needed)
npm install

# Deploy only the CASCADE DELETE trigger
firebase deploy --only functions:onMedicationCommandDelete

# Verify deployment
firebase functions:log --only onMedicationCommandDelete --limit 10
```

**Expected Output:**
```
✔ functions[onMedicationCommandDelete(us-central1)] Successful update operation.
Function URL: https://us-central1-[PROJECT-ID].cloudfunctions.net/onMedicationCommandDelete
```

**Verification:**
1. Check Firebase Console → Functions
2. Verify `onMedicationCommandDelete` shows as "Healthy"
3. Check recent logs for any errors

**⚠️ CRITICAL:** Do not proceed if deployment fails. Investigate and resolve errors first.

---

### Step 2: Deploy Updated Services

**Purpose:** Migrate reminder services to read from unified system

**Commands:**
```bash
# Deploy all updated Cloud Functions
firebase deploy --only functions

# Or deploy specific functions:
firebase deploy --only functions:scheduledMissedDetection
firebase deploy --only functions:scheduledMedicationReminders
firebase deploy --only functions:medicationCalendarSync
```

**Expected Output:**
```
✔ functions[scheduledMissedDetection(us-central1)] Successful update operation.
✔ functions[scheduledMedicationReminders(us-central1)] Successful update operation.
✔ functions[medicationCalendarSync(us-central1)] Successful update operation.
```

**Verification Steps:**
1. **Check function logs immediately after deployment:**
   ```bash
   firebase functions:log --limit 20
   ```

2. **Verify functions are reading from unified system:**
   - Look for log entries mentioning `medication_events` collection
   - Should NOT see references to `medication_calendar_events` in new logs

3. **Monitor for errors:**
   ```bash
   # Watch logs in real-time
   firebase functions:log --follow
   ```

**⚠️ WARNING:** If you see errors about missing collections or fields, rollback immediately.

---

### Step 3: Run Orphaned Data Cleanup Script

**Purpose:** Remove legacy data that has no corresponding unified records

#### 3a. Dry-Run Mode (Recommended First)

**Command:**
```bash
# From project root
node scripts/cleanup-orphaned-legacy-data.cjs
```

**What It Does:**
- Scans for orphaned records
- Creates backup
- Shows what WOULD be deleted (without actually deleting)
- Generates detailed report

**Expected Output:**
```
🧹 ORPHANED LEGACY MEDICATION DATA CLEANUP
Mode: DRY-RUN
================================================================================
🔍 Scanning for orphaned legacy medication data...
✓ Found 150 valid medications in unified system

📊 Orphaned Records Found:
================================================================================
⚠️  medication_calendar_events: 23 orphaned records
⚠️  medication_schedules: 15 orphaned records
⚠️  medication_reminders: 31 orphaned records

Total orphaned records: 69

📦 Creating backup...
✓ Backup saved to: backups/orphaned-legacy-cleanup-2025-10-09T17-30-00-000Z.json

💡 DRY-RUN MODE: No records were deleted.
   Run with --execute to delete these records
```

**Review the Output:**
1. Check the sample records shown
2. Verify these are truly orphaned (no corresponding medication in unified system)
3. Review the backup file to ensure all data is captured

#### 3b. Create Backup Only (Optional)

**Command:**
```bash
node scripts/cleanup-orphaned-legacy-data.cjs --backup-only
```

**Use Case:** If you want to create a backup without seeing the dry-run analysis

#### 3c. Execute Cleanup (After Verification)

**⚠️ CRITICAL WARNING:** This will permanently delete orphaned data. Ensure backup is complete and verified.

**Command:**
```bash
node scripts/cleanup-orphaned-legacy-data.cjs --execute
```

**Expected Output:**
```
🧹 ORPHANED LEGACY MEDICATION DATA CLEANUP
Mode: EXECUTE
================================================================================
[... scanning output ...]

🗑️  Deleting orphaned data...
✓ Deleted 23 medication_calendar_events
✓ Deleted 15 medication_schedules
✓ Deleted 31 medication_reminders

📊 Total: 69 orphaned records removed

📄 Detailed report saved to: backups/cleanup-report-cleanup-2025-10-09T17-35-00-000Z.json
```

**Post-Cleanup Verification:**
1. Check the detailed report JSON file
2. Verify deletion counts match dry-run predictions
3. Check for any errors in the report
4. Keep backup file safe for potential rollback

---

### Step 4: Verify Single Source of Truth

**Purpose:** Confirm unified system is the authoritative source

#### 4a. Test Medication Deletion

**Steps:**
1. **Create a test medication:**
   ```javascript
   // In Firebase Console or via API
   POST /api/medications
   {
     "name": "Test Medication DELETE",
     "dosage": "10mg",
     "frequency": "daily"
   }
   ```

2. **Verify creation in all collections:**
   ```javascript
   // Check unified system
   db.collection('medication_commands')
     .where('medication.name', '==', 'Test Medication DELETE')
     .get()
   
   // Check events created
   db.collection('medication_events')
     .where('context.medicationName', '==', 'Test Medication DELETE')
     .get()
   ```

3. **Delete the test medication:**
   ```javascript
   DELETE /api/medications/{medicationId}
   ```

4. **Verify CASCADE DELETE worked:**
   ```javascript
   // Check medication_events (should be deleted)
   db.collection('medication_events')
     .where('commandId', '==', '{medicationId}')
     .get()
   // Expected: 0 documents
   
   // Check legacy collections (should be deleted)
   db.collection('medication_calendar_events')
     .where('medicationId', '==', '{medicationId}')
     .get()
   // Expected: 0 documents
   
   db.collection('medication_schedules')
     .where('medicationId', '==', '{medicationId}')
     .get()
   // Expected: 0 documents
   
   db.collection('medication_reminders')
     .where('medicationId', '==', '{medicationId}')
     .get()
   // Expected: 0 documents
   ```

5. **Check CASCADE DELETE logs:**
   ```bash
   firebase functions:log --only onMedicationCommandDelete --limit 5
   ```

**Expected Log Output:**
```
🗑️ CASCADE DELETE TRIGGER: Medication command deleted: {medicationId}
✅ Deleted X medication_events
✅ Deleted X archived events
✅ Deleted X legacy calendar events
✅ Deleted X legacy schedules
✅ Deleted X legacy reminders
✅ CASCADE DELETE TRIGGER COMPLETED
```

#### 4b. Verify Services Use Unified Collections

**Test Missed Detection:**
```bash
# Trigger missed detection manually
firebase functions:call scheduledMissedDetection

# Check logs
firebase functions:log --only scheduledMissedDetection --limit 10
```

**Expected Log Entries:**
- ✅ "Querying medication_events for scheduled doses"
- ✅ "Found X potentially overdue events"
- ❌ Should NOT see "medication_calendar_events" in logs

**Test Calendar Sync:**
```bash
# Trigger calendar sync
firebase functions:call medicationCalendarSync

# Check logs
firebase functions:log --only medicationCalendarSync --limit 10
```

**Expected Log Entries:**
- ✅ "Syncing from medication_events to medical_events"
- ✅ "syncedFromUnifiedSystem: true"
- ❌ Should NOT see legacy collection references

#### 4c. Confirm No Orphaned Data Remains

**Run cleanup script in dry-run mode again:**
```bash
node scripts/cleanup-orphaned-legacy-data.cjs
```

**Expected Output:**
```
📊 Orphaned Records Found:
================================================================================
✓ medication_calendar_events: 0 orphaned records
✓ medication_schedules: 0 orphaned records
✓ medication_reminders: 0 orphaned records

✅ No orphaned records found. Database is clean!
```

---

## Testing & Validation

### Test 1: CASCADE DELETE Functionality

**Objective:** Verify deletions propagate to all collections

**Test Steps:**
1. Create test medication with scheduled doses
2. Wait for events to be created in all collections
3. Delete the medication
4. Verify all related data is deleted

**Validation Queries:**
```javascript
// After deletion, all these should return 0 documents:

// Unified system
db.collection('medication_events')
  .where('commandId', '==', '{deletedMedicationId}')
  .count().get()

db.collection('medication_events_archive')
  .where('commandId', '==', '{deletedMedicationId}')
  .count().get()

// Legacy system
db.collection('medication_calendar_events')
  .where('medicationId', '==', '{deletedMedicationId}')
  .count().get()

db.collection('medication_schedules')
  .where('medicationId', '==', '{deletedMedicationId}')
  .count().get()

db.collection('medication_reminders')
  .where('medicationId', '==', '{deletedMedicationId}')
  .count().get()
```

**Expected Results:**
- ✅ All queries return 0 documents
- ✅ CASCADE DELETE logs show successful deletion from all collections
- ✅ No errors in function logs

**⚠️ If Test Fails:**
- Check CASCADE DELETE trigger logs for errors
- Verify trigger is deployed and active
- Check Firestore security rules aren't blocking deletions

---

### Test 2: Missed Medication Detection

**Objective:** Verify missed detection uses unified system

**Test Steps:**
1. Create medication with dose scheduled 2 hours ago
2. Wait for grace period to expire
3. Trigger missed detection function
4. Verify `dose_missed` event created in unified system

**Validation:**
```javascript
// Check for dose_missed event in unified system
db.collection('medication_events')
  .where('commandId', '==', '{medicationId}')
  .where('eventType', '==', 'dose_missed')
  .orderBy('timing.eventTimestamp', 'desc')
  .limit(1)
  .get()
```

**Expected Results:**
- ✅ `dose_missed` event exists in `medication_events`
- ✅ Event has correct `eventType`, `commandId`, and `patientId`
- ✅ Grace period data is populated
- ✅ Function logs show "Querying medication_events"

**Check Logs:**
```bash
firebase functions:log --only scheduledMissedDetection --limit 20
```

**Expected Log Output:**
```
🔍 Starting missed medication detection sweep...
🔍 Found X potentially overdue events (query took Xms)
📋 Marked as missed: [Medication Name] for patient [patientId]
✅ Missed medication detection completed
```

---

### Test 3: Calendar Sync from Unified System

**Objective:** Verify calendar sync reads from unified system

**Test Steps:**
1. Create medication with future scheduled doses
2. Trigger calendar sync function
3. Verify events synced to `medical_events` collection
4. Check sync metadata

**Validation:**
```javascript
// Check medical_events for synced medication
db.collection('medical_events')
  .where('medicationId', '==', '{medicationId}')
  .where('syncedFromUnifiedSystem', '==', true)
  .get()
```

**Expected Results:**
- ✅ Medical events created with `syncedFromUnifiedSystem: true`
- ✅ Events have correct `medicationEventId` linking to unified system
- ✅ `lastSyncedAt` timestamp is recent
- ✅ Event details match unified system data

**Check Sync Status:**
```javascript
// Via API or Cloud Function
GET /api/medication-calendar-sync/status?patientId={patientId}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalMedicationEvents": 10,
    "syncedToCalendar": 10,
    "pendingSync": 0,
    "lastSyncAt": "2025-10-09T17:45:00.000Z"
  }
}
```

---

### Test 4: No Orphaned Data After Operations

**Objective:** Verify no orphaned data is created during normal operations

**Test Steps:**
1. Perform various medication operations:
   - Create medication
   - Update medication
   - Delete medication
   - Mark dose as taken
   - Skip dose
2. Run orphaned data check

**Validation:**
```bash
# Run cleanup script in dry-run mode
node scripts/cleanup-orphaned-legacy-data.cjs
```

**Expected Results:**
- ✅ 0 orphaned records in all legacy collections
- ✅ All legacy data has corresponding unified records
- ✅ No warnings or errors in cleanup output

**If Orphaned Data Found:**
1. Review the sample records shown
2. Identify which operation created orphaned data
3. Check if CASCADE DELETE is working properly
4. Verify services are creating data in unified system

---

### Test 5: End-to-End User Scenario

**Objective:** Verify complete user workflow works correctly

**Scenario:**
1. User adds new medication
2. System schedules doses
3. User takes a dose
4. User deletes the medication
5. Verify no reminders appear for deleted medication

**Test Steps:**

**Step 1: Add Medication**
```javascript
POST /api/medications
{
  "name": "E2E Test Medication",
  "dosage": "5mg",
  "frequency": "twice_daily",
  "times": ["08:00", "20:00"]
}
```

**Step 2: Verify Scheduling**
```javascript
// Check unified events created
db.collection('medication_events')
  .where('commandId', '==', '{medicationId}')
  .where('eventType', '==', 'dose_scheduled')
  .get()
// Should have scheduled doses
```

**Step 3: Mark Dose Taken**
```javascript
POST /api/medications/{medicationId}/take
{
  "eventId": "{scheduledEventId}",
  "takenAt": "2025-10-09T08:05:00Z"
}
```

**Step 4: Delete Medication**
```javascript
DELETE /api/medications/{medicationId}
```

**Step 5: Verify No Reminders**
```javascript
// Wait 5 minutes, then check:

// No scheduled events remain
db.collection('medication_events')
  .where('commandId', '==', '{medicationId}')
  .where('eventType', '==', 'dose_scheduled')
  .get()
// Expected: 0 documents

// No legacy reminders
db.collection('medication_reminders')
  .where('medicationId', '==', '{medicationId}')
  .get()
// Expected: 0 documents

// Trigger missed detection
firebase functions:call scheduledMissedDetection

// Verify no missed events created for deleted medication
db.collection('medication_events')
  .where('commandId', '==', '{medicationId}')
  .where('eventType', '==', 'dose_missed')
  .get()
// Expected: 0 documents
```

**Expected Results:**
- ✅ All medication data deleted from all collections
- ✅ No reminders triggered for deleted medication
- ✅ No missed detection for deleted medication
- ✅ Clean deletion with no orphaned data

---

## Rollback Plan

### When to Rollback

Rollback immediately if you encounter:
- ❌ CASCADE DELETE failures causing data inconsistency
- ❌ Services unable to read from unified system
- ❌ Widespread errors in function logs
- ❌ Data loss or corruption
- ❌ Critical functionality broken

### Rollback Steps

#### Step 1: Rollback Cloud Functions

**Command:**
```bash
# List recent deployments
firebase functions:list

# Rollback to previous version
firebase rollback functions:onMedicationCommandDelete
firebase rollback functions:scheduledMissedDetection
firebase rollback functions:scheduledMedicationReminders
firebase rollback functions:medicationCalendarSync
```

**Verification:**
```bash
# Check function versions
firebase functions:list --json | grep version

# Monitor logs for stability
firebase functions:log --follow
```

#### Step 2: Restore Data from Backup

**If orphaned data cleanup caused issues:**

```bash
# Restore from Firestore export
gcloud firestore import gs://[BUCKET_NAME]/backups/pre-single-source-migration

# Or restore from cleanup backup
node scripts/restore-from-cleanup-backup.js backups/orphaned-legacy-cleanup-[TIMESTAMP].json
```

**Manual Restoration Script:**
```javascript
// restore-from-cleanup-backup.js
const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

async function restore(backupPath) {
  const backup = JSON.parse(fs.readFileSync(backupPath));
  
  for (const [collection, records] of Object.entries(backup.orphanedData)) {
    console.log(`Restoring ${records.length} records to ${collection}...`);
    
    const batch = db.batch();
    records.forEach(record => {
      const docRef = db.collection(collection).doc(record.id);
      batch.set(docRef, record);
    });
    
    await batch.commit();
    console.log(`✓ Restored ${collection}`);
  }
}

restore(process.argv[2]);
```

#### Step 3: Verify System Stability

**Check all critical functions:**
```bash
# Test each function
firebase functions:call scheduledMissedDetection
firebase functions:call scheduledMedicationReminders
firebase functions:call medicationCalendarSync

# Monitor for errors
firebase functions:log --limit 50
```

**Verify data integrity:**
```javascript
// Check medication counts
db.collection('medication_commands')
  .where('commandType', '==', 'CREATE_MEDICATION')
  .count().get()

// Check event counts
db.collection('medication_events')
  .count().get()

// Compare with pre-deployment counts
```

#### Step 4: Document Rollback

**Create rollback report:**
```markdown
# Rollback Report

**Date:** [TIMESTAMP]
**Reason:** [Why rollback was necessary]
**Actions Taken:**
- [ ] Functions rolled back to version: [VERSION]
- [ ] Data restored from backup: [BACKUP_PATH]
- [ ] Verification completed

**Issues Encountered:**
- [List issues that triggered rollback]

**Data Impact:**
- Records affected: [COUNT]
- Collections impacted: [LIST]

**Next Steps:**
- [What needs to be fixed before retry]
```

### Recovery Steps

**After rollback, before retry:**

1. **Analyze root cause:**
   - Review error logs
   - Identify what failed
   - Determine if it's code, data, or configuration issue

2. **Fix identified issues:**
   - Update code if needed
   - Correct data inconsistencies
   - Adjust configuration

3. **Test in staging:**
   - Deploy to staging environment first
   - Run full test suite
   - Verify all scenarios work

4. **Retry deployment:**
   - Follow deployment steps again
   - Monitor closely
   - Have rollback plan ready

---

## Post-Deployment Monitoring

### What to Monitor

#### 1. CASCADE DELETE Performance

**Metrics to Track:**
- Deletion execution time
- Number of records deleted per trigger
- Error rate
- Batch processing efficiency

**Monitoring Query:**
```javascript
// Check migration tracking
db.collection('migration_tracking')
  .doc('medication_system')
  .get()
```

**Expected Data:**
```json
{
  "statistics": {
    "totalDeleted": 150,
    "eventsDeleted": 450,
    "archivedEventsDeleted": 23,
    "legacyCalendarEventsDeleted": 312,
    "legacySchedulesDeleted": 156,
    "legacyRemindersDeleted": 289
  },
  "lastCascadeDelete": {
    "commandId": "...",
    "timestamp": "...",
    "eventsDeleted": 3,
    "legacyCalendarEventsDeleted": 2,
    "...": "..."
  }
}
```

**Alert Thresholds:**
- ⚠️ Warning: Execution time > 30 seconds
- 🚨 Critical: Error rate > 5%
- 🚨 Critical: Batch failures

#### 2. Missed Detection Health

**Metrics to Track:**
- Detection run frequency
- Events processed per run
- Missed events detected
- Error rate
- Execution time

**Monitoring:**
```bash
# Check recent detection metrics
firebase functions:log --only scheduledMissedDetection --limit 20
```

**Health Check Query:**
```javascript
db.collection('medication_detection_metrics')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get()
```

**Alert Thresholds:**
- ⚠️ Warning: No detection run in > 20 minutes
- ⚠️ Warning: Execution time > 4 minutes
- 🚨 Critical: Error rate > 5%
- 🚨 Critical: Detection not running

#### 3. Calendar Sync Status

**Metrics to Track:**
- Sync success rate
- Events synced per run
- Sync lag (time between event creation and sync)
- Orphaned medical events

**Monitoring:**
```javascript
// Check sync status for all patients
GET /api/medication-calendar-sync/health
```

**Expected Response:**
```json
{
  "healthy": true,
  "totalPatients": 150,
  "syncedPatients": 150,
  "pendingSync": 0,
  "lastSyncAt": "2025-10-09T17:50:00Z",
  "issues": []
}
```

**Alert Thresholds:**
- ⚠️ Warning: Pending sync > 10 events
- ⚠️ Warning: Sync lag > 1 hour
- 🚨 Critical: Sync failures > 10%

#### 4. System Alerts

**Check system alerts collection:**
```javascript
db.collection('system_alerts')
  .where('status', '==', 'active')
  .where('severity', 'in', ['warning', 'critical'])
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get()
```

**Alert Types to Monitor:**
- Performance degradation
- Data integrity issues
- Error spikes
- Function timeouts

### Warning Signs of Issues

**🚨 Immediate Action Required:**

1. **Orphaned Data Reappearing**
   ```bash
   # Run orphaned data check daily for first week
   node scripts/cleanup-orphaned-legacy-data.cjs
   ```
   - If orphaned data found: CASCADE DELETE may not be working
   - Action: Check trigger logs, verify deployment

2. **Deleted Medications Still Showing Reminders**
   - Check if CASCADE DELETE trigger is active
   - Verify services are reading from unified system
   - Check for cached data in client applications

3. **High Error Rates in Functions**
   ```bash
   firebase functions:log --only errors --limit 50
   ```
   - Action: Identify error pattern, rollback if widespread

4. **Data Inconsistency Between Collections**
   ```javascript
   // Compare counts
   const commandsCount = await db.collection('medication_commands')
     .where('status.current', '==', 'active').count().get();
   
   const eventsCount = await db.collection('medication_events')
     .where('eventType', '==', 'dose_scheduled').count().get();
   
   // Should be proportional
   ```

### How to Verify Fix is Working

**Daily Checks (First Week):**

1. **Run orphaned data check:**
   ```bash
   node scripts/cleanup-orphaned-legacy-data.cjs
   ```
   Expected: 0 orphaned records

2. **Check CASCADE DELETE logs:**
   ```bash
   firebase functions:log --only onMedicationCommandDelete --limit 10
   ```
   Expected: Successful deletions from all collections

3. **Verify service health:**
   ```bash
   firebase functions:log --only scheduledMissedDetection --limit 5
   ```
   Expected: Reading from `medication_events`

**Weekly Checks (First Month):**

1. **Review system alerts:**
   ```javascript
   db.collection('system_alerts')
     .where('createdAt', '>', sevenDaysAgo)
     .get()
   ```

2. **Check performance metrics:**
   ```javascript
   db.collection('medication_detection_metrics')
     .where('timestamp', '>', sevenDaysAgo)
     .get()
   ```

3. **Verify data consistency:**
   - Run test deletion
   - Verify CASCADE DELETE works
   - Check no orphaned data created

**Success Indicators:**
- ✅ 0 orphaned records consistently
- ✅ All deletions propagate to all collections
- ✅ No reminders for deleted medications
- ✅ Services reading from unified system
- ✅ Error rate < 1%
- ✅ No critical alerts

---

## Future Recommendations

### Phase 1: Archive Legacy Collections (After 30 Days)

**Once confident in unified system:**

1. **Create final backup of legacy collections:**
   ```bash
   gcloud firestore export gs://[BUCKET]/legacy-final-backup \
     --collection-ids=medication_calendar_events,medication_schedules,medication_reminders
   ```

2. **Mark collections as archived:**
   ```javascript
   // Add metadata document
   db.collection('medication_calendar_events').doc('_ARCHIVED').set({
     archivedAt: new Date(),
     reason: 'Migrated to unified system',
     backupLocation: 'gs://[BUCKET]/legacy-final-backup'
   });
   ```

3. **Update documentation:**
   - Mark legacy collections as deprecated
   - Update API documentation
   - Notify developers

### Phase 2: Remove Legacy API Endpoints (After 60 Days)

**Deprecate and remove legacy endpoints:**

1. **Add deprecation warnings:**
   ```javascript
   // In legacy endpoints
   res.setHeader('X-API-Deprecated', 'true');
   res.setHeader('X-API-Sunset', '2025-12-31');
   ```

2. **Monitor usage:**
   ```javascript
   // Track legacy endpoint usage
   db.collection('api_usage_metrics')
     .where('endpoint', 'in', ['/legacy/medications', ...])
     .get()
   ```

3. **Remove when usage drops to 0:**
   - Delete legacy endpoint code
   - Remove from API documentation
   - Update client applications

### Phase 3: Update Security Rules (After 90 Days)

**Restrict access to legacy collections:**

```javascript
// firestore.rules
match /medication_calendar_events/{eventId} {
  // Read-only for backward compatibility
  allow read: if request.auth != null;
  allow write: if false; // Prevent new writes
}

match /medication_schedules/{scheduleId} {
  allow read: if request.auth != null;
  allow write: if false;
}

match /medication_reminders/{reminderId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```

### Phase 4: Complete Legacy Removal (After 6 Months)

**Final cleanup:**

1. **Verify no dependencies:**
   - Check all code references
   - Verify no client apps using legacy data
   - Confirm all services migrated

2. **Delete legacy collections:**
   ```bash
   # Final backup first
   gcloud firestore export gs://[BUCKET]/legacy-deletion-backup
   
   # Delete collections (use with extreme caution)
   firebase firestore:delete medication_calendar_events --recursive
   firebase firestore:delete medication_schedules --recursive
   firebase firestore:delete medication_reminders --recursive
   ```

3. **Update architecture documentation:**
   - Remove legacy system references
   - Update data flow diagrams
   - Document unified system as sole source of truth

### Ongoing Improvements

**Monitoring & Alerting:**
- Set up automated alerts for orphaned data
- Create dashboard for CASCADE DELETE metrics
- Monitor unified system health continuously

**Performance Optimization:**
- Optimize CASCADE DELETE batch sizes
- Add indexes for common queries
- Implement caching where appropriate

**Data Quality:**
- Regular data integrity checks
- Automated cleanup scripts
- Validation rules for new data

---

## Appendix

### A. Quick Reference Commands

**Deployment:**
```bash
# Deploy CASCADE DELETE trigger
firebase deploy --only functions:onMedicationCommandDelete

# Deploy all functions
firebase deploy --only functions

# Check deployment status
firebase functions:list
```

**Monitoring:**
```bash
# View function logs
firebase functions:log --limit 50

# Follow logs in real-time
firebase functions:log --follow

# View specific function logs
firebase functions:log --only onMedicationCommandDelete
```

**Cleanup:**
```bash
# Dry-run (safe)
node scripts/cleanup-orphaned-legacy-data.cjs

# Backup only
node scripts/cleanup-orphaned-legacy-data.cjs --backup-only

# Execute cleanup (destructive)
node scripts/cleanup-orphaned-legacy-data.cjs --execute
```

**Rollback:**
```bash
# Rollback specific function
firebase rollback functions:onMedicationCommandDelete

# Restore from backup
gcloud firestore import gs://[BUCKET]/backups/[BACKUP_NAME]
```

### B. Firestore Collections Reference

**Unified System (Source of Truth):**
- `medication_commands` - Command log for all medication operations
- `medication_events` - Event sourcing for all medication events
- `medication_events_archive` - Archived events

**Legacy System (Kept in Sync):**
- `medication_calendar_events` - Legacy calendar events
- `medication_schedules` - Legacy schedules
- `medication_reminders` - Legacy reminders

**Supporting Collections:**
- `migration_tracking` - Tracks CASCADE DELETE statistics
- `medication_detection_metrics` - Missed detection performance
- `system_alerts` - System health alerts
- `medical_events` - Unified calendar (synced from medication_events)

### C. Event Types Reference

**Unified System Event Types:**
- `dose_scheduled` - Dose scheduled for future
- `dose_taken` - Dose marked as taken
- `dose_missed` - Dose missed (auto-detected or manual)
- `dose_skipped` - Dose intentionally skipped
- `dose_snoozed` - Dose reminder snoozed

**Legacy Status Mapping:**
- `scheduled` → `dose_scheduled`
- `taken` → `dose_taken`
- `missed` → `dose_missed`
- `skipped` → `dose_skipped`

### D. Troubleshooting Guide

**Issue: CASCADE DELETE not working**
- Check trigger deployment: `firebase functions:list`
- Verify trigger logs: `firebase functions:log --only onMedicationCommandDelete`
- Check Firestore rules allow deletions
- Verify service account permissions

**Issue: Services still reading from legacy collections**
- Check function deployment status
- Verify code references `medication_events` not `medication_calendar_events`
- Clear any caches
- Redeploy functions

**Issue: Orphaned data keeps appearing**
- Verify CASCADE DELETE is active
- Check if any code is still writing to legacy collections
- Review recent deployments for regressions
- Check for race conditions in deletion logic

**Issue: Performance degradation**
- Check batch sizes in CASCADE DELETE
- Review Firestore indexes
- Monitor function execution times
- Consider increasing function memory/timeout

### E. Contact & Support

**For Issues During Deployment:**
1. Check this guide's troubleshooting section
2. Review function logs for specific errors
3. Check Firebase Console for system status
4. Rollback if critical issues occur

**For Questions:**
- Review architecture documentation
- Check code comments in modified files
- Consult team lead or senior developer

**Emergency Rollback:**
- Follow rollback plan immediately
- Document all issues encountered
- Preserve logs and error messages
- Schedule post-mortem review

---

## Deployment Checklist Summary

**Pre-Deployment:**
- [ ] Backup Firestore database
- [ ] Verify unified system health
- [ ] Check no active operations
- [ ] Prepare environment

**Deployment:**
- [ ] Deploy CASCADE DELETE trigger
- [ ] Deploy updated services
- [ ] Run cleanup script (dry-run)
- [ ] Review cleanup results
- [ ] Execute cleanup (if safe)
- [ ] Verify single source of truth

**Testing:**
- [ ] Test CASCADE DELETE
- [ ] Test missed detection
- [ ] Test calendar sync
- [ ] Verify no orphaned data
- [ ] Run end-to-end scenario

**Post-Deployment:**
- [ ] Monitor CASCADE DELETE metrics
- [ ] Monitor service health
- [ ] Check for orphaned data daily
- [ ] Review system alerts
- [ ] Verify fix is working

**Success Criteria:**
- ✅ All tests passing
- ✅ 0 orphaned records
- ✅ No reminders for deleted medications
- ✅ Services reading from unified system
- ✅ Error rate < 1%
- ✅ No critical alerts

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-09  
**Author:** Development Team  
**Status:** Ready for Deployment