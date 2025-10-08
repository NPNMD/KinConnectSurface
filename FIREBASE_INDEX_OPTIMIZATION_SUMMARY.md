# Firebase Index Optimization - Deployment Guide

**Date:** October 7, 2025  
**Optimization Type:** Index Cleanup and Enhancement  
**Total Indexes:** 37 → 38 indexes  
**Backup Location:** [`firestore.indexes.backup.json`](firestore.indexes.backup.json)

---

## 1. What Was Done

### Summary
Optimized Firestore indexes by removing 12 unused/redundant indexes and adding 13 new indexes to support current application features. This optimization improves query performance and reduces index maintenance overhead.

### Indexes Removed (12 total)

1. **healthcare_providers** - `isActive + patientId + createdAt` (lines 22-33)
   - Reason: Unused query pattern

2. **healthcare_providers** - `patientId + isPrimaryProvider + createdAt` (lines 37-51)
   - Reason: Replaced by simpler queries

3. **medical_facilities** - `patientId + name` (lines 86-97)
   - Reason: Duplicate collection (using healthcare_facilities instead)

4. **medical_facilities** - `isActive + patientId + createdAt` (lines 100-115)
   - Reason: Duplicate collection

5. **medical_facilities** - `patientId + facilityType + createdAt` (lines 118-133)
   - Reason: Duplicate collection

6. **medication_logs** - `patientId + medicationId + takenAt` (lines 228-243)
   - Reason: Replaced by unified medication_events system

7. **invitations** - `patientEmail + status + createdAt` (lines 246-261)
   - Reason: Unused query pattern

8. **medication_calendar_events** - `medicationId + patientId + scheduledDateTime` (lines 324-339)
   - Reason: Redundant with other indexes

9. **medication_grace_periods** - `patientId + isActive` (lines 342-353)
   - Reason: Collection no longer used

10. **family_notification_queue** - `status + scheduledFor` (lines 370-381)
    - Reason: Replaced by medication_notification_queue

11. **medication_event_archive** - `patientId + archivedAt` (lines 384-395)
    - Reason: Using archiveStatus fields in medication_events instead

12. **medication_notification_delivery_log** - Missing in backup
    - Reason: New collection added

### Indexes Added (13 total)

1. **medication_notification_delivery_log** - `patientId + createdAt DESC` (lines 410-421)
   - Purpose: Query notification history by patient

2. **medication_notification_queue** - `status + deliverAt + attempts` (lines 424-439)
   - Purpose: Process pending notifications efficiently

3. **medication_detection_metrics** - `timestamp DESC` (lines 442-449)
   - Purpose: Monitor missed medication detection performance

4. **family_adherence_summaries** - `patientId + generatedAt DESC` (lines 452-463)
   - Purpose: Retrieve family adherence reports

5. **adherence_patterns_detected** - `patientId + detectedAt DESC` (lines 466-477)
   - Purpose: Track detected adherence patterns

6. **migration_backups** - `migrationName + createdAt DESC` (lines 480-491)
   - Purpose: Manage data migration backups

7. **insurance_information** - `patientId + isActive + isPrimary DESC + createdAt DESC` (lines 494-513)
   - Purpose: Query active insurance with primary first

8. **medication_reminders** - `patientId + isActive + createdAt DESC` (lines 516-531)
   - Purpose: Retrieve active medication reminders

9. **meal_logs** - `patientId + date DESC + loggedAt DESC` (lines 534-549)
   - Purpose: Query meal logs for medication timing

10. **users** - `userType` (lines 552-559)
    - Purpose: Filter users by type (patient/family)

11. **medication_commands** - `patientId + status.isActive` (lines 562-573)
    - Purpose: Query active medication commands

12. **medication_schedules** - `patientId + isActive` (lines 576-587)
    - Purpose: Retrieve active medication schedules

13. **medication_schedules** - `medicationId + isActive` (lines 590-601)
    - Purpose: Find schedules for specific medications

14. **time_bucket_preferences** - `patientId` (lines 604-611)
    - Purpose: Retrieve time bucket preferences per patient

---

## 2. Deployment Instructions

### Prerequisites
- Firebase CLI installed and authenticated
- Access to Firebase project console
- Backup file verified at [`firestore.indexes.backup.json`](firestore.indexes.backup.json)

### Step-by-Step Deployment

#### Step 1: Verify Current State
```bash
# Check current Firebase project
firebase use

# Expected output: kinconnect-surface (or your project name)
```

#### Step 2: Review Index Changes
```bash
# Compare current vs backup
git diff firestore.indexes.backup.json firestore.indexes.json
```

#### Step 3: Deploy Indexes
```bash
# Deploy only Firestore indexes
firebase deploy --only firestore:indexes
```

**Expected Output:**
```
=== Deploying to 'kinconnect-surface'...

i  deploying firestore
i  firestore: checking firestore.indexes.json for compilation errors...
✔  firestore: compiled firestore.indexes.json successfully
i  firestore: uploading indexes firestore.indexes.json...
✔  firestore: deployed indexes in firestore.indexes.json successfully

✔  Deploy complete!
```

