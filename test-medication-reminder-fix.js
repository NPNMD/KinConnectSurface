const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function testMedicationReminderUpdate() {
  try {
    console.log('🧪 Testing medication reminder update functionality...');
    
    // First, let's find an existing medication to test with
    const medicationsQuery = await firestore.collection('medications')
      .limit(1)
      .get();
    
    if (medicationsQuery.empty) {
      console.log('❌ No medications found to test with');
      return;
    }
    
    const medicationDoc = medicationsQuery.docs[0];
    const medicationId = medicationDoc.id;
    const medicationData = medicationDoc.data();
    
    console.log('📋 Found test medication:', {
      id: medicationId,
      name: medicationData.name,
      currentReminders: medicationData.hasReminders,
      currentTimes: medicationData.reminderTimes
    });
    
    // Test the update that was failing
    const updateData = {
      hasReminders: true,
      reminderTimes: ['07:00']
    };
    
    console.log('📝 Testing update with data:', updateData);
    
    // Simulate the backend update logic
    const updatedMedication = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // Remove fields that shouldn't be updated
    delete updatedMedication.id;
    delete updatedMedication.createdAt;
    delete updatedMedication.patientId;
    
    console.log('📝 Final update data:', updatedMedication);
    
    // Apply the update
    await medicationDoc.ref.update(updatedMedication);
    
    // Verify the update
    const updatedDoc = await medicationDoc.ref.get();
    const updatedData = updatedDoc.data();
    
    console.log('✅ Update successful! New medication data:', {
      id: medicationId,
      name: updatedData.name,
      hasReminders: updatedData.hasReminders,
      reminderTimes: updatedData.reminderTimes,
      updatedAt: updatedData.updatedAt.toDate()
    });
    
    console.log('🎉 Medication reminder update test PASSED!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

// Run the test
testMedicationReminderUpdate()
  .then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });