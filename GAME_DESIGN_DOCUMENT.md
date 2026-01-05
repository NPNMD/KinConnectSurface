# FamMedicalCare - Application Design Document (GDD Format)

**Version:** 1.0  
**Last Updated:** November 15, 2025  
**Document Type:** Comprehensive Application Design Document  
**Status:** Living Document

---

## Document Control

| Role | Name | Date |
|------|------|------|
| **Author** | Development Team | November 2025 |
| **Reviewers** | Product, Engineering, Design | November 2025 |
| **Approvers** | Executive Team | Pending |

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Nov 2025 | Initial comprehensive GDD | Development Team |

---

## Table of Contents

1. [Document Header & Overview](#1-document-header--overview)
2. [Core Concept](#2-core-concept)
3. [Feature Systems](#3-feature-systems)
4. [User Roles & Progression](#4-user-roles--progression)
5. [User Interface & Experience](#5-user-interface--experience)
6. [Technical Architecture](#6-technical-architecture)
7. [Data Flow & Logic](#7-data-flow--logic)
8. [Advanced Systems](#8-advanced-systems)
9. [Security & Privacy](#9-security--privacy)
10. [Performance & Optimization](#10-performance--optimization)
11. [Future Roadmap](#11-future-roadmap)
12. [Appendices](#12-appendices)

---

# 1. Document Header & Overview

## 1.1 Executive Summary

**FamMedicalCare** (formerly KinConnect) is a comprehensive family healthcare coordination platform that transforms the overwhelming complexity of managing healthcare for loved ones into a connected, collaborative experience. The application serves as a central hub for medication management, appointment coordination, medical information tracking, and family collaboration.

### Mission Statement
To empower families to provide better care for their loved ones by making healthcare coordination simple, connected, and collaborative.

### Vision
Become the trusted platform that brings families together around healthcare, reducing caregiver burden while improving patient outcomes through intelligent coordination and compassionate design.

## 1.2 Document Purpose

This Game Design Document (GDD) format specification serves as the **single source of truth** for the FamMedicalCare application. While this is not a game, we use the GDD format because it provides:

- **Comprehensive System Documentation**: Every feature, workflow, and interaction fully specified
- **Implementation Clarity**: Detailed enough for developers to implement without ambiguity
- **Cross-Functional Alignment**: Shared understanding across product, design, and engineering
- **Living Reference**: Evolves with the product while maintaining historical context

### Intended Audience

- **Product Managers**: Feature specifications and user flows
- **Engineers**: Technical architecture and implementation details
- **Designers**: UI/UX patterns and interaction models
- **QA Teams**: Test scenarios and acceptance criteria
- **Stakeholders**: Product vision and strategic direction

## 1.3 Application Overview

### Core Value Proposition

FamMedicalCare bridges **professional healthcare credibility** with **warm, family-centered design** to solve the critical problem of fragmented healthcare coordination for families managing care for aging parents or chronically ill loved ones.

### Key Differentiators

1. **Dual-User Architecture**: Patients own their data; family members collaborate with granular permissions
2. **Time Bucket Medication System**: Intelligent medication organization by time of day with grace periods
3. **AI-Powered Visit Processing**: Automatic extraction of actionable items from doctor visit notes
4. **Family Responsibility Coordination**: Transportation and care task assignment with confirmation workflows
5. **Hybrid Calendar Approach**: Rich medical calendar with optional privacy-preserving Google Calendar sync

### Target Market

**Primary Market**: United States families managing healthcare for aging parents (65+) or chronically ill family members

**Market Size**: 
- 53 million family caregivers in the US
- 73% manage medications for loved ones
- 61% coordinate medical appointments
- Average 4.5 medications per patient 65+

---

# 2. Core Concept

## 2.1 Application Vision

### The Problem We Solve

**For Devoted Caregivers** (35-65 years old):
- Overwhelmed by managing multiple medications, appointments, and providers
- Stressed by coordinating care across family members
- Anxious about missing critical medication doses or appointments
- Frustrated by fragmented information across multiple systems
- Guilty about not being able to do more

**For Collaborative Family Members** (25-70 years old):
- Want to help but don't know what's needed
- Live far away and feel disconnected from care
- Unsure how to contribute without overstepping
- Need visibility into care status without constant phone calls

**For Aging Patients** (65+ years old):
- Managing multiple chronic conditions and medications
- Difficulty remembering medication schedules
- Need help coordinating appointments and transportation
- Want to maintain independence while accepting help

### Our Solution

A **unified healthcare coordination platform** that:
- Centralizes all medical information in one secure place
- Enables family collaboration with appropriate boundaries
- Automates reminders and notifications to reduce mental burden
- Provides intelligent insights through AI processing
- Respects privacy while enabling transparency

## 2.2 Core Pillars

### Pillar 1: Simplicity is Kindness
**Philosophy**: Every feature reduces burden, not adds to it

**Implementation**:
- Smart defaults that save time
- Progressive disclosure of complexity
- Clear is better than clever
- One-tap actions for common tasks
- Gentle guidance at decision points

### Pillar 2: Connected Care
**Philosophy**: Bring families together around healthcare

**Implementation**:
- Granular permission system for family access
- Real-time updates and notifications
- Shared visibility into care activities
- Collaborative task assignment
- Recognition of all contributions

### Pillar 3: Intelligent Automation
**Philosophy**: Technology should anticipate needs

**Implementation**:
- AI-powered visit summary processing
- Automatic medication reminder scheduling
- Smart pattern detection for adherence issues
- Predictive scheduling suggestions
- Proactive family notifications

### Pillar 4: Trust Through Transparency
**Philosophy**: Users control their data and privacy

**Implementation**:
- Clear privacy controls
- Granular sharing permissions
- Complete audit trails
- Honest about AI capabilities
- HIPAA-compliant data handling

### Pillar 5: Compassionate Design
**Philosophy**: Acknowledge the emotional weight of caregiving

**Implementation**:
- Warm, empathetic visual language
- Celebration of caregiving achievements
- Supportive error messages
- Calm during crisis moments
- Validation of caregiver efforts

## 2.3 Target Audience Personas

### Persona 1: The Devoted Caregiver (Primary User)

**Profile**:
- **Name**: Sarah, 52
- **Role**: Adult daughter managing mother's care
- **Location**: Lives 30 minutes from mother
- **Tech Comfort**: Moderate (uses smartphone daily)

**Needs**:
- Track mother's 8 daily medications
- Coordinate with 3 siblings for appointment transportation
- Manage appointments with 5 different specialists
- Remember medication refills and insurance deadlines
- Share updates with family without constant calls

**Pain Points**:
- Overwhelmed by medication schedules
- Anxious about missing doses
- Frustrated coordinating with siblings
- Guilty about not doing enough
- Stressed by fragmented information

**Goals**:
- Ensure mother takes medications correctly
- Get help from siblings when needed
- Stay organized and reduce stress
- Maintain mother's independence
- Feel confident in care quality

### Persona 2: The Collaborative Family Member (Secondary User)

**Profile**:
- **Name**: Michael, 45
- **Role**: Son living across the country
- **Location**: 2,000 miles away
- **Tech Comfort**: High (works in tech)

**Needs**:
- Stay informed about father's health
- Help when possible despite distance
- Know when transportation is needed
- Understand medication adherence
- Support primary caregiver (sister)

**Pain Points**:
- Feels disconnected from care
- Doesn't know how to help
- Worries about burdening sister
- Wants visibility without being intrusive
- Frustrated by lack of information

**Goals**:
- Contribute meaningfully to care
- Support primary caregiver
- Stay informed about health status
- Help with specific tasks remotely
- Reduce family stress

### Persona 3: The Aging Patient (Beneficiary)

**Profile**:
- **Name**: Dorothy, 78
- **Role**: Patient with multiple chronic conditions
- **Location**: Lives independently with family nearby
- **Tech Comfort**: Low (uses tablet for email)

**Needs**:
- Remember medication schedule
- Get to appointments on time
- Maintain independence
- Accept help gracefully
- Keep family informed

**Pain Points**:
- Difficulty remembering medications
- Confused by complex schedules
- Doesn't want to burden family
- Frustrated by loss of independence
- Worried about making mistakes

**Goals**:
- Take medications correctly
- Maintain health and independence
- Stay connected with family
- Reduce family worry
- Feel supported not controlled

---

# 3. Feature Systems

## 3.1 Medication Management System

### Purpose
Comprehensive medication tracking with time-based scheduling, adherence monitoring, and intelligent reminders to ensure patients take the right medications at the right time.

### Core Features

#### 3.1.1 Drug Search & Database Integration

**OpenFDA API Integration**:
- Real-time medication lookup by brand or generic name
- RxNorm identifier (RXCUI) for standardization
- Drug interaction checking
- Contraindication warnings
- Allergy cross-referencing
- Boxed warnings display
- Adverse reaction information

**Search Workflow**:
```
1. User enters medication name (partial match supported)
2. System queries OpenFDA API
3. Results display with:
   - Brand name and generic name
   - Strength options
   - Common dosage forms
   - Manufacturer information
4. User selects medication
5. System pre-populates form with drug data
6. User configures dosage and schedule
```

**Data Retrieved**:
- Drug name (brand and generic)
- Active ingredients
- Strength and dosage forms
- Manufacturer
- Drug class
- Common side effects
- Interaction warnings
- Pregnancy category
- DEA schedule (if controlled)

#### 3.1.2 Time Bucket Organization

**Standard Time Slots** (Regular Schedule):
- **Morning**: 6:00 AM - 10:00 AM (default: 7:00 AM)
- **Noon**: 11:00 AM - 2:00 PM (default: 12:00 PM)
- **Evening**: 5:00 PM - 8:00 PM (default: 6:00 PM)
- **Bedtime**: 9:00 PM - 11:59 PM (default: 10:00 PM)

**Night Shift Time Slots** (Alternative Schedule):
- **Morning**: 2:00 PM - 6:00 PM (default: 3:00 PM)
- **Noon**: 7:00 PM - 10:00 PM (default: 8:00 PM)
- **Evening**: 11:00 PM - 2:00 AM (default: 12:00 AM)
- **Bedtime**: 6:00 AM - 10:00 AM (default: 8:00 AM)

**Dynamic Buckets**:
- **Overdue**: Past grace period (red styling, urgent)
- **Due Now**: Within current time window (yellow, attention)
- **Due Soon**: Within next 30 minutes (blue, prepare)
- **Upcoming**: Scheduled for later today (gray, informational)

**Bucket Logic**:
```
For each medication event:
1. Get scheduled time
2. Get current time
3. Calculate time difference
4. Determine bucket:
   - If past grace period → Overdue
   - If within time slot window → Due Now
   - If within 30 min of time slot → Due Soon
   - If later today → Upcoming
5. Apply visual styling
6. Sort by urgency within bucket
```

#### 3.1.3 Smart Scheduling Patterns

**Frequency Types**:

1. **Daily**: Once per day at specified time
   - Configuration: Single time slot selection
   - Example: "Take at 8:00 AM daily"

2. **BID (Twice Daily)**: Morning + Evening
   - Configuration: Two time slots
   - Example: "Take at 8:00 AM and 8:00 PM"

3. **TID (Three Times Daily)**: Morning + Noon + Evening
   - Configuration: Three time slots
   - Example: "Take at 8:00 AM, 12:00 PM, 6:00 PM"

4. **QID (Four Times Daily)**: All four time buckets
   - Configuration: Four time slots
   - Example: "Take at 8:00 AM, 12:00 PM, 6:00 PM, 10:00 PM"

5. **Interval-Based**: Every X hours
   - Options: q4h, q6h, q8h, q12h
   - Configuration: Start time + interval
   - Example: "Every 6 hours starting at 6:00 AM"
   - Generates: 6:00 AM, 12:00 PM, 6:00 PM, 12:00 AM

6. **Cycling**: X days on, Y days off
   - Configuration: Days on, days off, start date
   - Example: "5 days on, 2 days off"
   - Use case: Chemotherapy, hormone therapy

7. **Weekly**: Specific days of week
   - Configuration: Day selection + time
   - Example: "Monday, Wednesday, Friday at 8:00 AM"
   - Use case: Weekly injections, supplements

8. **Monthly**: Specific day of month
   - Configuration: Day number + time
   - Example: "1st of month at 9:00 AM"
   - Use case: Monthly medications, refill reminders

9. **Custom**: Irregular patterns
   - Configuration: Specific dates and times
   - Example: "Dec 1, Dec 15, Jan 1 at 10:00 AM"
   - Use case: Irregular treatment schedules

**Advanced Timing**:

- **Meal-Relative**: 
  - 30 minutes before meals
  - With meals
  - 30 minutes after meals
  - 2 hours after meals

- **Sleep-Relative**:
  - At bedtime
  - Upon waking
  - Before sleep
  - During night (if awake)

- **Separation Rules**:
  - Minimum time between conflicting medications
  - Example: "Take 2 hours apart from calcium"
  - System prevents scheduling conflicts

#### 3.1.4 PRN (As-Needed) Medications

**Purpose**: Track medications taken only when needed, not on a schedule

**Features**:
- No scheduled reminders
- Quick-access "Take Now" button
- Reason logging (required)
- Effectiveness tracking
- Maximum daily dose warnings
- Time-since-last-dose display

**PRN Workflow**:
```
1. User feels symptom (e.g., headache)
2. Opens PRN medications list
3. Selects appropriate medication
4. System checks:
   - Time since last dose
   - Daily maximum not exceeded
   - No conflicting medications recently taken
5. User enters reason (dropdown + notes)
6. Confirms "Take Now"
7. System logs event with timestamp
8. User can rate effectiveness later
```

**Reason Categories**:
- Pain (specify location)
- Nausea
- Anxiety
- Insomnia
- Allergies
- Breathing difficulty
- Other (free text)

**Effectiveness Tracking**:
- 1-5 star rating
- Time to relief
- Duration of relief
- Side effects experienced
- Would take again (yes/no)

**Safety Features**:
- Maximum daily dose warnings
- Minimum time between doses
- Interaction alerts with scheduled meds
- Cumulative dose tracking
- Pattern detection (overuse alerts)

#### 3.1.5 Medication Actions

**Primary Actions**:

1. **Take**:
   - Records medication as taken
   - Captures timestamp
   - Records who administered (patient or family member)
   - Updates adherence statistics
   - Triggers next dose scheduling
   - 30-second undo window

2. **Snooze**:
   - Delays reminder for specified time
   - Options: 10 min, 30 min, 1 hr, 2 hr, 4 hr
   - Tracks snooze history
   - Limits: Maximum 3 snoozes per dose
   - Reason optional but encouraged
   - Grace period continues during snooze

3. **Skip**:
   - Marks dose as intentionally skipped
   - Requires reason (dropdown)
   - Affects adherence calculation
   - Notifies family if configured
   - Tracks skip patterns
   - Cannot be undone (permanent decision)

4. **Reschedule**:
   - Move to different time today
   - Select new time slot
   - Updates calendar event
   - Notifies family of change
   - Maintains adherence tracking
   - Reason optional

**Skip Reasons**:
- Forgot to bring medication
- Feeling nauseous
- Doctor advised to skip
- Medication not available
- Side effects
- Other (free text)

**Action Workflow**:
```
User Action → Validation → Transaction Start → Update Event → 
Update Command → Trigger Notifications → Update Adherence → 
Transaction Commit → UI Update → Undo Window (30s)
```

#### 3.1.6 Grace Period System

**Purpose**: Allow reasonable flexibility before marking medications as missed

**Default Grace Periods by Type**:

| Medication Type | Grace Period | Rationale |
|----------------|--------------|-----------|
| Critical (heart, diabetes) | 15-30 min | Time-sensitive |
| Standard (BP, cholesterol) | 30-60 min | Moderate flexibility |
| Vitamins/Supplements | 120-240 min | High flexibility |
| PRN | No grace period | As-needed only |

**Special Circumstances Multipliers**:

- **Weekend**: 1.5x (50% longer grace period)
  - Rationale: More relaxed schedule
  - Example: 30 min → 45 min

- **Holiday**: 2.0x (100% longer grace period)
  - Rationale: Disrupted routine
  - Example: 30 min → 60 min

- **Sick Day**: 3.0x (200% longer grace period)
  - Rationale: Patient may be sleeping/recovering
  - Example: 30 min → 90 min
  - Activated by patient or family member

**Grace Period Calculation**:
```
Base Grace Period = medication.gracePeriodMinutes
Current Date = today
Multiplier = 1.0

If (isWeekend(today)) {
  Multiplier = 1.5
}

If (isHoliday(today)) {
  Multiplier = 2.0
}

If (patient.isSickDay(today)) {
  Multiplier = 3.0
}

Effective Grace Period = Base Grace Period × Multiplier
Grace Period End = Scheduled Time + Effective Grace Period
```

**Automatic Missed Detection**:
- Scheduled function runs every 15 minutes
- Queries medications past grace period
- Marks as "missed" automatically
- Triggers family notifications
- Updates adherence statistics
- Creates missed event in audit log

#### 3.1.7 Medication Packs

**Purpose**: Group medications for "Take All" functionality

**Use Cases**:
- Morning medication routine (5+ pills)
- Bedtime medications
- Medications that must be taken together
- Pre-meal medication groups

**Pack Features**:
- Custom pack names
- Visual grouping in UI
- Single "Take All" button
- Individual medication override
- Pack-level notes
- Reorder medications within pack

**Pack Workflow**:
```
1. User creates pack ("Morning Meds")
2. Adds medications to pack
3. Sets pack time (8:00 AM)
4. At scheduled time:
   - Pack appears as single item
   - Shows all medications in pack
   - "Take All" button prominent
   - Individual "Take" buttons available
5. User taps "Take All"
6. System marks all as taken simultaneously
7. Single notification to family
```

#### 3.1.8 Drug Safety Features

**Interaction Checking**:
- Drug-drug interactions (severity levels)
- Drug-food interactions
- Drug-alcohol interactions
- Duplicate therapy detection
- Contraindication warnings

**Severity Levels**:
- **Critical**: Do not take together (red alert)
- **Major**: Consult doctor before taking (orange warning)
- **Moderate**: Monitor for side effects (yellow caution)
- **Minor**: Informational only (blue info)

**Allergy Alerts**:
- Cross-reference with patient allergies
- Ingredient-level checking
- Related compound warnings
- Severity assessment
- Alternative suggestions

**Safety Workflow**:
```
When adding new medication:
1. Check against current medications
2. Check against patient allergies
3. Check against medical conditions
4. Generate safety report
5. Display warnings to user
6. Require acknowledgment for critical warnings
7. Log safety check in audit trail
```

### 3.1.9 Data Models

**medication_commands** (Source of Truth):
```typescript
{
  id: string;
  patientId: string;
  name: string;
  genericName?: string;
  rxcui?: string; // RxNorm identifier
  dosage: string;
  strength: string;
  frequency: FrequencyType;
  timeSlots: TimeSlot[];
  isPRN: boolean;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  prescribedBy?: string;
  prescribedDate?: Date;
  instructions?: string;
  sideEffects?: string[];
  warnings?: string[];
  gracePeriodMinutes: number;
  hasReminders: boolean;
  reminderTimes: string[]; // HH:MM format
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}
```

**medication_events** (Immutable Event Log):
```typescript
{
  id: string;
  medicationId: string;
  patientId: string;
  eventType: 'taken' | 'missed' | 'skipped' | 'snoozed' | 'rescheduled';
  scheduledDateTime: Date;
  actualDateTime?: Date;
  takenBy?: string; // userId
  reason?: string;
  notes?: string;
  effectiveness?: number; // 1-5 for PRN
  snoozeMinutes?: number;
  newScheduledTime?: Date; // for reschedule
  createdAt: Date;
}
```

**medication_calendar_events** (Daily Scheduled Instances):
```typescript
{
  id: string;
  medicationId: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  scheduledDateTime: Date;
  status: 'scheduled' | 'taken' | 'missed' | 'skipped' | 'late';
  takenBy?: string;
  actualTakenDateTime?: Date;
  timeBucket: 'morning' | 'noon' | 'evening' | 'bedtime' | 'overdue';
  gracePeriodMinutes: number;
  gracePeriodEnd: Date;
  snoozeHistory: SnoozeEvent[];
  skipHistory: SkipEvent[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.1.10 Adherence Tracking

**Metrics Calculated**:

1. **Adherence Rate**: (taken + late) / total scheduled
   - Target: ≥ 80% (good), ≥ 90% (excellent)
   - Calculation period: Rolling 30 days

2. **On-Time Rate**: taken on time / total scheduled
   - Target: ≥ 70% (good), ≥ 85% (excellent)
   - Within grace period = on time

3. **Missed Rate**: missed / total scheduled
   - Target: ≤ 10% (acceptable), ≤ 5% (excellent)
   - Triggers family alerts if > 15%

4. **Average Delay**: Mean minutes late for late doses
   - Target: < 30 minutes average
   - Excludes missed doses

5. **Longest Delay**: Maximum delay recorded
   - Informational metric
   - Helps identify problem patterns

**Pattern Detection**:
- Most missed time of day
- Most missed day of week
- Consecutive missed doses (alert trigger)
- Declining adherence trends
- Medication-specific patterns

**Adherence Calculation**:
```
Rolling 30-Day Window:
- Total Scheduled = count(scheduled events in 30 days)
- Taken = count(status = 'taken')
- Late = count(status = 'late')
- Missed = count(status = 'missed')
- Skipped = count(status = 'skipped')

Adherence Rate = (Taken + Late) / Total Scheduled × 100%
On-Time Rate = Taken / Total Scheduled × 100%
Missed Rate = Missed / Total Scheduled × 100%
```

**Family Notifications**:
- Single missed dose: Info notification
- 2 consecutive missed: Warning notification
- 3+ consecutive missed: Critical alert
- Adherence below 80%: Weekly summary
- Declining trend: Monthly report

---

## 3.2 Family Access & Coordination System

### Purpose
Enable secure, permission-based family collaboration while maintaining patient control and privacy.

### Core Features

#### 3.2.1 Access Levels

**Full Access** (Primary Caregiver):
- View all medical appointments and events
- Create new appointments and medications
- Edit existing appointments and medications
- Delete appointments and medications
- Claim transportation responsibilities
- View detailed medical information
- Receive all notifications
- Manage other family members (if granted)

**View Only** (Supportive Family):
- View all medical appointments and events (read-only)
- Claim transportation responsibilities
- View medications (read-only)
- View visit summaries (read-only)
- Receive notifications about appointments
- Cannot create, edit, or delete any data
- Cannot modify patient profile
- Cannot manage other family members

**Limited Access** (Custom):
- Custom permission sets
- Granular control per feature
- Time-limited access grants
- Specific event type access
- Configurable notification preferences

**Emergency Only** (Emergency Contact):
- View-only access to critical information
- Receive emergency alerts only
- Priority contact for urgent situations
- Time-limited emergency access grants
- Activated by patient or primary caregiver

#### 3.2.2 Permission Structure

**Granular Permissions**:
```typescript
{
  canView: boolean;              // View medical information
  canCreate: boolean;            // Create new items
  canEdit: boolean;              // Modify existing items
  canDelete: boolean;            // Remove items
  canClaimResponsibility: boolean; // Claim transportation
  canManageFamily: boolean;      // Invite/remove family
  canViewMedicalDetails: boolean; // Access sensitive info
  canReceiveNotifications: boolean; // Get alerts
}
```

**Permission Presets**:

| Permission | Full Access | View Only | Limited | Emergency |
|------------|-------------|-----------|---------|-----------|
| canView | ✓ | ✓ | Custom | ✓ |
| canCreate | ✓ | ✗ | Custom | ✗ |
| canEdit | ✓ | ✗ | Custom | ✗ |
| canDelete | ✓ | ✗ | Custom | ✗ |
| canClaimResponsibility | ✓ | ✓ | Custom | ✗ |
| canManageFamily | ✓ | ✗ | Custom | ✗ |
| canViewMedicalDetails | ✓ | ✓ | Custom | ✓ |
| canReceiveNotifications | ✓ | ✓ | Custom | ✓ |

#### 3.2.3 Invitation System

**Email-Based Invitations**:

**Invitation Workflow**:
```
Patient Side:
1. Navigate to Family Management
2. Click "Invite Family Member"
3. Fill invitation form:
   - Name
   - Email address
   - Relationship (dropdown)
   - Access level (Full/View Only/Limited/Emergency)
   - Review permissions
   - Optional personal message
4. Click "Send Invitation"
5. System generates unique token
6. Email sent to family member
7. Invitation status: "Pending"

Family Member Side:
1. Receive email with invitation link
2. Click link → Redirect to /family-invite/{token}
3. Sign in with Google (or create account)
4. Redirect to /invitation/{token}
5. Review invitation details:
   - Patient name
   - Access level
   - Permissions list
   - Relationship
6. Accept or Decline
7. If accepted:
   - Access record created (status: active)
   - Redirect to patient's dashboard
   - Welcome email sent
   - Patient notified of acceptance
8. If declined:
   - Invitation marked declined
   - Patient notified
   - Reason optional
```

**Invitation Token**:
- Unique UUID v4
- 7-day expiration
- Single-use only
- Encrypted in database
- Invalidated after acceptance/decline

**Invitation Email Template**:
```
Subject: [Patient Name] has invited you to FamMedicalCare

Hi [Family Member Name],

[Patient Name] has invited you to help manage their healthcare 
on FamMedicalCare.

Access Level: [Full Access / View Only / Limited / Emergency Only]

This will allow you to:
• [Permission 1]
• [Permission 2]
• [Permission 3]

[Optional Personal Message from Patient]

[Accept Invitation Button]

This invitation expires in 7 days.

Questions? Reply to this email or visit our Help Center.
```

#### 3.2.4 Permission Management

**Changing Access Levels**:
```
Patient Workflow:
1. Navigate to Family Management
2. Select family member
3. Click "Change Access Level"
4. Select new access level
5. Review permission changes
6. Confirm change
7. System updates permissions
8. Family member notified via email
9. Audit log entry created
```

**Permission Change Notification**:
```
Subject: Your access to [Patient Name]'s healthcare has been updated

Hi [Family Member Name],

[Patient Name] has updated your access level.

Previous Access: [Old Level]
New Access: [New Level]

Your new permissions:
• [Permission 1]
• [Permission 2]
• [Permission 3]

[View Updated Access Button]
```

**Removing Family Access**:
```
Patient Workflow:
1. Navigate to Family Management
2. Select family member
3. Click "Remove Access"
4. Confirm removal (with reason optional)
5. System revokes all permissions
6. Family member notified via email
7. Access record status: "revoked"
8. Audit log entry created
```

**Removal Notification**:
```
Subject: Your access to [Patient Name]'s healthcare has been removed

Hi [Family Member Name],

[Patient Name] has removed your access to their healthcare 
information on FamMedicalCare.

You will no longer be able to:
• View their medical information
• Receive notifications
• Claim responsibilities

[Optional Reason from Patient]

If you believe this was done in error, please contact [Patient Name] 
directly.
```

#### 3.2.5 Patient Switcher

**Purpose**: Allow family members to manage multiple patients

**Features**:
- Dropdown selector in header
- Shows all patients with access
- Quick switch between patients
- Remembers last active patient
- Visual indicator of current patient
- Access level badge per patient

**Switcher UI**:
```
┌─────────────────────────────────┐
│ Currently Viewing:              │
│ ┌─────────────────────────────┐ │
│ │ 👤 Dorothy Smith            │ │
│ │    Full Access              │ │
│ └─────────────────────────────┘ │
│                                 │
│ Other Patients:                 │
│ ┌─────────────────────────────┐ │
│ │ 👤 Robert Johnson           │ │
│ │    View Only                │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 👤 Mary Williams            │ │
│ │    Emergency Only           │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Switching Logic**:
```
1. User clicks patient switcher
2. Dropdown shows all accessible patients
3. User selects different patient
4. System:
   - Updates active patient ID in context
   - Loads patient-specific data
   - Updates URL (if applicable)
   - Saves preference to user profile
   - Refreshes dashboard
5. UI updates to show new patient
```

#### 3.2.6 Audit Trail

**Purpose**: Complete tracking of all access changes and actions

**Audit Events Logged**:
- Invitation sent
- Invitation accepted/declined
- Access level changed
- Permissions modified
- Family member removed
- Data accessed by family member
- Actions taken by family member
- Emergency access granted/revoked

**Audit Log Entry**:
```typescript
{
  id: string;
  patientId: string;
  familyMemberId?: string;
  eventType: AuditEventType;
  action: string;
  details: object;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
```

**Audit Log Viewing**:
- Patient can view full audit log
- Family members can view their own actions
- Filterable by date, event type, family member
- Exportable for compliance
- Retention: 7 years (HIPAA compliance)

### 3.2.7 Data Model

**family_calendar_access**:
```typescript
{
  id: string;
  patientId: string;
  familyMemberId: string;
  familyMemberEmail: string;
  familyMemberName: string;
  relationship: string;
  accessLevel: 'full' | 'view_only' | 'limited' | 'emergency_only';
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canClaimResponsibility: boolean;
    canManageFamily: boolean;
    canViewMedicalDetails: boolean;
    canReceiveNotifications: boolean;
  };
  status: 'active' | 'pending' | 'revoked' | 'expired';
  invitationToken?: string;
  invitationExpiresAt?: Date;
  invitedAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  lastAccessAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

---

## 3.3 Medical Calendar System

### Purpose
Unified calendar for appointments, procedures, and medication schedules with family responsibility coordination.

### Core Features

#### 3.3.1 Event Types

**Appointment Categories** (20+ types):

| Category | Event Types | Color Code |
|----------|-------------|------------|
| **Appointments** | Appointment, Consultation, Follow-up | Blue |
| **Diagnostics** | Lab Test, Imaging, Biopsy | Purple |
| **Procedures** | Procedure, Surgery, Treatment | Red |
| **Therapy** | Physical Therapy, Occupational Therapy, Speech Therapy | Green |
| **Preventive** | Vaccination, Health Screening, Wellness Check | Teal |
| **Hospital** | Hospital Admission, Hospital Discharge, Emergency Visit | Orange |
| **Administrative** | Insurance Deadline, Medication Refill, Pre-Authorization | Gray |

**Event Type Details**:

1. **Appointment**: Regular doctor visit
   - Typical duration: 30-60 minutes
   - Requires: Provider, facility
   - May require: Transportation

2. **Consultation**: Specialist consultation
   - Typical duration: 45-90 minutes
   - Requires: Specialist provider
   - Often requires: Referral, pre-authorization

3. **Follow-up**: Post-procedure or post-treatment check
   - Typical duration: 15-30 minutes
   - Linked to: Previous appointment/procedure
   - May require: Test results

4. **Lab Test**: Blood work, urinalysis, etc.
   - Typical duration: 15-30 minutes
   - Requires: Lab facility, order
   - May require: Fasting, preparation

5. **Imaging**: X-ray, MRI, CT scan, ultrasound
   - Typical duration: 30-120 minutes
   - Requires: Imaging facility, order
   - May require: Contrast, preparation

6. **Procedure**: Minor medical procedure
   - Typical duration: 30-180 minutes
   - Requires: Provider, facility, consent
   - May require: Anesthesia, recovery time

7. **Surgery**: Surgical procedure
   - Typical duration: 1-8 hours
   - Requires: Surgeon, facility, consent
   - Requires: Pre-op, post-op care

8. **Therapy Session**: PT, OT, speech therapy
   - Typical duration: 30-60 minutes
   - Requires: Therapist, facility
   - Often recurring: Weekly schedule

9. **Vaccination**: Immunization
   - Typical duration: 15-30 minutes
   - Requires: Provider, vaccine availability
   - May require: Observation period

10. **Hospital Admission**: Inpatient stay begins
    - Duration: Variable (days to weeks)
    - Requires: Admission orders, room assignment
    - Triggers: Family notifications

#### 3.3.2 Event Creation

**Event Creation Form**:
```
┌─────────────────────────────────────────┐
│ Create Medical Event                    │
├─────────────────────────────────────────┤
│ Event Type: [Dropdown]                  │
│ Title: [Text Input]                     │
│ Description: [Text Area]                │
│                                         │
│ Date & Time:                            │
│ Date: [Date Picker]                     │
│ Start Time: [Time Picker]               │
│ Duration: [Dropdown] 30 min             │
│ ☐ All Day Event                         │
│                                         │
│ Location:                               │
│ Provider: [Search/Select]               │
│ Facility: [Search/Select]               │
│ Room/Suite: [Text Input]                │
│                                         │
│ Priority: [Dropdown] Medium             │
│ Status: [Dropdown] Scheduled            │
│                                         │
│ Transportation:                         │
│ ☐ Requires Transportation               │
│ ☐ Requires Accompaniment                │
│                                         │
│ Reminders:                              │
│ ☑ 24 hours before                       │
│ ☑ 2 hours before                        │
│ ☑ 15 minutes before                     │
│ [+ Add Custom Reminder]                 │
│                                         │
│ Insurance:                              │
│ Copay Amount: [$___]                    │
│ ☐ Pre-authorization Required            │
│ Pre-auth #: [Text Input]                │
│                                         │
│ Notes: [Text Area]                      │
│                                         │
│ [Cancel] [Save Event]                   │
└─────────────────────────────────────────┘
```

**Validation Rules**:
- Title: Required, max 200 characters
- Date: Required, cannot be in past (except for recording past events)
- Start Time: Required
- Duration: Required, 15-480 minutes
- Provider: Optional but recommended
- Facility: Optional but recommended
- Transportation: If checked, notifies family members

#### 3.3.3 Recurring Events

**Recurrence Patterns**:

1. **Daily**:
   - Every day
   - Every X days
   - Weekdays only
   - Weekends only

2. **Weekly**:
   - Every week on [days]
   - Every X weeks on [days]
   - Example: "Every Monday and Wednesday"

3. **Monthly**:
   - Day X of every month
   - First/Second/Third/Fourth/Last [day] of month
   - Example: "First Monday of every month"

4. **Yearly**:
   - Every year on [date]
   - Example: "Annual physical on March 15"

**Recurrence Configuration**:
```
┌─────────────────────────────────────────┐
│ Recurrence Pattern                      │
├─────────────────────────────────────────┤
│ Frequency: [Dropdown] Weekly            │
│                                         │
│ Repeat every: [1] week(s)               │
│                                         │
│ Repeat on:                              │
│ ☐ Sunday    ☑ Monday    ☐ Tuesday       │
│ ☑ Wednesday ☐ Thursday  ☑ Friday        │
│ ☐ Saturday                              │
│                                         │
│ Ends:                                   │
│ ○ Never                                 │
│ ○ On: [Date Picker]                     │
│ ● After: [10] occurrences               │
│                                         │
│ [Cancel] [Save Pattern]                 │
└─────────────────────────────────────────┘
```

**Recurring Event Management**:
- Edit single occurrence
- Edit this and future occurrences
- Edit all occurrences
- Delete single occurrence
- Delete series
- Exception handling for holidays

#### 3.3.4 Family Responsibility System

**Transportation Coordination Workflow**:

```
Step 1: Appointment Creation
- Patient creates appointment
- Marks "Requires Transportation"
- Optionally marks "Requires Accompaniment"
- Saves appointment

Step 2: Family Notification (72 hours before)
- System sends notification to family members with driving permissions
- Email subject: "Transportation needed for [Patient] on [Date]"
- Includes: Date, time, location, estimated duration
- "Claim Responsibility" button in email

Step 3: Responsibility Claiming
- Family member clicks "Claim Responsibility"
- Redirected to app
- Reviews appointment details
- Can add transportation notes:
  - "I'll pick up at 1:30 PM"
  - "Will stay for appointment"
  - "Can drive but cannot stay"
- Confirms claim

Step 4: Patient Confirmation
- Patient receives notification
- Reviews family member's claim
- Can accept or request different person
- Confirms assignment
- Status: "Confirmed"

Step 5: Reminders to Responsible Person
- 24 hours before: "Reminder: Transportation for [Patient] tomorrow"
- 2 hours before: "Reminder: Pick up [Patient] in 2 hours"
- 15 minutes before: "Reminder: Transportation for [Patient] in 15 min"

Step 6: Completion
- After appointment time
- Responsible person marks as "Completed"
- Optional: Add notes about appointment
- Patient can confirm completion
```

**Responsibility Statuses**:

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| **Unassigned** | No one has claimed | Claim, Decline |
| **Claimed** | Family member volunteered | Confirm, Decline, Reassign |
| **Confirmed** | Patient approved assignment | Mark Complete, Cancel |
| **Declined** | Family member cannot help | Claim (by others) |
| **Completed** | Transportation provided | View details |
| **Cancelled** | Appointment cancelled | None |

**Responsibility Notification Templates**:

**Initial Request** (72h before):
```
Subject: Transportation needed for Dorothy Smith

Hi Michael,

Dorothy has an appointment and needs transportation:

📅 Date: Monday, March 15, 2025
🕐 Time: 2:00 PM
📍 Location: Dr. Johnson's Office
         123 Medical Plaza, Suite 200
⏱️ Estimated Duration: 1 hour

Can you help with transportation?

[Claim Responsibility] [I Can't Help]

This appointment is in 3 days.
```

**Claim Confirmation** (to patient):
```
Subject: Michael claimed transportation for your appointment

Hi Dorothy,

Michael has offered to provide transportation for your 
appointment on Monday, March 15 at 2:00 PM.

Michael's note: "I'll pick you up at 1:30 PM and stay 
for the appointment."

[Confirm Michael] [Request Different Person]
```

**Reminder** (24h before):
```
Subject: Reminder: Transportation for Dorothy tomorrow

Hi Michael,

This is a reminder that you're providing transportation 
for Dorothy tomorrow:

📅 Tomorrow, Monday, March 15
🕐 Pick up at: 1:30 PM
📍 Appointment at: 2:00 PM
📍 Location: Dr. Johnson's Office

Your note: "I'll pick you up at 1:30 PM and stay for 
the appointment."

[View Details] [Need to Cancel?]
```

#### 3.3.5 Google Calendar Integration

**Purpose**: Optional two-way sync with privacy controls

**Sync Strategies**:

1. **One-way to Google**: FamMedicalCare → Google Calendar
   - Events created in app appear in Google Calendar
   - Changes in app update Google Calendar
   - Changes in Google Calendar do NOT update app
   - Use case: Personal reminder backup

2. **One-way from Google**: Google Calendar → FamMedicalCare
   - Events created in Google Calendar appear in app
   - Changes in Google Calendar update app
   - Changes in app do NOT update Google Calendar
   - Use case: Import existing medical appointments

3. **Two-way**: Bidirectional sync
   - Events sync in both directions
   - Conflict resolution required
   - Most complex but most flexible
   - Use case: Full calendar integration

**Privacy Controls**:

**Sync Configuration**:
```
┌─────────────────────────────────────────┐
│ Google Calendar Sync Settings           │
├─────────────────────────────────────────┤
│ Sync Enabled: [Toggle] ON               │
│                                         │
│ Sync Direction:                         │
│ ● One-way to Google Calendar            │
│ ○ One-way from Google Calendar          │
│ ○ Two-way sync                          │
│                                         │
│ Privacy Settings:                       │
│ Event Types to Sync:                    │
│ ☑ Appointments                          │
│ ☑ Lab Tests                             │
│ ☑ Procedures                            │
│ ☐ Medication Reminders                  │
│ ☐ Insurance Deadlines                   │
│                                         │
│ Information to Include:                 │
│ ☑ Event title                           │
│ ☑ Date and time                         │
│ ☑ Location                              │
│ ☐ Provider name                         │
│ ☐ Medical details                       │
│ ☐ Family responsibility info            │
│                                         │
│ Custom Event Title:                     │
│ ○ Use actual title                      │
│ ● Use generic: "Medical Appointment"    │
│ ○ Custom: [Text Input]                  │
│                                         │
│ [Disconnect Google] [Save Settings]     │
└─────────────────────────────────────────┘
```

**Privacy-Preserving Sync**:
- Minimal details in Google Calendar
- Generic event titles option
- Selective event type sync
- No medical details unless explicitly enabled
- Family information excluded by default

**Conflict Resolution**:

When two-way sync enabled and conflicts occur:

```
Conflict Detected:
┌─────────────────────────────────────────┐
│ Event Modified in Both Places           │
├─────────────────────────────────────────┤
│ FamMedicalCare Version:                 │
│ Title: Dr. Johnson Appointment          │
│ Date: March 15, 2:00 PM                 │
│ Location: Medical Plaza Suite 200       │
│                                         │
│ Google Calendar Version:                │
│ Title: Doctor Appointment               │
│ Date: March 15, 2:30 PM                 │
│ Location: Medical Plaza                 │
│                                         │
│ Which version should we keep?           │
│ ○ Use FamMedicalCare version            │
│ ○ Use Google Calendar version           │
│ ○ Merge (manual review required)        │
│                                         │
│ [Cancel] [Resolve Conflict]             │
└─────────────────────────────────────────┘
```

**Sync Status Indicators**:
- ✓ Synced successfully
- ⟳ Sync in progress
- ⚠ Sync warning (minor issue)
- ✗ Sync failed (requires attention)
- ⊘ Not synced (by choice)

#### 3.3.6 Reminder System

**Default Reminder Times**:
- 24 hours before appointment
- 2 hours before appointment
- 15 minutes before appointment

**Custom Reminders**:
- 1 week before
- 3 days before
- 1 day before
- 12 hours before
- 6 hours before
- 1 hour before
- 30 minutes before
- At appointment time

**Reminder Channels**:
- Email (always available)
- SMS (if phone number provided)
- Push notification (if app installed)
- In-app notification

**Reminder Configuration**:
```
┌─────────────────────────────────────────┐
│ Appointment Reminders                   │
├─────────────────────────────────────────┤
│ Default Reminders:                      │
│ ☑ 24 hours before (Email, Push)         │
│ ☑ 2 hours before (Email, SMS, Push)     │
│ ☑ 15 minutes before (Push)              │
│                                         │
│ Custom Reminders:                       │
│ [+ Add Reminder]                        │
│                                         │
│ Reminder #1:                            │
│ Time: [1] [week] before                 │
│ Channels: ☑ Email ☐ SMS ☑ Push         │
│ [Remove]                                │
│                                         │
│ Quiet Hours:                            │
│ Don't send reminders between:           │
│ [10:00 PM] and [8:00 AM]                │
│                                         │
│ Emergency Override:                     │
│ ☑ Send critical reminders even during  │
│   quiet hours                           │
│                                         │
│ [Save Preferences]                      │
└─────────────────────────────────────────┘
```

**Reminder Email Template**:
```
Subject: Reminder: Appointment with Dr. Johnson tomorrow

Hi Dorothy,

This is a reminder about your upcoming appointment:

📅 Tomorrow, Monday, March 15, 2025
🕐 2:00 PM
📍 Dr. Johnson's Office
   123 Medical Plaza, Suite 200
   Anytown, ST 12345

👤 Provider: Dr. Sarah Johnson (Cardiologist)
⏱️ Estimated Duration: 1 hour

Transportation: Michael will pick you up at 1:30 PM

Preparation:
• Bring your insurance card
• Bring list of current medications
• Arrive 15 minutes early for check-in

[View Appointment Details] [Add to Calendar]

Need to reschedule? [Contact Office]
```

### 3.3.7 Data Model

**medical_events**:
```typescript
{
  id: string;
  patientId: string;
  title: string;
  description?: string;
  eventType: MedicalEventType;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  startDateTime: Date;
  endDateTime: Date;
  duration: number; // minutes
  isAllDay: boolean;
  location?: string;
  providerId?: string;
  providerName?: string; // cached
  facilityId?: string;
  facilityName?: string; // cached
  room?: string;
  requiresTransportation: boolean;
  requiresAccompaniment: boolean;
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  responsibilityStatus: 'unassigned' | 'claimed' | 'confirmed' | 'declined' | 'completed';
  responsibilityNotes?: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  parentEventId?: string;
  reminders: Reminder[];
  insuranceRequired: boolean;
  copayAmount?: number;
  preAuthRequired: boolean;
  preAuthNumber?: string;
  googleCalendarEventId?: string;
  syncedToGoogleCalendar: boolean;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3.4 Visit Summary & AI Processing

### Purpose
Record and process medical visit information with AI assistance to extract actionable insights.

### Core Features

#### 3.4.1 Input Methods

**1. Voice Recording** (Browser-based):
- Uses Web Speech API
- Real-time transcription
- Pause/resume capability
- Visual audio level indicator
- Maximum duration: 10 minutes
- Automatic punctuation
- Speaker identification (if multiple speakers)

**Voice Recording UI**:
```
┌─────────────────────────────────────────┐
│ Record Visit Summary                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │  🎤  Recording...        [02:34]    │ │
│ │                                     │ │
│ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░  │ │
│ │  Audio Level                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Transcription:                          │
│ ┌─────────────────────────────────────┐ │
│ │ Patient reports feeling better      │ │
│ │ since last visit. Blood pressure    │ │
│ │ is 120/80. Discussed increasing     │ │
│ │ Lisinopril to 10mg daily. Patient   │ │
│ │ to return in 3 months for follow-up.│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [⏸ Pause] [⏹ Stop] [🗑 Delete]          │
└─────────────────────────────────────────┘
```

**2. Manual Text Entry**:
- Rich text editor
- Formatting options (bold, italic, lists)
- Auto-save every 30 seconds
- Character count display
- Spell check enabled
- Template suggestions

**3. Dictation** (Real-time voice-to-text):
- Continuous dictation mode
- Voice commands for punctuation
- Hands-free operation
- Automatic capitalization
- Number recognition
- Medical terminology support

#### 3.4.2 AI Processing (Google Gemini)

**Processing Pipeline**:
```
1. User submits visit summary (text)
2. System validates input (min 50 characters)
3. Sends to Google Gemini API with medical context
4. AI analyzes text and extracts:
   - Key points (bullet list)
   - Action items with due dates
   - Medication changes (new, stopped, modified)
   - Follow-up requirements
   - Urgency assessment
   - Risk factors
   - Recommendations
5. Returns structured JSON response
6. System validates AI output
7. Stores processed summary
8. Displays to user for review
9. User can edit AI-generated content
10. Saves final version
```

**AI Prompt Template**:
```
You are a medical assistant helping to process doctor visit notes.
Analyze the following visit summary and extract structured information.

Patient Context:
- Age: [age]
- Medical Conditions: [conditions]
- Current Medications: [medications]
- Allergies: [allergies]

Visit Summary:
[user's text]

Please extract and return JSON with:
1. keyPoints: Array of important highlights (3-5 items)
2. actionItems: Array of tasks with due dates
3. medicationChanges: {
     new: Array of new medications
     stopped: Array of stopped medications
     modified: Array of modified medications
   }
4. followUpRequired: Boolean
5. followUpDate: Date (if mentioned)
6. followUpInstructions: String
7. urgencyLevel: "low" | "medium" | "high" | "urgent"
8. riskFactors: Array of potential health concerns
9. recommendations: Array of care suggestions

Be concise, accurate, and focus on actionable information.
```

**AI Response Structure**:
```typescript
{
  keyPoints: [
    "Blood pressure improved to 120/80",
    "Patient reports better energy levels",
    "Lab results show improved kidney function"
  ],
  actionItems: [
    {
      task: "Increase Lisinopril to 10mg daily",
      dueDate: "2025-03-16",
      priority: "high"
    },
    {
      task: "Schedule follow-up appointment",
      dueDate: "2025-06-15",
      priority: "medium"
    }
  ],
  medicationChanges: {
    new: [],
    stopped: [],
    modified: [
      {
        name: "Lisinopril",
        previousDosage: "5mg daily",
        newDosage: "10mg daily",
        reason: "Blood pressure control"
      }
    ]
  },
  followUpRequired: true,
  followUpDate: "2025-06-15",
  followUpInstructions: "Return in 3 months for blood pressure check",
  urgencyLevel: "low",
  riskFactors: [],
  recommendations: [
    "Continue current diet and exercise plan",
    "Monitor blood pressure at home weekly"
  ]
}
```

#### 3.4.3 Visit Types

**Visit Type Categories**:

| Type | Description | Typical Duration | Common Outcomes |
|------|-------------|------------------|-----------------|
| **Scheduled** | Regular planned appointment | 30-60 min | Routine care, medication adjustments |
| **Walk-in** | Unscheduled visit | 15-30 min | Acute issues, minor concerns |
| **Emergency** | Urgent medical need | Variable | Immediate treatment, hospitalization |
| **Follow-up** | Post-treatment check | 15-30 min | Progress assessment, test results |
| **Consultation** | Specialist evaluation | 45-90 min | Diagnosis, treatment plan |
| **Telemedicine** | Virtual visit | 15-30 min | Remote consultation, prescription refills |

**Visit Type Selection Impact**:
- Affects AI processing context
- Determines urgency assessment
- Influences family notification priority
- Impacts follow-up scheduling suggestions

#### 3.4.4 Family Sharing

**Sharing Configuration**:
```
┌─────────────────────────────────────────┐
│ Share Visit Summary with Family         │
├─────────────────────────────────────────┤
│ Share this visit summary?               │
│ ● Yes, share with family                │
│ ○ No, keep private                      │
│                                         │
│ Access Level:                           │
│ ● Full - All details                    │
│ ○ Summary Only - Key points only        │
│ ○ Restricted - Hide sensitive info      │
│ ○ None - Completely private             │
│                                         │
│ Share with:                             │
│ ☑ Michael (Full Access)                 │
│ ☑ Sarah (View Only)                     │
│ ☐ Robert (Emergency Only)               │
│                                         │
│ Restrict Fields:                        │
│ ☐ Hide medication changes               │
│ ☐ Hide risk factors                     │
│ ☐ Hide recommendations                  │
│ ☐ Hide action items                     │
│                                         │
│ [Cancel] [Save & Share]                 │
└─────────────────────────────────────────┘
```

**Access Levels**:

1. **Full**: All details visible
   - Complete visit summary
   - AI-processed insights
   - Action items
   - Medication changes
   - Risk factors
   - Recommendations

2. **Summary Only**: Key points only
   - Key highlights
   - Follow-up requirements
   - General outcome
   - No detailed medical information

3. **Restricted**: Hide sensitive information
   - Basic visit information
   - Excludes specific fields
   - User-configurable restrictions
   - Maintains privacy

4. **None**: Completely private
   - Not shared with family
   - Patient-only access
   - No notifications sent

**Family Notification**:
```
Subject: Dorothy shared a visit summary from Dr. Johnson

Hi Michael,

Dorothy has shared a summary from her recent visit with 
Dr. Johnson on March 15, 2025.

Key Points:
• Blood pressure improved to 120/80
• Patient reports better energy levels
• Lab results show improved kidney function

Action Items:
• Increase Lisinopril to 10mg daily (by March 16)
• Schedule follow-up appointment (by June 15)

Follow-up Required: Yes, in 3 months

[View Full Summary] [View Action Items]

This visit was marked as: Low urgency
```

#### 3.4.5 Action Item Management

**Action Item Dashboard**:
```
┌─────────────────────────────────────────┐
│ Action Items from Visits                │
├─────────────────────────────────────────┤
│ Overdue (1):                            │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠ Schedule follow-up with Dr. Smith│ │
│ │   Due: March 10, 2025               │ │
│ │   From: Visit on Feb 10             │ │
│ │   [Mark Complete] [Reschedule]      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Due Soon (2):                           │
│ ┌─────────────────────────────────────┐ │
│ │ Increase Lisinopril to 10mg         │ │
│ │   Due: March 16, 2025               │ │
│ │   From: Visit on March 15           │ │
│ │   [Mark Complete] [View Details]    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Get lab work done                   │ │
│ │   Due: March 20, 2025               │ │
│ │   From: Visit on March 15           │ │
│ │   [Mark Complete] [View Details]    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Upcoming (3):                           │
│ [Show All]                              │
│                                         │
│ Completed (12):                         │
│ [Show All]                              │
└─────────────────────────────────────────┘
```

**Action Item Workflow**:
```
1. AI extracts action item from visit
2. System creates task with due date
3. Appears on dashboard
4. Reminders sent:
   - 7 days before due date
   - 3 days before due date
   - 1 day before due date
   - On due date
5. User marks complete or reschedules
6. If overdue, escalates to family
7. Completion logged in audit trail
```

### 3.4.6 Data Model

**visit_summaries**:
```typescript
{
  id: string;
  patientId: string;
  visitDate: Date;
  providerName: string;
  providerId?: string;
  facilityName?: string;
  facilityId?: string;
  visitType: 'scheduled' | 'walk_in' | 'emergency' | 'follow_up' | 'consultation' | 'telemedicine';
  doctorSummary: string; // raw input
  inputMethod: 'text' | 'voice' | 'dictation';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  aiProcessedSummary?: {
    keyPoints: string[];
    actionItems: ActionItem[];
    medicationChanges: {
      new: MedicationChange[];
      stopped: MedicationChange[];
      modified: MedicationChange[];
    };
    followUpRequired: boolean;
    followUpDate?: Date;
    followUpInstructions?: string;
    urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
    riskFactors: string[];
    recommendations: string[];
  };
  sharedWithFamily: boolean;
  familyAccessLevel: 'full' | 'summary_only' | 'restricted' | 'none';
  restrictedFields?: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    oxygenSaturation?: number;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3.5 Healthcare Provider Management

### Purpose
Maintain comprehensive directory of healthcare providers with Google Places integration.

### Core Features

#### 3.5.1 Provider Search (Google Places API)

**Search Workflow**:
```
1. User enters provider name or specialty
2. System queries Google Places API
3. Results display with:
   - Provider name
   - Specialty (if available)
   - Address
   - Phone number
   - Rating and reviews
   - Distance from patient
4. User selects provider
5. System auto-populates form
6. User can edit/enhance information
7. Saves to database
```

**Search UI**:
```
┌─────────────────────────────────────────┐
│ Search Healthcare Providers             │
├─────────────────────────────────────────┤
│ Search: [Dr. Sarah Johnson Cardiologist]│
│ Near: [Patient's Address] [📍]          │
│                                         │
│ Results:                                │
│ ┌─────────────────────────────────────┐ │
│ │ Dr. Sarah Johnson                   │ │
│ │ ⭐ 4.8 (127 reviews)                │ │
│ │ Cardiology                          │ │
│ │ 123 Medical Plaza, Suite 200        │ │
│ │ 2.3 miles away                      │ │
│ │ (555) 123-4567                      │ │
│ │ [Select Provider]                   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Dr. Michael Chen                    │ │
│ │ ⭐ 4.6 (89 reviews)                 │ │
│ │ Cardiology                          │ │
│ │ 456 Health Center Dr                │ │
│ │ 5.1 miles away                      │ │
│ │ (555) 987-6543                      │ │
│ │ [Select Provider]                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Manual Entry Instead]                  │
└─────────────────────────────────────────┘
```

#### 3.5.2 Specialty Detection

**AI-Powered Specialty Inference**:
- Analyzes provider name and practice information
- Detects specialty from Google Places data
- Suggests specialty if not explicitly stated
- User can override AI suggestion

**Supported Specialties** (40+):
- Primary Care (Family Medicine, Internal Medicine, Pediatrics)
- Cardiology
- Dermatology
- Endocrinology
- Gastroenterology
- Hematology
- Nephrology
- Neurology
- Oncology
- Ophthalmology
- Orthopedics
- Otolaryngology (ENT)
- Pulmonology
- Rheumatology
- Urology
- Psychiatry
- Psychology
- Physical Therapy
- Occupational Therapy
- Speech Therapy
- Dentistry
- Optometry
- Nutrition/Dietitian
- And more...

#### 3.5.3 Primary Care Provider (PCP) Designation

**Purpose**: Mark and quickly access primary care physician

**Features**:
- Only one PCP per patient
- Visual badge on provider card
- Quick access from dashboard
- Auto-suggest for appointments
- Priority in provider list

**PCP Designation UI**:
```
┌─────────────────────────────────────────┐
│ Dr. Sarah Johnson                       │
│ ⭐ Primary Care Provider                │
├─────────────────────────────────────────┤
│ Specialty: Family Medicine              │
│ Phone: (555) 123-4567                   │
│ Address: 123 Medical Plaza              │
│                                         │
│ Last Visit: March 15, 2025              │
│ Next Appointment: June 15, 2025         │
│                                         │
│ [Schedule Appointment] [Remove PCP]     │
└─────────────────────────────────────────┘
```

#### 3.5.4 Provider Information

**Stored Data**:
```typescript
{
  id: string;
  patientId: string;
  name: string;
  specialty: string;
  subspecialty?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  placeId?: string; // Google Places ID
  rating?: number;
  reviewCount?: number;
  isPrimary: boolean; // PCP flag
  npiNumber?: string; // National Provider Identifier
  acceptedInsurance?: string[];
  languages?: string[];
  hospitalAffiliations?: string[];
  lastVisit?: Date;
  nextAppointment?: Date;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3.5.5 Provider Management

**Provider List View**:
```
┌─────────────────────────────────────────┐
│ Healthcare Providers                    │
├─────────────────────────────────────────┤
│ [+ Add Provider] [Search]               │
│                                         │
│ Primary Care:                           │
│ ┌─────────────────────────────────────┐ │
│ │ ⭐ Dr. Sarah Johnson                │ │
│ │    Family Medicine                  │ │
│ │    Last visit: March 15, 2025       │ │
│ │    [View] [Schedule]                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Specialists (5):                        │
│ ┌─────────────────────────────────────┐ │
│ │ Dr. Michael Chen - Cardiology       │ │
│ │ Last visit: Feb 10, 2025            │ │
│ │ [View] [Schedule]                   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Dr. Emily Rodriguez - Endocrinology │ │
│ │ Next: April 5, 2025                 │ │
│ │ [View] [Schedule]                   │ │
│ └─────────────────────────────────────┘ │
│ [Show All]                              │
│                                         │
│ Other Providers (3):                    │
│ [Show All]                              │
└─────────────────────────────────────────┘
```

---

## 3.6 Notification System

### Purpose
Multi-channel communication for reminders, alerts, and family coordination.

### Core Features

#### 3.6.1 Notification Channels

**Email** (SendGrid):
- Reliable delivery
- Rich HTML formatting
- Attachment support
- Delivery tracking
- Bounce handling
- Unsubscribe management

**SMS** (Twilio):
- Text message delivery
- Character limit: 160
- Delivery confirmation
- Opt-out handling
- International support
- Cost per message

**Push Notifications** (Firebase Cloud Messaging):
- iOS, Android, Web support
- Real-time delivery
- Badge counts
- Sound and vibration
- Action buttons
- Deep linking

**In-App Notifications**:
- Real-time updates
- Notification center
- Badge indicators
- Mark as read
- Archive/delete
- Notification history

#### 3.6.2 Notification Types

**Appointment Reminders**:
- 24 hours before (email, push)
- 2 hours before (email, SMS, push)
- 15 minutes before (push)
- Customizable timing
- Includes appointment details
- Transportation reminders

**Medication Reminders**:
- At scheduled time (push, SMS)
- Snooze reminders (push)
- Missed medication alerts (email, push)
- Daily adherence summary (email)
- Weekly adherence report (email)

**Transportation Coordination**:
- 72 hours before: Request sent to family
- 48 hours before: Reminder if unclaimed
- 24 hours before: Reminder to responsible person
- 2 hours before: Final reminder
- After appointment: Completion request

**Emergency Alerts**:
- Override quiet hours
- Multi-channel delivery
- Escalation if not acknowledged
- Priority delivery
- Family notification

**Family Coordination**:
- New appointment created
- Appointment modified/cancelled
- Medication missed
- Adherence declining
- Visit summary shared
- Action item overdue

**Adherence Alerts**:
- Single missed dose (info)
- 2 consecutive missed (warning)
- 3+ consecutive missed (critical)
- Adherence below 80% (weekly)
- Declining trend (monthly)

#### 3.6.3 Smart Features

**Quiet Hours**:
- User-defined quiet period
- Default: 10 PM - 8 AM
- Notifications queued during quiet hours
- Delivered at quiet hours end
- Emergency override option

**Multi-Channel Delivery**:
- Primary channel attempt
- Fallback to secondary if failed
- Retry logic with exponential backoff
- Delivery confirmation tracking
- Failure notifications

**Retry Logic**:
```
Attempt 1: Immediate
Attempt 2: 5 minutes later
Attempt 3: 15 minutes later
Attempt 4: 1 hour later
Attempt 5: 4 hours later
After 5 failures: Mark as failed, notify admin
```

**Preference Management**:
```
┌─────────────────────────────────────────┐
│ Notification Preferences                │
├─────────────────────────────────────────┤
│ Channels:                               │
│ ☑ Email                                 │
│ ☑ SMS (charges may apply)               │
│ ☑ Push Notifications                    │
│ ☑ In-App Notifications                  │
│                                         │
│ Notification Types:                     │
│ ☑ Appointment Reminders                 │
│ ☑ Medication Reminders                  │
│ ☑ Transportation Requests               │
│ ☑ Family Updates                        │
│ ☑ Adherence Alerts                      │
│ ☐ Marketing Communications              │
│                                         │
│ Quiet Hours:                            │
│ From: [10:00 PM] To: [8:00 AM]          │
│ ☑ Allow emergency notifications         │
│                                         │
│ Frequency:                              │
│ Daily Summary: [6:00 PM]                │
│ Weekly Report: [Sunday 9:00 AM]         │
│                                         │
│ [Save Preferences]                      │
└─────────────────────────────────────────┘
```

#### 3.6.4 Notification Templates

**Appointment Reminder** (24h):
```
Subject: Reminder: Appointment with Dr. Johnson tomorrow

Hi Dorothy,

This is a reminder about your upcoming appointment:

📅 Tomorrow, Monday, March 15, 2025
🕐 2:00 PM
📍 Dr. Johnson's Office
   123 Medical Plaza, Suite 200

👤 Provider: Dr. Sarah Johnson (Cardiologist)
⏱️ Duration: 1 hour

Transportation: Michael will pick you up at 1:30 PM

Preparation:
• Bring insurance card
• Bring medication list
• Arrive 15 minutes early

[View Details] [Add to Calendar] [Need to Reschedule?]
```

**Medication Reminder** (Push):
```
🔔 Time to take your medication

Lisinopril 10mg
Due: 8:00 AM (Morning)

[Take Now] [Snooze 30 min] [Skip]
```

**Missed Medication Alert** (Email):
```
Subject: Missed medication: Lisinopril

Hi Dorothy,

You missed your scheduled dose of Lisinopril at 8:00 AM today.

Medication: Lisinopril 10mg
Scheduled: 8:00 AM
Status: Missed (grace period expired at 8:30 AM)

What to do:
• If it's still morning, take it now
• If it's close to your next dose, skip this one
• Contact your doctor if you're unsure

Your family has been notified.

[Mark as Taken] [Contact Doctor] [View Medication]
```

**Family Adherence Alert**:
```
Subject: Dorothy's medication adherence needs attention

Hi Michael,

Dorothy has missed 3 consecutive doses of Lisinopril over 
the past 3 days. This may require your attention.

Recent Adherence:
• March 13: Missed morning dose
• March 14: Missed morning dose  
• March 15: Missed morning dose

Current 30-day adherence: 78% (down from 92%)

Suggested Actions:
• Check in with Dorothy
• Review medication schedule
• Consider setting up additional reminders
• Contact healthcare provider if pattern continues

[View Adherence Details] [Contact Dorothy]
```

### 3.6.5 Data Model

**notifications**:
```typescript
{
  id: string;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  type: NotificationType;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  message: string;
  data?: object; // Additional context
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
}
```

---

# 4. User Roles & Progression

## 4.1 Patient Role

**Primary Account Owner**

### Capabilities

**Full Data Control**:
- Create, read, update, delete all personal medical data
- Manage all medications and schedules
- Create and manage appointments
- Record visit summaries
- Manage healthcare providers and facilities

**Family Management**:
- Invite family members with customizable permissions
- Modify family member access levels
- Remove family member access
- View family activity audit log
- Configure family notification preferences

**Privacy Control**:
- Configure data sharing preferences
- Set visit summary sharing levels
- Control Google Calendar sync settings
- Manage notification preferences
- Export personal medical data

**Account Management**:
- Update profile information
- Change password/authentication
- Configure security settings
- Delete account (with confirmation)
- Download data archive

### Default Permissions
All permissions enabled by default for patient's own data.

### Onboarding Flow

```
Step 1: Account Creation
- Click "Get Started with Google"
- Google OAuth authentication
- Account automatically created
- Redirect to profile setup

Step 2: Profile Setup
- Personal Information:
  - Full name (pre-filled from Google)
  - Date of birth
  - Gender
  - Address
  - Phone number
  - Emergency contact
- Medical Information:
  - Medical conditions (multi-select)
  - Allergies (multi-select + custom)
  - Blood type (optional)
  - Height/weight (optional)
- Save profile

Step 3: Healthcare Provider Addition (Optional)
- "Add your primary care provider"
- Search or manual entry
- Mark as PCP
- Skip option available

Step 4: First Medication Entry (Optional)
- "Add your first medication"
- Search drug database
- Configure schedule
- Skip option available

Step 5: Dashboard Access
- Welcome message
- Quick start guide
- Feature highlights
- Dashboard displayed
```

---

## 4.2 Family Member Role (Full Access)

**Primary Caregiver**

### Capabilities

**Medical Management**:
- View all medical appointments and events
- Create new appointments
- Edit existing appointments
- Delete appointments (with patient notification)
- View all medications
- Add new medications
- Edit medication schedules
- Mark medications as taken (on behalf of patient)

**Coordination**:
- Claim transportation responsibilities
- Manage appointment logistics
- Coordinate with other family members
- Receive all notifications
- View visit summaries (if shared)

**Limited Restrictions**:
- Cannot delete patient account
- Cannot remove patient's primary caregiver status from others
- Cannot modify core patient profile (DOB, medical conditions)
- Requires patient approval for major changes

### Use Cases
- Spouse managing partner's care
- Adult child managing parent's healthcare
- Healthcare proxy or power of attorney
- Primary caregiver living with patient

### Onboarding Flow

```
Step 1: Receive Invitation
- Email with invitation link
- Click link

Step 2: Authentication
- Redirect to /family-invite/{token}
- Sign in with Google (or create account)
- Account created if new user

Step 3: Review Invitation
- Redirect to /invitation/{token}
- View patient name
- View access level (Full Access)
- Review permissions list
- Read patient's message (if any)

Step 4: Accept/Decline
- Click "Accept Invitation"
- Confirmation message
- Redirect to patient's dashboard

Step 5: Dashboard Access
- View patient's medical information
- Quick start guide for family members
- Feature highlights
- Begin managing care
```

---

## 4.3 Family Member Role (View Only)

**Supportive Family Member**

### Capabilities

**Read-Only Access**:
- View all medical appointments and events
- View medications and schedules
- View visit summaries (if shared)
- View healthcare providers
- View adherence statistics

**Limited Actions**:
- Claim transportation responsibilities
- Receive notifications about appointments
- Add comments/notes (if enabled)
- Export calendar for personal reference

### Restrictions
- Cannot create new data
- Cannot edit existing data
- Cannot delete any data
- Cannot modify patient profile
- Cannot manage other family members
- Cannot mark medications as taken

### Use Cases
- Extended family staying informed
- Adult children living far away
- Friends providing occasional support
- Family members wanting visibility without responsibility

### Onboarding Flow
Same as Full Access, but with different permissions displayed during invitation review.

---

## 4.4 Emergency Contact

**Special Access Level**

### Capabilities

**Emergency Access**:
- View-only access to critical information
- Receive emergency alerts
- Priority contact for urgent situations
- Time-limited emergency access grants

**Critical Information Access**:
- Current medications
- Allergies
- Medical conditions
- Emergency contacts
- Primary care provider
- Recent hospitalizations

### Restrictions
- No access to routine appointments
- No access to visit summaries
- No access to family coordination
- Cannot create or modify data
- Access only during emergencies or when explicitly granted

### Use Cases
- Neighbor for emergencies
- Distant family member
- Backup emergency contact
- Healthcare proxy (limited scope)

---

## 4.5 Permission Matrix

| Permission | Patient | Full Access | View Only | Emergency |
|------------|---------|-------------|-----------|-----------|
| **View Medical Data** | ✓ | ✓ | ✓ | ✓ (critical only) |
| **Create Appointments** | ✓ | ✓ | ✗ | ✗ |
| **Edit Appointments** | ✓ | ✓ | ✗ | ✗ |
| **Delete Appointments** | ✓ | ✓ | ✗ | ✗ |
| **Add Medications** | ✓ | ✓ | ✗ | ✗ |
| **Edit Medications** | ✓ | ✓ | ✗ | ✗ |
| **Mark Medication Taken** | ✓ | ✓ | ✗ | ✗ |
| **Claim Transportation** | ✓ | ✓ | ✓ | ✗ |
| **Invite Family** | ✓ | ✓* | ✗ | ✗ |
| **Remove Family** | ✓ | ✓* | ✗ | ✗ |
| **Change Access Levels** | ✓ | ✗ | ✗ | ✗ |
| **View Visit Summaries** | ✓ | ✓ (if shared) | ✓ (if shared) | ✗ |
| **Record Visits** | ✓ | ✓ | ✗ | ✗ |
| **Manage Providers** | ✓ | ✓ | ✗ | ✗ |
| **Export Data** | ✓ | ✓ | ✓ | ✗ |
| **Delete Account** | ✓ | ✗ | ✗ | ✗ |

*If granted `canManageFamily` permission

---

# 5. User Interface & Experience

## 5.1 Design Philosophy

### Core Principle: "Simplicity is Kindness"

Every design decision reduces cognitive load for stressed caregivers:
- **One-tap actions** for common tasks
- **Smart defaults** that save time
- **Progressive disclosure** of complexity
- **Clear visual hierarchy** for scanning
- **Gentle guidance** at decision points

### Visual Direction: "Calm Confidence"

Balancing professional healthcare credibility with warm, family-centered design:
- **Modern but Accessible**: Contemporary design without intimidation
- **Clean but Warm**: Spacious layouts with friendly touches
- **Professional but Friendly**: Medical credibility with human warmth
- **Organized but Flexible**: Structure that adapts to user needs

---

## 5.2 Color System

### Primary Palette

**Trustworthy Blue** (#4A90E2):
- Primary brand color
- Logo, CTAs, headers
- Trust elements
- Medical credibility
- Tailwind: `primary-500`

**Nurturing Teal** (#5DBEAA):
- Success states
- Health indicators
- Medication tracking
- Positive progress
- Tailwind: `secondary-500`

**Warm Coral** (#FF8B7B):
- Important notifications (non-error)
- Family features
- Warm moments
- Attention without anxiety
- Tailwind: `accent-500`

**Soft Gold** (#F4C542):
- Achievements
- Milestones
- Premium features
- Encouragement
- Tailwind: `gold-500`

### Semantic Colors

**Success** (#22C55E):
- Completed actions
- Positive progress
- Medication taken
- Goals achieved

**Warning** (#F59E0B):
- Caution needed
- Upcoming deadlines
- Attention required
- Review needed

**Error** (#EF4444):
- Urgent issues
- Missed medications
- Critical alerts
- Errors

**Info** (#3B82F6):
- Informational messages
- Tips and guidance
- System updates
- Help content

### Neutral Palette

**Warm Grays**:
- `gray-50`: #FAFAFA (Primary backgrounds)
- `gray-100`: #F5F5F5 (Card backgrounds)
- `gray-200`: #E5E5E5 (Borders, dividers)
- `gray-300`: #D4D4D4 (Disabled text)
- `gray-400`: #A3A3A3 (Placeholder text)
- `gray-500`: #737373 (Secondary text)
- `gray-600`: #525252 (Body text)
- `gray-700`: #404040 (Emphasis text)
- `gray-800`: #262626 (Headers)
- `gray-900`: #171717 (Maximum contrast)

### Accessibility

**WCAG 2.1 AA Compliance**:
- Normal text: 4.5:1 minimum contrast
- Large text: 3:1 minimum contrast
- UI components: 3:1 minimum contrast
- All color combinations tested

**Passing Combinations**:
- `gray-900` on `white`: 16.1:1 ✓
- `gray-800` on `white`: 12.6:1 ✓
- `gray-700` on `white`: 9.7:1 ✓
- `primary-700` on `white`: 7.2:1 ✓

---

## 5.3 Typography

### Font Family

**Primary: Inter** (Humanist Sans-Serif)
- Excellent readability at all sizes
- Warm personality without sacrificing professionalism
- Optimized for digital screens
- Extensive weight range for hierarchy
- Open source and widely available

**Fallback Stack**:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 
             'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 
             'Cantarell', sans-serif;
```

### Type Scale

Based on 1.25 ratio (Major Third) for harmonious progression:

| Element | Size | Line Height | Weight | Usage |
|---------|------|-------------|--------|-------|
| **Display XL** | 60px | 1.1 | 800 | Hero sections |
| **Display L** | 48px | 1.15 | 800 | Major headers |
| **H1** | 36px | 1.2 | 700 | Page titles |
| **H2** | 30px | 1.25 | 700 | Section headers |
| **H3** | 24px | 1.3 | 600 | Subsections |
| **H4** | 20px | 1.4 | 600 | Card headers |
| **H5** | 18px | 1.4 | 600 | Small sections |
| **H6** | 16px | 1.5 | 600 | List headers |
| **Body Large** | 18px | 1.6 | 400 | Intro paragraphs |
| **Body Regular** | 16px | 1.5 | 400 | Default text |
| **Body Small** | 14px | 1.5 | 400 | Secondary info |
| **Caption** | 12px | 1.4 | 400 | Metadata |

### Font Weights

- **Light** (300): Large display text only
- **Regular** (400): Body text, default
- **Medium** (500): Emphasis, labels, buttons
- **Semibold** (600): Subheadings, important UI
- **Bold** (700): Headings, strong emphasis
- **Extrabold** (800): Display headings only

---

## 5.4 Spacing & Layout

### Base Unit System

**8px Grid System**: All spacing uses multiples of 8px

| Token | Size | Usage |
|-------|------|-------|
| `0` | 0px | None |
| `1` | 4px | Micro spacing |
| `2` | 8px | Base unit |
| `3` | 12px | Compact spacing |
| `4` | 16px | Default spacing |
| `5` | 20px | Comfortable spacing |
| `6` | 24px | Section spacing |
| `8` | 32px | Large spacing |
| `10` | 40px | XL spacing |
| `12` | 48px | XXL spacing |
| `16` | 64px | Section breaks |
| `20` | 80px | Major sections |
| `24` | 96px | Page sections |

### Container Padding

**Mobile**: 16px (1rem)
**Tablet**: 24px (1.5rem)
**Desktop**: 32px (2rem)

### Component Spacing

**Buttons**:
- Padding: 12px vertical, 16px horizontal
- Gap between buttons: 8px horizontal, 12px vertical
- Icon-to-text gap: 8px

**Forms**:
- Label-to-input gap: 4px
- Input-to-helper-text gap: 4px
- Between form fields: 16px
- Between form sections: 24px

**Cards**:
- Internal padding: 16px (mobile), 24px (desktop)
- Gap between cards: 16px
- Card-to-section gap: 24px

---

## 5.5 Component Patterns

### Buttons

**Primary Button**:
- Background: `primary-600`
- Text: `white`
- Padding: `12px 16px`
- Border Radius: `8px`
- Font: Medium (500), 14px
- Hover: `primary-700`
- Active: `primary-800`
- Focus: 2px ring `primary-500`

**Secondary Button**:
- Background: `gray-200`
- Text: `gray-900`
- Same sizing as primary
- Hover: `gray-300`
- Active: `gray-400`

**Danger Button**:
- Background: `red-600`
- Text: `white`
- Used for destructive actions
- Hover: `red-700`
- Active: `red-800`

**Ghost Button**:
- Background: Transparent
- Text: `primary-600`
- Hover: `primary-50`
- Active: `primary-100`

### Cards

**Basic Card**:
- Background: `white`
- Border: 1px solid `gray-200`
- Border Radius: `12px`
- Padding: `24px` (desktop), `16px` (mobile)
- Shadow: `shadow-sm`

**Interactive Card**:
- Hover: Border `primary-600`, shadow-md, translate-y -2px
- Active: Translate-y 0, shadow-sm
- Transition: 200ms

**Status Cards**:
- Success: `green-50` background, `green-200` border
- Warning: `yellow-50` background, `yellow-200` border
- Error: `red-50` background, `red-200` border
- Info: `blue-50` background, `blue-200` border

### Forms

**Text Input**:
- Background: `white`
- Border: 1px solid `gray-300`
- Padding: `12px 16px`
- Border Radius: `8px`
- Min Height: 44px
- Focus: Border `primary-600`, ring `primary-500`
- Error: Border `red-300`, ring `red-500`

**Select Dropdown**:
- Same styling as text input
- Chevron icon: `gray-400`, 20px
- Padding-right: 40px for icon

**Checkbox/Radio**:
- Size: 20x20px
- Border: 2px solid `gray-300`
- Checked: Background `primary-600`
- Focus: Ring `primary-500`

**Toggle Switch**:
- Width: 44px, Height: 24px
- Border Radius: 12px (pill)
- Knob: 20px diameter, white
- Off: Background `gray-300`
- On: Background `primary-600`

### Navigation

**Mobile Bottom Navigation**:
- Background: `white`
- Border Top: 1px solid `gray-200`
- Shadow: `0 -2px 10px rgba(0,0,0,0.1)`
- Position: Fixed bottom
- Z-index: 9999
- Safe area support for iOS notch

**Nav Items**:
- Padding: 8px
- Icon: 20px
- Text: 12px, Medium (500)
- Gap: 4px (icon to text)
- Inactive: `gray-400`
- Active: `primary-600`, background `primary-50`

**Desktop Header**:
- Background: `white`
- Border Bottom: 1px solid `gray-200`
- Height: 64px
- Padding: 0 32px
- Shadow: `shadow-sm`
- Position: Sticky top

### Alerts & Notifications

**Alert Banner**:
- Border Radius: `8px`
- Padding: `16px`
- Icon: 20px
- Icon-to-text gap: 12px

**Toast Notification**:
- Background: `white`
- Border: 1px solid `gray-200`
- Border Radius: `8px`
- Padding: `16px`
- Shadow: `shadow-lg`
- Max Width: 400px
- Position: Fixed top-right or bottom-right
- Animation: Slide in from right, fade out

### Loading States

**Spinner**:
- Small: 16px
- Medium: 24px
- Large: 32px
- XL: 48px
- Color: `primary-600`
- Border: 2px
- Animation: Spin

**Skeleton Loader**:
- Background: `gray-200`
- Animation: Pulse
- Border Radius: Matches content

**Progress Bar**:
- Background: `gray-200`
- Fill: `primary-600`
- Height: 8px
- Border Radius: Full
- Transition: 300ms

---

## 5.6 Responsive Design

### Breakpoints

**Mobile-First Approach**:
- `sm`: 640px (Small tablets, large phones)
- `md`: 768px (Tablets)
- `lg`: 1024px (Small laptops)
- `xl`: 1280px (Desktops)
- `2xl`: 1536px (Large desktops)

### Layout Patterns

**Container Widths**:
- Mobile: 100%, padding 16px
- Tablet: 768px max, padding 24px
- Desktop: 1024px max, padding 32px
- Large: 1280px max, padding 32px

**Grid System**:
```html
<!-- 2 columns mobile, 3 tablet, 4 desktop -->
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

**Sidebar Layout**:
```html
<!-- Stack on mobile, side-by-side on desktop -->
<div class="flex flex-col lg:flex-row gap-6">
  <aside class="w-full lg:w-1/4">Sidebar</aside>
  <main class="w-full lg:w-3/4">Main</main>
</div>
```

### Mobile Considerations

**Touch Targets**:
- Minimum: 44x44px
- Spacing between targets: 8px minimum
- Increase padding on mobile

**Safe Areas**:
```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

**Performance**:
- Lazy load images
- Reduce animation complexity
- Optimize for slower connections
- Code splitting by route

---

## 5.7 Iconography

### Icon System

**Library**: Lucide React
- Consistent stroke weight
- Outline style
- Optimized for web
- React components

### Icon Sizes

| Size | Pixels | Usage |
|------|--------|-------|
| `xs` | 12px | Inline with small text |
| `sm` | 16px | Inline with body text |
| `md` | 20px | Default UI icons |
| `lg` | 24px | Prominent icons |
| `xl` | 32px | Feature icons |
| `2xl` | 48px | Hero icons |

### Common Icons

**Navigation**:
- Home: `Heart`
- Medications: `Pill`
- Calendar: `Calendar`
- Profile: `User`
- Family: `Users`

**Actions**:
- Add: `Plus`
- Edit: `Pencil`
- Delete: `Trash2`
- Save: `Check`
- Cancel: `X`

**Status**:
- Success: `CheckCircle`
- Warning: `AlertTriangle`
- Error: `AlertCircle`
- Info: `Info`

**Medical**:
- Medication: `Pill`
- Appointment: `Calendar`
- Doctor: `Stethoscope`
- Hospital: `Building`
- Lab: `Activity`

---

# 6. Technical Architecture

## 6.1 Frontend Architecture

### Technology Stack

**Core Framework**:
- React 18 with TypeScript
- Vite for build tooling
- React Router for navigation
- Tailwind CSS for styling

**State Management**:
- React Context API for global state
- Local state with useState/useReducer
- No external state management library

**Key Contexts**:

**AuthContext**:
```typescript
{
  user: FirebaseUser | null;
  userProfile: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

**FamilyContext**:
```typescript
{
  userRole: 'patient' | 'family_member';
  patientsWithAccess: PatientAccess[];
  activePatientId: string;
  activePatientAccess: PatientAccess;
  permissions: Permissions;
  switchPatient: (patientId: string) => void;
  refreshFamilyAccess: () => Promise<void>;
}
```

**CalendarContext**:
```typescript
{
  events: MedicalEvent[];
  isLoading: boolean;
  error: Error | null;
  refreshEvents: () => Promise<void>;
  createEvent: (event: MedicalEvent) => Promise<void>;
  updateEvent: (id: string, event: Partial<MedicalEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}
```

### API Service Layer

**Centralized API Client**:
- Automatic authentication token injection
- Request/response interceptors
- Error handling and retry logic
- Rate limiting protection
- Request debouncing

**API Structure**:
```typescript
// client/src/lib/api.ts
class ApiClient {
  private baseURL: string;
  private authToken: string | null;
  
  async request<T>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<T>;
  
  async get<T>(endpoint: string): Promise<T>;
  async post<T>(endpoint: string, data: any): Promise<T>;
  async put<T>(endpoint: string, data: any): Promise<T>;
  async delete<T>(endpoint: string): Promise<T>;
}
```

**Specialized API Modules**:
- `drugApi.ts`: OpenFDA integration
- `googlePlacesApi.ts`: Google Places integration
- `medicationCalendarApi.ts`: Medication calendar operations
- `unifiedMedicationApi.ts`: Unified medication API
- `calendarApi.ts`: Medical calendar operations

### Routing Structure

```
/ - Landing page
/dashboard - Main hub
/medications - Medication management
/calendar - Medical calendar
/profile - Patient profile
/family/invite - Family invitation
/family-invite/{token} - Family member auth
/invitation/{token} - Accept invitation
/visit-summaries - Visit recording
/providers - Healthcare providers
/facilities - Medical facilities
/settings - User settings
```

### Component Organization

```
client/src/
├── components/
│   ├── common/           # Reusable UI components
│   ├── medication/       # Medication-specific components
│   ├── calendar/         # Calendar components
│   ├── family/           # Family access components
│   └── providers/        # Provider management components
├── contexts/             # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── pages/                # Page components
├── types/                # TypeScript types
└── utils/                # Utility functions
```

---

## 6.2 Backend Architecture

### Technology Stack

**Core Platform**:
- Firebase Cloud Functions (Node.js)
- Express.js for API routing
- TypeScript for type safety
- Firestore for database

**External Services**:
- SendGrid for email
- Twilio for SMS
- Google AI (Gemini) for visit processing
- Google Places API for provider search
- OpenFDA API for drug information

### Service Architecture

**Single Responsibility Services**:

1. **MedicationCommandService**:
   - CRUD operations only
   - Manages medication_commands collection
   - No business logic beyond data access

2. **MedicationEventService**:
   - Event processing only
   - Creates and queries medication_events
   - Immutable event log management

3. **MedicationNotificationService**:
   - Notification sending only
   - Multi-channel delivery
   - Retry logic

4. **MedicationTransactionManager**:
   - ACID transaction management
   - Distributed transaction support
   - Automatic rollback on failure

5. **MedicationOrchestrator**:
   - Service coordination only
   - Workflow orchestration
   - No direct data access

**Service Interaction**:
```
API Endpoint
    ↓
MedicationOrchestrator
    ↓
┌───────────────┬──────────────────┬─────────────────┐
↓               ↓                  ↓                 ↓
CommandService  EventService  NotificationService  TransactionManager
    ↓               ↓                  ↓                 ↓
Firestore      Firestore         SendGrid/Twilio    Firestore
```

### API Endpoints

**Consolidated Endpoints** (8 unified):

**Authentication**:
- `GET /auth/profile`
- `PUT /auth/profile`

**Medications**:
- `GET /medications?patientId={id}`
- `POST /medications`
- `PUT /medications/{id}`
- `DELETE /medications/{id}`

**Medication Calendar**:
- `GET /medication-calendar/events/{patientId}/today-buckets`
- `POST /medication-calendar/events/{eventId}/taken`
- `POST /medication-calendar/events/{eventId}/snooze`
- `POST /medication-calendar/events/{eventId}/skip`
- `GET /medication-calendar/adherence`

**Family Access**:
- `GET /family-access`
- `POST /invitations/send`
- `POST /invitations/accept/{token}`
- `GET /invitations/{token}`
- `PATCH /family-access/{id}/access-level`
- `DELETE /family-access/{id}`

**Medical Events**:
- `GET /medical-events/{patientId}`
- `POST /medical-events`
- `PUT /medical-events/{id}`
- `DELETE /medical-events/{id}`

**Visit Summaries**:
- `GET /visit-summaries/{patientId}`
- `POST /visit-summaries`
- `POST /audio/transcribe`

**Healthcare Providers**:
- `GET /healthcare/providers/{patientId}`
- `POST /healthcare/providers`
- `PUT /healthcare/providers/{id}`
- `DELETE /healthcare/providers/{id}`

**Drug Search**:
- `GET /drugs/search?q={query}`
- `GET /drugs/{rxcui}`
- `GET /drugs/{rxcui}/interactions`

### Scheduled Functions

**Medication System**:
- `missedMedicationDetector`: Runs every 15 minutes
- `medicationReminderScheduler`: Runs every 5 minutes
- `medicationEventLifecycleManager`: Runs daily at 2 AM

**Notifications**:
- `appointmentReminderScheduler`: Runs every hour
- `familyMedicationNotificationProcessor`: Runs every 30 minutes

**Maintenance**:
- `dataCleanup`: Runs weekly
- `auditLogArchival`: Runs monthly

---

## 6.3 Database Architecture

### Firestore Collections

**Core Collections** (11):

1. **users**: User accounts and profiles
2. **medication_commands**: Medication definitions (source of truth)
3. **medication_events**: Immutable event log
4. **medication_calendar_events**: Daily scheduled instances
5. **family_calendar_access**: Family permissions
6. **medical_events**: Calendar appointments
7. **visit_summaries**: Doctor visit records
8. **healthcare_providers**: Provider directory
9. **medical_facilities**: Facility directory
10. **notifications**: Notification log
11. **audit_logs**: Security audit trail

### Indexing Strategy

**Composite Indexes**:
```json
{
  "collectionGroup": "medication_calendar_events",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "patientId", "order": "ASCENDING" },
    { "fieldPath": "scheduledDateTime", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "medical_events",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "patientId", "order": "ASCENDING" },
    { "fieldPath": "eventType", "order": "ASCENDING" },
    { "fieldPath": "startDateTime", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "family_calendar_access",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "familyMemberId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "lastAccessAt", "order": "DESCENDING" }
  ]
}
```

### Security Rules

**Firestore Rules**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Medication commands: patient or family with permissions
    match /medication_commands/{medicationId} {
      allow read: if isPatientOrFamily(resource.data.patientId);
      allow create: if isPatientOrFamilyWithPermission(
        request.resource.data.patientId, 'canCreate'
      );
      allow update: if isPatientOrFamilyWithPermission(
        resource.data.patientId, 'canEdit'
      );
      allow delete: if isPatientOrFamilyWithPermission(
        resource.data.patientId, 'canDelete'
      );
    }
    
    // Family access: patient or family member
    match /family_calendar_access/{accessId} {
      allow read: if request.auth.uid == resource.data.patientId
                  || request.auth.uid == resource.data.familyMemberId;
      allow create: if request.auth.uid == request.resource.data.patientId;
      allow update, delete: if request.auth.uid == resource.data.patientId;
    }
    
    // Helper functions
    function isPatientOrFamily(patientId) {
      return request.auth.uid == patientId
          || exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + patientId));
    }
    
    function isPatientOrFamilyWithPermission(patientId, permission) {
      return request.auth.uid == patientId
          || (exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + patientId))
              && get(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + patientId)).data.permissions[permission] == true);
    }
  }
}
```

---

## 6.4 External Integrations

### Google AI (Gemini Pro)

**Purpose**: Visit summary processing

**API Configuration**:
```typescript
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
  model: "gemini-pro",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_MEDICAL,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
});
```

**Rate Limits**:
- 60 requests per minute
- 1,500 requests per day
- Retry with exponential backoff

### OpenFDA API

**Purpose**: Drug information and interaction checking

**Endpoints Used**:
- `/drug/label.json`: Drug labels and information
- `/drug/event.json`: Adverse events
- `/drug/ndc.json`: National Drug Code directory

**Rate Limits**:
- 240 requests per minute
- 120,000 requests per day
- No authentication required

### Google Places API

**Purpose**: Healthcare provider search

**API Configuration**:
```typescript
const placesService = new google.maps.places.PlacesService(map);
placesService.textSearch({
  query: searchQuery,
  type: 'doctor',
  location: userLocation,
  radius: 50000, // 50km
}, callback);
```

**Rate Limits**:
- Pay-per-use pricing
- Caching recommended
- Fallback to manual entry

### SendGrid

**Purpose**: Email delivery

**Configuration**:
```typescript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: recipientEmail,
  from: 'noreply@fammedicalcare.com',
  subject: emailSubject,
  html: emailBody,
  trackingSettings: {
    clickTracking: { enable: true },
    openTracking: { enable: true },
  },
};
```

**Rate Limits**:
- Based on plan tier
- Retry failed sends
- Track delivery status

### Twilio

**Purpose**: SMS delivery

**Configuration**:
```typescript
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

client.messages.create({
  body: messageBody,
  from: twilioPhoneNumber,
  to: recipientPhone,
});
```

**Rate Limits**:
- Based on account tier
- Cost per message
- Delivery confirmation

---

# 7. Data Flow & Logic

## 7.1 Authentication Flow

```
User Action: Click "Sign in with Google"
    ↓
Frontend: Redirect to Google OAuth
    ↓
Google: User authenticates
    ↓
Google: Returns to app with auth code
    ↓
Firebase Auth: Exchanges code for token
    ↓
Frontend: Receives Firebase user object
    ↓
Backend: Check if user exists in Firestore
    ↓
If New User:
    ├─ Create user document
    ├─ Set userType: 'patient' (default)
    └─ Redirect to onboarding
    ↓
If Existing User:
    ├─ Load user profile
    ├─ Check family_calendar_access
    │   ├─ If access found → userType: 'family_member'
    │   └─ If no access → userType: 'patient'
    ├─ Load active patient data
    └─ Redirect to dashboard
    ↓
AuthContext: Update state
    ↓
FamilyContext: Determine role and permissions
    ↓
Dashboard: Render appropriate view
```

---

## 7.2 Medication Action Flows

### Take Medication Flow

```
User Action: Click "Take" button
    ↓
Frontend: Show loading state
    ↓
API Call: POST /medication-calendar/events/{eventId}/taken
    ↓
Backend: MedicationOrchestrator.markMedicationTaken()
    ↓
Validation:
    ├─ Verify user has permission
    ├─ Verify event exists
    ├─ Verify event is scheduled
    └─ Verify not already taken
    ↓
Transaction Start: MedicationTransactionManager
    ↓
Step 1: Update medication_calendar_events
    ├─ Set status: 'taken'
    ├─ Set takenBy: userId
    ├─ Set actualTakenDateTime: now
    └─ Calculate if late (past grace period)
    ↓
Step 2: Create medication_events entry
    ├─ eventType: 'taken'
    ├─ scheduledDateTime: original time
    ├─ actualDateTime: now
    └─ takenBy: userId
    ↓
Step 3: Update adherence statistics
    ├─ Increment taken count
    ├─ Recalculate adherence rate
    └─ Update last taken timestamp
    ↓
Transaction Commit
    ↓
Post-Transaction:
    ├─ Trigger notification service
    │   └─ Notify family if configured
    ├─ Schedule next dose (if recurring)
    └─ Update calendar sync (if enabled)
    ↓
Response: Success with updated event
    ↓
Frontend: Update UI
    ├─ Move to "Taken" section
    ├─ Show success message
    ├─ Display 30-second undo button
    └─ Update adherence display
    ↓
After 30 seconds: Remove undo option
```

### Snooze Medication Flow

```
User Action: Click "Snooze" → Select duration
    ↓
Frontend: Show snooze confirmation
    ↓
API Call: POST /medication-calendar/events/{eventId}/snooze
    ↓
Backend: MedicationOrchestrator.snoozeMedication()
    ↓
Validation:
    ├─ Verify user has permission
    ├─ Verify event exists
    ├─ Verify event is scheduled
    ├─ Verify snooze count < 3
    └─ Verify snooze duration valid
    ↓
Transaction Start
    ↓
Step 1: Update medication_calendar_events
    ├─ Add to snoozeHistory array
    │   ├─ snoozedAt: now
    │   ├─ snoozeMinutes: selected duration
    │   └─ reason: optional
    ├─ Increment snooze count
    └─ Keep status: 'scheduled'
    ↓
Step 2: Create medication_events entry
    ├─ eventType: 'snoozed'
    ├─ snoozeMinutes: duration
    └─ reason: optional
    ↓
Step 3: Schedule reminder
    ├─ Calculate reminder time (now + duration)
    └─ Create notification job
    ↓
Transaction Commit
    ↓
Response: Success with new reminder time
    ↓
Frontend: Update UI
    ├─ Show "Snoozed until [time]"
    ├─ Update time bucket if needed
    └─ Display snooze count (e.g., "2/3 snoozes used")
    ↓
At Reminder Time: Send notification
```

### Skip Medication Flow

```
User Action: Click "Skip" → Select reason
    ↓
Frontend: Show skip confirmation dialog
    ↓
User: Confirms skip with reason
    ↓
API Call: POST /medication-calendar/events/{eventId}/skip
    ↓
Backend: MedicationOrchestrator.skipMedication()
    ↓
Validation:
    ├─ Verify user has permission
    ├─ Verify event exists
    ├─ Verify event is scheduled
    └─ Verify reason provided
    ↓
Transaction Start
    ↓
Step 1: Update medication_calendar_events
    ├─ Set status: 'skipped'
    ├─ Add to skipHistory array
    │   ├─ skippedAt: now
    │   ├─ reason: selected reason
    │   └─ notes: optional
    └─ Mark as intentional skip
    ↓
Step 2: Create medication_events entry
    ├─ eventType: 'skipped'
    ├─ reason: selected reason
    └─ notes: optional
    ↓
Step 3: Update adherence statistics
    ├─ Increment skipped count
    ├─ Recalculate adherence rate
    └─ Check for skip patterns
    ↓
Step 4: Notify family (if configured)
    ├─ Send skip notification
    └─ Include reason
    ↓
Transaction Commit
    ↓
Response: Success
    ↓
Frontend: Update UI
    ├─ Move to "Skipped" section
    ├─ Show skip reason
    └─ Update adherence display
```

---

## 7.3 Family Invitation Flow

```
Patient Action: Navigate to Family Management
    ↓
Patient: Click "Invite Family Member"
    ↓
Frontend: Display invitation form
    ↓
Patient: Fill form
    ├─ Name
    ├─ Email
    ├─ Relationship
    ├─ Access level (Full/View Only/Limited/Emergency)
    └─ Optional personal message
    ↓
Patient: Click "Send Invitation"
    ↓
Frontend: Validate form
    ↓
API Call: POST /invitations/send
    ↓
Backend: InvitationService.sendInvitation()
    ↓
Validation:
    ├─ Verify patient is authenticated
    ├─ Verify email not already invited
    ├─ Verify email not already has access
    └─ Verify valid access level
    ↓
Transaction Start
    ↓
Step 1: Create family_calendar_access record
    ├─ patientId: current patient
    ├─ familyMemberEmail: provided email
    ├─ accessLevel: selected level
    ├─ permissions: based on access level
    ├─ status: 'pending'
    ├─ invitationToken: UUID v4
    ├─ invitationExpiresAt: now + 7 days
    └─ invitedAt: now
    ↓
Step 2: Create audit log entry
    ├─ eventType: 'invitation_sent'
    ├─ patientId: current patient
    └─ details: { email, accessLevel }
    ↓
Transaction Commit
    ↓
Step 3: Send invitation email (SendGrid)
    ├─ To: family member email
    ├─ Subject: "[Patient] invited you to FamMedicalCare"
    ├─ Body: Invitation details + link
    ├─ Link: /family-invite/{token}
    └─ Track delivery
    ↓
Response: Success
    ↓
Frontend: Show success message
    ├─ "Invitation sent to [email]"
    └─ Update invitation list (status: pending)

--- Family Member Side ---

Family Member: Receives email
    ↓
Family Member: Clicks invitation link
    ↓
Frontend: Redirect to /family-invite/{token}
    ↓
Frontend: Check if authenticated
    ↓
If Not Authenticated:
    ├─ Show "Sign in with Google" button
    ├─ Store token in session
    └─ After auth, redirect to /invitation/{token}
    ↓
If Authenticated:
    └─ Redirect to /invitation/{token}
    ↓
API Call: GET /invitations/{token}
    ↓
Backend: InvitationService.getInvitation()
    ↓
Validation:
    ├─ Verify token exists
    ├─ Verify not expired
    ├─ Verify status is 'pending'
    └─ Verify not already accepted
    ↓
Response: Invitation details
    ├─ Patient name
    ├─ Access level
    ├─ Permissions list
    └─ Personal message
    ↓
Frontend: Display invitation review
    ├─ Patient information
    ├─ Access level details
    ├─ Permissions list
    └─ [Accept] [Decline] buttons
    ↓
Family Member: Clicks "Accept"
    ↓
API Call: POST /invitations/accept/{token}
    ↓
Backend: InvitationService.acceptInvitation()
    ↓
Validation:
    ├─ Verify token valid
    ├─ Verify not expired
    ├─ Verify user authenticated
    └─ Verify status is 'pending'
    ↓
Transaction Start
    ↓
Step 1: Update family_calendar_access
    ├─ Set familyMemberId: current user
    ├─ Set status: 'active'
    ├─ Set acceptedAt: now
    └─ Clear invitation token
    ↓
Step 2: Update user document
    ├─ Add patientId to familyMemberOf array
    └─ Set preferredPatientId: this patient
    ↓
Step 3: Create audit log entry
    ├─ eventType: 'invitation_accepted'
    ├─ patientId: patient
    ├─ familyMemberId: current user
    └─ details: { accessLevel }
    ↓
Transaction Commit
    ↓
Step 4: Send confirmation emails
    ├─ To patient: "[Name] accepted your invitation"
    └─ To family member: "Welcome to [Patient]'s care team"
    ↓
Response: Success
    ↓
Frontend: Redirect to patient's dashboard
    ├─ Show welcome message
    ├─ Display quick start guide
    └─ Load patient data
```

---

## 7.4 Calendar Event Flows

### Create Appointment Flow

```
User Action: Click "Add Appointment"
    ↓
Frontend: Display appointment form
    ↓
User: Fill form
    ├─ Event type
    ├─ Title
    ├─ Date and time
    ├─ Duration
    ├─ Provider (search/select)
    ├─ Facility (search/select)
    ├─ Transportation required?
    ├─ Reminders
    └─ Notes
    ↓
User: Click "Save Event"
    ↓
Frontend: Validate form
    ↓
API Call: POST /medical-events
    ↓
Backend: MedicalEventService.createEvent()
    ↓
Validation:
    ├─ Verify user has permission
    ├─ Verify required fields
    ├─ Verify date not in past
    └─ Verify no scheduling conflicts
    ↓
Transaction Start
    ↓
Step 1: Create medical_events document
    ├─ Generate unique ID
    ├─ Set all event fields
    ├─ Set status: 'scheduled'
    ├─ Set createdBy: current user
    └─ Set createdAt: now
    ↓
Step 2: Create reminder jobs
    ├─ For each reminder time:
    │   ├─ Calculate trigger time
    │   └─ Schedule notification
    └─ Store reminder IDs in event
    ↓
Step 3: If transportation required:
    ├─ Set requiresTransportation: true
    ├─ Set responsibilityStatus: 'unassigned'
    └─ Schedule family notification (72h before)
    ↓
Step 4: If Google Calendar sync enabled:
    ├─ Create Google Calendar event
    ├─ Store googleCalendarEventId
    └─ Set syncedToGoogleCalendar: true
    ↓
Step 5: Create audit log entry
    ├─ eventType: 'appointment_created'
    ├─ patientId: patient
    ├─ createdBy: current user
    └─ details: event summary
    ↓
Transaction Commit
    ↓
Step 6: Notify family members
    ├─ Send "New appointment" notification
    └─ Include event details
    ↓
Response: Success with event ID
    ↓
Frontend: Update UI
    ├─ Close form
    ├─ Show success message
    ├─ Add event to calendar view
    └─ Refresh calendar
```

### Claim Transportation Flow

```
Family Member: Receives notification
    ↓
Family Member: Clicks "Claim Responsibility"
    ↓
Frontend: Redirect to appointment details
    ↓
Frontend: Display claim form
    ├─ Appointment details
    ├─ Transportation notes field
    └─ [Confirm Claim] button
    ↓
Family Member: Adds notes (optional)
    ↓
Family Member: Clicks "Confirm Claim"
    ↓
API Call: POST /medical-events/{id}/claim-responsibility
    ↓
Backend: MedicalEventService.claimResponsibility()
    ↓
Validation:
    ├─ Verify user has permission
    ├─ Verify event exists
    ├─ Verify requiresTransportation: true
    ├─ Verify responsibilityStatus: 'unassigned'
    └─ Verify user is family member
    ↓
Transaction Start
    ↓
Step 1: Update medical_events
    ├─ Set responsiblePersonId: current user
    ├─ Set responsiblePersonName: user name
    ├─ Set responsibilityStatus: 'claimed'
    ├─ Set responsibilityClaimedAt: now
    └─ Set transportationNotes: provided notes
    ↓
Step 2: Create appointment_responsibilities record
    ├─ appointmentId: event ID
    ├─ responsiblePersonId: current user
    ├─ status: 'claimed'
    └─ claimedAt: now
    ↓
Step 3: Create audit log entry
    ├─ eventType: 'responsibility_claimed'
    ├─ appointmentId: event ID
    ├─ familyMemberId: current user
    └─ details: { notes }
    ↓
Transaction Commit
    ↓
Step 4: Notify patient
    ├─ Send "Responsibility claimed" notification
    ├─ Include family member name
    ├─ Include transportation notes
    └─ Request confirmation
    ↓
Step 5: Schedule reminders for responsible person
    ├─ 24 hours before
    ├─ 2 hours before
    └─ 15 minutes before
    ↓
Response: Success
    ↓
Frontend: Update UI
    ├─ Show "Claimed" status
    ├─ Display transportation notes
    └─ Show "Waiting for patient confirmation"

--- Patient Side ---

Patient: Receives notification
    ↓
Patient: Reviews claim
    ├─ Family member name
    └─ Transportation notes
    ↓
Patient: Clicks "Confirm"
    ↓
API Call: POST /medical-events/{id}/confirm-responsibility
    ↓
Backend: Update responsibilityStatus: 'confirmed'
    ↓
Notify family member: "Confirmed"
    ↓
Frontend: Show "Confirmed" status
```

---

## 7.5 Notification Delivery Logic

```
Trigger Event: (e.g., appointment reminder due)
    ↓
Notification Service: Create notification job
    ↓
Step 1: Determine recipients
    ├─ Primary: Patient
    └─ Secondary: Family members (if configured)
    ↓
Step 2: Check user preferences
    ├─ Load notification preferences
    ├─ Check quiet hours
    ├─ Check channel preferences
    └─ Check notification type enabled
    ↓
Step 3: If in quiet hours:
    ├─ Check if emergency override
    ├─ If yes: Proceed
    └─ If no: Queue for quiet hours end
    ↓
Step 4: Select delivery channels
    ├─ Primary channel (user preference)
    ├─ Secondary channels (fallback)
    └─ Priority order: Push → SMS → Email
    ↓
Step 5: Prepare notification content
    ├─ Load template
    ├─ Populate variables
    ├─ Format for channel
    └─ Add tracking parameters
    ↓
Step 6: Attempt delivery (primary channel)
    ├─ If Push:
    │   ├─ Send via Firebase Cloud Messaging
    │   └─ Wait for delivery confirmation
    ├─ If SMS:
    │   ├─ Send via Twilio
    │   └─ Wait for delivery confirmation
    └─ If Email:
        ├─ Send via SendGrid
        └─ Wait for delivery confirmation
    ↓
Step 7: Check delivery status
    ├─ If success:
    │   ├─ Log delivery
    │   ├─ Update notification record
    │   └─ End process
    └─ If failure:
        └─ Proceed to retry logic
    ↓
Retry Logic:
    ├─ Attempt 1: Immediate (primary channel)
    ├─ Attempt 2: 5 min later (secondary channel)
    ├─ Attempt 3: 15 min later (tertiary channel)
    ├─ Attempt 4: 1 hour later (all channels)
    └─ Attempt 5: 4 hours later (all channels)
    ↓
After 5 failures:
    ├─ Mark notification as failed
    ├─ Log failure reason
    ├─ Notify admin
    └─ Create support ticket
    ↓
Step 8: Track engagement
    ├─ Monitor delivery
    ├─ Track opens (email)
    ├─ Track clicks (email, push)
    └─ Track actions taken
    ↓
Step 9: Update analytics
    ├─ Increment delivery count
    ├─ Update success rate
    ├─ Track channel performance
    └─ Identify patterns
```

---

# 8. Advanced Systems

## 8.1 Time Bucket System

### Purpose
Organize medications by time of day for better adherence and simplified user experience.

### Time Bucket Logic

**Bucket Assignment Algorithm**:
```
For each medication event:
1. Get scheduled time (HH:MM)
2. Get current time
3. Get grace period end time
4. Determine bucket:

If (current time > grace period end):
    bucket = "overdue"
    priority = 1 (highest)
    color = red
    
Else if (current time >= scheduled time - 30 min AND 
         current time <= scheduled time + grace period):
    bucket = "due_now"
    priority = 2
    color = yellow
    
Else if (current time >= scheduled time - 60 min AND 
         current time < scheduled time - 30 min):
    bucket = "due_soon"
    priority = 3
    color = blue
    
Else if (scheduled time is today AND 
         current time < scheduled time - 60 min):
    bucket = "upcoming"
    priority = 4
    color = gray
    
Else:
    bucket = "future"
    priority = 5
    color = light gray

5. Sort medications within bucket by scheduled time
6. Apply visual styling based on bucket
```

**Dynamic Bucket Updates**:
- Recalculate every 5 minutes
- Immediate recalculation on user action
- Real-time updates via WebSocket (future)
- Optimistic UI updates

**Bucket Display**:
```
┌─────────────────────────────────────────┐
│ Overdue (2)                    🔴       │
├─────────────────────────────────────────┤
│ Lisinopril 10mg - 8:00 AM (30 min late)│
│ Metformin 500mg - 8:00 AM (30 min late)│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Due Now (1)                    🟡       │
├─────────────────────────────────────────┤
│ Aspirin 81mg - 8:30 AM                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Due Soon (2)                   🔵       │
├─────────────────────────────────────────┤
│ Vitamin D 1000IU - 9:00 AM              │
│ Omega-3 1000mg - 9:00 AM                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Upcoming (3)                   ⚪       │
├─────────────────────────────────────────┤
│ Lisinopril 10mg - 12:00 PM (Noon)      │
│ Metformin 500mg - 6:00 PM (Evening)    │
│ Atorvastatin 20mg - 10:00 PM (Bedtime) │
└─────────────────────────────────────────┘
```

---

## 8.2 Grace Period Logic

### Purpose
Allow reasonable flexibility before marking medications as missed, accounting for real-world variability.

### Grace Period Calculation

**Base Grace Period Determination**:
```
Function determineGracePeriod(medication):
    If medication.isPRN:
        return 0 // No grace period for as-needed
    
    If medication.category == "critical":
        // Heart meds, insulin, seizure meds
        return 15 minutes
    
    If medication.category == "time_sensitive":
        // Blood pressure, thyroid, antibiotics
        return 30 minutes
    
    If medication.category == "standard":
        // Most prescription medications
        return 60 minutes
    
    If medication.category == "supplement":
        // Vitamins, supplements
        return 240 minutes
    
    // Default
    return 60 minutes
```

**Circumstance Multipliers**:
```
Function calculateEffectiveGracePeriod(medication, date):
    baseGracePeriod = determineGracePeriod(medication)
    multiplier = 1.0
    
    // Weekend adjustment
    If isWeekend(date):
        multiplier = 1.5
    
    // Holiday adjustment
    If isHoliday(date):
        multiplier = 2.0
    
    // Sick day adjustment (patient-activated)
    If patient.isSickDay(date):
        multiplier = 3.0
    
    // Travel adjustment (patient-activated)
    If patient.isTraveling(date):
        multiplier = 2.0
    
    effectiveGracePeriod = baseGracePeriod * multiplier
    
    // Cap at 4 hours maximum
    return min(effectiveGracePeriod, 240 minutes)
```

**Grace Period End Calculation**:
```
Function calculateGracePeriodEnd(event):
    scheduledTime = event.scheduledDateTime
    gracePeriodMinutes = calculateEffectiveGracePeriod(
        event.medication, 
        event.scheduledDateTime
    )
    
    gracePeriodEnd = scheduledTime + gracePeriodMinutes
    
    return gracePeriodEnd
```

### Missed Detection Algorithm

**Scheduled Function** (runs every 15 minutes):
```
Function detectMissedMedications():
    currentTime = now()
    
    // Query medications past grace period
    query = {
        status: "scheduled",
        gracePeriodEnd: { $lt: currentTime }
    }
    
    events = medicationCalendarEvents.find(query)
    
    For each event in events:
        // Double-check grace period (in case of updates)
        gracePeriodEnd = calculateGracePeriodEnd(event)
        
        If currentTime > gracePeriodEnd:
            // Mark as missed
            markAsMissed(event)
            
            // Trigger notifications
            notifyPatient(event)
            notifyFamily(event)
            
            // Update adherence
            updateAdherenceStatistics(event.patientId)
            
            // Check for patterns
            checkForAdherencePatterns(event.patientId)
```

**Mark as Missed Function**:
```
Function markAsMissed(event):
    transaction.start()
    
    try:
        // Update calendar event
        medicationCalendarEvents.update(event.id, {
            status: "missed",
            missedAt: now(),
            missedReason: "grace_period_expired"
        })
        
        // Create event log
        medicationEvents.create({
            medicationId: event.medicationId,
            patientId: event.patientId,
            eventType: "missed",
            scheduledDateTime: event.scheduledDateTime,
            actualDateTime: now(),
            reason: "grace_period_expired"
        })
        
        // Update command statistics
        medicationCommands.update(event.medicationId, {
            $inc: { missedCount: 1 },
            lastMissedAt: now()
        })
        
        transaction.commit()
        
    catch error:
        transaction.rollback()
        logError(error)
        throw error
```

---

## 8.3 Adherence Tracking Algorithms

### Purpose
Calculate and track medication adherence with industry-standard metrics.

### Adherence Calculation

**30-Day Rolling Window**:
```
Function calculateAdherence(patientId):
    endDate = today()
    startDate = endDate - 30 days
    
    // Get all scheduled events in window
    scheduledEvents = medicationCalendarEvents.find({
        patientId: patientId,
        scheduledDateTime: { 
            $gte: startDate, 
            $lte: endDate 
        }
    })
    
    totalScheduled = scheduledEvents.length
    
    // Count by status
    taken = scheduledEvents.filter(e => e.status == "taken").length
    late = scheduledEvents.filter(e => e.status == "late").length
    missed = scheduledEvents.filter(e => e.status == "missed").length
    skipped = scheduledEvents.filter(e => e.status == "skipped").length
    
    // Calculate metrics
    adherenceRate = (taken + late) / totalScheduled * 100
    onTimeRate = taken / totalScheduled * 100
    missedRate = missed / totalScheduled * 100
    
    // Calculate average delay for late doses
    lateEvents = scheduledEvents.filter(e => e.status == "late")
    totalDelay = 0
    
    For each event in lateEvents:
        delay = event.actualTakenDateTime - event.scheduledDateTime
        totalDelay += delay
    
    averageDelay = totalDelay / lateEvents.length
    
    // Find longest delay
    longestDelay = max(lateEvents.map(e => 
        e.actualTakenDateTime - e.scheduledDateTime
    ))
    
    return {
        totalScheduled,
        taken,
        late,
        missed,
        skipped,
        adherenceRate,
        onTimeRate,
        missedRate,
        averageDelay,
        longestDelay
    }
```

### Pattern Detection

**Consecutive Missed Doses**:
```
Function detectConsecutiveMissed(patientId):
    // Get recent events sorted by date
    recentEvents = medicationCalendarEvents.find({
        patientId: patientId,
        scheduledDateTime: { $gte: today() - 7 days }
    }).sort({ scheduledDateTime: -1 })
    
    consecutiveMissed = 0
    maxConsecutiveMissed = 0
    
    For each event in recentEvents:
        If event.status == "missed":
            consecutiveMissed++
            maxConsecutiveMissed = max(
                maxConsecutiveMissed, 
                consecutiveMissed
            )
        Else:
            consecutiveMissed = 0
    
    // Trigger alerts based on threshold
    If maxConsecutiveMissed >= 3:
        triggerCriticalAlert(patientId)
    Else If maxConsecutiveMissed >= 2:
        triggerWarningAlert(patientId)
    
    return maxConsecutiveMissed
```

**Time-of-Day Patterns**:
```
Function detectTimePatterns(patientId):
    events = medicationCalendarEvents.find({
        patientId: patientId,
        scheduledDateTime: { $gte: today() - 30 days }
    })
    
    // Group by time bucket
    bucketStats = {
        morning: { total: 0, missed: 0 },
        noon: { total: 0, missed: 0 },
        evening: { total: 0, missed: 0 },
        bedtime: { total: 0, missed: 0 }
    }
    
    For each event in events:
        bucket = event.timeBucket
        bucketStats[bucket].total++
        
        If event.status == "missed":
            bucketStats[bucket].missed++
    
    // Calculate miss rates
    For each bucket in bucketStats:
        bucket.missRate = bucket.missed / bucket.total * 100
    
    // Find most problematic time
    mostMissedBucket = max(bucketStats, by: missRate)
    
    return {
        bucketStats,
        mostMissedBucket
    }
```

**Day-of-Week Patterns**:
```
Function detectDayPatterns(patientId):
    events = medicationCalendarEvents.find({
        patientId: patientId,
        scheduledDateTime: { $gte: today() - 30 days }
    })
    
    // Group by day of week
    dayStats = {
        Sunday: { total: 0, missed: 0 },
        Monday: { total: 0, missed: 0 },
        Tuesday: { total: 0, missed: 0 },
        Wednesday: { total: 0, missed: 0 },
        Thursday: { total: 0, missed: 0 },
        Friday: { total: 0, missed: 0 },
        Saturday: { total: 0, missed: 0 }
    }
    
    For each event in events:
        day = getDayOfWeek(event.scheduledDateTime)
        dayStats[day].total++
        
        If event.status == "missed":
            dayStats[day].missed++
    
    // Calculate miss rates
    For each day in dayStats:
        day.missRate = day.missed / day.total * 100
    
    // Find most problematic day
    mostMissedDay = max(dayStats, by: missRate)
    
    return {
        dayStats,
        mostMissedDay
    }
```

**Declining Trend Detection**:
```
Function detectDecliningTrend(patientId):
    // Calculate adherence for each week
    weeks = []
    
    For week = 0 to 12: // 12 weeks
        startDate = today() - (week * 7 days)
        endDate = startDate + 7 days
        
        weekAdherence = calculateAdherence(
            patientId, 
            startDate, 
            endDate
        )
        
        weeks.push({
            weekNumber: week,
            adherenceRate: weekAdherence.adherenceRate
        })
    
    // Calculate trend (linear regression)
    trend = calculateLinearRegression(weeks)
    
    // Detect significant decline
    If trend.slope < -2: // Declining > 2% per week
        triggerDecliningTrendAlert(patientId, trend)
    
    return {
        weeks,
        trend,
        isDecl ining: trend.slope < -2
    }
```

---

## 8.4 AI Processing Pipeline

### Purpose
Extract structured, actionable information from unstructured doctor visit notes.

### Processing Pipeline

**Step 1: Input Validation**:
```
Function validateVisitInput(input):
    // Minimum length check
    If input.length < 50:
        throw Error("Visit summary too short. Please provide more details.")
    
    // Maximum length check
    If input.length > 10000:
        throw Error("Visit summary too long. Please summarize.")
    
    // Content check
    If containsOnlyNumbers(input):
        throw Error("Please provide descriptive text, not just numbers.")
    
    // Language check (optional)
    If !isEnglish(input):
        throw Warning("Non-English text detected. AI may not process accurately.")
    
    return true
```

**Step 2: Context Preparation**:
```
Function prepareAIContext(patient, visitSummary):
    context = {
        patientAge: calculateAge(patient.dateOfBirth),
        medicalConditions: patient.medicalConditions,
        currentMedications: getCurrentMedications(patient.id),
        allergies: patient.allergies,
        recentVisits: getRecentVisits(patient.id, limit: 3)
    }
    
    prompt = buildPrompt(context, visitSummary)
    
    return prompt
```

**Step 3: AI Processing**:
```
Function processWithAI(prompt):
    try:
        response = geminiAPI.generateContent({
            model: "gemini-pro",
            prompt: prompt,
            temperature: 0.7,
            maxOutputTokens: 2048,
            safetySettings: [
                {
                    category: "HARM_CATEGORY_MEDICAL",
                    threshold: "BLOCK_NONE"
                }
            ]
        })
        
        // Parse JSON response
        result = JSON.parse(response.text)
        
        return result
        
    catch error:
        If error.type == "RATE_LIMIT":
            // Retry with exponential backoff
            wait(calculateBackoff(retryCount))
            return processWithAI(prompt)
        
        Else If error.type == "SAFETY_BLOCK":
            // Content blocked by safety filters
            logWarning("AI safety block", error)
            return null
        
        Else:
            logError("AI processing failed", error)
            throw error
```

**Step 4: Response Validation**:
```
Function validateAIResponse(response):
    // Check required fields
    requiredFields = [
        "keyPoints",
        "actionItems",
        "medicationChanges",
        "followUpRequired",
        "urgencyLevel"
    ]
    
    For each field in requiredFields:
        If !response.hasOwnProperty(field):
            throw Error(`Missing required field: ${field}`)
    
    // Validate data types
    If !Array.isArray(response.keyPoints):
        throw Error("keyPoints must be an array")
    
    If !Array.isArray(response.actionItems):
        throw Error("actionItems must be an array")
    
    // Validate urgency level
    validUrgencyLevels = ["low", "medium", "high", "urgent"]
    If !validUrgencyLevels.includes(response.urgencyLevel):
        throw Error("Invalid urgency level")
    
    // Validate action items have due dates
    For each item in response.actionItems:
        If !item.dueDate:
            throw Error("Action items must have due dates")
    
    return true
```

**Step 5: Post-Processing**:
```
Function postProcessAIResponse(response, visitSummary):
    // Extract medication changes
    If response.medicationChanges.new.length > 0:
        For each med in response.medicationChanges.new:
            suggestMedicationAddition(med)
    
    If response.medicationChanges.stopped.length > 0:
        For each med in response.medicationChanges.stopped:
            suggestMedicationRemoval(med)
    
    If response.medicationChanges.modified.length > 0:
        For each med in response.medicationChanges.modified:
            suggestMedicationUpdate(med)
    
    // Create action items
    For each item in response.actionItems:
        createActionItem({
            task: item.task,
            dueDate: item.dueDate,
            priority: item.priority,
            sourceVisitId: visitSummary.id
        })
    
    // Schedule follow-up
    If response.followUpRequired:
        createFollowUpReminder({
            date: response.followUpDate,
            instructions: response.followUpInstructions,
            sourceVisitId: visitSummary.id
        })
    
    // Trigger alerts based on urgency
    If response.urgencyLevel == "urgent":
        triggerUrgentAlert(visitSummary.patientId, response)
    
    return response
```

### Prompt Engineering

**Prompt Template**:
```
You are a medical assistant helping to process doctor visit notes.
Analyze the following visit summary and extract structured information.

Patient Context:
- Age: {age}
- Medical Conditions: {conditions}
- Current Medications: {medications}
- Allergies: {allergies}

Recent Visit History:
{recentVisits}

Current Visit Summary:
{visitSummary}

Please extract and return JSON with the following structure:
{
  "keyPoints": [
    "Important highlight 1",
    "Important highlight 2",
    "Important highlight 3"
  ],
  "actionItems": [
    {
      "task": "Specific action to take",
      "dueDate": "YYYY-MM-DD",
      "priority": "low|medium|high"
    }
  ],
  "medicationChanges": {
    "new": [
      {
        "name": "Medication name",
        "dosage": "Dosage amount",
        "frequency": "How often",
        "reason": "Why prescribed"
      }
    ],
    "stopped": [
      {
        "name": "Medication name",
        "reason": "Why stopped"
      }
    ],
    "modified": [
      {
        "name": "Medication name",
        "previousDosage": "Old dosage",
        "newDosage": "New dosage",
        "reason": "Why changed"
      }
    ]
  },
  "followUpRequired": true|false,
  "followUpDate": "YYYY-MM-DD" (if required),
  "followUpInstructions": "What to do at follow-up",
  "urgencyLevel": "low|medium|high|urgent",
  "riskFactors": [
    "Potential health concern 1",
    "Potential health concern 2"
  ],
  "recommendations": [
    "Care suggestion 1",
    "Care suggestion 2"
  ]
}

Guidelines:
- Be concise and accurate
- Focus on actionable information
- Use medical terminology appropriately
- Infer reasonable due dates for action items
- Assess urgency based on medical context
- Identify potential risks proactively
```

---

## 8.5 Smart Scheduling

### Purpose
Intelligent scheduling suggestions based on patient patterns and medical best practices.

### Optimal Time Suggestions

**Algorithm**:
```
Function suggestOptimalTimes(medication, patient):
    // Get patient's adherence history
    history = getAdherenceHistory(patient.id)
    
    // Analyze best times
    timeAnalysis = analyzeTimePatterns(history)
    
    // Get medication requirements
    requirements = getMedicationRequirements(medication)
    
    // Consider meal timing
    mealTiming = patient.mealSchedule || getDefaultMealSchedule()
    
    // Consider sleep schedule
    sleepSchedule = patient.sleepSchedule || getDefaultSleepSchedule()
    
    suggestions = []
    
    // For each required dose per day
    For each dose in medication.dosesPerDay:
        // Find optimal time based on:
        // 1. Patient's best adherence times
        // 2. Medication requirements (with food, etc.)
        // 3. Separation from other medications
        // 4. Avoiding sleep hours
        
        optimalTime = calculateOptimalTime({
            adherencePatterns: timeAnalysis,
            medicationRequirements: requirements,
            mealTiming: mealTiming,
            sleepSchedule: sleepSchedule,
            existingMedications: patient.currentMedications
        })
        
        suggestions.push({
            time: optimalTime,
            reason: explainSuggestion(optimalTime),
            confidence: calculateConfidence(optimalTime)
        })
    
    return suggestions
```

**Conflict Detection**:
```
Function detectSchedulingConflicts(newMedication, existingMedications):
    conflicts = []
    
    For each existing in existingMedications:
        // Check for interaction-based separation
        interaction = checkDrugInteraction(
            newMedication, 
            existing
        )
        
        If interaction.requiresSeparation:
            conflicts.push({
                type: "interaction",
                medication: existing.name,
                minimumSeparation: interaction.minimumHours,
                severity: interaction.severity
            })
        
        // Check for duplicate therapy
        If isSameClass(newMedication, existing):
            conflicts.push({
                type: "duplicate_therapy",
                medication: existing.name,
                class: newMedication.class
            })
        
        // Check for timing conflicts
        For each newTime in newMedication.scheduledTimes:
            For each existingTime in existing.scheduledTimes:
                If abs(newTime - existingTime) < 15 minutes:
                    conflicts.push({
                        type: "timing_overlap",
                        medication: existing.name,
                        time: existingTime
                    })
    
    return conflicts
```

---

# 9. Security & Privacy

## 9.1 Authentication & Authorization

### Authentication

**Firebase Authentication**:
- Google OAuth 2.0 only (simplified, secure)
- Automatic token refresh
- Session management
- Multi-device support
- Secure token storage

**Token Management**:
```
// Client-side
const auth = getAuth();
const user = auth.currentUser;

if (user) {
  const token = await user.getIdToken();
  // Include in API requests
  headers: {
    'Authorization': `Bearer ${token}`
  }
}

// Server-side
const decodedToken = await admin.auth().verifyIdToken(token);
const uid = decodedToken.uid;
```

### Authorization

**Role-Based Access Control**:
```
Function checkPermission(userId, patientId, permission):
    // Check if user is the patient
    If userId == patientId:
        return true // Patients have all permissions
    
    // Check family access
    access = familyCalendarAccess.findOne({
        familyMemberId: userId,
        patientId: patientId,
        status: "active"
    })
    
    If !access:
        return false // No access
    
    // Check specific permission
    return access.permissions[permission] == true
```

**Permission Enforcement**:
```
// API endpoint example
async function updateMedication(req, res) {
    const { medicationId } = req.params;
    const userId = req.user.uid;
    
    // Get medication
    const medication = await getMedication(medicationId);
    
    // Check permission
    const hasPermission = await checkPermission(
        userId,
        medication.patientId,
        'canEdit'
    );
    
    if (!hasPermission) {
        return res.status(403).json({
            error: "Insufficient permissions"
        });
    }
    
    // Proceed with update
    // ...
}
```

---

## 9.2 Data Privacy

### HIPAA Compliance Considerations

**Protected Health Information (PHI)**:
- Patient names
- Medical conditions
- Medications
- Appointment details
- Visit summaries
- Provider information
- All dates related to health

**Compliance Measures**:
1. **Encryption at Rest**: Firestore automatic encryption
2. **Encryption in Transit**: HTTPS/TLS for all communications
3. **Access Logging**: Complete audit trail
4. **Minimum Necessary**: Granular permissions
5. **User Consent**: Explicit consent for family access
6. **Secure Deletion**: Complete data removal on request
7. **Breach Notification**: Automated alerting system

### Family Access Controls

**Granular Permissions**:
- View-only vs. edit access
- Medication-specific permissions
- Visit summary sharing levels
- Selective field restriction

**Access Audit Trail**:
```
{
  id: string;
  patientId: string;
  familyMemberId: string;
  action: string; // "viewed", "created", "updated", "deleted"
  resourceType: string; // "medication", "appointment", etc.
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}
```

**Data Sharing Consent**:
```
// Patient must explicitly consent to sharing
const consent = {
  patientId: string;
  familyMemberId: string;
  dataTypes: string[]; // ["medications", "appointments", etc.]
  accessLevel: string; // "full", "summary_only", "restricted"
  consentedAt: Date;
  expiresAt: Date; // Optional time-limited access
  canRevoke: true;
}
```

### Google Calendar Privacy

**Privacy-Preserving Sync**:
- Minimal details in Google Calendar
- Generic event titles option ("Medical Appointment")
- Selective event type sync
- No medical details unless explicitly enabled
- Family information excluded by default

**Sync Configuration**:
```
{
  syncEnabled: boolean;
  includeEventTypes: string[];
  includeMedicalDetails: boolean;
  includeProviderInfo: boolean;
  includeFamilyInfo: boolean;
  customEventTitle: string; // Generic title template
}
```

---

## 9.3 Data Retention & Deletion

### Retention Policies

**Active Data**:
- Medications: Until discontinued + 1 year
- Appointments: Indefinite (historical record)
- Visit Summaries: Indefinite
- Medication Events: 365 days, then archived

**Archived Data**:
- Medication events older than 365 days
- Discontinued medications after 1 year
- Compliance-ready retention (7 years)
- Retrievable for audits

**Deletion Policies**:
- User-initiated account deletion
- Family access revocation (immediate)
- Expired invitations (30 days)
- Notification logs (90 days)

### Account Deletion

**Complete Data Removal**:
```
Function deleteUserAccount(userId):
    transaction.start()
    
    try:
        // 1. Delete user profile
        users.delete(userId)
        
        // 2. If patient, delete all medical data
        If userType == "patient":
            medications.deleteMany({ patientId: userId })
            medicationEvents.deleteMany({ patientId: userId })
            medicalEvents.deleteMany({ patientId: userId })
            visitSummaries.deleteMany({ patientId: userId })
            providers.deleteMany({ patientId: userId })
            facilities.deleteMany({ patientId: userId })
            
            // Revoke all family access
            familyAccess.deleteMany({ patientId: userId })
            
            // Notify family members
            notifyFamilyOfDeletion(userId)
        
        // 3. If family member, remove from all patients
        If userType == "family_member":
            familyAccess.deleteMany({ familyMemberId: userId })
            
            // Notify patients
            notifyPatientsOfDeletion(userId)
        
        // 4. Delete notifications
        notifications.deleteMany({ recipientId: userId })
        
        // 5. Delete audit logs (after retention period)
        scheduleAuditLogDeletion(userId, retentionDays: 2555) // 7 years
        
        // 6. Delete Firebase Auth account
        admin.auth().deleteUser(userId)
        
        transaction.commit()
        
        // 7. Send confirmation email
        sendDeletionConfirmation(userEmail)
        
    catch error:
        transaction.rollback()
        logError("Account deletion failed", error)
        throw error
```

---

# 10. Performance & Optimization

## 10.1 Frontend Optimization

### Code Splitting

**Route-Based Splitting**:
```typescript
// Lazy load routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Medications = lazy(() => import('./pages/Medications'));
const Calendar = lazy(() => import('./pages/CalendarPage'));
const Profile = lazy(() => import('./pages/PatientProfile'));

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/medications" element={<Medications />} />
    <Route path="/calendar" element={<Calendar />} />
    <Route path="/profile" element={<Profile />} />
  </Routes>
</Suspense>
```

**Component-Based Splitting**:
```typescript
// Lazy load heavy components
const MedicationAdherenceDashboard = lazy(() => 
  import('./components/MedicationAdherenceDashboard')
);

const VisitSummaryAI = lazy(() => 
  import('./components/VisitSummaryAI')
);
```

### Caching Strategy

**API Response Caching**:
```typescript
class ApiCache {
  private cache: Map<string, CacheEntry>;
  private ttl: number = 5 * 60 * 1000; // 5 minutes
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Smart Refresh Strategy**:
```typescript
// Mount-aware refresh
useEffect(() => {
  // Bypass cache on initial mount
  fetchData({ bypassCache: true });
}, []);

// Time-based caching
const fetchWithCache = async (endpoint: string) => {
  const cached = apiCache.get(endpoint);
  
  if (cached) {
    return cached;
  }
  
  const data = await api.get(endpoint);
  apiCache.set(endpoint, data);
  
  return data;
};

// Midnight refresh for medication data
useEffect(() => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  const timer = setTimeout(() => {
    apiCache.invalidate('medication');
    fetchMedicationData();
  }, msUntilMidnight);
  
  return () => clearTimeout(timer);
}, []);
```

### Bundle Optimization

**Vite Configuration**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'ui': ['lucide-react', 'tailwindcss'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

---

## 10.2 Backend Optimization

### Database Optimization

**Query Optimization**:
```typescript
// Bad: Multiple queries
const medications = await db.collection('medications')
  .where('patientId', '==', patientId)
  .get();

for (const med of medications.docs) {
  const events = await db.collection('medication_events')
    .where('medicationId', '==', med.id)
    .get();
}

// Good: Single query with join
const medications = await db.collection('medications')
  .where('patientId', '==', patientId)
  .get();

const medicationIds = medications.docs.map(doc => doc.id);

const events = await db.collection('medication_events')
  .where('medicationId', 'in', medicationIds)
  .get();
```

**Composite Indexes**:
```json
{
  "indexes": [
    {
      "collectionGroup": "medication_calendar_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "scheduledDateTime", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Pagination**:
```typescript
// Cursor-based pagination
async function getMedications(
  patientId: string,
  limit: number = 20,
  startAfter?: DocumentSnapshot
) {
  let query = db.collection('medications')
    .where('patientId', '==', patientId)
    .orderBy('createdAt', 'desc')
    .limit(limit);
  
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  
  const snapshot = await query.get();
  
  return {
    medications: snapshot.docs.map(doc => doc.data()),
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === limit
  };
}
```

### API Optimization

**Rate Limiting**:
```typescript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

**Request Debouncing**:
```typescript
class RequestDebouncer {
  private pending: Map<string, Promise<any>>;
  
  async debounce<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 1000
  ): Promise<T> {
    // If request already pending, return existing promise
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    
    // Create new promise
    const promise = fn().finally(() => {
      setTimeout(() => {
        this.pending.delete(key);
      }, ttl);
    });
    
    this.pending.set(key, promise);
    
    return promise;
  }
}
```

**Staggered API Calls**:
```typescript
async function fetchMultipleResources(ids: string[]) {
  const results = [];
  
  for (let i = 0; i < ids.length; i++) {
    // Stagger requests by 100ms
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const result = await fetchResource(ids[i]);
    results.push(result);
  }
  
  return results;
}
```

### Function Optimization

**Cold Start Reduction**:
```typescript
// Keep functions warm
export const keepWarm = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    // Minimal operation to keep function warm
    return null;
  });

// Optimize imports
// Bad: Import entire library
import * as admin from 'firebase-admin';

// Good: Import only what's needed
import { firestore } from 'firebase-admin';
```

**Memory Allocation**:
```typescript
// Configure memory based on function needs
export const processVisitSummary = functions
  .runWith({
    memory: '1GB', // AI processing needs more memory
    timeoutSeconds: 300
  })
  .https.onCall(async (data, context) => {
    // Process with AI
  });

export const sendNotification = functions
  .runWith({
    memory: '256MB', // Simple notification needs less
    timeoutSeconds: 60
  })
  .https.onCall(async (data, context) => {
    // Send notification
  });
```

---

## 10.3 Mobile Optimization

### Performance

**Lazy Loading**:
```typescript
// Lazy load images
<img 
  src={placeholder} 
  data-src={actualImage}
  loading="lazy"
  onLoad={handleImageLoad}
/>

// Intersection Observer for lazy loading
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target as HTMLImageElement;
      img.src = img.dataset.src!;
      observer.unobserve(img);
    }
  });
});
```

**Reduced Animation**:
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Optimized Bundle**:
```typescript
// Mobile-specific bundle
if (isMobile) {
  import('./mobile-optimized-component');
} else {
  import('./desktop-component');
}
```

### Offline Support

**Service Worker**:
```typescript
// Cache-first strategy for static assets
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Network-first strategy for API calls
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open('api-cache').then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});
```

---

# 11. Future Roadmap

## 11.1 Planned Features (6-12 months)

### Wearable Integration
- Apple Watch medication reminders
- Wear OS support
- Vital sign tracking (heart rate, blood pressure)
- Activity monitoring
- Sleep tracking integration
- Automatic medication adherence detection

### Telehealth Integration
- Video consultation support
- In-app messaging with providers
- Virtual waiting room
- Prescription e-delivery
- Remote vital sign sharing
- Screen sharing for education

### Insurance Integration
- Claims tracking
- Coverage verification
- Copay estimation
- Benefit utilization
- Prior authorization tracking
- EOB (Explanation of Benefits) storage

### Pharmacy Integration
- Prescription refill automation
- Pharmacy selection and comparison
- Delivery scheduling
- Price comparison across pharmacies
- Medication availability checking
- Automatic refill reminders

### Advanced Analytics
- Predictive health insights
- Medication effectiveness tracking
- Cost analysis and optimization
- Provider performance metrics
- Personalized health recommendations
- Risk prediction models

---

## 11.2 Technical Improvements (3-6 months)

### Real-Time Sync
- WebSocket-based updates
- Collaborative editing
- Live family coordination
- Instant notifications
- Optimistic UI updates
- Conflict resolution

### Advanced Offline
- Full offline functionality
- Offline-first architecture
- Background sync
- Conflict resolution
- Queue management
- Sync status indicators

### Multi-Language Support
- Internationalization (i18n)
- Spanish, Chinese, French, German
- Localized medical terms
- Cultural adaptations
- Right-to-left language support
- Automatic language detection

### Enhanced AI
- Multi-modal AI (text + voice + images)
- Medical image analysis
- Symptom checker
- Drug interaction prediction
- Personalized care recommendations
- Natural language queries

---

## 11.3 Integration Opportunities (12+ months)

### EHR Integration
- Epic integration
- Cerner integration
- HL7 FHIR support
- CCD/CDA import
- Bi-directional sync
- Provider portal access

### Lab Integration
- Lab result import
- Trend analysis
- Abnormal result alerts
- Reference range comparison
- Historical tracking
- Provider sharing

### Imaging Integration
- DICOM viewer
- Image storage
- Radiology report import
- Comparison tools
- Provider sharing
- Mobile viewing

### Prescription Integration
- E-prescribing
- Prescription history
- Formulary checking
- Generic alternatives
- Cost comparison
- Automatic refills

---

# 12. Appendices

## 12.1 Glossary of Terms

**Adherence**: The extent to which a patient follows their prescribed medication regimen.

**API (Application Programming Interface)**: A set of protocols for building and integrating application software.

**ACID (Atomicity, Consistency, Isolation, Durability)**: Properties that guarantee database transactions are processed reliably.

**BID (Bis In Die)**: Medical abbreviation for "twice daily."

**Event Sourcing**: A pattern where state changes are stored as a sequence of events.

**Firestore**: Google's NoSQL cloud database.

**Grace Period**: Time window after scheduled medication time before marking as missed.

**HIPAA (Health Insurance Portability and Accountability Act)**: US law protecting patient health information.

**OAuth**: Open standard for access delegation.

**PRN (Pro Re Nata)**: Medical abbreviation for "as needed."

**QID (Quater In Die)**: Medical abbreviation for "four times daily."

**RxNorm**: Standardized nomenclature for clinical drugs.

**TID (Ter In Die)**: Medical abbreviation for "three times daily."

**Time Bucket**: Grouping of medications by time of day (morning, noon, evening, bedtime).

**Transaction**: A unit of work performed against a database.

**WCAG (Web Content Accessibility Guidelines)**: Guidelines for making web content accessible.

---

## 12.2 API Reference Summary

### Authentication Endpoints
- `GET /auth/profile` - Get current user profile
- `PUT /auth/profile` - Update user profile

### Medication Endpoints
- `GET /medications?patientId={id}` - List medications
- `POST /medications` - Create medication
- `PUT /medications/{id}` - Update medication
- `DELETE /medications/{id}` - Delete medication

### Medication Calendar Endpoints
- `GET /medication-calendar/events/{patientId}/today-buckets` - Get today's medications by bucket
- `POST /medication-calendar/events/{eventId}/taken` - Mark medication as taken
- `POST /medication-calendar/events/{eventId}/snooze` - Snooze medication
- `POST /medication-calendar/events/{eventId}/skip` - Skip medication
- `GET /medication-calendar/adherence` - Get adherence statistics

### Family Access Endpoints
- `GET /family-access` - Get family access records
- `POST /invitations/send` - Send family invitation
- `POST /invitations/accept/{token}` - Accept invitation
- `GET /invitations/{token}` - Get invitation details
- `PATCH /family-access/{id}/access-level` - Change access level
- `DELETE /family-access/{id}` - Remove family access

### Medical Events Endpoints
- `GET /medical-events/{patientId}` - List medical events
- `POST /medical-events` - Create medical event
- `PUT /medical-events/{id}` - Update medical event
- `DELETE /medical-events/{id}` - Delete medical event

### Visit Summary Endpoints
- `GET /visit-summaries/{patientId}` - List visit summaries
- `POST /visit-summaries` - Create visit summary
- `POST /audio/transcribe` - Transcribe audio to text

### Healthcare Provider Endpoints
- `GET /healthcare/providers/{patientId}` - List providers
- `POST /healthcare/providers` - Create provider
- `PUT /healthcare/providers/{id}` - Update provider
- `DELETE /healthcare/providers/{id}` - Delete provider

### Drug Search Endpoints
- `GET /drugs/search?q={query}` - Search drugs
- `GET /drugs/{rxcui}` - Get drug details
- `GET /drugs/{rxcui}/interactions` - Check interactions

---

## 12.3 Database Schema Reference

### Core Collections

1. **users**: User accounts and profiles
2. **medication_commands**: Medication definitions (source of truth)
3. **medication_events**: Immutable event log
4. **medication_calendar_events**: Daily scheduled instances
5. **family_calendar_access**: Family permissions
6. **medical_events**: Calendar appointments
7. **visit_summaries**: Doctor visit records
8. **healthcare_providers**: Provider directory
9. **medical_facilities**: Facility directory
10. **notifications**: Notification log
11. **audit_logs**: Security audit trail

### Key Indexes

**medication_calendar_events**:
- `patientId + scheduledDateTime` (ASC/ASC)
- `patientId + status + scheduledDateTime` (ASC/ASC/ASC)

**medical_events**:
- `patientId + startDateTime` (ASC/ASC)
- `patientId + eventType + startDateTime` (ASC/ASC/ASC)
- `patientId + status + startDateTime` (ASC/ASC/ASC)

**family_calendar_access**:
- `familyMemberId + status + lastAccessAt` (ASC/ASC/DESC)
- `patientId + status + createdAt` (ASC/ASC/DESC)

---

## 12.4 Key Metrics

### Technical Performance
- API response time: < 500ms (95th percentile)
- Database query time: < 200ms (95th percentile)
- Page load time: < 3 seconds (initial)
- Time to interactive: < 5 seconds
- Missed detection accuracy: > 99%
- Notification delivery rate: > 95%
- Transaction success rate: > 99%
- Uptime: > 99.9%

### User Experience
- Medication adherence improvement: > 30%
- Family engagement increase: > 40%
- User satisfaction: > 90%
- Feature adoption rate: > 80%
- Support ticket reduction: > 25%
- Time saved per week: > 2 hours

### Business
- Monthly active users (MAU) growth: > 20%
- User retention (30-day): > 80%
- User retention (90-day): > 60%
- Net Promoter Score (NPS): > 50
- Customer acquisition cost (CAC): < $50
- Lifetime value (LTV): > $500

---

## Document End

**Version**: 1.0  
**Last Updated**: November 15, 2025  
**Next Review**: December 15, 2025

This Game Design Document (GDD) format specification serves as the comprehensive reference for the FamMedicalCare application. It should be reviewed and updated quarterly to ensure alignment with product evolution, user feedback, and technical capabilities.

For questions or clarifications, contact the development team.

---

**Built with ❤️ for families managing healthcare together**