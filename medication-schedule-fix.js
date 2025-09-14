// Fix for medication schedule default times issue
// The problem is in the frequency mapping and default time handling

console.log('🔧 Medication Schedule Fix Analysis');

// Current problematic mapping in MedicationScheduleManager.tsx lines 106-118
function currentFrequencyMapping(medicationFrequency) {
  const freq = medicationFrequency?.toLowerCase() || '';
  let scheduleFrequency = 'daily';
  
  // Current logic (PROBLEMATIC)
  if (freq.includes('once') || freq.includes('daily')) {
    scheduleFrequency = 'daily';
  } else if (freq.includes('twice')) {
    scheduleFrequency = 'twice_daily';
  } else if (freq.includes('three')) {
    scheduleFrequency = 'three_times_daily';
  } else if (freq.includes('four')) {
    scheduleFrequency = 'four_times_daily';
  }
  
  return scheduleFrequency;
}

// Improved frequency mapping
function improvedFrequencyMapping(medicationFrequency) {
  const freq = medicationFrequency?.toLowerCase().trim() || '';
  
  console.log(`🔍 Mapping frequency: "${freq}"`);
  
  // More comprehensive mapping
  if (freq.includes('once daily') || freq.includes('once a day') || freq === 'daily' || freq === 'once daily') {
    return 'daily';
  } else if (freq.includes('twice daily') || freq.includes('twice a day') || freq.includes('bid') || freq === 'twice daily') {
    return 'twice_daily';
  } else if (freq.includes('three times daily') || freq.includes('three times a day') || freq.includes('tid') || freq === 'three times daily') {
    return 'three_times_daily';
  } else if (freq.includes('four times daily') || freq.includes('four times a day') || freq.includes('qid') || freq === 'four times daily') {
    return 'four_times_daily';
  } else if (freq.includes('every 4 hours')) {
    return 'four_times_daily'; // 6 times a day, but we'll use 4 times as closest
  } else if (freq.includes('every 6 hours')) {
    return 'four_times_daily';
  } else if (freq.includes('every 8 hours')) {
    return 'three_times_daily';
  } else if (freq.includes('every 12 hours')) {
    return 'twice_daily';
  } else if (freq.includes('weekly')) {
    return 'weekly';
  } else if (freq.includes('monthly')) {
    return 'monthly';
  } else if (freq.includes('as needed') || freq.includes('prn')) {
    return 'as_needed';
  } else {
    // Default fallback
    console.warn(`⚠️ Unknown frequency "${freq}", defaulting to daily`);
    return 'daily';
  }
}

// Test the mappings
const testFrequencies = [
  'Once daily',
  'Twice daily', 
  'Three times daily',
  'Four times daily',
  'Every 8 hours',
  'Every 12 hours',
  'BID',
  'TID',
  'QID',
  'As needed',
  'Weekly',
  'Monthly',
  'Unknown frequency'
];

console.log('\n📋 Frequency Mapping Test Results:');
console.log('=====================================');

testFrequencies.forEach(freq => {
  const current = currentFrequencyMapping(freq);
  const improved = improvedFrequencyMapping(freq);
  const match = current === improved ? '✅' : '❌';
  console.log(`${freq.padEnd(20)} | Current: ${current.padEnd(18)} | Improved: ${improved.padEnd(18)} | ${match}`);
});

// Default times function (this should be working correctly)
function generateDefaultTimes(frequency) {
  switch (frequency) {
    case 'daily':
      return ['07:00'];
    case 'twice_daily':
      return ['07:00', '19:00'];
    case 'three_times_daily':
      return ['07:00', '13:00', '19:00'];
    case 'four_times_daily':
      return ['07:00', '12:00', '17:00', '22:00'];
    case 'weekly':
      return ['07:00'];
    case 'monthly':
      return ['07:00'];
    case 'as_needed':
      return ['07:00']; // Default time for PRN
    default:
      return ['07:00'];
  }
}

console.log('\n🔍 Testing "Twice daily" specifically:');
const twiceDaily = improvedFrequencyMapping('Twice daily');
const defaultTimes = generateDefaultTimes(twiceDaily);
console.log(`Frequency: "Twice daily" -> ${twiceDaily}`);
console.log(`Default times: ${JSON.stringify(defaultTimes)}`);
console.log(`Should show: 7:00 AM, 7:00 PM`);

console.log('\n🎯 POTENTIAL ROOT CAUSES:');
console.log('1. User may have manually changed times to 02:00');
console.log('2. Database may have corrupted data');
console.log('3. Timezone conversion issue');
console.log('4. Browser time input defaulting to 02:00');
console.log('5. Form not properly updating when frequency changes');

console.log('\n✅ RECOMMENDED FIXES:');
console.log('1. Improve frequency mapping logic');
console.log('2. Add validation for time inputs');
console.log('3. Reset times when frequency changes');
console.log('4. Add debugging logs to track time changes');
console.log('5. Validate existing schedules in database');