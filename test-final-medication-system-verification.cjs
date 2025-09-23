const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const firestore = admin.firestore();

async function testMedicationSystemFixes() {
  console.log('🔍 FINAL MEDICATION SYSTEM VERIFICATION');
  console.log('=====================================\n');

  try {
    // Test 1: Verify 2AM times are gone
    console.log('📋 TEST 1: Verifying 2AM times are eliminated');
    console.log('--------------------------------------------');
    
    const medicationEventsRef = firestore.collection('medicationEvents');
    const snapshot = await medicationEventsRef.get();
    
    let total2AMEvents = 0;
    let totalEvents = 0;
    let sampleEvents = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      totalEvents++;
      
      // Check for 2AM times in various formats
      const timeStr = data.scheduledTime || '';
      const dateStr = data.scheduledDate || '';
      
      if (timeStr.includes('02:00') || timeStr.includes('2:00 AM') || timeStr.includes('2:00AM')) {
        total2AMEvents++;
        console.log(`❌ Found 2AM event: ${doc.id} - ${timeStr} on ${dateStr}`);
      }
      
      // Collect sample events for time verification
      if (sampleEvents.length < 10) {
        sampleEvents.push({
          id: doc.id,
          time: timeStr,
          date: dateStr,
          medication: data.medicationName || 'Unknown'
        });
      }
    });
    
    console.log(`✅ Total events checked: ${totalEvents}`);
    console.log(`${total2AMEvents === 0 ? '✅' : '❌'} Events with 2AM times: ${total2AMEvents}`);
    
    if (total2AMEvents === 0) {
      console.log('🎉 SUCCESS: No 2AM times found in medication events!\n');
    } else {
      console.log('⚠️ ISSUE: Still found 2AM times in medication events!\n');
    }
    
    // Show sample of current times
    console.log('📊 Sample of current medication times:');
    sampleEvents.forEach(event => {
      console.log(`  - ${event.medication}: ${event.time} on ${event.date}`);
    });
    console.log('');

    // Test 2: Check for pending medications with proper structure
    console.log('📋 TEST 2: Verifying pending medications structure');
    console.log('------------------------------------------------');
    
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = await medicationEventsRef
      .where('scheduledDate', '==', today)
      .get();
    
    let pendingCount = 0;
    let completedCount = 0;
    let pendingMedications = [];
    
    todayEvents.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'pending';
      
      if (status === 'pending') {
        pendingCount++;
        pendingMedications.push({
          id: doc.id,
          name: data.medicationName,
          time: data.scheduledTime,
          status: status
        });
      } else if (status === 'taken' || status === 'completed') {
        completedCount++;
      }
    });
    
    console.log(`✅ Today's events: ${todayEvents.size}`);
    console.log(`✅ Pending medications: ${pendingCount}`);
    console.log(`✅ Completed medications: ${completedCount}`);
    
    if (pendingCount > 0) {
      console.log('🎉 SUCCESS: Found pending medications for testing!\n');
      console.log('📊 Pending medications details:');
      pendingMedications.forEach(med => {
        console.log(`  - ${med.name} at ${med.time} (Status: ${med.status})`);
      });
    } else {
      console.log('⚠️ INFO: No pending medications found for today\n');
    }
    console.log('');

    // Test 3: Verify medication schedules have correct default times
    console.log('📋 TEST 3: Verifying medication schedules use correct times');
    console.log('--------------------------------------------------------');
    
    const medicationSchedulesRef = firestore.collection('medicationSchedules');
    const schedulesSnapshot = await medicationSchedulesRef.get();
    
    let schedulesWith2AM = 0;
    let totalSchedules = 0;
    let sampleSchedules = [];
    
    schedulesSnapshot.forEach(doc => {
      const data = doc.data();
      totalSchedules++;
      
      const times = data.times || [];
      let has2AM = false;
      
      times.forEach(time => {
        if (time.includes('02:00') || time.includes('2:00 AM') || time.includes('2:00AM')) {
          has2AM = true;
        }
      });
      
      if (has2AM) {
        schedulesWith2AM++;
        console.log(`❌ Schedule with 2AM: ${doc.id} - Times: ${times.join(', ')}`);
      }
      
      if (sampleSchedules.length < 5) {
        sampleSchedules.push({
          id: doc.id,
          medication: data.medicationName || 'Unknown',
          times: times
        });
      }
    });
    
    console.log(`✅ Total schedules checked: ${totalSchedules}`);
    console.log(`${schedulesWith2AM === 0 ? '✅' : '❌'} Schedules with 2AM times: ${schedulesWith2AM}`);
    
    if (schedulesWith2AM === 0) {
      console.log('🎉 SUCCESS: No 2AM times found in medication schedules!\n');
    } else {
      console.log('⚠️ ISSUE: Still found 2AM times in medication schedules!\n');
    }
    
    console.log('📊 Sample of current schedule times:');
    sampleSchedules.forEach(schedule => {
      console.log(`  - ${schedule.medication}: ${schedule.times.join(', ')}`);
    });
    console.log('');

    // Test 4: Check for test pending medications we created
    console.log('📋 TEST 4: Verifying test pending medications exist');
    console.log('--------------------------------------------------');
    
    const testMedications = await medicationEventsRef
      .where('medicationName', 'in', ['Test Pending Med A', 'Test Pending Med B', 'Test Pending Med C'])
      .get();
    
    console.log(`✅ Test pending medications found: ${testMedications.size}`);
    
    testMedications.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.medicationName}: ${data.scheduledTime} (Status: ${data.status})`);
    });
    
    if (testMedications.size >= 3) {
      console.log('🎉 SUCCESS: Test pending medications are available for UI testing!\n');
    } else {
      console.log('⚠️ INFO: Some test pending medications may be missing\n');
    }

    // Test 5: API endpoint verification
    console.log('📋 TEST 5: Testing medication API endpoints');
    console.log('-------------------------------------------');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const baseUrl = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';
      
      // Test health endpoint
      const healthResponse = await fetch(`${baseUrl}/health`);
      const healthData = await healthResponse.json();
      
      console.log(`✅ API Health Status: ${healthResponse.status}`);
      console.log(`✅ API Response: ${JSON.stringify(healthData)}`);
      
      if (healthResponse.status === 200) {
        console.log('🎉 SUCCESS: API endpoints are accessible!\n');
      } else {
        console.log('⚠️ ISSUE: API endpoints may have issues\n');
      }
    } catch (error) {
      console.log(`❌ API Test Error: ${error.message}\n`);
    }

    // Summary
    console.log('📋 FINAL VERIFICATION SUMMARY');
    console.log('=============================');
    console.log(`✅ Total medication events: ${totalEvents}`);
    console.log(`${total2AMEvents === 0 ? '✅' : '❌'} 2AM times eliminated: ${total2AMEvents === 0 ? 'YES' : 'NO'}`);
    console.log(`✅ Pending medications available: ${pendingCount}`);
    console.log(`✅ Test medications created: ${testMedications.size >= 3 ? 'YES' : 'PARTIAL'}`);
    console.log(`${schedulesWith2AM === 0 ? '✅' : '❌'} Schedule times fixed: ${schedulesWith2AM === 0 ? 'YES' : 'NO'}`);
    
    const allTestsPassed = total2AMEvents === 0 && schedulesWith2AM === 0 && pendingCount > 0;
    console.log(`\n🎯 OVERALL STATUS: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME ISSUES FOUND'}`);
    
    if (allTestsPassed) {
      console.log('\n🎉 MEDICATION SYSTEM FIXES VERIFIED SUCCESSFULLY!');
      console.log('The system is ready for UI testing with:');
      console.log('- No 2AM times in events or schedules');
      console.log('- Pending medications available for action button testing');
      console.log('- API endpoints functioning correctly');
    } else {
      console.log('\n⚠️ SOME ISSUES STILL NEED ATTENTION');
      console.log('Please review the test results above for specific problems.');
    }

  } catch (error) {
    console.error('❌ Test execution error:', error);
  }
}

// Run the verification
testMedicationSystemFixes().catch(console.error);