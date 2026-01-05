import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '@shared/firebase';

export class AccessService {
  /**
   * Checks if a user has access to a patient's data.
   * Access is granted if:
   * 1. The user IS the patient (userId === patientId)
   * 2. The user is in the same family group as the patient
   */
  async canAccessPatient(userId: string, targetPatientId: string): Promise<boolean> {
    if (userId === targetPatientId) {
      return true;
    }

    try {
      // 1. Get the requesting user's familyGroupId
      const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(userId).get();
      if (!userDoc.exists) return false;
      const userData = userDoc.data();
      const userFamilyGroupId = userData?.familyGroupId;

      if (!userFamilyGroupId) return false;

      // 2. Get the target patient's familyGroupId
      // Note: In our model, 'patients' collection links to 'users' collection via userId.
      // Or sometimes patientId IS the userId. 
      // The routes usually pass 'patientId' which seems to be the user ID in the current implementation (medications.ts line 12).
      // If patientId is a separate document in 'patients' collection, we need to resolve it.
      // Looking at patientService.ts, getPatientByUserId returns a Patient object which has 'userId'.
      
      // If targetPatientId is a UUID from 'patients' collection:
      let targetUserUid = targetPatientId;
      
      // Check if targetPatientId is a user ID or patient profile ID
      // We'll assume for now that if we can't find a user with this ID, it might be a patient profile ID.
      // But typically in this app, userId seems to be used as patientId in many places.
      // Let's check if a User exists with targetPatientId
      const targetUserDoc = await adminDb.collection(COLLECTIONS.USERS).doc(targetPatientId).get();
      
      if (!targetUserDoc.exists) {
         // Try finding patient by ID to get the userId
         const patientDoc = await adminDb.collection(COLLECTIONS.PATIENTS).doc(targetPatientId).get();
         if (patientDoc.exists) {
             targetUserUid = patientDoc.data()?.userId;
         } else {
             return false; // Target not found
         }
      }

      // Now we have the target user's UID (targetUserUid)
      // If we looked up the user doc earlier, use it, otherwise fetch it.
      let targetFamilyGroupId;
      if (targetUserDoc.exists) {
          targetFamilyGroupId = targetUserDoc.data()?.familyGroupId;
      } else {
          const uDoc = await adminDb.collection(COLLECTIONS.USERS).doc(targetUserUid).get();
          targetFamilyGroupId = uDoc.data()?.familyGroupId;
      }

      return userFamilyGroupId === targetFamilyGroupId;

    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  }
}

export const accessService = new AccessService();

