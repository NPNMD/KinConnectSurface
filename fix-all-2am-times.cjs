/**
 * Comprehensive 2AM Time Fix Script
 * 
 * This script fixes ALL 2AM times in the database, regardless of patient work schedule.
 * It updates both calendar events and schedules that have problematic 2AM times.
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

async function fixAll2AMTimes() {
    console.log('🔧 Starting Comprehensive 2AM Time Fix...');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const results = {
        eventsScanned: 0,
        eventsFixed: 0,
        schedulesScanned: 0,
        schedulesFixed: 0,
        errors: []
    };
    
    try {
        // Step 1: Fix calendar events with 2AM times
        console.log('🔍 Step 1: Scanning medication calendar events for 2AM times...');
        
        const eventsQuery = await firestore.collection('medication_calendar_events').get();
        results.eventsScanned = eventsQuery.docs.length;
        
        for (const doc of eventsQuery.docs) {
            const data = doc.data();
            const scheduledTime = data.scheduledDateTime?.toDate();
            
            if (scheduledTime) {
                const timeString = scheduledTime.toTimeString().slice(0, 5); // HH:MM format
                
                if (timeString === '02:00') {
                    console.log(`🔧 Fixing 2AM time in event: ${data.medicationName} for patient ${data.patientId}`);
                    
                    // Update to 7:00 AM (morning default)
                    const newDateTime = new Date(scheduledTime);
                    newDateTime.setHours(7, 0, 0, 0);
                    
                    await doc.ref.update({
                        scheduledDateTime: admin.firestore.Timestamp.fromDate(newDateTime),
                        updatedAt: admin.firestore.Timestamp.now(),
                        migrationFixedAt: admin.firestore.Timestamp.now(),
                        migrationReason: 'fix_all_2am_times_comprehensive',
                        originalScheduledTime: data.scheduledDateTime
                    });
                    
                    results.eventsFixed++;
                    console.log(`✅ Updated event from 02:00 to 07:00 for: ${data.medicationName}`);
                }
            }
        }
        
        // Step 2: Fix medication schedules with 2AM times
        console.log('🔍 Step 2: Scanning medication schedules for 2AM times...');
        
        const schedulesQuery = await firestore.collection('medication_schedules').get();
        results.schedulesScanned = schedulesQuery.docs.length;
        
        for (const doc of schedulesQuery.docs) {
            const data = doc.data();
            const times = data.times || [];
            let needsUpdate = false;
            const updatedTimes = [...times];
            
            for (let i = 0; i < updatedTimes.length; i++) {
                if (updatedTimes[i] === '02:00') {
                    updatedTimes[i] = '07:00'; // Change to 7:00 AM
                    needsUpdate = true;
                    console.log(`🔧 Updating schedule time from 02:00 to 07:00 for medication: ${data.medicationName}`);
                }
            }
            
            if (needsUpdate) {
                await doc.ref.update({
                    times: updatedTimes,
                    updatedAt: admin.firestore.Timestamp.now(),
                    migrationFixedAt: admin.firestore.Timestamp.now(),
                    migrationReason: 'fix_all_2am_times_comprehensive',
                    originalTimes: times
                });
                results.schedulesFixed++;
            }
        }
        
        console.log('✅ Comprehensive 2AM fix completed successfully!');
        console.log('📊 Final Results:', results);
        
        return results;
        
    } catch (error) {
        console.error('❌ Critical error in comprehensive 2AM fix:', error);
        results.errors.push(`Critical error: ${error.message}`);
        throw error;
    }
}

// Run the fix if this script is executed directly
if (require.main === module) {
    fixAll2AMTimes()
        .then((results) => {
            console.log('🎉 Comprehensive 2AM fix completed successfully!');
            console.log('📊 Summary:', {
                eventsScanned: results.eventsScanned,
                eventsFixed: results.eventsFixed,
                schedulesScanned: results.schedulesScanned,
                schedulesFixed: results.schedulesFixed,
                errorsCount: results.errors.length
            });
            
            if (results.errors.length > 0) {
                console.log('⚠️ Errors encountered:', results.errors);
            }
            
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Comprehensive 2AM fix failed:', error);
            process.exit(1);
        });
}

module.exports = { fixAll2AMTimes };