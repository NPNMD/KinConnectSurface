const admin = require('firebase-admin');
const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function investigateBulkScheduleCreation() {
  try {
    console.log('🔍 === BULK SCHEDULE CREATION INVESTIGATION ===');
    
    // First, let's find a patient with medications
    console.log('🔍 Step 1: Finding patients with medications...');
    
    const medicationsSnapshot = await firestore.collection('medications')
      .limit(10)
      .get();
    
    if (medicationsSnapshot.empty) {
      console.log('❌ No medications found in the database');
      return;
    }
    
    // Group medications by patient
    const medicationsByPatient = {};
    medicationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const patientId = data.patientId;
      if (!medicationsByPatient[patientId]) {
        medicationsByPatient[patientId] = [];
      }
      medicationsByPatient[patientId].push({
        id: doc.id,
        ...data,
        prescribedDate: data.prescribedDate?.toDate?.() || data.prescribedDate,
        startDate: data.startDate?.toDate?.() || data.startDate,
        endDate: data.endDate?.toDate?.() || data.endDate,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      });
    });
    
    console.log('📊 Medications by patient:', Object.keys(medicationsByPatient).map(patientId => ({
      patientId,
      medicationCount: medicationsByPatient[patientId].length
    })));
    
    // Find the patient with the most medications
    const patientWithMostMeds = Object.keys(medicationsByPatient).reduce((a, b) => 
      medicationsByPatient[a].length > medicationsByPatient[b].length ? a : b
    );
    
    console.log('🎯 Selected patient with most medications:', patientWithMostMeds);
    const patientMedications = medicationsByPatient[patientWithMostMeds];
    
    console.log('🔍 Step 2: Analyzing medications for patient:', patientWithMostMeds);
    console.log('📋 All medications for this patient:');
    
    patientMedications.forEach((med, index) => {
      console.log(`  ${index + 1}. "${med.name}":`, {
        id: med.id,
        isActive: med.isActive,
        hasReminders: med.hasReminders,
        isPRN: med.isPRN,
        frequency: med.frequency,
        dosage: med.dosage,
        reminderTimes: med.reminderTimes,
        prescribedDate: med.prescribedDate,
        startDate: med.startDate,
        endDate: med.endDate
      });
    });
    
    // Look specifically for the mentioned medications
    const lisinoprilMed = patientMedications.find(med => 
      med.name && med.name.toLowerCase().includes('lisinopril')
    );
    const metforminMed = patientMedications.find(med => 
      med.name && med.name.toLowerCase().includes('metformin')
    );
    
    if (lisinoprilMed) {
      console.log('🎯 Found LISINOPRIL medication:', {
        id: lisinoprilMed.id,
        name: lisinoprilMed.name,
        isActive: lisinoprilMed.isActive,
        hasReminders: lisinoprilMed.hasReminders,
        isPRN: lisinoprilMed.isPRN,
        frequency: lisinoprilMed.frequency,
        dosage: lisinoprilMed.dosage,
        reminderTimes: lisinoprilMed.reminderTimes
      });
    }
    
    if (metforminMed) {
      console.log('🎯 Found METFORMIN medication:', {
        id: metforminMed.id,
        name: metforminMed.name,
        isActive: metforminMed.isActive,
        hasReminders: metforminMed.hasReminders,
        isPRN: metforminMed.isPRN,
        frequency: metforminMed.frequency,
        dosage: metforminMed.dosage,
        reminderTimes: metforminMed.reminderTimes
      });
    }
    
    // Check existing schedules for this patient
    console.log('🔍 Step 3: Checking existing schedules...');
    const schedulesSnapshot = await firestore.collection('medication_schedules')
      .where('patientId', '==', patientWithMostMeds)
      .get();
    
    console.log('📅 Existing schedules for patient:', {
      count: schedulesSnapshot.docs.length,
      schedules: schedulesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          medicationId: data.medicationId,
          medicationName: data.medicationName,
          frequency: data.frequency,
          times: data.times,
          isActive: data.isActive,
          isPaused: data.isPaused
        };
      })
    });
    
    // Filter medications that should be eligible for bulk creation
    const eligibleMedications = patientMedications.filter(med => 
      med.isActive === true && 
      med.hasReminders === true && 
      med.isPRN !== true
    );
    
    console.log('🔍 Step 4: Medications eligible for bulk schedule creation:', {
      totalMedications: patientMedications.length,
      eligibleCount: eligibleMedications.length,
      eligibleMedications: eligibleMedications.map(med => ({
        name: med.name,
        frequency: med.frequency,
        dosage: med.dosage,
        hasReminders: med.hasReminders,
        isActive: med.isActive,
        isPRN: med.isPRN
      }))
    });
    
    // Check which eligible medications already have schedules
    const medicationsWithoutSchedules = [];
    for (const med of eligibleMedications) {
      const existingSchedule = schedulesSnapshot.docs.find(doc => 
        doc.data().medicationId === med.id && doc.data().isActive === true
      );
      
      if (!existingSchedule) {
        medicationsWithoutSchedules.push(med);
      } else {
        console.log(`📅 Medication "${med.name}" already has schedule:`, existingSchedule.id);
      }
    }
    
    console.log('🔍 Step 5: Medications without schedules:', {
      count: medicationsWithoutSchedules.length,
      medications: medicationsWithoutSchedules.map(med => ({
        name: med.name,
        frequency: med.frequency,
        dosage: med.dosage
      }))
    });
    
    // Simulate the bulk creation logic to identify skip reasons
    console.log('🔍 Step 6: Simulating bulk creation logic...');
    
    const simulationResults = {
      processed: 0,
      wouldCreate: 0,
      wouldSkip: 0,
      skipReasons: []
    };
    
    for (const medication of medicationsWithoutSchedules) {
      simulationResults.processed++;
      
      console.log(`🔍 Simulating processing for "${medication.name}"`);
      
      // Check PRN status
      if (medication.isPRN) {
        console.log(`⏭️ Would skip: PRN medication`);
        simulationResults.wouldSkip++;
        simulationResults.skipReasons.push(`${medication.name}: PRN medication`);
        continue;
      }
      
      // Check frequency
      if (!medication.frequency || typeof medication.frequency !== 'string' || medication.frequency.trim() === '') {
        console.log(`⏭️ Would skip: Missing/invalid frequency`);
        simulationResults.wouldSkip++;
        simulationResults.skipReasons.push(`${medication.name}: Missing or invalid frequency`);
        continue;
      }
      
      // Check dosage
      if (!medication.dosage || typeof medication.dosage !== 'string' || medication.dosage.trim() === '') {
        console.log(`⏭️ Would skip: Missing/invalid dosage`);
        simulationResults.wouldSkip++;
        simulationResults.skipReasons.push(`${medication.name}: Missing or invalid dosage`);
        continue;
      }
      
      console.log(`✅ Would create schedule for "${medication.name}"`);
      simulationResults.wouldCreate++;
    }
    
    console.log('📊 Simulation results:', simulationResults);
    
    console.log('🔍 === INVESTIGATION COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Error in investigation:', error);
  }
}

// Run the investigation
investigateBulkScheduleCreation()
  .then(() => {
    console.log('✅ Investigation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });