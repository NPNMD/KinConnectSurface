const admin = require('firebase-admin');
const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');

// Initialize Firebase Admin SDK with service account
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const firestore = admin.firestore();

async function investigateTodaysEvents() {
  try {
    console.log('🔍 Investigating today\'s medication events...');
    
    const userId = '3u7bMygdjIMdWEQxMZwW1DIw5zl1';
    
    // Get today's date range (same logic as dashboard)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('📅 Today\'s date range:');
    console.log('  Start:', startOfDay.toISOString());
    console.log('  End:', endOfDay.toISOString());
    console.log('  Current time:', now.toISOString());
    
    // Query for today's events (same as dashboard)
    const eventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', userId)
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();
    
    console.log(`\n📊 Found ${eventsQuery.docs.length} events for today`);
    
    const events = eventsQuery.docs.map(doc => {
      const data = doc.data();
      const scheduledTime = data.scheduledDateTime?.toDate();
      
      return {
        id: doc.id,
        medicationName: data.medicationName,
        dosageAmount: data.dosageAmount,
        scheduledDateTime: scheduledTime,
        status: data.status,
        medicationId: data.medicationId,
        medicationScheduleId: data.medicationScheduleId
      };
    });
    
    // Sort by scheduled time
    events.sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());
    
    console.log('\n📋 Today\'s events details:');
    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.medicationName} - ${event.dosageAmount}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Scheduled: ${event.scheduledDateTime.toLocaleString()}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   MedicationId: ${event.medicationId}`);
      console.log(`   ScheduleId: ${event.medicationScheduleId}`);
      console.log('');
    });
    
    // Check for events with same time but different dates
    console.log('🔍 Checking for events with same times on different dates...');
    
    const allEventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', userId)
      .get();
    
    const allEvents = allEventsQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        medicationName: data.medicationName,
        scheduledDateTime: data.scheduledDateTime?.toDate(),
        status: data.status
      };
    });
    
    // Group by time (ignoring date)
    const timeGroups = new Map();
    allEvents.forEach(event => {
      if (event.scheduledDateTime) {
        const timeKey = event.scheduledDateTime.toTimeString().split(' ')[0]; // HH:MM:SS
        if (!timeGroups.has(timeKey)) {
          timeGroups.set(timeKey, []);
        }
        timeGroups.get(timeKey).push(event);
      }
    });
    
    console.log('\n📊 Events grouped by time:');
    for (const [time, eventsAtTime] of timeGroups) {
      if (eventsAtTime.length > 1) {
        console.log(`\n⏰ Time ${time}: ${eventsAtTime.length} events`);
        eventsAtTime.forEach((event, index) => {
          console.log(`  ${index + 1}. ${event.medicationName} - ${event.scheduledDateTime.toLocaleDateString()} (${event.status}) [${event.id}]`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error investigating events:', error);
  }
}

// Run the investigation
console.log('🚀 Starting today\'s events investigation...');
investigateTodaysEvents()
  .then(() => {
    console.log('🏁 Investigation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });