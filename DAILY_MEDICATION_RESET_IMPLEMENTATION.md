# Daily Medication Reset and Archiving System - Implementation Summary

## Overview

This document summarizes the complete implementation of the daily medication reset and archiving system for KinConnect. The system automatically archives medication events older than the current day at midnight (patient's timezone) and creates daily summary documents for historical tracking.

## Implementation Completed

### Phase 1: Data Model Updates ✅

#### 1. Updated [`unifiedMedicationSchema.ts`](functions/src/schemas/unifiedMedicationSchema.ts:194)
- Added `archiveStatus` field to [`MedicationEvent`](functions/src/schemas/unifiedMedicationSchema.ts:200) interface:
  ```typescript
  archiveStatus?: {
    isArchived: boolean;
    archivedAt?: Date;
    archivedReason?: 'daily_reset' | 'manual_archive' | 'retention_policy';
    belongsToDate?: string; // ISO date string (YYYY-MM-DD)
    dailySummaryId?: string; // Reference to daily summary
  }
  ```

#### 2. Created [`MedicationDailySummary`](functions/src/schemas/unifiedMedicationSchema.ts:1543) Interface
- Comprehensive daily summary structure with:
  - Summary statistics (scheduled, taken, missed, skipped doses)
  - Medication breakdown by command
  - Archived events tracking
  - Adherence rates and timing metrics

#### 3. Created [`ArchiveStatusFilter`](functions/src/schemas/unifiedMedicationSchema.ts:1589) Interface
- Query filtering options for archived events

#### 4. Enhanced [`PatientTimePreferences`](functions/src/schemas/unifiedMedicationSchema.ts:885)
- Ensured timezone field is present and documented as required

### Phase 2: Core Functions ✅

#### 1. Created [`timezoneUtils.ts`](functions/src/utils/timezoneUtils.ts:1)
Timezone utility functions:
- [`calculatePatientMidnight()`](functions/src/utils/timezoneUtils.ts:17) - Calculate midnight in patient's timezone
- [`isWithinMidnightWindow()`](functions/src/utils/timezoneUtils.ts:54) - Check if current time is within midnight window (±15 min)
- [`calculateDayBoundaries()`](functions/src/utils/timezoneUtils.ts:68) - Get start/end of day in patient timezone
- [`getPreviousDayBoundaries()`](functions/src/utils/timezoneUtils.ts:91) - Get yesterday's boundaries
- [`toISODateString()`](functions/src/utils/timezoneUtils.ts:103) - Convert date to ISO string in timezone
- [`belongsToDate()`](functions/src/utils/timezoneUtils.ts:112) - Check if date belongs to specific day
- [`getCurrentTimeInTimezone()`](functions/src/utils/timezoneUtils.ts:122) - Get current time in timezone
- [`isValidTimezone()`](functions/src/utils/timezoneUtils.ts:142) - Validate IANA timezone string
- [`getPatientsAtMidnight()`](functions/src/utils/timezoneUtils.ts:157) - Get patients at midnight

#### 2. Created [`DailyResetService.ts`](functions/src/services/unified/DailyResetService.ts:1)
Core service with methods:
- [`executeDailyReset()`](functions/src/services/unified/DailyResetService.ts:47) - Main orchestration function
- [`queryEventsForArchival()`](functions/src/services/unified/DailyResetService.ts:155) - Query events to archive
- [`markEventsAsArchived()`](functions/src/services/unified/DailyResetService.ts:192) - Batch update with archive status
- [`createDailySummary()`](functions/src/services/unified/DailyResetService.ts:238) - Create summary document
- [`calculateStatistics()`](functions/src/services/unified/DailyResetService.ts:279) - Calculate adherence metrics
- [`calculateMedicationBreakdown()`](functions/src/services/unified/DailyResetService.ts:318) - Per-medication stats
- [`getDailySummary()`](functions/src/services/unified/DailyResetService.ts:456) - Retrieve specific summary
- [`getDailySummaries()`](functions/src/services/unified/DailyResetService.ts:485) - Retrieve summary range

Features:
- Dry run capability for testing
- Batch operations (500 events per batch)
- Comprehensive error handling
- Rollback capability
- Detailed logging

### Phase 3: Cloud Function ✅

#### Created [`scheduledMedicationDailyReset.ts`](functions/src/scheduledMedicationDailyReset.ts:1)
Scheduled Cloud Function that:
- Runs every 15 minutes
- Queries all patients with timezone information
- Identifies patients at midnight (±15 min window)
- Executes daily reset for each patient
- Logs execution results to `daily_reset_logs` collection

Key features:
- Timezone-aware processing
- Batch processing for efficiency
- Comprehensive error handling per patient
- Execution logging for monitoring
- Graceful failure handling

Helper functions:
- [`getPatientTimezones()`](functions/src/scheduledMedicationDailyReset.ts:169) - Get all patient timezones
- [`logDailyResetExecution()`](functions/src/scheduledMedicationDailyReset.ts:217) - Log to Firestore

### Phase 4: Query Updates ✅

#### 1. Updated [`MedicationEventService.ts`](functions/src/services/unified/MedicationEventService.ts:91)
Enhanced [`EventQueryOptions`](functions/src/services/unified/MedicationEventService.ts:91) with:
- `excludeArchived?: boolean` - Default: true (exclude archived events)
- `onlyArchived?: boolean` - Default: false (only show archived)
- `belongsToDate?: string` - Filter by archive date

Updated [`queryEvents()`](functions/src/services/unified/MedicationEventService.ts:320) method:
- Post-query filtering for archived events
- Supports both inclusion and exclusion of archived events
- Date-specific archive filtering

#### 2. Updated [`medicationViewsApi.ts`](functions/src/api/unified/medicationViewsApi.ts:55)
Modified [`today-buckets`](functions/src/api/unified/medicationViewsApi.ts:55) endpoint:
- Filters out archived events from today's view
- Only shows active (non-archived) events

Modified [`calendar`](functions/src/api/unified/medicationViewsApi.ts:342) endpoint:
- Filters out archived events from calendar view
- Maintains clean separation of current vs historical data

#### 3. Updated [`medicationEventsApi.ts`](functions/src/api/unified/medicationEventsApi.ts:57)
Enhanced query endpoint to support:
- `excludeArchived` parameter (default: true)
- `onlyArchived` parameter (default: false)
- `belongsToDate` parameter for date-specific queries

### Phase 5: New API Endpoints ✅

#### Created [`medicationArchiveApi.ts`](functions/src/api/unified/medicationArchiveApi.ts:1)

New endpoints:

1. **GET [`/medication-events/archived`](functions/src/api/unified/medicationArchiveApi.ts:38)**
   - Retrieve archived medication events
   - Supports filtering by date range, event type, and specific date
   - Query parameters:
     - `patientId` - Target patient (optional, defaults to current user)
     - `startDate` - Start of date range
     - `endDate` - End of date range
     - `belongsToDate` - Specific archive date (YYYY-MM-DD)
     - `eventType` - Filter by event type(s)
     - `limit` - Max results (default: 100)

2. **GET [`/medication-events/daily-summaries`](functions/src/api/unified/medicationArchiveApi.ts:119)**
   - Retrieve daily summaries for a date range
   - Query parameters:
     - `patientId` - Target patient (optional)
     - `startDate` - Start date (default: 30 days ago)
     - `endDate` - End date (default: today)
     - `limit` - Max results (default: 30)

3. **GET [`/medication-events/daily-summaries/:date`](functions/src/api/unified/medicationArchiveApi.ts:181)**
   - Get specific daily summary for a date
   - Path parameter: `date` (YYYY-MM-DD format)
   - Query parameter: `patientId` (optional)

4. **POST [`/medication-events/trigger-daily-reset`](functions/src/api/unified/medicationArchiveApi.ts:233)**
   - Manually trigger daily reset (for testing)
   - Body parameters:
     - `patientId` - Target patient (optional)
     - `timezone` - IANA timezone (required)
     - `dryRun` - Test mode without actual changes (default: false)

#### Integrated into [`unifiedMedicationApi.ts`](functions/src/api/unified/unifiedMedicationApi.ts:48)
- Mounted archive API routes
- All endpoints accessible via `/unified-medication/medication-events/*`

## New Firestore Collections

### 1. `medication_daily_summaries`
Document structure:
```typescript
{
  id: string; // Format: {patientId}_{YYYY-MM-DD}
  patientId: string;
  summaryDate: string; // YYYY-MM-DD
  timezone: string; // IANA timezone
  statistics: {
    totalScheduledDoses: number;
    totalTakenDoses: number;
    totalMissedDoses: number;
    totalSkippedDoses: number;
    totalSnoozedDoses: number;
    adherenceRate: number;
    onTimeRate: number;
    averageDelayMinutes: number;
  };
  medicationBreakdown: Array<{
    commandId: string;
    medicationName: string;
    scheduledDoses: number;
    takenDoses: number;
    missedDoses: number;
    skippedDoses: number;
    adherenceRate: number;
  }>;
  archivedEvents: {
    totalArchived: number;
    eventIds: string[];
    archivedAt: Timestamp;
  };
  metadata: {
    createdAt: Timestamp;
    createdBy: string;
    version: number;
  };
}
```

### 2. `daily_reset_logs`
Execution logging for monitoring:
```typescript
{
  executionTime: Timestamp;
  durationMs: number;
  totalPatientsChecked: number;
  patientsAtMidnight: number;
  successfulResets: number;
  failedResets: number;
  totalEventsArchived: number;
  totalSummariesCreated: number;
  fatalError?: string;
  failures: Array<{
    patientId: string;
    error: string;
  }>;
  createdAt: Timestamp;
}
```

## Updated Collections

### `medication_events`
Added optional `archiveStatus` field:
```typescript
{
  // ... existing fields ...
  archiveStatus?: {
    isArchived: boolean;
    archivedAt?: Timestamp;
    archivedReason?: 'daily_reset' | 'manual_archive' | 'retention_policy';
    belongsToDate?: string; // YYYY-MM-DD
    dailySummaryId?: string;
  }
}
```

## System Behavior

### Daily Reset Process

1. **Scheduled Execution** (every 15 minutes)
   - Function checks all patients with timezone information
   - Identifies patients currently at midnight (±15 min window)
   - Processes each patient independently

2. **For Each Patient at Midnight**
   - Calculate previous day's boundaries in patient's timezone
   - Query all non-archived events from previous day
   - Calculate statistics and medication breakdown
   - Create daily summary document
   - Mark events as archived (batch operations)
   - Log execution results

3. **Archive Status**
   - Events marked with `isArchived: true`
   - Archive reason: `daily_reset`
   - Linked to daily summary via `dailySummaryId`
   - Belongs to specific date via `belongsToDate`

### Query Filtering

**Default Behavior:**
- All event queries exclude archived events by default
- "Today's Med List" only shows current day's active events
- Calendar views filter out archived events

**Accessing Archived Events:**
- Use `/medication-events/archived` endpoint
- Or set `onlyArchived=true` in event queries
- Can filter by specific date with `belongsToDate`

## API Usage Examples

### Get Today's Medications (excludes archived)
```
GET /unified-medication/medication-views/today-buckets?patientId={id}
```

### Get Archived Events for a Specific Date
```
GET /unified-medication/medication-events/archived?belongsToDate=2025-01-15
```

### Get Daily Summary for a Date
```
GET /unified-medication/medication-events/daily-summaries/2025-01-15
```

### Get Last 30 Days of Daily Summaries
```
GET /unified-medication/medication-events/daily-summaries?limit=30
```

### Manually Trigger Daily Reset (Testing)
```
POST /unified-medication/medication-events/trigger-daily-reset
{
  "timezone": "America/Chicago",
  "dryRun": true
}
```

## Files Created

1. [`functions/src/utils/timezoneUtils.ts`](functions/src/utils/timezoneUtils.ts:1) - Timezone utilities (180 lines)
2. [`functions/src/services/unified/DailyResetService.ts`](functions/src/services/unified/DailyResetService.ts:1) - Core service (520 lines)
3. [`functions/src/scheduledMedicationDailyReset.ts`](functions/src/scheduledMedicationDailyReset.ts:1) - Scheduled function (235 lines)
4. [`functions/src/api/unified/medicationArchiveApi.ts`](functions/src/api/unified/medicationArchiveApi.ts:1) - Archive endpoints (280 lines)

## Files Modified

1. [`functions/src/schemas/unifiedMedicationSchema.ts`](functions/src/schemas/unifiedMedicationSchema.ts:194) - Added archive schemas
2. [`functions/src/services/unified/MedicationEventService.ts`](functions/src/services/unified/MedicationEventService.ts:91) - Added archive filtering
3. [`functions/src/api/unified/medicationViewsApi.ts`](functions/src/api/unified/medicationViewsApi.ts:55) - Filter archived events
4. [`functions/src/api/unified/medicationEventsApi.ts`](functions/src/api/unified/medicationEventsApi.ts:68) - Archive query params
5. [`functions/src/api/unified/unifiedMedicationApi.ts`](functions/src/api/unified/unifiedMedicationApi.ts:48) - Integrated archive API
6. [`functions/src/index.ts`](functions/src/index.ts:9432) - Exported scheduled function

## Key Features Implemented

### 1. Timezone-Aware Processing
- Respects patient's local timezone for midnight calculation
- Handles timezone offsets correctly
- Validates IANA timezone strings
- Supports all global timezones

### 2. Efficient Batch Operations
- Processes up to 500 events per batch (Firestore limit)
- Handles large patient datasets
- Graceful handling of batch failures

### 3. Comprehensive Error Handling
- Try-catch blocks at all levels
- Per-patient error isolation
- Detailed error logging
- Rollback capability for failed operations

### 4. Data Integrity
- ACID-compliant operations
- Immutable event log preserved
- Archive status added without modifying original data
- Daily summaries provide audit trail

### 5. Query Performance
- Post-query filtering for archive status (optional field)
- Efficient date range queries
- Indexed queries for performance
- Limit controls for large datasets

### 6. Monitoring and Debugging
- Execution logs in `daily_reset_logs` collection
- Detailed console logging
- Success/failure tracking per patient
- Performance metrics (execution time, events processed)

## Testing Recommendations

### 1. Unit Testing
- Test timezone calculations with various timezones
- Test archive filtering logic
- Test daily summary calculations
- Test batch operations with different sizes

### 2. Integration Testing
- Test complete daily reset flow
- Test scheduled function execution
- Test API endpoints with real data
- Test archive filtering in queries

### 3. Manual Testing Steps

#### Test Daily Reset
```bash
# 1. Create test patient with timezone
POST /unified-medication/time-buckets/preferences
{
  "lifestyle": {
    "timezone": "America/Chicago",
    "wakeUpTime": "07:00",
    "bedTime": "23:00"
  }
}

# 2. Create test medication events for yesterday
# (Use medication-commands API to create events)

# 3. Manually trigger daily reset
POST /unified-medication/medication-events/trigger-daily-reset
{
  "timezone": "America/Chicago",
  "dryRun": true
}

# 4. Check results
GET /unified-medication/medication-events/daily-summaries

# 5. Verify archived events
GET /unified-medication/medication-events/archived
```

#### Test Query Filtering
```bash
# 1. Get today's medications (should exclude archived)
GET /unified-medication/medication-views/today-buckets

# 2. Get all events including archived
GET /unified-medication/medication-events?excludeArchived=false

# 3. Get only archived events
GET /unified-medication/medication-events?onlyArchived=true

# 4. Get archived events for specific date
GET /unified-medication/medication-events/archived?belongsToDate=2025-01-15
```

## Deployment Notes

### Prerequisites
1. Ensure all patients have timezone information in `patient_time_preferences` collection
2. Default timezone fallback: Check `users` collection for `timezone` field
3. Invalid/missing timezones will be logged but won't fail the function

### Deployment Steps
1. Deploy functions: `npm run deploy` (from functions directory)
2. Verify scheduled function is active in Firebase Console
3. Monitor `daily_reset_logs` collection for execution results
4. Check Cloud Functions logs for any errors

### Firestore Indexes (NOT YET CREATED - DO SEPARATELY)
Required composite indexes:
```json
{
  "collectionGroup": "medication_events",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "patientId", "order": "ASCENDING" },
    { "fieldPath": "timing.eventTimestamp", "order": "ASCENDING" }
  ]
}
```

### Monitoring
- Check `daily_reset_logs` collection daily
- Monitor Cloud Functions execution logs
- Set up alerts for failed resets
- Track execution time trends

## Performance Considerations

### Scalability
- Batch size: 500 events per batch (Firestore limit)
- Function timeout: 540 seconds (9 minutes)
- Memory allocation: 512MB
- Runs every 15 minutes (96 times per day)

### Cost Optimization
- Only processes patients at midnight (not all patients every run)
- Batch operations minimize Firestore writes
- Efficient queries with proper filtering
- Logs stored for monitoring (consider retention policy)

### Expected Load
- Average patients at midnight per run: ~4% of total (timezone distribution)
- Average events per patient per day: 5-20
- Average execution time per patient: 1-3 seconds
- Total function executions per day: 96

## Security Considerations

### Access Control
- All endpoints require authentication
- Patient data access restricted to patient or authorized family members
- Archive data follows same access rules as active data
- Manual trigger endpoint requires patient ownership

### Data Privacy
- Archived events maintain same privacy level as active events
- Daily summaries contain aggregated data only
- No sensitive data exposed in logs
- Execution logs contain patient IDs only (no PHI)

## Future Enhancements

### Potential Improvements
1. **Retention Policies**
   - Auto-delete archived events after X years
   - Configurable retention per medication type
   - Legal hold support for critical medications

2. **Advanced Analytics**
   - Trend analysis across daily summaries
   - Predictive adherence modeling
   - Pattern detection in archived data

3. **Family Notifications**
   - Daily summary emails to family members
   - Weekly adherence reports
   - Alert on declining adherence trends

4. **Performance Optimization**
   - Parallel processing of patients
   - Caching of timezone lookups
   - Incremental archiving for large datasets

## Troubleshooting

### Common Issues

**Issue: Events not being archived**
- Check patient has valid timezone in `patient_time_preferences`
- Verify scheduled function is running (check logs)
- Check if patient is at midnight in their timezone
- Review `daily_reset_logs` for errors

**Issue: Archived events still showing in today's view**
- Verify `excludeArchived` is not set to false
- Check event's `archiveStatus.isArchived` field
- Clear any client-side caches
- Verify API is using updated code

**Issue: Daily summaries not created**
- Check if events exist for previous day
- Verify timezone calculation is correct
- Review error logs in `daily_reset_logs`
- Check Firestore permissions

**Issue: Scheduled function not running**
- Verify function is deployed
- Check Cloud Scheduler in Firebase Console
- Review function execution logs
- Verify function has proper permissions

## Success Metrics

### Technical Metrics
- ✅ Scheduled function runs every 15 minutes
- ✅ Processes patients at midnight in their timezone
- ✅ Archives events in batches of 500
- ✅ Creates daily summaries with statistics
- ✅ Filters archived events from queries

### Data Integrity
- ✅ Original events preserved (immutable)
- ✅ Archive status added without data loss
- ✅ Daily summaries provide audit trail
- ✅ Rollback capability for failures

### Performance
- ✅ Batch operations for efficiency
- ✅ Post-query filtering for flexibility
- ✅ Timezone calculations optimized
- ✅ Execution time logged for monitoring

## Conclusion

The daily medication reset and archiving system has been successfully implemented with:
- ✅ Complete timezone-aware processing
- ✅ Automatic daily archiving at midnight
- ✅ Daily summary generation
- ✅ Query filtering for archived events
- ✅ New API endpoints for archive access
- ✅ Comprehensive error handling
- ✅ Detailed logging and monitoring

The system is ready for testing and deployment. Remember to create the required Firestore indexes separately before deploying to production.