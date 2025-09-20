# Medication System Enhancements - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the comprehensive medication system enhancements, including data migration strategies, testing procedures, and rollback plans.

## Pre-Deployment Checklist

### 1. Environment Preparation
- [ ] Firebase Functions updated to Node.js 20
- [ ] Required dependencies installed in functions package
- [ ] Environment variables configured
- [ ] Database backup completed
- [ ] Monitoring alerts configured

### 2. Dependencies Update

**Update [`functions/package.json`](functions/package.json)**
```json
{
  "dependencies": {
    // ... existing dependencies ...
    "@google-cloud/scheduler": "^3.0.0",
    "node-cron": "^3.0.3",
    "moment-timezone": "^0.5.43"
  }
}
```

### 3. Environment Variables
```bash
# Add to Firebase Functions config
firebase functions:config:set \
  medication.grace_period_check_interval="15" \
  medication.compliance_check_interval="60" \
  medication.lifecycle_check_interval="1440" \
  notification.max_daily_limit="10" \
  notification.quiet_hours_default="22:00-07:00"
```

---

## Deployment Strategy

### Phase 1: Infrastructure Setup (Week 1)

#### Step 1.1: Database Schema Updates

**Create new collections with proper indexes:**

```bash
# Deploy Firestore indexes first
firebase deploy --only firestore:indexes

# Deploy security rules
firebase deploy --only firestore:rules
```

**Initialize default data:**
```typescript
// Run once after deployment
async function initializeDefaultConfigurations() {
  const batch = admin.firestore().batch();
  
  // Create default grace period configurations for existing patients
  const patientsQuery = await admin.firestore().collection('users')
    .where('userType', '==', 'patient')
    .get();
  
  for (const patientDoc of patientsQuery.docs) {
    const defaultGraceConfig = {
      patientId: patientDoc.id,
      defaultGracePeriods: {
        morning: 30,
        noon: 45,
        evening: 30,
        bedtime: 60
      },
      medicationOverrides: [],
      medicationTypeRules: [
        { medicationType: 'critical', gracePeriodMinutes: 15 },
        { medicationType: 'standard', gracePeriodMinutes: 30 },
        { medicationType: 'vitamin', gracePeriodMinutes: 120 },
        { medicationType: 'prn', gracePeriodMinutes: 0 }
      ],
      weekendMultiplier: 1.5,
      holidayMultiplier: 2.0,
      sickDayMultiplier: 3.0,
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const graceConfigRef = admin.firestore().collection('medication_grace_periods').doc(patientDoc.id);
    batch.set(graceConfigRef, defaultGraceConfig);
  }
  
  await batch.commit();
  console.log(`✅ Initialized grace period configurations for ${patientsQuery.docs.length} patients`);
}
```

#### Step 1.2: Deploy Core Services

**Deploy functions incrementally:**
```bash
# Deploy grace period engine first
firebase deploy --only functions:gracePeriodEngine

# Test grace period calculations
node test-grace-period-engine.js

# Deploy missed detection service
firebase deploy --only functions:missedMedicationDetector

# Deploy lifecycle manager
firebase deploy --only functions:eventLifecycleManager
```

### Phase 2: Night Shift Migration (Week 2)

#### Step 2.1: Migration Detection

**Deploy migration detection service:**
```typescript
// New file: scripts/detect-night-shift-migrations.js
const admin = require('firebase-admin');
const { NightShiftMigrationService } = require('../functions/lib/services/nightShiftMigrationService');

async function detectAndNotifyMigrations() {
  admin.initializeApp();
  
  const migrationService = new NightShiftMigrationService();
  const candidates = await migrationService.detectMigrationCandidates();
  
  console.log(`🔍 Found ${candidates.length} patients needing night shift migration`);
  
  // Create migration records and send notifications
  for (const candidate of candidates) {
    const migrationId = await migrationService.createMigrationRecord(candidate);
    await migrationService.sendMigrationNotification(candidate, migrationId);
    console.log(`📧 Migration notification sent to ${candidate.patientEmail}`);
  }
  
  return candidates;
}

// Run detection
detectAndNotifyMigrations()
  .then(candidates => {
    console.log(`✅ Migration detection completed. ${candidates.length} patients notified.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration detection failed:', error);
    process.exit(1);
  });
```

#### Step 2.2: Migration Execution

**Deploy migration endpoints:**
```bash
# Deploy migration API endpoints
firebase deploy --only functions:api

# Test migration detection
curl -X GET "https://us-central1-claritystream-uldp9.cloudfunctions.net/api/patients/night-shift-migration/detect" \
  -H "Authorization: Bearer $TEST_TOKEN"

# Test migration execution (dry run)
curl -X POST "https://us-central1-claritystream-uldp9.cloudfunctions.net/api/patients/night-shift-migration/execute" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"migrationId": "test_migration_id", "approved": false}'
```

### Phase 3: Missed Detection System (Week 3)

#### Step 3.1: Gradual Rollout

**Enable missed detection with monitoring:**
```typescript
// Deployment script: scripts/enable-missed-detection.js
async function enableMissedDetection() {
  // Start with a small subset of patients for testing
  const testPatients = await getTestPatients(10); // 10 test patients
  
  for (const patientId of testPatients) {
    await enableMissedDetectionForPatient(patientId);
  }
  
  // Monitor for 24 hours before full rollout
  console.log('✅ Missed detection enabled for test patients. Monitor for 24 hours.');
}

async function enableMissedDetectionForPatient(patientId: string) {
  await admin.firestore().collection('medication_grace_periods').doc(patientId).update({
    missedDetectionEnabled: true,
    enabledAt: admin.firestore.Timestamp.now()
  });
}
```

#### Step 3.2: Full Rollout

**After successful testing:**
```bash
# Deploy missed detection for all patients
firebase deploy --only functions:missedMedicationDetector

# Monitor function execution
firebase functions:log --only missedMedicationDetector

