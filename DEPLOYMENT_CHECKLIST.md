# Medication Archiving System - Deployment Checklist

Quick reference checklist for deploying the daily medication reset and archiving system.

## Pre-Deployment

### Firestore Indexes
- [ ] Add indexes to `firestore.indexes.json` (see full guide for complete JSON)
- [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
- [ ] Wait for indexes to build (5-15 minutes)
- [ ] Verify all indexes show "Enabled" in Firebase Console

### Data Backup
- [ ] Export Firestore data: `gcloud firestore export gs://[BUCKET]/backups/pre-archive`
- [ ] Document current state (patient count, event count)
- [ ] Verify backup completed successfully

### Patient Data
- [ ] Check all patients have timezone in `patient_time_preferences`
- [ ] Set default timezone for patients without one
- [ ] Verify timezone format is valid IANA (e.g., "America/Chicago")

### Dependencies
- [ ] Verify `firebase-admin` >= 12.0.0
- [ ] Verify `firebase-functions` >= 5.0.0
- [ ] Verify `luxon` >= 3.4.0 installed
- [ ] Run `npm install` in functions directory

## Deployment

### Step 1: Backend Functions
- [ ] Navigate to functions directory: `cd functions`
- [ ] Build TypeScript: `npm run build`
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Verify deployment success in console output
- [ ] Check functions list: `firebase functions:list`

### Step 2: Scheduled Function
- [ ] Verify `scheduledMedicationDailyReset` is deployed
- [ ] Check Cloud Scheduler: `gcloud scheduler jobs list`
- [ ] Verify schedule is "every 15 minutes"
- [ ] Verify job state is "ENABLED"

### Step 3: Frontend
- [ ] Navigate to project root: `cd ..`
- [ ] Build frontend: `npm run build`
- [ ] Deploy hosting: `firebase deploy --only hosting`
- [ ] Verify deployment URL is accessible
- [ ] Clear browser cache and test

## Post-Deployment Verification

### Function Execution
- [ ] Manually trigger scheduled function: `gcloud scheduler jobs run [JOB-NAME]`
- [ ] Check Cloud Functions logs for execution
- [ ] Verify no errors in logs
- [ ] Check `daily_reset_logs` collection for entry

### Data Verification
- [ ] Query for archived events (should exist if past midnight)
- [ ] Check daily summaries collection
- [ ] Verify today's view excludes archived events
- [ ] Test history view shows archived data

### API Endpoints
- [ ] Test GET `/medication-events/archived`
- [ ] Test GET `/medication-events/daily-summaries`
- [ ] Test GET `/medication-events/daily-summaries/:date`
- [ ] Test POST `/medication-events/trigger-daily-reset` (dry run)

### Frontend Testing
- [ ] Login as test patient
- [ ] Verify "Today's Med List" shows only current medications
- [ ] Click "History" button - verify it works
- [ ] Check archived events display in history view
- [ ] Test date range filtering (7, 30, 90 days)
- [ ] Verify adherence statistics are correct

## Monitoring Setup

### Cloud Functions
- [ ] Set up alerts for function failures
- [ ] Monitor execution count (should be ~96/day)
- [ ] Monitor execution time (should be < 5s)
- [ ] Monitor error rate (should be < 1%)

### Data Growth
- [ ] Monitor `medication_events` collection size
- [ ] Monitor `medication_daily_summaries` growth
- [ ] Monitor `daily_reset_logs` size
- [ ] Set up retention policy for logs (optional)

### Performance
- [ ] Check average execution time
- [ ] Monitor memory usage
- [ ] Verify batch operations complete successfully
- [ ] Check for any timeout errors

## Testing Checklist

### Manual Tests
- [ ] Create test patient with timezone
- [ ] Add test medications
- [ ] Create events for "yesterday"
- [ ] Manually trigger daily reset
- [ ] Verify events are archived
- [ ] Verify daily summary created
- [ ] Check events don't appear in today's view
- [ ] Verify history view shows archived events

### Edge Cases
- [ ] Test with patient without timezone
- [ ] Test with very large event count (100+)
- [ ] Test during DST transition
- [ ] Test with multiple patients at midnight
- [ ] Test with no events to archive

### Family Access
- [ ] Login as family member
- [ ] Verify access to patient's history
- [ ] Test archive viewing permissions
- [ ] Verify data isolation between patients

## Rollback Plan (If Needed)

### Immediate Actions
- [ ] Pause scheduled function: `gcloud scheduler jobs pause [JOB-NAME]`
- [ ] Rollback frontend: `firebase hosting:rollback`
- [ ] Rollback functions: `firebase deploy --only functions --version [PREVIOUS]`

### Data Recovery
- [ ] Restore from backup if needed
- [ ] Run un-archive script for affected events
- [ ] Regenerate incorrect summaries
- [ ] Verify data integrity

### Communication
- [ ] Notify team of rollback
- [ ] Document issues encountered
- [ ] Create incident report
- [ ] Plan remediation steps

## Success Criteria

### Technical
- [ ] Scheduled function runs every 15 minutes
- [ ] Patients processed at midnight in their timezone
- [ ] Events archived successfully
- [ ] Daily summaries created with correct statistics
- [ ] No data loss or corruption
- [ ] Error rate < 1%

### User Experience
- [ ] Today's view shows only current medications
- [ ] History view accessible and functional
- [ ] Adherence statistics accurate
- [ ] No performance degradation
- [ ] Mobile responsive

### Data Integrity
- [ ] All events preserved (immutable)
- [ ] Archive status added correctly
- [ ] Daily summaries match events
- [ ] No orphaned data
- [ ] Timezone handling correct

## Post-Deployment Tasks

### Week 1
- [ ] Monitor daily reset executions
- [ ] Check for any errors or failures
- [ ] Verify data integrity daily
- [ ] Collect user feedback
- [ ] Document any issues

### Week 2-4
- [ ] Analyze performance metrics
- [ ] Review error logs
- [ ] Optimize if needed
- [ ] Plan Phase 2 enhancements
- [ ] Update documentation

## Quick Commands

### Deploy
```bash
# Full deployment
firebase deploy

# Functions only
firebase deploy --only functions

# Hosting only
firebase deploy --only hosting

# Indexes only
firebase deploy --only firestore:indexes
```

### Monitoring
```bash
# View function logs
firebase functions:log --only scheduledMedicationDailyReset

# List functions
firebase functions:list

# Check scheduler
gcloud scheduler jobs list

# Trigger manually
gcloud scheduler jobs run firebase-schedule-scheduledMedicationDailyReset-us-central1
```

### Testing
```bash
# Run test scripts
node scripts/verify-archive-status.js <patientId>
node scripts/check-daily-summaries.js <patientId> <days>
node scripts/monitor-daily-reset.js <hours>
```

### Rollback
```bash
# Pause scheduler
gcloud scheduler jobs pause [JOB-NAME]

# Rollback hosting
firebase hosting:rollback

# Restore backup
gcloud firestore import gs://[BUCKET]/backups/pre-archive
```

## Support Contacts

- **Technical Lead:** [Name/Contact]
- **DevOps:** [Name/Contact]
- **Database Admin:** [Name/Contact]
- **On-Call:** [Rotation/Contact]

## Documentation References

- **Full Deployment Guide:** `MEDICATION_ARCHIVING_DEPLOYMENT_GUIDE.md`
- **Implementation Summary:** `DAILY_MEDICATION_RESET_IMPLEMENTATION.md`
- **Frontend Changes:** `FRONTEND_ARCHIVE_IMPLEMENTATION_SUMMARY.md`
- **API Documentation:** See deployment guide Section 9

## Notes

- Deployment should be done during low-traffic hours
- Have rollback plan ready before starting
- Monitor closely for first 24 hours
- Document any deviations from plan
- Update this checklist based on experience

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Sign-off:** _______________

**Status:** ☐ Not Started | ☐ In Progress | ☐ Completed | ☐ Rolled Back

---

**Version:** 1.0
**Last Updated:** 2025-10-01