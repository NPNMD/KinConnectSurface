"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationCommandService = void 0;
const admin = __importStar(require("firebase-admin"));
const unifiedMedicationSchema_1 = require("../../schemas/unifiedMedicationSchema");
const TimeBucketService_1 = require("./TimeBucketService");
class MedicationCommandService {
    firestore;
    collection;
    timeBucketService;
    constructor() {
        this.firestore = admin.firestore();
        this.collection = this.firestore.collection('medication_commands');
        this.timeBucketService = new TimeBucketService_1.TimeBucketService();
    }
    // ===== CREATE OPERATIONS =====
    /**
     * Create a new medication command
     */
    async createCommand(request) {
        try {
            console.log('📝 MedicationCommandService: Creating new command for patient:', request.patientId);
            // Generate command ID
            const commandId = (0, unifiedMedicationSchema_1.generateCommandId)(request.patientId, request.medicationData.name);
            // Determine medication type for grace period
            const medicationType = this.classifyMedicationType(request.medicationData.name, request.scheduleData.frequency);
            // Compute schedule times using patient preferences if requested
            let computedTimes = request.scheduleData.times || [];
            let flexibleScheduling;
            if (request.scheduleData.usePatientTimePreferences &&
                ['daily', 'twice_daily', 'three_times_daily', 'four_times_daily'].includes(request.scheduleData.frequency)) {
                const scheduleResult = await this.timeBucketService.computeMedicationSchedule({
                    frequency: request.scheduleData.frequency,
                    patientId: request.patientId,
                    medicationName: request.medicationData.name,
                    customOverrides: request.scheduleData.timeBucketOverrides,
                    flexibleScheduling: request.scheduleData.flexibleScheduling
                });
                if (scheduleResult.success && scheduleResult.data) {
                    computedTimes = scheduleResult.data.times;
                    flexibleScheduling = request.scheduleData.flexibleScheduling;
                    console.log('✅ Computed times from patient preferences:', computedTimes);
                }
                else {
                    console.warn('⚠️ Failed to compute times from preferences, using defaults');
                    computedTimes = this.generateDefaultTimes(request.scheduleData.frequency);
                }
            }
            else if (computedTimes.length === 0) {
                // Generate default times if none provided
                computedTimes = this.generateDefaultTimes(request.scheduleData.frequency);
            }
            // Build complete command object
            const command = {
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
                    enabled: request.reminderData?.enabled ?? unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.enabled,
                    minutesBefore: request.reminderData?.minutesBefore ?? unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.minutesBefore,
                    notificationMethods: request.reminderData?.notificationMethods ?? unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.notificationMethods,
                    quietHours: unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.quietHours
                },
                gracePeriod: {
                    defaultMinutes: unifiedMedicationSchema_1.DEFAULT_GRACE_PERIODS[medicationType],
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
            const validation = (0, unifiedMedicationSchema_1.validateMedicationCommand)(command);
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
        }
        catch (error) {
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
    async getCommand(commandId) {
        try {
            const doc = await this.collection.doc(commandId).get();
            if (!doc.exists) {
                return {
                    success: false,
                    error: 'Medication command not found'
                };
            }
            const command = this.deserializeCommand(doc.id, doc.data());
            return {
                success: true,
                data: command
            };
        }
        catch (error) {
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
    async queryCommands(options) {
        try {
            console.log('🔍 MedicationCommandService: Querying commands with options:', options);
            let query = this.collection;
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
                filteredCommands = commands.filter(cmd => cmd.medication.name.toLowerCase().includes(searchTerm) ||
                    cmd.medication.genericName?.toLowerCase().includes(searchTerm) ||
                    cmd.medication.brandName?.toLowerCase().includes(searchTerm));
            }
            console.log(`✅ MedicationCommandService: Found ${filteredCommands.length} commands`);
            return {
                success: true,
                data: filteredCommands,
                total: filteredCommands.length
            };
        }
        catch (error) {
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
    async getActiveCommands(patientId) {
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
    async getCommandsNeedingReminders(patientId) {
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
    async updateCommand(request) {
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
            const updatedCommand = {
                ...currentCommand,
                ...request.updates,
                metadata: {
                    ...currentCommand.metadata,
                    version: currentCommand.metadata.version + 1,
                    updatedAt: new Date(),
                    updatedBy: request.updatedBy,
                    checksum: this.calculateChecksum(request.commandId, request.updates.medication?.name || currentCommand.medication.name, request.updates.schedule?.frequency || currentCommand.schedule.frequency)
                }
            };
            // Validate updated command
            const validation = (0, unifiedMedicationSchema_1.validateMedicationCommand)(updatedCommand);
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
        }
        catch (error) {
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
    async updateCommandStatus(commandId, newStatus, reason, updatedBy, additionalData) {
        try {
            console.log('📝 MedicationCommandService: Updating status for command:', commandId, 'to:', newStatus);
            const updates = {
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
                updates.status.pausedUntil = additionalData.pausedUntil;
            }
            if (newStatus === 'held' && additionalData?.holdReason) {
                updates.status.holdReason = additionalData.holdReason;
            }
            if (newStatus === 'discontinued') {
                updates.status.discontinueReason = reason;
                updates.status.discontinueDate = additionalData?.discontinueDate || new Date();
            }
            return this.updateCommand({
                commandId,
                updates,
                updatedBy,
                reason
            });
        }
        catch (error) {
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
    async deleteCommand(commandId, deletedBy, reason) {
        try {
            console.log('🗑️ MedicationCommandService: Soft deleting command:', commandId);
            const result = await this.updateCommandStatus(commandId, 'discontinued', reason, deletedBy, { discontinueDate: new Date() });
            if (result.success) {
                console.log('✅ MedicationCommandService: Command soft deleted successfully:', commandId);
            }
            return {
                success: result.success,
                error: result.error
            };
        }
        catch (error) {
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
    async hardDeleteCommand(commandId) {
        try {
            console.log('🗑️ MedicationCommandService: Hard deleting command:', commandId);
            await this.collection.doc(commandId).delete();
            console.log('✅ MedicationCommandService: Command hard deleted successfully:', commandId);
            return {
                success: true
            };
        }
        catch (error) {
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
    validateCommand(command) {
        return (0, unifiedMedicationSchema_1.validateMedicationCommand)(command);
    }
    /**
     * Check for duplicate medications
     */
    async checkForDuplicates(patientId, medicationName) {
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
        }
        catch (error) {
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
    async getCommandStats(patientId) {
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
                byFrequency: {},
                byMedicationType: {}
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
        }
        catch (error) {
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
    classifyMedicationType(medicationName, frequency) {
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
    determineTimeSlot(time) {
        const hour = parseInt(time.split(':')[0]);
        if (hour >= 6 && hour < 11)
            return 'morning';
        if (hour >= 11 && hour < 15)
            return 'lunch'; // Updated from 'noon'
        if (hour >= 17 && hour < 21)
            return 'evening';
        if (hour >= 21 || hour < 6)
            return 'beforeBed'; // Updated from 'bedtime'
        return 'custom';
    }
    /**
     * Generate default times for a frequency
     */
    generateDefaultTimes(frequency) {
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
    calculateChecksum(commandId, medicationName, frequency) {
        const data = `${commandId}_${medicationName}_${frequency}_${Date.now()}`;
        return Buffer.from(data).toString('base64').slice(0, 16);
    }
    /**
     * Serialize command for Firestore storage
     */
    serializeCommand(command) {
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
    deserializeCommand(id, data) {
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
    async createCommandsBatch(requests) {
        try {
            console.log('📝 MedicationCommandService: Creating batch of', requests.length, 'commands');
            const batch = this.firestore.batch();
            const created = [];
            const failed = [];
            for (const request of requests) {
                try {
                    const commandId = (0, unifiedMedicationSchema_1.generateCommandId)(request.patientId, request.medicationData.name);
                    const medicationType = this.classifyMedicationType(request.medicationData.name, request.scheduleData.frequency);
                    const command = {
                        id: commandId,
                        patientId: request.patientId,
                        medication: { ...request.medicationData },
                        schedule: {
                            ...request.scheduleData,
                            times: request.scheduleData.times || this.generateDefaultTimes(request.scheduleData.frequency),
                            timingType: 'absolute'
                        },
                        reminders: {
                            enabled: request.reminderData?.enabled ?? unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.enabled,
                            minutesBefore: request.reminderData?.minutesBefore ?? unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.minutesBefore,
                            notificationMethods: request.reminderData?.notificationMethods ?? unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.notificationMethods,
                            quietHours: unifiedMedicationSchema_1.DEFAULT_REMINDER_SETTINGS.quietHours
                        },
                        gracePeriod: {
                            defaultMinutes: unifiedMedicationSchema_1.DEFAULT_GRACE_PERIODS[medicationType],
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
                    const validation = (0, unifiedMedicationSchema_1.validateMedicationCommand)(command);
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
                }
                catch (error) {
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
        }
        catch (error) {
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
    async performHealthCheck(patientId) {
        try {
            console.log('🏥 MedicationCommandService: Performing health check', { patientId });
            const queryOptions = patientId ? { patientId } : {};
            const result = await this.queryCommands(queryOptions);
            if (!result.success || !result.data) {
                return {
                    success: false,
                    error: 'Failed to fetch commands for health check'
                };
            }
            const commands = result.data;
            const issues = [];
            let validCommands = 0;
            let invalidCommands = 0;
            // Validate each command
            for (const command of commands) {
                const validation = this.validateCommand(command);
                if (validation.isValid) {
                    validCommands++;
                }
                else {
                    invalidCommands++;
                    validation.errors.forEach(error => {
                        issues.push({
                            commandId: command.id,
                            medicationName: command.medication.name,
                            issueType: 'validation_error',
                            description: error,
                            severity: 'error'
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
                        severity: 'warning'
                    });
                });
                // Check for data integrity issues
                if (!command.metadata.checksum) {
                    issues.push({
                        commandId: command.id,
                        medicationName: command.medication.name,
                        issueType: 'missing_checksum',
                        description: 'Command missing data integrity checksum',
                        severity: 'warning'
                    });
                }
            }
            // Generate recommendations
            const recommendations = [];
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
        }
        catch (error) {
            console.error('❌ MedicationCommandService: Error in health check:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to perform health check'
            };
        }
    }
}
exports.MedicationCommandService = MedicationCommandService;