# Verify detection accuracy
node scripts/verify-missed-detection-accuracy.js
```

### Phase 4: Compliance Monitoring (Week 4)

#### Step 4.1: Default Compliance Rules

**Create default compliance rules for all patients:**
```typescript
// Script: scripts/setup-default-compliance-rules.js
async function setupDefaultComplianceRules() {
  const patientsQuery = await admin.firestore().collection('users')
    .where('userType', '==', 'patient')
    .get();
  
  const batch = admin.firestore().batch();
  
  for (const patientDoc of patientsQuery.docs) {
    // Basic adherence threshold rule
    const adherenceRule = {
      patientId: patientDoc.id,
      ruleName: 'Basic Adherence Monitoring',
      ruleType: 'adherence_threshold',
      adherenceThresholdPercent: 80,
      timeWindowDays: 7,
      medicationIds: [], // All medications
      medicationTypes: ['critical', 'standard'],
      notificationRules: {
        notifyPatient: true,
        notifyFamily: false, // Start conservative
        notifyProvider: false,
        escalationDelayHours: 24,
        maxNotificationsPerDay: 2
      },
      autoActions: [],
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const ruleRef = admin.firestore().collection('medication_compliance_rules').doc();
    batch.set(ruleRef, adherenceRule);
    
    // Consecutive missed rule for critical medications
    const consecutiveRule = {
      patientId: patientDoc.id,
      ruleName: 'Critical Medication Monitoring',
      ruleType: 'consecutive_missed',
      consecutiveMissedThreshold: 2,
      timeWindowDays: 3,
      medicationIds: [],
      medicationTypes: ['critical'],
      notificationRules: {
        notifyPatient: true,
        notifyFamily: true, // More aggressive for critical meds
        notifyProvider: false,
        escalationDelayHours: 4,
        maxNotificationsPerDay: 5
      },
      autoActions: [
        {
          actionType: 'create_reminder',
          triggerCondition: 'consecutive_missed >= 2',
          actionData: { reminderType: 'urgent', delayMinutes: 30 }
        }
      ],
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const consecutiveRuleRef = admin.firestore().collection('medication_compliance_rules').doc();
    batch.set(consecutiveRuleRef, consecutiveRule);
  }
  
  await batch.commit();
  console.log(`✅ Created default compliance rules for ${patientsQuery.docs.length} patients`);
}
```

---

## Data Migration Procedures

### 1. Night Shift Time Configuration Migration

#### Pre-Migration Analysis
```typescript
// Script: scripts/analyze-night-shift-impact.js
async function analyzeNightShiftImpact() {
  const analysis = {
    patientsAffected: 0,
    medicationsAffected: 0,
    schedulesAffected: 0,
    futureEventsAffected: 0,
    estimatedUserImpact: 'low' | 'medium' | 'high'
  };
  
  // Find night shift patients
  const nightShiftQuery = await admin.firestore().collection('patient_medication_preferences')
    .where('workSchedule', '==', 'night_shift')
    .get();
  
  analysis.patientsAffected = nightShiftQuery.docs.length;
  
  for (const patientDoc of nightShiftQuery.docs) {
    const patientId = patientDoc.id;
    
    // Check for 2 AM medication times
    const schedulesQuery = await admin.firestore().collection('medication_schedules')
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .get();
    
    for (const scheduleDoc of schedulesQuery.docs) {
      const schedule = scheduleDoc.data();
      
      if (schedule.times?.includes('02:00')) {
        analysis.schedulesAffected++;
        
        // Count future events
        const futureEventsQuery = await admin.firestore().collection('medication_calendar_events')
          .where('medicationScheduleId', '==', scheduleDoc.id)
          .where('status', '==', 'scheduled')
          .where('scheduledDateTime', '>', admin.firestore.Timestamp.now())
          .get();
        
        analysis.futureEventsAffected += futureEventsQuery.docs.length;
      }
    }
  }
  
  // Determine impact level
  if (analysis.futureEventsAffected > 100) {
    analysis.estimatedUserImpact = 'high';
  } else if (analysis.futureEventsAffected > 20) {
    analysis.estimatedUserImpact = 'medium';
  } else {
    analysis.estimatedUserImpact = 'low';
  }
  
  console.log('📊 Night Shift Migration Impact Analysis:', analysis);
  return analysis;
}
```

#### Migration Execution Script
```typescript
// Script: scripts/execute-night-shift-migration.js
async function executeNightShiftMigration(migrationId: string, dryRun: boolean = true) {
  const migrationDoc = await admin.firestore().collection('night_shift_migrations').doc(migrationId).get();
  const migration = migrationDoc.data();
  
  if (!migration) {
    throw new Error('Migration not found');
  }
  
  console.log(`🔄 ${dryRun ? 'DRY RUN' : 'EXECUTING'} migration for patient: ${migration.patientId}`);
  
  const changes = {
    preferencesUpdated: false,
    schedulesUpdated: 0,
    eventsUpdated: 0,
    errors: [] as string[]
  };
  
  try {
    if (!dryRun) {
      // Update patient preferences
      await admin.firestore().collection('patient_medication_preferences').doc(migration.patientId).update({
        'timeSlots.evening': {
          start: '23:00',
          end: '02:00',
          defaultTime: '00:00',
          label: 'Evening'
        },
        updatedAt: admin.firestore.Timestamp.now(),
        migratedAt: admin.firestore.Timestamp.now(),
        migrationId: migrationId
      });
      changes.preferencesUpdated = true;
    }
    
    // Update medication schedules
    for (const medication of migration.affectedMedications) {
      if (!dryRun) {
        await admin.firestore().collection('medication_schedules').doc(medication.scheduleId).update({
          times: medication.suggestedTimes,
          updatedAt: admin.firestore.Timestamp.now(),
          migratedAt: admin.firestore.Timestamp.now(),
          migrationId: migrationId
        });
      }
      changes.schedulesUpdated++;
      
      // Update future calendar events
      const futureEventsQuery = await admin.firestore().collection('medication_calendar_events')
        .where('medicationScheduleId', '==', medication.scheduleId)
        .where('status', '==', 'scheduled')
        .where('scheduledDateTime', '>', admin.firestore.Timestamp.now())
        .get();
      
      if (!dryRun) {
        const batch = admin.firestore().batch();
        
        for (const eventDoc of futureEventsQuery.docs) {
          const event = eventDoc.data();
          const scheduledTime = event.scheduledDateTime.toDate();
          
          // If scheduled at 2 AM, change to midnight
          if (scheduledTime.getHours() === 2 && scheduledTime.getMinutes() === 0) {
            const newTime = new Date(scheduledTime);
            newTime.setHours(0, 0, 0, 0); // Midnight
            
            batch.update(eventDoc.ref, {
              scheduledDateTime: admin.firestore.Timestamp.fromDate(newTime),
              updatedAt: admin.firestore.Timestamp.now(),
              migratedAt: admin.firestore.Timestamp.now(),
              migrationId: migrationId
            });
            changes.eventsUpdated++;
          }
        }
        
        if (batch._writes.length > 0) {
          await batch.commit();
        }
      } else {
        changes.eventsUpdated += futureEventsQuery.docs.length;
      }
    }
    
    if (!dryRun) {
      // Update migration status
      await migrationDoc.ref.update({
        migrationStatus: 'completed',
        migratedAt: admin.firestore.Timestamp.now(),
        migrationResults: changes,
        updatedAt: admin.firestore.Timestamp.now()
      });
    }
    
    console.log(`✅ Migration ${dryRun ? 'simulation' : 'execution'} completed:`, changes);
    return changes;
    
  } catch (error) {
    console.error(`❌ Migration ${dryRun ? 'simulation' : 'execution'} failed:`, error);
    changes.errors.push(error instanceof Error ? error.message : 'Unknown error');
    
    if (!dryRun) {
      await migrationDoc.ref.update({
        migrationStatus: 'failed',
        migrationError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: admin.firestore.Timestamp.now()
      });
    }
    
    throw error;
  }
}
```

### Phase 2: Missed Detection Rollout (Week 3)

#### Step 2.1: Gradual Enablement

**Test with subset of patients:**
```typescript
// Script: scripts/gradual-missed-detection-rollout.js
async function gradualMissedDetectionRollout() {
  const phases = [
    { name: 'Alpha', patientCount: 10, duration: '24 hours' },
    { name: 'Beta', patientCount: 50, duration: '48 hours' },
    { name: 'Gamma', patientCount: 200, duration: '72 hours' },
    { name: 'Full', patientCount: -1, duration: 'ongoing' }
  ];
  
  for (const phase of phases) {
    console.log(`🚀 Starting ${phase.name} phase: ${phase.patientCount} patients for ${phase.duration}`);
    
    const patients = await getPatientCohort(phase.patientCount);
    
    for (const patientId of patients) {
      await enableMissedDetectionForPatient(patientId, phase.name);
    }
    
    // Monitor phase
    await monitorPhaseExecution(phase);
    
    // Wait for phase completion before next phase
    if (phase.name !== 'Full') {
      await waitForPhaseCompletion(phase);
    }
  }
}

async function monitorPhaseExecution(phase: any) {
  // Set up monitoring for this phase
  const monitoring = {
    detectionAccuracy: 0,
    falsePositives: 0,
    userComplaints: 0,
    systemErrors: 0
  };
  
  // Log metrics for analysis
  console.log(`📊 ${phase.name} phase monitoring:`, monitoring);
}
```

#### Step 2.2: Validation and Monitoring

**Validation script:**
```typescript
// Script: scripts/validate-missed-detection.js
async function validateMissedDetection() {
  const validation = {
    totalEventsChecked: 0,
    correctlyDetected: 0,
    falsePositives: 0,
    falseNegatives: 0,
    accuracy: 0
  };
  
  // Get recent missed detections
  const recentMissedQuery = await admin.firestore().collection('medication_calendar_events')
    .where('status', '==', 'missed')
    .where('missedReason', '==', 'automatic_detection')
    .where('missedAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .get();
  
  for (const doc of recentMissedQuery.docs) {
    const event = doc.data();
    validation.totalEventsChecked++;
    
    // Validate detection accuracy
    const isCorrectlyMissed = await validateEventMissedStatus(event);
    
    if (isCorrectlyMissed) {
      validation.correctlyDetected++;
    } else {
      validation.falsePositives++;
      console.warn(`⚠️ False positive detected: Event ${doc.id}`);
    }
  }
  
  validation.accuracy = validation.totalEventsChecked > 0 ? 
    (validation.correctlyDetected / validation.totalEventsChecked) * 100 : 0;
  
  console.log('📊 Missed Detection Validation Results:', validation);
  
  // Alert if accuracy is below threshold
  if (validation.accuracy < 95) {
    console.error('🚨 ALERT: Missed detection accuracy below 95%');
    await sendAlertToDevTeam(validation);
  }
  
  return validation;
}
```

### Phase 3: Compliance Monitoring (Week 4)

#### Step 3.1: Compliance Rules Deployment

**Deploy compliance monitoring:**
```bash
# Deploy compliance monitor function
firebase deploy --only functions:complianceMonitor

# Initialize default compliance rules
node scripts/setup-default-compliance-rules.js

# Test compliance evaluation
node scripts/test-compliance-evaluation.js
```

#### Step 3.2: Family Notification System

**Deploy notification system:**
```bash
# Deploy family notification processor
firebase deploy --only functions:familyNotificationProcessor

# Test notification delivery
node scripts/test-family-notifications.js

# Set up notification monitoring
node scripts/setup-notification-monitoring.js
```

---

## Testing Procedures

### 1. Unit Testing

#### Grace Period Engine Tests
```typescript
// tests/gracePeriodEngine.test.ts
describe('GracePeriodEngine', () => {
  let engine: GracePeriodEngine;
  
  beforeEach(() => {
    engine = new GracePeriodEngine();
  });
  
  test('should calculate correct grace period for standard medication', async () => {
    const mockEvent = {
      medicationId: 'test-med-1',
      scheduledDateTime: admin.firestore.Timestamp.fromDate(new Date('2024-01-01T07:00:00Z')),
      patientId: 'test-patient-1'
    };
    
    const result = await engine.calculateGracePeriod(mockEvent, 'test-patient-1');
    
    expect(result.gracePeriodMinutes).toBe(30); // Default morning grace period
    expect(result.appliedRules).toContain('default_morning');
  });
  
  test('should apply weekend multiplier correctly', async () => {
    const weekendDate = new Date('2024-01-06T07:00:00Z'); // Saturday
    const mockEvent = {
      medicationId: 'test-med-1',
      scheduledDateTime: admin.firestore.Timestamp.fromDate(weekendDate),
      patientId: 'test-patient-1'
    };
    
    const result = await engine.calculateGracePeriod(mockEvent, 'test-patient-1', weekendDate);
    
    expect(result.gracePeriodMinutes).toBe(45); // 30 * 1.5 weekend multiplier
    expect(result.appliedRules).toContain('weekend_multiplier');
    expect(result.isWeekend).toBe(true);
  });
  
  test('should prioritize medication-specific overrides', async () => {
    // Mock patient config with medication override
    const mockConfig = {
      defaultGracePeriods: { morning: 30 },
      medicationOverrides: [
        { medicationId: 'critical-med-1', gracePeriodMinutes: 10, reason: 'critical_medication' }
      ]
    };
    
    const mockEvent = {
      medicationId: 'critical-med-1',
      scheduledDateTime: admin.firestore.Timestamp.fromDate(new Date('2024-01-01T07:00:00Z')),
      patientId: 'test-patient-1'
    };
    
    // Mock the getPatientGraceConfig method
    jest.spyOn(engine as any, 'getPatientGraceConfig').mockResolvedValue(mockConfig);
    
    const result = await engine.calculateGracePeriod(mockEvent, 'test-patient-1');
    
    expect(result.gracePeriodMinutes).toBe(10);
    expect(result.appliedRules).toContain('medication_override');
  });
});
```

#### Missed Detection Tests
```typescript
// tests/missedMedicationDetector.test.ts
describe('MissedMedicationDetector', () => {
  let detector: MissedMedicationDetector;
  
  beforeEach(() => {
    detector = new MissedMedicationDetector();
  });
  
  test('should detect missed medication after grace period', async () => {
    const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    
    const mockEvent = {
      id: 'test-event-1',
      status: 'scheduled',
      scheduledDateTime: admin.firestore.Timestamp.fromDate(pastTime),
      medicationId: 'test-med-1',
      patientId: 'test-patient-1'
    };
    
    // Mock Firestore query
    const mockQuery = {
      docs: [{ id: 'test-event-1', data: () => mockEvent, ref: { update: jest.fn() } }]
    };
    
    jest.spyOn(detector as any, 'firestore').mockReturnValue({
      collection: () => ({
        where: () => ({
          where: () => ({
            where: () => ({
              limit: () => ({
                get: () => Promise.resolve(mockQuery)
              })
            })
          })
        })
      })
    });
    
    const results = await detector.detectMissedMedications();
    
    expect(results.missed).toBeGreaterThan(0);
    expect(results.processed).toBeGreaterThan(0);
  });
  
  test('should not mark as missed if within grace period', async () => {
    const recentTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    
    const mockEvent = {
      id: 'test-event-2',
      status: 'scheduled',
      scheduledDateTime: admin.firestore.Timestamp.fromDate(recentTime),
      medicationId: 'test-med-1',
      patientId: 'test-patient-1'
    };
    
    // Test should verify event remains scheduled
    // Implementation details...
  });
});
```

### 2. Integration Testing

#### End-to-End Medication Lifecycle Test
```typescript
// tests/integration/medicationLifecycle.test.ts
describe('Medication Lifecycle Integration', () => {
  test('complete medication lifecycle from schedule to archive', async () => {
    // 1. Create medication and schedule
    const medication = await createTestMedication();
    const schedule = await createTestSchedule(medication.id);
    
    // 2. Generate calendar events
    await generateCalendarEvents(schedule.id);
    
    // 3. Simulate time passage and missed detection
    await simulateTimePassing(2, 'hours');
    await runMissedDetection();
    
    // 4. Verify missed status
    const events = await getMedicationEvents(medication.id);
    expect(events.some(e => e.status === 'missed')).toBe(true);
    
    // 5. Simulate archival process
    await simulateTimePassing(365, 'days');
    await runEventLifecycleManager();
    
    // 6. Verify archival
    const archivedEvents = await getArchivedEvents(medication.id);
    expect(archivedEvents.length).toBeGreaterThan(0);
  });
});
```

### 3. Performance Testing

#### Load Testing Script
```typescript
// tests/performance/loadTest.js
async function performanceTest() {
  const testScenarios = [
    {
      name: 'Missed Detection Under Load',
      patientCount: 1000,
      eventsPerPatient: 50,
      expectedProcessingTime: 300000 // 5 minutes
    },
    {
      name: 'Grace Period Calculation Performance',
      calculationsPerSecond: 100,
      duration: 60000, // 1 minute
      expectedAverageTime: 50 // 50ms per calculation
    },
    {
      name: 'Compliance Monitoring Scalability',
      patientCount: 500,
      rulesPerPatient: 3,
      expectedProcessingTime: 600000 // 10 minutes
    }
  ];
  
  for (const scenario of testScenarios) {
    console.log(`🧪 Running performance test: ${scenario.name}`);
    const results = await runPerformanceScenario(scenario);
    
    if (results.processingTime > scenario.expectedProcessingTime) {
      console.error(`❌ Performance test failed: ${scenario.name}`);
      console.error(`Expected: ${scenario.expectedProcessingTime}ms, Actual: ${results.processingTime}ms`);
    } else {
      console.log(`✅ Performance test passed: ${scenario.name}`);
    }
  }
}
```

---

## Monitoring and Alerting Setup

### 1. Cloud Monitoring Metrics

```typescript
// monitoring/medicationSystemMetrics.ts
export const MEDICATION_METRICS = {
  // Missed Detection Metrics
  MISSED_DETECTION_ACCURACY: 'medication/missed_detection_accuracy',
  MISSED_DETECTION_LATENCY: 'medication/missed_detection_latency',
  FALSE_POSITIVE_RATE: 'medication/false_positive_rate',
  
  // Grace Period Metrics
  GRACE_PERIOD_CALCULATION_TIME: 'medication/grace_period_calc_time',
  GRACE_PERIOD_CACHE_HIT_RATE: 'medication/grace_period_cache_hits',
  
  // Compliance Metrics
  COMPLIANCE_RULE_EVALUATION_TIME: 'medication/compliance_eval_time',
  COMPLIANCE_ALERTS_GENERATED: 'medication/compliance_alerts_count',
  
  // Notification Metrics
  NOTIFICATION_DELIVERY_SUCCESS_RATE: 'medication/notification_success_rate',
  NOTIFICATION_PROCESSING_TIME: 'medication/notification_processing_time',
  
  // Lifecycle Metrics
  EVENTS_ARCHIVED_PER_DAY: 'medication/events_archived_daily',
  ARCHIVAL_PROCESSING_TIME: 'medication/archival_processing_time'
};

export function recordMetric(metricName: string, value: number, labels?: Record<string, string>) {
  // Implementation for recording custom metrics
  console.log(`📊 Metric: ${metricName} = ${value}`, labels);
}
```

### 2. Alert Configurations

```yaml
# monitoring/alerts.yaml
alertPolicy:
  displayName: "Medication System Health"
  conditions:
    - displayName: "Missed Detection Accuracy Below 95%"
      conditionThreshold:
        filter: 'metric.type="medication/missed_detection_accuracy"'
        comparison: COMPARISON_LESS_THAN
        thresholdValue: 95
        duration: 300s
      
    - displayName: "Grace Period Calculation Latency High"
      conditionThreshold:
        filter: 'metric.type="medication/grace_period_calc_time"'
        comparison: COMPARISON_GREATER_THAN
        thresholdValue: 100 # 100ms
        duration: 180s
        
    - displayName: "Notification Delivery Failure Rate High"
      conditionThreshold:
        filter: 'metric.type="medication/notification_success_rate"'
        comparison: COMPARISON_LESS_THAN
        thresholdValue: 90
        duration: 600s

notificationChannels:
  - type: email
    labels:
      email_address: "alerts@kinconnect.app"
  - type: slack
    labels:
      channel_name: "#medication-alerts"
```

---

## Rollback Procedures

### 1. Emergency Rollback Plan

```typescript
// scripts/emergency-rollback.js
async function emergencyRollback(component: string) {
  console.log(`🚨 EMERGENCY ROLLBACK: ${component}`);
  
  switch (component) {
    case 'missed_detection':
      await rollbackMissedDetection();
      break;
    case 'grace_periods':
      await rollbackGracePeriods();
      break;
    case 'compliance_monitoring':
      await rollbackComplianceMonitoring();
      break;
    case 'night_shift_migration':
      await rollbackNightShiftMigration();
      break;
    default:
      await fullSystemRollback();
  }
}

async function rollbackMissedDetection() {
  // 1. Disable scheduled function
  await disableScheduledFunction('missedMedicationDetector');
  
  // 2. Revert recent missed status changes
  const recentMissedQuery = await admin.firestore().collection('medication_calendar_events')
    .where('status', '==', 'missed')
    .where('missedReason', '==', 'automatic_detection')
    .where('missedAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000))) // Last hour
    .get();
  
  const batch = admin.firestore().batch();
  
  for (const doc of recentMissedQuery.docs) {
    batch.update(doc.ref, {
      status: 'scheduled', // Revert to scheduled
      missedAt: admin.firestore.FieldValue.delete(),
      missedReason: admin.firestore.FieldValue.delete(),
      rollbackAt: admin.firestore.Timestamp.now(),
      rollbackReason: 'emergency_rollback'
    });
  }
  
  await batch.commit();
  console.log(`✅ Rolled back ${recentMissedQuery.docs.length} missed medication detections`);
}

async function rollbackNightShiftMigration() {
  // Find completed migrations from the last 24 hours
  const recentMigrationsQuery = await admin.firestore().collection('night_shift_migrations')
    .where('migrationStatus', '==', 'completed')
    .where('migratedAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .get();
  
  for (const migrationDoc of recentMigrationsQuery.docs) {
    const migration = migrationDoc.data();
    
    // Revert patient preferences
    await admin.firestore().collection('patient_medication_preferences').doc(migration.patientId).update({
      'timeSlots.evening': {
        start: '01:00',
        end: '04:00',
        defaultTime: '02:00',
        label: 'Evening'
      },
      rollbackAt: admin.firestore.Timestamp.now(),
      rollbackReason: 'emergency_rollback'
    });
    
    // Revert medication schedules
    for (const medication of migration.affectedMedications) {
      await admin.firestore().collection('medication_schedules').doc(medication.scheduleId).update({
        times: medication.currentTimes, // Revert to original times
        rollbackAt: admin.firestore.Timestamp.now(),
        rollbackReason: 'emergency_rollback'
      });
    }
    
    // Mark migration as rolled back
    await migrationDoc.ref.update({
      migrationStatus: 'rolled_back',
      rollbackAt: admin.firestore.Timestamp.now(),
      rollbackReason: 'emergency_rollback'
    });
  }
  
  console.log(`✅ Rolled back ${recentMigrationsQuery.docs.length} night shift migrations`);
}
```

### 2. Data Integrity Checks

```typescript
// scripts/data-integrity-check.js
async function dataIntegrityCheck() {
  const checks = {
    orphanedEvents: await checkOrphanedEvents(),
    invalidGracePeriods: await checkInvalidGracePeriods(),
    inconsistentStatuses: await checkInconsistentStatuses(),
    missingArchivalData: await checkMissingArchivalData()
  };
  
  console.log('🔍 Data Integrity Check Results:', checks);
  
  // Auto-repair minor issues
  if (checks.orphanedEvents.length > 0) {
    await repairOrphanedEvents(checks.orphanedEvents);
  }
  
  return checks;
}

async function checkOrphanedEvents() {
  // Find medication calendar events with invalid medication references
  const eventsQuery = await admin.firestore().collection('medication_calendar_events')
    .where('status', '==', 'scheduled')
    .limit(1000)
    .get();
  
  const orphanedEvents = [];
  
  for (const eventDoc of eventsQuery.docs) {
    const event = eventDoc.data();
    
    // Check if medication still exists
    const medicationDoc = await admin.firestore().collection('medications').doc(event.medicationId).get();
    
    if (!medicationDoc.exists) {
      orphanedEvents.push({
        eventId: eventDoc.id,
        medicationId: event.medicationId,
        patientId: event.patientId
      });
    }
  }
  
  return orphanedEvents;
}
```

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] All unit tests passing
- [ ] Integration tests completed
- [ ] Performance tests within acceptable limits
- [ ] Security review completed
- [ ] Database backup created
- [ ] Rollback procedures tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated

### Deployment Steps
1. **Deploy Database Changes**
   ```bash
   firebase deploy --only firestore:indexes,firestore:rules
   ```

2. **Deploy Backend Services**
   ```bash
   # Deploy in order of dependency
   firebase deploy --only functions:gracePeriodEngine
   firebase deploy --only functions:missedMedicationDetector
   firebase deploy --only functions:complianceMonitor
   firebase deploy --only functions:familyNotificationProcessor
   firebase deploy --only functions:eventLifecycleManager
   firebase deploy --only functions:api
   ```

3. **Initialize Default Data**
   ```bash
   node scripts/initialize-default-configurations.js
   node scripts/setup-default-compliance-rules.js
   ```

4. **Deploy Frontend Changes**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

5. **Enable Scheduled Functions**
   ```bash
   # Enable functions gradually
   node scripts/enable-missed-detection.js
   node scripts/enable-compliance-monitoring.js
   node scripts/enable-lifecycle-management.js
   ```

### Post-Deployment
- [ ] Verify all scheduled functions are running
- [ ] Check function logs for errors
- [ ] Validate API endpoints are responding
- [ ] Test critical user workflows
- [ ] Monitor system metrics for 24 hours
- [ ] Collect initial user feedback

### Monitoring Dashboard

```typescript
// monitoring/dashboard.ts
export const MEDICATION_DASHBOARD_METRICS = [
  {
    title: 'Missed Detection Performance',
    metrics: [
      'medication/missed_detection_accuracy',
      'medication/false_positive_rate',
      'medication/missed_detection_latency'
    ],
    alertThresholds: {
      accuracy: { min: 95 },
      falsePositiveRate: { max: 5 },
      latency: { max: 30000 } // 30 seconds
    }
  },
  {
    title: 'Grace Period System',
    metrics: [
      'medication/grace_period_calc_time',
      'medication/grace_period_cache_hits',
      'medication/grace_period_config_updates'
    ],
    alertThresholds: {
      calcTime: { max: 100 }, // 100ms
      cacheHitRate: { min: 80 }
    }
  },
  {
    title: 'Compliance Monitoring',
    metrics: [
      'medication/compliance_alerts_count',
      'medication/compliance_eval_time',
      'medication/adherence_improvement_rate'
    ],
    alertThresholds: {
      evalTime: { max: 5000 }, // 5 seconds
      alertsPerDay: { max: 100 }
    }
  },
  {
    title: 'Family Notifications',
    metrics: [
      'medication/notification_success_rate',
      'medication/notification_processing_time',
      'medication/family_engagement_rate'
    ],
    alertThresholds: {
      successRate: { min: 90 },
      processingTime: { max: 10000 }, // 10 seconds
      engagementRate: { min: 30 }
    }
  }
];
```

---

## Success Criteria and Validation

### Technical Success Metrics
- ✅ **Missed Detection Accuracy**: > 95%
- ✅ **Grace Period Calculation Time**: < 100ms average
- ✅ **Notification Delivery Rate**: > 90%
- ✅ **System Uptime**: > 99.9%
- ✅ **API Response Time**: < 200ms for 95th percentile

### User Experience Success Metrics
- ✅ **Night Shift Migration Completion**: > 90% of notified users
- ✅ **User Satisfaction**: > 4.0/5.0 rating for new features
- ✅ **Family Member Engagement**: > 30% increase in app usage
- ✅ **Support Ticket Reduction**: > 25% decrease in medication-related tickets

### Business Impact Metrics
- ✅ **Medication Adherence Improvement**: > 15% increase
- ✅ **Missed Medication Reduction**: > 40% decrease
- ✅ **Family Caregiver Satisfaction**: > 80% positive feedback
- ✅ **Provider Confidence**: > 85% satisfaction with compliance reporting

---

## Maintenance Procedures

### Daily Monitoring
```bash
# Check scheduled function health
firebase functions:log --only missedMedicationDetector --limit 50

# Verify notification delivery
firebase functions:log --only familyNotificationProcessor --limit 50

# Check for system errors
firebase functions:log --filter "severity>=ERROR" --limit 100
```

### Weekly Maintenance
```bash
# Run data integrity checks
node scripts/data-integrity-check.js

# Generate system health report
node scripts/generate-health-report.js

# Optimize database performance
node scripts/optimize-database.js

# Review and update compliance rules
node scripts/review-compliance-rules.js
```

### Monthly Reviews
- Review missed detection accuracy and adjust algorithms
- Analyze compliance monitoring effectiveness
- Update grace period defaults based on user feedback
- Optimize notification delivery and engagement rates
- Plan feature enhancements based on usage analytics

This deployment guide ensures a systematic, safe, and monitored rollout of all medication system enhancements while maintaining system reliability and user satisfaction.