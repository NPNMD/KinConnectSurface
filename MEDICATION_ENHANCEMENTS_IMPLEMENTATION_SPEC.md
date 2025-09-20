# Medication System Enhancements - Implementation Specification

## 1. Night Shift Time Configuration Fix

### Code Changes Required

#### A. Update Type Definitions ([`shared/types.ts`](shared/types.ts:1635))

**Current (Problematic):**
```typescript
night_shift: {
  morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
  noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
  evening: { start: '01:00', end: '04:00', defaultTime: '02:00', label: 'Evening' }, // BUG
  bedtime: { start: '05:00', end: '08:00', defaultTime: '06:00', label: 'Bedtime' }
}
```

**Fixed:**
```typescript
night_shift: {
  morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
  noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
  evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Evening' }, // FIXED
  bedtime: { start: '05:00', end: '08:00', defaultTime: '06:00', label: 'Bedtime' }
}
```

#### B. Update Server-Side Defaults ([`functions/src/index.ts`](functions/src/index.ts:3450))

**Current (Problematic):**
```typescript
const defaultTimeSlots = workSchedule === 'night_shift' ? {
  // ... other slots ...
  evening: { start: '01:00', end: '04:00', defaultTime: '02:00', label: 'Evening' }, // BUG
  // ... other slots ...
}
```

**Fixed:**
```typescript
const defaultTimeSlots = workSchedule === 'night_shift' ? {
  // ... other slots ...
  evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Evening' }, // FIXED
  // ... other slots ...
}
```

#### C. Migration Detection Service

**New File: [`functions/src/services/nightShiftMigrationService.ts`](functions/src/services/nightShiftMigrationService.ts)**
```typescript
import * as admin from 'firebase-admin';

interface NightShiftMigrationCandidate {
  patientId: string;
  patientName: string;
  patientEmail: string;
  affectedMedications: Array<{
    medicationId: string;
    medicationName: string;
    scheduleId: string;
    currentTimes: string[];
    suggestedTimes: string[];
    eventCount: number;
  }>;
  estimatedImpact: {
    totalEvents: number;
    futureEvents: number;
    schedulesToUpdate: number;
  };
}

export class NightShiftMigrationService {
  private firestore = admin.firestore();

  async detectMigrationCandidates(): Promise<NightShiftMigrationCandidate[]> {
    const candidates: NightShiftMigrationCandidate[] = [];
    
    // Find patients with night shift preferences
    const nightShiftQuery = await this.firestore.collection('patient_medication_preferences')
      .where('workSchedule', '==', 'night_shift')
      .get();
    
    for (const prefDoc of nightShiftQuery.docs) {
      const prefData = prefDoc.data();
      const patientId = prefDoc.id;
      
      // Check if they have the problematic evening time slot
      const eveningSlot = prefData.timeSlots?.evening;
      if (eveningSlot?.start === '01:00' && eveningSlot?.defaultTime === '02:00') {
        
        // Get patient info
        const patientDoc = await this.firestore.collection('users').doc(patientId).get();
        const patientData = patientDoc.data();
        
        if (!patientData) continue;
        
        // Find affected medications and schedules
        const affectedMedications = await this.findAffectedMedications(patientId);
        
        if (affectedMedications.length > 0) {
          const estimatedImpact = await this.calculateMigrationImpact(patientId, affectedMedications);
          
          candidates.push({
            patientId,
            patientName: patientData.name,
            patientEmail: patientData.email,
            affectedMedications,
            estimatedImpact
          });
        }
      }
    }
    
    return candidates;
  }

  private async findAffectedMedications(patientId: string) {
    const affectedMedications = [];
    
    // Find schedules with 2 AM times
    const schedulesQuery = await this.firestore.collection('medication_schedules')
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .get();
    
    for (const scheduleDoc of schedulesQuery.docs) {
      const schedule = scheduleDoc.data();
      
      // Check if any times are 02:00
      const problematicTimes = schedule.times?.filter((time: string) => time === '02:00') || [];
      
      if (problematicTimes.length > 0) {
        // Get medication details
        const medicationDoc = await this.firestore.collection('medications').doc(schedule.medicationId).get();
        const medicationData = medicationDoc.data();
        
        if (medicationData) {
          // Suggest midnight instead of 2 AM
          const suggestedTimes = schedule.times.map((time: string) => 
            time === '02:00' ? '00:00' : time
          );
          
          affectedMedications.push({
            medicationId: schedule.medicationId,
            medicationName: medicationData.name,
            scheduleId: scheduleDoc.id,
            currentTimes: schedule.times,
            suggestedTimes,
            eventCount: 0 // Will be calculated
          });
        }
      }
    }
    
    return affectedMedications;
  }

  async createMigrationRecord(candidate: NightShiftMigrationCandidate): Promise<string> {
    const migrationData = {
      patientId: candidate.patientId,
      detectedAt: admin.firestore.Timestamp.now(),
      affectedMedications: candidate.affectedMedications,
      estimatedImpact: candidate.estimatedImpact,
      migrationStatus: 'detected',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const migrationRef = await this.firestore.collection('night_shift_migrations').add(migrationData);
    return migrationRef.id;
  }

  async executeMigration(migrationId: string, userApproval: boolean): Promise<void> {
    if (!userApproval) {
      await this.firestore.collection('night_shift_migrations').doc(migrationId).update({
        migrationStatus: 'declined',
        declinedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      return;
    }

    const migrationDoc = await this.firestore.collection('night_shift_migrations').doc(migrationId).get();
    const migration = migrationDoc.data();
    
    if (!migration) throw new Error('Migration not found');

    // Update patient preferences
    await this.firestore.collection('patient_medication_preferences').doc(migration.patientId).update({
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

    // Update medication schedules
    const batch = this.firestore.batch();
    
    for (const medication of migration.affectedMedications) {
      const scheduleRef = this.firestore.collection('medication_schedules').doc(medication.scheduleId);
      batch.update(scheduleRef, {
        times: medication.suggestedTimes,
        updatedAt: admin.firestore.Timestamp.now(),
        migratedAt: admin.firestore.Timestamp.now(),
        migrationId: migrationId
      });
    }
    
    await batch.commit();

    // Update migration status
    await migrationDoc.ref.update({
      migrationStatus: 'completed',
      migratedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}
```

---

## 2. Grace Period Engine Implementation

### Core Service

