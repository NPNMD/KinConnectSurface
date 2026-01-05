/**
 * Shared Date Utilities
 * 
 * Provides robust date and time manipulation functions,
 * specifically handling timezone conversions and normalization.
 */

/**
 * Converts a local date/time components to a UTC Date object
 * 
 * @param baseDate The reference date (year, month, day)
 * @param timeStr Time string in HH:MM format
 * @param timeZone IANA timezone string (e.g., "America/New_York")
 * @returns Date object representing the specific local time in UTC
 */
export function getUtcFromLocal(baseDate: Date, timeStr: string, timeZone: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  
  // Guess UTC time (assuming same offset) - start with UTC matching local
  let estimated = new Date(Date.UTC(year, month, day, hours, minutes));
  
  // Refine
  try {
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
      }).formatToParts(estimated);
      
      // Extract parts
      const p: any = {};
      parts.forEach(({type, value}) => p[type] = value);
      
      // Compare found time with desired time
      const foundH = parseInt(p.hour === '24' ? '0' : p.hour);
      const foundM = parseInt(p.minute);
      
      const desiredMinutes = hours * 60 + minutes;
      const foundMinutes = foundH * 60 + foundM;
      
      let diff = desiredMinutes - foundMinutes;
      if (diff > 720) diff -= 1440;
      if (diff < -720) diff += 1440;
      
      if (diff === 0) return estimated;
      
      estimated = new Date(estimated.getTime() + diff * 60000);
    }
  } catch (e) {
    console.warn('⚠️ Timezone conversion failed, falling back to UTC mapping', e);
    // Fallback to simple mapping
    estimated = new Date(Date.UTC(year, month, day, hours, minutes));
  }
  return estimated;
}

/**
 * Normalize a date input to a valid Date object or undefined
 * 
 * @param dateValue Date object, string, or undefined
 * @param defaultValue Optional default value if input is null/undefined/invalid
 * @returns Date object or undefined
 */
export function normalizeDate(dateValue: Date | string | undefined | null, defaultValue?: Date): Date | undefined {
  if (!dateValue) return defaultValue;
  
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? defaultValue : dateValue;
  }
  
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? defaultValue : parsed;
  }
  
  return defaultValue;
}

