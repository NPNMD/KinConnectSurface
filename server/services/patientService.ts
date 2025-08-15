import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '@shared/firebase';
import type { Patient, NewPatient, ApiResponse } from '@shared/types';

export class PatientService {
  private collection = adminDb.collection(COLLECTIONS.PATIENTS);

  // Create a new patient
  async createPatient(patientData: NewPatient): Promise<ApiResponse<Patient>> {
    try {
      const patientRef = this.collection.doc();
      const newPatient: Patient = {
        id: patientRef.id,
        ...patientData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await patientRef.set(newPatient);
      return { success: true, data: newPatient };
    } catch (error) {
      console.error('Error creating patient:', error);
      return { success: false, error: 'Failed to create patient' };
    }
  }

  // Get patient by ID
  async getPatientById(patientId: string): Promise<ApiResponse<Patient | null>> {
    try {
      const patientDoc = await this.collection.doc(patientId).get();
      
      if (!patientDoc.exists) {
        return { success: true, data: null };
      }

      const patientData = patientDoc.data() as Patient;
      return { success: true, data: patientData };
    } catch (error) {
      console.error('Error getting patient:', error);
      return { success: false, error: 'Failed to get patient' };
    }
  }

  // Get patient by user ID
  async getPatientByUserId(userId: string): Promise<ApiResponse<Patient | null>> {
    try {
      const query = await this.collection.where('userId', '==', userId).limit(1).get();
      
      if (query.empty) {
        return { success: true, data: null };
      }

      const patientDoc = query.docs[0];
      const patientData = patientDoc.data() as Patient;
      return { success: true, data: patientData };
    } catch (error) {
      console.error('Error getting patient by user ID:', error);
      return { success: false, error: 'Failed to get patient by user ID' };
    }
  }

  // Update patient
  async updatePatient(patientId: string, updates: Partial<Patient>): Promise<ApiResponse<Patient>> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      await this.collection.doc(patientId).update(updateData);
      
      // Get updated patient
      const updatedPatient = await this.getPatientById(patientId);
      if (!updatedPatient.success || !updatedPatient.data) {
        throw new Error('Failed to get updated patient');
      }

      return { success: true, data: updatedPatient.data };
    } catch (error) {
      console.error('Error updating patient:', error);
      return { success: false, error: 'Failed to update patient' };
    }
  }

  // Delete patient
  async deletePatient(patientId: string): Promise<ApiResponse<boolean>> {
    try {
      await this.collection.doc(patientId).delete();
      return { success: true, data: true };
    } catch (error) {
      console.error('Error deleting patient:', error);
      return { success: false, error: 'Failed to delete patient' };
    }
  }

  // Get all patients (with pagination)
  async getPatients(page: number = 1, limit: number = 20): Promise<ApiResponse<Patient[]>> {
    try {
      const offset = (page - 1) * limit;
      const query = await this.collection
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const patients = query.docs.map(doc => doc.data() as Patient);
      return { success: true, data: patients };
    } catch (error) {
      console.error('Error getting patients:', error);
      return { success: false, error: 'Failed to get patients' };
    }
  }

  // Search patients by medical conditions
  async searchPatientsByCondition(condition: string): Promise<ApiResponse<Patient[]>> {
    try {
      const query = await this.collection
        .where('medicalConditions', 'array-contains', condition)
        .limit(20)
        .get();

      const patients = query.docs.map(doc => doc.data() as Patient);
      return { success: true, data: patients };
    } catch (error) {
      console.error('Error searching patients by condition:', error);
      return { success: false, error: 'Failed to search patients by condition' };
    }
  }

  // Search patients by allergies
  async searchPatientsByAllergy(allergy: string): Promise<ApiResponse<Patient[]>> {
    try {
      const query = await this.collection
        .where('allergies', 'array-contains', allergy)
        .limit(20)
        .get();

      const patients = query.docs.map(doc => doc.data() as Patient);
      return { success: true, data: patients };
    } catch (error) {
      console.error('Error searching patients by allergy:', error);
      return { success: false, error: 'Failed to search patients by allergy' };
    }
  }

  // Get patients by age range
  async getPatientsByAgeRange(minAge: number, maxAge: number): Promise<ApiResponse<Patient[]>> {
    try {
      const now = new Date();
      const minDate = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate());
      const maxDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());

      const query = await this.collection
        .where('dateOfBirth', '>=', minDate.toISOString())
        .where('dateOfBirth', '<=', maxDate.toISOString())
        .limit(50)
        .get();

      const patients = query.docs.map(doc => doc.data() as Patient);
      return { success: true, data: patients };
    } catch (error) {
      console.error('Error getting patients by age range:', error);
      return { success: false, error: 'Failed to get patients by age range' };
    }
  }
}

export const patientService = new PatientService();
