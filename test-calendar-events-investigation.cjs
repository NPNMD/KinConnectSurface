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

async function investigateCalendarEvents() {
  try {
    console.log('🔍 === CALENDAR EVENTS INVESTIGATION ===');
    
    const patientId = '3u7bMygdjIMdWEQxMZwW1DIw5zl1';
    const lisinoprilScheduleId = 'oVasV7PLwmpsUd0lhnWi';
    const metforminScheduleId = 'uW4s0yyCxhBxfDVy0DPP';
    
    console.log('🎯 Investigating calendar events for existing schedules...');
    
    // Check today's date range
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('📅 Today\'s date range:', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });
    
    // 1. Check calendar events for LISINOPRIL schedule
    console.log('\n🔍 Step 1: Checking LISINOPRIL calendar events...');
    const lisinoprilEventsQuery = await firestore.collection('medication_calendar_events')
      .where('medicationScheduleId', '==', lisinoprilScheduleId)
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();
    
    console.log(`LISINOPRIL events for today: ${lisinoprilEventsQuery.docs.length}`);
    
    if (lisinoprilEventsQuery.docs.length === 0) {
      // Check if there are ANY events for this schedule
      const allLisinoprilEventsQuery = await firestore.collection('medication_calendar_events')
        .where('medicationScheduleId', '==', lisinoprilScheduleId)
        .limit(5)
        .get();
      
      console.log(`LISINOPRIL total events: ${allLisinoprilEventsQuery.docs.length}`);
      
      if (allLisinoprilEventsQuery.docs.length > 0) {
        console.log('Sample LISINOPRIL events:');
        allLisinoprilEventsQuery.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`  Event ${index + 1}:`, {
            id: doc.id,
            scheduledDateTime: data.scheduledDateTime?.toDate()?.toISOString(),
            status: data.status,
            medicationName: data.medicationName
          });
        });
      } else {
        console.log('❌ NO CALENDAR EVENTS EXIST FOR LISINOPRIL SCHEDULE!');
      }
    }
    
    // 2. Check calendar events for METFORMIN schedule
    console.log('\n🔍 Step 2: Checking METFORMIN calendar events...');
    const metforminEventsQuery = await firestore.collection('medication_calendar_events')
      .where('medicationScheduleId', '==', metforminScheduleId)
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();
    
    console.log(`METFORMIN events for today: ${metforminEventsQuery.docs.length}`);
    
    if (metforminEventsQuery.docs.length === 0) {
      // Check if there are ANY events for this schedule
      const allMetforminEventsQuery = await firestore.collection('medication_calendar_events')
        .where('medicationScheduleId', '==', metforminScheduleId)
        .limit(5)
        .get();
      
      console.log(`METFORMIN total events: ${allMetforminEventsQuery.docs.length}`);
      
      if (allMetforminEventsQuery.docs.length > 0) {
        console.log('Sample METFORMIN events:');
        allMetforminEventsQuery.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`  Event ${index + 1}:`, {
            id: doc.id,
            scheduledDateTime: data.scheduledDateTime?.toDate()?.toISOString(),
            status: data.status,
            medicationName: data.medicationName
          });
        });
      } else {
        console.log('❌ NO CALENDAR EVENTS EXIST FOR METFORMIN SCHEDULE!');
      }
    }
    
    // 3. Check all calendar events for this patient today
    console.log('\n🔍 Step 3: Checking ALL calendar events for patient today...');
    const allTodayEventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', patientId)
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();
    
    console.log(`Total events for patient today: ${allTodayEventsQuery.docs.length}`);
    
    if (allTodayEventsQuery.docs.length > 0) {
      console.log('All today\'s events:');
      allTodayEventsQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  Event ${index + 1}:`, {
          id: doc.id,
          medicationName: data.medicationName,
          medicationScheduleId: data.medicationScheduleId,
          scheduledDateTime: data.scheduledDateTime?.toDate()?.toISOString(),
          status: data.status
        });
      });
    } else {
      console.log('❌ NO CALENDAR EVENTS FOR PATIENT TODAY!');
    }
    
    // 4. Check schedule details to see if generateCalendarEvents is enabled
    console.log('\n🔍 Step 4: Checking schedule configurations...');
    
    const lisinoprilScheduleDoc = await firestore.collection('medication_schedules').doc(lisinoprilScheduleId).get();
    const metforminScheduleDoc = await firestore.collection('medication_schedules').doc(metforminScheduleId).get();
    
    if (lisinoprilScheduleDoc.exists) {
      const scheduleData = lisinoprilScheduleDoc.data();
      console.log('LISINOPRIL schedule details:', {
        id: lisinoprilScheduleId,
        frequency: scheduleData.frequency,
        times: scheduleData.times,
        generateCalendarEvents: scheduleData.generateCalendarEvents,
        isActive: scheduleData.isActive,
        isPaused: scheduleData.isPaused,
        startDate: scheduleData.startDate?.toDate()?.toISOString(),
        endDate: scheduleData.endDate?.toDate()?.toISOString(),
        isIndefinite: scheduleData.isIndefinite
      });
    }
    
    if (metforminScheduleDoc.exists) {
      const scheduleData = metforminScheduleDoc.data();
      console.log('METFORMIN schedule details:', {
        id: metforminScheduleId,
        frequency: scheduleData.frequency,
        times: scheduleData.times,
        generateCalendarEvents: scheduleData.generateCalendarEvents,
        isActive: scheduleData.isActive,
        isPaused: scheduleData.isPaused,
        startDate: scheduleData.startDate?.toDate()?.toISOString(),
        endDate: scheduleData.endDate?.toDate()?.toISOString(),
        isIndefinite: scheduleData.isIndefinite
      });
    }
    
    console.log('\n🎯 === DIAGNOSIS ===');
    console.log('The medications are being skipped because they ALREADY HAVE SCHEDULES.');
    console.log('The real issue is likely that calendar events are not being generated for these schedules.');
    console.log('This explains why they don\'t appear in the daily medication view.');
    
  } catch (error) {
    console.error('❌ Error in calendar events investigation:', error);
  }
}

// Run the investigation
investigateCalendarEvents()
  .then(() => {
    console.log('✅ Calendar events investigation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });