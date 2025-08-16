# Data Migration Strategy

## Current State Assessment

### Existing Data Structures
Based on your current [`shared/types.ts`](shared/types.ts:202), you have:

```typescript
// Current appointment structure
interface Appointment {
  id: string;
  patientId: string;
  title: string;
  description: string;
  dateTime: Date;
  duration: number;
  location: string;
  provider: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Current medication reminder structure
interface MedicationReminder {
  id: string;
  medicationId: string;
  patientId: string;
  reminderTime: string;
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  isActive: boolean;
  lastNotified?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Migration Challenges
1. **Data Structure Changes**: Current `Appointment` → New `MedicalEvent` with rich metadata
2. **New Event Types**: Need to categorize existing appointments into medical event types
3. **Family Access**: No current family permission system
4. **Google Calendar**: No existing sync data
5. **Medication Integration**: Separate reminders need calendar integration

## Migration Strategy

### Phase 1: Schema Extension (Backward Compatible)

#### 1.1 Add New Collections (Non-Breaking)
```typescript
// Add new collections alongside existing ones
/patients/{patientId}/medicalEvents/{eventId}     // New medical calendar
/patients/{patientId}/appointments/{appointmentId} // Keep existing (deprecated)
/patients/{patientId}/medicationReminders/{reminderId} // Keep existing
/familyGroups/{groupId}/calendarAccess/{memberId} // New family permissions
/users/{userId}/googleCalendarSync                // New sync settings
```

#### 1.2 Create Migration Tracking
```typescript
interface MigrationStatus {
  patientId: string;
  migratedAppointments: boolean;
  migratedMedications: boolean;
  familyAccessSetup: boolean;
  googleCalendarConnected: boolean;
  migrationDate: Date;
  version: string; // "1.0" → "2.0"
}
```

### Phase 2: Data Transformation

#### 2.1 Appointment Migration Script
```typescript
async function migrateAppointments(patientId: string) {
  const appointments = await getExistingAppointments(patientId);
  
  for (const appointment of appointments) {
    const medicalEvent: MedicalEvent = {
      id: appointment.id, // Keep same ID for reference
      patientId: appointment.patientId,
      type: categorizeAppointment(appointment.title, appointment.description),
      title: appointment.title,
      description: appointment.description,
      startDateTime: appointment.dateTime,
      endDateTime: new Date(appointment.dateTime.getTime() + appointment.duration * 60000),
      
      medicalData: {
        provider: appointment.provider,
        location: appointment.location,
        appointmentType: inferAppointmentType(appointment.title),
        preparationInstructions: extractPreparationFromNotes(appointment.notes),
        followUpRequired: false, // Default, can be updated later
      },
      
      familyAccess: {
        createdBy: patientId, // Assume patient created it
        visibleTo: [patientId], // Default to patient only
        editableBy: [patientId],
        notifyMembers: [],
      },
      
      googleCalendar: {
        syncEnabled: false, // User can enable later
        syncStatus: 'disabled',
      },
      
      reminders: {
        enabled: true,
        times: [24 * 60, 2 * 60, 30], // 24h, 2h, 30min before
        methods: ['push'],
      },
      
      status: appointment.status,
      createdAt: appointment.createdAt,
      updatedAt: new Date(),
    };
    
    await saveMedicalEvent(medicalEvent);
  }
}

