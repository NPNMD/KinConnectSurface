# Family Member Patient ID Connection Debug Plan

## Issue Summary
Family member user exists in database with `userType: "family_member"` but appears to have no connection to a patient. The user accepted an email invitation, but the patient relationship is not visible.

## Root Cause Analysis

### Expected Data Flow
1. **Patient sends invitation** → Creates `FamilyCalendarAccess` record with:
   - `patientId`: Patient's user ID
   - `familyMemberEmail`: Invitee's email
   - `status`: 'pending'
   - `invitationToken`: Unique token

2. **Family member accepts invitation** → Updates `FamilyCalendarAccess` record with:
   - `familyMemberId`: Family member's user ID
   - `status`: 'active'
   - `acceptedAt`: Current timestamp
   - Removes `invitationToken`

3. **Family member logs in** → `FamilyContext` queries `family_calendar_access` by `familyMemberId`

### Potential Failure Points
1. **Invitation Creation Failed** - No `FamilyCalendarAccess` record created
2. **Invitation Acceptance Failed** - Record exists but wasn't updated with `familyMemberId`
3. **User Creation Issue** - Family member user created without proper invitation flow
4. **API Query Issue** - `FamilyContext` not finding existing relationship

## Debug Test Plan

### Phase 1: Database Investigation
1. **Check `family_calendar_access` collection** for records with:
   - `familyMemberEmail`: "fookwin@gmail.com"
   - `familyMemberId`: "HAuaPeYBHadpEFSRiwILfud6bwD3"
   - Any records with `status`: 'pending' or 'active'

2. **Check `users` collection** for:
   - Patient user who should have sent the invitation
   - Verify patient has proper `userType`: 'patient'

3. **Check `patients` collection** for:
   - Patient record linked to the inviting user
   - Verify `userId` field matches patient user ID

### Phase 2: API Flow Testing
1. **Test family access API** with family member's auth token
2. **Test invitation acceptance flow** with mock data
3. **Verify user service** properly creates family member users

### Phase 3: End-to-End Flow Testing
1. **Create new invitation** from scratch
2. **Accept invitation** with new test user
3. **Verify complete data flow** works properly

## Expected Database Structure

### User Document (Family Member)
```json
{
  "id": "HAuaPeYBHadpEFSRiwILfud6bwD3",
  "email": "fookwin@gmail.com",
  "name": "Nathan Nguyen",
  "userType": "family_member",
  "createdAt": "2025-09-16T18:22:52.000Z",
  "updatedAt": "2025-09-16T18:22:52.000Z"
}
```

### FamilyCalendarAccess Document (Expected)
```json
{
  "id": "generated-id",
  "patientId": "patient-user-id",
  "familyMemberId": "HAuaPeYBHadpEFSRiwILfud6bwD3",
  "familyMemberName": "Nathan Nguyen",
  "familyMemberEmail": "fookwin@gmail.com",
  "permissions": {
    "canView": true,
    "canCreate": false,
    "canEdit": false,
    "canDelete": false,
    "canClaimResponsibility": true,
    "canManageFamily": false,
    "canViewMedicalDetails": false,
    "canReceiveNotifications": true
  },
  "accessLevel": "limited",
  "status": "active",
  "invitedAt": "invitation-date",
  "acceptedAt": "acceptance-date",
  "createdBy": "patient-user-id",
  "createdAt": "creation-date",
  "updatedAt": "update-date"
}
```

## Diagnostic Questions
1. Does a `family_calendar_access` record exist for this family member?
2. If yes, what is the `status` field value?
3. Is the `familyMemberId` field populated correctly?
4. Does the `patientId` reference a valid patient user?
5. Is the family access API query working correctly?

## Immediate Actions Needed
1. **Create comprehensive database query script** to check all collections
2. **Test the family access API endpoint** with the family member's credentials
3. **Verify invitation acceptance flow** works properly
4. **Create repair script** if data corruption is found

## Files to Examine
- `server/services/familyAccessService.ts` - Invitation acceptance logic
- `server/routes/invitations.ts` - API endpoints
- `client/src/pages/AcceptInvitation.tsx` - Frontend acceptance flow
- `client/src/contexts/FamilyContext.tsx` - Family access querying

## Test Scripts to Create
1. `test-family-member-patient-id-debug.cjs` - Database investigation
2. `test-invitation-acceptance-flow.cjs` - API flow testing
3. `repair-family-member-patient-links.cjs` - Data repair if needed