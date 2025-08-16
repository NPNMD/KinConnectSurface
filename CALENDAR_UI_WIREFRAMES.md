# Medical Calendar UI/UX Wireframes

## Calendar View Layouts

### 1. Monthly Calendar View
```
┌─────────────────────────────────────────────────────────────────┐
│ [< Previous]    January 2024    [Next >]    [Today] [+ Add Event]│
├─────────────────────────────────────────────────────────────────┤
│ Sun    Mon    Tue    Wed    Thu    Fri    Sat                   │
├─────────────────────────────────────────────────────────────────┤
│  1      2      3      4      5      6      7                    │
│         🏥     💊     📋                                         │
│                                                                 │
│  8      9     10     11     12     13     14                    │
│         💊    🩺     💊     📊                                   │
│                                                                 │
│ 15     16     17     18     19     20     21                    │
│  💊    🏥     💊     💊     📋                                   │
│                                                                 │
│ 22     23     24     25     26     27     28                    │
│  💊           💊     🩺     💊                                   │
└─────────────────────────────────────────────────────────────────┘

Legend:
🏥 Appointments    💊 Medications    🩺 Procedures    📋 Lab Results    📊 Follow-ups
```

### 2. Weekly Calendar View
```
┌─────────────────────────────────────────────────────────────────┐
│ Week of Jan 15-21, 2024                    [Month] [Week] [Day]  │
├─────────────────────────────────────────────────────────────────┤
│ Time │ Mon 15 │ Tue 16 │ Wed 17 │ Thu 18 │ Fri 19 │ Sat 20 │ Sun │
├─────────────────────────────────────────────────────────────────┤
│ 8 AM │        │        │        │        │        │        │     │
│ 9 AM │ 💊 Med │        │ 💊 Med │        │ 💊 Med │        │     │
│10 AM │        │ 🏥 Dr  │        │        │        │        │     │
│      │        │ Smith  │        │        │        │        │     │
│11 AM │        │ Cardio │        │        │        │        │     │
│12 PM │        │        │        │        │        │        │     │
│ 1 PM │        │        │        │ 🩺 MRI │        │        │     │
│ 2 PM │        │        │        │ Scan   │        │        │     │
│ 3 PM │        │        │        │        │ 📋 Lab │        │     │
│      │        │        │        │        │ Results│        │     │
│ 4 PM │        │        │        │        │        │        │     │
│ 5 PM │ 💊 Med │        │ 💊 Med │        │ 💊 Med │        │     │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Daily Agenda View
```
┌─────────────────────────────────────────────────────────────────┐
│ Tuesday, January 16, 2024                  [< Prev] [Next >]    │
├─────────────────────────────────────────────────────────────────┤
│ 9:00 AM  💊 Morning Medications                                 │
│          ├─ Metformin 500mg                                     │
│          ├─ Lisinopril 10mg                                     │
│          └─ [Mark as Taken] [Skip] [Reschedule]                 │
├─────────────────────────────────────────────────────────────────┤
│ 10:30 AM 🏥 Dr. Smith - Cardiology Follow-up                   │
│          ├─ Location: Heart Center, 123 Medical Dr             │
│          ├─ Preparation: Bring recent EKG results              │
│          ├─ Family: Mom will attend                            │
│          └─ [View Details] [Reschedule] [Add to Google Cal]    │
├─────────────────────────────────────────────────────────────────┤
│ 2:00 PM  📋 Lab Results Available                              │
│          ├─ Blood Panel from Jan 14                            │
│          ├─ Status: Ready for Review                           │
│          └─ [View Results] [Share with Family] [Download]      │
├─────────────────────────────────────────────────────────────────┤
│ 5:00 PM  💊 Evening Medications                                │
│          ├─ Metformin 500mg                                     │
│          └─ [Set Reminder] [Mark as Taken]                     │
└─────────────────────────────────────────────────────────────────┘
```

## Event Creation/Editing Forms

### 1. Add Medical Appointment
```
┌─────────────────────────────────────────────────────────────────┐
│ Schedule Medical Appointment                              [X]    │
├─────────────────────────────────────────────────────────────────┤
│ Event Type: [🏥 Appointment ▼]                                  │
│                                                                 │
│ Title: [Dr. Smith - Cardiology Follow-up              ]        │
│                                                                 │
│ Date: [01/16/2024 ▼]    Time: [10:30 AM ▼]                    │
│ Duration: [1 hour ▼]                                           │
│                                                                 │
│ Provider: [Dr. John Smith                              ]        │
│ Specialty: [Cardiology ▼]                                      │
│ Location: [Heart Center, 123 Medical Dr               ]        │
│                                                                 │
│ Preparation Instructions:                                       │
│ [Bring recent EKG results                              ]        │
│ [Fast for 12 hours before appointment                 ]        │
│                                                                 │
│ Family Access:                                                  │
│ ☑ Mom (view & edit)    ☑ Dad (view only)    ☐ Sister (none)   │
│                                                                 │
│ Reminders:                                                      │
│ ☑ 24 hours before    ☑ 2 hours before    ☑ 30 minutes before  │
│ ☑ Push notification  ☑ Email            ☐ SMS                 │
│                                                                 │
│ Google Calendar Sync:                                           │
│ ☑ Add to my Google Calendar (simplified version)               │
│                                                                 │
│ Notes:                                                          │
│ [Follow-up for blood pressure medication adjustment    ]        │
│                                                                 │
│ [Cancel]                                    [Save Appointment]  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Add Medication Schedule
```
┌─────────────────────────────────────────────────────────────────┐
│ Schedule Medication Reminders                             [X]    │
├─────────────────────────────────────────────────────────────────┤
│ Medication: [Metformin 500mg ▼] [Search medications...]         │
│                                                                 │
│ Schedule Type:                                                  │
│ ○ Daily    ○ Weekly    ● Custom                                │
│                                                                 │
│ Times per day: [2 ▼]                                           │
│                                                                 │
│ Reminder Times:                                                 │
│ Morning: [9:00 AM ▼]    Evening: [5:00 PM ▼]                  │
│                                                                 │
│ Days of week:                                                   │
│ ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri ☑ Sat ☑ Sun                    │
│                                                                 │
│ Start Date: [01/16/2024 ▼]                                     │
│ End Date: [Ongoing ▼]                                          │
│                                                                 │
│ Instructions:                                                   │
│ [Take with food. Monitor blood sugar levels.          ]        │
│                                                                 │
│ Family Notifications:                                           │
│ ☑ Notify if missed    ☑ Daily summary to caregivers           │
│                                                                 │
│ [Cancel]                                    [Create Schedule]   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Lab Results Entry
```
┌─────────────────────────────────────────────────────────────────┐
│ Add Lab Results                                           [X]    │
├─────────────────────────────────────────────────────────────────┤
│ Test Date: [01/14/2024 ▼]                                      │
│ Results Available: [01/16/2024 ▼]                              │
│                                                                 │
│ Lab/Provider: [City Medical Lab                        ]        │
│ Ordered by: [Dr. Smith                                 ]        │
│                                                                 │
│ Test Type: [☑ Complete Blood Count                     ]        │
│           [☑ Lipid Panel                              ]        │
│           [☑ HbA1c                                    ]        │
│           [☐ Thyroid Function                         ]        │
│                                                                 │
│ Status: ● Results Available  ○ Pending  ○ Cancelled           │
│                                                                 │
│ Upload Files:                                                   │
│ [📎 blood_panel_results.pdf] [Remove]                         │
│ [+ Add Another File]                                           │
│                                                                 │
│ Key Results Summary:                                            │
│ [HbA1c: 7.2% (target <7.0%)                          ]        │
│ [LDL: 95 mg/dL (good)                                 ]        │
│                                                                 │
│ Follow-up Required:                                             │
│ ☑ Schedule follow-up appointment                               │
│ ☑ Medication adjustment needed                                 │
│                                                                 │
│ Family Sharing:                                                 │
│ ☑ Share with primary caregivers                               │
│ ☐ Share detailed results    ☑ Share summary only              │
│                                                                 │
│ [Cancel]                                        [Save Results]  │
└─────────────────────────────────────────────────────────────────┘
```

## Family Member Views

### 1. Family Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│ Family Calendar - John's Medical Care                          │
├─────────────────────────────────────────────────────────────────┤
│ Your Role: Primary Caregiver (Mom)                             │
│ Permissions: View All, Edit Appointments, Manage Medications   │
├─────────────────────────────────────────────────────────────────┤
│ Today's Schedule (Jan 16, 2024)                                │
│                                                                 │
│ 9:00 AM  💊 Morning Meds - [Mark as Given] [Missed]           │
│ 10:30 AM 🏥 Cardiology Appt - [I'll Attend] [Can't Attend]    │
│ 2:00 PM  📋 Lab Results - [Review Together] [I'll Handle]     │
│ 5:00 PM  💊 Evening Meds - [Set Reminder]                     │
├─────────────────────────────────────────────────────────────────┤
│ This Week's Highlights                                          │
│ • Wed: MRI scan at 1 PM (transportation needed)               │
│ • Fri: Lab results review call with Dr. Smith                 │
│ • Medication refill due by Thursday                            │
├─────────────────────────────────────────────────────────────────┤
│ Family Coordination                                             │
│ Dad: Available for Wed MRI transport ✓                        │
│ Sister: Will handle Friday medication pickup                   │
│                                                                 │
│ [View Full Calendar] [Add Event] [Family Settings]            │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Permission Settings
```
┌─────────────────────────────────────────────────────────────────┐
│ Family Access Settings                                    [X]    │
├─────────────────────────────────────────────────────────────────┤
│ Patient: John Smith                                             │
│                                                                 │
│ Family Members:                                                 │
│                                                                 │
│ 👩 Mom (Sarah)           Role: Primary Caregiver               │
│ Permissions: ☑ View All  ☑ Edit Events  ☑ Manage Meds        │
│ Notifications: ☑ All events  ☑ Missed meds  ☑ Emergencies    │
│ [Edit] [Remove]                                                │
│                                                                 │
│ 👨 Dad (Robert)          Role: Secondary Caregiver             │
│ Permissions: ☑ View All  ☐ Edit Events  ☐ Manage Meds        │
│ Notifications: ☑ Major events  ☐ Daily updates  ☑ Emergencies │
│ [Edit] [Remove]                                                │
│                                                                 │
│ 👩 Sister (Emily)        Role: Family Member                   │
│ Permissions: ☑ View Basic  ☐ View Details  ☐ Edit Events      │
│ Notifications: ☐ Regular updates  ☑ Emergencies only          │
│ [Edit] [Remove]                                                │
│                                                                 │
│ [+ Invite Family Member]                                       │
│                                                                 │
│ Emergency Access:                                               │
│ ☑ Allow emergency override of all restrictions                 │
│ Emergency contacts: Mom, Dad, Dr. Smith                        │
│                                                                 │
│ [Cancel]                                        [Save Settings] │
└─────────────────────────────────────────────────────────────────┘
```

## Mobile-Responsive Design

### 1. Mobile Calendar View
```
┌─────────────────────┐
│ ≡  Jan 2024    + ⚙ │
├─────────────────────┤
│ Today - Tue 16      │
│ ┌─────────────────┐ │
│ │ 9:00 💊 Meds    │ │
│ │ 10:30 🏥 Dr     │ │
│ │ 2:00 📋 Labs    │ │
│ │ 5:00 💊 Meds    │ │
│ └─────────────────┘ │
├─────────────────────┤
│ Tomorrow - Wed 17   │
│ ┌─────────────────┐ │
│ │ 9:00 💊 Meds    │ │
│ │ 1:00 🩺 MRI     │ │
│ │ 5:00 💊 Meds    │ │
│ └─────────────────┘ │
├─────────────────────┤
│ [Week] [Month]      │
│ [+ Add Event]       │
└─────────────────────┘
```

### 2. Mobile Event Details
```
┌─────────────────────┐
│ ← Dr. Smith Appt    │
├─────────────────────┤
│ 🏥 Cardiology       │
│ Jan 16, 10:30 AM    │
│ Duration: 1 hour    │
├─────────────────────┤
│ 📍 Heart Center     │
│ 123 Medical Dr      │
│ [Get Directions]    │
├─────────────────────┤
│ 📋 Preparation      │
│ • Bring EKG results │
│ • Fast 12 hours     │
├─────────────────────┤
│ 👥 Family           │
│ Mom attending ✓     │
│ Dad notified        │
├─────────────────────┤
│ 🔔 Reminders        │
│ 24h, 2h, 30m before │
├─────────────────────┤
│ [Edit] [Reschedule] │
│ [Add to Google Cal] │
│ [Cancel Appt]       │
└─────────────────────┘
```

## Key UI/UX Features

### Visual Design Elements
- **Color-coded event types**: Appointments (blue), Medications (green), Lab results (orange), Procedures (purple)
- **Icon system**: Consistent medical icons for quick recognition
- **Status indicators**: Visual cues for completed, pending, overdue items
- **Family member avatars**: Quick identification of who's involved

### Accessibility Features
- **High contrast mode** for visually impaired users
- **Large text options** for elderly users
- **Voice commands** for hands-free operation
- **Screen reader compatibility** for blind users
- **Simplified mode** for users with cognitive impairments

### Smart Features
- **Conflict detection**: Warn about scheduling conflicts
- **Travel time calculation**: Factor in travel time between appointments
- **Medication interaction alerts**: Warn about timing conflicts
- **Weather integration**: Suggest rescheduling for severe weather
- **Insurance verification**: Check coverage before scheduling

This UI design prioritizes medical-specific needs while maintaining family coordination and accessibility for all users.