/**
 * Cleanup Test Medications
 * 
 * This script removes all test medications that were created during testing.
 * It targets medications with isTestData: true or medication names starting with "Test".
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

async function cleanupTestMedications() {
    console.log('🧹 Starting Test Medication Cleanup...');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const results = {
        eventsDeleted: 0,
        medicationsDeleted: 0,
        errors: []
    };
    
    try {
        // 1. Clean up medication_calendar_events with test data
        console.log('\n🔍 Searching for test medication events...');
        
        // Query for events marked as test data
        const testEventsQuery = await firestore.collection('medication_calendar_events')
            .where('isTestData', '==', true)
            .get();
        
        console.log(`Found ${testEventsQuery.size} events marked as test data`);
        
        // Also query for events with medication names starting with "Test"
        const testNameEventsQuery = await firestore.collection('medication_calendar_events').get();
        const testNameEvents = testNameEventsQuery.docs.filter(doc => {
            const data = doc.data();
            return data.medicationName && data.medicationName.startsWith('Test');
        });
        
        console.log(`Found ${testNameEvents.length} events with test medication names`);
        
        // Combine and deduplicate
        const allTestEventIds = new Set();
        testEventsQuery.docs.forEach(doc => allTestEventIds.add(doc.id));
        testNameEvents.forEach(doc => allTestEventIds.add(doc.id));
        
        console.log(`Total unique test events to delete: ${allTestEventIds.size}`);
        
        // Delete test events
        for (const eventId of allTestEventIds) {
            try {
                await firestore.collection('medication_calendar_events').doc(eventId).delete();
                results.eventsDeleted++;
                console.log(`✅ Deleted test event: ${eventId}`);
            } catch (error) {
                console.error(`❌ Error deleting event ${eventId}:`, error.message);
                results.errors.push(`Event ${eventId}: ${error.message}`);
            }
        }
        
        // 2. Clean up any test medications from medications collection
        console.log('\n🔍 Searching for test medications...');
        
        const medicationsQuery = await firestore.collection('medications').get();
        const testMedications = medicationsQuery.docs.filter(doc => {
            const data = doc.data();
            return (data.isTestData === true) || 
                   (data.name && data.name.startsWith('Test')) ||
                   (data.medicationName && data.medicationName.startsWith('Test'));
        });
        
        console.log(`Found ${testMedications.length} test medications`);
        
        // Delete test medications
        for (const medicationDoc of testMedications) {
            try {
                await medicationDoc.ref.delete();
                results.medicationsDeleted++;
                const data = medicationDoc.data();
                console.log(`✅ Deleted test medication: ${data.name || data.medicationName || medicationDoc.id}`);
            } catch (error) {
                console.error(`❌ Error deleting medication ${medicationDoc.id}:`, error.message);
                results.errors.push(`Medication ${medicationDoc.id}: ${error.message}`);
            }
        }
        
        // 3. Clean up any test medication schedules
        console.log('\n🔍 Searching for test medication schedules...');
        
        const schedulesQuery = await firestore.collection('medication_schedules').get();
        const testSchedules = schedulesQuery.docs.filter(doc => {
            const data = doc.data();
            return (data.isTestData === true) || 
                   (data.medicationName && data.medicationName.startsWith('Test'));
        });
        
        console.log(`Found ${testSchedules.length} test medication schedules`);
        
        // Delete test schedules
        for (const scheduleDoc of testSchedules) {
            try {
                await scheduleDoc.ref.delete();
                results.schedulesDeleted = (results.schedulesDeleted || 0) + 1;
                const data = scheduleDoc.data();
                console.log(`✅ Deleted test schedule: ${data.medicationName || scheduleDoc.id}`);
            } catch (error) {
                console.error(`❌ Error deleting schedule ${scheduleDoc.id}:`, error.message);
                results.errors.push(`Schedule ${scheduleDoc.id}: ${error.message}`);
            }
        }
        
        console.log('\n✅ Test medication cleanup completed!');
        console.log('📊 Results:', results);
        
        return results;
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        results.errors.push(`Cleanup error: ${error.message}`);
        throw error;
    }
}

async function verifyCleanup() {
    console.log('\n🔍 Verifying cleanup...');
    
    try {
        // Check for remaining test events
        const remainingTestEvents = await firestore.collection('medication_calendar_events')
            .where('isTestData', '==', true)
            .get();
        
        const remainingTestNameEvents = await firestore.collection('medication_calendar_events').get();
        const testNameEvents = remainingTestNameEvents.docs.filter(doc => {
            const data = doc.data();
            return data.medicationName && data.medicationName.startsWith('Test');
        });
        
        // Check for remaining test medications
        const remainingMedications = await firestore.collection('medications').get();
        const testMedications = remainingMedications.docs.filter(doc => {
            const data = doc.data();
            return (data.isTestData === true) || 
                   (data.name && data.name.startsWith('Test')) ||
                   (data.medicationName && data.medicationName.startsWith('Test'));
        });
        
        // Check for remaining test schedules
        const remainingSchedules = await firestore.collection('medication_schedules').get();
        const testSchedules = remainingSchedules.docs.filter(doc => {
            const data = doc.data();
            return (data.isTestData === true) || 
                   (data.medicationName && data.medicationName.startsWith('Test'));
        });
        
        console.log('\n📊 Verification Results:');
        console.log(`- Test events remaining: ${remainingTestEvents.size + testNameEvents.length}`);
        console.log(`- Test medications remaining: ${testMedications.length}`);
        console.log(`- Test schedules remaining: ${testSchedules.length}`);
        
        const isClean = (remainingTestEvents.size + testNameEvents.length + testMedications.length + testSchedules.length) === 0;
        
        if (isClean) {
            console.log('✅ Database is clean - no test data remaining!');
        } else {
            console.log('⚠️ Some test data may still remain');
            if (testNameEvents.length > 0) {
                console.log('Remaining test name events:', testNameEvents.map(doc => doc.data().medicationName));
            }
            if (testMedications.length > 0) {
                console.log('Remaining test medications:', testMedications.map(doc => doc.data().name || doc.data().medicationName));
            }
            if (testSchedules.length > 0) {
                console.log('Remaining test schedules:', testSchedules.map(doc => doc.data().medicationName));
            }
        }
        
        return isClean;
        
    } catch (error) {
        console.error('❌ Error during verification:', error);
        return false;
    }
}

// Run the script if executed directly
if (require.main === module) {
    cleanupTestMedications()
        .then(async (results) => {
            console.log('🎉 Test medication cleanup completed!');
            console.log('📊 Summary:', {
                eventsDeleted: results.eventsDeleted,
                medicationsDeleted: results.medicationsDeleted,
                schedulesDeleted: results.schedulesDeleted || 0,
                errorsCount: results.errors.length
            });
            
            if (results.errors.length > 0) {
                console.log('⚠️ Errors encountered:', results.errors);
            }
            
            // Verify cleanup
            const isClean = await verifyCleanup();
            
            console.log('\n💡 Cleanup Summary:');
            console.log(`- Database is ${isClean ? 'clean' : 'not fully clean'}`);
            console.log('- Test medications have been removed');
            console.log('- Only real medication data should remain');
            
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to cleanup test medications:', error);
            process.exit(1);
        });
}

module.exports = { cleanupTestMedications, verifyCleanup };