**New File: [`functions/src/services/gracePeriodEngine.ts`](functions/src/services/gracePeriodEngine.ts)**
```typescript
import * as admin from 'firebase-admin';

export interface GracePeriodCalculation {
  gracePeriodMinutes: number;
  gracePeriodEnd: Date;
  appliedRules: string[];
  ruleDetails: Array<{
    ruleName: string;
    ruleType: string;
    value: number;
    reason: string;
  }>;
  isWeekend: boolean;
  isHoliday: boolean;
  finalMultiplier: number;
}

export class GracePeriodEngine {
  private firestore = admin.firestore();
  private holidayCache = new Map<string, boolean>();

  async calculateGracePeriod(
    event: any,
    patientId: string,
    currentTime: Date = new Date()
  ): Promise<GracePeriodCalculation> {
    
    // Get patient grace period configuration
    const patientConfig = await this.getPatientGraceConfig(patientId);
    
    // Determine time slot
    const timeSlot = this.getTimeSlot(event.scheduledDateTime.toDate(), patientConfig);
    
    // Start with default grace period for time slot
    let gracePeriod = patientConfig.defaultGracePeriods[timeSlot];
    const appliedRules = [`default_${timeSlot}`];
    const ruleDetails = [{
      ruleName: `Default ${timeSlot}`,
      ruleType: 'time_slot_default',
      value: gracePeriod,
      reason: `Default grace period for ${timeSlot} medications`
    }];
    
    // Apply medication-specific override
    const medicationOverride = await this.getMedicationOverride(event.medicationId, patientConfig);
    if (medicationOverride) {
      gracePeriod = medicationOverride.gracePeriodMinutes;
      appliedRules.push(`medication_override`);
      ruleDetails.push({
        ruleName: 'Medication Override',
        ruleType: 'medication_specific',
        value: medicationOverride.gracePeriodMinutes,
        reason: medicationOverride.reason
      });
    }
    
    // Apply medication type rules (critical, standard, etc.)
    const medicationType = await this.getMedicationType(event.medicationId);
    const typeRule = patientConfig.medicationTypeRules?.find(rule => rule.medicationType === medicationType);
    if (typeRule) {
      gracePeriod = Math.min(gracePeriod, typeRule.gracePeriodMinutes);
      appliedRules.push(`type_${medicationType}`);
      ruleDetails.push({
        ruleName: `${medicationType} Medication`,
        ruleType: 'medication_type',
        value: typeRule.gracePeriodMinutes,
        reason: `Grace period for ${medicationType} medications`
      });
    }
    
    // Apply special circumstance multipliers
    const isWeekend = this.isWeekend(currentTime);
    const isHoliday = await this.isHoliday(currentTime);
    let multiplier = 1.0;
    
    if (isWeekend && patientConfig.weekendMultiplier !== 1.0) {
      multiplier *= patientConfig.weekendMultiplier;
      appliedRules.push('weekend_multiplier');
      ruleDetails.push({
        ruleName: 'Weekend Extension',
        ruleType: 'circumstance_multiplier',
        value: patientConfig.weekendMultiplier,
        reason: 'Extended grace period for weekends'
      });
    }
    
    if (isHoliday && patientConfig.holidayMultiplier !== 1.0) {
      multiplier *= patientConfig.holidayMultiplier;
      appliedRules.push('holiday_multiplier');
      ruleDetails.push({
        ruleName: 'Holiday Extension',
        ruleType: 'circumstance_multiplier',
        value: patientConfig.holidayMultiplier,
        reason: 'Extended grace period for holidays'
      });
    }
    
    // Apply multiplier
    const finalGracePeriod = Math.round(gracePeriod * multiplier);
    const gracePeriodEnd = new Date(
      event.scheduledDateTime.toDate().getTime() + (finalGracePeriod * 60 * 1000)
    );
    
    return {
      gracePeriodMinutes: finalGracePeriod,
      gracePeriodEnd,
      appliedRules,
      ruleDetails,
      isWeekend,
      isHoliday,
      finalMultiplier: multiplier
    };
  }

  private async getPatientGraceConfig(patientId: string) {
    const configDoc = await this.firestore.collection('medication_grace_periods').doc(patientId).get();
    
    if (configDoc.exists) {
      return configDoc.data();
    }
    
    // Return default configuration
    return {
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
        { medicationType: 'vitamin', gracePeriodMinutes: 120 }
      ],
      weekendMultiplier: 1.5,
      holidayMultiplier: 2.0,
      sickDayMultiplier: 3.0
    };
  }

  private getTimeSlot(scheduledTime: Date, config: any): 'morning' | 'noon' | 'evening' | 'bedtime' {
    const timeStr = scheduledTime.toTimeString().slice(0, 5);
    const timeSlots = config.timeSlots || {};
    
    for (const [slot, slotConfig] of Object.entries(timeSlots)) {
      const slotData = slotConfig as any;
      if (this.isTimeInRange(timeStr, slotData.start, slotData.end)) {
        return slot as any;
      }
    }
    
    return 'morning'; // Default fallback
  }

  private isTimeInRange(time: string, start: string, end: string): boolean {
    // Handle overnight ranges (e.g., 23:00 to 02:00)
    if (start > end) {
      return time >= start || time <= end;
    }
    return time >= start && time <= end;
  }

  private async getMedicationType(medicationId: string): Promise<'critical' | 'standard' | 'vitamin' | 'prn'> {
    const medicationDoc = await this.firestore.collection('medications').doc(medicationId).get();
    const medication = medicationDoc.data();
    
    if (!medication) return 'standard';
    
    // Classify based on medication properties
    const name = medication.name.toLowerCase();
    const genericName = medication.genericName?.toLowerCase() || '';
    
    // Critical medications
    const criticalMeds = [
      'insulin', 'metformin', 'lisinopril', 'atorvastatin', 'metoprolol',
      'warfarin', 'digoxin', 'levothyroxine', 'prednisone'
    ];
    
    if (criticalMeds.some(med => name.includes(med) || genericName.includes(med))) {
      return 'critical';
    }
    
    // PRN medications
    if (medication.isPRN) {
      return 'prn';
    }
    
    // Vitamins and supplements
    const vitaminKeywords = ['vitamin', 'supplement', 'calcium', 'iron', 'magnesium', 'zinc'];
    if (vitaminKeywords.some(keyword => name.includes(keyword) || genericName.includes(keyword))) {
      return 'vitamin';
    }
    
    return 'standard';
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  private async isHoliday(date: Date): Promise<boolean> {
    const dateKey = date.toISOString().split('T')[0];
    
    if (this.holidayCache.has(dateKey)) {
      return this.holidayCache.get(dateKey)!;
    }
    
    // Simple holiday detection (can be enhanced with external API)
    const holidays = this.getUSHolidays(date.getFullYear());
    const isHoliday = holidays.some(holiday => 
      holiday.toISOString().split('T')[0] === dateKey
    );
    
    this.holidayCache.set(dateKey, isHoliday);
    return isHoliday;
  }

  private getUSHolidays(year: number): Date[] {
    return [
      new Date(year, 0, 1),   // New Year's Day
      new Date(year, 6, 4),   // Independence Day
      new Date(year, 11, 25), // Christmas Day
      // Add more holidays as needed
    ];
  }
}
```

---

## 3. Missed Medication Detection Service

### Core Implementation

