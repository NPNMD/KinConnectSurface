# Medication Archiving System - Deployment & Testing Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Steps](#deployment-steps)
3. [Testing Plan](#testing-plan)
4. [Verification Steps](#verification-steps)
5. [Rollback Plan](#rollback-plan)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Known Limitations](#known-limitations)
8. [Firestore Index Requirements](#firestore-index-requirements)
9. [Testing Scripts](#testing-scripts)

---

## Pre-Deployment Checklist

### Required Firestore Indexes

Before deployment, ensure the following Firestore indexes are created. Add this to your `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "archiveStatus.isArchived", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "archiveStatus.belongsToDate", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_daily_summaries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "summaryDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "patient_time_preferences",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lifestyle.timezone", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Environment Variables

Verify these are set in your Firebase Functions configuration:

```bash
# No new environment variables required
# System uses existing Firebase Admin SDK credentials
```

### Dependencies to Verify

Check that these dependencies are installed in `functions/package.json`:

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "luxon": "^3.4.0"  // For timezone handling
  }
}
```

### Backup Procedures

**CRITICAL: Backup before deployment**

```bash
# 1. Export Firestore data
gcloud firestore export gs://[YOUR-BUCKET]/backups/pre-archive-deployment

# 2. Backup specific collections
# medication_events
# medication_commands
# patient_time_preferences

# 3. Document current state
# - Number of active medication events
# - Number of patients with medications
# - Current timezone distribution
```

### Patient Data Requirements

Ensure all patients have timezone information:

```javascript
// Query to check patients without timezone
db.collection('patient_time_preferences')
  .where('lifestyle.timezone', '==', null)
  .get()
  .then(snapshot => {
    console.log(`Patients without timezone: ${snapshot.size}`);
  });
```

**Action Required:** Set default timezone for patients without one:
- Default: `America/Chicago` (or appropriate for your region)
- Update via Patient Profile or admin script

---

## Deployment Steps

### Step 1: Deploy Backend Functions

**Order:** Backend must be deployed before frontend

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy all functions
firebase deploy --only functions

# OR deploy specific functions
firebase deploy --only functions:scheduledMedicationDailyReset
firebase deploy --only functions:api
```

**Expected Output:**
```
✔  functions[scheduledMedicationDailyReset(us-central1)] Successful update operation.
✔  functions[api(us-central1)] Successful update operation.
Function URL (api): https://us-central1-[PROJECT-ID].cloudfunctions.net/api
```

**Verification:**
```bash
# Check function deployment
firebase functions:list

# Should show:
# scheduledMedicationDailyReset (Scheduled: every 15 minutes)
# api (HTTP)
```

### Step 2: Create Firestore Indexes

```bash
# Deploy indexes from firestore.indexes.json
firebase deploy --only firestore:indexes

# This may take 5-15 minutes to build
# Monitor progress in Firebase Console > Firestore > Indexes
```

**Verification:**
- Go to Firebase Console > Firestore > Indexes
- Verify all 5 indexes show "Enabled" status
- Wait for all indexes to complete building

### Step 3: Deploy Frontend

```bash
# Navigate to project root
cd ..

# Install dependencies
npm install

# Build frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

**Expected Output:**
```
✔  hosting: Finished running predeploy script.
✔  hosting: 150 files uploaded.
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/[PROJECT-ID]/overview
Hosting URL: https://[PROJECT-ID].web.app
```

### Step 4: Verify Scheduled Function

```bash
# Check Cloud Scheduler
gcloud scheduler jobs list

# Should show:
# firebase-schedule-scheduledMedicationDailyReset-us-central1
# Schedule: every 15 minutes
# State: ENABLED
```

**Manual Trigger Test:**
```bash
# Trigger the scheduled function manually
gcloud scheduler jobs run firebase-schedule-scheduledMedicationDailyReset-us-central1
```

### Step 5: Initialize First Daily Reset

**Option A: Wait for Midnight**
- Function will automatically run at midnight for patients in their timezone
- Monitor logs starting at 11:45 PM in earliest timezone

**Option B: Manual Trigger (Recommended for Testing)**
```bash
# Use the API endpoint to trigger manually
curl -X POST https://us-central1-[PROJECT-ID].cloudfunctions.net/api/unified-medication/medication-events/trigger-daily-reset \
  -H "Authorization: Bearer [USER-TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/Chicago",
    "dryRun": true
  }'
```

---

## Testing Plan

### Unit Testing

#### Test 1: Timezone Calculations
```javascript
// Test file: functions/src/utils/__tests__/timezoneUtils.test.ts

describe('Timezone Utils', () => {
  test('calculatePatientMidnight - various timezones', () => {
    const timezones = [
      'America/New_York',
      'America/Chicago', 
      'America/Los_Angeles',
      'Europe/London',
      'Asia/Tokyo'
    ];
    
    timezones.forEach(tz => {
      const midnight = calculatePatientMidnight(tz);
      expect(midnight.getHours()).toBe(0);
      expect(midnight.getMinutes()).toBe(0);
    });
  });

  test('getPreviousDayBoundaries - correct date range', () => {
    const { startOfDay, endOfDay, dateString } = 
      getPreviousDayBoundaries('America/Chicago');
    
    expect(endOfDay.getTime() - startOfDay.getTime())
      .toBe(24 * 60 * 60 * 1000); // 24 hours
    expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

#### Test 2: Archive Filtering
```javascript
// Test file: functions/src/services/unified/__tests__/MedicationEventService.test.ts

describe('Archive Filtering', () => {
  test('queryEvents - excludes archived by default', async () => {
    const result = await eventService.queryEvents({
      patientId: 'test-patient',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31')
    });
    
    const hasArchived = result.data?.some(e => e.archiveStatus?.isArchived);
    expect(hasArchived).toBe(false);
  });

  test('queryEvents - includes archived when requested', async () => {
    const result = await eventService.queryEvents({
      patientId: 'test-patient',
      excludeArchived: false,
      onlyArchived: true
    });
    
    const allArchived = result.data?.every(e => e.archiveStatus?.isArchived);
    expect(allArchived).toBe(true);
  });
});
```

#### Test 3: Daily Summary Calculations
```javascript
// Test file: functions/src/services/unified/__tests__/DailyResetService.test.ts

describe('Daily Summary', () => {
  test('calculateStatistics - correct adherence rate', () => {
    const events = [
      { eventType: 'dose_scheduled' },
      { eventType: 'dose_scheduled' },
      { eventType: 'dose_taken', timing: { isOnTime: true } },
      { eventType: 'dose_missed' }
    ];
    
    const stats = service.calculateStatistics(events);
    expect(stats.totalScheduledDoses).toBe(2);
    expect(stats.totalTakenDoses).toBe(1);
    expect(stats.adherenceRate).toBe(50);
  });
});
```

### Integration Testing

#### Test 1: Complete Daily Reset Flow
```javascript
describe('Daily Reset Integration', () => {
  test('executeDailyReset - end-to-end', async () => {
    // Setup: Create test patient with events
    const patientId = await createTestPatient({
      timezone: 'America/Chicago'
    });
    
    await createTestEvents(patientId, {
      date: 'yesterday',
      count: 5
    });
    
    // Execute reset
    const result = await dailyResetService.executeDailyReset({
      patientId,
      timezone: 'America/Chicago',
      dryRun: false
    });
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.statistics.eventsArchived).toBe(5);
    expect(result.statistics.summaryCreated).toBe(true);
    
    // Check events are archived
    const events = await getEvents(patientId);
    expect(events.every(e => e.archiveStatus?.isArchived)).toBe(true);
    
    // Check summary exists
    const summary = await getDailySummary(patientId, 'yesterday');
    expect(summary).toBeDefined();
    expect(summary.statistics.totalScheduledDoses).toBeGreaterThan(0);
  });
});
```

#### Test 2: Scheduled Function Execution
```javascript
describe('Scheduled Function', () => {
  test('runs at midnight for correct patients', async () => {
    // Setup: Create patients in different timezones
    const patients = await createTestPatients([
      { timezone: 'America/New_York', atMidnight: true },
      { timezone: 'America/Chicago', atMidnight: false },
      { timezone: 'Asia/Tokyo', atMidnight: false }
    ]);
    
    // Execute scheduled function
    await scheduledMedicationDailyReset();
    
    // Verify only midnight patients processed
    const logs = await getDailyResetLogs();
    expect(logs[0].patientsAtMidnight).toBe(1);
    expect(logs[0].successfulResets).toBe(1);
  });
});
```

#### Test 3: API Endpoints
```javascript
describe('Archive API', () => {
  test('GET /archived - returns archived events', async () => {
    const response = await request(app)
      .get('/unified-medication/medication-events/archived')
      .query({ patientId: testPatientId })
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /daily-summaries/:date - returns specific summary', async () => {
    const date = '2025-01-15';
    const response = await request(app)
      .get(`/unified-medication/medication-events/daily-summaries/${date}`)
      .query({ patientId: testPatientId })
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.data.summaryDate).toBe(date);
  });
});
```

### Manual Testing Checklist

#### Pre-Deployment Testing

- [ ] **Test 1: Verify Today's View Excludes Archives**
  1. Log in as test patient
  2. Navigate to Medications page
  3. Verify only today's medications show
  4. Confirm no archived events appear

- [ ] **Test 2: Test Daily Reset at Midnight**
  1. Create test events for "yesterday"
  2. Manually trigger daily reset via API
  3. Verify events are archived
  4. Check daily summary is created
  5. Confirm events no longer appear in today's view

- [ ] **Test 3: Verify Archived Events Display**
  1. Click "History" button on Medications page
  2. Verify archived events appear in history view
  3. Check adherence statistics are correct
  4. Test date range filtering (7, 30, 90 days)

- [ ] **Test 4: Test Timezone Handling**
  1. Create patients in different timezones:
     - America/New_York (EST)
     - America/Chicago (CST)
     - America/Los_Angeles (PST)
     - Europe/London (GMT)
  2. Verify each patient's midnight is calculated correctly
  3. Test daily reset respects patient timezone

- [ ] **Test 5: Test with Multiple Patients**
  1. Create 3+ test patients
  2. Add medications to each
  3. Trigger daily reset
  4. Verify each patient's data is processed independently
  5. Check no data leakage between patients

- [ ] **Test 6: Test Family Member Access**
  1. Log in as family member
  2. Navigate to patient's medication history
  3. Verify family member can view archived events
  4. Confirm access permissions are enforced

#### Post-Deployment Testing

- [ ] **Test 7: Verify Scheduled Function Runs**
  1. Wait for next 15-minute interval
  2. Check Cloud Functions logs
  3. Verify function executes successfully
  4. Check `daily_reset_logs` collection for entries

- [ ] **Test 8: Monitor First Midnight Reset**
  1. Identify patients at midnight in next hour
  2. Monitor logs during midnight window
  3. Verify events are archived
  4. Check daily summaries are created

- [ ] **Test 9: Verify Frontend Updates**
  1. Clear browser cache
  2. Reload application
  3. Verify new History button appears
  4. Test history view functionality
  5. Confirm empty states display correctly

- [ ] **Test 10: Performance Testing**
  1. Create patient with 100+ medication events
  2. Trigger daily reset
  3. Measure execution time
  4. Verify batch operations work correctly
  5. Check memory usage stays within limits

---

## Verification Steps

### 1. Verify Daily Reset is Working

**Check Execution Logs:**
```javascript
// Query daily_reset_logs collection
db.collection('daily_reset_logs')
  .orderBy('executionTime', 'desc')
  .limit(10)
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => {
      const log = doc.data();
      console.log(`
        Execution: ${log.executionTime.toDate()}
        Patients Checked: ${log.totalPatientsChecked}
        At Midnight: ${log.patientsAtMidnight}
        Successful: ${log.successfulResets}
        Failed: ${log.failedResets}
        Events Archived: ${log.totalEventsArchived}
      `);
    });
  });
