import { adminDb as db } from '../firebase-admin';
import { 
  HealthcareProvider, 
  NewHealthcareProvider, 
  MedicalFacility, 
  NewMedicalFacility 
} from '../../shared/types';

const HEALTHCARE_PROVIDERS_COLLECTION = 'healthcare_providers';
const MEDICAL_FACILITIES_COLLECTION = 'medical_facilities';

// Healthcare Providers Service Functions

export async function createHealthcareProvider(providerData: NewHealthcareProvider): Promise<HealthcareProvider> {
  try {
    const now = new Date();
    const docRef = await db.collection(HEALTHCARE_PROVIDERS_COLLECTION).add({
      ...providerData,
      createdAt: now,
      updatedAt: now
    });

    const doc = await docRef.get();
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || now,
      updatedAt: data?.updatedAt?.toDate() || now,
      relationshipStart: data?.relationshipStart?.toDate(),
      lastVisit: data?.lastVisit?.toDate(),
      nextAppointment: data?.nextAppointment?.toDate()
    } as HealthcareProvider;
  } catch (error) {
    console.error('Error creating healthcare provider:', error);
    throw new Error('Failed to create healthcare provider');
  }
}

export async function getHealthcareProviders(patientId: string): Promise<HealthcareProvider[]> {
  try {
    const snapshot = await db
      .collection(HEALTHCARE_PROVIDERS_COLLECTION)
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        relationshipStart: data.relationshipStart?.toDate(),
        lastVisit: data.lastVisit?.toDate(),
        nextAppointment: data.nextAppointment?.toDate()
      } as HealthcareProvider;
    });
  } catch (error) {
    console.error('Error fetching healthcare providers:', error);
    throw new Error('Failed to fetch healthcare providers');
  }
}

export async function updateHealthcareProvider(
  id: string, 
  updates: Partial<HealthcareProvider>
): Promise<HealthcareProvider> {
  try {
    const docRef = db.collection(HEALTHCARE_PROVIDERS_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Healthcare provider not found');
    }

    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    // Convert date strings to Firestore timestamps if needed
    if (updates.relationshipStart) {
      updateData.relationshipStart = new Date(updates.relationshipStart);
    }
    if (updates.lastVisit) {
      updateData.lastVisit = new Date(updates.lastVisit);
    }
    if (updates.nextAppointment) {
      updateData.nextAppointment = new Date(updates.nextAppointment);
    }

    await docRef.update(updateData);
    
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    
    return {
      id: updatedDoc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
      relationshipStart: data?.relationshipStart?.toDate(),
      lastVisit: data?.lastVisit?.toDate(),
      nextAppointment: data?.nextAppointment?.toDate()
    } as HealthcareProvider;
  } catch (error) {
    console.error('Error updating healthcare provider:', error);
    throw new Error('Failed to update healthcare provider');
  }
}

export async function deleteHealthcareProvider(id: string): Promise<void> {
  try {
    const docRef = db.collection(HEALTHCARE_PROVIDERS_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Healthcare provider not found');
    }

    // Soft delete by setting isActive to false
    await docRef.update({
      isActive: false,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error deleting healthcare provider:', error);
    throw new Error('Failed to delete healthcare provider');
  }
}

export async function getHealthcareProviderById(id: string): Promise<HealthcareProvider | null> {
  try {
    const doc = await db.collection(HEALTHCARE_PROVIDERS_COLLECTION).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
      relationshipStart: data?.relationshipStart?.toDate(),
      lastVisit: data?.lastVisit?.toDate(),
      nextAppointment: data?.nextAppointment?.toDate()
    } as HealthcareProvider;
  } catch (error) {
    console.error('Error fetching healthcare provider by ID:', error);
    throw new Error('Failed to fetch healthcare provider');
  }
}

// Medical Facilities Service Functions

export async function createMedicalFacility(facilityData: NewMedicalFacility): Promise<MedicalFacility> {
  try {
    const now = new Date();
    const docRef = await db.collection(MEDICAL_FACILITIES_COLLECTION).add({
      ...facilityData,
      createdAt: now,
      updatedAt: now
    });

    const doc = await docRef.get();
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || now,
      updatedAt: data?.updatedAt?.toDate() || now
    } as MedicalFacility;
  } catch (error) {
    console.error('Error creating medical facility:', error);
    throw new Error('Failed to create medical facility');
  }
}

export async function getMedicalFacilities(patientId: string): Promise<MedicalFacility[]> {
  try {
    const snapshot = await db
      .collection(MEDICAL_FACILITIES_COLLECTION)
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as MedicalFacility;
    });
  } catch (error) {
    console.error('Error fetching medical facilities:', error);
    throw new Error('Failed to fetch medical facilities');
  }
}

export async function updateMedicalFacility(
  id: string, 
  updates: Partial<MedicalFacility>
): Promise<MedicalFacility> {
  try {
    const docRef = db.collection(MEDICAL_FACILITIES_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Medical facility not found');
    }

    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    await docRef.update(updateData);
    
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    
    return {
      id: updatedDoc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date()
    } as MedicalFacility;
  } catch (error) {
    console.error('Error updating medical facility:', error);
    throw new Error('Failed to update medical facility');
  }
}

export async function deleteMedicalFacility(id: string): Promise<void> {
  try {
    const docRef = db.collection(MEDICAL_FACILITIES_COLLECTION).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Medical facility not found');
    }

    // Soft delete by setting isActive to false
    await docRef.update({
      isActive: false,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error deleting medical facility:', error);
    throw new Error('Failed to delete medical facility');
  }
}

export async function getMedicalFacilityById(id: string): Promise<MedicalFacility | null> {
  try {
    const doc = await db.collection(MEDICAL_FACILITIES_COLLECTION).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date()
    } as MedicalFacility;
  } catch (error) {
    console.error('Error fetching medical facility by ID:', error);
    throw new Error('Failed to fetch medical facility');
  }
}

// Utility functions

export async function getPrimaryHealthcareProvider(patientId: string): Promise<HealthcareProvider | null> {
  try {
    const snapshot = await db
      .collection(HEALTHCARE_PROVIDERS_COLLECTION)
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .where('isPrimary', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      relationshipStart: data.relationshipStart?.toDate(),
      lastVisit: data.lastVisit?.toDate(),
      nextAppointment: data.nextAppointment?.toDate()
    } as HealthcareProvider;
  } catch (error) {
    console.error('Error fetching primary healthcare provider:', error);
    throw new Error('Failed to fetch primary healthcare provider');
  }
}

export async function getPreferredMedicalFacilities(patientId: string): Promise<MedicalFacility[]> {
  try {
    const snapshot = await db
      .collection(MEDICAL_FACILITIES_COLLECTION)
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .where('isPreferred', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as MedicalFacility;
    });
  } catch (error) {
    console.error('Error fetching preferred medical facilities:', error);
    throw new Error('Failed to fetch preferred medical facilities');
  }
}

export async function getHealthcareProvidersBySpecialty(
  patientId: string, 
  specialty: string
): Promise<HealthcareProvider[]> {
  try {
    const snapshot = await db
      .collection(HEALTHCARE_PROVIDERS_COLLECTION)
      .where('patientId', '==', patientId)
      .where('isActive', '==', true)
      .where('specialty', '==', specialty)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        relationshipStart: data.relationshipStart?.toDate(),
        lastVisit: data.lastVisit?.toDate(),
        nextAppointment: data.nextAppointment?.toDate()
      } as HealthcareProvider;
    });
  } catch (error) {
    console.error('Error fetching healthcare providers by specialty:', error);
    throw new Error('Failed to fetch healthcare providers by specialty');
  }
}