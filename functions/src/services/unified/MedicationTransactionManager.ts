/**
 * MedicationTransactionManager
 * 
 * Single Responsibility: ONLY ensures ACID compliance
 * 
 * This service is responsible for:
 * - Managing Firestore transactions
 * - Ensuring atomicity of multi-collection operations
 * - Handling rollback scenarios
 * - Maintaining data consistency
 * - Coordinating distributed operations
 * 
 * This service does NOT:
 * - Modify command state directly (delegates to MedicationCommandService)
 * - Create events directly (delegates to MedicationEventService)
 * - Send notifications (delegates to MedicationNotificationService)
 * - Implement business logic (delegates to MedicationOrchestrator)
 */

import * as admin from 'firebase-admin';
import {
  MedicationCommand,
  MedicationEvent,
  MedicationEventType,
  MEDICATION_EVENT_TYPES,
  generateCorrelationId
} from '../../schemas/unifiedMedicationSchema';

export interface TransactionOperation {
  type: 'create_command' | 'update_command' | 'delete_command' | 'create_event' | 'update_family_access';
  collection: string;
  documentId: string;
  data: any;
  operation: 'set' | 'update' | 'delete';
  mergeOptions?: { merge: boolean };
}

export interface TransactionRequest {
  operations: TransactionOperation[];
  correlationId?: string;
  description: string;
  initiatedBy: string;
  rollbackStrategy?: 'automatic' | 'manual' | 'none';
  timeoutSeconds?: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  correlationId: string;
  operationsExecuted: number;
  operationsFailed: number;
  rollbackPerformed: boolean;
  error?: string;
  executionTimeMs: number;
  operationResults?: Array<{
    operation: TransactionOperation;
    success: boolean;
    error?: string;
  }>;
}

export interface RollbackRequest {
  transactionId: string;
  reason: string;
  rollbackBy: string;
}

export class MedicationTransactionManager {
  private firestore: admin.firestore.Firestore;
  private transactionLog: admin.firestore.CollectionReference;
  private rollbackLog: admin.firestore.CollectionReference;

  constructor() {
    this.firestore = admin.firestore();
    this.transactionLog = this.firestore.collection('medication_transaction_log');
    this.rollbackLog = this.firestore.collection('medication_rollback_log');
  }

  // ===== TRANSACTION EXECUTION =====

  /**
   * Execute a medication transaction with ACID guarantees
   */
  async executeTransaction(request: TransactionRequest): Promise<TransactionResult> {
    const startTime = Date.now();
    const transactionId = this.generateTransactionId();
    const correlationId = request.correlationId || generateCorrelationId();

    console.log('🔄 MedicationTransactionManager: Starting transaction:', transactionId, request.description);

    try {
      // Log transaction start
      await this.logTransactionStart(transactionId, request, correlationId);

      // Execute Firestore transaction
      const result = await this.firestore.runTransaction(async (transaction) => {
        console.log('🔄 Inside Firestore transaction:', transactionId);

        const operationResults: Array<{
          operation: TransactionOperation;
          success: boolean;
          error?: string;
        }> = [];

        // Execute each operation within the transaction
        for (const operation of request.operations) {
          try {
            await this.executeOperation(transaction, operation);
            operationResults.push({
              operation,
              success: true
            });
            console.log('✅ Operation executed:', operation.type, operation.documentId);

          } catch (operationError) {
            const errorMessage = operationError instanceof Error ? operationError.message : 'Unknown operation error';
            console.error('❌ Operation failed:', operation.type, operation.documentId, errorMessage);
            
            operationResults.push({
              operation,
              success: false,
              error: errorMessage
            });

            // Fail the entire transaction if any operation fails
            throw new Error(`Operation ${operation.type} failed: ${errorMessage}`);
          }
        }

        return operationResults;
      });

      const executionTime = Date.now() - startTime;

      // Log successful transaction
      const transactionResult: TransactionResult = {
        success: true,
        transactionId,
        correlationId,
        operationsExecuted: request.operations.length,
        operationsFailed: 0,
        rollbackPerformed: false,
        executionTimeMs: executionTime,
        operationResults: result
      };

      await this.logTransactionComplete(transactionId, transactionResult);

      console.log('✅ Transaction completed successfully:', transactionId, `${executionTime}ms`);

      return transactionResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown transaction error';

      console.error('❌ Transaction failed:', transactionId, errorMessage);

      // Log failed transaction
      const transactionResult: TransactionResult = {
        success: false,
        transactionId,
        correlationId,
        operationsExecuted: 0,
        operationsFailed: request.operations.length,
        rollbackPerformed: false,
        error: errorMessage,
        executionTimeMs: executionTime
      };

      await this.logTransactionFailure(transactionId, transactionResult, errorMessage);

      // Attempt automatic rollback if enabled
      if (request.rollbackStrategy === 'automatic') {
        console.log('🔄 Attempting automatic rollback for transaction:', transactionId);
        
        try {
          const rollbackResult = await this.performRollback({
            transactionId,
            reason: `Automatic rollback due to transaction failure: ${errorMessage}`,
            rollbackBy: 'system'
          });

          transactionResult.rollbackPerformed = rollbackResult.success;
          
          if (rollbackResult.success) {
            console.log('✅ Automatic rollback completed for transaction:', transactionId);
          } else {
            console.error('❌ Automatic rollback failed for transaction:', transactionId, rollbackResult.error);
          }

        } catch (rollbackError) {
          console.error('❌ Rollback error:', rollbackError);
        }
      }

      return transactionResult;
    }
  }

  /**
   * Execute a single operation within a transaction
   */
  private async executeOperation(
    transaction: admin.firestore.Transaction,
    operation: TransactionOperation
  ): Promise<void> {
    const docRef = this.firestore.collection(operation.collection).doc(operation.documentId);

    switch (operation.operation) {
      case 'set':
        if (operation.mergeOptions?.merge) {
          transaction.set(docRef, operation.data, { merge: true });
        } else {
          transaction.set(docRef, operation.data);
        }
        break;

      case 'update':
        // Verify document exists before updating
        const doc = await transaction.get(docRef);
        if (!doc.exists) {
          throw new Error(`Document ${operation.documentId} does not exist for update`);
        }
        transaction.update(docRef, operation.data);
        break;

      case 'delete':
        // Verify document exists before deleting
        const deleteDoc = await transaction.get(docRef);
        if (!deleteDoc.exists) {
          throw new Error(`Document ${operation.documentId} does not exist for deletion`);
        }
        transaction.delete(docRef);
        break;

      default:
        throw new Error(`Unsupported operation type: ${operation.operation}`);
    }
  }

  // ===== SPECIALIZED TRANSACTION PATTERNS =====

  /**
   * Execute medication dose transaction (mark as taken + create event)
   */
  async executeDoseTransaction(
    commandId: string,
    eventData: {
      takenAt: Date;
      takenBy: string;
      notes?: string;
      dosageAmount: string;
      scheduledDateTime: Date;
      isOnTime: boolean;
      minutesLate?: number;
    },
    context: {
      medicationName: string;
      calendarEventId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [];

    // Operation 1: Create dose taken event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    operations.push({
      type: 'create_event',
      collection: 'medication_events',
      documentId: eventId,
      operation: 'set',
      data: {
        commandId,
        patientId: eventData.takenBy, // Assuming takenBy is the patient ID
        eventType: MEDICATION_EVENT_TYPES.DOSE_TAKEN,
        eventData: {
          scheduledDateTime: eventData.scheduledDateTime,
          actualDateTime: eventData.takenAt,
          dosageAmount: eventData.dosageAmount,
          takenBy: eventData.takenBy,
          actionNotes: eventData.notes
        },
        context: {
          medicationName: context.medicationName,
          calendarEventId: context.calendarEventId,
          triggerSource: 'user_action',
          userAgent: context.userAgent,
          ipAddress: context.ipAddress
        },
        timing: {
          eventTimestamp: eventData.takenAt,
          scheduledFor: eventData.scheduledDateTime,
          isOnTime: eventData.isOnTime,
          minutesLate: eventData.minutesLate
        },
        metadata: {
          eventVersion: 1,
          createdAt: new Date(),
          createdBy: eventData.takenBy,
          correlationId: generateCorrelationId()
        }
      }
    });

    // Operation 2: Update command metadata with last event reference
    operations.push({
      type: 'update_command',
      collection: 'medication_commands',
      documentId: commandId,
      operation: 'update',
      data: {
        'metadata.lastEventId': eventId,
        'metadata.updatedAt': admin.firestore.Timestamp.fromDate(new Date()),
        'metadata.updatedBy': eventData.takenBy,
        'metadata.version': admin.firestore.FieldValue.increment(1)
      }
    });

    return this.executeTransaction({
      operations,
      description: `Mark medication dose as taken: ${context.medicationName}`,
      initiatedBy: eventData.takenBy,
      rollbackStrategy: 'automatic',
      timeoutSeconds: 30
    });
  }

  /**
   * Execute medication creation transaction (create command + initial events)
   */
  async executeMedicationCreationTransaction(
    commandData: MedicationCommand,
    initialEvents: Array<{
      eventType: MedicationEventType;
      eventData: any;
      context: any;
    }>
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [];

    // Operation 1: Create medication command
    operations.push({
      type: 'create_command',
      collection: 'medication_commands',
      documentId: commandData.id,
      operation: 'set',
      data: this.serializeCommandForTransaction(commandData)
    });

    // Operation 2+: Create initial events
    initialEvents.forEach((eventRequest, index) => {
      const eventId = `evt_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
      
      operations.push({
        type: 'create_event',
        collection: 'medication_events',
        documentId: eventId,
        operation: 'set',
        data: {
          commandId: commandData.id,
          patientId: commandData.patientId,
          eventType: eventRequest.eventType,
          eventData: eventRequest.eventData,
          context: eventRequest.context,
          timing: {
            eventTimestamp: new Date()
          },
          metadata: {
            eventVersion: 1,
            createdAt: new Date(),
            createdBy: commandData.metadata.createdBy,
            correlationId: generateCorrelationId()
          }
        }
      });
    });

    return this.executeTransaction({
      operations,
      description: `Create medication: ${commandData.medication.name}`,
      initiatedBy: commandData.metadata.createdBy,
      rollbackStrategy: 'automatic',
      timeoutSeconds: 45
    });
  }

  /**
   * Execute status change transaction (update command + create event)
   */
  async executeStatusChangeTransaction(
    commandId: string,
    statusUpdate: {
      newStatus: 'active' | 'paused' | 'held' | 'discontinued' | 'completed';
      reason: string;
      updatedBy: string;
      additionalData?: any;
    },
    context: {
      medicationName: string;
      previousStatus: string;
    }
  ): Promise<TransactionResult> {
    const operations: TransactionOperation[] = [];
    const correlationId = generateCorrelationId();

    // Operation 1: Update command status
    operations.push({
      type: 'update_command',
      collection: 'medication_commands',
      documentId: commandId,
      operation: 'update',
      data: {
        'status.current': statusUpdate.newStatus,
        'status.isActive': statusUpdate.newStatus === 'active',
        'status.lastStatusChange': admin.firestore.Timestamp.fromDate(new Date()),
        'status.statusChangedBy': statusUpdate.updatedBy,
        'metadata.updatedAt': admin.firestore.Timestamp.fromDate(new Date()),
        'metadata.updatedBy': statusUpdate.updatedBy,
        'metadata.version': admin.firestore.FieldValue.increment(1),
        ...statusUpdate.additionalData
      }
    });

    // Operation 2: Create status change event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventType = this.mapStatusToEventType(statusUpdate.newStatus);
    
    operations.push({
      type: 'create_event',
      collection: 'medication_events',
      documentId: eventId,
      operation: 'set',
      data: {
        commandId,
        patientId: statusUpdate.updatedBy, // Assuming updatedBy is patient ID
        eventType,
        eventData: {
          previousStatus: context.previousStatus,
          newStatus: statusUpdate.newStatus,
          statusReason: statusUpdate.reason,
          additionalData: statusUpdate.additionalData
        },
        context: {
          medicationName: context.medicationName,
          triggerSource: 'user_action'
        },
        timing: {
          eventTimestamp: new Date()
        },
        metadata: {
          eventVersion: 1,
          createdAt: new Date(),
          createdBy: statusUpdate.updatedBy,
          correlationId
        }
      }
    });

    return this.executeTransaction({
      operations,
      correlationId,
      description: `Status change: ${context.medicationName} from ${context.previousStatus} to ${statusUpdate.newStatus}`,
      initiatedBy: statusUpdate.updatedBy,
      rollbackStrategy: 'automatic',
      timeoutSeconds: 30
    });
  }

  // ===== ROLLBACK OPERATIONS =====

  /**
   * Perform rollback of a failed transaction
   */
  async performRollback(request: RollbackRequest): Promise<{
    success: boolean;
    rollbackId: string;
    operationsRolledBack: number;
    error?: string;
  }> {
    const rollbackId = this.generateRollbackId();
    
    try {
      console.log('🔄 MedicationTransactionManager: Starting rollback:', rollbackId, 'for transaction:', request.transactionId);

      // Get original transaction log
      const transactionDoc = await this.transactionLog.doc(request.transactionId).get();
      
      if (!transactionDoc.exists) {
        return {
          success: false,
          rollbackId,
          operationsRolledBack: 0,
          error: 'Original transaction not found'
        };
      }

      const transactionData = transactionDoc.data()!;
      const originalOperations = transactionData.operations as TransactionOperation[];

      // Create reverse operations
      const rollbackOperations = this.createRollbackOperations(originalOperations);

      // Execute rollback transaction
      await this.firestore.runTransaction(async (rollbackTransaction) => {
        for (const rollbackOp of rollbackOperations) {
          await this.executeOperation(rollbackTransaction, rollbackOp);
        }
      });

      // Log rollback completion
      await this.logRollbackComplete(rollbackId, request, rollbackOperations.length);

      console.log('✅ Rollback completed successfully:', rollbackId);

      return {
        success: true,
        rollbackId,
        operationsRolledBack: rollbackOperations.length
      };

    } catch (error) {
      console.error('❌ Rollback failed:', rollbackId, error);
      
      await this.logRollbackFailure(rollbackId, request, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        rollbackId,
        operationsRolledBack: 0,
        error: error instanceof Error ? error.message : 'Rollback failed'
      };
    }
  }

  /**
   * Create rollback operations (reverse of original operations)
   */
  private createRollbackOperations(originalOperations: TransactionOperation[]): TransactionOperation[] {
    const rollbackOps: TransactionOperation[] = [];

    // Process operations in reverse order
    for (let i = originalOperations.length - 1; i >= 0; i--) {
      const originalOp = originalOperations[i];

      switch (originalOp.operation) {
        case 'set':
          // Reverse of set is delete (if it was a new document)
          rollbackOps.push({
            type: originalOp.type,
            collection: originalOp.collection,
            documentId: originalOp.documentId,
            operation: 'delete',
            data: {}
          });
          break;

        case 'update':
          // Reverse of update would require storing original values
          // For now, we'll mark as needing manual review
          console.warn('⚠️ Update operation cannot be automatically rolled back:', originalOp.documentId);
          break;

        case 'delete':
          // Reverse of delete is restore (if we stored the original data)
          console.warn('⚠️ Delete operation cannot be automatically rolled back:', originalOp.documentId);
          break;
      }
    }

    return rollbackOps;
  }

  // ===== DISTRIBUTED TRANSACTION COORDINATION =====

  /**
   * Execute distributed transaction across multiple services
   */
  async executeDistributedTransaction(
    phases: Array<{
      phaseName: string;
      operations: TransactionOperation[];
      compensationOperations?: TransactionOperation[];
      timeoutSeconds?: number;
    }>,
    description: string,
    initiatedBy: string
  ): Promise<{
    success: boolean;
    transactionId: string;
    phasesCompleted: number;
    phasesTotal: number;
    compensationPerformed: boolean;
    error?: string;
  }> {
    const transactionId = this.generateTransactionId();
    const completedPhases: string[] = [];
    
    try {
      console.log('🔄 MedicationTransactionManager: Starting distributed transaction:', transactionId);

      // Execute phases sequentially
      for (const phase of phases) {
        console.log('🔄 Executing phase:', phase.phaseName);

        const phaseResult = await this.executeTransaction({
          operations: phase.operations,
          description: `${description} - Phase: ${phase.phaseName}`,
          initiatedBy,
          rollbackStrategy: 'manual', // We'll handle compensation manually
          timeoutSeconds: phase.timeoutSeconds || 30
        });

        if (!phaseResult.success) {
          console.error('❌ Phase failed:', phase.phaseName, phaseResult.error);
          
          // Perform compensation for completed phases
          if (completedPhases.length > 0) {
            console.log('🔄 Performing compensation for completed phases');
            await this.performCompensation(phases, completedPhases, transactionId);
          }

          return {
            success: false,
            transactionId,
            phasesCompleted: completedPhases.length,
            phasesTotal: phases.length,
            compensationPerformed: completedPhases.length > 0,
            error: `Phase ${phase.phaseName} failed: ${phaseResult.error}`
          };
        }

        completedPhases.push(phase.phaseName);
        console.log('✅ Phase completed:', phase.phaseName);
      }

      console.log('✅ Distributed transaction completed successfully:', transactionId);

      return {
        success: true,
        transactionId,
        phasesCompleted: completedPhases.length,
        phasesTotal: phases.length,
        compensationPerformed: false
      };

    } catch (error) {
      console.error('❌ Distributed transaction failed:', transactionId, error);

      // Perform compensation for any completed phases
      if (completedPhases.length > 0) {
        await this.performCompensation(phases, completedPhases, transactionId);
      }

      return {
        success: false,
        transactionId,
        phasesCompleted: completedPhases.length,
        phasesTotal: phases.length,
        compensationPerformed: completedPhases.length > 0,
        error: error instanceof Error ? error.message : 'Distributed transaction failed'
      };
    }
  }

  /**
   * Perform compensation for failed distributed transaction
   */
  private async performCompensation(
    phases: Array<{ phaseName: string; compensationOperations?: TransactionOperation[] }>,
    completedPhases: string[],
    transactionId: string
  ): Promise<void> {
    try {
      console.log('🔄 Performing compensation for phases:', completedPhases);

      // Execute compensation operations in reverse order
      for (let i = completedPhases.length - 1; i >= 0; i--) {
        const phaseName = completedPhases[i];
        const phase = phases.find(p => p.phaseName === phaseName);
        
        if (phase?.compensationOperations) {
          console.log('🔄 Compensating phase:', phaseName);
          
          await this.executeTransaction({
            operations: phase.compensationOperations,
            description: `Compensation for phase: ${phaseName}`,
            initiatedBy: 'system',
            rollbackStrategy: 'none' // Don't rollback compensation
          });
        }
      }

      // Log compensation completion
      await this.rollbackLog.add({
        type: 'compensation',
        originalTransactionId: transactionId,
        compensatedPhases: completedPhases,
        compensatedAt: admin.firestore.Timestamp.now(),
        status: 'completed'
      });

    } catch (compensationError) {
      console.error('❌ Compensation failed:', compensationError);
      
      // Log compensation failure
      await this.rollbackLog.add({
        type: 'compensation',
        originalTransactionId: transactionId,
        compensatedPhases: completedPhases,
        compensatedAt: admin.firestore.Timestamp.now(),
        status: 'failed',
        error: compensationError instanceof Error ? compensationError.message : 'Unknown error'
      });
    }
  }

  // ===== TRANSACTION MONITORING =====

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<{
    success: boolean;
    data?: {
      transactionId: string;
      status: 'pending' | 'completed' | 'failed' | 'rolled_back';
      description: string;
      operationsExecuted: number;
      operationsFailed: number;
      executionTimeMs: number;
      error?: string;
      rollbackInfo?: any;
    };
    error?: string;
  }> {
    try {
      const transactionDoc = await this.transactionLog.doc(transactionId).get();
      
      if (!transactionDoc.exists) {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      const data = transactionDoc.data()!;
      
      return {
        success: true,
        data: {
          transactionId,
          status: data.status,
          description: data.description,
          operationsExecuted: data.operationsExecuted || 0,
          operationsFailed: data.operationsFailed || 0,
          executionTimeMs: data.executionTimeMs || 0,
          error: data.error,
          rollbackInfo: data.rollbackInfo
        }
      };

    } catch (error) {
      console.error('❌ Error getting transaction status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction status'
      };
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStatistics(patientId?: string, hours: number = 24): Promise<{
    success: boolean;
    data?: {
      totalTransactions: number;
      successfulTransactions: number;
      failedTransactions: number;
      rolledBackTransactions: number;
      successRate: number;
      averageExecutionTime: number;
      transactionsByType: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      let query = this.transactionLog
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate));

      if (patientId) {
        query = query.where('patientId', '==', patientId);
      }

      const snapshot = await query.get();
      const transactions = snapshot.docs.map(doc => doc.data());

      const stats = {
        totalTransactions: transactions.length,
        successfulTransactions: transactions.filter(t => t.status === 'completed').length,
        failedTransactions: transactions.filter(t => t.status === 'failed').length,
        rolledBackTransactions: transactions.filter(t => t.rollbackPerformed).length,
        successRate: 0,
        averageExecutionTime: 0,
        transactionsByType: {} as Record<string, number>
      };

      // Calculate rates
      stats.successRate = stats.totalTransactions > 0 
        ? (stats.successfulTransactions / stats.totalTransactions) * 100 
        : 0;

      // Calculate average execution time
      const executionTimes = transactions
        .filter(t => t.executionTimeMs)
        .map(t => t.executionTimeMs);
      
      stats.averageExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
        : 0;

      // Count by type
      transactions.forEach(t => {
        const type = t.description.split(':')[0] || 'unknown';
        stats.transactionsByType[type] = (stats.transactionsByType[type] || 0) + 1;
      });

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('❌ Error getting transaction statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction statistics'
      };
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Map status to event type
   */
  private mapStatusToEventType(status: string): MedicationEventType {
    switch (status) {
      case 'paused':
        return MEDICATION_EVENT_TYPES.MEDICATION_PAUSED;
      case 'held':
        return MEDICATION_EVENT_TYPES.MEDICATION_HELD;
      case 'discontinued':
        return MEDICATION_EVENT_TYPES.MEDICATION_DISCONTINUED;
      case 'active':
        return MEDICATION_EVENT_TYPES.MEDICATION_RESUMED;
      default:
        return MEDICATION_EVENT_TYPES.MEDICATION_UPDATED;
    }
  }

  /**
   * Serialize command for transaction storage
   */
  private serializeCommandForTransaction(command: MedicationCommand): any {
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
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique rollback ID
   */
  private generateRollbackId(): string {
    return `rbk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== LOGGING METHODS =====

  /**
   * Log transaction start
   */
  private async logTransactionStart(
    transactionId: string,
    request: TransactionRequest,
    correlationId: string
  ): Promise<void> {
    try {
      await this.transactionLog.doc(transactionId).set({
        transactionId,
        correlationId,
        description: request.description,
        initiatedBy: request.initiatedBy,
        operations: request.operations,
        rollbackStrategy: request.rollbackStrategy || 'none',
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging transaction start:', error);
    }
  }

  /**
   * Log transaction completion
   */
  private async logTransactionComplete(
    transactionId: string,
    result: TransactionResult
  ): Promise<void> {
    try {
      await this.transactionLog.doc(transactionId).update({
        status: 'completed',
        operationsExecuted: result.operationsExecuted,
        operationsFailed: result.operationsFailed,
        executionTimeMs: result.executionTimeMs,
        completedAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging transaction completion:', error);
    }
  }

  /**
   * Log transaction failure
   */
  private async logTransactionFailure(
    transactionId: string,
    result: TransactionResult,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.transactionLog.doc(transactionId).update({
        status: 'failed',
        operationsExecuted: result.operationsExecuted,
        operationsFailed: result.operationsFailed,
        executionTimeMs: result.executionTimeMs,
        error: errorMessage,
        failedAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging transaction failure:', error);
    }
  }

  /**
   * Log rollback completion
   */
  private async logRollbackComplete(
    rollbackId: string,
    request: RollbackRequest,
    operationsRolledBack: number
  ): Promise<void> {
    try {
      await this.rollbackLog.doc(rollbackId).set({
        rollbackId,
        originalTransactionId: request.transactionId,
        reason: request.reason,
        rollbackBy: request.rollbackBy,
        operationsRolledBack,
        status: 'completed',
        createdAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging rollback completion:', error);
    }
  }

  /**
   * Log rollback failure
   */
  private async logRollbackFailure(
    rollbackId: string,
    request: RollbackRequest,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.rollbackLog.doc(rollbackId).set({
        rollbackId,
        originalTransactionId: request.transactionId,
        reason: request.reason,
        rollbackBy: request.rollbackBy,
        status: 'failed',
        error: errorMessage,
        createdAt: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error logging rollback failure:', error);
    }
  }
}