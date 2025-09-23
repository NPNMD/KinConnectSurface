/**
 * Create Test Pending Medications
 * 
 * This script creates some pending medication events for today to test action button visibility.
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

async function createTestPendingMedications() {
    console.log('🧪 Creating Test Pending Medications...');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const results = {
        eventsCreated: 0,
        errors: []
    };
    
    try {
        // Get a patient ID to use for testing
        const preferencesQuery = await firestore.collection('patient_medication_preferences').limit(1).get();
        if (preferencesQuery.empty) {
            throw new Error('No patients found in database');
        }
        
        const patientDoc = preferencesQuery.docs[0];
        const patientId = patientDoc.data().patientId;
        
        console.log(`🔍 Using patient ID for test: ${patientId}`);
        
        // Create pending medication events for different time buckets
        const now = new Date();
        const testEvents = [
            {
                medicationName: 'Test Vitamin D',
                scheduledTime: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes from now
                timeBucket: 'due_soon'
            },
            {
                medicationName: 'Test Omega-3',
                scheduledTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
                timeBucket: 'morning'
            },
            {
                medicationName: 'Test Calcium',
                scheduledTime: new Date(now.getTime() + 6 * 60 * 60 * 1000), // 6 hours from now
                timeBucket: 'evening'
            }
        ];
        
        for (const event of testEvents) {
            const eventData = {
                id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                patientId: patientId,
                medicationId: `test-med-${Date.now()}`,
                medicationName: event.medicationName,
                dosageAmount: '1 tablet',
                scheduledDateTime: admin.firestore.Timestamp.fromDate(event.scheduledTime),
                status: 'scheduled',
                timeBucket: event.timeBucket,
                isOverdue: false,
                remindersSent: [],
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
                createdBy: 'test-script',
                isTestData: true // Mark as test data for easy cleanup
            };
            
            await firestore.collection('medication_calendar_events').add(eventData);
            results.eventsCreated++;
            
            console.log(`✅ Created pending medication: ${event.medicationName} at ${event.scheduledTime.toTimeString().slice(0, 5)}`);
        }
        
        console.log('✅ Test pending medications created successfully!');
        console.log('📊 Results:', results);
        
        return results;
        
    } catch (error) {
        console.error('❌ Error creating test pending medications:', error);
        results.errors.push(`Error: ${error.message}`);
        throw error;
    }
}

// Run the script if executed directly
if (require.main === module) {
    createTestPendingMedications()
        .then((results) => {
            console.log('🎉 Test pending medications created successfully!');
            console.log('📊 Summary:', {
                eventsCreated: results.eventsCreated,
                errorsCount: results.errors.length
            });
            
            if (results.errors.length > 0) {
                console.log('⚠️ Errors encountered:', results.errors);
            }
            
            console.log('\n💡 Next steps:');
            console.log('1. Refresh the UI to see pending medications with action buttons');
            console.log('2. Test taking a medication to see it move to completed section');
            console.log('3. Verify completed medications show status icons only');
            
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to create test pending medications:', error);
            process.exit(1);
        });
}

module.exports = { createTestPendingMedications };