**New File: [`functions/src/services/missedMedicationDetector.ts`](functions/src/services/missedMedicationDetector.ts)**
```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GracePeriodEngine } from './gracePeriodEngine';

export class MissedMedicationDetector {
  private firestore = admin.firestore();
  private gracePeriodEngine = new GracePeriodEngine();

  async detectMissedMedications(): Promise<{
    processed: number;
    missed: number;
    errors: string[];
  }> {
    const now = new Date();
    const results = {
      processed: 0,
      missed: 0,
      errors: [] as string[]
    };

    try {
      // Query for scheduled events that might be overdue
      // Look back 24 hours to catch any that might have been missed
      const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      const overdueQuery = await this.firestore.collection('medication_calendar_events')
        .where('status', '==', 'scheduled')
        .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
        .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
        .limit(500) // Process in batches to avoid timeouts
        .get();

      console.log(`🔍 Found ${overdueQuery.docs.length} potentially overdue events`);

      // Process events in batches
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < overdueQuery.docs.length; i += batchSize) {
        batches.push(overdueQuery.docs.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await this.processBatch(batch, now, results);
      }

      console.log(`✅ Missed medication detection completed:`, results);
      return results;

    } catch (error) {
      console.error('❌ Error in missed medication detection:', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return results;
    }
  }

  private async processBatch(
    docs: admin.firestore.QueryDocumentSnapshot[],
    currentTime: Date,
    results: { processed: number; missed: number; errors: string[] }
  ): Promise<void> {
    const batch = this.firestore.batch();
    const notificationQueue = [];

    for (const doc of docs) {
      try {
        const event = doc.data();
        results.processed++;

        // Calculate grace period for this specific event
        const gracePeriodCalc = await this.gracePeriodEngine.calculateGracePeriod(
          event,
          event.patientId,
          currentTime
        );

        // Check if grace period has expired
        if (currentTime > gracePeriodCalc.gracePeriodEnd) {
          // Mark as missed
          batch.update(doc.ref, {
            status: 'missed',
            missedAt: admin.firestore.Timestamp.now(),
            missedReason: 'automatic_detection',
            gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
            gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodCalc.gracePeriodEnd),
            gracePeriodRules: gracePeriodCalc.appliedRules,
            updatedAt: admin.firestore.Timestamp.now()
          });

          results.missed++;
          
          // Queue for notification processing
          notificationQueue.push({
            eventId: doc.id,
            event,
            gracePeriodCalc
          });

          console.log(`📋 Marked as missed: ${event.medicationName} for patient ${event.patientId}`);
        } else {
          // Update with grace period info for future reference
          batch.update(doc.ref, {
            gracePeriodMinutes: gracePeriodCalc.gracePeriodMinutes,
            gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodCalc.gracePeriodEnd),
            gracePeriodRules: gracePeriodCalc.appliedRules,
            updatedAt: admin.firestore.Timestamp.now()
          });
        }

      } catch (error) {
        console.error(`❌ Error processing event ${doc.id}:`, error);
        results.errors.push(`Event ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit batch updates
    if (batch._writes.length > 0) {
      await batch.commit();
    }

    // Process notifications
    if (notificationQueue.length > 0) {
      await this.queueMissedMedicationNotifications(notificationQueue);
    }
  }

  private async queueMissedMedicationNotifications(missedEvents: any[]): Promise<void> {
    // Group by patient for efficient notification processing
    const patientGroups = new Map<string, any[]>();
    
    for (const missedEvent of missedEvents) {
      const patientId = missedEvent.event.patientId;
      if (!patientGroups.has(patientId)) {
        patientGroups.set(patientId, []);
      }
      patientGroups.get(patientId)!.push(missedEvent);
    }

    // Process notifications for each patient
    for (const [patientId, events] of patientGroups) {
      await this.processPatientMissedNotifications(patientId, events);
    }
  }

  private async processPatientMissedNotifications(patientId: string, missedEvents: any[]): Promise<void> {
    // Get family notification rules
    const notificationRules = await this.getFamilyNotificationRules(patientId);
    
    for (const rule of notificationRules) {
      // Check if this rule should trigger for these missed events
      const shouldNotify = await this.shouldTriggerNotification(rule, missedEvents);
      
      if (shouldNotify) {
        await this.sendMissedMedicationNotification(rule, missedEvents);
      }
    }
  }

  private async shouldTriggerNotification(rule: any, missedEvents: any[]): Promise<boolean> {
    // Check immediate notification setting
    if (rule.triggers.missedMedication.immediateNotification) {
      return true;
    }

    // Check consecutive missed threshold
    if (rule.triggers.missedMedication.consecutiveThreshold > 1) {
      // Check for consecutive misses for each medication
      for (const missedEvent of missedEvents) {
        const consecutiveMisses = await this.getConsecutiveMissedCount(
          missedEvent.event.medicationId,
          missedEvent.event.patientId
        );
        
        if (consecutiveMisses >= rule.triggers.missedMedication.consecutiveThreshold) {
          return true;
        }
      }
    }

    // Check critical medications only setting
    if (rule.triggers.missedMedication.criticalMedicationsOnly) {
      const hasCriticalMissed = await Promise.all(
        missedEvents.map(async (event) => {
          const medicationType = await this.gracePeriodEngine.getMedicationType(event.event.medicationId);
          return medicationType === 'critical';
        })
      );
      
      return hasCriticalMissed.some(isCritical => isCritical);
    }

    return false;
  }

  private async getConsecutiveMissedCount(medicationId: string, patientId: string): Promise<number> {
    // Get recent events for this medication, ordered by scheduled time descending
    const recentEvents = await this.firestore.collection('medication_calendar_events')
      .where('medicationId', '==', medicationId)
      .where('patientId', '==', patientId)
      .orderBy('scheduledDateTime', 'desc')
      .limit(10)
      .get();

    let consecutiveCount = 0;
    
    for (const doc of recentEvents.docs) {
      const event = doc.data();
      
      if (event.status === 'missed') {
        consecutiveCount++;
      } else if (event.status === 'taken' || event.status === 'skipped') {
        // Break the consecutive streak
        break;
      }
      // Continue counting for 'scheduled' events (they might become missed)
    }

    return consecutiveCount;
  }
}

// Scheduled Function
export const missedMedicationDetector = functions
  .runWith({
    memory: '256MB',
    timeoutSeconds: 540,
  })
  .pubsub.schedule('every 15 minutes')
  .onRun(async (context) => {
    const detector = new MissedMedicationDetector();
    const results = await detector.detectMissedMedications();
    
    console.log('🔍 Missed medication detection results:', results);
    
    // Log metrics for monitoring
    if (results.errors.length > 0) {
      console.error('❌ Missed detection errors:', results.errors);
    }
    
    return results;
  });
```

---

## 4. Compliance Monitoring System

### Compliance Rules Engine

**New File: [`functions/src/services/complianceMonitor.ts`](functions/src/services/complianceMonitor.ts)**
```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export interface ComplianceEvaluation {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity: 'info' | 'warning' | 'critical';
  metrics: {
    adherenceRate: number;
    consecutiveMissed: number;
    totalScheduled: number;
    totalTaken: number;
    totalMissed: number;
    evaluationPeriodDays: number;
  };
  affectedMedications: Array<{
    medicationId: string;
    medicationName: string;
    adherenceRate: number;
    missedCount: number;
    lastTaken?: Date;
  }>;
  recommendations: string[];
  nextEvaluationAt: Date;
}

