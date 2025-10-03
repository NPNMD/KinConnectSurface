"use strict";
/**
 * Timezone Utilities for Daily Medication Reset System
 *
 * Provides timezone-aware date/time calculations for:
 * - Calculating midnight in patient's timezone
 * - Determining if current time is within midnight window
 * - Getting day boundaries in patient's timezone
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePatientMidnight = calculatePatientMidnight;
exports.isWithinMidnightWindow = isWithinMidnightWindow;
exports.calculateDayBoundaries = calculateDayBoundaries;
exports.getPreviousDayBoundaries = getPreviousDayBoundaries;
exports.toISODateString = toISODateString;
exports.belongsToDate = belongsToDate;
exports.getCurrentTimeInTimezone = getCurrentTimeInTimezone;
exports.isValidTimezone = isValidTimezone;
exports.getPatientsAtMidnight = getPatientsAtMidnight;
/**
 * Calculate midnight (00:00:00) in the patient's timezone for a given date
 * @param date The date to calculate midnight for (defaults to current date)
 * @param timezone IANA timezone string (e.g., "America/Chicago")
 * @returns Date object representing midnight in the patient's timezone
 */
function calculatePatientMidnight(date = new Date(), timezone) {
    // Format the date in the patient's timezone
    const dateStr = date.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // Parse the formatted date
    const [month, day, year] = dateStr.split('/');
    // Create a date string in ISO format for the patient's timezone
    const midnightStr = `${year}-${month}-${day}T00:00:00`;
    // Convert to Date object in patient's timezone
    const midnight = new Date(midnightStr + getTimezoneOffset(timezone));
    return midnight;
}
/**
 * Get timezone offset string for a given timezone
 * @param timezone IANA timezone string
 * @returns Offset string (e.g., "-05:00")
 */
function getTimezoneOffset(timezone) {
    const now = new Date();
    const tzString = now.toLocaleString('en-US', { timeZone: timezone });
    const localString = now.toLocaleString('en-US');
    const tzDate = new Date(tzString);
    const localDate = new Date(localString);
    const offsetMinutes = (localDate.getTime() - tzDate.getTime()) / (1000 * 60);
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? '+' : '-';
    return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
}
/**
 * Check if the current time is within the midnight window (±15 minutes)
 * @param timezone IANA timezone string
 * @param windowMinutes Window size in minutes (default: 15)
 * @returns True if within the midnight window
 */
function isWithinMidnightWindow(timezone, windowMinutes = 15) {
    const now = new Date();
    const midnight = calculatePatientMidnight(now, timezone);
    const diffMs = Math.abs(now.getTime() - midnight.getTime());
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= windowMinutes;
}
/**
 * Calculate the start and end of a day in the patient's timezone
 * @param date The date to calculate boundaries for
 * @param timezone IANA timezone string
 * @returns Object with startOfDay and endOfDay Date objects
 */
function calculateDayBoundaries(date, timezone) {
    // Get midnight (start of day) in patient's timezone
    const startOfDay = calculatePatientMidnight(date, timezone);
    // Calculate end of day (23:59:59.999)
    const endOfDay = new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000) - 1);
    // Get ISO date string for the day
    const dateString = date.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD format
    return {
        startOfDay,
        endOfDay,
        dateString
    };
}
/**
 * Get the previous day's boundaries in patient's timezone
 * @param timezone IANA timezone string
 * @returns Day boundaries for yesterday
 */
function getPreviousDayBoundaries(timezone) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return calculateDayBoundaries(yesterday, timezone);
}
/**
 * Convert a date to ISO date string in patient's timezone
 * @param date The date to convert
 * @param timezone IANA timezone string
 * @returns ISO date string (YYYY-MM-DD)
 */
function toISODateString(date, timezone) {
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
}
/**
 * Check if a date belongs to a specific day in patient's timezone
 * @param date The date to check
 * @param targetDateString ISO date string (YYYY-MM-DD)
 * @param timezone IANA timezone string
 * @returns True if the date belongs to the target day
 */
function belongsToDate(date, targetDateString, timezone) {
    const dateString = toISODateString(date, timezone);
    return dateString === targetDateString;
}
/**
 * Get current time in patient's timezone
 * @param timezone IANA timezone string
 * @returns Current date/time in patient's timezone
 */
function getCurrentTimeInTimezone(timezone) {
    const now = new Date();
    const tzString = now.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return new Date(tzString);
}
/**
 * Validate IANA timezone string
 * @param timezone Timezone string to validate
 * @returns True if valid IANA timezone
 */
function isValidTimezone(timezone) {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Get all patients who are at midnight in their timezone
 * This is used by the scheduled function to determine which patients need daily reset
 * @param allPatientTimezones Map of patientId to timezone
 * @param windowMinutes Window size in minutes (default: 15)
 * @returns Array of patient IDs who are at midnight
 */
function getPatientsAtMidnight(allPatientTimezones, windowMinutes = 15) {
    const patientsAtMidnight = [];
    for (const [patientId, timezone] of allPatientTimezones.entries()) {
        if (isWithinMidnightWindow(timezone, windowMinutes)) {
            patientsAtMidnight.push(patientId);
        }
    }
    return patientsAtMidnight;
}
