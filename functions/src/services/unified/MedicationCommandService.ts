/**
 * MedicationCommandService
 * 
 * Single Responsibility: ONLY manages medication command state (CRUD operations)
 * 
 * This service is responsible for:
 * - Creating, reading, updating, deleting medication commands
 * - Validating command data integrity
 * - Managing command versioning
 * - Ensuring data consistency within commands
 * 
 * This service does NOT:
 * - Process events (handled by MedicationEventService)
 * - Send notifications (handled by MedicationNotificationService)
 * - Manage transactions (handled by MedicationTransactionManager)
 * - Coordinate between services (handled by MedicationOrchestrator)
 */

import * as admin from 'firebase-admin';
import {
  MedicationCommand,
  MedicationCommandValidation,
  validateMedicationCommand,
  generateCommandId,
  DEFAULT_GRACE_PERIODS,
  DEFAULT_REMINDER_SETTINGS,
  DEFAULT_TIME_SLOTS,
  FlexibleScheduleConfiguration,
  PatientTimePreferences,
  TIME_BUCKET_UTILS
} from '../../schemas/unifiedMedicationSchema';
import { TimeBucketService } from './TimeBucketService';

export interface CreateMedicationCommandRequest {
  patientId: string;
  medicationData: {
    name: string;
    genericName?: string;
    brandName?: string;
    rxcui?: string;
    dosage: string;
    strength?: string;
    dosageForm?: string;
    route?: string;
    instructions?: string;
    prescribedBy?: string;
    prescribedDate?: Date;
    pharmacy?: string;
    prescriptionNumber?: string;
    refillsRemaining?: number;
    maxDailyDose?: string;
    sideEffects?: string[];
    notes?: string;
  };
  scheduleData: {
    frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed' | 'custom';
    times?: string[]; // Optional - will be computed from patient preferences if not provided
    daysOfWeek?: number[];
    dayOfMonth?: number;
    startDate: Date;
    endDate?: Date;
    isIndefinite: boolean;
    dosageAmount: string;
    scheduleInstructions?: string;
    timezone?: string;
    
    // New flexible scheduling options
    usePatientTimePreferences?: boolean; // Use patient's time bucket preferences
    flexibleScheduling?: FlexibleScheduleConfiguration;
    timeBucketOverrides?: {
      morning?: string;
      lunch?: string;
      evening?: string;
      beforeBed?: string;
    };
  };
  reminderData?: {
    enabled: boolean;
    minutesBefore?: number[];
    notificationMethods?: ('email' | 'sms' | 'push' | 'browser')[];
  };
  createdBy: string;
}

export interface UpdateMedicationCommandRequest {
  commandId: string;
  updates: Partial<MedicationCommand>;
  updatedBy: string;
  reason?: string;
}

