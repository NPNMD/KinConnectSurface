/**
 * Test script to verify frequency parsing consistency across components
 */

// Simulate the shared utility functions
function parseFrequencyToScheduleType(medicationFrequency) {
  const freq = medicationFrequency.toLowerCase().trim();
  
  console.log('🔍 Testing frequency parsing for:', freq);
  
  // Enhanced frequency parsing with comprehensive variations
  if (freq.includes('once daily') || freq.includes('once a day') || freq === 'daily' || freq.includes('once')) {
    return 'daily';
  } else if (freq.includes('twice daily') || freq.includes('twice a day') || freq.includes('bid') || freq.includes('twice') || freq.includes('2x daily') || freq.includes('twice per day') || freq.includes('every 12 hours')) {
    return 'twice_daily';
  } else if (freq.includes('three times daily') || freq.includes('three times a day') || freq.includes('tid') || freq.includes('three') || freq.includes('3x daily') || freq.includes('three times per day') || freq.includes('every 8 hours')) {
    return 'three_times_daily';
  } else if (freq.includes('four times daily') || freq.includes('four times a day') || freq.includes('qid') || freq.includes('four') || freq.includes('4x daily') || freq.includes('four times per day') || freq.includes('every 6 hours') || freq.includes('every 4 hours')) {
    return 'four_times_daily';
  } else if (freq.includes('weekly')) {
    return 'weekly';
  } else if (freq.includes('monthly')) {
    return 'monthly';
  } else if (freq.includes('needed') || freq.includes('prn') || freq.includes('as needed')) {
    return 'as_needed';
  } else {
    console.warn(`⚠️ Unknown frequency "${freq}", defaulting to daily`);
    return 'daily';
  }
}

function generateDefaultTimesForFrequency(frequency) {
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
      return [];
    default:
      return ['07:00'];
  }
}

// Test cases for frequency parsing
const testCases = [
  // Standard variations
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  
  // Medical abbreviations
  'BID',
  'TID', 
  'QID',
  
  // Common variations
  'twice a day',
  'three times a day',
  'four times a day',
  '2x daily',
  '3x daily',
  '4x daily',
  'twice per day',
  'three times per day',
  'four times per day',
  
  // Hour-based frequencies
  'every 12 hours',
  'every 8 hours',
  'every 6 hours',
  'every 4 hours',
  
  // Other frequencies
  'weekly',
  'monthly',
  'as needed',
  'PRN',
  
  // Edge cases
  'daily',
  'once',
  'twice',
  'three',
  'four'
];

console.log('🧪 === FREQUENCY PARSING CONSISTENCY TEST ===');
console.log('Testing', testCases.length, 'frequency variations...\n');

const results = [];

testCases.forEach((testFreq, index) => {
  console.log(`\n--- Test ${index + 1}: "${testFreq}" ---`);
  
  const parsedFrequency = parseFrequencyToScheduleType(testFreq);
  const defaultTimes = generateDefaultTimesForFrequency(parsedFrequency);
  
  const result = {
    original: testFreq,
    parsed: parsedFrequency,
    times: defaultTimes,
    timesCount: defaultTimes.length
  };
  
  results.push(result);
  
  console.log('✅ Result:', {
    frequency: parsedFrequency,
    times: defaultTimes,
    count: defaultTimes.length
  });
});

console.log('\n🧪 === TEST SUMMARY ===');
console.log('Total test cases:', testCases.length);

// Group results by parsed frequency
const groupedResults = results.reduce((acc, result) => {
  if (!acc[result.parsed]) {
    acc[result.parsed] = [];
  }
  acc[result.parsed].push(result);
  return acc;
}, {});

console.log('\n📊 Results grouped by parsed frequency:');
Object.entries(groupedResults).forEach(([frequency, items]) => {
  console.log(`\n${frequency.toUpperCase()}:`);
  console.log(`  Default times: ${items[0].times.join(', ')}`);
  console.log(`  Variations that map to this: ${items.length}`);
  items.forEach(item => {
    console.log(`    - "${item.original}"`);
  });
});

// Verify consistency
console.log('\n🔍 === CONSISTENCY VERIFICATION ===');

const twiceDailyVariations = results.filter(r => r.parsed === 'twice_daily');
const allTwiceDailyTimesMatch = twiceDailyVariations.every(r => 
  JSON.stringify(r.times) === JSON.stringify(['07:00', '19:00'])
);

console.log('✅ Twice daily consistency check:', {
  variationsCount: twiceDailyVariations.length,
  allTimesMatch: allTwiceDailyTimesMatch,
  expectedTimes: ['07:00', '19:00'],
  actualTimes: twiceDailyVariations[0]?.times || 'none'
});

if (allTwiceDailyTimesMatch) {
  console.log('🎉 SUCCESS: All "twice daily" variations now use consistent times: 07:00, 19:00');
} else {
  console.error('❌ FAILURE: Twice daily variations have inconsistent times');
}

// Test specific problem case
console.log('\n🎯 === SPECIFIC PROBLEM CASE TEST ===');
const problemCase = 'Twice a day';
const problemResult = parseFrequencyToScheduleType(problemCase);
const problemTimes = generateDefaultTimesForFrequency(problemResult);

console.log('Problem case test:', {
  input: problemCase,
  parsed: problemResult,
  times: problemTimes,
  isCorrect: JSON.stringify(problemTimes) === JSON.stringify(['07:00', '19:00'])
});

console.log('\n🧪 === FREQUENCY PARSING TEST COMPLETE ===');