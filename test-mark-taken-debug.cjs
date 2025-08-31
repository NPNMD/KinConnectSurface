const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function testMarkMedicationTaken() {
  try {
    console.log('🔍 Testing mark medication taken endpoint...');
    
    // First, let's find an existing medication calendar event
    const eventsQuery = await firestore.collection('medication_calendar_events')
      .where('status', '==', 'scheduled')
      .limit(1)
      .get();
    
    if (eventsQuery.empty) {
      console.log('❌ No scheduled medication events found');
      return;
    }
    
    const eventDoc = eventsQuery.docs[0];
    const eventData = eventDoc.data();
    
    console.log('📋 Found event:', {
      id: eventDoc.id,
      medicationName: eventData.medicationName,
      patientId: eventData.patientId,
      scheduledDateTime: eventData.scheduledDateTime?.toDate(),
      status: eventData.status
    });
    
    // Test the API endpoint
    const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';
    
    // Get an auth token (you'll need to replace this with a valid token)
    console.log('⚠️ Note: You need to get a valid Firebase auth token to test this endpoint');
    console.log('🔗 Test URL:', `${API_BASE}/medication-calendar/events/${eventDoc.id}/taken`);
    
    // Let's also check the event structure to see if there are any issues
    console.log('📊 Event data structure:');
    console.log(JSON.stringify(eventData, null, 2));
    
    // Check if the patient exists
    if (eventData.patientId) {
      const patientDoc = await firestore.collection('users').doc(eventData.patientId).get();
      if (patientDoc.exists) {
        console.log('✅ Patient exists:', patientDoc.data()?.name || 'Unknown');
      } else {
        console.log('❌ Patient not found:', eventData.patientId);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing mark medication taken:', error);
  }
}

testMarkMedicationTaken();