export interface MedicationCommandQueryOptions {
  patientId?: string;
  status?: 'active' | 'paused' | 'held' | 'discontinued' | 'completed';
  medicationName?: string;
  frequency?: string;
  isActive?: boolean;
  isPRN?: boolean;
  limit?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export class MedicationCommandService {
  private firestore: admin.firestore.Firestore;
  private collection: admin.firestore.CollectionReference;
  private timeBucketService: TimeBucketService;

  constructor() {
    this.firestore = admin.firestore();
    this.collection = this.firestore.collection('medication_commands');
    this.timeBucketService = new TimeBucketService();
  }

  // ===== CREATE OPERATIONS =====

  /**
   * Create a new medication command
   */
  async createCommand(request: CreateMedicationCommandRequest): Promise<{
    success: boolean;
    data?: MedicationCommand;
    error?: string;
    validation?: MedicationCommandValidation;
  }> {
    try {
      console.log('📝 MedicationCommandService: Creating new command for patient:', request.patientId);

      // Generate command ID
      const commandId = generateCommandId(request.patientId, request.medicationData.name);

      // Determine medication type for grace period
      const medicationType = this.classifyMedicationType(request.medicationData.name, request.scheduleData.frequency);

      // Compute schedule times using patient preferences if requested
      let computedTimes = request.scheduleData.times || [];
      let flexibleScheduling: FlexibleScheduleConfiguration | undefined;
      
      console.log('🔍 DEBUG: scheduleData received:', {
        usePatientTimePreferences: request.scheduleData.usePatientTimePreferences,
        frequency: request.scheduleData.frequency,
        times: request.scheduleData.times,
        flexibleScheduling: request.scheduleData.flexibleScheduling
      });
      
      if (request.scheduleData.usePatientTimePreferences &&
          ['daily', 'twice_daily', 'three_times_daily', 'four_times_daily'].includes(request.scheduleData.frequency)) {
        
        const scheduleResult = await this.timeBucketService.computeMedicationSchedule({
          frequency: request.scheduleData.frequency as 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily',
          patientId: request.patientId,
          medicationName: request.medicationData.name,
          customOverrides: request.scheduleData.timeBucketOverrides,
          flexibleScheduling: request.scheduleData.flexibleScheduling
        });
        
        if (scheduleResult.success && scheduleResult.data) {
          computedTimes = scheduleResult.data.times;
          flexibleScheduling = request.scheduleData.flexibleScheduling;
          console.log('✅ Computed times from patient preferences:', computedTimes);
          console.log('🔍 DEBUG: flexibleScheduling assignment:', flexibleScheduling);
        } else {
          console.warn('⚠️ Failed to compute times from preferences, using defaults');
          computedTimes = this.generateDefaultTimes(request.scheduleData.frequency);
        }
      } else if (computedTimes.length === 0) {
        // Generate default times if none provided
        computedTimes = this.generateDefaultTimes(request.scheduleData.frequency);
      }

      // Normalize dates to ensure they are Date objects (not strings from JSON)
      // This prevents errors when serializing to Firestore Timestamps
      const normalizeDate = (dateValue: Date | string | undefined, defaultValue?: Date): Date | undefined => {
        if (!dateValue) return defaultValue;
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue);
          return isNaN(parsed.getTime()) ? defaultValue : parsed;
        }
        return defaultValue;
      };

      // Build schedule object, filtering out undefined values
      const scheduleBase: any = {
        ...request.scheduleData,
        times: computedTimes,
        timingType: request.scheduleData.usePatientTimePreferences ? 'time_buckets' : 'absolute',
        // Ensure startDate is always a Date object
        startDate: normalizeDate(request.scheduleData.startDate, new Date())!,
        // Ensure endDate is a Date object if provided, otherwise undefined
        endDate: normalizeDate(request.scheduleData.endDate)
      };

      if ('flexibleScheduling' in scheduleBase && scheduleBase.flexibleScheduling === undefined) {
        delete scheduleBase.flexibleScheduling;
      }

      // Delete endDate if it's undefined (not provided)
      if (scheduleBase.endDate === undefined) {
        delete scheduleBase.endDate;
      }

      // Only include flexibleScheduling if it has a value
      if (flexibleScheduling !== undefined) {
        scheduleBase.flexibleScheduling = flexibleScheduling;
      }

      // Only include timeBucketOverrides if it has a value
      if (request.scheduleData.timeBucketOverrides !== undefined) {
        scheduleBase.timeBucketOverrides = request.scheduleData.timeBucketOverrides;
      }

      // Only include computedSchedule if using patient preferences
      if (request.scheduleData.usePatientTimePreferences) {
        scheduleBase.computedSchedule = {
          lastComputedAt: new Date(),
          computedBy: request.createdBy,
          basedOnPreferencesVersion: 1,
          nextRecomputeAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
      }

      // Build complete command object
      const command: MedicationCommand = {
        id: commandId,
        patientId: request.patientId,
        
        medication: {
          ...request.medicationData,
          // Normalize prescribedDate to ensure it's a Date object if provided
          prescribedDate: request.medicationData.prescribedDate
            ? normalizeDate(request.medicationData.prescribedDate)
            : undefined
        },
        
        schedule: scheduleBase,
        
        reminders: {
          enabled: request.reminderData?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
          minutesBefore: request.reminderData?.minutesBefore ?? DEFAULT_REMINDER_SETTINGS.minutesBefore,
          notificationMethods: request.reminderData?.notificationMethods ?? DEFAULT_REMINDER_SETTINGS.notificationMethods,
          quietHours: DEFAULT_REMINDER_SETTINGS.quietHours
        },
        
        gracePeriod: {
          defaultMinutes: DEFAULT_GRACE_PERIODS[medicationType],
          medicationType,
          weekendMultiplier: 1.5,
          holidayMultiplier: 2.0
        },
        
        status: {
          current: 'active',
          isActive: true,
          isPRN: request.scheduleData.frequency === 'as_needed',
          lastStatusChange: new Date(),
          statusChangedBy: request.createdBy
        },
        
        preferences: {
          timeSlot: this.determineTimeSlot(computedTimes[0]),
          separationRules: []
        },
        
        metadata: {
          version: 1,
          createdAt: new Date(),
          createdBy: request.createdBy,
          updatedAt: new Date(),
          updatedBy: request.createdBy,
          checksum: this.calculateChecksum(commandId, request.medicationData.name, request.scheduleData.frequency)
        }
      };

      console.log('🔍 DEBUG: Final command schedule before validation:', {
        frequency: command.schedule.frequency,
        times: command.schedule.times,
        flexibleScheduling: command.schedule.flexibleScheduling,
        timingType: command.schedule.timingType
      });

      // Validate the complete command
      const validation = validateMedicationCommand(command);
      if (!validation.isValid) {
        console.error('❌ Command validation failed:', validation.errors);
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          validation
        };
      }

      // Check for duplicates
      const duplicateCheck = await this.checkForDuplicates(request.patientId, request.medicationData.name);
      if (duplicateCheck.hasDuplicates) {
        console.warn('⚠️ Potential duplicate medication detected:', duplicateCheck.duplicates);
        // Don't fail, but include in validation warnings
        validation.warnings.push(`Potential duplicate: ${duplicateCheck.duplicates.map(d => d.medication.name).join(', ')}`);
      }

      // Save to Firestore
      await this.collection.doc(commandId).set(this.serializeCommand(command));

      console.log('✅ MedicationCommandService: Command created successfully:', commandId);

      return {
        success: true,
        data: command,
        validation
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error creating command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create medication command'
      };
    }
  }

  // ... rest of the code remains the same ...

  private removeUndefinedValues<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map(item => this.removeUndefinedValues(item))
        .filter(item => item !== undefined) as unknown as T;
    }

    if (typeof value === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (val !== undefined) {
          cleaned[key] = this.removeUndefinedValues(val);
        }
      }
      return cleaned as unknown as T;
    }

    return value;
  }

  /**
   * Serialize command for Firestore storage
   */
  private serializeCommand(command: MedicationCommand): any {
    console.log('🔍 DEBUG [serializeCommand]: Input command.schedule:', {
      frequency: command.schedule.frequency,
      flexibleScheduling: command.schedule.flexibleScheduling,
      hasFlexibleScheduling: 'flexibleScheduling' in command.schedule,
      flexibleSchedulingType: typeof command.schedule.flexibleScheduling
    });

    // Helper function to safely convert date-like values to Firestore Timestamp
    const toTimestamp = (dateValue: Date | string | undefined | null): admin.firestore.Timestamp | null => {
      if (!dateValue) return null;
      
      // If already a Date object, use it
      if (dateValue instanceof Date) {
        // Validate it's not an invalid date
        if (isNaN(dateValue.getTime())) {
          console.warn('⚠️ Invalid Date object detected, using current date');
          return admin.firestore.Timestamp.now();
        }
        return admin.firestore.Timestamp.fromDate(dateValue);
      }
      
      // If it's a string, try to parse it
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) {
          console.warn('⚠️ Invalid date string detected, using current date:', dateValue);
          return admin.firestore.Timestamp.now();
        }
        return admin.firestore.Timestamp.fromDate(parsed);
      }
      
      console.warn('⚠️ Unexpected date type:', typeof dateValue, dateValue);
      return admin.firestore.Timestamp.now();
    };

    // Helper function to remove undefined values from an object
    const removeUndefined = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj;
      
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    };

    const serialized = {
      id: command.id,
      patientId: command.patientId,
      medication: {
        ...command.medication,
        prescribedDate: toTimestamp(command.medication.prescribedDate),
      },
      schedule: removeUndefined({
        ...command.schedule,
        startDate: toTimestamp(command.schedule.startDate)!,
        endDate: toTimestamp(command.schedule.endDate),
        computedSchedule: command.schedule.computedSchedule ? removeUndefined({
          ...command.schedule.computedSchedule,
          lastComputedAt: toTimestamp(command.schedule.computedSchedule.lastComputedAt),
          nextRecomputeAt: toTimestamp(command.schedule.computedSchedule.nextRecomputeAt)
        }) : undefined
      }),
      reminders: command.reminders,
      gracePeriod: command.gracePeriod,
      status: {
        ...command.status,
        pausedUntil: toTimestamp(command.status.pausedUntil),
        lastStatusChange: toTimestamp(command.status.lastStatusChange)!,
        discontinueDate: toTimestamp(command.status.discontinueDate),
      },
      preferences: command.preferences,
      metadata: {
        ...command.metadata,
        createdAt: toTimestamp(command.metadata.createdAt)!,
        updatedAt: toTimestamp(command.metadata.updatedAt)!
      }
    };

    console.log('🔍 DEBUG [serializeCommand]: Output serialized.schedule:', {
      frequency: serialized.schedule.frequency,
      flexibleScheduling: serialized.schedule.flexibleScheduling,
      hasFlexibleScheduling: 'flexibleScheduling' in serialized.schedule,
      scheduleKeys: Object.keys(serialized.schedule)
    });

    return serialized;
  }

  /**
   * Deserialize command from Firestore data
   */
  private deserializeCommand(id: string, data: any): MedicationCommand {
    return {
      ...data,
      id,
      medication: {
        ...data.medication,
        prescribedDate: data.medication?.prescribedDate?.toDate?.() || null
      },
      schedule: {
        ...data.schedule,
        startDate: data.schedule.startDate.toDate(),
        endDate: data.schedule.endDate?.toDate?.() || null,
        computedSchedule: data.schedule.computedSchedule ? {
          ...data.schedule.computedSchedule,
          lastComputedAt: data.schedule.computedSchedule.lastComputedAt?.toDate?.() || new Date(),
          nextRecomputeAt: data.schedule.computedSchedule.nextRecomputeAt?.toDate?.() || new Date()
        } : undefined
      },
      status: {
        ...data.status,
        pausedUntil: data.status.pausedUntil?.toDate?.() || null,
        lastStatusChange: data.status.lastStatusChange.toDate(),
        discontinueDate: data.status.discontinueDate?.toDate?.() || null
      },
      metadata: {
        ...data.metadata,
        createdAt: data.metadata.createdAt.toDate(),
        updatedAt: data.metadata.updatedAt.toDate()
      }
    };
  }

  // ===== BATCH OPERATIONS =====

  /**
   * Create multiple commands in a batch
   */
  async createCommandsBatch(requests: CreateMedicationCommandRequest[]): Promise<{
    success: boolean;
    data?: {
      created: MedicationCommand[];
      failed: Array<{ request: CreateMedicationCommandRequest; error: string }>;
    };
    error?: string;
  }> {
    try {
      console.log('📝 MedicationCommandService: Creating batch of', requests.length, 'commands');

      const batch = this.firestore.batch();
      const created: MedicationCommand[] = [];
      const failed: Array<{ request: CreateMedicationCommandRequest; error: string }> = [];

      for (const request of requests) {
        try {
          const commandId = generateCommandId(request.patientId, request.medicationData.name);
          const medicationType = this.classifyMedicationType(request.medicationData.name, request.scheduleData.frequency);

          const command: MedicationCommand = {
            id: commandId,
            patientId: request.patientId,
            medication: { ...request.medicationData },
            schedule: {
              ...request.scheduleData,
              times: request.scheduleData.times || this.generateDefaultTimes(request.scheduleData.frequency),
              timingType: 'absolute'
            },
            reminders: {
              enabled: request.reminderData?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
              minutesBefore: request.reminderData?.minutesBefore ?? DEFAULT_REMINDER_SETTINGS.minutesBefore,
              notificationMethods: request.reminderData?.notificationMethods ?? DEFAULT_REMINDER_SETTINGS.notificationMethods,
              quietHours: DEFAULT_REMINDER_SETTINGS.quietHours
            },
            gracePeriod: {
              defaultMinutes: DEFAULT_GRACE_PERIODS[medicationType],
              medicationType,
              weekendMultiplier: 1.5,
              holidayMultiplier: 2.0
            },
            status: {
              current: 'active',
              isActive: true,
              isPRN: request.scheduleData.frequency === 'as_needed',
              lastStatusChange: new Date(),
              statusChangedBy: request.createdBy
            },
            preferences: {
              timeSlot: this.determineTimeSlot((request.scheduleData.times || this.generateDefaultTimes(request.scheduleData.frequency))[0]),
              separationRules: []
            },
            metadata: {
              version: 1,
              createdAt: new Date(),
              createdBy: request.createdBy,
              updatedAt: new Date(),
              updatedBy: request.createdBy,
              checksum: this.calculateChecksum(commandId, request.medicationData.name, request.scheduleData.frequency)
            }
          };

          // Validate command
          const validation = validateMedicationCommand(command);
          if (!validation.isValid) {
            failed.push({
              request,
              error: `Validation failed: ${validation.errors.join(', ')}`
            });
            continue;
          }

          // Add to batch
          batch.set(this.collection.doc(commandId), this.serializeCommand(command));
          created.push(command);

        } catch (error) {
          failed.push({
            request,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Execute batch
      await batch.commit();

      console.log(`✅ MedicationCommandService: Batch created ${created.length} commands, ${failed.length} failed`);

      return {
        success: true,
        data: { created, failed }
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error creating batch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create command batch'
      };
    }
  }

  // ===== HEALTH CHECK AND DIAGNOSTICS =====

  /**
   * Perform health check on command data
   */
  async performHealthCheck(patientId?: string): Promise<{
    success: boolean;
    data?: {
      totalCommands: number;
      validCommands: number;
      invalidCommands: number;
      issues: Array<{
        commandId: string;
        medicationName: string;
        issueType: string;
        description: string;
        severity: 'error' | 'warning' | 'info';
      }>;
      recommendations: string[];
    };
    error?: string;
  }> {
    try {
      console.log('🏥 MedicationCommandService: Performing health check', { patientId });

      const queryOptions: MedicationCommandQueryOptions = patientId ? { patientId } : {};
      const result = await this.queryCommands(queryOptions);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: 'Failed to fetch commands for health check'
        };
      }

      const commands = result.data;
      const issues: any[] = [];
      let validCommands = 0;
      let invalidCommands = 0;

      // Validate each command
      for (const command of commands) {
        const validation = this.validateCommand(command);
        
        if (validation.isValid) {
          validCommands++;
        } else {
          invalidCommands++;
          
          validation.errors.forEach(error => {
            issues.push({
              commandId: command.id,
              medicationName: command.medication.name,
              issueType: 'validation_error',
              description: error,
              severity: 'error' as const
            });
          });
        }

        // Check for warnings
        validation.warnings.forEach(warning => {
          issues.push({
            commandId: command.id,
            medicationName: command.medication.name,
            issueType: 'validation_warning',
            description: warning,
            severity: 'warning' as const
          });
        });

        // Check for data integrity issues
        if (!command.metadata.checksum) {
          issues.push({
            commandId: command.id,
            medicationName: command.medication.name,
            issueType: 'missing_checksum',
            description: 'Command missing data integrity checksum',
            severity: 'warning' as const
          });
        }
      }

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (invalidCommands > 0) {
        recommendations.push(`Fix ${invalidCommands} command(s) with validation errors`);
      }
      
      const errorIssues = issues.filter(i => i.severity === 'error');
      if (errorIssues.length > 0) {
        recommendations.push('Review and resolve critical validation errors');
      }
      
      const warningIssues = issues.filter(i => i.severity === 'warning');
      if (warningIssues.length > 0) {
        recommendations.push('Address validation warnings to improve data quality');
      }

      const healthData = {
        totalCommands: commands.length,
        validCommands,
        invalidCommands,
        issues,
        recommendations
      };

      console.log('🏥 Health check complete:', healthData);

      return {
        success: true,
        data: healthData
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error in health check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform health check'
      };
    }
  }

  /**
   * Generate default times for a frequency when no times are provided
   */
  private generateDefaultTimes(frequency: string): string[] {
    switch (frequency) {
      case 'daily':
        return ['08:00'];
      case 'twice_daily':
        return ['08:00', '20:00'];
      case 'three_times_daily':
        return ['08:00', '14:00', '20:00'];
      case 'four_times_daily':
        return ['08:00', '12:00', '17:00', '22:00'];
      case 'weekly':
      case 'monthly':
        return ['08:00'];
      case 'as_needed':
        return [];
      default:
        return ['08:00'];
    }
  }

  // ===== READ OPERATIONS =====

  /**
   * Get a specific medication command by ID
   */
  async getCommand(commandId: string): Promise<{
    success: boolean;
    data?: MedicationCommand;
    error?: string;
  }> {
    try {
      const doc = await this.collection.doc(commandId).get();

      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication command not found'
        };
      }

      const data = doc.data()!;
      const command = this.deserializeCommand(commandId, data);

      return {
        success: true,
        data: command
      };
    } catch (error) {
      console.error('❌ MedicationCommandService: Error getting command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get medication command'
      };
    }
  }

  /**
   * Query medication commands with filtering
   */
  async queryCommands(options: MedicationCommandQueryOptions): Promise<{
    success: boolean;
    data?: MedicationCommand[];
    total?: number;
    error?: string;
  }> {
    try {
      let query: admin.firestore.Query = this.collection;

      // Apply filters
      if (options.patientId) {
        query = query.where('patientId', '==', options.patientId);
      }

      if (options.status) {
        query = query.where('status.current', '==', options.status);
      }

      if (options.medicationName) {
        query = query.where('medication.name', '==', options.medicationName);
      }

      if (options.frequency) {
        query = query.where('schedule.frequency', '==', options.frequency);
      }

      if (options.isActive !== undefined) {
        query = query.where('status.isActive', '==', options.isActive);
      }

      if (options.isPRN !== undefined) {
        query = query.where('status.isPRN', '==', options.isPRN);
      }

      // Apply ordering
      // Note: Firestore requires indexes for nested field ordering
      // For 'name' (which is at medication.name), we'll sort in memory after fetching
      // Use metadata.createdAt as default since it's at root level and indexed
      const orderBy = options.orderBy || 'createdAt';
      const orderDirection = options.orderDirection === 'desc' ? 'desc' : 'asc';
      
      // Map orderBy field to actual Firestore field path
      let firestoreOrderBy: string | null;
      let needsInMemorySort = false;
      
      if (orderBy === 'name') {
        // Medication name is nested, sort in memory
        // CRITICAL: Don't add orderBy to Firestore query to avoid index requirements
        // When you have multiple where clauses (patientId + status.isActive),
        // Firestore requires a composite index for orderBy
        // By skipping orderBy, we fetch all matching docs and sort in memory
        needsInMemorySort = true;
        firestoreOrderBy = null; // Don't add orderBy to query
      } else if (orderBy === 'createdAt') {
        firestoreOrderBy = 'metadata.createdAt';
      } else if (orderBy === 'updatedAt') {
        firestoreOrderBy = 'metadata.updatedAt';
      } else {
        // Default to createdAt if unknown field
        firestoreOrderBy = 'metadata.createdAt';
      }

      // Count where clauses - multiple where clauses + orderBy requires composite index
      const whereClauseCount = [
        options.patientId,
        options.status,
        options.medicationName,
        options.frequency,
        options.isActive !== undefined,
        options.isPRN !== undefined
      ].filter(Boolean).length;
      
      const hasMultipleFilters = whereClauseCount > 1;
      
      // CRITICAL FIX: When we have multiple where clauses, skip Firestore orderBy
      // to avoid composite index requirement. Sort in memory instead.
      if (hasMultipleFilters && firestoreOrderBy && !needsInMemorySort) {
        needsInMemorySort = true;
        firestoreOrderBy = null; // Don't add to Firestore query
      }

      // Only add orderBy to query if we're not doing in-memory sort
      // This avoids Firestore index requirements when sorting by nested fields
      if (!needsInMemorySort && firestoreOrderBy) {
        query = query.orderBy(firestoreOrderBy, orderDirection);
      }

      // Apply limit (before in-memory sort for 'name')
      const limit = options.limit;
      if (limit && !needsInMemorySort) {
        query = query.limit(limit);
      } else if (limit) {
        // For in-memory sort, fetch more than needed then limit after sorting
        query = query.limit(limit * 2); // Fetch extra to account for sorting
      }

      const snapshot = await query.get();
      let commands = snapshot.docs.map(doc =>
        this.deserializeCommand(doc.id, doc.data())
      );

      // Apply in-memory sorting if needed
      // Case 1: Ordering by nested field 'name'
      // Case 2: Multiple filters require skipping Firestore orderBy to avoid composite index
      if (needsInMemorySort) {
        if (orderBy === 'name') {
          // Sort by medication name
          commands.sort((a, b) => {
            const aValue = a.medication.name.toLowerCase();
            const bValue = b.medication.name.toLowerCase();
            const comparison = aValue.localeCompare(bValue);
            return orderDirection === 'desc' ? -comparison : comparison;
          });
        } else {
          // Sort by the requested field (createdAt/updatedAt) to avoid index requirement措
          commands.sort((a, b) => {
            let aValue: number;
            let bValue: number;
            
            if (orderBy === 'createdAt' || !orderBy) {
              aValue = a.metadata.createdAt.getTime();
              bValue = b.metadata.createdAt.getTime();
            } else if (orderBy === 'updatedAt') {
              aValue = a.metadata.updatedAt.getTime();
              bValue = b.metadata.updatedAt.getTime();
            } else {
              // Default comparison
              aValue = a.metadata.createdAt.getTime();
              bValue = b.metadata.createdAt.getTime();
            }
            
            const comparison = aValue - bValue;
            return orderDirection === 'desc' ? -comparison : comparison;
          });
        }
        
        // Apply limit after sorting
        if (limit) {
          commands = commands.slice(0, limit);
        }
      }

      return {
        success: true,
        data: commands,
        total: commands.length // Use actual length after sorting/limiting
      };
    } catch (error) {
      console.error('❌ MedicationCommandService: Error querying commands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query medication commands'
      };
    }
  }

  // ===== UPDATE OPERATIONS =====

  /**
   * Update a medication command
   */
  async updateCommand(request: UpdateMedicationCommandRequest): Promise<{
    success: boolean;
    data?: MedicationCommand;
    validation?: MedicationCommandValidation;
    error?: string;
  }> {
    try {
      console.log('📝 MedicationCommandService: Updating command:', request.commandId);

      // Get current command
      const currentResult = await this.getCommand(request.commandId);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Medication command not found'
        };
      }

      const currentCommand = currentResult.data;

      // Merge updates
      const updatedCommand: MedicationCommand = {
        ...currentCommand,
        ...request.updates,
        metadata: {
          ...currentCommand.metadata,
          updatedAt: new Date(),
          updatedBy: request.updatedBy
        }
      };

      // Validate updated command
      const validation = validateMedicationCommand(updatedCommand);
      if (!validation.isValid) {
        return {
          success: false,
          validation,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Save updated command
      await this.collection.doc(request.commandId).set(
        this.serializeCommand(updatedCommand),
        { merge: true }
      );

      console.log('✅ MedicationCommandService: Command updated successfully:', request.commandId);

      return {
        success: true,
        data: updatedCommand,
        validation
      };
    } catch (error) {
      console.error('❌ MedicationCommandService: Error updating command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update medication command'
      };
    }
  }

  // ===== DELETE OPERATIONS =====

  /**
   * Delete a medication command
   */
  async deleteCommand(commandId: string, deletedBy: string, reason?: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('🗑️ MedicationCommandService: Deleting command:', commandId);

      // Check if command exists
      const currentResult = await this.getCommand(commandId);
      if (!currentResult.success) {
        return {
          success: false,
          error: 'Medication command not found'
        };
      }

      // Delete the command
      await this.collection.doc(commandId).delete();

      console.log('✅ MedicationCommandService: Command deleted successfully:', commandId);

      return {
        success: true
      };
    } catch (error) {
      console.error('❌ MedicationCommandService: Error deleting command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete medication command'
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Classify medication type for grace period calculation
   */
  private classifyMedicationType(name: string, frequency: string): 'critical' | 'standard' | 'vitamin' | 'prn' {
    const nameLower = name.toLowerCase();

    if (frequency === 'as_needed') return 'prn';

    const criticalMeds = ['insulin', 'warfarin', 'digoxin', 'levothyroxine', 'phenytoin'];
    if (criticalMeds.some(med => nameLower.includes(med))) return 'critical';

    const vitaminMeds = ['vitamin', 'multivitamin', 'calcium', 'iron', 'supplement'];
    if (vitaminMeds.some(med => nameLower.includes(med))) return 'vitamin';

    return 'standard';
  }

  /**
   * Determine time slot from time string
   */
  private determineTimeSlot(time: string): 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom' {
    const hour = parseInt(time.split(':')[0]);
    if (isNaN(hour)) return 'custom';

    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 || hour < 6) return 'beforeBed';

    return 'custom';
  }

  /**
   * Calculate checksum for command integrity
   */
  private calculateChecksum(commandId: string, medicationName: string, frequency: string): string {
    const data = `${commandId}_${medicationName}_${frequency}_${Date.now()}`;
    return Buffer.from(data).toString('base64').slice(0, 16);
  }

  /**
   * Check for duplicate medications
   */
  private async checkForDuplicates(patientId: string, medicationName: string): Promise<{
    hasDuplicates: boolean;
    duplicates: MedicationCommand[];
  }> {
    try {
      const result = await this.queryCommands({
        patientId,
        medicationName,
        isActive: true,
        limit: 10
      });

      return {
        hasDuplicates: (result.data?.length || 0) > 0,
        duplicates: result.data || []
      };
    } catch (error) {
      console.warn('⚠️ Error checking for duplicates:', error);
      return {
        hasDuplicates: false,
        duplicates: []
      };
    }
  }

  /**
   * Get active commands for a patient
   */
  async getActiveCommands(patientId: string): Promise<{
    success: boolean;
    data?: MedicationCommand[];
    error?: string;
  }> {
    return this.queryCommands({
      patientId,
      isActive: true
    });
  }

  /**
   * Validate a medication command
   */
  private validateCommand(command: MedicationCommand): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!command.medication?.name) {
      errors.push('Medication name is required');
    }

    if (!command.schedule?.frequency) {
      errors.push('Schedule frequency is required');
    }

    if (!command.schedule?.times || command.schedule.times.length === 0) {
      errors.push('Schedule times are required');
    }

    if (!command.patientId) {
      errors.push('Patient ID is required');
    }

    // Validate time formats
    if (command.schedule?.times) {
      for (const time of command.schedule.times) {
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          errors.push(`Invalid time format: ${time}. Expected HH:MM format.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get command statistics
   */
  async getCommandStats(patientId?: string): Promise<{
    success: boolean;
    data?: {
      total: number;
      active: number;
      paused: number;
      discontinued: number;
      prnMedications: number;
      withReminders: number;
      byFrequency: Record<string, number>;
      byMedicationType: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const result = await this.queryCommands({
        patientId,
        limit: 1000 // Get all for stats
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error
        };
      }

      const commands = result.data;
      const stats = {
        total: commands.length,
        active: commands.filter(c => c.status.current === 'active').length,
        paused: commands.filter(c => c.status.current === 'paused').length,
        discontinued: commands.filter(c => c.status.current === 'discontinued').length,
        prnMedications: commands.filter(c => c.status.isPRN).length,
        withReminders: commands.filter(c => c.reminders.enabled).length,
        byFrequency: {} as Record<string, number>,
        byMedicationType: {} as Record<string, number>
      };

      // Calculate frequency and type distributions
      for (const command of commands) {
        const freq = command.schedule.frequency;
        stats.byFrequency[freq] = (stats.byFrequency[freq] || 0) + 1;

        const type = this.classifyMedicationType(command.medication.name, freq);
        stats.byMedicationType[type] = (stats.byMedicationType[type] || 0) + 1;
      }

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('❌ MedicationCommandService: Error getting command stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get command statistics'
      };
    }
  }
}