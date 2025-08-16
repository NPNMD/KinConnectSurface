# Medical Calendar Architecture Plan

## Executive Summary

Based on your requirements for an integrated medical calendar that tracks appointments, lab results, medication schedules, and care tasks with optional Google Calendar sync, I recommend a **hybrid approach** that stores all medical events in your Firebase database while providing optional Google Calendar synchronization for reminders.

## Current State Analysis

### ✅ What You Have
- [`CalendarIntegration.tsx`](client/src/components/CalendarIntegration.tsx:1) component with basic Google Calendar API setup
- Google Calendar API credentials configured in environment
- [`Appointment`](shared/types.ts:202) and [`MedicationReminder`](shared/types.ts:137) types defined
- Firebase Firestore for data storage
- [`googleapis`](package.json:43) package already installed

### ❌ Current Gaps
- No backend API routes for calendar/appointment operations
- Calendar component uses mock data only
- No integration between medications and calendar events
- No family member access controls for calendar
- No notification/reminder system
- Limited medical-specific metadata in event structure

## Recommended Architecture: Hybrid Medical Calendar

### Core Principles
1. **Primary Storage**: Firebase Firestore (HIPAA-compliant, family-accessible)
2. **Optional Sync**: Google Calendar for personal reminders only
3. **Medical-First**: Rich medical metadata that Google Calendar can't support
4. **Family Coordination**: Multi-user access with permission controls
5. **Privacy**: Sensitive medical data stays in your secure database

## Enhanced Data Model

### Medical Event Types
```typescript
enum MedicalEventType {
  APPOINTMENT = 'appointment',
  LAB_RESULT = 'lab_result', 
  MEDICATION_SCHEDULE = 'medication_schedule',
  CARE_TASK = 'care_task',
  FOLLOW_UP = 'follow_up',
  PROCEDURE = 'procedure',
  THERAPY_SESSION = 'therapy_session'
}

interface MedicalEvent {
  id: string;
  patientId: string;
  type: MedicalEventType;
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  
  // Medical-specific metadata
  medicalData: {
    provider?: string;
    specialty?: string;
    location?: string;
    appointmentType?: string;
    preparationInstructions?: string[];
    followUpRequired?: boolean;
    relatedMedicationIds?: string[];
    labTestTypes?: string[];
    results?: {
      status: 'pending' | 'completed' | 'cancelled';
      files?: string[]; // File storage references
      notes?: string;
    };
  };
  
  // Family coordination
  familyAccess: {
    createdBy: string;
    visibleTo: string[]; // Family member IDs
    editableBy: string[]; // Who can modify
    notifyMembers: string[]; // Who gets notifications
  };
  
  // Google Calendar sync
  googleCalendar?: {
    syncEnabled: boolean;
    googleEventId?: string;
    lastSyncAt?: Date;
    syncStatus: 'synced' | 'pending' | 'failed' | 'disabled';
  };
  
  // Reminders and notifications
  reminders: {
    enabled: boolean;
    times: number[]; // Minutes before event
    methods: ('push' | 'email' | 'sms')[];
  };
  
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  createdAt: Date;
  updatedAt: Date;
}
```

## Firebase Firestore Schema

```
/patients/{patientId}/medicalEvents/{eventId}
/patients/{patientId}/medicationSchedules/{scheduleId}
/familyGroups/{groupId}/members/{memberId}
/notifications/{notificationId}
/googleCalendarSync/{userId}
```

### Collection Structure
- **medicalEvents**: Primary calendar events with rich medical metadata
- **medicationSchedules**: Recurring medication reminders that generate calendar events
- **familyAccess**: Permission matrix for family member access
- **syncSettings**: User preferences for Google Calendar integration

## Google Calendar Integration Strategy

### Hybrid Sync Approach
1. **Medical events stored primarily in Firestore** (authoritative source)
2. **Simplified events synced to Google Calendar** for reminders
3. **Two-way sync** for basic scheduling changes
4. **Medical metadata stays private** in your database

### Sync Rules
```typescript
interface GoogleCalendarSyncRules {
  // What gets synced to Google Calendar
  syncableEventTypes: MedicalEventType[];
  
  // How medical events are represented in Google Calendar
  googleEventMapping: {
    title: string; // "Medical Appointment" (generic)
    description: string; // Basic info only
    location: string; // Address only, no medical details
  };
  
  // What stays private in your database
  privateData: [
    'medicalData.results',
    'medicalData.preparationInstructions',
    'familyAccess',
    'relatedMedicationIds'
  ];
}
```

## Medication Schedule Integration

