/**
 * Test Script: Verify Medication Action Buttons and Default Times
 * 
 * This script tests:
 * 1. That pending medications exist and would show action buttons
 * 2. That new medications use correct default times (not 2AM)
 * 3. Database state after migration
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'claritystream-uldp9'
    });
}

const firestore = admin.firestore();

async function testMedicationActionButtons() {
    console.log('🧪 Testing Medication Action Buttons and Default Times...');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const results = {
        totalPatients: 0,
        patientsWithMedications: 0,
        totalMedicationEvents: 0,
        pendingEvents: 0,
        completedEvents: 0,
        eventsWithProblematicTimes: 0,
        patientPreferences: [],
        sampleEvents: []
    };
    
    try {
        // Step 1: Check patient preferences for default times
        console.log('🔍 Step 1: Checking patient medication preferences...');
        const preferencesQuery = await firestore.collection('patient_medication_preferences').get();
        results.totalPatients = preferencesQuery.docs.length;
        
        for (const doc of preferencesQuery.docs) {
            const data = doc.data();
            results.patientPreferences.push({
                patientId: data.patientId,
                workSchedule: data.workSchedule,
                timeSlots: data.timeSlots
            });
            
            console.log(`📊 Patient ${data.patientId} preferences:`, {
                workSchedule: data.workSchedule,
                morningDefault: data.timeSlots?.morning?.defaultTime,
                noonDefault: data.timeSlots?.noon?.defaultTime,
                eveningDefault: data.timeSlots?.evening?.defaultTime,
                bedtimeDefault: data.timeSlots?.bedtime?.defaultTime
            });
        }
        
        // Step 2: Check today's medication calendar events
        console.log('🔍 Step 2: Checking today\'s medication calendar events...');
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        const eventsQuery = await firestore.collection('medication_calendar_events')
            .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
            .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
            .get();
        
        results.totalMedicationEvents = eventsQuery.docs.length;
        
        for (const doc of eventsQuery.docs) {
            const data = doc.data();
            const scheduledTime = data.scheduledDateTime.toDate();
            const timeString = scheduledTime.toTimeString().slice(0, 5); // HH:MM format
            
            // Count by status
            if (data.status === 'scheduled' || data.status === 'pending') {
                results.pendingEvents++;
            } else if (['taken', 'missed', 'skipped'].includes(data.status)) {
                results.completedEvents++;
            }
            
            // Check for problematic 2AM times
            if (timeString === '02:00') {
                results.eventsWithProblematicTimes++;
                console.log(`❌ Found 2AM time in event:`, {
                    id: doc.id,
                    medicationName: data.medicationName,
                    scheduledTime: timeString,
                    status: data.status,
                    patientId: data.patientId
                });
            }
            
            // Collect sample events for analysis
            if (results.sampleEvents.length < 10) {
                results.sampleEvents.push({
                    id: doc.id,
                    medicationName: data.medicationName,
                    scheduledTime: timeString,
                    status: data.status,
                    patientId: data.patientId
                });
            }
        }
        
        // Step 3: Check medication schedules for default times
        console.log('🔍 Step 3: Checking medication schedules...');
        const schedulesQuery = await firestore.collection('medication_schedules')
            .where('isActive', '==', true)
            .get();
        
        let schedulesWithProblematicTimes = 0;
        
        for (const doc of schedulesQuery.docs) {
            const data = doc.data();
            const times = data.times || [];
            
            for (const time of times) {
                if (time === '02:00') {
                    schedulesWithProblematicTimes++;
                    console.log(`❌ Found 2AM time in schedule:`, {
                        scheduleId: doc.id,
                        medicationName: data.medicationName,
                        times: times,
                        patientId: data.patientId
                    });
                }
            }
        }
        
        // Step 4: Summary and recommendations
        console.log('📊 Test Results Summary:');
        console.log('='.repeat(50));
        console.log(`👥 Total patients: ${results.totalPatients}`);
        console.log(`💊 Total medication events today: ${results.totalMedicationEvents}`);
        console.log(`⏳ Pending events (should show action buttons): ${results.pendingEvents}`);
        console.log(`✅ Completed events (should show status icons only): ${results.completedEvents}`);
        console.log(`❌ Events with 2AM times: ${results.eventsWithProblematicTimes}`);
        console.log(`❌ Schedules with 2AM times: ${schedulesWithProblematicTimes}`);
        
        console.log('\n📋 Sample Events:');
        results.sampleEvents.forEach(event => {
            console.log(`  • ${event.medicationName} at ${event.scheduledTime} (${event.status})`);
        });
        
        console.log('\n🎯 Action Button Visibility Test:');
        if (results.pendingEvents > 0) {
            console.log(`✅ ${results.pendingEvents} pending medications should show action buttons (Take, Snooze, Skip)`);
        } else {
            console.log(`⚠️ No pending medications found - action buttons won't be visible`);
        }
        
        if (results.completedEvents > 0) {
            console.log(`✅ ${results.completedEvents} completed medications should show status icons only`);
        }
        
        console.log('\n🕐 Default Time Configuration Test:');
        if (results.eventsWithProblematicTimes === 0 && schedulesWithProblematicTimes === 0) {
            console.log('✅ No 2AM times found - migration was successful or not needed');
        } else {
            console.log(`❌ Found ${results.eventsWithProblematicTimes} events and ${schedulesWithProblematicTimes} schedules with 2AM times`);
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ Error in medication test:', error);
        throw error;
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    testMedicationActionButtons()
        .then((results) => {
            console.log('\n🎉 Medication Action Button Test completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testMedicationActionButtons };