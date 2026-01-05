import { Medication, NewMedication, MedicationLog, NewMedicationLog, ApiResponse, MedicationReminder, NewMedicationReminder } from '../types';

interface MedicationServiceDeps {
  db: any; // Firestore instance
}

export class MedicationService {
  private db: any;

  constructor(deps: MedicationServiceDeps) {
    this.db = deps.db;
  }

  // Get all medications for a patient
  async getMedicationsByPatientId(patientId: string): Promise<ApiResponse<Medication[]>> {
    try {
      const snapshot = await this.db.collection('medications')
        .where('patientId', '==', patientId)
        .get();
      
      const medications = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          prescribedDate: data.prescribedDate?.toDate ? data.prescribedDate.toDate() : new Date(data.prescribedDate),
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        };
      }) as Medication[];
      
      return {
        success: true,
        data: medications,
        message: 'Medications retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting medications:', error);
      return {
        success: false,
        error: 'Failed to retrieve medications'
      };
    }
  }

  // Get a specific medication by ID
  async getMedicationById(medicationId: string): Promise<ApiResponse<Medication>> {
    try {
      const doc = await this.db.collection('medications').doc(medicationId).get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      const data = doc.data();
      const medication: Medication = {
        id: doc.id,
        ...data,
        prescribedDate: data.prescribedDate?.toDate ? data.prescribedDate.toDate() : new Date(data.prescribedDate),
        startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
        endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      };

      return {
        success: true,
        data: medication,
        message: 'Medication retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting medication:', error);
      return {
        success: false,
        error: 'Failed to retrieve medication'
      };
    }
  }

  // Create a new medication
  async createMedication(medicationData: NewMedication): Promise<ApiResponse<Medication>> {
    try {
      // Ensure dates are properly parsed
      const parsedMedicationData = {
        ...medicationData,
        prescribedDate: new Date(medicationData.prescribedDate),
        startDate: medicationData.startDate ? new Date(medicationData.startDate) : undefined,
        endDate: medicationData.endDate ? new Date(medicationData.endDate) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create a new document reference to get an ID
      const docRef = this.db.collection('medications').doc();
      
      const newMedication: Medication = {
        id: docRef.id,
        ...parsedMedicationData,
      };

      await docRef.set(parsedMedicationData);

      return {
        success: true,
        data: newMedication,
        message: 'Medication created successfully'
      };
    } catch (error) {
      console.error('Error creating medication:', error);
      return {
        success: false,
        error: 'Failed to create medication'
      };
    }
  }

  // Update an existing medication
  async updateMedication(medicationId: string, updates: Partial<Medication>): Promise<ApiResponse<Medication>> {
    try {
      const docRef = this.db.collection('medications').doc(medicationId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      // Parse any date fields in updates
      const parsedUpdates: any = { ...updates };
      if (parsedUpdates.prescribedDate) {
        parsedUpdates.prescribedDate = new Date(parsedUpdates.prescribedDate);
      }
      if (parsedUpdates.startDate) {
        parsedUpdates.startDate = new Date(parsedUpdates.startDate);
      }
      if (parsedUpdates.endDate) {
        parsedUpdates.endDate = new Date(parsedUpdates.endDate);
      }
      parsedUpdates.updatedAt = new Date();

      await docRef.update(parsedUpdates);

      // Fetch the updated document to return it
      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();
      
      const updatedMedication: Medication = {
        id: updatedDoc.id,
        ...data,
        prescribedDate: data.prescribedDate?.toDate ? data.prescribedDate.toDate() : new Date(data.prescribedDate),
        startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
        endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      };

      return {
        success: true,
        data: updatedMedication,
        message: 'Medication updated successfully'
      };
    } catch (error) {
      console.error('Error updating medication:', error);
      return {
        success: false,
        error: 'Failed to update medication'
      };
    }
  }

  // Delete a medication
  async deleteMedication(medicationId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = this.db.collection('medications').doc(medicationId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      await docRef.delete();

      return {
        success: true,
        message: 'Medication deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting medication:', error);
      return {
        success: false,
        error: 'Failed to delete medication'
      };
    }
  }

  // Get medication logs for a patient
  async getMedicationLogsByPatientId(patientId: string): Promise<ApiResponse<MedicationLog[]>> {
    try {
      const snapshot = await this.db.collection('medicationLogs')
        .where('patientId', '==', patientId)
        .orderBy('takenAt', 'desc') // Good to order logs
        .get();
      
      const logs = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          takenAt: data.takenAt?.toDate ? data.takenAt.toDate() : new Date(data.takenAt),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        };
      }) as MedicationLog[];
      
      return {
        success: true,
        data: logs,
        message: 'Medication logs retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting medication logs:', error);
      return {
        success: false,
        error: 'Failed to retrieve medication logs'
      };
    }
  }

  // Get medication logs for a specific medication
  async getMedicationLogsByMedicationId(medicationId: string): Promise<ApiResponse<MedicationLog[]>> {
    try {
      const snapshot = await this.db.collection('medicationLogs')
        .where('medicationId', '==', medicationId)
        .orderBy('takenAt', 'desc')
        .get();
      
      const logs = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          takenAt: data.takenAt?.toDate ? data.takenAt.toDate() : new Date(data.takenAt),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        };
      }) as MedicationLog[];
      
      return {
        success: true,
        data: logs,
        message: 'Medication logs retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting medication logs:', error);
      return {
        success: false,
        error: 'Failed to retrieve medication logs'
      };
    }
  }

  // Get a specific medication log by ID
  async getMedicationLogById(logId: string): Promise<ApiResponse<MedicationLog>> {
    try {
      const doc = await this.db.collection('medicationLogs').doc(logId).get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication log not found'
        };
      }

      const data = doc.data();
      const log: MedicationLog = {
        id: doc.id,
        ...data,
        takenAt: data.takenAt?.toDate ? data.takenAt.toDate() : new Date(data.takenAt),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      };

      return {
        success: true,
        data: log,
        message: 'Medication log retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting medication log:', error);
      return {
        success: false,
        error: 'Failed to retrieve medication log'
      };
    }
  }

  // Create a medication log entry
  async createMedicationLog(logData: NewMedicationLog): Promise<ApiResponse<MedicationLog>> {
    try {
      // Verify the medication exists
      const medicationDoc = await this.db.collection('medications').doc(logData.medicationId).get();
      if (!medicationDoc.exists) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      const parsedLogData = {
        ...logData,
        takenAt: new Date(logData.takenAt),
        createdAt: new Date(),
      };

      const docRef = this.db.collection('medicationLogs').doc();
      const newLog: MedicationLog = {
        id: docRef.id,
        ...parsedLogData,
      };

      await docRef.set(parsedLogData);

      return {
        success: true,
        data: newLog,
        message: 'Medication log created successfully'
      };
    } catch (error) {
      console.error('Error creating medication log:', error);
      return {
        success: false,
        error: 'Failed to create medication log'
      };
    }
  }

  // Update a medication log entry
  async updateMedicationLog(logId: string, updates: Partial<MedicationLog>): Promise<ApiResponse<MedicationLog>> {
    try {
      const docRef = this.db.collection('medicationLogs').doc(logId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication log not found'
        };
      }

      const parsedUpdates: any = { ...updates };
      if (parsedUpdates.takenAt) {
        parsedUpdates.takenAt = new Date(parsedUpdates.takenAt);
      }

      await docRef.update(parsedUpdates);

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();
      const updatedLog: MedicationLog = {
        id: updatedDoc.id,
        ...data,
        takenAt: data.takenAt?.toDate ? data.takenAt.toDate() : new Date(data.takenAt),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      };

      return {
        success: true,
        data: updatedLog,
        message: 'Medication log updated successfully'
      };
    } catch (error) {
      console.error('Error updating medication log:', error);
      return {
        success: false,
        error: 'Failed to update medication log'
      };
    }
  }

  // Delete a medication log entry
  async deleteMedicationLog(logId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = this.db.collection('medicationLogs').doc(logId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Medication log not found'
        };
      }

      await docRef.delete();

      return {
        success: true,
        message: 'Medication log deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting medication log:', error);
      return {
        success: false,
        error: 'Failed to delete medication log'
      };
    }
  }

  // Search medications by name
  async searchMedicationsByName(patientId: string, searchTerm: string): Promise<ApiResponse<Medication[]>> {
    try {
      // Firestore doesn't support substring search natively.
      // We can fetch all for patient and filter in memory, or use a third-party search service (Algolia/Typesense).
      // For now, since medication lists per patient are small, filtering in memory is acceptable.
      
      const snapshot = await this.db.collection('medications')
        .where('patientId', '==', patientId)
        .get();
        
      const medications = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          prescribedDate: data.prescribedDate?.toDate ? data.prescribedDate.toDate() : new Date(data.prescribedDate),
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        };
      }) as Medication[];

      const filteredMedications = medications.filter(med => 
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.genericName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.brandName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      return {
        success: true,
        data: filteredMedications,
        message: 'Medications found successfully'
      };
    } catch (error) {
      console.error('Error searching medications:', error);
      return {
        success: false,
        error: 'Failed to search medications'
      };
    }
  }

  // Get active medications for a patient
  async getActiveMedicationsByPatientId(patientId: string): Promise<ApiResponse<Medication[]>> {
    try {
      const snapshot = await this.db.collection('medications')
        .where('patientId', '==', patientId)
        .where('isActive', '==', true)
        .get();
      
      const medications = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          prescribedDate: data.prescribedDate?.toDate ? data.prescribedDate.toDate() : new Date(data.prescribedDate),
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        };
      }) as Medication[];
      
      return {
        success: true,
        data: medications,
        message: 'Active medications retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting active medications:', error);
      return {
        success: false,
        error: 'Failed to retrieve active medications'
      };
    }
  }

  // Medication Reminder Methods

  async getMedicationRemindersByPatientId(patientId: string): Promise<ApiResponse<MedicationReminder[]>> {
    try {
      const snapshot = await this.db.collection('medicationReminders')
        .where('patientId', '==', patientId)
        .get();
      
      const reminders = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        };
      }) as MedicationReminder[];

      return {
        success: true,
        data: reminders,
        message: 'Reminders retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting reminders:', error);
      return {
        success: false,
        error: 'Failed to retrieve reminders'
      };
    }
  }

  async getMedicationRemindersByMedicationId(medicationId: string): Promise<ApiResponse<MedicationReminder[]>> {
    try {
      const snapshot = await this.db.collection('medicationReminders')
        .where('medicationId', '==', medicationId)
        .get();
      
      const reminders = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        };
      }) as MedicationReminder[];

      return {
        success: true,
        data: reminders,
        message: 'Reminders retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting reminders:', error);
      return {
        success: false,
        error: 'Failed to retrieve reminders'
      };
    }
  }

  async getMedicationReminderById(reminderId: string): Promise<ApiResponse<MedicationReminder>> {
    try {
      const doc = await this.db.collection('medicationReminders').doc(reminderId).get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Reminder not found'
        };
      }

      const data = doc.data();
      const reminder: MedicationReminder = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      };

      return {
        success: true,
        data: reminder,
        message: 'Reminder retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting reminder:', error);
      return {
        success: false,
        error: 'Failed to retrieve reminder'
      };
    }
  }

  async createMedicationReminder(reminderData: NewMedicationReminder): Promise<ApiResponse<MedicationReminder>> {
    try {
      // Verify medication exists
      const medicationDoc = await this.db.collection('medications').doc(reminderData.medicationId).get();
      if (!medicationDoc.exists) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      const docRef = this.db.collection('medicationReminders').doc();
      const parsedData = {
        ...reminderData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newReminder: MedicationReminder = {
        id: docRef.id,
        ...parsedData,
      };

      await docRef.set(parsedData);

      return {
        success: true,
        data: newReminder,
        message: 'Reminder created successfully'
      };
    } catch (error) {
      console.error('Error creating reminder:', error);
      return {
        success: false,
        error: 'Failed to create reminder'
      };
    }
  }

  async updateMedicationReminder(reminderId: string, updates: Partial<MedicationReminder>): Promise<ApiResponse<MedicationReminder>> {
    try {
      const docRef = this.db.collection('medicationReminders').doc(reminderId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Reminder not found'
        };
      }

      const parsedUpdates = {
        ...updates,
        updatedAt: new Date()
      };

      await docRef.update(parsedUpdates);

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();
      const updatedReminder: MedicationReminder = {
        id: updatedDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      };

      return {
        success: true,
        data: updatedReminder,
        message: 'Reminder updated successfully'
      };
    } catch (error) {
      console.error('Error updating reminder:', error);
      return {
        success: false,
        error: 'Failed to update reminder'
      };
    }
  }

  async deleteMedicationReminder(reminderId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = this.db.collection('medicationReminders').doc(reminderId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return {
          success: false,
          error: 'Reminder not found'
        };
      }

      await docRef.delete();

      return {
        success: true,
        message: 'Reminder deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting reminder:', error);
      return {
        success: false,
        error: 'Failed to delete reminder'
      };
    }
  }
}