### Automatic Calendar Generation
```typescript
interface MedicationScheduleCalendarIntegration {
  // Generate recurring calendar events from medication schedules
  generateEventsFromMedication: (medication: Medication) => MedicalEvent[];
  
  // Link medication logs to calendar events
  linkMedicationLogs: (eventId: string, logId: string) => void;
  
  // Handle medication changes
  updateScheduleEvents: (medicationId: string, changes: Partial<Medication>) => void;
}
```

## Family Member Access System

### Permission Levels
```typescript
enum CalendarPermission {
  VIEW_BASIC = 'view_basic',           // See appointment times only
  VIEW_DETAILS = 'view_details',       // See medical details
  EDIT_EVENTS = 'edit_events',         // Modify appointments
  MANAGE_SCHEDULE = 'manage_schedule', // Full calendar management
  EMERGENCY_ACCESS = 'emergency_access' // Override all restrictions
}

interface FamilyCalendarAccess {
  patientId: string;
  memberId: string;
  permissions: CalendarPermission[];
  restrictions: {
    eventTypes?: MedicalEventType[]; // Limit to specific event types
    timeRange?: { start: Date; end: Date }; // Limit to date range
    emergencyOverride: boolean; // Can access in emergencies
  };
}
```

## API Endpoints Design

### Calendar Operations
```typescript
// GET /api/patients/{patientId}/calendar
// POST /api/patients/{patientId}/calendar/events
// PUT /api/patients/{patientId}/calendar/events/{eventId}
// DELETE /api/patients/{patientId}/calendar/events/{eventId}

// Medication integration
// POST /api/patients/{patientId}/medications/{medicationId}/schedule
// GET /api/patients/{patientId}/calendar/medication-events

// Google Calendar sync
// POST /api/calendar/google/connect
// POST /api/calendar/google/sync
// DELETE /api/calendar/google/disconnect

// Family access
// GET /api/patients/{patientId}/calendar/family-access
// POST /api/patients/{patientId}/calendar/family-access
```

## Notification System Architecture

### Multi-Channel Notifications
```typescript
interface NotificationSystem {
  channels: {
    push: WebPushNotification;
    email: EmailNotification;
    sms: SMSNotification;
    inApp: InAppNotification;
  };
  
  triggers: {
    appointmentReminders: number[]; // [24h, 2h, 30min] before
    medicationReminders: string[]; // Specific times
    labResultsAvailable: boolean;
    familyMemberUpdates: boolean;
  };
  
  familyNotifications: {
    notifyOnNewAppointments: boolean;
    notifyOnMissedMedications: boolean;
    emergencyAlerts: boolean;
  };
}
```

## Implementation Phases

### Phase 1: Core Medical Calendar (2-3 weeks)
- Enhanced medical event data model
- Firebase Firestore schema implementation
- Basic calendar CRUD operations
- Medication schedule integration
- Family permission system

### Phase 2: Google Calendar Sync (1-2 weeks)
- Google Calendar API integration
- Two-way sync implementation
- Privacy-preserving sync rules
- Sync status monitoring

### Phase 3: Advanced Features (2-3 weeks)
- Multi-channel notification system
- Advanced family coordination features
- Calendar analytics and insights
- Mobile app integration

### Phase 4: Optimization (1 week)
- Performance optimization
- Advanced caching strategies
- Offline support
- Security audit

## Security Considerations

### Data Privacy
- Medical data encrypted at rest and in transit
- Google Calendar sync uses minimal, non-sensitive data
- Family access controls with audit logging
- HIPAA compliance maintained

### Access Control
- Role-based permissions for family members
- Emergency access protocols
- Session management and timeout
- API rate limiting and monitoring

## Technical Benefits of This Approach

### ✅ Advantages
1. **Rich Medical Context**: Store detailed medical metadata that Google Calendar can't support
2. **Family Coordination**: Multiple family members can access and coordinate care
3. **Privacy Control**: Sensitive medical data stays in your secure database
4. **Flexible Sync**: Users choose what to sync to personal calendars
5. **Offline Capability**: Core functionality works without Google Calendar
6. **Scalable**: Can add more calendar providers (Outlook, Apple) later

### ⚠️ Considerations
1. **Complexity**: More complex than pure Google Calendar integration
2. **Sync Conflicts**: Need to handle two-way sync carefully
3. **Storage Costs**: More data stored in your database
4. **Maintenance**: Need to maintain sync reliability

## Recommendation

I strongly recommend the **hybrid approach** because:

1. **Medical apps need rich metadata** that external calendars can't provide
2. **Family coordination** is crucial for patient care
3. **Privacy and compliance** are paramount in healthcare
4. **User choice** in what to sync gives flexibility
5. **Future-proof** - can integrate with other calendar systems

This approach gives you the best of both worlds: a powerful medical calendar with optional personal calendar integration for convenience.