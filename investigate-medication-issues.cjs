const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

async function investigateMedicationIssues() {
  console.log('🔍 === MEDICATION SYSTEM INVESTIGATION ===');
  console.log('Current time:', new Date().toISOString());
  
  try {
    // 1. Check for existing medications
    console.log('\n📊 Step 1: Checking existing medications...');
    const medicationsQuery = await firestore.collection('medications').limit(10).get();
    console.log(`Found ${medicationsQuery.docs.length} medications in the system`);
    
    if (medicationsQuery.docs.length > 0) {
      const sampleMed = medicationsQuery.docs[0];
      const medData = sampleMed.data();
      console.log('Sample medication:', {
        id: sampleMed.id,
        name: medData.name,
        frequency: medData.frequency,
        isActive: medData.isActive,
        patientId: medData.patientId,
        hasReminders: medData.hasReminders,
        reminderTimes: medData.reminderTimes
      });
      
      // 2. Check for medication schedules for this medication
      console.log('\n📅 Step 2: Checking medication schedules...');
      const schedulesQuery = await firestore.collection('medication_schedules')
        .where('medicationId', '==', sampleMed.id)
        .get();
      
      console.log(`Found ${schedulesQuery.docs.length} schedules for medication: ${medData.name}`);
      
      if (schedulesQuery.docs.length > 0) {
        const sampleSchedule = schedulesQuery.docs[0];
        const scheduleData = sampleSchedule.data();
        console.log('Sample schedule:', {
          id: sampleSchedule.id,
          frequency: scheduleData.frequency,
          times: scheduleData.times,
          isActive: scheduleData.isActive,
          isPaused: scheduleData.isPaused,
          generateCalendarEvents: scheduleData.generateCalendarEvents,
          startDate: scheduleData.startDate?.toDate()?.toISOString(),
          endDate: scheduleData.endDate?.toDate()?.toISOString()
        });
        
        // 3. Check for calendar events for this schedule
        console.log('\n📆 Step 3: Checking calendar events...');
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        const eventsQuery = await firestore.collection('medication_calendar_events')
          .where('medicationScheduleId', '==', sampleSchedule.id)
          .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
          .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
          .get();
        
        console.log(`Found ${eventsQuery.docs.length} calendar events for today`);
        
        if (eventsQuery.docs.length > 0) {
          eventsQuery.docs.forEach((doc, index) => {
            const eventData = doc.data();
            console.log(`Event ${index + 1}:`, {
              id: doc.id,
              medicationName: eventData.medicationName,
              scheduledDateTime: eventData.scheduledDateTime?.toDate()?.toISOString(),
              status: eventData.status,
              dosageAmount: eventData.dosageAmount
            });
          });
        } else {
          console.log('❌ NO CALENDAR EVENTS FOUND FOR TODAY!');
          
          // Check if there are any events at all for this schedule
          const allEventsQuery = await firestore.collection('medication_calendar_events')
            .where('medicationScheduleId', '==', sampleSchedule.id)
            .limit(5)
            .get();
          
          console.log(`Total events for this schedule: ${allEventsQuery.docs.length}`);
          
          if (allEventsQuery.docs.length > 0) {
            console.log('Sample events (any date):');
            allEventsQuery.docs.forEach((doc, index) => {
              const eventData = doc.data();
              console.log(`  Event ${index + 1}:`, {
                scheduledDateTime: eventData.scheduledDateTime?.toDate()?.toISOString(),
                status: eventData.status
              });
            });
          }
        }
      } else {
        console.log('❌ NO SCHEDULES FOUND FOR MEDICATION!');
        console.log('This explains why no today\'s events are showing up.');
      }
    } else {
      console.log('❌ NO MEDICATIONS FOUND IN SYSTEM!');
    }
    
    // 4. Check all medication schedules in the system
    console.log('\n📋 Step 4: Checking all medication schedules...');
    const allSchedulesQuery = await firestore.collection('medication_schedules').limit(10).get();
    console.log(`Total medication schedules in system: ${allSchedulesQuery.docs.length}`);
    
    if (allSchedulesQuery.docs.length > 0) {
      console.log('Sample schedules:');
      allSchedulesQuery.docs.forEach((doc, index) => {
        const scheduleData = doc.data();
        console.log(`  Schedule ${index + 1}:`, {
          id: doc.id,
          medicationName: scheduleData.medicationName,
          frequency: scheduleData.frequency,
          times: scheduleData.times,
          isActive: scheduleData.isActive,
          isPaused: scheduleData.isPaused,
          patientId: scheduleData.patientId
        });
      });
    }
    
    // 5. Check all calendar events for today across all patients
    console.log('\n📅 Step 5: Checking all today\'s calendar events...');
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const todaysEventsQuery = await firestore.collection('medication_calendar_events')
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .limit(10)
      .get();
    
    console.log(`Total calendar events for today: ${todaysEventsQuery.docs.length}`);
    
    if (todaysEventsQuery.docs.length > 0) {
      console.log('Today\'s events:');
      todaysEventsQuery.docs.forEach((doc, index) => {
        const eventData = doc.data();
        console.log(`  Event ${index + 1}:`, {
          id: doc.id,
          medicationName: eventData.medicationName,
          scheduledDateTime: eventData.scheduledDateTime?.toDate()?.toISOString(),
          status: eventData.status,
          patientId: eventData.patientId
        });
      });
    } else {
      console.log('❌ NO CALENDAR EVENTS FOR TODAY FOUND!');
    }
    
    // 6. Check patient medication preferences
    console.log('\n⚙️ Step 6: Checking patient medication preferences...');
    const preferencesQuery = await firestore.collection('patient_medication_preferences').limit(5).get();
    console.log(`Found ${preferencesQuery.docs.length} patient preference records`);
    
    if (preferencesQuery.docs.length > 0) {
      const samplePrefs = preferencesQuery.docs[0];
      const prefsData = samplePrefs.data();
      console.log('Sample preferences:', {
        patientId: prefsData.patientId,
        workSchedule: prefsData.workSchedule,
        timeSlots: prefsData.timeSlots
      });
    }
    
    console.log('\n🎯 === INVESTIGATION SUMMARY ===');
    console.log('Key findings:');
    console.log(`- Medications in system: ${medicationsQuery.docs.length}`);
    console.log(`- Medication schedules: ${allSchedulesQuery.docs.length}`);
    console.log(`- Today's calendar events: ${todaysEventsQuery.docs.length}`);
    console.log(`- Patient preferences: ${preferencesQuery.docs.length}`);
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Run the investigation
investigateMedicationIssues().then(() => {
  console.log('\n✅ Investigation completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});