#### Step 4: Monitor Index Build Progress

**Option A: Firebase Console (Recommended)**
1. Navigate to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database** → **Indexes** tab
4. Monitor index build status (Building → Enabled)

**Option B: Firebase CLI**
```bash
# List all indexes and their status
firebase firestore:indexes
```

### Expected Timeline
- **Deployment:** 30-60 seconds
- **Index Building:** 5-30 minutes (depends on data volume)
  - Small datasets (<10K docs): 5-10 minutes
  - Medium datasets (10K-100K docs): 10-20 minutes
  - Large datasets (>100K docs): 20-30 minutes

### Verify Successful Deployment

#### Check Index Status
```bash
# View index status
firebase firestore:indexes

# All indexes should show status: READY
```

#### Test Critical Queries
Run these queries in Firestore Console or your application:

1. **Medication Events Query:**
   ```javascript
   db.collection('medication_events')
     .where('patientId', '==', 'test-patient-id')
     .where('archiveStatus.isArchived', '==', false)
     .orderBy('timing.eventTimestamp', 'desc')
     .limit(10)
   ```

2. **Notification Queue Query:**
   ```javascript
   db.collection('medication_notification_queue')
     .where('status', '==', 'pending')
     .orderBy('deliverAt', 'asc')
     .orderBy('attempts', 'asc')
     .limit(50)
   ```

3. **Family Adherence Query:**
   ```javascript
   db.collection('family_adherence_summaries')
     .where('patientId', '==', 'test-patient-id')
     .orderBy('generatedAt', 'desc')
     .limit(7)
   ```

---

## 3. Testing Checklist

### Critical Features to Test

- [ ] **Medication Dashboard**
  - [ ] Load active medications for patient
  - [ ] Filter by medication status
  - [ ] Sort by creation date

- [ ] **Medication Events**
  - [ ] View today's medication events
  - [ ] Filter by event type (taken/missed/skipped)
  - [ ] Archive old events
  - [ ] Query by date range

- [ ] **Notification System**
  - [ ] Scheduled medication reminders appear
  - [ ] Notification queue processes correctly
  - [ ] Delivery log records notifications

- [ ] **Family Features**
  - [ ] Family adherence summaries load
  - [ ] Calendar access permissions work
  - [ ] Adherence patterns display

- [ ] **Calendar Integration**
  - [ ] Medication calendar events sync
  - [ ] Events filter by status
  - [ ] Schedule-based queries work

### Specific Query Patterns to Verify

1. **Active Medications Query:**
   - Collection: `medications`
   - Filter: `patientId + isActive + createdAt DESC`
   - Expected: Returns active medications sorted by newest first

2. **Pending Notifications Query:**
   - Collection: `medication_notification_queue`
   - Filter: `status + deliverAt + attempts`
   - Expected: Returns pending notifications in delivery order

3. **Time Bucket Preferences:**
   - Collection: `time_bucket_preferences`
   - Filter: `patientId`
   - Expected: Returns patient's time bucket settings

4. **Insurance Information:**
   - Collection: `insurance_information`
   - Filter: `patientId + isActive + isPrimary DESC + createdAt DESC`
   - Expected: Returns active insurance with primary first

### Performance Monitoring Recommendations

**Monitor These Metrics (First 48 Hours):**
- Query execution time (should be <500ms for indexed queries)
- Index usage statistics in Firebase Console
- Application error logs for missing index errors
- User-reported performance issues

**Tools to Use:**
- Firebase Performance Monitoring
- Cloud Functions logs
- Application analytics
- Browser DevTools Network tab

---

## 4. Rollback Procedure

### When to Consider Rollback

Rollback if you encounter:
- **Critical query failures** affecting core functionality
- **Significant performance degradation** (>2x slower queries)
- **Index build failures** that don't resolve within 1 hour
- **Application errors** related to missing indexes

### Rollback Steps

#### Step 1: Stop New Deployments
```bash
# Ensure no other deployments are in progress
firebase deploy:cancel
```

#### Step 2: Restore Backup Indexes
```bash
# Copy backup to main file
cp firestore.indexes.backup.json firestore.indexes.json

# Verify the restore
git diff HEAD firestore.indexes.json
```

#### Step 3: Deploy Backup Indexes
```bash
# Deploy the backup configuration
firebase deploy --only firestore:indexes
```

#### Step 4: Verify Rollback
```bash
# Check index status
firebase firestore:indexes

# Test critical queries in application
```

#### Step 5: Document Issues
Create an incident report including:
- What triggered the rollback
- Which queries failed
- Error messages encountered
- Timeline of events

### Emergency Contacts/Procedures

**If rollback fails:**
1. Contact Firebase Support immediately
2. Provide project ID and deployment timestamp
3. Share error logs and index configuration
4. Request manual index restoration if needed