function categorizeAppointment(title: string, description?: string): MedicalEventType {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  if (text.includes('lab') || text.includes('blood') || text.includes('test')) {
    return MedicalEventType.LAB_RESULT;
  }
  if (text.includes('procedure') || text.includes('surgery') || text.includes('operation')) {
    return MedicalEventType.PROCEDURE;
  }
  if (text.includes('therapy') || text.includes('physical') || text.includes('rehab')) {
    return MedicalEventType.THERAPY_SESSION;
  }
  if (text.includes('follow') || text.includes('check')) {
    return MedicalEventType.FOLLOW_UP;
  }
  
  return MedicalEventType.APPOINTMENT; // Default
}
```

#### 2.2 Medication Reminder Migration
```typescript
async function migrateMedicationReminders(patientId: string) {
  const reminders = await getExistingMedicationReminders(patientId);
  const medications = await getMedications(patientId);
  
  for (const reminder of reminders) {
    const medication = medications.find(m => m.id === reminder.medicationId);
    if (!medication) continue;
    
    // Create recurring medication events
    const events = generateMedicationEvents(reminder, medication);
    
    for (const event of events) {
      await saveMedicalEvent(event);
    }
    
    // Mark original reminder as migrated but keep for reference
    await updateMedicationReminder(reminder.id, { 
      isActive: false,
      notes: 'Migrated to medical calendar system'
    });
  }
}

function generateMedicationEvents(
  reminder: MedicationReminder, 
  medication: Medication
): MedicalEvent[] {
  const events: MedicalEvent[] = [];
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  for (let date = startDate; date <= endDate; date.setDate(date.getDate() + 1)) {
    if (reminder.days.includes(getDayName(date))) {
      const [hours, minutes] = reminder.reminderTime.split(':').map(Number);
      const eventDateTime = new Date(date);
      eventDateTime.setHours(hours, minutes, 0, 0);
      
      events.push({
        id: `med-${reminder.id}-${date.toISOString().split('T')[0]}`,
        patientId: reminder.patientId,
        type: MedicalEventType.MEDICATION_SCHEDULE,
        title: `${medication.name} - ${medication.dosage}`,
        description: medication.instructions,
        startDateTime: eventDateTime,
        endDateTime: new Date(eventDateTime.getTime() + 15 * 60 * 1000), // 15 min duration
        
        medicalData: {
          relatedMedicationIds: [medication.id],
          preparationInstructions: medication.instructions ? [medication.instructions] : [],
        },
        
        familyAccess: {
          createdBy: reminder.patientId,
          visibleTo: [reminder.patientId],
          editableBy: [reminder.patientId],
          notifyMembers: [],
        },
        
        googleCalendar: {
          syncEnabled: false,
          syncStatus: 'disabled',
        },
        
        reminders: {
          enabled: true,
          times: [15, 5], // 15min, 5min before
          methods: ['push'],
        },
        
        status: 'scheduled',
        createdAt: reminder.createdAt,
        updatedAt: new Date(),
      });
    }
  }
  
  return events;
}
```

### Phase 3: Family Access Setup

#### 3.1 Default Family Permissions
```typescript
async function setupDefaultFamilyAccess(patientId: string) {
  const familyMembers = await getFamilyMembers(patientId);
  
  for (const member of familyMembers) {
    const permissions = determineDefaultPermissions(member.role);
    
    await createFamilyCalendarAccess({
      patientId,
      memberId: member.id,
      permissions,
      restrictions: {
        eventTypes: permissions.includes(CalendarPermission.VIEW_DETAILS) 
          ? undefined // All event types
          : [MedicalEventType.APPOINTMENT], // Basic appointments only
        emergencyOverride: true,
      },
    });
  }
}

function determineDefaultPermissions(role: string): CalendarPermission[] {
  switch (role) {
    case 'primary_caregiver':
      return [
        CalendarPermission.VIEW_DETAILS,
        CalendarPermission.EDIT_EVENTS,
        CalendarPermission.MANAGE_SCHEDULE,
        CalendarPermission.EMERGENCY_ACCESS,
      ];
    case 'family_member':
      return [
        CalendarPermission.VIEW_BASIC,
        CalendarPermission.VIEW_DETAILS,
      ];
    case 'caregiver':
      return [
        CalendarPermission.VIEW_DETAILS,
        CalendarPermission.EDIT_EVENTS,
      ];
    default:
      return [CalendarPermission.VIEW_BASIC];
  }
}
```

### Phase 4: Gradual Rollout

#### 4.1 Feature Flag System
```typescript
interface FeatureFlags {
  useNewCalendarSystem: boolean;
  enableGoogleCalendarSync: boolean;
  enableFamilyCalendarAccess: boolean;
  showMigrationPrompt: boolean;
}

