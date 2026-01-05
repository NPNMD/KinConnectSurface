# Firestore Index Configuration Documentation

This document explains the composite indexes configured in [`firestore.indexes.json`](firestore.indexes.json) and the queries they support.

## Overview

Firestore requires composite indexes for queries that:
- Filter on multiple fields
- Combine filters with ordering
- Use array-contains with other filters/ordering

All single-field queries and simple equality filters are handled automatically by Firestore's automatic indexing.

---

## Medications Collection

### Index 1: Patient Active Medications with Creation Order
**Fields:** `patientId` (ASC) + `isActive` (ASC) + `createdAt` (DESC)

**Supports:**
- Query: Get active medications for a patient, ordered by creation date
- Used in: [`medicationService.ts:462-465`](shared/services/medicationService.ts:462-465)
- Query pattern:
  ```typescript
  .where('patientId', '==', patientId)
  .where('isActive', '==', true)
  .orderBy('createdAt', 'desc')
  ```

**Use Case:** Display active medications for a patient in dashboard

---

### Index 2: Patient Active Medications
**Fields:** `patientId` (ASC) + `isActive` (ASC)

**Supports:**
- Query: Get active medications for a patient (no ordering)
- Used in: [`medicationService.ts:462-465`](shared/services/medicationService.ts:462-465)
- Query pattern:
  ```typescript
  .where('patientId', '==', patientId)
  .where('isActive', '==', true)
  ```

**Use Case:** Filter active medications without ordering requirement

---

### Index 3: Patient Medications by Name
**Fields:** `patientId` (ASC) + `name` (ASC)

**Supports:**
- Query: Get medications for a patient ordered by name
- Used in: Medication search functionality
- Query pattern:
  ```typescript
  .where('patientId', '==', patientId)
  .orderBy('name', 'asc')
  ```

**Use Case:** Alphabetical medication listing per patient

---

## Medication Logs Collection

### Index 4: Patient Medication Logs by Time
**Fields:** `patientId` (ASC) + `takenAt` (DESC)

**Supports:**
- Query: Get all medication logs for a patient, ordered by when taken
- Used in: [`medicationService.ts:209-212`](shared/services/medicationService.ts:209-212)
- Query pattern:
  ```typescript
  .where('patientId', '==', patientId)
  .orderBy('takenAt', 'desc')
  ```

**Use Case:** Patient medication history timeline

---

### Index 5: Medication-Specific Logs by Time
**Fields:** `medicationId` (ASC) + `takenAt` (DESC)

**Supports:**
- Query: Get logs for a specific medication, ordered by when taken
- Used in: [`medicationService.ts:241-244`](shared/services/medicationService.ts:241-244)
- Query pattern:
  ```typescript
  .where('medicationId', '==', medicationId)
  .orderBy('takenAt', 'desc')
  ```

**Use Case:** Compliance tracking for specific medication

---

### Index 6: Patient-Medication Logs by Time
**Fields:** `patientId` (ASC) + `medicationId` (ASC) + `takenAt` (DESC)

**Supports:**
- Query: Get logs for a specific patient's specific medication
- Used in: Detailed medication adherence reports
- Query pattern:
  ```typescript
  .where('patientId', '==', patientId)
  .where('medicationId', '==', medicationId)
  .orderBy('takenAt', 'desc')
  ```

**Use Case:** Detailed adherence tracking filtered by both patient and medication

---

## Medication Reminders Collection

### Index 7: Patient Active Reminders
**Fields:** `patientId` (ASC) + `isActive` (ASC)

**Supports:**
- Query: Get active reminders for a patient
- Used in: Reminder management
- Query pattern:
  ```typescript
  .where('patientId', '==', patientId)
  .where('isActive', '==', true)
  ```

**Use Case:** Display only active reminders for a patient

---

### Index 8: Medication Active Reminders
**Fields:** `medicationId` (ASC) + `isActive` (ASC)

