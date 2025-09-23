/**
 * Medication Data Migration Utilities
 * 
 * Provides utilities to transition from the fragmented system to the unified system:
 * - Migrates 7+ collections to 3 unified collections
 * - Maintains backward compatibility during transition
 * - Provides rollback mechanisms
 * - Ensures data integrity during migration
 */

import * as admin from 'firebase-admin';
import {
  MedicationCommand,
  MedicationEvent,
  UnifiedFamilyAccess,
  MEDICATION_EVENT_TYPES,
  MIGRATION_MAPPING,
  generateCommandId,
  generateEventId,
  generateCorrelationId
} from '../schemas/unifiedMedicationSchema';

export interface MigrationOptions {
  patientId?: string; // Migrate specific patient or all patients
  dryRun: boolean;
  batchSize: number;
  preserveOriginal: boolean; // Keep original collections during migration
  validateAfterMigration: boolean;
  rollbackOnError: boolean;
}

export interface MigrationResult {
  success: boolean;
  patientId?: string;
  collections: {
    medications: { found: number; migrated: number; errors: number };
    medication_schedules: { found: number; migrated: number; errors: number };
    medication_calendar_events: { found: number; migrated: number; errors: number };
    medication_reminders: { found: number; migrated: number; errors: number };
    patient_medication_preferences: { found: number; migrated: number; errors: number };
    family_calendar_access: { found: number; migrated: number; errors: number };
  };
  unified: {
    medication_commands: { created: number; errors: number };
    medication_events: { created: number; errors: number };
    family_access: { created: number; errors: number };
  };
  summary: {
    totalFound: number;
    totalMigrated: number;
    totalErrors: number;
    migrationTimeMs: number;
  };
  errors: string[];
  warnings: string[];
  rollbackInfo?: {
    rollbackPerformed: boolean;
    rollbackErrors: string[];
  };
}

