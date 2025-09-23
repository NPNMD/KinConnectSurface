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
        } else {
          console.warn('⚠️ Failed to compute times from preferences, using defaults');
          computedTimes = this.generateDefaultTimes(request.scheduleData.frequency);
        }
      } else if (computedTimes.length === 0) {
        // Generate default times if none provided
        computedTimes = this.generateDefaultTimes(request.scheduleData.frequency);
      }

      // Build complete command object
      const command: MedicationCommand = {
        id: commandId,
        patientId: request.patientId,
        
        medication: {
          ...request.medicationData
        },
        
        schedule: {
          ...request.scheduleData,
          times: computedTimes,
          flexibleScheduling,
          timingType: request.scheduleData.usePatientTimePreferences ? 'time_buckets' : 'absolute',
          timeBucketOverrides: request.scheduleData.timeBucketOverrides,
          computedSchedule: request.scheduleData.usePatientTimePreferences ? {
            lastComputedAt: new Date(),
            computedBy: request.createdBy,
            basedOnPreferencesVersion: 1, // Would get from patient preferences
            nextRecomputeAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Recompute daily
          } : undefined
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

  // ===== READ OPERATIONS =====

  /**
   * Get a medication command by ID
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

      const command = this.deserializeCommand(doc.id, doc.data()!);
      
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
   * Query medication commands with filters
   */
  async queryCommands(options: MedicationCommandQueryOptions): Promise<{
    success: boolean;
    data?: MedicationCommand[];
    error?: string;
    total?: number;
  }> {
    try {
      console.log('🔍 MedicationCommandService: Querying commands with options:', options);

      let query: admin.firestore.Query = this.collection;

      // Apply filters
      if (options.patientId) {
        query = query.where('patientId', '==', options.patientId);
      }

      if (options.status) {
        query = query.where('status.current', '==', options.status);
      }

      if (options.isActive !== undefined) {
        query = query.where('status.isActive', '==', options.isActive);
      }

      if (options.isPRN !== undefined) {
        query = query.where('status.isPRN', '==', options.isPRN);
      }

      if (options.frequency) {
        query = query.where('schedule.frequency', '==', options.frequency);
      }

      // Apply ordering
      const orderField = options.orderBy === 'name' ? 'medication.name' : 
                        options.orderBy === 'createdAt' ? 'metadata.createdAt' : 
                        'metadata.updatedAt';
      const orderDirection = options.orderDirection === 'desc' ? 'desc' : 'asc';
      
      query = query.orderBy(orderField, orderDirection);

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      const commands = snapshot.docs.map(doc => this.deserializeCommand(doc.id, doc.data()));

      // Apply client-side filters that can't be done in Firestore
      let filteredCommands = commands;
      
      if (options.medicationName) {
        const searchTerm = options.medicationName.toLowerCase();
        filteredCommands = commands.filter(cmd => 
          cmd.medication.name.toLowerCase().includes(searchTerm) ||
          cmd.medication.genericName?.toLowerCase().includes(searchTerm) ||
          cmd.medication.brandName?.toLowerCase().includes(searchTerm)
        );
      }

      console.log(`✅ MedicationCommandService: Found ${filteredCommands.length} commands`);

      return {
        success: true,
        data: filteredCommands,
        total: filteredCommands.length
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error querying commands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query medication commands'
      };
    }
  }

  /**
   * Get active medication commands for a patient
   */
  async getActiveCommands(patientId: string): Promise<{
    success: boolean;
    data?: MedicationCommand[];
    error?: string;
  }> {
    return this.queryCommands({
      patientId,
      isActive: true,
      orderBy: 'name',
      orderDirection: 'asc'
    });
  }

  /**
   * Get commands that need reminders (active, non-PRN medications)
   */
  async getCommandsNeedingReminders(patientId: string): Promise<{
    success: boolean;
    data?: MedicationCommand[];
    error?: string;
  }> {
    return this.queryCommands({
      patientId,
      isActive: true,
      isPRN: false,
      orderBy: 'updatedAt',
      orderDirection: 'desc'
    });
  }

  // ===== UPDATE OPERATIONS =====

  /**
   * Update a medication command
   */
  async updateCommand(request: UpdateMedicationCommandRequest): Promise<{
    success: boolean;
    data?: MedicationCommand;
    error?: string;
    validation?: MedicationCommandValidation;
  }> {
    try {
      console.log('📝 MedicationCommandService: Updating command:', request.commandId);

      // Get current command
      const currentResult = await this.getCommand(request.commandId);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Command not found'
        };
      }

      const currentCommand = currentResult.data;

      // Merge updates with current data
      const updatedCommand: MedicationCommand = {
        ...currentCommand,
        ...request.updates,
        metadata: {
          ...currentCommand.metadata,
          version: currentCommand.metadata.version + 1,
          updatedAt: new Date(),
          updatedBy: request.updatedBy,
          checksum: this.calculateChecksum(
            request.commandId,
            request.updates.medication?.name || currentCommand.medication.name,
            request.updates.schedule?.frequency || currentCommand.schedule.frequency
          )
        }
      };

      // Validate updated command
      const validation = validateMedicationCommand(updatedCommand);
      if (!validation.isValid) {
        console.error('❌ Updated command validation failed:', validation.errors);
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          validation
        };
      }

      // Save updated command
      await this.collection.doc(request.commandId).set(this.serializeCommand(updatedCommand));

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

  /**
   * Update command status (pause, resume, hold, discontinue)
   */
  async updateCommandStatus(
    commandId: string,
    newStatus: 'active' | 'paused' | 'held' | 'discontinued' | 'completed',
    reason: string,
    updatedBy: string,
    additionalData?: {
      pausedUntil?: Date;
      holdReason?: string;
      discontinueDate?: Date;
    }
  ): Promise<{
    success: boolean;
    data?: MedicationCommand;
    error?: string;
  }> {
    try {
      console.log('📝 MedicationCommandService: Updating status for command:', commandId, 'to:', newStatus);

      const updates: Partial<MedicationCommand> = {
        status: {
          current: newStatus,
          isActive: newStatus === 'active',
          isPRN: false, // Will be preserved from current data
          lastStatusChange: new Date(),
          statusChangedBy: updatedBy
        }
      };

      // Add status-specific data
      if (newStatus === 'paused' && additionalData?.pausedUntil) {
        updates.status!.pausedUntil = additionalData.pausedUntil;
      }

      if (newStatus === 'held' && additionalData?.holdReason) {
        updates.status!.holdReason = additionalData.holdReason;
      }

      if (newStatus === 'discontinued') {
        updates.status!.discontinueReason = reason;
        updates.status!.discontinueDate = additionalData?.discontinueDate || new Date();
      }

      return this.updateCommand({
        commandId,
        updates,
        updatedBy,
        reason
      });

    } catch (error) {
      console.error('❌ MedicationCommandService: Error updating command status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update command status'
      };
    }
  }

  // ===== DELETE OPERATIONS =====

  /**
   * Soft delete a medication command (mark as discontinued)
   */
  async deleteCommand(commandId: string, deletedBy: string, reason: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('🗑️ MedicationCommandService: Soft deleting command:', commandId);

      const result = await this.updateCommandStatus(
        commandId,
        'discontinued',
        reason,
        deletedBy,
        { discontinueDate: new Date() }
      );

      if (result.success) {
        console.log('✅ MedicationCommandService: Command soft deleted successfully:', commandId);
      }

      return {
        success: result.success,
        error: result.error
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error deleting command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete medication command'
      };
    }
  }

  /**
   * Hard delete a medication command (permanent removal)
   * Only use for data cleanup or migration scenarios
   */
  async hardDeleteCommand(commandId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('🗑️ MedicationCommandService: Hard deleting command:', commandId);

      await this.collection.doc(commandId).delete();

      console.log('✅ MedicationCommandService: Command hard deleted successfully:', commandId);

      return {
        success: true
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error hard deleting command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to hard delete medication command'
      };
    }
  }

  // ===== VALIDATION AND UTILITY METHODS =====

  /**
   * Validate command data integrity
   */
  validateCommand(command: Partial<MedicationCommand>): MedicationCommandValidation {
    return validateMedicationCommand(command);
  }

  /**
   * Check for duplicate medications
   */
  async checkForDuplicates(patientId: string, medicationName: string): Promise<{
    hasDuplicates: boolean;
    duplicates: MedicationCommand[];
  }> {
    try {
      const result = await this.queryCommands({
        patientId,
        isActive: true,
        medicationName: medicationName.toLowerCase()
      });

      const duplicates = result.data || [];
      
      return {
        hasDuplicates: duplicates.length > 0,
        duplicates
      };

    } catch (error) {
      console.error('❌ Error checking for duplicates:', error);
      return {
        hasDuplicates: false,
        duplicates: []
      };
    }
  }

  /**
   * Get command statistics for a patient
   */
  async getCommandStats(patientId: string): Promise<{
    success: boolean;
    data?: {
      total: number;
      active: number;
      paused: number;
      discontinued: number;
      withReminders: number;
      prnMedications: number;
      byFrequency: Record<string, number>;
      byMedicationType: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const result = await this.queryCommands({ patientId });
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: 'Failed to fetch commands for statistics'
        };
      }

      const commands = result.data;
      const stats = {
        total: commands.length,
        active: commands.filter(c => c.status.isActive).length,
        paused: commands.filter(c => c.status.current === 'paused').length,
        discontinued: commands.filter(c => c.status.current === 'discontinued').length,
        withReminders: commands.filter(c => c.reminders.enabled).length,
        prnMedications: commands.filter(c => c.status.isPRN).length,
        byFrequency: {} as Record<string, number>,
        byMedicationType: {} as Record<string, number>
      };

      // Calculate frequency distribution
      commands.forEach(cmd => {
        const freq = cmd.schedule.frequency;
        stats.byFrequency[freq] = (stats.byFrequency[freq] || 0) + 1;
      });

      // Calculate medication type distribution
      commands.forEach(cmd => {
        const type = cmd.gracePeriod.medicationType;
        stats.byMedicationType[type] = (stats.byMedicationType[type] || 0) + 1;
      });

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('❌ MedicationCommandService: Error getting stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get command statistics'
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Classify medication type for grace period calculation
   */
  private classifyMedicationType(medicationName: string, frequency: string): 'critical' | 'standard' | 'vitamin' | 'prn' {
    const name = medicationName.toLowerCase();
    
    // PRN medications
    if (frequency === 'as_needed') {
      return 'prn';
    }
    
    // Critical medications (time-sensitive)
    const criticalMeds = [
      'insulin', 'warfarin', 'digoxin', 'levothyroxine', 'phenytoin',
      'lithium', 'tacrolimus', 'cyclosporine', 'methotrexate'
    ];
    
    if (criticalMeds.some(med => name.includes(med))) {
      return 'critical';
    }
    
    // Vitamins and supplements
    const vitaminMeds = [
      'vitamin', 'multivitamin', 'calcium', 'iron', 'magnesium',
      'zinc', 'fish oil', 'omega', 'supplement', 'probiotic'
    ];
    
    if (vitaminMeds.some(med => name.includes(med))) {
      return 'vitamin';
    }
    
    // Default to standard
    return 'standard';
  }

  /**
   * Determine time slot based on time
   */
  private determineTimeSlot(time: string): 'morning' | 'lunch' | 'evening' | 'beforeBed' | 'custom' {
    const hour = parseInt(time.split(':')[0]);
    
    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'lunch'; // Updated from 'noon'
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 || hour < 6) return 'beforeBed'; // Updated from 'bedtime'
    
    return 'custom';
  }
  /**
   * Generate default times for a frequency
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


  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(commandId: string, medicationName: string, frequency: string): string {
    const data = `${commandId}_${medicationName}_${frequency}_${Date.now()}`;
    return Buffer.from(data).toString('base64').slice(0, 16);
  }

  /**
   * Serialize command for Firestore storage
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
        endDate: data.schedule.endDate?.toDate?.() || null
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
}