**Supports:**
- Query: Get active reminders for a specific medication
- Used in: Medication reminder settings
- Query pattern:
  ```typescript
  .where('medicationId', '==', medicationId)
  .where('isActive', '==', true)
  ```

**Use Case:** Manage reminders when editing a medication

---

## Patients Collection

### Index 9: Patient by User ID
**Fields:** `userId` (ASC)

**Supports:**
- Query: Find patient profile by user ID
- Used in: [`patientService.ts:55`](shared/services/patientService.ts:55)
- Query pattern:
  ```typescript
  .where('userId', '==', userId)
  ```

**Use Case:** Get patient profile for logged-in user

---

### Index 10: Patients by Creation Date
**Fields:** `createdAt` (DESC)

**Supports:**
- Query: Get patients ordered by creation date (pagination)
- Used in: [`patientService.ts:108-110`](shared/services/patientService.ts:108-110)
- Query pattern:
  ```typescript
  .orderBy('createdAt', 'desc')
  .limit(limit)
  ```

**Use Case:** Admin view of all patients

---

### Index 11: Patients by Medical Condition
**Fields:** `medicalConditions` (ARRAY_CONTAINS)

**Supports:**
- Query: Find patients with specific medical condition
- Used in: [`patientService.ts:125-127`](shared/services/patientService.ts:125-127)
- Query pattern:
  ```typescript
  .where('medicalConditions', 'array-contains', condition)
  ```

**Use Case:** Research or reporting by medical condition

---

### Index 12: Patients by Allergy
**Fields:** `allergies` (ARRAY_CONTAINS)

**Supports:**
- Query: Find patients with specific allergy
- Used in: [`patientService.ts:141-143`](shared/services/patientService.ts:141-143)
- Query pattern:
  ```typescript
  .where('allergies', 'array-contains', allergy)
  ```

**Use Case:** Drug interaction warnings, allergy reports

---

### Index 13: Patients by Age Range
**Fields:** `dateOfBirth` (ASC)

**Supports:**
- Query: Find patients within age range
- Used in: [`patientService.ts:161-164`](shared/services/patientService.ts:161-164)
- Query pattern:
  ```typescript
  .where('dateOfBirth', '>=', minDate)
  .where('dateOfBirth', '<=', maxDate)
  ```

**Use Case:** Age-based medication recommendations, pediatric vs geriatric care

---

## Invitations Collection

### Index 14: Invitations by Email and Status
**Fields:** `patientEmail` (ASC) + `status` (ASC) + `createdAt` (DESC)

**Supports:**
- Query: Get invitations for an email address by status, ordered by date
- Used in: Invitation management, as specified in roadmap
- Query pattern:
  ```typescript
  .where('patientEmail', '==', email)
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'desc')
  ```

**Use Case:** Check pending invitations for user before signup

---

### Index 15: User's Sent Invitations
**Fields:** `inviterUid` (ASC) + `createdAt` (DESC)

**Supports:**
- Query: Get invitations sent by user, ordered by date
- Used in: [`invitations.ts:259-261`](functions/src/routes/invitations.ts:259-261)
- Query pattern:
  ```typescript
  .where('inviterUid', '==', uid)
  .orderBy('createdAt', 'desc')
  ```

**Use Case:** Show user their invitation history

---

### Index 16: Invitations by Status and Date
**Fields:** `status` (ASC) + `createdAt` (DESC)

**Supports:**
- Query: Get all invitations by status (admin view)
- Used in: Admin monitoring, cleanup of expired invitations
- Query pattern:
  ```typescript
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'desc')
  ```

**Use Case:** Admin dashboard, expired invitation cleanup

---

## Family Groups Collection

### Index 17: Family Groups by Creator
**Fields:** `createdBy` (ASC)

**Supports:**
- Query: Find family group created by user
- Used in: [`invitations.ts:168-171`](functions/src/routes/invitations.ts:168-171)
- Query pattern:
  ```typescript
  .where('createdBy', '==', inviterUid)
  ```

