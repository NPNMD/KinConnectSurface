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

async function checkTodaysEvents() {
  try {
    console.log('🔍 === TODAY\'S EVENTS CHECK ===');
    
    const patientId = '3u7bMygdjIMdWEQxMZwW1DIw5zl1';
    
    // Get today's date in the user's timezone (America/Chicago, UTC-5)
    const now = new Date();
    console.log('Current UTC time:', now.toISOString());
    
    // Convert to Chicago timezone
    const chicagoTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"}));
    console.log('Current Chicago time:', chicagoTime.toISOString());
    
    // Use Chicago time for today's range
    const startOfDay = new Date(chicagoTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(chicagoTime);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Today\'s range (Chicago timezone):', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });
    
    // Check all events for this patient to see what dates we have
    console.log('\n🔍 Checking all patient events to see date distribution...');
    const allEventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', patientId)
      .get();
    
    console.log(`Total events for patient: ${allEventsQuery.docs.length}`);
    
    const eventsByDate = {};
    const todaysEvents = [];
    
    allEventsQuery.docs.forEach(doc => {
      const data = doc.data();
      const eventDate = data.scheduledDateTime?.toDate();
      if (eventDate) {
        const dateStr = eventDate.toISOString().split('T')[0];
        if (!eventsByDate[dateStr]) {
          eventsByDate[dateStr] = [];
        }
        eventsByDate[dateStr].push({
          id: doc.id,
          medicationName: data.medicationName,
          time: eventDate.toISOString(),
          status: data.status
        });
        
        // Check if this event is for today
        if (eventDate >= startOfDay && eventDate <= endOfDay) {
          todaysEvents.push({
            id: doc.id,
            medicationName: data.medicationName,
            scheduledDateTime: eventDate.toISOString(),
            status: data.status,
            medicationScheduleId: data.medicationScheduleId
          });
        }
      }
    });
    
    console.log('\nEvents by date:');
    Object.keys(eventsByDate).sort().forEach(date => {
      console.log(`  ${date}: ${eventsByDate[date].length} events`);
      eventsByDate[date].forEach(event => {
        console.log(`    - ${event.medicationName} at ${event.time} (${event.status})`);
      });
    });
    
    console.log(`\n🎯 TODAY'S EVENTS (${chicagoTime.toISOString().split('T')[0]}): ${todaysEvents.length}`);
    
    if (todaysEvents.length > 0) {
      todaysEvents.forEach((event, index) => {
        console.log(`  Event ${index + 1}:`, {
          medicationName: event.medicationName,
          scheduledDateTime: event.scheduledDateTime,
          status: event.status,
          scheduleId: event.medicationScheduleId
        });
      });
    } else {
      console.log('❌ NO EVENTS FOR TODAY!');
      console.log('This explains why medications don\'t appear in the daily view.');
      
      // Check if there are events for tomorrow or yesterday
      const tomorrow = new Date(chicagoTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const yesterday = new Date(chicagoTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      console.log(`Events for yesterday (${yesterdayStr}):`, eventsByDate[yesterdayStr]?.length || 0);
      console.log(`Events for tomorrow (${tomorrowStr}):`, eventsByDate[tomorrowStr]?.length || 0);
    }
    
    console.log('\n🎯 === FINAL DIAGNOSIS ===');
    if (todaysEvents.length === 0) {
      console.log('🚨 ROOT CAUSE: NO CALENDAR EVENTS FOR TODAY');
      console.log('The schedules exist but calendar events are not being generated for today\'s date.');
      console.log('This is why the medications don\'t appear in the daily medication view.');
      console.log('');
      console.log('SOLUTION: Need to trigger calendar event generation for today\'s date.');
    } else {
      console.log('Calendar events exist for today - the issue is elsewhere in the daily view logic.');
    }
    
  } catch (error) {
    console.error('❌ Error checking today\'s events:', error);
  }
}

// Run the check
checkTodaysEvents()
  .then(() => {
    console.log('✅ Today\'s events check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });