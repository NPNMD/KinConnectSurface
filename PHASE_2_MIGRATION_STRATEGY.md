# Phase 2: Migration Strategy

## Strategy: Extract and Normalize

### Overview
Transform the legacy embedded/denormalized medication data structure into the unified normalized system while preserving all historical data and tracking information.

## Migration Approach

### 1. Extract Unique Medications
**Source:** `medication_schedules` collection  
**Action:** Extract unique medication definitions from embedded schedule data

**Process:**
- Scan all medication_schedules documents
- Group by `medicationId`
- Extract medication metadata:
  - `medicationName`
  - `medicationDosage`
  - `medicationForm`
  - `medicationRoute`
  - `medicationInstructions`

**Expected Output:**
- 2 unique medications (Metformin Hydrochloride, Lisinopril)

### 2. Create Medication Commands
**Target:** `medication_commands` collection  
**Command Type:** `CREATE_MEDICATION`

**Structure:**
```javascript
{
  commandId: "med_{medicationId}_{timestamp}",
  commandType: "CREATE_MEDICATION",
  medicationId: "{original_medicationId}",
  patientId: "{patientId}",
  data: {
    name: "Metformin Hydrochloride",
    dosage: "500mg",
    form: "tablet",
    route: "ORAL",
    instructions: ""
  },
  metadata: {
    createdAt: serverTimestamp,
    createdBy: "migration_script",
    migrationId: "{migration_id}",
    source: "legacy_schedule_extraction"
  },
  status: "completed",
  processedAt: serverTimestamp
}
```

### 3. Create Schedule Commands
**Source:** `medication_schedules` collection  
**Target:** `medication_commands` collection  
**Command Type:** `CREATE_SCHEDULE`

**Structure:**
```javascript
{
  commandId: "sched_{scheduleId}_{timestamp}",
  commandType: "CREATE_SCHEDULE",
  scheduleId: "{original_schedule_id}",
  medicationId: "{medicationId}",
  patientId: "{patientId}",
  data: {
    frequency: "twice_daily",
    times: ["08:00", "18:00"],
    daysOfWeek: [],
    dayOfMonth: 1,
    startDate: {timestamp},
    endDate: null,
    isIndefinite: true,
    dosageAmount: "500mg",
    instructions: "",
    generateCalendarEvents: true,
    reminderMinutesBefore: [15, 5],
    isActive: true,
    isPaused: false,
    pausedUntil: null
  },
  metadata: {
    createdAt: {original_createdAt},
    createdBy: "migration_script",
    migrationId: "{migration_id}",
    source: "legacy_medication_schedule",
    legacyScheduleId: "{original_id}",
    autoCreated: true/false,
    autoCreatedReason: "medication_has_reminders"
  },
  status: "completed",
  processedAt: serverTimestamp
}
```

### 4. Transform Calendar Events
**Source:** `medication_calendar_events` collection  
**Target:** `medication_events` collection

**Structure:**
```javascript
{
  eventId: "{original_event_id}",
  eventType: "SCHEDULED_DOSE",
  medicationId: "{medicationId}",
  scheduleId: "{medicationScheduleId}",
  patientId: "{patientId}",
  scheduledDateTime: {timestamp},
  dosageAmount: "500mg",
  instructions: "",
  status: "scheduled|taken|missed",
  reminderMinutesBefore: [15, 5],
  isRecurring: true,
  
  // Status-specific fields (conditional)
  takenAt: {timestamp},           // if status === 'taken'
  takenBy: "{userId}",             // if status === 'taken'
  minutesLate: 248,                // if status === 'taken'
  isOnTime: false,                 // if status === 'taken'
  wasLate: true,                   // if status === 'taken'
  
  missedAt: {timestamp},           // if status === 'missed'
  missedReason: "automatic_detection", // if status === 'missed'
  gracePeriodEnd: {timestamp},     // if status === 'missed'
  gracePeriodRules: ["default_morning", "type_critical"],
  gracePeriodMinutes: 15,
  
  metadata: {
    createdAt: {original_createdAt},
    updatedAt: {original_updatedAt},
    migrationId: "{migration_id}",
    source: "legacy_medication_calendar_event",
    legacyEventId: "{original_id}",
    medicationName: "Metformin Hydrochloride" // for reference
  }
}
```

## Data Mapping

### Medication Schedules → Commands
| Legacy Field | Command Field | Notes |
|--------------|---------------|-------|
| medicationId | medicationId | Direct mapping |
| medicationName | data.name | Extracted to medication command |
| medicationDosage | data.dosage | Extracted to medication command |
| medicationForm | data.form | Extracted to medication command |
| medicationRoute | data.route | Extracted to medication command |
| frequency | data.frequency | Direct mapping |
| times | data.times | Direct mapping |
| startDate | data.startDate | Direct mapping |
| isActive | data.isActive | Direct mapping |

### Calendar Events → Medication Events
| Legacy Field | Event Field | Notes |
|--------------|-------------|-------|
| medicationScheduleId | scheduleId | Direct mapping |
| medicationId | medicationId | Direct mapping |
| scheduledDateTime | scheduledDateTime | Direct mapping |
| status | status | Direct mapping |
| actualTakenDateTime | takenAt | Renamed for clarity |
| takenBy | takenBy | Direct mapping |
| missedAt | missedAt | Direct mapping |

