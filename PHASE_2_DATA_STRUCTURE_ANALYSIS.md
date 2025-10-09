# Phase 2: Data Structure Analysis

## Investigation Date
2025-10-09T15:42:00Z

## Critical Discovery: Empty Medications Collection

### Finding
The `medications` collection is **completely empty** (0 documents), yet the system has 184 total medication-related documents functioning across other collections.

## Actual Data Architecture

### Current Pattern: Embedded/Denormalized Structure

#### 1. Medication Schedules (3 documents)
**Structure:**
```json
{
  "medicationId": "Xe5I1o8exRjNg91GKvZb",
  "medicationName": "Metformin Hydrochloride",
  "medicationDosage": "500mg",
  "medicationForm": "tablet",
  "medicationRoute": "ORAL",
  "medicationInstructions": "",
  "patientId": "PPJdgtyeB4ZV6vr7WqeCgba1aZO2",
  "frequency": "twice_daily",
  "times": ["08:00", "18:00"],
  "startDate": { "_seconds": 1759255209 },
  "endDate": null,
  "isIndefinite": true,
  "dosageAmount": "500mg",
  "generateCalendarEvents": true,
  "reminderMinutesBefore": [15, 5],
  "isActive": true,
  "isPaused": false,
  "autoCreated": true,
  "autoCreatedReason": "medication_has_reminders"
}
```

**Key Observations:**
- Medication details are **embedded** in the schedule
- `medicationId` exists but references no actual medication document
- All medication metadata is duplicated in each schedule
- 3 schedules for 2 unique medications (Metformin and Lisinopril)

#### 2. Medication Calendar Events (181 documents)
**Structure:**
```json
{
  "medicationScheduleId": "G1ibfURTjALkqUopy9b0",
  "medicationId": "Xe5I1o8exRjNg91GKvZb",
  "medicationName": "Metformin Hydrochloride",
  "patientId": "PPJdgtyeB4ZV6vr7WqeCgba1aZO2",
  "scheduledDateTime": { "_seconds": 1759305600 },
  "dosageAmount": "500mg",
  "instructions": "",
  "status": "scheduled|taken|missed",
  "reminderMinutesBefore": [15, 5],
  "isRecurring": true,
  "eventType": "medication",
  // Status-specific fields
  "takenBy": "PPJdgtyeB4ZV6vr7WqeCgba1aZO2",
  "actualTakenDateTime": { "_seconds": 1759326693 },
  "minutesLate": 248,
  "isOnTime": false,
  "wasLate": true,
  "missedAt": { "_seconds": 1759306863 },
  "missedReason": "automatic_detection",
  "gracePeriodEnd": { "_seconds": 1759306500 },
  "gracePeriodRules": ["default_morning", "type_critical"],
  "gracePeriodMinutes": 15
}
```

**Key Observations:**
- Each event embeds medication name and ID
- Events reference schedules via `medicationScheduleId`
- Rich status tracking (taken, missed, late, grace periods)
- 181 events across future and past dates

## Data Relationships

### Medication IDs Found
1. **Xe5I1o8exRjNg91GKvZb** - Metformin Hydrochloride 500mg
   - 2 schedules (different times: 08:00/18:00 and 07:00/19:00)
   - ~120 calendar events

2. **69ZTLvvYCMQyhZmUYYV0** - Lisinopril 10mg
   - 1 schedule (08:00/18:00)
   - ~61 calendar events

### Patient
- Single patient: `PPJdgtyeB4ZV6vr7WqeCgba1aZO2`
- All data belongs to this patient

## Status Distribution (Calendar Events)

### Event Statuses:
- **Scheduled**: Future events (not yet due)
- **Taken**: Completed doses (some on-time, some late)
- **Missed**: Automatically detected after grace period

### Sample Status Patterns:
- On-time taken: `status: "taken"`, `isOnTime: true`, `wasLate: false`
- Late taken: `status: "taken"`, `isOnTime: false`, `wasLate: true`, `minutesLate: 248`
- Missed: `status: "missed"`, `missedReason: "automatic_detection"`, `gracePeriodEnd` timestamp

## Migration Implications

### What This Means:
1. **No medication master data exists** - The `medications` collection was never populated
2. **Denormalized by design** - Medication details are embedded everywhere they're needed
3. **Functional system** - Despite the empty medications collection, the system works
4. **Data duplication** - Same medication info repeated across schedules and events

### Migration Strategy Options:

#### Option A: Extract and Normalize (Recommended)
1. Extract unique medications from schedules
2. Create medication_commands for each unique medication
3. Transform schedules to reference medication commands
4. Transform events to unified event structure
5. Preserve all historical data

#### Option B: Direct Transform (Simpler)
1. Keep embedded structure in unified system
2. Transform schedules → medication_commands (with embedded med data)
3. Transform events → medication_events (with embedded med data)
4. No normalization, just structural migration

#### Option C: Hybrid Approach
1. Create medication references for active medications
2. Keep historical events with embedded data
3. Future events use normalized references

## Recommendation

**Use Option A: Extract and Normalize**

### Rationale:
1. Creates proper data architecture for future
2. Eliminates data duplication
3. Enables better medication management
4. Maintains all historical tracking
5. Aligns with unified system design

### Next Steps:
1. Extract unique medications from schedules
2. Create medication_commands with proper structure
3. Create schedule_commands referencing medications
4. Transform all events to medication_events
5. Validate data integrity
6. Update migration tracking

## Data Quality Notes

### Positive:
- All required fields present
- Consistent structure across documents
- Rich status tracking
- Proper timestamps

### Concerns:
- Orphaned medicationIds (no parent documents)
- Data duplication across collections
- No medication master data
- Potential inconsistency if medication details change

## Conclusion

The system is using an **embedded/denormalized pattern** where medication data is duplicated across schedules and events. While functional, this creates maintenance challenges and data inconsistency risks. The migration should normalize this structure while preserving all historical data and tracking information.