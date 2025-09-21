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

async function simpleCalendarInvestigation() {
  try {
    console.log('🔍 === SIMPLE CALENDAR INVESTIGATION ===');
    
    const patientId = '3u7bMygdjIMdWEQxMZwW1DIw5zl1';
    const lisinoprilScheduleId = 'oVasV7PLwmpsUd0lhnWi';
    const metforminScheduleId = 'uW4s0yyCxhBxfDVy0DPP';
    
    // 1. Check schedule details
    console.log('\n🔍 Step 1: Checking schedule configurations...');
    
    const lisinoprilScheduleDoc = await firestore.collection('medication_schedules').doc(lisinoprilScheduleId).get();
    const metforminScheduleDoc = await firestore.collection('medication_schedules').doc(metforminScheduleId).get();
    
    if (lisinoprilScheduleDoc.exists) {
      const scheduleData = lisinoprilScheduleDoc.data();
      console.log('LISINOPRIL schedule details:', {
        id: lisinoprilScheduleId,
        medicationId: scheduleData.medicationId,
        medicationName: scheduleData.medicationName,
        frequency: scheduleData.frequency,
        times: scheduleData.times,
        generateCalendarEvents: scheduleData.generateCalendarEvents,
        isActive: scheduleData.isActive,
        isPaused: scheduleData.isPaused,
        startDate: scheduleData.startDate?.toDate()?.toISOString(),
        endDate: scheduleData.endDate?.toDate()?.toISOString(),
        isIndefinite: scheduleData.isIndefinite,
        autoCreated: scheduleData.autoCreated,
        autoCreatedReason: scheduleData.autoCreatedReason
      });
    }
    
    if (metforminScheduleDoc.exists) {
      const scheduleData = metforminScheduleDoc.data();
      console.log('METFORMIN schedule details:', {
        id: metforminScheduleId,
        medicationId: scheduleData.medicationId,
        medicationName: scheduleData.medicationName,
        frequency: scheduleData.frequency,
        times: scheduleData.times,
        generateCalendarEvents: scheduleData.generateCalendarEvents,
        isActive: scheduleData.isActive,
        isPaused: scheduleData.isPaused,
        startDate: scheduleData.startDate?.toDate()?.toISOString(),
        endDate: scheduleData.endDate?.toDate()?.toISOString(),
        isIndefinite: scheduleData.isIndefinite,
        autoCreated: scheduleData.autoCreated,
        autoCreatedReason: scheduleData.autoCreatedReason
      });
    }
    
    // 2. Check for ANY calendar events for these schedules (without date filter)
    console.log('\n🔍 Step 2: Checking for ANY calendar events...');
    
    const lisinoprilEventsQuery = await firestore.collection('medication_calendar_events')
      .where('medicationScheduleId', '==', lisinoprilScheduleId)
      .limit(5)
      .get();
    
    console.log(`LISINOPRIL total events: ${lisinoprilEventsQuery.docs.length}`);
    
    if (lisinoprilEventsQuery.docs.length > 0) {
      console.log('LISINOPRIL events:');
      lisinoprilEventsQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  Event ${index + 1}:`, {
          id: doc.id,
          scheduledDateTime: data.scheduledDateTime?.toDate()?.toISOString(),
          status: data.status,
          medicationName: data.medicationName
        });
      });
    } else {
      console.log('❌ NO CALENDAR EVENTS FOR LISINOPRIL SCHEDULE!');
    }
    
    const metforminEventsQuery = await firestore.collection('medication_calendar_events')
      .where('medicationScheduleId', '==', metforminScheduleId)
      .limit(5)
      .get();
    
    console.log(`METFORMIN total events: ${metforminEventsQuery.docs.length}`);
    
    if (metforminEventsQuery.docs.length > 0) {
      console.log('METFORMIN events:');
      metforminEventsQuery.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  Event ${index + 1}:`, {
          id: doc.id,
          scheduledDateTime: data.scheduledDateTime?.toDate()?.toISOString(),
          status: data.status,
          medicationName: data.medicationName
        });
      });
    } else {
      console.log('❌ NO CALENDAR EVENTS FOR METFORMIN SCHEDULE!');
    }
    
    // 3. Check all calendar events for this patient (without date filter)
    console.log('\n🔍 Step 3: Checking ALL calendar events for patient...');
    const allPatientEventsQuery = await firestore.collection('medication_calendar_events')
      .where('patientId', '==', patientId)
      .limit(10)
      .get();
    
    console.log(`Total events for patient: ${allPatientEventsQuery.docs.length}`);
    
    if (allPatientEventsQuery.docs.length > 0) {
      console.log('Patient events:');
      allPatientEventsQuery.docs.forEach((doc, index) => {
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
      console.log('❌ NO CALENDAR EVENTS FOR PATIENT AT ALL!');
    }
    
    console.log('\n🎯 === DIAGNOSIS ===');
    
    if (lisinoprilEventsQuery.docs.length === 0 && metforminEventsQuery.docs.length === 0) {
      console.log('🚨 ROOT CAUSE IDENTIFIED:');
      console.log('The medications have schedules but NO CALENDAR EVENTS are being generated!');
      console.log('This is why they don\'t appear in the daily medication view.');
      console.log('');
      console.log('SOLUTION NEEDED:');
      console.log('1. Check if generateCalendarEvents is enabled on the schedules');
      console.log('2. Manually trigger calendar event generation for existing schedules');
      console.log('3. Fix the calendar event generation logic');
    } else {
      console.log('Calendar events exist - the issue might be with the daily view query or time bucket logic.');
    }
    
  } catch (error) {
    console.error('❌ Error in simple calendar investigation:', error);
  }
}

// Run the investigation
simpleCalendarInvestigation()
  .then(() => {
    console.log('✅ Simple calendar investigation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });