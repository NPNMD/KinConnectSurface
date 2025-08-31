const fetch = require('node-fetch');

const API_BASE = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Test token - you'll need to replace this with a valid token
const TEST_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjkyZTg4M2NjNDY3YWI4ZGY4ZGY4NzNkNzU2MzI2ZGE2NzAzNzM5YzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vY2xhcml0eXN0cmVhbS11bGRwOSIsImF1ZCI6ImNsYXJpdHlzdHJlYW0tdWxkcDkiLCJhdXRoX3RpbWUiOjE3MjUwNTc5OTIsInVzZXJfaWQiOiIzdTdiTXlnZGpJTWRXRVF4TVp3VzFESXc1emwxIiwic3ViIjoiM3U3Yk15Z2RqSU1kV0VReE1ad1cxREl3NXpsMSIsImlhdCI6MTcyNTA1Nzk5MiwiZXhwIjoxNzI1MDYxNTkyLCJlbWFpbCI6Im5hdGhhbnBrbmd1eWVuQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7Imdvb2dsZS5jb20iOlsiMTA0NzE5NzE5NzE5NzE5NzE5NzE5Il0sImVtYWlsIjpbIm5hdGhhbnBrbmd1eWVuQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.rxYt4_iBP05LSccLUX9qnTpjQKEUSgxPLJgwx4xVrpUYYZD3g';

async function testMedicationSchedule() {
    try {
        console.log('🧪 Testing medication schedule functionality...');
        
        // 1. First, get existing medications
        console.log('\n📋 Step 1: Getting existing medications...');
        const medicationsResponse = await fetch(`${API_BASE}/medications`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const medicationsResult = await medicationsResponse.json();
        console.log('Medications result:', medicationsResult);
        
        if (!medicationsResult.success || !medicationsResult.data || medicationsResult.data.length === 0) {
            console.log('❌ No medications found. Please add a medication first.');
            return;
        }
        
        const testMedication = medicationsResult.data[0];
        console.log('✅ Using test medication:', testMedication.name, 'ID:', testMedication.id);
        
        // 2. Check existing schedules for this medication
        console.log('\n📅 Step 2: Checking existing schedules...');
        const existingSchedulesResponse = await fetch(`${API_BASE}/medication-calendar/schedules/medication/${testMedication.id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const existingSchedulesResult = await existingSchedulesResponse.json();
        console.log('Existing schedules:', existingSchedulesResult);
        
        // 3. Check existing calendar events for today
        console.log('\n📅 Step 3: Checking today\'s calendar events...');
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        const eventsResponse = await fetch(`${API_BASE}/medication-calendar/events?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const eventsResult = await eventsResponse.json();
        console.log('Today\'s events:', eventsResult);
        
        // 4. If no events exist, create a new schedule to test
        if (!eventsResult.data || eventsResult.data.length === 0) {
            console.log('\n🆕 Step 4: Creating new test schedule...');
            
            const scheduleData = {
                medicationId: testMedication.id,
                patientId: '3u7bMygdjIMdWEQxMZwW1DIw5zl1',
                frequency: 'twice_daily',
                times: ['08:00', '20:00'],
                startDate: today.toISOString().split('T')[0],
                isIndefinite: true,
                dosageAmount: testMedication.dosage || '1 tablet',
                instructions: 'Test schedule',
                generateCalendarEvents: true,
                reminderMinutesBefore: [15, 5],
                isActive: true
            };
            
            console.log('Creating schedule with data:', scheduleData);
            
            const createResponse = await fetch(`${API_BASE}/medication-calendar/schedules`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scheduleData)
            });
            
            const createResult = await createResponse.json();
            console.log('Create schedule result:', createResult);
            
            if (createResult.success) {
                console.log('✅ Schedule created successfully!');
                
                // Wait a moment then check for generated events
                console.log('\n⏳ Waiting 3 seconds for events to be generated...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Check for new events
                const newEventsResponse = await fetch(`${API_BASE}/medication-calendar/events?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${TEST_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const newEventsResult = await newEventsResponse.json();
                console.log('New events after schedule creation:', newEventsResult);
                
                if (newEventsResult.success && newEventsResult.data && newEventsResult.data.length > 0) {
                    console.log('✅ Calendar events generated successfully!');
                    console.log(`📅 Found ${newEventsResult.data.length} events for today`);
                } else {
                    console.log('❌ No calendar events were generated');
                }
            } else {
                console.log('❌ Failed to create schedule:', createResult.error);
            }
        } else {
            console.log('✅ Events already exist for today:', eventsResult.data.length);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testMedicationSchedule();