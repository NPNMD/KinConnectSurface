"use strict";
/**
 * Proof-of-Concept Unified Medication Model
 *
 * This is a simplified version of the full unified medication model
 * designed to validate the approach before full-scale migration.
 *
 * POC Goals:
 * 1. Demonstrate combining 3 collections into 1 unified document
 * 2. Prove single-read efficiency
 * 3. Validate data integrity during migration
 * 4. Test ACID transaction capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POC_DEFAULT_GRACE_PERIODS = void 0;
exports.determineMedicationType = determineMedicationType;
/**
 * Helper function to determine medication type for grace period
 */
function determineMedicationType(medicationName, frequency) {
    const nameLower = medicationName.toLowerCase();
    const freqLower = frequency.toLowerCase();
    // PRN medications
    if (freqLower.includes('as needed') || freqLower.includes('prn')) {
        return 'prn';
    }
    // Critical medications (examples)
    const criticalKeywords = ['insulin', 'heart', 'cardiac', 'blood thinner', 'warfarin', 'anticoagulant'];
    if (criticalKeywords.some(keyword => nameLower.includes(keyword))) {
        return 'critical';
    }
    // Vitamins and supplements
    const vitaminKeywords = ['vitamin', 'supplement', 'multivitamin', 'calcium', 'iron', 'omega'];
    if (vitaminKeywords.some(keyword => nameLower.includes(keyword))) {
        return 'vitamin';
    }
    // Default to standard
    return 'standard';
}
/**
 * Default grace periods by medication type
 */
exports.POC_DEFAULT_GRACE_PERIODS = {
    critical: 15,
    standard: 30,
    vitamin: 120,
    prn: 0
};
