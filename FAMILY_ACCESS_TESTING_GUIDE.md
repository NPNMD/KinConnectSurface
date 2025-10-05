# Family Access System - Comprehensive Testing Guide

This guide provides detailed test scenarios for the complete family invitation and access level system.

## Table of Contents
1. [Invitation Flow Tests](#invitation-flow-tests)
2. [Access Level Tests](#access-level-tests)
3. [Patient Management Tests](#patient-management-tests)
4. [Multi-Patient Support Tests](#multi-patient-support-tests)
5. [Edge Cases Tests](#edge-cases-tests)
6. [Email Notification Tests](#email-notification-tests)

---

## Invitation Flow Tests

### Test 1.1: Patient Can Invite with Full Access
**Steps:**
1. Log in as a patient
2. Navigate to Family Management page
3. Click "Invite Family Member"
4. Enter family member email and name
5. Select "Full Access" access level
6. Click "Send Invitation"

**Expected Results:**
- ✅ Success message displayed
- ✅ Invitation appears in "Pending Invitations" list
- ✅ Email sent to family member with invitation link
- ✅ Invitation shows "Full Access" badge

### Test 1.2: Patient Can Invite with View-Only Access
**Steps:**
1. Log in as a patient
2. Navigate to Family Management page
3. Click "Invite Family Member"
4. Enter family member email and name
5. Select "View Only" access level
6. Click "Send Invitation"

**Expected Results:**
- ✅ Success message displayed
- ✅ Invitation appears in "Pending Invitations" list
- ✅ Email sent to family member with invitation link
- ✅ Invitation shows "View Only" badge

### Test 1.3: Family Member Receives Email
**Steps:**
1. Complete Test 1.1 or 1.2
2. Check family member's email inbox

**Expected Results:**
- ✅ Email received with subject: "[Patient Name] has invited you to access their medical calendar"
- ✅ Email contains patient name and invitation details
- ✅ Email contains "Accept Invitation" button/link
- ✅ Email lists permissions granted

### Test 1.4: Family Member Can Accept Invitation
**Steps:**
1. Click invitation link from email
2. Sign in or create account
3. Review invitation details
4. Click "Accept Invitation"

**Expected Results:**
- ✅ Success message: "Welcome to the Family!"
- ✅ Redirected to dashboard
- ✅ Can view patient's information
- ✅ Invitation status changes to "Active" in patient's view

### Test 1.5: Family Member Can Decline Invitation
**Steps:**
1. Click invitation link from email
2. Sign in or create account
3. Review invitation details
4. Click "Decline" button
5. Optionally enter decline reason
6. Click "Confirm Decline"

**Expected Results:**
- ✅ Decline confirmation dialog appears
- ✅ Can enter optional reason
- ✅ Success message: "Invitation Declined"
- ✅ Redirected to home page
- ✅ Patient receives email notification of decline
- ✅ Invitation status changes to "Declined" in patient's view

### Test 1.6: Expired Invitations Cannot Be Accepted
**Steps:**
1. Create invitation (modify expiration date in database to past date for testing)
2. Click invitation link
3. Attempt to accept

**Expected Results:**
- ✅ "Invitation Expired" message displayed
- ✅ Accept/Decline buttons disabled or hidden
- ✅ Message suggests requesting new invitation
- ✅ Link to contact patient or go home

### Test 1.7: Already Accepted Invitations Redirect Properly
**Steps:**
1. Accept an invitation
2. Click the same invitation link again

**Expected Results:**
- ✅ "Already Accepted" message displayed
- ✅ Automatic redirect to dashboard
- ✅ No duplicate access records created

---

## Access Level Tests

### Test 2.1: Full Access Family Members Can Create/Edit/Delete
**Steps:**
1. Log in as family member with full access
2. Navigate to patient's calendar
3. Try to create new appointment
4. Try to edit existing appointment
5. Try to delete appointment

**Expected Results:**
- ✅ Can create new appointments
- ✅ Can edit existing appointments
- ✅ Can delete appointments
- ✅ All action buttons visible
- ✅ No ViewOnlyBanner displayed

### Test 2.2: View-Only Family Members Can Only View
**Steps:**
1. Log in as family member with view-only access
2. Navigate to patient's calendar
3. Try to create new appointment
4. Try to edit existing appointment
5. Try to delete appointment

**Expected Results:**
- ✅ Cannot create appointments (button hidden/disabled)
- ✅ Cannot edit appointments (button hidden/disabled)
- ✅ Cannot delete appointments (button hidden/disabled)
- ✅ ViewOnlyBanner displayed at top
- ✅ Can view all appointment details
- ✅ Can claim transportation responsibility

### Test 2.3: ViewOnlyBanner Shows for View-Only Users
**Steps:**
1. Log in as family member with view-only access
2. Navigate to any page (Dashboard, Calendar, Medications, etc.)

**Expected Results:**
- ✅ Yellow banner displayed at top of page
- ✅ Banner text: "You have view-only access to [Patient Name]'s information"
- ✅ Banner visible on all pages
- ✅ Banner not shown for full access users

### Test 2.4: PermissionGate Hides Restricted Actions
**Steps:**
1. Log in as view-only family member
2. Navigate to various pages
3. Look for action buttons (Create, Edit, Delete)

**Expected Results:**
- ✅ "Add Medication" button hidden on Medications page
- ✅ "Edit" buttons hidden on all pages
- ✅ "Delete" buttons hidden on all pages
- ✅ "Create Event" button hidden on Calendar page
- ✅ View actions still available

---

## Patient Management Tests

### Test 3.1: Patient Can View All Family Members
**Steps:**
1. Log in as patient
2. Navigate to Family Management page

**Expected Results:**
- ✅ All active family members listed
- ✅ All pending invitations listed
- ✅ Access level displayed for each member
- ✅ Email and name displayed correctly

### Test 3.2: Patient Can See Pending Invitations
**Steps:**
1. Log in as patient
2. Send invitation to family member
3. Check Family Management page

**Expected Results:**
- ✅ Pending invitation appears in separate section
- ✅ Shows "Pending" status badge
- ✅ Shows expiration date
- ✅ Shows "Resend" button
- ✅ Shows "Cancel" button

### Test 3.3: Patient Can Change Access Levels
**Steps:**
1. Log in as patient
2. Navigate to Family Management
3. Click "Change Access Level" for a family member
4. Select new access level
5. Click "Update Access Level"

**Expected Results:**
- ✅ Modal dialog appears
- ✅ Current access level highlighted
- ✅ Can select new access level
- ✅ Success message displayed
- ✅ Access level updated in list
- ✅ Family member receives email notification
- ✅ Family member's permissions updated immediately

### Test 3.4: Patient Can Remove Family Members
**Steps:**
1. Log in as patient
2. Navigate to Family Management
3. Click "Remove" for a family member
4. Confirm removal

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Warning message displayed
- ✅ Can confirm or cancel
- ✅ Family member removed from list
- ✅ Family member receives email notification
- ✅ Family member loses access immediately

### Test 3.5: Patient Can Resend Invitations
**Steps:**
1. Log in as patient
2. Navigate to Family Management
3. Find pending invitation
4. Click "Resend Invitation"

**Expected Results:**
- ✅ New invitation email sent
- ✅ Expiration date extended
- ✅ New invitation token generated
- ✅ Success message displayed
- ✅ Old invitation link becomes invalid

---

## Multi-Patient Support Tests

### Test 4.1: Family Member Can Switch Between Patients
**Steps:**
1. Log in as family member with access to multiple patients
2. Look for patient switcher in navigation
3. Click to switch to different patient

**Expected Results:**
- ✅ Patient switcher visible in navigation
- ✅ Shows all patients with access
- ✅ Shows access level for each patient
- ✅ Current patient highlighted
- ✅ Can switch between patients
- ✅ Dashboard updates to show selected patient

### Test 4.2: Correct Patient Data Shows After Switch
**Steps:**
1. Log in as family member with access to multiple patients
2. View Patient A's calendar
3. Switch to Patient B
4. View calendar again

**Expected Results:**
- ✅ Calendar shows Patient B's appointments
- ✅ Dashboard shows Patient B's information
- ✅ Medications show Patient B's medications
- ✅ No data leakage between patients
- ✅ Correct patient name in header

### Test 4.3: Permissions Apply to Correct Patient
**Steps:**
1. Log in as family member with:
   - Full access to Patient A
   - View-only access to Patient B
2. Switch between patients
3. Try to create/edit appointments

**Expected Results:**
- ✅ Can create/edit for Patient A
- ✅ Cannot create/edit for Patient B
- ✅ ViewOnlyBanner shows only for Patient B
- ✅ Permissions enforced correctly per patient

---

## Edge Cases Tests

### Test 5.1: Invalid Invitation Tokens Handled
**Steps:**
1. Navigate to `/family-invite/invalid-token-123`
2. Try to accept invitation

**Expected Results:**
- ✅ "Invalid Invitation" error message
- ✅ Clear explanation of error
- ✅ Link to go back to home page
- ✅ No security details exposed

### Test 5.2: Expired Invitations Handled
**Steps:**
1. Create invitation
2. Wait for expiration (or modify date in database)
3. Try to accept invitation

**Expected Results:**
- ✅ "Invitation Expired" message
- ✅ Shows expiration date
- ✅ Suggests requesting new invitation
- ✅ Cannot accept expired invitation

### Test 5.3: Network Errors Handled Gracefully
**Steps:**
1. Disconnect internet
2. Try to accept invitation
3. Try to change access level
4. Try to remove family member

**Expected Results:**
- ✅ Error message: "Unable to connect. Please check your internet connection."
- ✅ No data corruption
- ✅ Can retry after reconnecting
- ✅ Loading states shown appropriately

### Test 5.4: Permission Violations Handled Properly
**Steps:**
1. Log in as view-only family member
2. Try to directly access edit endpoints (via API)
3. Try to modify data

**Expected Results:**
- ✅ 403 Forbidden error returned
- ✅ Error message: "You don't have permission to perform this action."
- ✅ No data modified
- ✅ Action logged for security

### Test 5.5: Duplicate Invitations Prevented
**Steps:**
1. Send invitation to family member
2. Try to send another invitation to same email

**Expected Results:**
- ✅ Error message: "Family member already has access or has a pending invitation"
- ✅ No duplicate invitation created
- ✅ Existing invitation remains valid

---

## Email Notification Tests

### Test 6.1: Invitation Email Sent
**Steps:**
1. Send family invitation
2. Check recipient's email

**Expected Results:**
- ✅ Email received within 1 minute
- ✅ Subject: "[Patient Name] has invited you to access their medical calendar"
- ✅ Contains patient name and details
- ✅ Contains clickable "Accept Invitation" button
- ✅ Lists permissions granted
- ✅ Shows expiration date

### Test 6.2: Invitation Declined Email Sent to Patient
**Steps:**
1. Family member declines invitation
2. Check patient's email

**Expected Results:**
- ✅ Email received within 1 minute
- ✅ Subject: "[Family Member Name] declined your invitation"
- ✅ Contains family member name
- ✅ Includes decline reason if provided
- ✅ Suggests next steps
- ✅ Link to manage family access

### Test 6.3: Access Level Changed Email Sent
**Steps:**
1. Patient changes family member's access level
2. Check family member's email

**Expected Results:**
- ✅ Email received within 1 minute
- ✅ Subject: "Your access level has been updated"
- ✅ Shows old and new access levels
- ✅ Lists new permissions
- ✅ Link to view patient's dashboard

### Test 6.4: Access Removed Email Sent
**Steps:**
1. Patient removes family member
2. Check family member's email

**Expected Results:**
- ✅ Email received within 1 minute
- ✅ Subject: "Your access has been removed"
- ✅ Explains access has been revoked
- ✅ Lists what they can no longer do
- ✅ Provides patient contact information
- ✅ Professional and respectful tone

---

## Testing Checklist Summary

### Invitation Flow
- [ ] Patient can invite with full access
- [ ] Patient can invite with view-only access
- [ ] Family member receives email
- [ ] Family member can accept invitation
- [ ] Family member can decline invitation
- [ ] Expired invitations cannot be accepted
- [ ] Already accepted invitations redirect properly

### Access Levels
- [ ] Full access family members can create/edit/delete
- [ ] View-only family members can only view
- [ ] ViewOnlyBanner shows for view-only users
- [ ] PermissionGate hides restricted actions

### Patient Management
- [ ] Patient can view all family members
- [ ] Patient can see pending invitations
- [ ] Patient can change access levels
- [ ] Patient can remove family members
- [ ] Patient can resend invitations

### Multi-Patient Support
- [ ] Family member can switch between patients
- [ ] Correct patient data shows after switch
- [ ] Permissions apply to correct patient

### Edge Cases
- [ ] Invalid invitation tokens handled
- [ ] Expired invitations handled
- [ ] Network errors handled gracefully
- [ ] Permission violations handled properly
- [ ] Duplicate invitations prevented

### Email Notifications
- [ ] Invitation email sent
- [ ] Invitation declined email sent to patient
- [ ] Access level changed email sent
- [ ] Access removed email sent

---

## Test Data Setup

### Create Test Accounts

**Patient Account:**
- Email: patient@test.com
- Name: Test Patient
- Create patient profile

**Family Member 1 (Full Access):**
- Email: family1@test.com
- Name: Family Member One

**Family Member 2 (View Only):**
- Email: family2@test.com
- Name: Family Member Two

### Test Scenarios

1. **Basic Flow:** Patient invites Family Member 1 with full access → Accept → Verify permissions
2. **View Only Flow:** Patient invites Family Member 2 with view-only → Accept → Verify restrictions
3. **Decline Flow:** Patient invites new member → Decline with reason → Verify notifications
4. **Access Change:** Change Family Member 1 from full to view-only → Verify update
5. **Removal:** Remove Family Member 2 → Verify access revoked

---

## Automated Testing Notes

For automated testing, consider:

1. **Unit Tests:**
   - `familyAccessService.declineInvitation()`
   - `emailService.sendInvitationDeclined()`
   - `emailService.sendAccessLevelChanged()`
   - `emailService.sendAccessRemoved()`

2. **Integration Tests:**
   - POST `/api/invitations/:invitationId/decline`
   - PATCH `/api/invitations/family-access/:accessId/access-level`
   - DELETE `/api/invitations/family-access/:accessId`

3. **E2E Tests:**
   - Complete invitation flow (send → accept)
   - Complete decline flow (send → decline)
   - Access level change flow
   - Family member removal flow

---

## Known Issues & Limitations

1. Email delivery may be delayed by SendGrid
2. Invitation tokens expire after 7 days
3. Maximum of 10 family members per patient (configurable)
4. Access level changes take effect immediately (no grace period)

---

## Support & Troubleshooting

### Common Issues

**Issue:** Invitation email not received
- Check spam folder
- Verify SendGrid API key configured
- Check email service logs

**Issue:** Cannot accept invitation
- Verify invitation not expired
- Check invitation token is valid
- Ensure user is authenticated

**Issue:** Permissions not updating
- Clear browser cache
- Refresh family access context
- Check database records

---

## Conclusion

This testing guide covers all major functionality of the family access system. Complete all tests before deploying to production. Document any failures and create bug reports as needed.

For questions or issues, contact the development team.