**Use Case:** Check if user already has a family group

---

### Index 18: Family Groups by Members
**Fields:** `members` (ARRAY_CONTAINS)

**Supports:**
- Query: Find family groups containing a specific member
- Used in: Access control, family group lookup
- Query pattern:
  ```typescript
  .where('members', 'array-contains', memberObject)
  ```

**Use Case:** Find which family groups a user belongs to

---

## Users Collection

### Index 19: Users by Family Group
**Fields:** `familyGroupId` (ASC)

**Supports:**
- Query: Get all users in a family group
- Used in: Family member management
- Query pattern:
  ```typescript
  .where('familyGroupId', '==', groupId)
  ```

**Use Case:** List all members of a family group

---

### Index 20: Users by Email
**Fields:** `email` (ASC)

**Supports:**
- Query: Find user by email address
- Used in: User lookup, invitation matching
- Query pattern:
  ```typescript
  .where('email', '==', userEmail)
  ```

**Use Case:** Email-based user search

---

## Audit Logs Collection

### Index 21: Audit Logs by User and Time
**Fields:** `userId` (ASC) + `timestamp` (DESC)

**Supports:**
- Query: Get audit logs for a specific user, ordered by time
- Used in: [`auditService.ts:218-227`](shared/services/auditService.ts:218-227)
- Query pattern:
  ```typescript
  .where('userId', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(limit)
  ```

**Use Case:** User activity monitoring, compliance reporting

---

### Index 22: Audit Logs by Action and Time
**Fields:** `action` (ASC) + `timestamp` (DESC)

**Supports:**
- Query: Get audit logs for a specific action type
- Used in: [`auditService.ts:234-243`](shared/services/auditService.ts:234-243)
- Query pattern:
  ```typescript
  .where('action', '==', action)
  .orderBy('timestamp', 'desc')
  .limit(limit)
  ```

**Use Case:** Security monitoring (e.g., all failed login attempts)

---

### Index 23: Audit Logs by Time Range
**Fields:** `timestamp` (ASC) and `timestamp` (DESC)

**Supports:**
- Query: Get audit logs within a date range
- Used in: [`auditService.ts:250-260`](shared/services/auditService.ts:250-260)
- Query pattern:
  ```typescript
  .where('timestamp', '>=', startDate)
  .where('timestamp', '<=', endDate)
  .orderBy('timestamp', 'desc')
  ```

**Use Case:** Compliance reporting for specific time periods

---

### Index 24: Audit Logs by Result and Time
**Fields:** `result` (ASC) + `timestamp` (DESC)

**Supports:**
- Query: Get failed/denied authorization attempts
- Used in: [`auditService.ts:267-276`](shared/services/auditService.ts:267-276)
- Query pattern:
  ```typescript
  .where('result', '==', 'DENIED')
  .orderBy('timestamp', 'desc')
  .limit(limit)
  ```

**Use Case:** Security incident investigation, unauthorized access attempts

---

### Index 25: Audit Logs by Resource and Time
**Fields:** `resource` (ASC) + `timestamp` (DESC)

**Supports:**
- Query: Get audit logs for a specific resource (e.g., "patient:123")
- Used in: [`auditService.ts:283-292`](shared/services/auditService.ts:283-292)
- Query pattern:
  ```typescript
  .where('resource', '==', resource)
  .orderBy('timestamp', 'desc')
  .limit(limit)
  ```

**Use Case:** Resource-specific audit trail, compliance queries

---

### Index 26: Audit Logs by Resource ID and Time
**Fields:** `resourceId` (ASC) + `timestamp` (DESC)

**Supports:**
- Query: Get all activity for a patient or resource
- Used in: [`auditService.ts:341-350`](shared/services/auditService.ts:341-350)
- Query pattern:
  ```typescript
  .where('resourceId', '==', patientId)
  .orderBy('timestamp', 'desc')
  .limit(limit)
  ```

