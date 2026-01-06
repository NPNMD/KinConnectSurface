"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientService = void 0;
const firebase_1 = require("../firebase");
class PatientService {
    db;
    collectionName = firebase_1.COLLECTIONS?.PATIENTS || 'patients';
    constructor(deps) {
        this.db = deps.db;
    }
    // Create a new patient
    async createPatient(patientData) {
        try {
            const patientRef = this.db.collection(this.collectionName).doc();
            const newPatient = {
                id: patientRef.id,
                ...patientData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await patientRef.set(newPatient);
            return { success: true, data: newPatient };
        }
        catch (error) {
            console.error('Error creating patient:', error);
            return { success: false, error: 'Failed to create patient' };
        }
    }
    // Get patient by ID
    async getPatientById(patientId) {
        try {
            const patientDoc = await this.db.collection(this.collectionName).doc(patientId).get();
            if (!patientDoc.exists) {
                return { success: true, data: null };
            }
            const patientData = patientDoc.data();
            return { success: true, data: patientData };
        }
        catch (error) {
            console.error('Error getting patient:', error);
            return { success: false, error: 'Failed to get patient' };
        }
    }
    // Get patient by user ID
    async getPatientByUserId(userId) {
        try {
            const query = await this.db.collection(this.collectionName).where('userId', '==', userId).limit(1).get();
            if (query.empty) {
                return { success: true, data: null };
            }
            const patientDoc = query.docs[0];
            const patientData = patientDoc.data();
            return { success: true, data: patientData };
        }
        catch (error) {
            console.error('Error getting patient by user ID:', error);
            return { success: false, error: 'Failed to get patient by user ID' };
        }
    }
    // Update patient
    async updatePatient(patientId, updates) {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date(),
            };
            await this.db.collection(this.collectionName).doc(patientId).update(updateData);
            // Get updated patient
            const updatedPatient = await this.getPatientById(patientId);
            if (!updatedPatient.success || !updatedPatient.data) {
                throw new Error('Failed to get updated patient');
            }
            return { success: true, data: updatedPatient.data };
        }
        catch (error) {
            console.error('Error updating patient:', error);
            return { success: false, error: 'Failed to update patient' };
        }
    }
    // Delete patient
    async deletePatient(patientId) {
        try {
            await this.db.collection(this.collectionName).doc(patientId).delete();
            return { success: true, data: true };
        }
        catch (error) {
            console.error('Error deleting patient:', error);
            return { success: false, error: 'Failed to delete patient' };
        }
    }
    // Get all patients (with pagination)
    async getPatients(page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            const query = await this.db.collection(this.collectionName)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .offset(offset)
                .get();
            const patients = query.docs.map((doc) => doc.data());
            return { success: true, data: patients };
        }
        catch (error) {
            console.error('Error getting patients:', error);
            return { success: false, error: 'Failed to get patients' };
        }
    }
    // Search patients by medical conditions
    async searchPatientsByCondition(condition) {
        try {
            const query = await this.db.collection(this.collectionName)
                .where('medicalConditions', 'array-contains', condition)
                .limit(20)
                .get();
            const patients = query.docs.map((doc) => doc.data());
            return { success: true, data: patients };
        }
        catch (error) {
            console.error('Error searching patients by condition:', error);
            return { success: false, error: 'Failed to search patients by condition' };
        }
    }
    // Search patients by allergies
    async searchPatientsByAllergy(allergy) {
        try {
            const query = await this.db.collection(this.collectionName)
                .where('allergies', 'array-contains', allergy)
                .limit(20)
                .get();
            const patients = query.docs.map((doc) => doc.data());
            return { success: true, data: patients };
        }
        catch (error) {
            console.error('Error searching patients by allergy:', error);
            return { success: false, error: 'Failed to search patients by allergy' };
        }
    }
    // Get patients by age range
    async getPatientsByAgeRange(minAge, maxAge) {
        try {
            const now = new Date();
            const minDate = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate());
            const maxDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
            const query = await this.db.collection(this.collectionName)
                .where('dateOfBirth', '>=', minDate.toISOString())
                .where('dateOfBirth', '<=', maxDate.toISOString())
                .limit(50)
                .get();
            const patients = query.docs.map((doc) => doc.data());
            return { success: true, data: patients };
        }
        catch (error) {
            console.error('Error getting patients by age range:', error);
            return { success: false, error: 'Failed to get patients by age range' };
        }
    }
}
exports.PatientService = PatientService;