// Gradual rollout strategy
const rolloutStrategy = {
  week1: { percentage: 10, criteria: 'beta_users' },
  week2: { percentage: 25, criteria: 'active_users' },
  week3: { percentage: 50, criteria: 'all_users' },
  week4: { percentage: 100, criteria: 'all_users' },
};
```

#### 4.2 Migration UI Flow
```typescript
// Show migration prompt to users
interface MigrationPrompt {
  title: "Upgrade to Enhanced Medical Calendar";
  description: "We've improved your calendar with better family coordination and Google Calendar sync.";
  benefits: [
    "Better family coordination",
    "Google Calendar integration", 
    "Medication schedule integration",
    "Enhanced medical event tracking"
  ];
  actions: [
    { label: "Upgrade Now", action: "migrate" },
    { label: "Learn More", action: "info" },
    { label: "Remind Me Later", action: "defer" }
  ];
}
```

## Migration Execution Plan

### Pre-Migration Checklist
- [ ] Backup all existing appointment and medication data
- [ ] Test migration scripts on staging environment
- [ ] Prepare rollback procedures
- [ ] Set up monitoring and error tracking
- [ ] Create user communication plan

### Migration Timeline

#### Week 1: Infrastructure Setup
- Deploy new database schema (backward compatible)
- Set up migration tracking system
- Deploy feature flags system
- Test migration scripts on staging

#### Week 2: Beta User Migration
- Migrate 10% of beta users
- Monitor for issues and performance
- Collect user feedback
- Refine migration process

#### Week 3: Gradual Rollout
- Migrate 25% of active users
- Monitor system performance
- Address any issues found
- Update documentation

#### Week 4: Full Migration
- Migrate remaining 75% of users
- Monitor system stability
- Provide user support
- Begin deprecation of old system

#### Week 5: Cleanup
- Mark old collections as deprecated
- Set up data retention policies
- Update API documentation
- Plan eventual removal of old system

### Rollback Strategy

#### Immediate Rollback (if critical issues)
```typescript
async function rollbackMigration(patientId: string) {
  // Disable new calendar system
  await updateFeatureFlag(patientId, 'useNewCalendarSystem', false);
  
  // Restore original appointment visibility
  await enableLegacyAppointmentSystem(patientId);
  
  // Log rollback for analysis
  await logMigrationEvent({
    patientId,
    action: 'rollback',
    reason: 'critical_issue',
    timestamp: new Date(),
  });
}
```

#### Data Integrity Checks
```typescript
async function validateMigration(patientId: string): Promise<boolean> {
  const originalAppointments = await getOriginalAppointments(patientId);
  const migratedEvents = await getMigratedMedicalEvents(patientId);
  
  // Check counts match
  if (originalAppointments.length !== migratedEvents.length) {
    return false;
  }
  
  // Check data integrity
  for (const appointment of originalAppointments) {
    const event = migratedEvents.find(e => e.id === appointment.id);
    if (!event || !validateEventData(appointment, event)) {
      return false;
    }
  }
  
  return true;
}
```

### Post-Migration Monitoring

#### Key Metrics to Track
- Migration success rate
- User adoption of new features
- System performance impact
- Error rates and types
- User satisfaction scores

#### Monitoring Dashboard
```typescript
interface MigrationMetrics {
  totalUsers: number;
  migratedUsers: number;
  migrationSuccessRate: number;
  averageMigrationTime: number;
  errorsByType: Record<string, number>;
  userFeedbackScore: number;
  systemPerformanceImpact: number;
}
```

This migration strategy ensures a smooth transition from your current appointment system to the enhanced medical calendar while maintaining data integrity and providing fallback options.