```

**Expected Results:**
- Function runs every 15 minutes
- Processes patients at midnight in their timezone
- Success rate > 95%
- No fatal errors

### 2. Verify Events Are Being Archived

**Query Archived Events:**
```javascript
// Check for archived events
db.collection('medication_events')
  .where('archiveStatus.isArchived', '==', true)
  .limit(10)
  .get()
  .then(snapshot => {
    console.log(`Total archived events: ${snapshot.size}`);
    snapshot.forEach(doc => {
      const event = doc.data();
      console.log(`
        Event ID: ${doc.id}
        Patient: ${event.patientId}
        Archived At: ${event.archiveStatus.archivedAt.toDate()}
        Belongs To: ${event.archiveStatus.belongsToDate}
        Summary ID: ${event.archiveStatus.dailySummaryId}
      `);
    });
  });
```

**Expected Results:**
- Events have `archiveStatus.isArchived = true`
- `archivedAt` timestamp is set
- `belongsToDate` matches the day the event occurred
- `dailySummaryId` references valid summary document

### 3. Verify Daily Summaries

**Query Daily Summaries:**
```javascript
// Check daily summaries
db.collection('medication_daily_summaries')
  .orderBy('summaryDate', 'desc')
  .limit(10)
  .get()
  .then(snapshot => {
    console.log(`Total summaries: ${snapshot.size}`);
    snapshot.forEach(doc => {
      const summary = doc.data();
      console.log(`
        Date: ${summary.summaryDate}
        Patient: ${summary.patientId}
        Scheduled: ${summary.statistics.totalScheduledDoses}
        Taken: ${summary.statistics.totalTakenDoses}
        Adherence: ${summary.statistics.adherenceRate}%
        Events Archived: ${summary.archivedEvents.totalArchived}
      `);
    });
  });
```

**Expected Results:**
- One summary per patient per day
- Statistics match archived events
- Adherence rates calculated correctly
- Medication breakdown present

### 4. Monitor Cloud Function Execution

**View Logs in Firebase Console:**
```bash
# Command line
firebase functions:log --only scheduledMedicationDailyReset

# Or use gcloud
gcloud functions logs read scheduledMedicationDailyReset \
  --limit 50 \
  --format "table(timestamp, severity, textPayload)"
```

**Look for:**
- ✅ "Starting daily reset for patient X"
- ✅ "Found N events to archive"
- ✅ "Daily reset completed in Xms"
- ❌ Any error messages

### 5. Verify Data Integrity

**Check for Data Consistency:**
```javascript
// Verify no data loss
async function verifyDataIntegrity(patientId, date) {
  // Get daily summary
  const summaryId = `${patientId}_${date}`;
  const summary = await db.collection('medication_daily_summaries')
    .doc(summaryId)
    .get();
  
  if (!summary.exists) {
    console.error('Summary not found');
    return false;
  }
  
  // Get archived events
  const events = await db.collection('medication_events')
    .where('patientId', '==', patientId)
    .where('archiveStatus.belongsToDate', '==', date)
    .where('archiveStatus.isArchived', '==', true)
    .get();
  
  const summaryData = summary.data();
  const eventCount = events.size;
  
  // Verify counts match
  if (summaryData.archivedEvents.totalArchived !== eventCount) {
    console.error('Event count mismatch');
    return false;
  }
  
  // Verify all event IDs are present
  const eventIds = events.docs.map(doc => doc.id);
  const summaryEventIds = summaryData.archivedEvents.eventIds;
  
  const allPresent = eventIds.every(id => summaryEventIds.includes(id));
  if (!allPresent) {
    console.error('Event IDs mismatch');
    return false;
  }
  
  console.log('✅ Data integrity verified');
  return true;
}
```

---

## Rollback Plan

### If Issues Occur During Deployment

#### Step 1: Assess the Situation

**Determine severity:**
- **Critical:** Data loss, system down, patients affected
- **Major:** Feature not working, errors in logs
- **Minor:** UI issues, non-critical bugs

#### Step 2: Immediate Actions

**For Critical Issues:**
```bash
# 1. Disable scheduled function
gcloud scheduler jobs pause firebase-schedule-scheduledMedicationDailyReset-us-central1

# 2. Rollback frontend
firebase hosting:rollback

# 3. Rollback functions
firebase deploy --only functions --version [PREVIOUS-VERSION]
```

**For Major Issues:**
```bash
# Disable just the scheduled function
gcloud scheduler jobs pause firebase-schedule-scheduledMedicationDailyReset-us-central1

# Keep API endpoints active for manual testing
```

#### Step 3: Restore Previous Functionality

**Option A: Disable Daily Reset (Keep Archive Access)**
```javascript
// Modify scheduledMedicationDailyReset.ts
export const scheduledMedicationDailyReset = functions
  .pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    console.log('Daily reset temporarily disabled');
    return null; // No-op
  });

// Redeploy
firebase deploy --only functions:scheduledMedicationDailyReset
```

**Option B: Full Rollback**
```bash
# 1. Restore from backup
gcloud firestore import gs://[YOUR-BUCKET]/backups/pre-archive-deployment

# 2. Deploy previous version
git checkout [PREVIOUS-COMMIT]
firebase deploy

# 3. Verify system is stable
```

#### Step 4: Data Recovery Procedures

**If Events Were Incorrectly Archived:**
```javascript
// Script to un-archive events
async function unarchiveEvents(patientId, date) {
  const batch = db.batch();
  
  const events = await db.collection('medication_events')
    .where('patientId', '==', patientId)
    .where('archiveStatus.belongsToDate', '==', date)
    .get();
  
  events.forEach(doc => {
    batch.update(doc.ref, {
      'archiveStatus.isArchived': false,
      'archiveStatus.archivedAt': null,
      'archiveStatus.archivedReason': null
    });
  });
  
  await batch.commit();
  console.log(`Un-archived ${events.size} events`);
}
```

**If Daily Summaries Are Incorrect:**
```javascript
// Script to delete and regenerate summaries
async function regenerateSummary(patientId, date) {
  // Delete existing summary
  const summaryId = `${patientId}_${date}`;
  await db.collection('medication_daily_summaries')
    .doc(summaryId)
    .delete();
  
  // Trigger new daily reset
  const result = await dailyResetService.executeDailyReset({
    patientId,
    timezone: 'America/Chicago', // Use patient's actual timezone
    dryRun: false
  });
  
  console.log('Summary regenerated:', result);
}
```

#### Step 5: Communication Plan

**Notify Stakeholders:**
1. Internal team via Slack/email
2. Users if service is affected (via in-app notification)
3. Document incident in post-mortem

**Status Updates:**
- Initial: "Investigating issue with medication archiving"
- Progress: "Rollback in progress, ETA 30 minutes"
- Resolution: "Issue resolved, system stable"

---

## Monitoring and Maintenance

### Metrics to Monitor

#### 1. Function Execution Metrics

**Cloud Functions Dashboard:**
- Execution count (should be ~96/day)
- Execution time (average < 5 seconds)
- Error rate (< 1%)
- Memory usage (< 256MB)

**Query for Metrics:**
```javascript
// Get execution statistics
db.collection('daily_reset_logs')
  .where('executionTime', '>=', new Date(Date.now() - 24*60*60*1000))
  .get()
  .then(snapshot => {
    const logs = snapshot.docs.map(doc => doc.data());
    
    const avgDuration = logs.reduce((sum, log) => sum + log.durationMs, 0) / logs.length;
    const totalPatients = logs.reduce((sum, log) => sum + log.patientsAtMidnight, 0);
    const totalArchived = logs.reduce((sum, log) => sum + log.totalEventsArchived, 0);
    const errorRate = logs.filter(log => log.failedResets > 0).length / logs.length;
    
    console.log(`
      Last 24 Hours:
      - Executions: ${logs.length}
      - Avg Duration: ${avgDuration}ms
      - Patients Processed: ${totalPatients}
      - Events Archived: ${totalArchived}
      - Error Rate: ${(errorRate * 100).toFixed(2)}%
    `);
  });
```

#### 2. Data Growth Metrics

**Monitor Collection Sizes:**
```javascript
// Check collection growth
async function checkCollectionGrowth() {
  const collections = [
    'medication_events',
    'medication_daily_summaries',
    'daily_reset_logs'
  ];
  
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).count().get();
    console.log(`${collectionName}: ${snapshot.data().count} documents`);
  }
}
```

**Expected Growth:**
- `medication_events`: +5-20 per patient per day
- `medication_daily_summaries`: +1 per patient per day
- `daily_reset_logs`: +96 per day

#### 3. Archive Status Distribution

**Monitor Archive Ratios:**
```javascript
// Check archived vs active events
async function checkArchiveRatio() {
  const total = await db.collection('medication_events').count().get();
  const archived = await db.collection('medication_events')
    .where('archiveStatus.isArchived', '==', true)
    .count()
    .get();
  
  const ratio = (archived.data().count / total.data().count) * 100;
  console.log(`Archive Ratio: ${ratio.toFixed(2)}%`);
  
  // Expected: Increases over time, stabilizes around 90-95%
}
```

### Expected Cloud Function Execution Patterns

**Normal Behavior:**
- Runs every 15 minutes (96 times/day)
- Processes 0-10 patients per run (depends on timezone distribution)
- Peak times: Midnight in major timezones (EST, CST, PST)
- Execution time: 1-5 seconds per patient
- Memory usage: 128-256MB

**Anomaly Detection:**
- ⚠️ No executions for > 30 minutes
- ⚠️ Error rate > 5%
- ⚠️ Execution time > 30 seconds
- ⚠️ Memory usage > 400MB
- ⚠️ Zero patients processed for > 2 hours

### How to Troubleshoot Common Issues

#### Issue 1: Scheduled Function Not Running

**Symptoms:**
- No entries in `daily_reset_logs`
- No new daily summaries
- Events not being archived

**Diagnosis:**
```bash
# Check if function is deployed
firebase functions:list | grep scheduledMedicationDailyReset

# Check Cloud Scheduler
gcloud scheduler jobs describe firebase-schedule-scheduledMedicationDailyReset-us-central1

# Check recent logs
firebase functions:log --only scheduledMedicationDailyReset --limit 50
```

**Solutions:**
1. Verify function is deployed: `firebase deploy --only functions:scheduledMedicationDailyReset`
2. Check scheduler is enabled: `gcloud scheduler jobs resume [JOB-NAME]`
3. Manually trigger: `gcloud scheduler jobs run [JOB-NAME]`
4. Check IAM permissions for Cloud Scheduler

#### Issue 2: Events Not Being Archived

**Symptoms:**
- Daily summaries created but events still show as active
- `archiveStatus.isArchived` is false

**Diagnosis:**
```javascript
// Check if events are being queried
db.collection('medication_events')
  .where('patientId', '==', testPatientId)
  .where('timing.eventTimestamp', '>=', yesterday)
  .where('timing.eventTimestamp', '<=', today)
  .get()
  .then(snapshot => {
    console.log(`Events found: ${snapshot.size}`);
    snapshot.forEach(doc => {
      const event = doc.data();
      console.log(`Archived: ${event.archiveStatus?.isArchived || false}`);
    });
  });
```

**Solutions:**
1. Check batch write permissions
2. Verify Firestore rules allow updates
3. Check for transaction conflicts
4. Review error logs for batch failures

#### Issue 3: Incorrect Daily Summaries

**Symptoms:**
- Statistics don't match actual events
- Missing medication breakdown
- Wrong adherence rates

**Diagnosis:**
```javascript
// Compare summary to actual events
async function validateSummary(patientId, date) {
  const summaryId = `${patientId}_${date}`;
  const summary = await db.collection('medication_daily_summaries')
    .doc(summaryId)
    .get();
  
  const events = await db.collection('medication_events')
    .where('patientId', '==', patientId)
    .where('archiveStatus.belongsToDate', '==', date)
    .get();
  
  const actualScheduled = events.docs.filter(
    doc => doc.data().eventType === 'dose_scheduled'
  ).length;
  
  const summaryScheduled = summary.data().statistics.totalScheduledDoses;
  
  if (actualScheduled !== summaryScheduled) {
    console.error('Mismatch:', { actualScheduled, summaryScheduled });
  }
}
```

**Solutions:**
1. Delete incorrect summary
2. Re-run daily reset for that date
3. Verify event query logic
4. Check calculation functions

#### Issue 4: Timezone Issues

**Symptoms:**
- Events archived at wrong time
- Summaries created for wrong date
- Patients processed at incorrect midnight

**Diagnosis:**
```javascript
// Verify timezone calculations
const timezone = 'America/Chicago';
const midnight = calculatePatientMidnight(timezone);
const now = new Date();