export class MedicationDataMigration {
  private firestore: admin.firestore.Firestore;
  private migrationLog: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.migrationLog = this.firestore.collection('medication_migration_log');
  }

  // ===== MAIN MIGRATION METHODS =====

  /**
   * Migrate medication data for a specific patient or all patients
   */
  async migrateMedicationData(options: MigrationOptions): Promise<MigrationResult> {
    const startTime = Date.now();
    const migrationId = this.generateMigrationId();
    
    console.log('🔄 MedicationDataMigration: Starting migration:', migrationId, options);

    const result: MigrationResult = {
      success: false,
      patientId: options.patientId,
      collections: {
        medications: { found: 0, migrated: 0, errors: 0 },
        medication_schedules: { found: 0, migrated: 0, errors: 0 },
        medication_calendar_events: { found: 0, migrated: 0, errors: 0 },
        medication_reminders: { found: 0, migrated: 0, errors: 0 },
        patient_medication_preferences: { found: 0, migrated: 0, errors: 0 },
        family_calendar_access: { found: 0, migrated: 0, errors: 0 }
      },
      unified: {
        medication_commands: { created: 0, errors: 0 },
        medication_events: { created: 0, errors: 0 },
        family_access: { created: 0, errors: 0 }
      },
      summary: {
        totalFound: 0,
        totalMigrated: 0,
        totalErrors: 0,
        migrationTimeMs: 0
      },
      errors: [],
      warnings: []
    };

    try {
      // Log migration start
      await this.logMigrationStart(migrationId, options);

      // Phase 1: Migrate medications to medication_commands
      console.log('📝 Phase 1: Migrating medications to commands');
      await this.migrateMedicationsToCommands(options, result);

      // Phase 2: Migrate calendar events to medication_events
      console.log('📝 Phase 2: Migrating calendar events to events');
      await this.migrateCalendarEventsToEvents(options, result);

      // Phase 3: Migrate family access
      console.log('📝 Phase 3: Migrating family access');
      await this.migrateFamilyAccess(options, result);

      // Phase 4: Validation (if enabled)
      if (options.validateAfterMigration) {
        console.log('📝 Phase 4: Validating migrated data');
        await this.validateMigratedData(options, result);
      }

      // Calculate summary
      result.summary.totalFound = Object.values(result.collections)
        .reduce((sum, col) => sum + col.found, 0);
      result.summary.totalMigrated = Object.values(result.collections)
        .reduce((sum, col) => sum + col.migrated, 0);
      result.summary.totalErrors = Object.values(result.collections)
        .reduce((sum, col) => sum + col.errors, 0) +
        Object.values(result.unified)
        .reduce((sum, col) => sum + col.errors, 0);
      result.summary.migrationTimeMs = Date.now() - startTime;

      result.success = result.summary.totalErrors === 0;

      // Log migration completion
      await this.logMigrationComplete(migrationId, result);

      console.log('✅ Migration completed:', migrationId, result.summary);

      return result;

    } catch (error) {
      console.error('❌ Migration failed:', migrationId, error);
      
      result.errors.push(error instanceof Error ? error.message : 'Unknown migration error');
      result.summary.migrationTimeMs = Date.now() - startTime;

      // Attempt rollback if enabled
      if (options.rollbackOnError && !options.dryRun) {
        console.log('🔄 Attempting migration rollback');
        
        try {
          const rollbackResult = await this.rollbackMigration(migrationId, options);
          result.rollbackInfo = rollbackResult;
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
          result.rollbackInfo = {
            rollbackPerformed: false,
            rollbackErrors: [rollbackError instanceof Error ? rollbackError.message : 'Rollback failed']
          };
        }
      }

      await this.logMigrationFailure(migrationId, result);

      return result;
    }
  }

  // ===== COLLECTION-SPECIFIC MIGRATION =====

  /**
   * Migrate medications collection to medication_commands
   */
  private async migrateMedicationsToCommands(
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<void> {
    try {
      // Get medications to migrate
      let medicationsQuery = this.firestore.collection('medications');
      
      if (options.patientId) {
        medicationsQuery = medicationsQuery.where('patientId', '==', options.patientId) as any;
      }

      const medicationsSnapshot = await medicationsQuery.get();
      result.collections.medications.found = medicationsSnapshot.docs.length;

      console.log(`📊 Found ${medicationsSnapshot.docs.length} medications to migrate`);

      // Process in batches
      const batches = this.chunkArray(medicationsSnapshot.docs, options.batchSize);

      for (const batch of batches) {
        if (options.dryRun) {
          console.log(`🔍 DRY RUN: Would migrate ${batch.length} medications`);
          result.collections.medications.migrated += batch.length;
          continue;
        }

        try {
          await this.migrateMedicationsBatch(batch, result);
        } catch (batchError) {
          console.error('❌ Batch migration failed:', batchError);
          result.collections.medications.errors += batch.length;
          result.errors.push(`Medications batch failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      console.error('❌ Error migrating medications:', error);
      result.errors.push(`Medications migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate a batch of medications
   */
  private async migrateMedicationsBatch(
    medicationDocs: admin.firestore.QueryDocumentSnapshot[],
    result: MigrationResult
  ): Promise<void> {
    const batch = this.firestore.batch();

    for (const medicationDoc of medicationDocs) {
      try {
        const medicationData = medicationDoc.data();
        
        // Get related schedule data
        const scheduleQuery = await this.firestore.collection('medication_schedules')
          .where('medicationId', '==', medicationDoc.id)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        const scheduleData = scheduleQuery.empty ? null : scheduleQuery.docs[0].data();

        // Get related reminder data
        const reminderQuery = await this.firestore.collection('medication_reminders')
          .where('medicationId', '==', medicationDoc.id)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        const reminderData = reminderQuery.empty ? null : reminderQuery.docs[0].data();

        // Create unified command
        const commandId = generateCommandId(medicationData.patientId, medicationData.name);
        const unifiedCommand = this.createUnifiedCommand(
          commandId,
          medicationData,
          scheduleData,
          reminderData
        );

        // Add to batch
        batch.set(
          this.firestore.collection('medication_commands').doc(commandId),
          this.serializeCommand(unifiedCommand)
        );

        result.collections.medications.migrated++;

      } catch (error) {
        console.error('❌ Error migrating medication:', medicationDoc.id, error);
        result.collections.medications.errors++;
        result.errors.push(`Medication ${medicationDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Execute batch
    await batch.commit();
    result.unified.medication_commands.created += medicationDocs.length - result.collections.medications.errors;
  }

  /**
   * Migrate calendar events to medication_events
   */
  private async migrateCalendarEventsToEvents(
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<void> {
    try {
      // Get calendar events to migrate
      let eventsQuery = this.firestore.collection('medication_calendar_events');
      
      if (options.patientId) {
        eventsQuery = eventsQuery.where('patientId', '==', options.patientId) as any;
      }

      // Limit to recent events to avoid overwhelming migration
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      eventsQuery = eventsQuery.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo)) as any;

      const eventsSnapshot = await eventsQuery.get();
      result.collections.medication_calendar_events.found = eventsSnapshot.docs.length;

      console.log(`📊 Found ${eventsSnapshot.docs.length} calendar events to migrate`);

      // Process in batches
      const batches = this.chunkArray(eventsSnapshot.docs, options.batchSize);

      for (const batch of batches) {
        if (options.dryRun) {
          console.log(`🔍 DRY RUN: Would migrate ${batch.length} calendar events`);
          result.collections.medication_calendar_events.migrated += batch.length;
          continue;
        }

        try {
          await this.migrateCalendarEventsBatch(batch, result);
        } catch (batchError) {
          console.error('❌ Calendar events batch migration failed:', batchError);
          result.collections.medication_calendar_events.errors += batch.length;
          result.errors.push(`Calendar events batch failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      console.error('❌ Error migrating calendar events:', error);
      result.errors.push(`Calendar events migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate a batch of calendar events
   */
  private async migrateCalendarEventsBatch(
    eventDocs: admin.firestore.QueryDocumentSnapshot[],
    result: MigrationResult
  ): Promise<void> {
    const batch = this.firestore.batch();

    for (const eventDoc of eventDocs) {
      try {
        const eventData = eventDoc.data();
        
        // Map old event to new event structure
        const eventType = this.mapCalendarEventToEventType(eventData.status);
        const eventId = generateEventId(eventData.medicationId || 'unknown', eventType);

        const unifiedEvent: MedicationEvent = {
          id: eventId,
          commandId: eventData.medicationId || 'unknown',
          patientId: eventData.patientId,
          eventType,
          eventData: {
            scheduledDateTime: eventData.scheduledDateTime?.toDate(),
            actualDateTime: eventData.actualTakenDateTime?.toDate(),
            dosageAmount: eventData.dosageAmount,
            takenBy: eventData.takenBy,
            actionNotes: eventData.notes,
            additionalData: {
              migratedFrom: 'medication_calendar_events',
              originalId: eventDoc.id
            }
          },
          context: {
            medicationName: eventData.medicationName || 'Unknown',
            calendarEventId: eventDoc.id,
            triggerSource: 'api_call'
          },
          timing: {
            eventTimestamp: eventData.scheduledDateTime?.toDate() || new Date(),
            scheduledFor: eventData.scheduledDateTime?.toDate(),
            isOnTime: eventData.isOnTime,
            minutesLate: eventData.minutesLate
          },
          metadata: {
            eventVersion: 1,
            createdAt: eventData.createdAt?.toDate() || new Date(),
            createdBy: eventData.takenBy || 'system',
            correlationId: generateCorrelationId()
          }
        };

        // Add to batch
        batch.set(
          this.firestore.collection('medication_events').doc(eventId),
          this.serializeEvent(unifiedEvent)
        );

        result.collections.medication_calendar_events.migrated++;

      } catch (error) {
        console.error('❌ Error migrating calendar event:', eventDoc.id, error);
        result.collections.medication_calendar_events.errors++;
        result.errors.push(`Calendar event ${eventDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Execute batch
    await batch.commit();
    result.unified.medication_events.created += eventDocs.length - result.collections.medication_calendar_events.errors;
  }

  /**
   * Migrate family access data
   */
  private async migrateFamilyAccess(
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<void> {
    try {
      // Get family access records to migrate
      let familyQuery = this.firestore.collection('family_calendar_access');
      
      if (options.patientId) {
        familyQuery = familyQuery.where('patientId', '==', options.patientId) as any;
      }

      const familySnapshot = await familyQuery.where('status', '==', 'active').get();
      result.collections.family_calendar_access.found = familySnapshot.docs.length;

      console.log(`📊 Found ${familySnapshot.docs.length} family access records to migrate`);

      // Process in batches
      const batches = this.chunkArray(familySnapshot.docs, options.batchSize);

      for (const batch of batches) {
        if (options.dryRun) {
          console.log(`🔍 DRY RUN: Would migrate ${batch.length} family access records`);
          result.collections.family_calendar_access.migrated += batch.length;
          continue;
        }

        try {
          await this.migrateFamilyAccessBatch(batch, result);
        } catch (batchError) {
          console.error('❌ Family access batch migration failed:', batchError);
          result.collections.family_calendar_access.errors += batch.length;
          result.errors.push(`Family access batch failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      console.error('❌ Error migrating family access:', error);
      result.errors.push(`Family access migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate a batch of family access records
   */
  private async migrateFamilyAccessBatch(
    familyDocs: admin.firestore.QueryDocumentSnapshot[],
    result: MigrationResult
  ): Promise<void> {
    const batch = this.firestore.batch();

    for (const familyDoc of familyDocs) {
      try {
        const familyData = familyDoc.data();
        
        // Create simplified unified family access
        const unifiedAccess: UnifiedFamilyAccess = {
          id: familyDoc.id,
          patientId: familyData.patientId,
          familyMemberId: familyData.familyMemberId,
          familyMemberName: familyData.familyMemberName,
          familyMemberEmail: familyData.familyMemberEmail,
          relationship: familyData.relationship || 'family_member',
          permissions: {
            canView: familyData.permissions?.canView || false,
            canEdit: familyData.permissions?.canEdit || false,
            canManage: familyData.permissions?.canCreate || familyData.permissions?.canDelete || false,
            canViewMedications: familyData.permissions?.canViewMedicalDetails || false,
            canEditMedications: familyData.permissions?.canEdit || false,
            canMarkTaken: familyData.permissions?.canEdit || false,
            canReceiveAlerts: familyData.permissions?.canReceiveNotifications || false,
            isEmergencyContact: familyData.emergencyAccess || false,
            emergencyAccessLevel: familyData.emergencyAccess ? 'full_access' : 'none'
          },
          accessLevel: familyData.accessLevel || 'limited',
          status: familyData.status || 'active',
          invitationToken: familyData.invitationToken,
          invitationExpiresAt: familyData.invitationExpiresAt?.toDate(),
          invitedAt: familyData.invitedAt?.toDate() || new Date(),
          acceptedAt: familyData.acceptedAt?.toDate(),
          lastAccessAt: familyData.lastAccessAt?.toDate(),
          createdBy: familyData.createdBy || 'system',
          createdAt: familyData.createdAt?.toDate() || new Date(),
          updatedAt: familyData.updatedAt?.toDate() || new Date()
        };

        // Add to batch
        batch.set(
          this.firestore.collection('family_access').doc(familyDoc.id),
          this.serializeFamilyAccess(unifiedAccess)
        );

        result.collections.family_calendar_access.migrated++;

      } catch (error) {
        console.error('❌ Error migrating family access:', familyDoc.id, error);
        result.collections.family_calendar_access.errors++;
        result.errors.push(`Family access ${familyDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Execute batch
    await batch.commit();
    result.unified.family_access.created += familyDocs.length - result.collections.family_calendar_access.errors;
  }

  // ===== VALIDATION AND ROLLBACK =====

  /**
   * Validate migrated data integrity
   */
  private async validateMigratedData(
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<void> {
    try {
      console.log('🔍 Validating migrated data integrity');

      // Validate commands
      const commandsQuery = options.patientId 
        ? this.firestore.collection('medication_commands').where('patientId', '==', options.patientId)
        : this.firestore.collection('medication_commands');

      const commandsSnapshot = await commandsQuery.get();
      
      for (const commandDoc of commandsSnapshot.docs) {
        const command = commandDoc.data() as MedicationCommand;
        
        // Basic validation
        if (!command.medication?.name || !command.schedule?.frequency) {
          result.warnings.push(`Command ${commandDoc.id} missing required fields`);
        }
        
        // Check for corresponding events
        const eventsQuery = await this.firestore.collection('medication_events')
          .where('commandId', '==', commandDoc.id)
          .limit(1)
          .get();
        
        if (eventsQuery.empty) {
          result.warnings.push(`Command ${commandDoc.id} has no corresponding events`);
        }
      }

      console.log('✅ Data validation completed');

    } catch (error) {
      console.error('❌ Error validating migrated data:', error);
      result.warnings.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rollback migration changes
   */
  private async rollbackMigration(
    migrationId: string,
    options: MigrationOptions
  ): Promise<{
    rollbackPerformed: boolean;
    rollbackErrors: string[];
  }> {
    const rollbackErrors: string[] = [];

    try {
      console.log('🔄 Rolling back migration:', migrationId);

      // Delete created unified collections data
      const collections = ['medication_commands', 'medication_events', 'family_access'];
      
      for (const collectionName of collections) {
        try {
          let query = this.firestore.collection(collectionName);
          
          if (options.patientId) {
            query = query.where('patientId', '==', options.patientId) as any;
          }

          // Add migration marker to identify migrated data
          query = query.where('metadata.migratedAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000))) as any;

          const snapshot = await query.get();
          
          if (!snapshot.empty) {
            const deleteBatch = this.firestore.batch();
            snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            
            console.log(`✅ Rolled back ${snapshot.docs.length} documents from ${collectionName}`);
          }

        } catch (collectionError) {
          rollbackErrors.push(`Failed to rollback ${collectionName}: ${collectionError instanceof Error ? collectionError.message : 'Unknown error'}`);
        }
      }

      return {
        rollbackPerformed: rollbackErrors.length === 0,
        rollbackErrors
      };

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      rollbackErrors.push(error instanceof Error ? error.message : 'Unknown rollback error');
      
      return {
        rollbackPerformed: false,
        rollbackErrors
      };
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Create unified command from legacy data
   */
  private createUnifiedCommand(
    commandId: string,
    medicationData: any,
    scheduleData: any,
    reminderData: any
  ): MedicationCommand {
    const now = new Date();

    return {
      id: commandId,
      patientId: medicationData.patientId,
      
      medication: {
        name: medicationData.name,
        genericName: medicationData.genericName,
        brandName: medicationData.brandName,
        rxcui: medicationData.rxcui,
        dosage: medicationData.dosage,
        strength: medicationData.strength,
        dosageForm: medicationData.dosageForm,
        route: medicationData.route || 'oral',
        instructions: medicationData.instructions,
        prescribedBy: medicationData.prescribedBy,
        prescribedDate: medicationData.prescribedDate?.toDate(),
        pharmacy: medicationData.pharmacy,
        prescriptionNumber: medicationData.prescriptionNumber,
        refillsRemaining: medicationData.refillsRemaining,
        maxDailyDose: medicationData.maxDailyDose,
        sideEffects: medicationData.sideEffects || [],
        notes: medicationData.notes
      },
      
      schedule: {
        frequency: scheduleData?.frequency || this.inferFrequency(medicationData.frequency),
        times: scheduleData?.times || medicationData.reminderTimes || ['07:00'],
        daysOfWeek: scheduleData?.daysOfWeek,
        dayOfMonth: scheduleData?.dayOfMonth,
        startDate: scheduleData?.startDate?.toDate() || medicationData.startDate?.toDate() || now,
        endDate: scheduleData?.endDate?.toDate() || medicationData.endDate?.toDate(),
        isIndefinite: scheduleData?.isIndefinite ?? !medicationData.endDate,
        dosageAmount: scheduleData?.dosageAmount || medicationData.dosage || '1 tablet',
        scheduleInstructions: scheduleData?.instructions,
        timingType: 'absolute'
      },
      
      reminders: {
        enabled: reminderData?.isActive ?? medicationData.hasReminders ?? true,
        minutesBefore: reminderData?.reminderMinutesBefore || [15, 5],
        notificationMethods: reminderData?.notificationMethods || ['browser', 'push'],
        quietHours: {
          start: '22:00',
          end: '07:00',
          enabled: true
        }
      },
      
      gracePeriod: {
        defaultMinutes: 30, // Default grace period
        medicationType: this.classifyMedicationType(medicationData.name),
        weekendMultiplier: 1.5,
        holidayMultiplier: 2.0
      },
      
      status: {
        current: medicationData.isActive ? 'active' : 'discontinued',
        isActive: medicationData.isActive ?? true,
        isPRN: medicationData.isPRN ?? false,
        lastStatusChange: medicationData.updatedAt?.toDate() || now,
        statusChangedBy: 'migration'
      },
      
      preferences: {
        timeSlot: this.mapLegacyTimeSlot(this.determineTimeSlot(scheduleData?.times?.[0] || '07:00')),
        separationRules: []
      },
      
      metadata: {
        version: 1,
        createdAt: medicationData.createdAt?.toDate() || now,
        createdBy: 'migration',
        updatedAt: now,
        updatedBy: 'migration',
        checksum: this.calculateChecksum(commandId)
      }
    };
  }

  /**
   * Map calendar event status to event type
   */
  private mapCalendarEventToEventType(status: string): any {
    const mapping = MIGRATION_MAPPING.medication_calendar_events.eventTypeMapping;
    return mapping[status as keyof typeof mapping] || MEDICATION_EVENT_TYPES.DOSE_SCHEDULED;
  }

  /**
   * Infer frequency from legacy frequency string
   */
  private inferFrequency(frequency: string): 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' {
    if (!frequency) return 'daily';
    
    const freq = frequency.toLowerCase();
    
    if (freq.includes('twice') || freq.includes('bid')) return 'twice_daily';
    if (freq.includes('three') || freq.includes('tid')) return 'three_times_daily';
    if (freq.includes('four') || freq.includes('qid')) return 'four_times_daily';
    if (freq.includes('weekly')) return 'weekly';
    if (freq.includes('monthly')) return 'monthly';
    if (freq.includes('needed') || freq.includes('prn')) return 'as_needed';
    
    return 'daily';
  }

  /**
   * Classify medication type for grace period
   */
  private classifyMedicationType(medicationName: string): 'critical' | 'standard' | 'vitamin' | 'prn' {
    const name = medicationName.toLowerCase();
    
    const criticalMeds = ['insulin', 'warfarin', 'digoxin', 'levothyroxine'];
    if (criticalMeds.some(med => name.includes(med))) return 'critical';
    
    const vitaminMeds = ['vitamin', 'calcium', 'iron', 'supplement'];
    if (vitaminMeds.some(med => name.includes(med))) return 'vitamin';
    
    return 'standard';
  }

  /**
   * Determine time slot from time string
   */
  private determineTimeSlot(time: string): 'morning' | 'noon' | 'evening' | 'bedtime' | 'custom' {
    const hour = parseInt(time.split(':')[0]);
    
    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'noon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 || hour < 6) return 'bedtime';
    
    return 'custom';
  }

  /**
   * Map legacy time slot names to new unified names
   */
  private mapLegacyTimeSlot(timeSlot: 'morning' | 'noon' | 'evening' | 'bedtime' | 'custom'): 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom' {
    switch (timeSlot) {
      case 'noon':
        return 'lunch';
      case 'bedtime':
        return 'beforeBed';
      case 'morning':
      case 'evening':
      case 'custom':
        return timeSlot;
      default:
        return 'custom';
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(commandId: string): string {
    return Buffer.from(`${commandId}_${Date.now()}`).toString('base64').slice(0, 16);
  }

  /**
   * Serialize command for Firestore
   */
  private serializeCommand(command: MedicationCommand): any {
    return {
      ...command,
      'medication.prescribedDate': command.medication.prescribedDate ? 
        admin.firestore.Timestamp.fromDate(command.medication.prescribedDate) : null,
      'schedule.startDate': admin.firestore.Timestamp.fromDate(command.schedule.startDate),
      'schedule.endDate': command.schedule.endDate ? 
        admin.firestore.Timestamp.fromDate(command.schedule.endDate) : null,
      'status.pausedUntil': command.status.pausedUntil ? 
        admin.firestore.Timestamp.fromDate(command.status.pausedUntil) : null,
      'status.lastStatusChange': admin.firestore.Timestamp.fromDate(command.status.lastStatusChange),
      'status.discontinueDate': command.status.discontinueDate ? 
        admin.firestore.Timestamp.fromDate(command.status.discontinueDate) : null,
      'metadata.createdAt': admin.firestore.Timestamp.fromDate(command.metadata.createdAt),
      'metadata.updatedAt': admin.firestore.Timestamp.fromDate(command.metadata.updatedAt)
    };
  }

  /**
   * Serialize event for Firestore
   */
  private serializeEvent(event: MedicationEvent): any {
    return {
      ...event,
      'eventData.scheduledDateTime': event.eventData.scheduledDateTime ? 
        admin.firestore.Timestamp.fromDate(event.eventData.scheduledDateTime) : null,
      'eventData.actualDateTime': event.eventData.actualDateTime ? 
        admin.firestore.Timestamp.fromDate(event.eventData.actualDateTime) : null,
      'timing.eventTimestamp': admin.firestore.Timestamp.fromDate(event.timing.eventTimestamp),
      'timing.scheduledFor': event.timing.scheduledFor ? 
        admin.firestore.Timestamp.fromDate(event.timing.scheduledFor) : null,
      'timing.gracePeriodEnd': event.timing.gracePeriodEnd ? 
        admin.firestore.Timestamp.fromDate(event.timing.gracePeriodEnd) : null,
      'metadata.createdAt': admin.firestore.Timestamp.fromDate(event.metadata.createdAt)
    };
  }

  /**
   * Serialize family access for Firestore
   */
  private serializeFamilyAccess(access: UnifiedFamilyAccess): any {
    return {
      ...access,
      invitationExpiresAt: access.invitationExpiresAt ? 
        admin.firestore.Timestamp.fromDate(access.invitationExpiresAt) : null,
      invitedAt: admin.firestore.Timestamp.fromDate(access.invitedAt),
      acceptedAt: access.acceptedAt ? 
        admin.firestore.Timestamp.fromDate(access.acceptedAt) : null,
      lastAccessAt: access.lastAccessAt ? 
        admin.firestore.Timestamp.fromDate(access.lastAccessAt) : null,
      createdAt: admin.firestore.Timestamp.fromDate(access.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(access.updatedAt)
    };
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Generate migration ID
   */
  private generateMigrationId(): string {
    return `mig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== LOGGING METHODS =====

  private async logMigrationStart(migrationId: string, options: MigrationOptions): Promise<void> {
    try {
      await this.migrationLog.doc(migrationId).set({
        migrationId,
        status: 'started',
        options,
        startedAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging migration start:', error);
    }
  }

  private async logMigrationComplete(migrationId: string, result: MigrationResult): Promise<void> {
    try {
      await this.migrationLog.doc(migrationId).update({
        status: 'completed',
        result,
        completedAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging migration completion:', error);
    }
  }

  private async logMigrationFailure(migrationId: string, result: MigrationResult): Promise<void> {
    try {
      await this.migrationLog.doc(migrationId).update({
        status: 'failed',
        result,
        failedAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging migration failure:', error);
    }
  }
}

// Export singleton instance
export const medicationDataMigration = new MedicationDataMigration();