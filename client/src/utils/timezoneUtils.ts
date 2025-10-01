/**
 * Timezone utility functions for medication scheduling
 * Handles conversion between local time and UTC for proper storage
 */

/**
 * Convert a local time string (HH:MM) to UTC time string (HH:MM)
 * @param localTime - Time in HH:MM format (e.g., "08:00")
 * @param date - Optional date to use for conversion (defaults to today)
 * @returns UTC time string in HH:MM format
 */
export function convertLocalTimeToUTC(localTime: string, date?: Date): string {
  try {
    console.log('🕐 Converting local time to UTC:', { localTime, date: date?.toISOString() });
    
    // Parse the time string
    const [hours, minutes] = localTime.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('❌ Invalid time format:', localTime);
      return localTime; // Return original if invalid
    }
    
    // Create a date object in local timezone
    const localDate = date ? new Date(date) : new Date();
    localDate.setHours(hours, minutes, 0, 0);
    
    console.log('🕐 Local date object:', localDate.toISOString());
    
    // Get UTC hours and minutes
    const utcHours = localDate.getUTCHours();
    const utcMinutes = localDate.getUTCMinutes();
    
    // Format as HH:MM
    const utcTime = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
    
    console.log('🕐 Converted to UTC:', {
      localTime,
      localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcTime,
      offsetMinutes: localDate.getTimezoneOffset()
    });
    
    return utcTime;
  } catch (error) {
    console.error('❌ Error converting local time to UTC:', error);
    return localTime; // Return original on error
  }
}

/**
 * Convert a UTC time string (HH:MM) to local time string (HH:MM)
 * @param utcTime - Time in HH:MM format (e.g., "13:00")
 * @param date - Optional date to use for conversion (defaults to today)
 * @returns Local time string in HH:MM format
 */
export function convertUTCTimeToLocal(utcTime: string, date?: Date): string {
  try {
    console.log('🕐 Converting UTC time to local:', { utcTime, date: date?.toISOString() });
    
    // Parse the time string
    const [hours, minutes] = utcTime.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('❌ Invalid time format:', utcTime);
      return utcTime; // Return original if invalid
    }
    
    // Create a date object in UTC
    const utcDate = date ? new Date(date) : new Date();
    utcDate.setUTCHours(hours, minutes, 0, 0);
    
    console.log('🕐 UTC date object:', utcDate.toISOString());
    
    // Get local hours and minutes
    const localHours = utcDate.getHours();
    const localMinutes = utcDate.getMinutes();
    
    // Format as HH:MM
    const localTime = `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
    
    console.log('🕐 Converted to local:', {
      utcTime,
      localTime,
      localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offsetMinutes: utcDate.getTimezoneOffset()
    });
    
    return localTime;
  } catch (error) {
    console.error('❌ Error converting UTC time to local:', error);
    return utcTime; // Return original on error
  }
}

/**
 * Convert an array of local times to UTC times
 * @param localTimes - Array of time strings in HH:MM format
 * @param date - Optional date to use for conversion (defaults to today)
 * @returns Array of UTC time strings in HH:MM format
 */
export function convertLocalTimesToUTC(localTimes: string[], date?: Date): string[] {
  return localTimes.map(time => convertLocalTimeToUTC(time, date));
}

/**
 * Convert an array of UTC times to local times
 * @param utcTimes - Array of time strings in HH:MM format
 * @param date - Optional date to use for conversion (defaults to today)
 * @returns Array of local time strings in HH:MM format
 */
export function convertUTCTimesToLocal(utcTimes: string[], date?: Date): string[] {
  return utcTimes.map(time => convertUTCTimeToLocal(time, date));
}

/**
 * Get the current timezone offset in minutes
 * @returns Offset in minutes (negative for timezones ahead of UTC)
 */
export function getTimezoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Get the current timezone name
 * @returns Timezone name (e.g., "America/Chicago")
 */
export function getTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a time for display with timezone info
 * @param time - Time in HH:MM format
 * @param isUTC - Whether the time is in UTC
 * @returns Formatted time string with timezone
 */
export function formatTimeWithTimezone(time: string, isUTC: boolean = false): string {
  const timezone = getTimezoneName();
  const offset = getTimezoneOffsetMinutes();
  const offsetHours = Math.abs(Math.floor(offset / 60));
  const offsetMinutes = Math.abs(offset % 60);
  const offsetSign = offset <= 0 ? '+' : '-';
  
  const timezoneStr = isUTC 
    ? 'UTC' 
    : `${timezone} (UTC${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')})`;
  
  return `${time} ${timezoneStr}`;
}

/**
 * Log timezone conversion for debugging
 * @param localTime - Local time string
 * @param utcTime - UTC time string
 * @param context - Context for the log
 */
export function logTimezoneConversion(localTime: string, utcTime: string, context: string = ''): void {
  console.log(`🕐 Timezone Conversion ${context ? `(${context})` : ''}:`, {
    localTime,
    utcTime,
    timezone: getTimezoneName(),
    offsetMinutes: getTimezoneOffsetMinutes(),
    localFormatted: formatTimeWithTimezone(localTime, false),
    utcFormatted: formatTimeWithTimezone(utcTime, true)
  });
}