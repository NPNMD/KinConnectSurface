"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GracePeriodEngine = exports.DEFAULT_GRACE_PERIODS = void 0;
const admin = __importStar(require("firebase-admin"));
exports.DEFAULT_GRACE_PERIODS = {
    critical: {
        morning: 15, // Heart meds, diabetes
        noon: 20,
        evening: 15,
        bedtime: 30
    },
    standard: {
        morning: 30, // Blood pressure, cholesterol
        noon: 45,
        evening: 30,
        bedtime: 60
    },
    vitamin: {
        morning: 120, // Vitamins, supplements
        noon: 180,
        evening: 120,
        bedtime: 240
    },
    prn: {
        all: 0 // No grace period for as-needed meds
    }
};
class GracePeriodEngine {
    firestore = admin.firestore();
    holidayCache = new Map();
    /**
     * Calculate the grace period for a specific medication event
     */
    async calculateGracePeriod(event, patientId, currentTime = new Date()) {
        // Get patient grace period configuration
        const patientConfig = await this.getPatientGraceConfig(patientId);
        // Determine time slot
        const timeSlot = this.getTimeSlot(event.scheduledDateTime.toDate(), patientConfig);
        // Start with default grace period for time slot
        let gracePeriod = patientConfig.defaultGracePeriods[timeSlot];
        const appliedRules = [`default_${timeSlot}`];
        const ruleDetails = [{
                ruleName: `Default ${timeSlot}`,
                ruleType: 'time_slot_default',
                value: gracePeriod,
                reason: `Default grace period for ${timeSlot} medications`
            }];
        // Apply medication-specific override
        const medicationOverride = await this.getMedicationOverride(event.medicationId, patientConfig);
        if (medicationOverride) {
            gracePeriod = medicationOverride.gracePeriodMinutes;
            appliedRules.push(`medication_override`);
            ruleDetails.push({
                ruleName: 'Medication Override',
                ruleType: 'medication_specific',
                value: medicationOverride.gracePeriodMinutes,
                reason: medicationOverride.reason
            });
        }
        // Apply medication type rules (critical, standard, etc.)
        const medicationType = await this.getMedicationType(event.medicationId);
        const typeRule = patientConfig.medicationTypeRules?.find((rule) => rule.medicationType === medicationType);
        if (typeRule) {
            gracePeriod = Math.min(gracePeriod, typeRule.gracePeriodMinutes);
            appliedRules.push(`type_${medicationType}`);
            ruleDetails.push({
                ruleName: `${medicationType} Medication`,
                ruleType: 'medication_type',
                value: typeRule.gracePeriodMinutes,
                reason: `Grace period for ${medicationType} medications`
            });
        }
        // Apply special circumstance multipliers
        const isWeekend = this.isWeekend(currentTime);
        const isHoliday = await this.isHoliday(currentTime);
        let multiplier = 1.0;
        if (isWeekend && patientConfig.weekendMultiplier !== 1.0) {
            multiplier *= patientConfig.weekendMultiplier;
            appliedRules.push('weekend_multiplier');
            ruleDetails.push({
                ruleName: 'Weekend Extension',
                ruleType: 'circumstance_multiplier',
                value: patientConfig.weekendMultiplier,
                reason: 'Extended grace period for weekends'
            });
        }
        if (isHoliday && patientConfig.holidayMultiplier !== 1.0) {
            multiplier *= patientConfig.holidayMultiplier;
            appliedRules.push('holiday_multiplier');
            ruleDetails.push({
                ruleName: 'Holiday Extension',
                ruleType: 'circumstance_multiplier',
                value: patientConfig.holidayMultiplier,
                reason: 'Extended grace period for holidays'
            });
        }
        // Apply multiplier
        const finalGracePeriod = Math.round(gracePeriod * multiplier);
        const gracePeriodEnd = new Date(event.scheduledDateTime.toDate().getTime() + (finalGracePeriod * 60 * 1000));
        return {
            gracePeriodMinutes: finalGracePeriod,
            gracePeriodEnd,
            appliedRules,
            ruleDetails,
            isWeekend,
            isHoliday,
            finalMultiplier: multiplier
        };
    }
    /**
     * Get patient grace period configuration or return defaults
     */
    async getPatientGraceConfig(patientId) {
        try {
            // First check for dedicated grace period config
            const configDoc = await this.firestore.collection('medication_grace_periods').doc(patientId).get();
            if (configDoc.exists) {
                return configDoc.data();
            }
            // Fallback to patient medication preferences
            const prefsDoc = await this.firestore.collection('patient_medication_preferences').doc(patientId).get();
            if (prefsDoc.exists) {
                const prefsData = prefsDoc.data();
                if (prefsData?.gracePeriodSettings) {
                    return prefsData.gracePeriodSettings;
                }
            }
            // Return default configuration
            return this.getDefaultGraceConfig();
        }
        catch (error) {
            console.warn('Error getting patient grace config, using defaults:', error);
            return this.getDefaultGraceConfig();
        }
    }
    /**
     * Get default grace period configuration
     */
    getDefaultGraceConfig() {
        return {
            defaultGracePeriods: {
                morning: 30,
                noon: 45,
                evening: 30,
                bedtime: 60
            },
            medicationOverrides: [],
            medicationTypeRules: [
                { medicationType: 'critical', gracePeriodMinutes: 15 },
                { medicationType: 'standard', gracePeriodMinutes: 30 },
                { medicationType: 'vitamin', gracePeriodMinutes: 120 },
                { medicationType: 'prn', gracePeriodMinutes: 0 }
            ],
            weekendMultiplier: 1.5,
            holidayMultiplier: 2.0,
            sickDayMultiplier: 3.0
        };
    }
    /**
     * Get medication-specific override if exists
     */
    async getMedicationOverride(medicationId, config) {
        if (!config.medicationOverrides || !Array.isArray(config.medicationOverrides)) {
            return null;
        }
        return config.medicationOverrides.find((override) => override.medicationId === medicationId);
    }
    /**
     * Determine time slot for a scheduled time
     */
    getTimeSlot(scheduledTime, config) {
        const timeStr = scheduledTime.toTimeString().slice(0, 5);
        // Get time slots from patient preferences or use defaults
        const timeSlots = config.timeSlots || {
            morning: { start: '06:00', end: '10:00' },
            noon: { start: '11:00', end: '14:00' },
            evening: { start: '17:00', end: '20:00' },
            bedtime: { start: '21:00', end: '23:59' }
        };
        for (const [slot, slotConfig] of Object.entries(timeSlots)) {
            const slotData = slotConfig;
            if (this.isTimeInRange(timeStr, slotData.start, slotData.end)) {
                return slot;
            }
        }
        return 'morning'; // Default fallback
    }
    /**
     * Check if time is within a range (handles overnight ranges)
     */
    isTimeInRange(time, start, end) {
        // Handle overnight ranges (e.g., 23:00 to 02:00)
        if (start > end) {
            return time >= start || time <= end;
        }
        return time >= start && time <= end;
    }
    /**
     * Classify medication type for grace period rules
     */
    async getMedicationType(medicationId) {
        try {
            const medicationDoc = await this.firestore.collection('medications').doc(medicationId).get();
            const medication = medicationDoc.data();
            if (!medication)
                return 'standard';
            // Check if explicitly marked as PRN
            if (medication.isPRN) {
                return 'prn';
            }
            // Classify based on medication properties
            const name = medication.name.toLowerCase();
            const genericName = medication.genericName?.toLowerCase() || '';
            // Critical medications (time-sensitive)
            const criticalMeds = [
                'insulin', 'metformin', 'lisinopril', 'atorvastatin', 'metoprolol',
                'warfarin', 'digoxin', 'levothyroxine', 'prednisone', 'amlodipine',
                'losartan', 'carvedilol', 'enalapril', 'furosemide', 'spironolactone',
                'diltiazem', 'verapamil', 'propranolol', 'atenolol', 'bisoprolol'
            ];
            if (criticalMeds.some(med => name.includes(med) || genericName.includes(med))) {
                return 'critical';
            }
            // Vitamins and supplements
            const vitaminKeywords = [
                'vitamin', 'supplement', 'calcium', 'iron', 'magnesium', 'zinc',
                'multivitamin', 'omega', 'fish oil', 'coq10', 'biotin', 'folic acid',
                'b12', 'b6', 'thiamine', 'riboflavin', 'niacin', 'pantothenic'
            ];
            if (vitaminKeywords.some(keyword => name.includes(keyword) || genericName.includes(keyword))) {
                return 'vitamin';
            }
            return 'standard';
        }
        catch (error) {
            console.warn('Error classifying medication type, defaulting to standard:', error);
            return 'standard';
        }
    }
    /**
     * Check if date is a weekend
     */
    isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }
    /**
     * Check if date is a holiday (with caching)
     */
    async isHoliday(date) {
        const dateKey = date.toISOString().split('T')[0];
        if (this.holidayCache.has(dateKey)) {
            return this.holidayCache.get(dateKey);
        }
        // Simple holiday detection (can be enhanced with external API)
        const holidays = this.getUSHolidays(date.getFullYear());
        const isHoliday = holidays.some(holiday => holiday.toISOString().split('T')[0] === dateKey);
        this.holidayCache.set(dateKey, isHoliday);
        return isHoliday;
    }
    /**
     * Get US holidays for a given year
     */
    getUSHolidays(year) {
        return [
            new Date(year, 0, 1), // New Year's Day
            this.getMLKDay(year), // Martin Luther King Jr. Day (3rd Monday in January)
            this.getPresidentsDay(year), // Presidents Day (3rd Monday in February)
            this.getMemorialDay(year), // Memorial Day (last Monday in May)
            new Date(year, 6, 4), // Independence Day
            this.getLaborDay(year), // Labor Day (1st Monday in September)
            this.getColumbusDay(year), // Columbus Day (2nd Monday in October)
            new Date(year, 10, 11), // Veterans Day
            this.getThanksgiving(year), // Thanksgiving (4th Thursday in November)
            new Date(year, 11, 25), // Christmas Day
        ];
    }
    /**
     * Calculate MLK Day (3rd Monday in January)
     */
    getMLKDay(year) {
        const january = new Date(year, 0, 1);
        const firstMonday = new Date(year, 0, 1 + (8 - january.getDay()) % 7);
        return new Date(year, 0, firstMonday.getDate() + 14); // 3rd Monday
    }
    /**
     * Calculate Presidents Day (3rd Monday in February)
     */
    getPresidentsDay(year) {
        const february = new Date(year, 1, 1);
        const firstMonday = new Date(year, 1, 1 + (8 - february.getDay()) % 7);
        return new Date(year, 1, firstMonday.getDate() + 14); // 3rd Monday
    }
    /**
     * Calculate Memorial Day (last Monday in May)
     */
    getMemorialDay(year) {
        const may31 = new Date(year, 4, 31);
        const lastMonday = new Date(year, 4, 31 - (may31.getDay() + 6) % 7);
        return lastMonday;
    }
    /**
     * Calculate Labor Day (1st Monday in September)
     */
    getLaborDay(year) {
        const september = new Date(year, 8, 1);
        const firstMonday = new Date(year, 8, 1 + (8 - september.getDay()) % 7);
        return firstMonday;
    }
    /**
     * Calculate Columbus Day (2nd Monday in October)
     */
    getColumbusDay(year) {
        const october = new Date(year, 9, 1);
        const firstMonday = new Date(year, 9, 1 + (8 - october.getDay()) % 7);
        return new Date(year, 9, firstMonday.getDate() + 7); // 2nd Monday
    }
    /**
     * Calculate Thanksgiving (4th Thursday in November)
     */
    getThanksgiving(year) {
        const november = new Date(year, 10, 1);
        const firstThursday = new Date(year, 10, 1 + (11 - november.getDay()) % 7);
        return new Date(year, 10, firstThursday.getDate() + 21); // 4th Thursday
    }
    /**
     * Get grace period for a specific event (public method for external use)
     */
    async getGracePeriodForEvent(event) {
        try {
            const calculation = await this.calculateGracePeriod(event, event.patientId);
            return calculation.gracePeriodMinutes;
        }
        catch (error) {
            console.warn('Error calculating grace period, using default:', error);
            // Return default based on time of day
            const hour = event.scheduledDateTime.toDate().getHours();
            if (hour >= 6 && hour < 11)
                return 30; // morning
            if (hour >= 11 && hour < 17)
                return 45; // noon/afternoon
            if (hour >= 17 && hour < 21)
                return 30; // evening
            return 60; // bedtime/night
        }
    }
    /**
     * Create default grace period configuration for a patient
     */
    async createDefaultGracePeriodConfig(patientId) {
        try {
            const defaultConfig = {
                patientId,
                ...this.getDefaultGraceConfig(),
                isActive: true,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            await this.firestore.collection('medication_grace_periods').doc(patientId).set(defaultConfig);
            console.log('✅ Created default grace period config for patient:', patientId);
        }
        catch (error) {
            console.error('❌ Error creating default grace period config:', error);
            throw error;
        }
    }
    /**
     * Update patient grace period configuration
     */
    async updatePatientGraceConfig(patientId, updates) {
        try {
            const updateData = {
                ...updates,
                patientId,
                updatedAt: admin.firestore.Timestamp.now()
            };
            await this.firestore.collection('medication_grace_periods').doc(patientId).set(updateData, { merge: true });
            console.log('✅ Updated grace period config for patient:', patientId);
        }
        catch (error) {
            console.error('❌ Error updating grace period config:', error);
            throw error;
        }
    }
    /**
     * Validate grace period configuration
     */
    validateGracePeriodConfig(config) {
        const errors = [];
        // Validate default grace periods
        if (!config.defaultGracePeriods) {
            errors.push('Default grace periods are required');
        }
        else {
            const slots = ['morning', 'noon', 'evening', 'bedtime'];
            slots.forEach(slot => {
                const value = config.defaultGracePeriods[slot];
                if (typeof value !== 'number' || value < 0 || value > 480) {
                    errors.push(`Invalid grace period for ${slot}: must be between 0 and 480 minutes`);
                }
            });
        }
        // Validate medication type rules
        if (config.medicationTypeRules && Array.isArray(config.medicationTypeRules)) {
            config.medicationTypeRules.forEach((rule, index) => {
                if (!rule.medicationType || !['critical', 'standard', 'prn', 'vitamin'].includes(rule.medicationType)) {
                    errors.push(`Invalid medication type in rule ${index + 1}`);
                }
                if (typeof rule.gracePeriodMinutes !== 'number' || rule.gracePeriodMinutes < 0 || rule.gracePeriodMinutes > 480) {
                    errors.push(`Invalid grace period minutes in medication type rule ${index + 1}`);
                }
            });
        }
        // Validate multipliers
        if (config.weekendMultiplier !== undefined) {
            if (typeof config.weekendMultiplier !== 'number' || config.weekendMultiplier < 0.1 || config.weekendMultiplier > 5.0) {
                errors.push('Weekend multiplier must be between 0.1 and 5.0');
            }
        }
        if (config.holidayMultiplier !== undefined) {
            if (typeof config.holidayMultiplier !== 'number' || config.holidayMultiplier < 0.1 || config.holidayMultiplier > 5.0) {
                errors.push('Holiday multiplier must be between 0.1 and 5.0');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
exports.GracePeriodEngine = GracePeriodEngine;
