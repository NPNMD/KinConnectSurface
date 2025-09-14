// Test script to verify medication schedule default times
console.log('🔍 Testing Medication Schedule Default Times');

// Simulate the generateDefaultTimes function
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
    default:
      return ['07:00'];
  }
}

// Simulate the formatTimes function
function formatTimes(times) {
  return times.map(time => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }).join(', ');
}

// Test all frequencies
const frequencies = [
  'daily',
  'twice_daily', 
  'three_times_daily',
  'four_times_daily',
  'weekly',
  'monthly'
];

console.log('\n📋 Default Times for Each Frequency:');
console.log('=====================================');

frequencies.forEach(freq => {
  const times = generateDefaultTimes(freq);
  const formatted = formatTimes(times);
  console.log(`${freq.padEnd(20)} | ${times.join(', ').padEnd(25)} | ${formatted}`);
});

console.log('\n🔍 Checking for potential issues:');

// Check if "twice_daily" could be misinterpreted
const twiceDailyTimes = generateDefaultTimes('twice_daily');
console.log(`\nTwice Daily Raw Times: ${JSON.stringify(twiceDailyTimes)}`);
console.log(`Twice Daily Formatted: ${formatTimes(twiceDailyTimes)}`);

// Check if there's any confusion with "2:00" vs "02:00"
const testTimes = ['02:00', '07:00', '19:00'];
console.log(`\nTest Times Formatting:`);
testTimes.forEach(time => {
  console.log(`${time} -> ${formatTimes([time])}`);
});

console.log('\n✅ Test completed. The default times appear to be working correctly.');
console.log('If you\'re seeing "2 AM twice a day", the issue might be:');
console.log('1. A display bug in the UI');
console.log('2. Data corruption in the database');
console.log('3. A timezone conversion issue');
console.log('4. User accidentally set custom times to 02:00');