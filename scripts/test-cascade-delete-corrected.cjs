/**
 * CASCADE DELETE Test - Corrected Version
 * 
 * This test properly validates the CASCADE DELETE trigger by:
 * 1. Creating a medication command (the main medication)
 * 2. Creating events linked to that command (not separate commands)
 * 3. Deleting the medication command
 * 4. Waiting for trigger execution (10 seconds)
 * 5. Verifying all related events are deleted
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

// Test configuration
const TEST_USER_ID = 'cascade-test-user-' + Date.now();
const TEST_PATIENT_ID = 'cascade-test-patient-' + Date.now();

async function runCascadeDeleteTest() {
  console.log('🔥 CASCADE DELETE TEST - CORRECTED VERSION');
  console.log('='.repeat(80));
  console.log('Test User ID:', TEST_USER_ID);
  console.log('Test Patient ID:', TEST_PATIENT_ID);
  console.log('='.repeat(80) + '\n');
  
  let commandId;
  
  try {
    // Step 1: Create a medication command
    console.log('📝 Step 1: Creating medication command...');
    const commandRef = db.collection('medication_commands').doc();
    commandId = commandRef.id;
    
    const medicationData = {
      userId: TEST_USER_ID,
      patientId: TEST_PATIENT_ID,
      medication: {
        name: 'CASCADE DELETE Test Medication',
        dosage: '10mg',
        form: 'tablet',
        route: 'oral'
      },
      schedule: {
        frequency: 'daily',
        times: ['09:00'],
        startDate: new Date(),
        dosageAmount: '10mg'
      },
      status: {
        current: 'active',
        isActive: true,
        isPRN: false
      },
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: TEST_USER_ID
      }
    };
    
    await commandRef.set(medicationData);
    console.log('✅ Medication command created:', commandId);
    
    // Step 2: Create multiple events linked to this command
    console.log('\n📝 Step 2: Creating medication events linked to command...');
    const eventIds = [];
    
    const eventTypes = [
      { type: 'dose_taken', description: 'Taken event' },
      { type: 'dose_skipped', description: 'Skipped event' },
      { type: 'dose_snoozed', description: 'Snoozed event' },
      { type: 'status_changed', description: 'Status change event' },
      { type: 'dose_taken', description: 'Second taken event' }
    ];
    
    for (const { type, description } of eventTypes) {
      const eventRef = db.collection('medication_events').doc();
      const eventData = {
        commandId: commandId, // Link to the medication command
        patientId: TEST_PATIENT_ID,
        eventType: type,
        eventData: {
          scheduledDateTime: new Date(),
          actionNotes: `Test ${description}`
        },
        timing: {
          eventTimestamp: new Date(),
          scheduledFor: new Date()
        },
        context: {
          medicationName: 'CASCADE DELETE Test Medication',
          triggerSource: 'test_script'
        },
        metadata: {
          createdAt: new Date(),
          createdBy: TEST_USER_ID,
          version: '1.0.0'
        }
      };
      
      await eventRef.set(eventData);
      eventIds.push(eventRef.id);
      console.log(`   ✅ Created ${description}:`, eventRef.id);
    }
    
    console.log(`✅ Created ${eventIds.length} medication events`);
    
    // Step 3: Verify data before deletion
    console.log('\n🔍 Step 3: Verifying data BEFORE deletion...');
    
    const eventsBeforeSnapshot = await db.collection('medication_events')
      .where('commandId', '==', commandId)
      .get();
    
    console.log(`   📊 Events linked to command: ${eventsBeforeSnapshot.size}`);
    
    if (eventsBeforeSnapshot.size !== eventIds.length) {
      console.warn(`   ⚠️  WARNING: Expected ${eventIds.length} events, found ${eventsBeforeSnapshot.size}`);
    }
    
    // Step 4: Delete the medication command
    console.log('\n🗑️  Step 4: Deleting medication command...');
    console.log('   Command ID:', commandId);
    
    const deleteStart = Date.now();
    await db.collection('medication_commands').doc(commandId).delete();
    const deleteTime = Date.now() - deleteStart;
    
    console.log(`   ✅ Command deleted (${deleteTime}ms)`);
    
    // Step 5: Wait for CASCADE DELETE trigger to execute
    console.log('\n⏳ Step 5: Waiting for CASCADE DELETE trigger...');
    console.log('   Waiting 10 seconds for trigger execution...');
    
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r   ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\r   ✅ Wait complete                    \n');
    
    // Step 6: Verify CASCADE DELETE worked
    console.log('🔍 Step 6: Verifying CASCADE DELETE results...');
    
    // Check for orphaned events
    const orphanedEventsSnapshot = await db.collection('medication_events')
      .where('commandId', '==', commandId)
      .get();
    
    const orphanedCount = orphanedEventsSnapshot.size;
    
    console.log(`   📊 Orphaned events found: ${orphanedCount}`);
    
    if (orphanedCount > 0) {
      console.log('\n   ⚠️  ORPHANED EVENTS DETAILS:');
      orphanedEventsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. Event ID: ${doc.id}`);
        console.log(`      Type: ${data.eventType}`);
        console.log(`      Created: ${data.metadata?.createdAt?.toDate?.()?.toISOString() || 'Unknown'}`);
      });
    }
    
    // Check archived events
    const archivedEventsSnapshot = await db.collection('medication_events_archive')
      .where('commandId', '==', commandId)
      .get();
    
    console.log(`   📊 Archived events found: ${archivedEventsSnapshot.size}`);
    
    // Step 7: Final validation
    console.log('\n' + '='.repeat(80));
    console.log('CASCADE DELETE TEST RESULTS');
    console.log('='.repeat(80));
    
    const testPassed = orphanedCount === 0 && archivedEventsSnapshot.size === 0;
    
    if (testPassed) {
      console.log('✅ CASCADE DELETE TEST: PASSED');
      console.log(`   - All ${eventIds.length} events successfully deleted`);
      console.log('   - Zero orphaned records found');
      console.log('   - System is working correctly');
    } else {
      console.log('❌ CASCADE DELETE TEST: FAILED');
      console.log(`   - Expected: 0 orphaned events`);
      console.log(`   - Found: ${orphanedCount} orphaned events`);
      console.log(`   - Archived: ${archivedEventsSnapshot.size} events`);
      console.log('   - CASCADE DELETE trigger did NOT execute properly');
    }
    
    console.log('='.repeat(80));
    
    // Cleanup orphaned data if test failed
    if (!testPassed) {
      console.log('\n🧹 Cleaning up orphaned test data...');
      const batch = db.batch();
      
      orphanedEventsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      archivedEventsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`✅ Cleaned up ${orphanedCount + archivedEventsSnapshot.size} orphaned records`);
    }
    
    // Save results
    const fs = require('fs');
    const reportPath = path.join(__dirname, '../CASCADE_DELETE_TEST_RESULTS.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      testPassed,
      commandId,
      eventsCreated: eventIds.length,
      orphanedEvents: orphanedCount,
      archivedEvents: archivedEventsSnapshot.size,
      deleteTime: deleteTime,
      waitTime: 10000,
      triggerDeployed: true,
      recommendation: testPassed 
        ? 'CASCADE DELETE is working - safe to deploy'
        : 'CASCADE DELETE is NOT working - DO NOT DEPLOY'
    }, null, 2));
    
    console.log(`\n📄 Test results saved to: ${reportPath}\n`);
    
    process.exit(testPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      commandId
    });
    
    // Cleanup on error
    if (commandId) {
      try {
        console.log('\n🧹 Attempting cleanup after error...');
        await db.collection('medication_commands').doc(commandId).delete();
        
        const eventsSnapshot = await db.collection('medication_events')
          .where('commandId', '==', commandId)
          .get();
        
        const batch = db.batch();
        eventsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

// Run the test
console.log('⏰ Waiting 5 minutes for CASCADE DELETE trigger to become active...');
console.log('   Trigger was deployed at: 2025-10-09 16:10:27 UTC');
console.log('   Current time:', new Date().toISOString());
console.log('   Starting test in 5 minutes...\n');

// Wait 5 minutes for trigger to become active
setTimeout(() => {
  runCascadeDeleteTest();
}, 5 * 60 * 1000); // 5 minutes

console.log('⏳ Waiting... (you can press Ctrl+C to cancel and run manually later)');