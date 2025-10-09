# Medication Database Migration Guide

## 🎯 Overview

This guide walks you through migrating from the **dual medication system** (legacy + unified) to a **single source of truth** using the `medication_commands` collection.

## 🔍 Current State Analysis

### Problem Identified
Your system currently has **TWO parallel medication systems**:

1. **Unified System (NEW - EMPTY)**
   - Collection: `medication_commands`
   - Status: ✅ Implemented but contains NO data
   - Frontend: ✅ Already switched to use this system
   - Result: ❌ API calls fail because collection is empty

2. **Legacy System (OLD - ACTIVE)**
   - Collections: `medications`, `medication_schedules`, `medication_calendar_events`, `medication_reminders`
   - Status: ⚠️ Contains ALL your medication data
   - Frontend: ❌ No longer used
   - Result: ⚠️ Data exists but frontend can't access it

### Root Cause of Errors

```
Error: Failed to fetch active medications
```

**Why this happens:**
1. Frontend calls `/unified-medication/medication-commands?patientId=XXX&isActive=true`
2. Backend queries `medication_commands` collection
3. Collection is EMPTY (migration never ran)
4. Query returns 0 results
5. Frontend interprets as error

**Missing Firestore Index:**
```
Collection: medication_commands
Required fields: patientId (ASC) + status.isActive (ASC) + medication.name (ASC)
Status: ✅ FIXED - Index deployed
```

## 📋 Migration Steps

### Step 1: Verify Firestore Index (✅ COMPLETED)

The required Firestore index has been deployed:
```bash
firebase deploy --only firestore:indexes
```

### Step 2: Run Migration (DRY RUN First)

#### Option A: Using PowerShell (Windows - Recommended)

1. Open PowerShell in the project directory
2. Run the migration script:
   ```powershell
   .\scripts\run-medication-migration.ps1
   ```
3. Follow the prompts to:
   - Enter your Firebase auth token
   - Choose DRY RUN mode (recommended first)
   - Review the results

#### Option B: Using Browser/Postman

1. Get your auth token:
   - Open https://claritystream-uldp9.web.app
   - Open Developer Tools (F12)
   - Go to Application > Local Storage
   - Find key containing `firebase:authUser`
   - Copy the `stsTokenManager.accessToken` value

2. Make POST request:
   ```
   POST https://us-central1-claritystream-uldp9.cloudfunctions.net/api/unified-medication/medication-commands/migrate-from-legacy
   
   Headers:
   Authorization: Bearer YOUR_TOKEN_HERE
   Content-Type: application/json
   
   Body:
   {
     "dryRun": true
   }
   ```

3. Review the response to see what would be migrated

### Step 3: Run Actual Migration

Once you've verified the dry run results, run the migration for real:

**PowerShell:**
```powershell
.\scripts\run-medication-migration.ps1
# Choose "n" for dry run
# Confirm with "y"
```

**API Call:**
```json
{
  "dryRun": false
}
```

### Step 4: Verify Migration Success

After migration completes, verify:

1. **Check medication_commands collection:**
   - Go to Firebase Console > Firestore
   - Open `medication_commands` collection
   - Verify your medications are there

2. **Test the frontend:**
   - Refresh https://claritystream-uldp9.web.app/medications
   - Medications should now load without errors
   - Today's medications should display correctly

3. **Check reminders:**
   - Verify reminders are showing for active medications
   - Test marking a medication as taken

## 🗑️ Step 5: Remove Legacy System (After Verification)

**⚠️ ONLY do this after confirming the unified system works perfectly!**

Once you've verified everything works with the unified system, you can remove the legacy endpoints and collections.

### What Will Be Removed:

1. **Legacy API Endpoints** (in `functions/src/index.ts`):
   - `GET /medications` (lines 6297-6412)
   - `POST /medications` (lines 7017-7199)
   - `PUT /medications/:id` (lines 7479-7846)
   - `DELETE /medications/:id` (lines 6415-6520)
   - `GET /medication-calendar/schedules` (lines 4261-4310)
   - `POST /medication-calendar/schedules` (lines 4389-4540)
   - `GET /medication-reminders` (lines 7851-7880)

2. **Legacy Firestore Collections** (can be archived):
   - `medications` → Migrated to `medication_commands`
   - `medication_schedules` → Embedded in `medication_commands.schedule`
   - `medication_reminders` → Embedded in `medication_commands.reminders`
   - `medication_calendar_events` → Replaced by `medication_events`

## 📊 Migration Response Format

```json
{
  "success": true,
  "data": {
    "totalMedications": 5,
    "successful": 5,
    "failed": 0,
    "skipped": 0,
    "errors": []
  },
  "message": "Migration completed: 5 medications migrated successfully"
}
```

## 🔧 Troubleshooting

### Issue: "Authentication required"
**Solution:** Your auth token expired. Get a new one from the browser.

### Issue: "Access denied"
**Solution:** Make sure you're logged in as the patient who owns the medications.

### Issue: Migration shows "Already migrated"
**Solution:** This is normal - medications already in `medication_commands` are skipped.

### Issue: Frontend still shows errors after migration
**Solution:** 
1. Clear browser cache and local storage
2. Hard refresh (Ctrl+Shift+R)
3. Check browser console for new errors

## 📝 Rollback Plan

If something goes wrong, you can rollback:

1. **Unified system is broken:**
   - Legacy system is still intact
   - Temporarily revert frontend to use legacy API
   - Fix issues in unified system
   - Re-run migration

2. **Data corruption:**
   - Check `backups/` directory for automatic backups
   - Restore from backup if needed

## ✅ Success Criteria

Migration is successful when:

- [ ] `medication_commands` collection contains all your medications
- [ ] Frontend loads medications without errors
- [ ] Today's medications display correctly
- [ ] Reminders work for active medications
- [ ] Marking medications as taken works
- [ ] Deleting a medication removes ALL related data (no orphaned reminders)

## 🎉 Post-Migration

After successful migration and verification:

1. Monitor the system for 24-48 hours
2. Verify daily medication reset works
3. Test all medication operations (add, edit, delete, mark taken)
4. Once confident, schedule legacy system removal
5. Archive legacy collections for backup

## 📞 Support

If you encounter issues:
1. Check the Firebase Functions logs in Firebase Console
2. Check browser console for frontend errors
3. Review this guide's troubleshooting section
4. Contact support with specific error messages

---

**Last Updated:** 2025-10-09
**Migration Version:** 1.0.0
**Target System:** Unified Medication Commands (medication_commands collection)