console.log(`
  Timezone: ${timezone}
  Current Time: ${now.toISOString()}
  Patient Midnight: ${midnight.toISOString()}
  Is Midnight Window: ${isWithinMidnightWindow(timezone)}
`);
```

**Solutions:**
1. Verify patient timezone is valid IANA string
2. Check timezone utility functions
3. Test with multiple timezones
4. Update patient timezone if incorrect

### Performance Benchmarks

**Target Metrics:**
- Function execution: < 5 seconds per patient
- Batch write: < 2 seconds per 500 events
- Query time: < 1 second per patient
- Memory usage: < 256MB
- Success rate: > 99%

**Optimization Tips:**
1. Use batch operations (500 events max)
2. Minimize Firestore reads
3. Cache timezone calculations
4. Use indexed queries
5. Implement retry logic for transient failures

---

## Known Limitations and Future Enhancements

### Current Limitations

#### 1. Timezone Dependency
**Limitation:** Requires valid timezone for each patient
**Impact:** Patients without timezone won't have daily reset
**Workaround:** Set default timezone in patient profile
**Future:** Auto-detect timezone from device/location

#### 2. Batch Size Limit
**Limitation:** Maximum 500 events per batch (Firestore limit)
**Impact:** Very active patients may need multiple batches
**Current Handling:** Automatic batch splitting
**Future:** Parallel batch processing

#### 3. Archive Filtering Performance
**Limitation:** Post-query filtering for archive status
**Impact:** Slight performance overhead on large queries
**Reason:** `archiveStatus` is optional field (can't index efficiently)
**Future:** Consider separate collection for archived events

#### 4. No Automatic Retention Policy
**Limitation:** Archived events stored indefinitely
**Impact:** Database size grows continuously
**Workaround:** Manual cleanup scripts
**Future:** Configurable retention policies (e.g., delete after 2 years)

#### 5. Single Timezone Per Patient
**Limitation:** One timezone per patient
**Impact:** Doesn't handle travel/timezone changes
**Workaround:** Manual timezone updates
**Future:** Timezone history tracking

#### 6. No Partial Day Archives
**Limitation:** Archives full days only (midnight to midnight)
**Impact:** Can't archive specific time ranges
**Workaround:** Use manual archive API
**Future:** Flexible archive windows

### Edge Cases to Be Aware Of

#### 1. Daylight Saving Time Transitions
**Issue:** Midnight calculation during DST changes
**Handling:** Luxon library handles DST automatically
**Test:** Verify behavior on DST transition dates

#### 2. Leap Seconds
**Issue:** Rare timing edge case
**Handling:** Negligible impact (15-minute window)
**Test:** Not critical for this use case

#### 3. Patient Timezone Changes
**Issue:** Events archived with old timezone
**Handling:** Each archive uses timezone at time of reset
**Test:** Verify summaries use correct timezone

#### 4. Very Large Event Counts
**Issue:** Patient with 1000+ events in one day
**Handling:** Batch processing handles this
**Test:** Performance test with large datasets

#### 5. Concurrent Modifications
**Issue:** Event modified during archiving
**Handling:** Firestore transactions prevent conflicts
**Test:** Stress test with concurrent operations

#### 6. Missing Patient Data
**Issue:** Patient deleted but events remain
**Handling:** Graceful failure, logged in errors
**Test:** Verify orphaned events don't break system

### Planned Improvements

#### Phase 2 Enhancements

1. **Retention Policies**
   - Auto-delete archived events after configurable period
   - Legal hold support for critical medications
   - Compliance with healthcare data retention laws

2. **Advanced Analytics**
   - Trend analysis across daily summaries
   - Predictive adherence modeling
   - Pattern detection in archived data
   - Export to CSV/PDF for healthcare providers

3. **Family Notifications**
   - Daily summary emails to family members
   - Weekly adherence reports
   - Alerts on declining adherence trends
   - Customizable notification preferences

4. **Performance Optimization**
   - Parallel processing of patients
   - Caching of timezone lookups
   - Incremental archiving for large datasets
   - Separate collection for archived events

5. **Enhanced Monitoring**
   - Real-time dashboards
   - Automated alerting for failures
   - Performance metrics tracking
   - Cost optimization reports

6. **Flexible Archiving**
   - Custom archive windows
   - Manual archive triggers
   - Selective un-archiving
   - Archive preview before commit

---

## Firestore Index Requirements

### Complete firestore.indexes.json

Replace your existing `firestore.indexes.json` with this complete configuration:

```json
{
  "indexes": [
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "eventType", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "archiveStatus.isArchived", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "archiveStatus.belongsToDate", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commandId", "order": "ASCENDING" },
        { "fieldPath": "timing.eventTimestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_daily_summaries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "summaryDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_daily_summaries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "summaryDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "patient_time_preferences",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lifestyle.timezone", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "daily_reset_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "executionTime", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Index Deployment

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Monitor index creation
# Go to: Firebase Console > Firestore > Indexes
# Wait for all indexes to show "Enabled" status
# This typically takes 5-15 minutes
```

### Index Verification

```bash
# Check index status
gcloud firestore indexes list

# Expected output:
# NAME                                    STATE
# medication_events_patientId_timestamp   READY
# medication_events_patientId_archived    READY
# medication_events_patientId_belongsTo   READY
# medication_daily_summaries_patient_date READY
# patient_time_preferences_timezone       READY
# daily_reset_logs_executionTime          READY
```

---

## Testing Scripts

### Script 1: Manual Daily Reset Trigger

```bash
#!/bin/bash
# File: scripts/trigger-daily-reset.sh

# Configuration
PROJECT_ID="your-project-id"
PATIENT_ID="test-patient-id"
TIMEZONE="America/Chicago"
DRY_RUN="true"  # Set to "false" for actual reset

# Get auth token
TOKEN=$(firebase login:ci)

# Trigger daily reset
curl -X POST \
  "https://us-central1-${PROJECT_ID}.cloudfunctions.net/api/unified-medication/medication-events/trigger-daily-reset" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"patientId\": \"${PATIENT_ID}\",
    \"timezone\": \"${TIMEZONE}\",
    \"dryRun\": ${DRY_RUN}
  }"
```

### Script 2: Query Archived Events

```javascript
// File: scripts/query-archived-events.js

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function queryArchivedEvents(patientId, date) {
  console.log(`Querying archived events for ${patientId} on ${date}`);
  
  const snapshot = await db.collection('medication_events')
    .where('patientId', '==', patientId)
    .where('archiveStatus.isArchived', '==', true)
    .where('archiveStatus.belongsToDate', '==', date)
    .get();
  
  console.log(`Found ${snapshot.size} archived events`);
  
  snapshot.forEach(doc => {
    const event = doc.data();
    console.log(`
      Event ID: ${doc.id}
      Type: ${event.eventType}
      Medication: ${event.context.medicationName}
      Timestamp: ${event.timing.eventTimestamp.toDate()}
      Archived At: ${event.archiveStatus.archivedAt.toDate()}
    `);
  });
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Usage
const patientId = process.argv[2] || 'test-patient';
const date = process.argv[3] || new Date().toISOString().split('T')[0];

queryArchivedEvents(patientId, date)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
```

### Script 3: Verify Archive Status

```javascript
// File: scripts/verify-archive-status.js

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function verifyArchiveStatus(patientId) {
  console.log(`Verifying archive status for patient: ${patientId}`);
  
  // Get all events
  const allEvents = await db.collection('medication_events')
    .where('patientId', '==', patientId)
    .get();
  
  // Count by status
  let archived = 0;
  let active = 0;
  let noStatus = 0;
  
  allEvents.forEach(doc => {
    const event = doc.data();
    if (event.archiveStatus?.isArchived) {
      archived++;
    } else if (event.archiveStatus) {
      active++;
    } else {
      noStatus++;
    }
  });
  
  console.log(`
    Total Events: ${allEvents.size}
    Archived: ${archived} (${(archived/allEvents.size*100).toFixed(1)}%)
    Active: ${active} (${(active/allEvents.size*100).toFixed(1)}%)
    No Status: ${noStatus} (${(noStatus/allEvents.size*100).toFixed(1)}%)
  `);
  
  // Check for today's events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayEvents = await db.collection('medication_events')
    .where('patientId', '==', patientId)
    .where('timing.eventTimestamp', '>=', admin.firestore.Timestamp.fromDate(today))
    .get();
  
  const todayArchived = todayEvents.docs.filter(
    doc => doc.data().archiveStatus?.isArchived
  ).length;
  
  console.log(`
    Today's Events: ${todayEvents.size}
    Today Archived: ${todayArchived}
    ${todayArchived > 0 ? '⚠️  WARNING: Today\'s events should not be archived!' : '✅ OK'}
  `);
  
  return {
    total: allEvents.size,
    archived,
    active,
    noStatus,
    todayTotal: todayEvents.size,
    todayArchived
  };
}

// Usage
const patientId = process.argv[2] || 'test-patient';

verifyArchiveStatus(patientId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
```

### Script 4: Check Daily Summaries

```javascript
// File: scripts/check-daily-summaries.js

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function checkDailySummaries(patientId, days = 7) {
  console.log(`Checking last ${days} days of summaries for ${patientId}`);
  
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  const summaries = await db.collection('medication_daily_summaries')
    .where('patientId', '==', patientId)
    .where('summaryDate', '>=', startDate)
    .where('summaryDate', '<=', endDate)
    .orderBy('summaryDate', 'desc')
    .get();
  
  console.log(`Found ${summaries.size} summaries`);
  console.log('─'.repeat(80));
  
  summaries.forEach(doc => {
    const summary = doc.data();
    const stats = summary.statistics;
    
    console.log(`
Date: ${summary.summaryDate}
Timezone: ${summary.timezone}
Scheduled: ${stats.totalScheduledDoses}
Taken: ${stats.totalTakenDoses}
Missed: ${stats.totalMissedDoses}
Skipped: ${stats.totalSkippedDoses}
Adherence: ${stats.adherenceRate}%
On-Time: ${stats.onTimeRate}%
Avg Delay: ${stats.averageDelayMinutes} min
Events Archived: ${summary.archivedEvents.totalArchived}
    `);
    console.log('─'.repeat(80));
  });
  
  // Calculate overall statistics
  if (summaries.size > 0) {
    const totalScheduled = summaries.docs.reduce(
      (sum, doc) => sum + doc.data().statistics.totalScheduledDoses, 0
    );
    const totalTaken = summaries.docs.reduce(
      (sum, doc) => sum + doc.data().statistics.totalTakenDoses, 0
    );
    const overallAdherence = (totalTaken / totalScheduled * 100).toFixed(1);
    
    console.log(`
Overall Statistics (${days} days):
Total Scheduled: ${totalScheduled}
Total Taken: ${totalTaken}
Overall Adherence: ${overallAdherence}%
    `);
  }
  
  return summaries.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Usage
const patientId = process.argv[2] || 'test-patient';
const days = parseInt(process.argv[3]) || 7;

checkDailySummaries(patientId, days)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
```

### Script 5: Monitor Daily Reset Execution

```javascript
// File: scripts/monitor-daily-reset.js

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function monitorDailyReset(hours = 24) {
  console.log(`Monitoring daily reset executions for last ${hours} hours`);
  
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const logs = await db.collection('daily_reset_logs')
    .where('executionTime', '>=', admin.firestore.Timestamp.fromDate(since))
    .orderBy('executionTime', 'desc')
    .get();
  
  console.log(`Found ${logs.size} executions`);
  console.log('═'.repeat(80));
  
  let totalPatients = 0;
  let totalArchived = 0;
  let totalFailures = 0;
  
  logs.forEach(doc => {
    const log = doc.data();
    totalPatients += log.patientsAtMidnight;
    totalArchived += log.totalEventsArchived;
    totalFailures += log.failedResets;
    
    const status = log.failedResets > 0 ? '⚠️' : '✅';
    
    console.log(`
${status} ${log.executionTime.toDate().toISOString()}
Duration: ${log.durationMs}ms
Patients Checked: ${log.totalPatientsChecked}
At Midnight: ${log.patientsAtMidnight}
Successful: ${log.successfulResets}
Failed: ${log.failedResets}
Events Archived: ${log.totalEventsArchived}
Summaries Created: ${log.totalSummariesCreated}
${log.fatalError ? `Fatal Error: ${log.fatalError}` : ''}
    `);
    
    if (log.failures && log.failures.length > 0) {
      console.log('Failures:');
      log.failures.forEach(failure => {
        console.log(`  - Patient ${failure.patientId}: ${failure.error}`);
      });
    }
    
    console.log('─'.repeat(80));
  });
  
  // Summary statistics
  const avgDuration = logs.docs.reduce(
    (sum, doc) => sum + doc.data().durationMs, 0
  ) / logs.size;
  
  const errorRate = (totalFailures / totalPatients * 100).toFixed(2);
  
  console.log(`
Summary (${hours} hours):
Total Executions: ${logs.size}
Avg Duration: ${avgDuration.toFixed(0)}ms
Total Patients Processed: ${totalPatients}
Total Events Archived: ${totalArchived}
Total Failures: ${totalFailures}
Error Rate: ${errorRate}%
  `);
  
  return logs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Usage
const hours = parseInt(process.argv[2]) || 24;

monitorDailyReset(hours)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
```

### Running the Scripts

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run manual daily reset
./scripts/trigger-daily-reset.sh

# Query archived events
node scripts/query-archived-events.js <patientId> <date>

# Verify archive status
node scripts/verify-archive-status.js <patientId>

# Check daily summaries
node scripts/check-daily-summaries.js <patientId> <days>

# Monitor daily reset
node scripts/monitor-daily-reset.js <hours>
```

---

## Quick Reference

### Key Endpoints

```
POST /unified-medication/medication-events/trigger-daily-reset
GET  /unified-medication/medication-events/archived
GET  /unified-medication/medication-events/daily-summaries
GET  /unified-medication/medication-events/daily-summaries/:date
GET  /unified-medication/medication-views/today-buckets
```

### Key Collections

```
medication_events              - All medication events (with archiveStatus)
medication_daily_summaries     - Daily summaries (one per patient per day)
daily_reset_logs              - Execution logs for monitoring
patient_time_preferences      - Patient timezone information
```

### Key Functions

```
scheduledMedicationDailyReset - Runs every 15 minutes
DailyResetService.executeDailyReset() - Main reset logic
MedicationEventService.queryEvents() - Query with archive filtering
```

### Support Contacts

- **Technical Issues:** [Your team contact]
- **Deployment Questions:** [DevOps contact]
- **Data Issues:** [Database admin contact]
- **Emergency:** [On-call rotation]

---

## Document Version

- **Version:** 1.0
- **Last Updated:** 2025-10-01
- **Author:** Kilo Code
- **Status:** Ready for Deployment

---

**End of Deployment Guide**