export class ComplianceMonitor {
  private firestore = admin.firestore();

  async evaluatePatientCompliance(patientId: string): Promise<ComplianceEvaluation[]> {
    const evaluations: ComplianceEvaluation[] = [];
    
    // Get compliance rules for this patient
    const rulesQuery = await this.firestore.collection('medication_compliance_rules')
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .get();

    for (const ruleDoc of rulesQuery.docs) {
      const rule = ruleDoc.data();
      const evaluation = await this.evaluateRule(patientId, rule);
      evaluations.push(evaluation);
      
      // Process triggered rules
      if (evaluation.triggered) {
        await this.processTriggeredRule(patientId, rule, evaluation);
      }
    }

    return evaluations;
  }

  private async evaluateRule(patientId: string, rule: any): Promise<ComplianceEvaluation> {
    const now = new Date();
    const evaluationStart = new Date(now.getTime() - (rule.timeWindowDays * 24 * 60 * 60 * 1000));
    
    // Get medication events for evaluation period
    let eventsQuery = this.firestore.collection('medication_calendar_events')
      .where('patientId', '==', patientId)
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(evaluationStart))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now));

    // Filter by specific medications if specified
    if (rule.medicationIds && rule.medicationIds.length > 0) {
      // Note: Firestore doesn't support array-contains-any with other where clauses
      // We'll filter in memory after fetching
    }

    const eventsSnapshot = await eventsQuery.get();
    let events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply medication filters in memory
    if (rule.medicationIds && rule.medicationIds.length > 0) {
      events = events.filter(event => rule.medicationIds.includes(event.medicationId));
    }

    // Apply medication type filters
    if (rule.medicationTypes && rule.medicationTypes.length > 0) {
      const medicationTypes = await this.getMedicationTypes(events.map(e => e.medicationId));
      events = events.filter(event => {
        const medicationType = medicationTypes.get(event.medicationId);
        return rule.medicationTypes.includes(medicationType);
      });
    }

    // Calculate metrics
    const totalScheduled = events.length;
    const takenEvents = events.filter(e => e.status === 'taken' || e.status === 'late');
    const missedEvents = events.filter(e => e.status === 'missed');
    const adherenceRate = totalScheduled > 0 ? (takenEvents.length / totalScheduled) * 100 : 100;

    // Group by medication for detailed analysis
    const medicationGroups = new Map<string, any[]>();
    for (const event of events) {
      if (!medicationGroups.has(event.medicationId)) {
        medicationGroups.set(event.medicationId, []);
      }
      medicationGroups.get(event.medicationId)!.push(event);
    }

    const affectedMedications = [];
    for (const [medicationId, medEvents] of medicationGroups) {
      const medTaken = medEvents.filter(e => e.status === 'taken' || e.status === 'late').length;
      const medMissed = medEvents.filter(e => e.status === 'missed').length;
      const medAdherenceRate = medEvents.length > 0 ? (medTaken / medEvents.length) * 100 : 100;
      
      // Get last taken date
      const takenEvents = medEvents
        .filter(e => e.status === 'taken' || e.status === 'late')
        .sort((a, b) => b.actualTakenDateTime?.toDate()?.getTime() - a.actualTakenDateTime?.toDate()?.getTime());
      
      const lastTaken = takenEvents[0]?.actualTakenDateTime?.toDate();

      affectedMedications.push({
        medicationId,
        medicationName: medEvents[0].medicationName,
        adherenceRate: medAdherenceRate,
        missedCount: medMissed,
        lastTaken
      });
    }

    // Evaluate rule conditions
    let triggered = false;
    let severity: 'info' | 'warning' | 'critical' = 'info';
    const recommendations: string[] = [];

    switch (rule.ruleType) {
      case 'adherence_threshold':
        if (adherenceRate < rule.adherenceThresholdPercent) {
          triggered = true;
          severity = adherenceRate < 50 ? 'critical' : adherenceRate < 70 ? 'warning' : 'info';
          recommendations.push(`Adherence rate (${adherenceRate.toFixed(1)}%) is below target (${rule.adherenceThresholdPercent}%)`);
          recommendations.push('Consider adjusting medication schedule or setting more reminders');
        }
        break;

      case 'consecutive_missed':
        const maxConsecutive = await this.getMaxConsecutiveMissed(patientId, rule.medicationIds);
        if (maxConsecutive >= rule.consecutiveMissedThreshold) {
          triggered = true;
          severity = maxConsecutive >= 5 ? 'critical' : maxConsecutive >= 3 ? 'warning' : 'info';
          recommendations.push(`${maxConsecutive} consecutive missed doses detected`);
          recommendations.push('Contact patient to identify barriers to medication adherence');
        }
        break;

      case 'pattern_detection':
        const patterns = await this.detectAdherencePatterns(patientId, events);
        if (patterns.concerningPatterns.length > 0) {
          triggered = true;
          severity = 'warning';
          recommendations.push(...patterns.recommendations);
        }
        break;
    }

    // Calculate next evaluation time
    const nextEvaluationAt = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour from now

    return {
      ruleId: rule.id || 'unknown',
      ruleName: rule.ruleName,
      triggered,
      severity,
      metrics: {
        adherenceRate,
        consecutiveMissed: await this.getMaxConsecutiveMissed(patientId, rule.medicationIds),
        totalScheduled,
        totalTaken: takenEvents.length,
        totalMissed: missedEvents.length,
        evaluationPeriodDays: rule.timeWindowDays
      },
      affectedMedications,
      recommendations,
      nextEvaluationAt
    };
  }

  private async processTriggeredRule(
    patientId: string,
    rule: any,
    evaluation: ComplianceEvaluation
  ): Promise<void> {
    // Create compliance alert
    const alert = {
      patientId,
      ruleId: rule.id,
      alertType: this.mapRuleTypeToAlertType(rule.ruleType),
      severity: evaluation.severity,
      title: this.generateAlertTitle(rule, evaluation),
      description: this.generateAlertDescription(rule, evaluation),
      affectedMedications: evaluation.affectedMedications,
      recommendations: evaluation.recommendations,
      suggestedActions: this.generateSuggestedActions(rule, evaluation),
      status: 'active',
      notificationsSent: [],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const alertRef = await this.firestore.collection('medication_compliance_alerts').add(alert);
    
    // Process notifications based on rule configuration
    await this.processRuleNotifications(patientId, rule, alert, alertRef.id);
    
    // Execute auto-actions
    if (rule.autoActions && rule.autoActions.length > 0) {
      await this.executeAutoActions(patientId, rule.autoActions, evaluation);
    }
  }

  private async processRuleNotifications(
    patientId: string,
    rule: any,
    alert: any,
    alertId: string
  ): Promise<void> {
    const notifications = [];

    // Patient notification
    if (rule.notificationRules.notifyPatient) {
      notifications.push({
        recipientType: 'patient',
        recipientId: patientId,
        alertId,
        method: 'in_app', // Default to in-app for patients
        scheduledFor: new Date()
      });
    }

    // Family notifications
    if (rule.notificationRules.notifyFamily) {
      const familyMembers = await this.getNotifiableFamilyMembers(patientId);
      
      for (const familyMember of familyMembers) {
        const familyRule = await this.getFamilyNotificationRule(patientId, familyMember.id);
        
        if (familyRule && this.shouldNotifyFamily(familyRule, alert)) {
          notifications.push({
            recipientType: 'family',
            recipientId: familyMember.id,
            alertId,
            method: familyRule.preferences.methods[0] || 'email',
            scheduledFor: new Date()
          });
        }
      }
    }

    // Provider notifications
    if (rule.notificationRules.notifyProvider) {
      const providers = await this.getPatientProviders(patientId);
      
      for (const provider of providers) {
        if (provider.isPrimary) {
          notifications.push({
            recipientType: 'provider',
            recipientId: provider.id,
            alertId,
            method: 'email',
            scheduledFor: new Date(Date.now() + (rule.notificationRules.escalationDelayHours * 60 * 60 * 1000))
          });
        }
      }
    }

    // Queue notifications for processing
    if (notifications.length > 0) {
      await this.queueNotifications(notifications);
    }
  }
}

