/**
 * Shared utility functions for medication frequency parsing and time generation
 * This ensures consistent frequency parsing across all components
 */

export type ScheduleFrequency = 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';

/**
 * Parse medication frequency string to standardized schedule frequency
 * Supports comprehensive variations including medical abbreviations and common phrases
 */
export function parseFrequencyToScheduleType(medicationFrequency: string): ScheduleFrequency {
  const freq = medicationFrequency.toLowerCase().trim();
  
  console.log('🔍 FrequencyUtils: Parsing frequency:', freq);
  
  // Enhanced frequency parsing with comprehensive variations
  if (freq.includes('once daily') || freq.includes('once a day') || freq === 'daily' || freq.includes('once')) {
    console.log('🔍 FrequencyUtils: Mapped to daily');
    return 'daily';
  } else if (freq.includes('twice daily') || freq.includes('twice a day') || freq.includes('bid') || freq.includes('twice') || freq.includes('2x daily') || freq.includes('twice per day') || freq.includes('every 12 hours')) {
    console.log('🔍 FrequencyUtils: Mapped to twice_daily');
    return 'twice_daily';
  } else if (freq.includes('three times daily') || freq.includes('three times a day') || freq.includes('tid') || freq.includes('three') || freq.includes('3x daily') || freq.includes('three times per day') || freq.includes('every 8 hours')) {
    console.log('🔍 FrequencyUtils: Mapped to three_times_daily');
    return 'three_times_daily';
  } else if (freq.includes('four times daily') || freq.includes('four times a day') || freq.includes('qid') || freq.includes('four') || freq.includes('4x daily') || freq.includes('four times per day') || freq.includes('every 6 hours') || freq.includes('every 4 hours')) {
    console.log('🔍 FrequencyUtils: Mapped to four_times_daily');
    return 'four_times_daily';
  } else if (freq.includes('weekly')) {
    console.log('🔍 FrequencyUtils: Mapped to weekly');
    return 'weekly';
  } else if (freq.includes('monthly')) {
    console.log('🔍 FrequencyUtils: Mapped to monthly');
    return 'monthly';
  } else if (freq.includes('needed') || freq.includes('prn') || freq.includes('as needed')) {
    console.log('🔍 FrequencyUtils: Mapped to as_needed');
    return 'as_needed';
  } else {
    console.warn(`⚠️ FrequencyUtils: Unknown frequency "${freq}", defaulting to daily`);
    return 'daily'; // Default fallback
  }
}

/**
 * Generate default times for a given schedule frequency
 * Consistent with medicationCalendarApi.generateDefaultTimes()
 */
export function generateDefaultTimesForFrequency(frequency: ScheduleFrequency): string[] {
  console.log('🔍 FrequencyUtils: Generating default times for frequency:', frequency);
  
  const times = (() => {
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
        return []; // PRN medications don't have scheduled times
      default:
        return ['07:00'];
    }
  })();
  
  console.log('🔍 FrequencyUtils: Generated default times:', times);
  return times;
}

/**
 * Get default times object for all frequencies (used by MedicationManager)
 */
export function getDefaultTimesObject() {
  return {
    daily: generateDefaultTimesForFrequency('daily'),
    twice_daily: generateDefaultTimesForFrequency('twice_daily'),
    three_times_daily: generateDefaultTimesForFrequency('three_times_daily'),
    four_times_daily: generateDefaultTimesForFrequency('four_times_daily'),
    weekly: generateDefaultTimesForFrequency('weekly'),
    monthly: generateDefaultTimesForFrequency('monthly')
  };
}

/**
 * Validate that a frequency string is supported
 */
export function isValidFrequency(frequency: string): boolean {
  const supportedPatterns = [
    // Daily variations
    'once daily', 'once a day', 'daily', 'once',
    // Twice daily variations
    'twice daily', 'twice a day', 'bid', 'twice', '2x daily', 'twice per day', 'every 12 hours',
    // Three times daily variations
    'three times daily', 'three times a day', 'tid', 'three', '3x daily', 'three times per day', 'every 8 hours',
    // Four times daily variations
    'four times daily', 'four times a day', 'qid', 'four', '4x daily', 'four times per day', 'every 6 hours', 'every 4 hours',
    // Other frequencies
    'weekly', 'monthly', 'as needed', 'prn', 'needed'
  ];
  
  const freq = frequency.toLowerCase().trim();
  return supportedPatterns.some(pattern => freq.includes(pattern));
}

/**
 * Get human-readable description of frequency
 */
export function getFrequencyDescription(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case 'daily':
      return 'Once daily';
    case 'twice_daily':
      return 'Twice daily (BID)';
    case 'three_times_daily':
      return 'Three times daily (TID)';
    case 'four_times_daily':
      return 'Four times daily (QID)';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'as_needed':
      return 'As needed (PRN)';
    default:
      return 'Daily';
  }
}

/**
 * Debug function to log frequency parsing validation
 */
export function validateFrequencyParsing(originalFrequency: string, parsedFrequency: ScheduleFrequency, generatedTimes: string[]): void {
  console.log('🔍 FrequencyUtils: Frequency parsing validation:', {
    original: originalFrequency,
    parsed: parsedFrequency,
    times: generatedTimes,
    description: getFrequencyDescription(parsedFrequency),
    isValid: isValidFrequency(originalFrequency),
    timestamp: new Date().toISOString()
  });
}