## Validation Criteria

### Data Integrity Checks
1. **Count Validation:**
   - Medication commands created = Unique medications in schedules
   - Schedule commands created = Total medication_schedules documents
   - Medication events created = Total medication_calendar_events documents

2. **Reference Validation:**
   - All schedule commands reference valid medication IDs
   - All medication events reference valid schedule IDs
   - All documents reference valid patient IDs

3. **Data Completeness:**
   - No null required fields
   - All timestamps preserved
   - All status information maintained

### Expected Results
- **Medication Commands:** 2 (Metformin, Lisinopril)
- **Schedule Commands:** 3 (matching legacy schedules)
- **Medication Events:** 181 (matching legacy calendar events)

## Migration Execution Plan

### Pre-Migration
1. ✅ Verify backup exists
2. ✅ Analyze data structure
3. ✅ Create migration script
4. ⏳ Review migration strategy

### Migration Steps
1. **Extract Medications** (Step 1)
   - Scan medication_schedules
   - Identify unique medications
   - Prepare medication data

2. **Create Medication Commands** (Step 2)
   - Generate CREATE_MEDICATION commands
   - Batch write to medication_commands
   - Verify creation

3. **Create Schedule Commands** (Step 3)
   - Transform medication_schedules
   - Generate CREATE_SCHEDULE commands
   - Batch write to medication_commands
   - Verify creation

4. **Transform Events** (Step 4)
   - Transform medication_calendar_events
   - Batch write to medication_events (500 per batch)
   - Verify creation

5. **Validate Migration** (Step 5)
   - Run count validation
   - Check data integrity
   - Identify any issues

6. **Update Tracking** (Step 6)
   - Record migration results
   - Save migration report
   - Update migration_tracking collection

### Post-Migration
1. Verify unified collections populated
2. Test data access patterns
3. Validate event queries
4. Check medication references
5. Archive legacy collections (Phase 3)

## Rollback Strategy

### If Migration Fails
1. **Stop immediately** - Don't commit partial batches
2. **Delete migrated data:**
   ```javascript
   // Delete all documents with migrationId
   db.collection('medication_commands')
     .where('metadata.migrationId', '==', migrationId)
     .get()
     .then(snapshot => {
       snapshot.forEach(doc => doc.ref.delete());
     });
   
   db.collection('medication_events')
     .where('metadata.migrationId', '==', migrationId)
     .get()
     .then(snapshot => {
       snapshot.forEach(doc => doc.ref.delete());
     });
   ```
3. **Restore from backup** if needed
4. **Analyze failure** - Check migration report
5. **Fix issues** - Update migration script
6. **Retry migration**

### Backup Verification
- Backup location: `backups/medication-migration-2025-10-09T15-38-13-208Z/`
- Backup contains: 184 legacy documents
- Backup verified: ✅

## Risk Mitigation

### Identified Risks
1. **Data Loss:** Mitigated by backup and validation
2. **Reference Integrity:** Mitigated by preserving all IDs
3. **Batch Failures:** Mitigated by batch size limits (500)
4. **Timestamp Issues:** Mitigated by preserving original timestamps

### Safety Measures
- All writes use batches for atomicity
- Migration ID tracks all migrated documents
- Validation runs before marking complete
- Detailed logging for troubleshooting
- Rollback procedure documented

## Success Criteria

### Migration is successful when:
1. ✅ All medication commands created (2 expected)
2. ✅ All schedule commands created (3 expected)
3. ✅ All events transformed (181 expected)
4. ✅ Validation passes with no issues
5. ✅ Migration tracking updated
6. ✅ Migration report generated

### Next Phase Trigger
Once Phase 2 completes successfully:
- Proceed to Phase 3: Legacy Collection Archival
- Update system to use unified collections
- Monitor for any issues

## Execution Command

```bash
node scripts/migrate-to-unified-system.cjs
```

## Expected Output

```
============================================================
PHASE 2: DATA MIGRATION
Strategy: Extract and Normalize
============================================================

[timestamp] Extracting unique medications from schedules: { count: 2 }
[timestamp] Creating medication commands: { count: 2 }
[timestamp] Creating schedule commands: { count: 3 }
[timestamp] Transforming calendar events to medication_events
[timestamp] Batch committed: { events: 181, total: 181 }
[timestamp] Calendar events transformed: { count: 181 }
[timestamp] Validating migration: {
  medicationCommands: 2,
  scheduleCommands: 3,
  medicationEvents: 181,
  legacySchedules: 3,
  legacyEvents: 181
}
[timestamp] Validation complete
[timestamp] Updating migration tracking
[timestamp] Migration report saved

============================================================
MIGRATION COMPLETED
============================================================

Summary:
{
  "medicationsExtracted": 2,
  "medicationCommandsCreated": 2,
  "scheduleCommandsCreated": 3,
  "eventsTransformed": 181,
  "validation": {
    "medicationCommands": 2,
    "scheduleCommands": 3,
    "medicationEvents": 181,
    "legacySchedules": 3,
    "legacyEvents": 181
  },
  "issues": []
}