// Scheduled Function
export const complianceMonitor = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540,
  })
  .pubsub.schedule('every 1 hours')
  .onRun(async (context) => {
    const monitor = new ComplianceMonitor();
    
    // Get all patients with active compliance rules
    const patientsQuery = await admin.firestore().collection('medication_compliance_rules')
      .where('isActive', '==', true)
      .get();
    
    const uniquePatients = new Set(patientsQuery.docs.map(doc => doc.data().patientId));
    
    console.log(`🔍 Evaluating compliance for ${uniquePatients.size} patients`);
    
    const results = {
      patientsEvaluated: 0,
      alertsGenerated: 0,
      notificationsSent: 0,
      errors: [] as string[]
    };

    for (const patientId of uniquePatients) {
      try {
        const evaluations = await monitor.evaluatePatientCompliance(patientId);
        results.patientsEvaluated++;
        
        const triggeredEvaluations = evaluations.filter(e => e.triggered);
        results.alertsGenerated += triggeredEvaluations.length;
        
        console.log(`📊 Patient ${patientId}: ${triggeredEvaluations.length} alerts generated`);
        
      } catch (error) {
        console.error(`❌ Error evaluating compliance for patient ${patientId}:`, error);
        results.errors.push(`Patient ${patientId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('✅ Compliance monitoring completed:', results);
    return results;
  });
```

---

## 5. Event Lifecycle Management

### Archival Service Implementation

**New File: [`functions/src/services/eventLifecycleManager.ts`](functions/src/services/eventLifecycleManager.ts)**
```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export class EventLifecycleManager {
  private firestore = admin.firestore();

  async archiveOldEvents(archiveThreshold: Date): Promise<{
    eventsArchived: number;
    eventsDeleted: number;
    errors: string[];
  }> {
    const results = {
      eventsArchived: 0,
      eventsDeleted: 0,
      errors: [] as string[]
    };

    try {
      // Query for old events that need archiving
      const oldEventsQuery = await this.firestore.collection('medication_calendar_events')
        .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(archiveThreshold))
        .where('archivalStatus', '==', null) // Not yet processed
        .limit(1000) // Process in batches
        .get();

      console.log(`📦 Found ${oldEventsQuery.docs.length} events for archival processing`);

      // Process in smaller batches to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < oldEventsQuery.docs.length; i += batchSize) {
        const batch = oldEventsQuery.docs.slice(i, i + batchSize);
        await this.processBatchForArchival(batch, results);
      }

      console.log('✅ Event archival completed:', results);
      return results;

    } catch (error) {
      console.error('❌ Error in event archival:', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return results;
    }
  }

  private async processBatchForArchival(
    docs: admin.firestore.QueryDocumentSnapshot[],
    results: { eventsArchived: number; eventsDeleted: number; errors: string[] }
  ): Promise<void> {
    const archiveBatch = this.firestore.batch();
    const deleteBatch = this.firestore.batch();

    for (const doc of docs) {
      try {
        const event = doc.data();
        const retentionPolicy = await this.getRetentionPolicy(event);

        if (retentionPolicy.shouldArchive) {
          // Create archive record
          const archiveData = {
            originalEventId: doc.id,
            patientId: event.patientId,
            medicationId: event.medicationId,
            eventData: this.compressEventData(event),
            archivedAt: admin.firestore.Timestamp.now(),
            archivedReason: 'retention_policy',
            originalCreatedAt: event.createdAt,
            originalUpdatedAt: event.updatedAt,
            retentionCategory: retentionPolicy.category,
            deleteAfter: retentionPolicy.deleteAfter ? 
              admin.firestore.Timestamp.fromDate(retentionPolicy.deleteAfter) : null,
            finalStatus: event.status,
            adherenceImpact: this.calculateAdherenceImpact(event)
          };

          const archiveRef = this.firestore.collection('medication_event_archive').doc();
          archiveBatch.set(archiveRef, archiveData);

          // Mark original event as archived
          archiveBatch.update(doc.ref, {
            archivalStatus: 'archived',
            archivedAt: admin.firestore.Timestamp.now(),
            archiveId: archiveRef.id,
            updatedAt: admin.firestore.Timestamp.now()
          });

          results.eventsArchived++;

        } else if (retentionPolicy.shouldDelete) {
          // Mark for deletion
          deleteBatch.delete(doc.ref);
          results.eventsDeleted++;
        }

      } catch (error) {
        console.error(`❌ Error processing event ${doc.id} for archival:`, error);
        results.errors.push(`Event ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Commit batches
    if (archiveBatch._writes.length > 0) {
      await archiveBatch.commit();
    }
    
    if (deleteBatch._writes.length > 0) {
      await deleteBatch.commit();
    }
  }

  private async getRetentionPolicy(event: any): Promise<{
    shouldArchive: boolean;
    shouldDelete: boolean;
    category: string;
    deleteAfter?: Date;
  }> {
    const medicationType = await this.getMedicationType(event.medicationId);
    const eventAge = Date.now() - event.createdAt.toDate().getTime();
    const daysSinceCreated = eventAge / (1000 * 60 * 60 * 24);

    // Determine retention category
    let category = 'standard';
    if (medicationType === 'critical') {
      category = 'critical';
    } else if (event.status === 'missed' && medicationType === 'critical') {
      category = 'critical';
    } else if (medicationType === 'vitamin') {
      category = 'vitamin';
    }

    // Apply retention rules
    const retentionRules = {
      standard: { archiveAfterDays: 365, deleteAfterDays: 2555 }, // 7 years
      critical: { archiveAfterDays: 365, deleteAfterDays: null }, // Never delete
      vitamin: { archiveAfterDays: 180, deleteAfterDays: 1095 }, // 3 years
      discontinued: { archiveAfterDays: 90, deleteAfterDays: 1095 }
    };

    const rule = retentionRules[category as keyof typeof retentionRules] || retentionRules.standard;
    
    const shouldArchive = daysSinceCreated >= rule.archiveAfterDays;
    const shouldDelete = rule.deleteAfterDays ? daysSinceCreated >= rule.deleteAfterDays : false;
    
    const deleteAfter = rule.deleteAfterDays ? 
      new Date(event.createdAt.toDate().getTime() + (rule.deleteAfterDays * 24 * 60 * 60 * 1000)) : 
      undefined;

    return {
      shouldArchive,
      shouldDelete,
      category,
      deleteAfter
    };
  }

  private compressEventData(event: any): any {
    // Keep only essential data for archival
    return {
      medicationName: event.medicationName,
      dosageAmount: event.dosageAmount,
      scheduledDateTime: event.scheduledDateTime,
      actualTakenDateTime: event.actualTakenDateTime,
      status: event.status,
      isOnTime: event.isOnTime,
      minutesLate: event.minutesLate,
      notes: event.notes,
      takenBy: event.takenBy,
      snoozeCount: event.snoozeCount,
      // Exclude large arrays and detailed history to save space
    };
  }

  private calculateAdherenceImpact(event: any): number {
    // Calculate impact on adherence (-1 to 1 scale)
    switch (event.status) {
      case 'taken':
        return event.isOnTime ? 1.0 : 0.8;
      case 'late':
        return event.minutesLate < 60 ? 0.6 : 0.4;
      case 'missed':
        return -1.0;
      case 'skipped':
        return -0.5; // Less negative impact than missed
      default:
        return 0.0;
    }
  }

  async cleanupDiscontinuedMedicationEvents(): Promise<number> {
    let cleanedCount = 0;
    
    // Find discontinued medications
    const discontinuedMeds = await this.firestore.collection('medications')
      .where('isActive', '==', false)
      .get();

    for (const medDoc of discontinuedMeds.docs) {
      const medication = medDoc.data();
      const discontinuedDate = medication.endDate?.toDate() || medication.updatedAt?.toDate();
      
      if (discontinuedDate) {
        const cleanupThreshold = new Date(discontinuedDate.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days after discontinuation
        
        if (new Date() > cleanupThreshold) {
          // Archive future scheduled events for this medication
          const futureEventsQuery = await this.firestore.collection('medication_calendar_events')
            .where('medicationId', '==', medDoc.id)
            .where('status', '==', 'scheduled')
            .where('scheduledDateTime', '>', admin.firestore.Timestamp.now())
            .get();

          const batch = this.firestore.batch();
          
          for (const eventDoc of futureEventsQuery.docs) {
            batch.update(eventDoc.ref, {
              status: 'cancelled',
              cancelledReason: 'medication_discontinued',
              cancelledAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now()
            });
            cleanedCount++;
          }
          
          if (batch._writes.length > 0) {
            await batch.commit();
          }
        }
      }
    }

    return cleanedCount;
  }
}

// Scheduled Function
export const eventLifecycleManager = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 540,
  })
  .pubsub.schedule('every 24 hours')
  .onRun(async (context) => {
    const manager = new EventLifecycleManager();
    const now = new Date();
    const archiveThreshold = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)); // 365 days ago

    console.log('🗂️ Starting event lifecycle management...');

    // Archive old events
    const archivalResults = await manager.archiveOldEvents(archiveThreshold);
    
    // Clean up discontinued medication events
    const cleanupCount = await manager.cleanupDiscontinuedMedicationEvents();
    
    // Optimize collections (remove orphaned data, update indexes)
    await manager.optimizeCollections();

    const results = {
      ...archivalResults,
      discontinuedEventsCleanedUp: cleanupCount,
      completedAt: new Date()
    };

    console.log('✅ Event lifecycle management completed:', results);
    return results;
  });
