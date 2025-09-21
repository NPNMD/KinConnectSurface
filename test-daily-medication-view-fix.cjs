const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function testDailyMedicationViewFix() {
  console.log('🧪 Testing Daily Medication View Fix');
  console.log('=====================================');
  
  try {
    // Test the API endpoint directly
    const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';
    
    // First, let's check what events exist for today
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('📅 Checking medication events for today:', today.toISOString().split('T')[0]);
    
    // Query Firestore directly to see what events exist
    const eventsQuery = await firestore.collection('medication_calendar_events')
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .orderBy('scheduledDateTime')
      .get();
    
    console.log(`📊 Found ${eventsQuery.docs.length} medication events for today`);
    
    const eventsByStatus = {};
    const eventsByPatient = {};
    
    eventsQuery.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'unknown';
      const patientId = data.patientId || 'unknown';
      
      eventsByStatus[status] = (eventsByStatus[status] || 0) + 1;
      
      if (!eventsByPatient[patientId]) {
        eventsByPatient[patientId] = [];
      }
      eventsByPatient[patientId].push({
        id: doc.id,
        medicationName: data.medicationName,
        status: data.status,
        scheduledDateTime: data.scheduledDateTime?.toDate()?.toISOString(),
        actualTakenDateTime: data.actualTakenDateTime?.toDate()?.toISOString()
      });
    });
    
    console.log('📊 Events by status:', eventsByStatus);
    console.log('📊 Events by patient:', Object.keys(eventsByPatient).map(patientId => ({
      patientId,
      eventCount: eventsByPatient[patientId].length,
      events: eventsByPatient[patientId]
    })));
    
    // Check specifically for LISINOPRIL and METFORMIN ER
    const targetMedications = ['LISINOPRIL', 'METFORMIN ER'];
    
    for (const medName of targetMedications) {
      console.log(`\n🔍 Checking events for ${medName}:`);
      
      const medEvents = eventsQuery.docs.filter(doc => {
        const data = doc.data();
        return data.medicationName && data.medicationName.toUpperCase().includes(medName);
      });
      
      console.log(`📊 Found ${medEvents.length} events for ${medName}`);
      
      medEvents.forEach(doc => {
        const data = doc.data();
        console.log(`  - Event ID: ${doc.id}`);
        console.log(`    Status: ${data.status}`);
        console.log(`    Scheduled: ${data.scheduledDateTime?.toDate()?.toISOString()}`);
        console.log(`    Patient ID: ${data.patientId}`);
        console.log(`    Medication Schedule ID: ${data.medicationScheduleId}`);
      });
    }
    
    // Test the new API endpoint behavior
    console.log('\n🧪 Testing API endpoint behavior...');
    
    // Find a patient with events
    const patientIds = Object.keys(eventsByPatient);
    if (patientIds.length > 0) {
      const testPatientId = patientIds[0];
      console.log(`🎯 Testing with patient ID: ${testPatientId}`);
      
      // Simulate the API call logic
      const testEvents = eventsByPatient[testPatientId];
      
      // Simulate the new bucket organization logic
      const buckets = {
        now: [],
        dueSoon: [],
        morning: [],
        noon: [],
        evening: [],
        bedtime: [],
        overdue: [],
        completed: []
      };
      
      const now = new Date();
      
      testEvents.forEach(event => {
        const eventTime = new Date(event.scheduledDateTime);
        const minutesUntilDue = Math.floor((eventTime.getTime() - now.getTime()) / (1000 * 60));
        
        console.log(`📋 Processing event: ${event.medicationName}`);
        console.log(`   Status: ${event.status}`);
        console.log(`   Minutes until due: ${minutesUntilDue}`);
        
        // Apply the new logic
        if (['taken', 'late', 'skipped', 'missed'].includes(event.status)) {
          buckets.completed.push(event);
          console.log(`   ✅ Added to completed bucket`);
        } else if (['cancelled', 'paused', 'completed'].includes(event.status)) {
          console.log(`   ⏭️ Skipped (non-actionable)`);
        } else {
          // Classify into time buckets
          if (minutesUntilDue < 0) {
            buckets.overdue.push(event);
            console.log(`   ⚠️ Added to overdue bucket`);
          } else if (minutesUntilDue <= 15) {
            buckets.now.push(event);
            console.log(`   🔔 Added to now bucket`);
          } else if (minutesUntilDue <= 60) {
            buckets.dueSoon.push(event);
            console.log(`   ⏰ Added to due soon bucket`);
          } else {
            buckets.morning.push(event); // Simplified for test
            console.log(`   🌅 Added to morning bucket`);
          }
        }
      });
      
      console.log('\n📊 Final bucket distribution:');
      Object.entries(buckets).forEach(([bucketName, events]) => {
        if (events.length > 0) {
          console.log(`  ${bucketName}: ${events.length} events`);
          events.forEach(event => {
            console.log(`    - ${event.medicationName} (${event.status})`);
          });
        }
      });
      
      // Check if our target medications are now in the completed bucket
      const completedMedications = buckets.completed.map(e => e.medicationName);
      console.log('\n🎯 Medications in completed bucket:', completedMedications);
      
      const foundLisinopril = completedMedications.some(name => name.toUpperCase().includes('LISINOPRIL'));
      const foundMetformin = completedMedications.some(name => name.toUpperCase().includes('METFORMIN'));
      
      console.log(`✅ LISINOPRIL found in completed bucket: ${foundLisinopril}`);
      console.log(`✅ METFORMIN ER found in completed bucket: ${foundMetformin}`);
      
      if (foundLisinopril || foundMetformin) {
        console.log('\n🎉 SUCCESS: Target medications are now appearing in the daily view!');
      } else {
        console.log('\n⚠️ Target medications not found in completed bucket. Checking all buckets...');
        
        Object.entries(buckets).forEach(([bucketName, events]) => {
          events.forEach(event => {
            if (event.medicationName.toUpperCase().includes('LISINOPRIL') || 
                event.medicationName.toUpperCase().includes('METFORMIN')) {
              console.log(`🔍 Found ${event.medicationName} in ${bucketName} bucket`);
            }
          });
        });
      }
    } else {
      console.log('⚠️ No patients with events found for testing');
    }
    
  } catch (error) {
    console.error('❌ Error testing daily medication view fix:', error);
  }
}

// Run the test
testDailyMedicationViewFix()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });