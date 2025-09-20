const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Performance test for missed medication detection with large volumes
async function testLargeVolumePerformance() {
  console.log('🚀 === LARGE VOLUME PERFORMANCE TEST ===');
  
  const testSizes = [100, 500, 1000, 2000];
  const results = [];
  
  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size} events...`);
    
    try {
      const testResult = await runPerformanceTest(size);
      results.push(testResult);
      
      console.log(`✅ Test completed for ${size} events:`);
      console.log(`   Processing time: ${testResult.processingTime}ms`);
      console.log(`   Time per event: ${testResult.timePerEvent}ms`);
      console.log(`   Memory usage: ${testResult.memoryUsage}MB`);
      console.log(`   Batch efficiency: ${testResult.batchEfficiency}%`);
      
    } catch (error) {
      console.error(`❌ Test failed for ${size} events:`, error);
      results.push({
        eventCount: size,
        success: false,
        error: error.message
      });
    }
  }
  
  // Analyze results
  console.log('\n📈 === PERFORMANCE ANALYSIS ===');
  
  const successfulTests = results.filter(r => r.success);
  
  if (successfulTests.length > 0) {
    console.log('📊 Performance Summary:');
    successfulTests.forEach(result => {
      console.log(`   ${result.eventCount} events: ${result.timePerEvent}ms/event, ${result.processingTime}ms total`);
    });
    
    // Check for performance degradation
    const timePerEventTrend = successfulTests.map(r => r.timePerEvent);
    const isLinearScaling = checkLinearScaling(timePerEventTrend);
    
    if (isLinearScaling) {
      console.log('✅ Performance scales linearly with event count');
    } else {
      console.warn('⚠️ Performance degradation detected with larger volumes');
    }
    
    // Check memory efficiency
    const memoryUsage = successfulTests.map(r => r.memoryUsage);
    const maxMemory = Math.max(...memoryUsage);
    
    if (maxMemory < 200) {
      console.log('✅ Memory usage is efficient (<200MB)');
    } else if (maxMemory < 400) {
      console.log('⚠️ Memory usage is moderate (200-400MB)');
    } else {
      console.warn('🚨 High memory usage detected (>400MB)');
    }
  }
  
  console.log('\n🎯 === RECOMMENDATIONS ===');
  
  if (successfulTests.length === testSizes.length) {
    console.log('✅ System handles all tested volumes efficiently');
    console.log('💡 Recommended batch size: 50 events');
    console.log('💡 Recommended timeout: 540 seconds (9 minutes)');
    console.log('💡 Recommended memory: 256MB');
  } else {
    console.log('⚠️ System has performance limitations');
    console.log('💡 Consider reducing batch size');
    console.log('💡 Consider increasing function timeout');
    console.log('💡 Consider increasing memory allocation');
  }
}

// Run performance test for a specific number of events
async function runPerformanceTest(eventCount) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  // Simulate processing events (since we can't create thousands of real events)
  const events = generateMockEvents(eventCount);
  
  console.log(`   📋 Generated ${events.length} mock events`);
  
  // Simulate grace period calculations
  const gracePeriodCalculations = [];
  const batchSize = 50;
  const batches = [];
  
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  
  console.log(`   📦 Processing ${batches.length} batches of ${batchSize} events each`);
  
  let processedEvents = 0;
  let missedEvents = 0;
  
  for (const batch of batches) {
    const batchStartTime = Date.now();
    
    for (const event of batch) {
      // Simulate grace period calculation
      const gracePeriod = calculateMockGracePeriod(event);
      gracePeriodCalculations.push(gracePeriod);
      
      processedEvents++;
      
      // Check if event should be marked as missed
      if (new Date() > gracePeriod.gracePeriodEnd) {
        missedEvents++;
      }
    }
    
    const batchTime = Date.now() - batchStartTime;
    
    // Simulate batch update delay
    await new Promise(resolve => setTimeout(resolve, Math.min(batchTime / 10, 50)));
  }
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage();
  
  const processingTime = endTime - startTime;
  const timePerEvent = processingTime / eventCount;
  const memoryUsage = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024; // MB
  const batchEfficiency = (processedEvents / eventCount) * 100;
  
  return {
    eventCount,
    success: true,
    processingTime,
    timePerEvent: Math.round(timePerEvent * 100) / 100,
    memoryUsage: Math.round(memoryUsage * 100) / 100,
    batchEfficiency: Math.round(batchEfficiency * 100) / 100,
    processedEvents,
    missedEvents,
    batchCount: batches.length,
    averageBatchTime: processingTime / batches.length
  };
}

// Generate mock events for testing
function generateMockEvents(count) {
  const events = [];
  const now = new Date();
  
  const medicationNames = [
    'Lisinopril', 'Metformin', 'Atorvastatin', 'Amlodipine', 'Metoprolol',
    'Vitamin D', 'Multivitamin', 'Ibuprofen', 'Acetaminophen', 'Aspirin'
  ];
  
  const timeSlots = ['07:00', '12:00', '18:00', '22:00'];
  
  for (let i = 0; i < count; i++) {
    const medicationName = medicationNames[i % medicationNames.length];
    const timeSlot = timeSlots[i % timeSlots.length];
    
    // Create events at various times in the past 24 hours
    const hoursAgo = Math.random() * 24;
    const scheduledTime = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
    
    // Set specific time
    const [hours, minutes] = timeSlot.split(':').map(Number);
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    events.push({
      id: `mock_event_${i}`,
      medicationId: `mock_med_${i % 10}`,
      medicationName,
      patientId: `mock_patient_${i % 20}`, // 20 different patients
      scheduledDateTime: {
        toDate: () => scheduledTime
      },
      dosageAmount: '1 tablet',
      status: 'scheduled',
      createdAt: now,
      updatedAt: now
    });
  }
  
  return events;
}

// Calculate mock grace period for testing
function calculateMockGracePeriod(event) {
  const scheduledTime = event.scheduledDateTime.toDate();
  const hour = scheduledTime.getHours();
  
  // Determine time slot and grace period
  let gracePeriodMinutes = 30; // default
  let timeSlot = 'morning';
  
  if (hour >= 11 && hour < 17) {
    timeSlot = 'noon';
    gracePeriodMinutes = 45;
  } else if (hour >= 17 && hour < 21) {
    timeSlot = 'evening';
    gracePeriodMinutes = 30;
  } else if (hour >= 21 || hour < 6) {
    timeSlot = 'bedtime';
    gracePeriodMinutes = 60;
  }
  
  // Adjust for medication type
  const medicationName = event.medicationName.toLowerCase();
  if (medicationName.includes('lisinopril') || medicationName.includes('metformin')) {
    gracePeriodMinutes = 15; // critical medication
  } else if (medicationName.includes('vitamin')) {
    gracePeriodMinutes = 120; // vitamin
  }
  
  const gracePeriodEnd = new Date(scheduledTime.getTime() + (gracePeriodMinutes * 60 * 1000));
  
  return {
    gracePeriodMinutes,
    gracePeriodEnd,
    appliedRules: [`default_${timeSlot}`],
    timeSlot
  };
}

// Check if performance scales linearly
function checkLinearScaling(timePerEventArray) {
  if (timePerEventArray.length < 2) return true;
  
  // Check if time per event stays relatively stable (within 50% variance)
  const avgTime = timePerEventArray.reduce((sum, time) => sum + time, 0) / timePerEventArray.length;
  const maxDeviation = Math.max(...timePerEventArray.map(time => Math.abs(time - avgTime)));
  
  return maxDeviation / avgTime < 0.5; // Less than 50% deviation
}

// Test database query performance
async function testQueryPerformance() {
  console.log('\n📊 Testing database query performance...');
  
  try {
    const now = new Date();
    const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Test different query patterns
    const queryTests = [
      {
        name: 'Basic scheduled events query',
        query: () => firestore.collection('medication_calendar_events')
          .where('status', '==', 'scheduled')
          .limit(100)
      },
      {
        name: 'Scheduled events with time filter',
        query: () => firestore.collection('medication_calendar_events')
          .where('status', '==', 'scheduled')
          .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
          .limit(100)
      },
      {
        name: 'Scheduled events with time range',
        query: () => firestore.collection('medication_calendar_events')
          .where('status', '==', 'scheduled')
          .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
          .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
          .limit(100)
      }
    ];
    
    for (const test of queryTests) {
      const startTime = Date.now();
      
      try {
        const snapshot = await test.query().get();
        const queryTime = Date.now() - startTime;
        
        console.log(`   ✅ ${test.name}: ${queryTime}ms (${snapshot.docs.length} results)`);
        
        if (queryTime > 5000) { // >5 seconds
          console.warn(`      ⚠️ Slow query detected`);
        }
        
      } catch (queryError) {
        console.error(`   ❌ ${test.name}: Query failed -`, queryError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Query performance test failed:', error);
  }
}

// Main test execution
async function runPerformanceTests() {
  console.log('🚀 Starting performance tests for missed medication detection...\n');
  
  await testLargeVolumePerformance();
  await testQueryPerformance();
  
  console.log('\n🎉 Performance tests completed!');
  process.exit(0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('❌ Performance test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testLargeVolumePerformance,
  runPerformanceTest,
  generateMockEvents,
  calculateMockGracePeriod,
  testQueryPerformance
};