```

---

## 6. Family Notification System

### Notification Processor Implementation

**New File: [`functions/src/services/familyNotificationProcessor.ts`](functions/src/services/familyNotificationProcessor.ts)**
```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

export class FamilyNotificationProcessor {
  private firestore = admin.firestore();

  async processPendingNotifications(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Get pending notifications
      const pendingQuery = await this.firestore.collection('family_notification_queue')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', admin.firestore.Timestamp.now())
        .limit(100) // Process in batches
        .get();

      console.log(`📨 Found ${pendingQuery.docs.length} pending notifications`);

      for (const notificationDoc of pendingQuery.docs) {
        try {
          const notification = notificationDoc.data();
          results.processed++;

          // Check quiet hours
          if (await this.isInQuietHours(notification.recipientId, notification.method)) {
            // Reschedule for later
            await this.rescheduleNotification(notificationDoc.id, notification);
            continue;
          }

          // Check daily limits
          if (await this.hasExceededDailyLimit(notification.recipientId, notification.method)) {
            // Skip for today
            await this.markNotificationSkipped(notificationDoc.id, 'daily_limit_exceeded');
            continue;
          }

          // Send notification
          const sendResult = await this.sendNotification(notification);
          
          if (sendResult.success) {
            results.sent++;
            await this.markNotificationSent(notificationDoc.id, sendResult.deliveryId);
          } else {
            results.failed++;
            await this.markNotificationFailed(notificationDoc.id, sendResult.error);
          }

        } catch (error) {
          console.error(`❌ Error processing notification ${notificationDoc.id}:`, error);
          results.errors.push(`Notification ${notificationDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.failed++;
        }
      }

      return results;

    } catch (error) {
      console.error('❌ Error in notification processing:', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return results;
    }
  }

  private async sendNotification(notification: any): Promise<{
    success: boolean;
    deliveryId?: string;
    error?: string;
  }> {
    switch (notification.method) {
      case 'email':
        return await this.sendEmailNotification(notification);
      case 'sms':
        return await this.sendSMSNotification(notification);
      case 'push':
        return await this.sendPushNotification(notification);
      case 'in_app':
        return await this.sendInAppNotification(notification);
      default:
        return { success: false, error: 'Unknown notification method' };
    }
  }

  private async sendEmailNotification(notification: any): Promise<{
    success: boolean;
    deliveryId?: string;
    error?: string;
  }> {
    try {
      // Get recipient details
      const recipientDoc = await this.firestore.collection('users').doc(notification.recipientId).get();
      const recipient = recipientDoc.data();
      
      if (!recipient?.email) {
        return { success: false, error: 'Recipient email not found' };
      }

      // Get alert details
      const alertDoc = await this.firestore.collection('medication_compliance_alerts').doc(notification.alertId).get();
      const alert = alertDoc.data();
      
      if (!alert) {
        return { success: false, error: 'Alert not found' };
      }

      // Get patient details
      const patientDoc = await this.firestore.collection('users').doc(alert.patientId).get();
      const patient = patientDoc.data();

      // Generate email content
      const emailContent = this.generateEmailContent(alert, patient, recipient);
      
      // Send via SendGrid
      const msg = {
        to: recipient.email,
        from: 'notifications@kinconnect.app',
        subject: emailContent.subject,
        html: emailContent.html
      };

      const [response] = await sgMail.send(msg);
      
      return {
        success: true,
        deliveryId: response.headers['x-message-id'] || 'unknown'
      };

    } catch (error) {
      console.error('❌ Email notification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed'
      };
    }
  }

  private generateEmailContent(alert: any, patient: any, recipient: any): {
    subject: string;
    html: string;
  } {
    const patientName = patient?.name || 'Patient';
    const recipientName = recipient?.name || 'Family Member';
    
    let subject = '';
    let content = '';

    switch (alert.alertType) {
      case 'consecutive_missed':
        subject = `${patientName} has missed multiple medications`;
        content = `
          <h2>Medication Adherence Alert</h2>
          <p>Hi ${recipientName},</p>
          <p><strong>${patientName}</strong> has missed multiple consecutive medication doses.</p>
          <div class="alert-details">
            <h3>Affected Medications:</h3>
            <ul>
              ${alert.affectedMedications.map((med: any) => 
                `<li><strong>${med.medicationName}</strong> - ${med.missedCount} missed doses</li>`
              ).join('')}
            </ul>
          </div>
          <div class="recommendations">
            <h3>Recommended Actions:</h3>
            <ul>
              ${alert.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        `;
        break;

      case 'adherence_declining':
        subject = `${patientName}'s medication adherence needs attention`;
        content = `
          <h2>Medication Adherence Concern</h2>
          <p>Hi ${recipientName},</p>
          <p><strong>${patientName}</strong>'s medication adherence has declined below the target threshold.</p>
          <div class="metrics">
            <p><strong>Current Adherence Rate:</strong> ${alert.metrics?.adherenceRate?.toFixed(1)}%</p>
            <p><strong>Evaluation Period:</strong> ${alert.metrics?.evaluationPeriodDays} days</p>
          </div>
        `;
        break;

      default:
        subject = `Medication alert for ${patientName}`;
        content = `
          <h2>Medication Alert</h2>
          <p>Hi ${recipientName},</p>
          <p>There is a medication-related alert for <strong>${patientName}</strong>.</p>
          <p><strong>Alert:</strong> ${alert.description}</p>
        `;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
          <p style="color: #666; margin: 5px 0;">Medication Monitoring Alert</p>
        </div>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          ${content}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://claritystream-uldp9.web.app/medications?patientId=${alert.patientId}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Medications
          </a>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
          <p>This alert was generated automatically by KinConnect's medication monitoring system.</p>
          <p>To adjust notification preferences, visit your family member settings.</p>
        </div>
      </div>
    `;

    return { subject, html };
  }

  async checkEmergencyEscalations(): Promise<number> {
    let escalationsProcessed = 0;
    
    // Find critical alerts that need escalation
    const criticalAlertsQuery = await this.firestore.collection('medication_compliance_alerts')
      .where('severity', '==', 'critical')
      .where('status', '==', 'active')
      .get();

    for (const alertDoc of criticalAlertsQuery.docs) {
      const alert = alertDoc.data();
      const alertAge = Date.now() - alert.createdAt.toDate().getTime();
      const hoursOld = alertAge / (1000 * 60 * 60);

      // Check if escalation is needed
      const familyRules = await this.getFamilyNotificationRules(alert.patientId);
      
      for (const rule of familyRules) {
        if (rule.emergencyEscalation.enabled && 
            hoursOld >= rule.emergencyEscalation.escalationDelayHours) {
          
          await this.processEmergencyEscalation(alert, rule);
          escalationsProcessed++;
        }
      }
    }

    return escalationsProcessed;
  }

  private async processEmergencyEscalation(alert: any, familyRule: any): Promise<void> {
    // Send escalated notifications via multiple methods
    for (const method of familyRule.emergencyEscalation.escalationMethods) {
      await this.queueUrgentNotification({
        recipientId: familyRule.familyMemberId,
        alertId: alert.id,
        method,
        priority: 'emergency',
        escalated: true,
        scheduledFor: new Date()
      });
    }

    // Mark alert as escalated
    await this.firestore.collection('medication_compliance_alerts').doc(alert.id).update({
      status: 'escalated',
      escalatedAt: admin.firestore.Timestamp.now(),
      escalatedTo: familyRule.familyMemberId,
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}

// Scheduled Function
export const familyNotificationProcessor = functions
  .runWith({
    memory: '256MB',
    timeoutSeconds: 300,
  })
  .pubsub.schedule('every 30 minutes')
  .onRun(async (context) => {
    const processor = new FamilyNotificationProcessor();
    
    console.log('📨 Starting family notification processing...');
    
    // Process pending notifications
    const notificationResults = await processor.processPendingNotifications();
    
    // Check for emergency escalations
    const escalationCount = await processor.checkEmergencyEscalations();
    
    // Send digest notifications (daily/weekly summaries)
    const digestCount = await processor.sendDigestNotifications();

    const results = {
      ...notificationResults,
      escalationsProcessed: escalationCount,
      digestsSent: digestCount,
      completedAt: new Date()
    };

    console.log('✅ Family notification processing completed:', results);
    return results;
  });
```

---

## 7. API Endpoint Implementations

### Grace Period Management Endpoints

**Add to [`functions/src/index.ts`](functions/src/index.ts)**
```typescript
// Get patient grace period configuration
app.get('/patients/grace-periods', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    
    const configDoc = await firestore.collection('medication_grace_periods').doc(patientId).get();
    
    if (!configDoc.exists) {
      // Return default configuration
      const defaultConfig = {
        id: patientId,
        patientId,
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
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      return res.json({
        success: true,
        data: defaultConfig
      });
    }
    
    const config = configDoc.data();
    res.json({
      success: true,
      data: {
        id: configDoc.id,
        ...config,
        createdAt: config?.createdAt?.toDate(),
        updatedAt: config?.updatedAt?.toDate()
      }
    });
    
  } catch (error) {
    console.error('Error getting grace period configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update patient grace period configuration
app.put('/patients/grace-periods', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    const updateData = req.body;
    
    // Validate grace period values
    const validation = this.validateGracePeriodConfig(updateData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid grace period configuration',
        details: validation.errors
      });
    }
    
    const configData = {
      ...updateData,
      patientId,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // Remove fields that shouldn't be updated
    delete configData.id;
    delete configData.createdAt;
    
    await firestore.collection('medication_grace_periods').doc(patientId).set(configData, { merge: true });
    
    // Get updated configuration
    const updatedDoc = await firestore.collection('medication_grace_periods').doc(patientId).get();
    const updatedData = updatedDoc.data();
    
    res.json({
      success: true,
      data: {
        id: patientId,
        ...updatedData,
        createdAt: updatedData?.createdAt?.toDate(),
        updatedAt: updatedData?.updatedAt?.toDate()
      },
      message: 'Grace period configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating grace period configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get missed medications for a patient
app.get('/medication-calendar/missed', authenticate, async (req, res) => {
  try {
    const currentUserId = (req as any).user.uid;
    const { patientId, limit = '50', startDate, endDate } = req.query;
    
    // Determine target patient
    const targetPatientId = patientId as string || currentUserId;
    
    // Check access permissions
    if (targetPatientId !== currentUserId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', currentUserId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    // Build query for missed medications
    let query = firestore.collection('medication_calendar_events')
      .where('patientId', '==', targetPatientId)
      .where('status', '==', 'missed');
    
    // Add date filters if provided
    if (startDate) {
      query = query.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate as string)));
    }
    if (endDate) {
      query = query.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate as string)));
    }
    
    const missedSnapshot = await query
      .orderBy('scheduledDateTime', 'desc')
      .limit(parseInt(limit as string, 10))
      .get();
    
    const missedMedications = missedSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        scheduledDateTime: data.scheduledDateTime?.toDate(),
        missedAt: data.missedAt?.toDate(),
        gracePeriodEnd: data.gracePeriodEnd?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    });
    
    res.json({
      success: true,
      data: missedMedications,
      message: `Found ${missedMedications.length} missed medications`
    });
    
  } catch (error) {
    console.error('Error getting missed medications:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Manual missed detection trigger
app.post('/medication-calendar/detect-missed', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    
    // Import and use the missed medication detector
    const { MissedMedicationDetector } = await import('./services/missedMedicationDetector');
    const detector = new MissedMedicationDetector();
    
    // Run detection for this specific patient
    const results = await detector.detectMissedMedicationsForPatient(patientId);
    
    res.json({
      success: true,
      data: results,
      message: `Detected ${results.missed} missed medications`
    });
    
  } catch (error) {
    console.error('Error in manual missed detection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Night shift migration endpoints
app.get('/patients/night-shift-migration/detect', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    
    const { NightShiftMigrationService } = await import('./services/nightShiftMigrationService');
    const migrationService = new NightShiftMigrationService();
    
    const candidates = await migrationService.detectMigrationCandidates();
    const patientCandidate = candidates.find(c => c.patientId === patientId);
    
    if (patientCandidate) {
      // Create migration record
      const migrationId = await migrationService.createMigrationRecord(patientCandidate);
      
      res.json({
        success: true,
        data: {
          migrationId,
          ...patientCandidate,
          needsMigration: true
        },
        message: 'Night shift migration needed'
      });
    } else {
      res.json({
        success: true,
        data: { needsMigration: false },
        message: 'No night shift migration needed'
      });
    }
    
  } catch (error) {
    console.error('Error detecting night shift migration needs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/patients/night-shift-migration/execute', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    const { migrationId, approved } = req.body;
    
    if (!migrationId) {
      return res.status(400).json({
        success: false,
        error: 'Migration ID is required'
      });
    }
    
    const { NightShiftMigrationService } = await import('./services/nightShiftMigrationService');
    const migrationService = new NightShiftMigrationService();
    
    await migrationService.executeMigration(migrationId, approved);
    
    res.json({
      success: true,
      message: approved ? 'Migration completed successfully' : 'Migration declined'
    });
    
  } catch (error) {
    console.error('Error executing night shift migration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

---

## 8. Frontend Integration Points

### Enhanced Medication Calendar API Client

**Updates to [`client/src/lib/medicationCalendarApi.ts`](client/src/lib/medicationCalendarApi.ts)**
```typescript
class MedicationCalendarApi {
  // ... existing methods ...

  // Grace Period Management
  async getGracePeriodConfig(): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/grace-periods`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching grace period config:', error);
      return { success: false, error: 'Failed to fetch grace period configuration' };
    }
  }

  async updateGracePeriodConfig(config: any): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/grace-periods`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(config),
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating grace period config:', error);
      return { success: false, error: 'Failed to update grace period configuration' };
    }
  }

  // Missed Medication Management
  async getMissedMedications(options: {
    patientId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<ApiResponse<MedicationCalendarEvent[]>> {
    try {
      const params = new URLSearchParams();
      
      if (options.patientId) params.append('patientId', options.patientId);
      if (options.startDate) params.append('startDate', options.startDate.toISOString());
      if (options.endDate) params.append('endDate', options.endDate.toISOString());
      if (options.limit) params.append('limit', options.limit.toString());

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/missed?${params}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching missed medications:', error);
      return { success: false, error: 'Failed to fetch missed medications' };
    }
  }

  async triggerMissedDetection(): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/medication-calendar/detect-missed`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error triggering missed detection:', error);
      return { success: false, error: 'Failed to trigger missed detection' };
    }
  }

  // Night Shift Migration
  async detectNightShiftMigration(): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/night-shift-migration/detect`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error detecting night shift migration:', error);
      return { success: false, error: 'Failed to detect migration needs' };
    }
  }

  async executeNightShiftMigration(migrationId: string, approved: boolean): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/night-shift-migration/execute`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ migrationId, approved }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error executing night shift migration:', error);
      return { success: false, error: 'Failed to execute migration' };
    }
  }

  // Compliance Monitoring
  async getComplianceAlerts(): Promise<ApiResponse<any[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/compliance-alerts`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching compliance alerts:', error);
      return { success: false, error: 'Failed to fetch compliance alerts' };
    }
  }

  async acknowledgeComplianceAlert(alertId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/patients/compliance-alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Error acknowledging compliance alert:', error);
      return { success: false, error: 'Failed to acknowledge alert' };
    }
  }
}
```

---

## 9. Database Indexes Required

### Firestore Composite Indexes

**Add to [`firestore.indexes.json`](firestore.indexes.json)**
```json
{
  "indexes": [
    {
      "collectionGroup": "medication_calendar_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledDateTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_calendar_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledDateTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_calendar_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "medicationId", "order": "ASCENDING" },
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "scheduledDateTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_compliance_alerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "severity", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "family_notification_queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledFor", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "medication_event_archive",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "archivedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 10. Security Rules Updates

**Add to [`firestore.rules`](firestore.rules)**
```javascript
// Grace period configuration
match /medication_grace_periods/{patientId} {
  allow read, write: if request.auth != null && request.auth.uid == patientId;
  allow read: if request.auth != null && 
    exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + patientId)) &&
    get(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + patientId)).data.status == 'active';
}

// Compliance rules
match /medication_compliance_rules/{ruleId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.patientId;
  allow read: if request.auth != null && 
    exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)) &&
    get(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)).data.status == 'active';
}

// Compliance alerts
match /medication_compliance_alerts/{alertId} {
  allow read: if request.auth != null && 
    (request.auth.uid == resource.data.patientId ||
     exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)));
  allow write: if request.auth != null && request.auth.uid == resource.data.patientId;
}

// Family notification rules
match /family_notification_rules/{ruleId} {
  allow read, write: if request.auth != null && 
    (request.auth.uid == resource.data.patientId || request.auth.uid == resource.data.familyMemberId);
}

// Night shift migrations
match /night_shift_migrations/{migrationId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.patientId;
}

// Event archive (read-only for users)
match /medication_event_archive/{archiveId} {
  allow read: if request.auth != null && 
    (request.auth.uid == resource.data.patientId ||
     exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)));
}
```

This implementation specification provides the detailed code structure and implementation patterns needed to build all the enhanced medication system features while maintaining consistency with the existing codebase architecture.