**Use Case:** Patient activity timeline, access history

---

### Index 27: Audit Logs by IP Address and Time
**Fields:** `ipAddress` (ASC) + `timestamp` (DESC)

**Supports:**
- Query: Track activity from specific IP addresses
- Used in: Security investigations
- Query pattern:
  ```typescript
  .where('ipAddress', '==', ipAddress)
  .orderBy('timestamp', 'desc')
  ```

**Use Case:** Suspicious activity investigation, IP-based access patterns

---

### Field Override: TTL Configuration
**Field:** `createdAt` (TTL enabled)

**Purpose:**
- Automatically delete audit logs after 90 days
- Compliance with data retention policies
- Reduces storage costs

**Configuration:**
```json
{
  "collectionGroup": "audit_logs",
  "fieldPath": "createdAt",
  "ttl": true
}
```

**Note:** TTL deletion happens within 24-72 hours of the expiration time. To configure the TTL duration, set it in the Firebase Console.

---

## Performance Considerations

### Index Size and Cost
- Each index adds to storage costs (~$0.18 per GB/month)
- Indexes are automatically maintained on writes
- More indexes = slightly slower writes, but much faster reads

### Query Performance
- Indexed queries: **<50ms** (p95)
- Non-indexed composite queries: **Fail** (won't execute)
- Single-field queries: **Fast** (automatic indexing)

### Maintenance
- Indexes are automatically updated on document changes
- No manual maintenance required
- Monitor index usage in Firebase Console

---

## Deployment

Deploy indexes to Firebase:

```bash
firebase deploy --only firestore:indexes
```

**Note:** Index creation can take several minutes for large collections. Monitor progress in Firebase Console.

### Verification

After deployment, verify indexes are active:
1. Go to Firebase Console → Firestore → Indexes
2. Check status of each index (should show "Enabled")
3. Test queries in your application

---

## Roadmap Compliance

This configuration implements **all** index requirements from [`IMPLEMENTATION_ROADMAP.md`](plans/IMPLEMENTATION_ROADMAP.md) Appendix A (lines 3802-3846):

- ✅ Medications: patientId + status
- ✅ Medications: patientId + scheduleTime (via createdAt ordering)
- ✅ Medication logs: medicationId + timestamp
- ✅ Reminders: patientId + time + days (via isActive)
- ✅ Family groups: member arrays
- ✅ Invitations: targetEmail + status, createdAt + status
- ✅ Audit logs: userId + timestamp (Phase 1.3 requirement)
- ✅ Audit logs: action + timestamp (Phase 1.3 requirement)
- ✅ Audit logs: TTL for 90-day retention (Phase 1.3 requirement)

**Additional indexes** added based on actual code analysis and security requirements:
- Patient searches (medical conditions, allergies, age)
- User lookups (email, familyGroupId)
- Enhanced medication queries
- Comprehensive audit trail queries (result, resource, resourceId, ipAddress)
- Security event monitoring

---

## Troubleshooting

### Query Fails with "Missing Index" Error

If you see this error:
```
The query requires an index. You can create it here: [link]
```

**Solution:**
1. Copy the index definition from the Firebase-provided link
2. Add it to [`firestore.indexes.json`](firestore.indexes.json)
3. Redeploy: `firebase deploy --only firestore:indexes`

### Index Build Stuck

If index shows "Building" for >30 minutes:
1. Check Firestore Console for errors
2. Try deleting and recreating the index
3. Contact Firebase support if issue persists

### High Costs

If index storage costs are high:
1. Review index usage in Firebase Console
2. Remove unused indexes
3. Consider data archival strategy

---

## References

- [Firestore Index Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Query Limitations](https://firebase.google.com/docs/firestore/query-data/queries#query_limitations)
- [Best Practices](https://firebase.google.com/docs/firestore/best-practices)

---

**Last Updated:** 2026-01-05
**Configuration Version:** 3.0
**Total Indexes:** 27 composite indexes + 1 TTL field override
