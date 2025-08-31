// Test script to debug medication reminder creation flow
// Run this in the browser console to test the endpoints

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Helper function to get auth headers
async function getAuthHeaders() {
  try {
    // This assumes you're logged in and can get the token
    const token = await firebase.auth().currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  } catch (error) {
    console.error('Failed to get auth headers:', error);
    return {
      'Content-Type': 'application/json'
    };
  }
}

async function testMedicationReminderFlow() {
  console.log('🧪 Testing Medication Reminder Creation Flow...');

  try {
    const headers = await getAuthHeaders();

    // Step 1: Test GET medications
    console.log('📋 Step 1: Fetching medications...');
    const medicationsResponse = await fetch(`${API_BASE}/medications`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!medicationsResponse.ok) {
      console.error('❌ Failed to fetch medications:', medicationsResponse.status, medicationsResponse.statusText);
      return;
    }

    const medicationsResult = await medicationsResponse.json();
    console.log('✅ Medications fetched:', medicationsResult);

    if (!medicationsResult.success || !medicationsResult.data || medicationsResult.data.length === 0) {
      console.log('⚠️ No medications found. Please add a medication first.');
      return;
    }

    const latestMedication = medicationsResult.data[medicationsResult.data.length - 1];
    console.log('🎯 Using latest medication:', latestMedication);

    // Step 2: Test GET medication schedules for this medication
    console.log('📅 Step 2: Testing medication schedule endpoints...');
    const scheduleResponse = await fetch(`${API_BASE}/medication-calendar/schedules/medication/${latestMedication.id}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    console.log('📅 Schedule response status:', scheduleResponse.status);
    if (scheduleResponse.ok) {
      const scheduleResult = await scheduleResponse.json();
      console.log('✅ Medication schedules fetched:', scheduleResult);
    } else {
      console.error('❌ Failed to fetch medication schedules');
    }

    // Step 3: Test creating a medication schedule
    console.log('📝 Step 3: Testing medication schedule creation...');
    const testSchedule = {
      medicationId: latestMedication.id,
      patientId: latestMedication.patientId,
      frequency: 'daily',
      times: ['08:00', '20:00'],
      dosageAmount: '1 tablet',
      startDate: new Date().toISOString().split('T')[0],
      isIndefinite: true,
      generateCalendarEvents: true,
      reminderMinutesBefore: [15, 5],
      isActive: true
    };

    const createScheduleResponse = await fetch(`${API_BASE}/medication-calendar/schedules`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(testSchedule)
    });

    console.log('📝 Create schedule response status:', createScheduleResponse.status);
    if (createScheduleResponse.ok) {
      const createResult = await createScheduleResponse.json();
      console.log('✅ Medication schedule created:', createResult);

      if (createResult.success && createResult.data) {
        const scheduleId = createResult.data.id;
        console.log('🎯 Created schedule ID:', scheduleId);

        // Step 4: Test medication reminder creation
        console.log('🔔 Step 4: Testing medication reminder creation...');
        const reminderData = {
          medicationId: latestMedication.id,
          reminderTimes: ['15', '5'],
          notificationMethods: ['browser'],
          isActive: true
        };

        const reminderResponse = await fetch(`${API_BASE}/medication-reminders`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(reminderData)
        });

        console.log('🔔 Reminder response status:', reminderResponse.status);
        if (reminderResponse.ok) {
          const reminderResult = await reminderResponse.json();
          console.log('✅ Medication reminder created:', reminderResult);
        } else {
          const errorText = await reminderResponse.text();
          console.error('❌ Failed to create medication reminder:', errorText);
        }

        // Step 5: Test medication calendar events
        console.log('📊 Step 5: Testing medication calendar events...');
        const eventsResponse = await fetch(`${API_BASE}/medication-calendar/events?medicationId=${latestMedication.id}`, {
          method: 'GET',
          headers,
          credentials: 'include'
        });

        console.log('📊 Events response status:', eventsResponse.status);
        if (eventsResponse.ok) {
          const eventsResult = await eventsResponse.json();
          console.log('✅ Medication calendar events fetched:', eventsResult);
        } else {
          console.error('❌ Failed to fetch medication calendar events');
        }
      }
    } else {
      const errorText = await createScheduleResponse.text();
      console.error('❌ Failed to create medication schedule:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Make the function available globally
window.testMedicationReminderFlow = testMedicationReminderFlow;

console.log('🎯 Run testMedicationReminderFlow() in the console to test the medication reminder flow');
