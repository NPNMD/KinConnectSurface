import { Medication, NewMedication, MedicationLog, NewMedicationLog, ApiResponse } from '@shared/types';

// Mock database - replace with actual database implementation
let medications: Medication[] = [];
let medicationLogs: MedicationLog[] = [];
let nextMedicationId = 1;
let nextLogId = 1;

export class MedicationService {
  // Get all medications for a patient
  async getMedicationsByPatientId(patientId: string): Promise<ApiResponse<Medication[]>> {
    try {
      const patientMedications = medications.filter(med => med.patientId === patientId);
      
      return {
        success: true,
        data: patientMedications,
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
      const medication = medications.find(med => med.id === medicationId);
      
      if (!medication) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

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
      };

      const newMedication: Medication = {
        id: nextMedicationId.toString(),
        ...parsedMedicationData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      medications.push(newMedication);
      nextMedicationId++;

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
      const medicationIndex = medications.findIndex(med => med.id === medicationId);
      
      if (medicationIndex === -1) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      // Parse any date fields in updates
      const parsedUpdates = { ...updates };
      if (parsedUpdates.prescribedDate) {
        parsedUpdates.prescribedDate = new Date(parsedUpdates.prescribedDate);
      }
      if (parsedUpdates.startDate) {
        parsedUpdates.startDate = new Date(parsedUpdates.startDate);
      }
      if (parsedUpdates.endDate) {
        parsedUpdates.endDate = new Date(parsedUpdates.endDate);
      }

      const updatedMedication = {
        ...medications[medicationIndex],
        ...parsedUpdates,
        updatedAt: new Date(),
      };

      medications[medicationIndex] = updatedMedication;

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
      const medicationIndex = medications.findIndex(med => med.id === medicationId);
      
      if (medicationIndex === -1) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      medications.splice(medicationIndex, 1);

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
      const patientLogs = medicationLogs.filter(log => log.patientId === patientId);
      
      return {
        success: true,
        data: patientLogs,
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
      const medicationLogEntries = medicationLogs.filter(log => log.medicationId === medicationId);
      
      return {
        success: true,
        data: medicationLogEntries,
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

  // Create a medication log entry
  async createMedicationLog(logData: NewMedicationLog): Promise<ApiResponse<MedicationLog>> {
    try {
      // Verify the medication exists
      const medication = medications.find(med => med.id === logData.medicationId);
      if (!medication) {
        return {
          success: false,
          error: 'Medication not found'
        };
      }

      const newLog: MedicationLog = {
        id: nextLogId.toString(),
        ...logData,
        createdAt: new Date(),
      };

      medicationLogs.push(newLog);
      nextLogId++;

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
      const logIndex = medicationLogs.findIndex(log => log.id === logId);
      
      if (logIndex === -1) {
        return {
          success: false,
          error: 'Medication log not found'
        };
      }

      const updatedLog = {
        ...medicationLogs[logIndex],
        ...updates,
      };

      medicationLogs[logIndex] = updatedLog;

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
      const logIndex = medicationLogs.findIndex(log => log.id === logId);
      
      if (logIndex === -1) {
        return {
          success: false,
          error: 'Medication log not found'
        };
      }

      medicationLogs.splice(logIndex, 1);

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
      const patientMedications = medications.filter(med => 
        med.patientId === patientId && 
        (med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         med.genericName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         med.brandName?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      return {
        success: true,
        data: patientMedications,
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
      const activeMedications = medications.filter(med => 
        med.patientId === patientId && med.isActive
      );
      
      return {
        success: true,
        data: activeMedications,
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
}

// Export singleton instance
export const medicationService = new MedicationService();