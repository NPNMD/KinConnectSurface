# Firestore Collections Schema for Medical Calendar

## Overview
This document defines the Firestore collections structure for the medical calendar system, including data models, relationships, and indexing strategies.

## Collections Structure

### 1. medical_events
**Purpose**: Core medical calendar events with rich metadata
**Document ID**: Auto-generated
**Security**: Patient-owned with family access controls

```typescript
{
  id: string,
  patientId: string, // Reference to users collection
  
  // Basic Event Information
  title: string,
  description?: string,
  eventType: MedicalEventType,
  priority: MedicalEventPriority,
  status: MedicalEventStatus,
  
  // Date and Time
  startDateTime: Timestamp,
  endDateTime: Timestamp,
  duration: number, // in minutes
  isAllDay: boolean,
  timeZone?: string,
  
  // Location Information
  location?: string,
  address?: string,
  facilityId?: string, // Reference to medical_facilities
  facilityName?: string, // Cached for performance
  room?: string,
  
  // Healthcare Provider Information
  providerId?: string, // Reference to healthcare_providers
  providerName?: string, // Cached for performance
  providerSpecialty?: string,
  providerPhone?: string,
  providerEmail?: string,
  
  // Medical Context
  medicalConditions?: string[],
  medications?: string[],
  allergies?: string[],
  specialInstructions?: string,
  preparationInstructions?: string,
  
  // Family Responsibility System
  requiresTransportation: boolean,
  responsiblePersonId?: string,
  responsiblePersonName?: string,
  responsibilityStatus: 'unassigned' | 'claimed' | 'confirmed' | 'declined' | 'completed',
  responsibilityClaimedAt?: Timestamp,
  responsibilityConfirmedAt?: Timestamp,
  transportationNotes?: string,
  accompanimentRequired?: boolean,
  
  // Recurring Event Information
  isRecurring: boolean,
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number,
    daysOfWeek?: number[],
    dayOfMonth?: number,
    endDate?: Timestamp,
    occurrences?: number
  },
  parentEventId?: string, // Reference to parent recurring event
  
  // Reminders and Notifications
  reminders: Array<{
    id: string,
    type: 'email' | 'sms' | 'push' | 'phone',
    minutesBefore: number,
    isActive: boolean,
    sentAt?: Timestamp
  }>,
  familyNotificationsSent?: Timestamp[],
  
  // Insurance and Financial
  insuranceRequired?: boolean,
  copayAmount?: number,
  preAuthRequired?: boolean,
  preAuthNumber?: string,
  
  // Results and Follow-up
  hasResults?: boolean,
  resultsAvailable?: boolean,
  resultsReviewedAt?: Timestamp,
  followUpRequired?: boolean,
  followUpDate?: Timestamp,
  followUpInstructions?: string,
  
  // Google Calendar Integration
  googleCalendarEventId?: string,
  syncedToGoogleCalendar?: boolean,
  lastSyncedAt?: Timestamp,
  syncErrors?: string[],
  
  // Metadata
  notes?: string,
  attachments?: Array<{
    id: string,
    name: string,
    type: string,
    url: string,
    uploadedAt: Timestamp
  }>,
  tags?: string[],
  
  // Audit Trail
  createdBy: string,
  createdAt: Timestamp,
  updatedBy?: string,
  updatedAt: Timestamp,
  version: number
}
```

### 2. family_calendar_access
**Purpose**: Controls family member access to patient calendars
**Document ID**: `{familyMemberId}_{patientId}`
**Security**: Patient and family member read/write

```typescript
{
  id: string,
  patientId: string, // Reference to users collection
  familyMemberId: string, // Reference to users collection
  familyMemberName: string,
  familyMemberEmail: string,
  
  // Access Permissions
  permissions: {
    canView: boolean,
    canCreate: boolean,
    canEdit: boolean,
    canDelete: boolean,
    canClaimResponsibility: boolean,
    canManageFamily: boolean,
    canViewMedicalDetails: boolean,
    canReceiveNotifications: boolean
  },
  
  // Access Scope
  accessLevel: 'full' | 'limited' | 'emergency_only',
  eventTypesAllowed?: MedicalEventType[], // If limited access
  
  // Emergency Access
  emergencyAccess: boolean,
  emergencyContactPriority?: number, // 1 = primary emergency contact
  
  // Status and Audit
  status: 'active' | 'suspended' | 'revoked',
  invitedAt: Timestamp,
  acceptedAt?: Timestamp,
  lastAccessAt?: Timestamp,
  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3. calendar_view_settings
**Purpose**: User-specific calendar view preferences
**Document ID**: `{userId}_{patientId}`
**Security**: User-owned

```typescript
{
  id: string,
  userId: string,
  patientId: string,
  
  // View Preferences
  defaultView: 'month' | 'week' | 'day' | 'agenda',
  timeFormat: '12h' | '24h',
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6, // 0 = Sunday
  
  // Filter Settings
  eventTypesVisible: MedicalEventType[],
  prioritiesVisible: MedicalEventPriority[],
  statusesVisible: MedicalEventStatus[],
  providersVisible: string[], // Provider IDs
  facilitiesVisible: string[], // Facility IDs
  
  // Display Options
  showMedicalDetails: boolean,
  showFamilyResponsibility: boolean,
  showReminders: boolean,
  colorCoding: 'eventType' | 'priority' | 'provider' | 'facility',
  
  // Notification Preferences
  emailNotifications: boolean,
  smsNotifications: boolean,
  pushNotifications: boolean,
  reminderDefaults: number[], // Default reminder times in minutes
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 4. google_calendar_sync_settings
**Purpose**: Google Calendar integration settings
**Document ID**: `{userId}_{patientId}`
**Security**: User-owned

```typescript
{
  id: string,
  userId: string,
  patientId: string,
  
  // Google Account Information
  googleAccountEmail: string,
  googleCalendarId: string,
  googleCalendarName: string,
  accessToken: string, // Encrypted
  refreshToken: string, // Encrypted
  tokenExpiresAt: Timestamp,
  
  // Sync Configuration
  syncEnabled: boolean,
  syncDirection: 'one_way_to_google' | 'one_way_from_google' | 'two_way',
  syncFrequency: 'real_time' | 'hourly' | 'daily',
  
  // Privacy Settings
  includeEventTypes: MedicalEventType[],
  includeMedicalDetails: boolean,
  includeProviderInfo: boolean,
  includeFamilyInfo: boolean,
  customEventTitleTemplate?: string, // e.g., "Medical Appointment"
  
  // Sync Status
  lastSyncAt?: Timestamp,
  lastSyncStatus: 'success' | 'error' | 'partial',
  syncErrors?: string[],
  totalEventsSynced: number,
  
  // Conflict Resolution
  conflictResolution: 'google_wins' | 'app_wins' | 'manual_review',
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 5. family_notifications
**Purpose**: Notifications sent to family members about calendar events
**Document ID**: Auto-generated
**Security**: Patient and recipient read access

```typescript
{
  id: string,
  patientId: string,
  appointmentId: string, // Reference to medical_events
  recipientId: string, // Family member receiving notification
  recipientEmail: string,
  recipientName: string,
  notificationType: 'appointment_created' | 'responsibility_needed' | 'responsibility_claimed' | 'appointment_reminder' | 'appointment_cancelled',
  message: string,
  sentAt: Timestamp,
  readAt?: Timestamp,
  actionTaken?: 'claimed' | 'declined' | 'acknowledged',
  actionTakenAt?: Timestamp,
  createdAt: Timestamp
}
```

### 6. appointment_responsibilities
**Purpose**: Track family member responsibilities for appointments
**Document ID**: Auto-generated
**Security**: Patient and responsible person access

```typescript
{
  id: string,
  appointmentId: string, // Reference to medical_events
  patientId: string,
  responsiblePersonId: string,
  responsiblePersonName: string,
  status: 'claimed' | 'confirmed' | 'declined' | 'completed',
  claimedAt: Timestamp,
  confirmedAt?: Timestamp,
  completedAt?: Timestamp,
  transportationNotes?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Existing Collections (Enhanced for Calendar Integration)

### healthcare_providers
**Enhanced Fields for Calendar Integration**:
- `nextAppointment?: Timestamp` - Next scheduled appointment
- `lastVisit?: Timestamp` - Last visit date
- `typicalWaitTime?: string` - For scheduling estimates
- `preferredAppointmentTime?: string` - Scheduling preferences

### medical_facilities
**Enhanced Fields for Calendar Integration**:
- `isPreferred?: boolean` - Preferred facility flag
- `emergencyServices?: boolean` - Emergency capability
- `services?: string[]` - Available services

## Indexing Strategy

### Primary Indexes (Composite)
1. **medical_events**: `patientId + startDateTime` (ASC/ASC)
2. **medical_events**: `patientId + eventType + startDateTime` (ASC/ASC/ASC)
3. **medical_events**: `patientId + status + startDateTime` (ASC/ASC/ASC)
4. **medical_events**: `responsiblePersonId + startDateTime` (ASC/ASC)
5. **family_calendar_access**: `patientId + status + createdAt` (ASC/ASC/DESC)
6. **family_calendar_access**: `familyMemberId + status + lastAccessAt` (ASC/ASC/DESC)

### Secondary Indexes
- **medical_events**: `patientId + priority + startDateTime` (ASC/DESC/ASC)
- **medical_events**: `patientId + providerId + startDateTime` (ASC/ASC/ASC)
- **medical_events**: `patientId + facilityId + startDateTime` (ASC/ASC/ASC)
- **family_notifications**: `recipientId + readAt + sentAt` (ASC/ASC/DESC)

## Data Relationships

### One-to-Many Relationships
- `users` → `medical_events` (via patientId)
- `users` → `family_calendar_access` (via patientId and familyMemberId)
- `healthcare_providers` → `medical_events` (via providerId)
- `medical_facilities` → `medical_events` (via facilityId)
- `medical_events` → `family_notifications` (via appointmentId)

### Many-to-Many Relationships
- `users` ↔ `users` (via family_calendar_access)
- `medical_events` ↔ `medications` (via medications array)

## Security Considerations

### Access Control Patterns
1. **Patient-Owned Data**: Direct ownership via patientId
2. **Family Access**: Controlled via family_calendar_access permissions
3. **Provider Access**: Limited read access via patient_access collection
4. **Emergency Access**: Special permissions for emergency contacts

### Data Privacy
1. **Medical Details**: Restricted based on family member permissions
2. **Provider Information**: Cached for performance but access-controlled
3. **Google Calendar Sync**: Privacy-preserving with configurable detail levels
4. **Audit Trail**: All modifications tracked with user attribution

## Performance Optimizations

### Caching Strategy
1. **Provider/Facility Names**: Cached in medical_events for display performance
2. **Family Member Names**: Cached to reduce lookup queries
3. **View Settings**: Cached client-side with periodic sync

### Query Optimization
1. **Date Range Queries**: Optimized with startDateTime indexes
2. **Filter Combinations**: Composite indexes for common filter patterns
3. **Family Access**: Efficient permission checking with dedicated collection
4. **Pagination**: Cursor-based pagination for large result sets

## Migration Strategy

### Phase 1: Schema Creation
1. Create new collections with proper indexes
2. Set up security rules
3. Deploy schema changes

### Phase 2: Data Migration
1. Migrate existing appointment data to medical_events
2. Create family_calendar_access records for existing family relationships
3. Set up default calendar_view_settings

### Phase 3: Feature Rollout
1. Enable new calendar features gradually
2. Monitor performance and adjust indexes as needed
3. Collect user feedback and iterate

## Monitoring and Maintenance

### Key Metrics
- Query performance (< 200ms target)
- Index utilization rates
- Storage costs
- Security rule violations

### Regular Tasks
- Index optimization based on query patterns
- Security rule audits
- Data cleanup for old notifications
- Performance monitoring and alerting