**Support Channels:**
- Firebase Console → Support
- Firebase Community Slack
- GitHub Issues (for open-source components)

---

## 5. Post-Deployment Monitoring

### Metrics to Watch

#### First 24 Hours (Critical Period)
- [ ] **Query Performance**
  - Average query time <500ms
  - No timeout errors
  - Successful index usage

- [ ] **Error Rates**
  - No "missing index" errors
  - No query permission errors
  - Function execution success rate >99%

- [ ] **User Experience**
  - Page load times normal
  - No reported slowdowns
  - Features working as expected

#### Days 2-7 (Stabilization Period)
- [ ] **Index Usage Statistics**
  - All new indexes showing usage
  - No unused indexes detected
  - Query patterns as expected

- [ ] **Performance Trends**
  - Consistent query times
  - No degradation over time
  - Improved performance where expected

#### Days 8-30 (Optimization Period)
- [ ] **Long-term Patterns**
  - Index efficiency maintained
  - No unexpected growth in query time
  - Resource usage stable

### Monitoring Duration
- **Intensive monitoring:** First 48 hours
- **Regular monitoring:** Days 3-7
- **Periodic checks:** Days 8-30
- **Final review:** Day 30

### Success Criteria

**Deployment is successful when:**
1. ✅ All indexes show status "READY" in Firebase Console
2. ✅ No missing index errors in logs for 48 hours
3. ✅ Query performance meets or exceeds baseline
4. ✅ All critical features tested and working
5. ✅ No user-reported issues related to indexes
6. ✅ Index usage statistics show expected patterns

---

## 6. 30-Day Review Plan

### Review Objectives
- Identify unused indexes for future cleanup
- Validate optimization effectiveness
- Plan next optimization cycle

### How to Check Index Usage (After 30 Days)

#### Step 1: Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project → Firestore Database → Indexes
3. Review "Last Used" column for each index

#### Step 2: Analyze Usage Patterns
```bash
# Export index usage data
firebase firestore:indexes --json > index-usage-report.json

# Review the report for:
# - Indexes never used (candidates for removal)
# - Heavily used indexes (keep and optimize)
# - Partially used indexes (investigate queries)
```

#### Step 3: Query Performance Analysis
- Review Cloud Functions logs for slow queries
- Check Performance Monitoring for query times
- Analyze user-reported performance issues

### Criteria for Further Optimization

**Remove indexes if:**
- Not used in 30 days
- Duplicate functionality with other indexes
- Related feature deprecated/removed
- Query pattern changed in application

**Add indexes if:**
- Frequent "missing index" errors
- Slow queries identified (>1 second)
- New features require complex queries
- User-reported performance issues

**Modify indexes if:**
- Field order can be optimized
- Composite index can replace multiple single-field indexes
- Query patterns have evolved

### Next Steps

#### Immediate Actions (Day 30)
1. Generate index usage report
2. Identify optimization opportunities
3. Create optimization proposal
4. Schedule next optimization cycle

#### Future Optimization Cycle
1. **Planning Phase** (Days 30-35)
   - Analyze usage data
   - Identify changes needed
   - Create backup plan

2. **Implementation Phase** (Days 36-40)
   - Update index configuration
   - Test in development
   - Prepare deployment

3. **Deployment Phase** (Day 41)
   - Deploy during low-traffic period
   - Monitor closely
   - Be ready to rollback

4. **Review Phase** (Days 42-60)
   - Monitor performance
   - Gather feedback
   - Document results

---

## 7. Additional Resources

### Documentation
- [Firebase Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Index Best Practices](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [Query Optimization Guide](https://firebase.google.com/docs/firestore/query-data/queries)

### Related Files
- [`firestore.indexes.json`](firestore.indexes.json) - Current index configuration
- [`firestore.indexes.backup.json`](firestore.indexes.backup.json) - Backup configuration
- [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) - General deployment guide
- [`MEDICATION_ARCHIVING_DEPLOYMENT_GUIDE.md`](MEDICATION_ARCHIVING_DEPLOYMENT_GUIDE.md) - Related deployment

### Support
- Firebase Console: https://console.firebase.google.com
- Firebase Support: https://firebase.google.com/support
- Project Repository: [Your GitHub/GitLab URL]

---

## Appendix: Index Comparison Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Indexes | 37 | 38 | +1 |
| Indexes Removed | - | 12 | -12 |
| Indexes Added | - | 13 | +13 |
| Collections Indexed | 15 | 18 | +3 |
| Deprecated Collections | 3 | 0 | -3 |

### Key Improvements
- ✅ Removed duplicate collection indexes (medical_facilities)
- ✅ Removed unused legacy indexes (medication_logs, invitations)
- ✅ Added indexes for new features (notifications, adherence tracking)
- ✅ Optimized query patterns for unified medication system
- ✅ Added support for time bucket preferences
- ✅ Enhanced insurance and meal logging queries

---

**Document Version:** 1.0  
**Last Updated:** October 7, 2025  
**Next Review:** November 6, 2025