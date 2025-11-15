import { logger } from 'firebase-functions';
import { fetchWithRetry } from './network';

const RXNORM_APPROX_URL = 'https://rxnav.nlm.nih.gov/REST/approxMatch.json';
const RXNORM_PROPERTIES_URL = (rxcui: string) => `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;

// ===== Types =====

export type MedicationChangeType = 'new' | 'stopped' | 'modified';

export interface MedicationChangeGroup {
  new: any[];
  stopped: any[];
  modified: any[];
}

export interface MedicationVerificationDetails {
  isVerified: boolean;
  status: 'verified' | 'unverified' | 'ambiguous' | 'error';
  verificationSource: 'rxnorm' | 'openfda' | 'manual' | 'unknown';
  rxcui?: string;
  matchedName?: string;
  confidence?: number;
  warnings?: string[];
  lastCheckedAt: Date;
}

export interface MedicationVerificationSummary {
  totalMedications: number;
  verifiedCount: number;
  unverifiedCount: number;
  pendingCount: number;
  notes?: string[];
}

export interface MedicationVerificationOutcome {
  medications: MedicationChangeGroup;
  summary: MedicationVerificationSummary;
  notes: string[];
}

// ===== Public API =====

export async function verifyMedicationChanges(
  medications?: Partial<MedicationChangeGroup> | null
): Promise<MedicationVerificationOutcome | null> {
  const sanitized = sanitizeMedicationGroups(medications);
  const allEntries = [...sanitized.new, ...sanitized.stopped, ...sanitized.modified];

  if (allEntries.length === 0) {
    return null;
  }

  const verificationMap = new Map<string, MedicationVerificationDetails>();
  const nameMap = new Map<string, string>();

  for (const entry of allEntries) {
    const normalized = normalizeMedicationName(entry.name);
    if (normalized && !nameMap.has(normalized)) {
      nameMap.set(normalized, entry.name);
    }
  }

  for (const [normalizedName, originalName] of nameMap.entries()) {
    const details = await lookupMedicationName(originalName);
    verificationMap.set(normalizedName, details);
  }

  const notes: string[] = [];
  let verifiedCount = 0;
  let unverifiedCount = 0;
  let pendingCount = 0;

  const attachVerification = (entry: any) => {
    const normalized = normalizeMedicationName(entry.name);
    const details = verificationMap.get(normalized) ?? buildDefaultVerification();
    entry.verification = details;

    if (details.status === 'verified') {
      verifiedCount++;
    } else if (details.status === 'error') {
      pendingCount++;
      notes.push(`Automatic verification of "${entry.name}" failed. Please confirm manually.`);
    } else if (details.status === 'ambiguous') {
      unverifiedCount++;
      notes.push(`Medication "${entry.name}" may be ambiguous: ${details.warnings?.[0] || 'Please confirm with provider.'}`);
    } else {
      unverifiedCount++;
      const warning = details.warnings?.[0];
      notes.push(
        warning
          ? `Medication "${entry.name}" may be incorrect: ${warning}`
          : `Medication "${entry.name}" could not be verified. Please confirm manually.`
      );
    }
  };

  sanitized.new.forEach(attachVerification);
  sanitized.stopped.forEach(attachVerification);
  sanitized.modified.forEach(attachVerification);

  const uniqueNotes = Array.from(new Set(notes)).slice(0, 10);

  const summary: MedicationVerificationSummary = {
    totalMedications: allEntries.length,
    verifiedCount,
    unverifiedCount,
    pendingCount,
    notes: uniqueNotes.length > 0 ? uniqueNotes : undefined
  };

  logger.info('🧪 Medication verification completed', summary);

  return {
    medications: sanitized,
    summary,
    notes: uniqueNotes
  };
}

// ===== Internal Helpers =====

function sanitizeMedicationGroups(source?: Partial<MedicationChangeGroup> | null): MedicationChangeGroup {
  return {
    new: sanitizeMedicationArray(source?.new, 'new'),
    stopped: sanitizeMedicationArray(source?.stopped ?? (source as any)?.stoppedMedications, 'stopped'),
    modified: sanitizeMedicationArray(source?.modified ?? (source as any)?.modifiedMedications ?? (source as any)?.changed, 'modified')
  };
}

function sanitizeMedicationArray(value: any, changeType: MedicationChangeType): any[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => normalizeMedicationChange(entry, changeType));
}

function normalizeMedicationChange(entry: any, changeType: MedicationChangeType): any {
  const name = typeof entry.name === 'string' ? entry.name.trim() : typeof entry.medication === 'string' ? entry.medication.trim() : '';

  const base: any = {
    changeType,
    name,
    dosage: entry.dosage ?? entry.dose ?? entry.strength ?? '',
    instructions: entry.instructions ?? entry.notes ?? entry.howToTake ?? '',
    startDate: entry.startDate ?? entry.beginDate ?? null,
    reason: entry.reason ?? entry.notes ?? ''
  };

  if (changeType === 'stopped') {
    base.stopDate = entry.stopDate ?? entry.endDate ?? null;
  }

  if (changeType === 'modified') {
    base.oldDosage = entry.oldDosage ?? entry.previousDosage ?? entry.oldDose ?? '';
    base.newDosage = entry.newDosage ?? entry.updatedDosage ?? entry.newDose ?? entry.dosage ?? '';
    base.changeReason = entry.changeReason ?? entry.reason ?? '';
  }

  if (entry.verification && typeof entry.verification === 'object') {
    base.verification = sanitizeVerificationData(entry.verification);
  }

  return {
    ...entry,
    ...base
  };
}

function sanitizeVerificationData(raw: any): MedicationVerificationDetails {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((warning: any) => typeof warning === 'string')
    : undefined;

  const confidenceRaw = typeof raw.confidence === 'string' ? parseFloat(raw.confidence) : raw.confidence;
  const confidence = typeof confidenceRaw === 'number' && !Number.isNaN(confidenceRaw)
    ? Math.max(0, Math.min(confidenceRaw, 1))
    : undefined;

  const status = raw.status === 'verified' || raw.status === 'error' || raw.status === 'unverified' || raw.status === 'ambiguous'
    ? raw.status
    : raw.isVerified
      ? 'verified'
      : 'unverified';

  return {
    isVerified: Boolean(raw.isVerified),
    status,
    verificationSource: mapVerificationSource(raw.verificationSource),
    rxcui: typeof raw.rxcui === 'string' ? raw.rxcui : undefined,
    matchedName: typeof raw.matchedName === 'string' ? raw.matchedName : undefined,
    confidence,
    warnings,
    lastCheckedAt: raw.lastCheckedAt ? new Date(raw.lastCheckedAt) : new Date()
  };
}

function mapVerificationSource(source: any): 'rxnorm' | 'openfda' | 'manual' | 'unknown' {
  switch (source) {
    case 'rxnorm':
    case 'openfda':
    case 'manual':
      return source;
    default:
      return 'unknown';
  }
}

function normalizeMedicationName(name: any): string {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function buildDefaultVerification(): MedicationVerificationDetails {
  return {
    isVerified: false,
    status: 'unverified',
    verificationSource: 'unknown',
    warnings: ['Verification data unavailable'],
    lastCheckedAt: new Date()
  };
}

async function lookupMedicationName(originalName: string): Promise<MedicationVerificationDetails> {
  const trimmedName = originalName.trim();

  if (!trimmedName) {
    return buildDefaultVerification();
  }

  const url = `${RXNORM_APPROX_URL}?term=${encodeURIComponent(trimmedName)}&maxEntries=5`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`RxNorm lookup failed with status ${response.status}`);
    }

    const data = await response.json();
    const candidates: any[] | undefined = data?.approxGroup?.candidate;

    if (Array.isArray(candidates) && candidates.length > 0) {
      const topCandidate = selectBestCandidate(candidates);
      const scoreRaw = typeof topCandidate.score === 'string'
        ? parseFloat(topCandidate.score)
        : topCandidate.score;
      const confidence = typeof scoreRaw === 'number' && !Number.isNaN(scoreRaw)
        ? Math.max(0, Math.min(scoreRaw / 100, 1))
        : undefined;

      const properties = await fetchRxNormProperties(topCandidate.rxcui);

      return {
        isVerified: true,
        status: confidence && confidence < 0.75 ? 'ambiguous' : 'verified',
        verificationSource: 'rxnorm',
        rxcui: typeof topCandidate.rxcui === 'string' ? topCandidate.rxcui : undefined,
        matchedName: properties?.name || topCandidate.term || trimmedName,
        confidence,
        warnings: buildVerificationWarnings(confidence, trimmedName, properties?.name),
        lastCheckedAt: new Date()
      };
    }

    return {
      isVerified: false,
      status: 'unverified',
      verificationSource: 'rxnorm',
      warnings: ['No RxNorm match found'],
      lastCheckedAt: new Date()
    };

  } catch (error) {
    logger.warn('⚠️ Medication verification request failed', {
      medicationName: originalName,
      error: error instanceof Error ? error.message : error
    });

    return {
      isVerified: false,
      status: 'error',
      verificationSource: 'unknown',
      warnings: [error instanceof Error ? error.message : 'Unknown error encountered during verification'],
      lastCheckedAt: new Date()
    };
  }
}

function selectBestCandidate(candidates: any[]): any {
  const sorted = [...candidates].sort((a, b) => {
    const scoreA = typeof a.score === 'string' ? parseFloat(a.score) : a.score ?? 0;
    const scoreB = typeof b.score === 'string' ? parseFloat(b.score) : b.score ?? 0;
    return scoreB - scoreA;
  });
  return sorted[0];
}

async function fetchRxNormProperties(rxcui?: string) {
  if (!rxcui) {
    return null;
  }

  const url = RXNORM_PROPERTIES_URL(encodeURIComponent(rxcui));

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`RxNorm properties lookup failed with status ${response.status}`);
    }
    const data = await response.json();
    return data?.properties || null;
  } catch (error) {
    logger.debug('RxNorm properties lookup failed', {
      rxcui,
      error: error instanceof Error ? error.message : error
    });
    return null;
  }
}
function buildVerificationWarnings(confidence: number | undefined, originalName: string, matchedName?: string) {
  const warnings: string[] = [];

  if (confidence !== undefined && confidence < 0.75) {
    warnings.push('Low confidence match — please verify spelling with provider.');
  }

  if (matchedName && matchedName.toLowerCase() !== originalName.trim().toLowerCase()) {
    warnings.push(`Matched to RxNorm name "${matchedName}".`);
  }

  return warnings.length > 0 ? warnings : undefined;
}

// ===== ENHANCED VALIDATION UTILITIES =====

/**
 * Comprehensive medication data validation
 */
export interface MedicationValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'info';
  code: string;
}

/**
 * Validate complete medication data
 */
export function validateMedicationData(data: any): MedicationValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Required field validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Medication name is required',
      severity: 'critical',
      code: 'REQUIRED_FIELD_MISSING'
    });
    suggestions.push('Enter the medication name as prescribed by your healthcare provider');
  }

  if (!data.dosage || typeof data.dosage !== 'string' || data.dosage.trim().length === 0) {
    errors.push({
      field: 'dosage',
      message: 'Dosage is required',
      severity: 'error',
      code: 'REQUIRED_FIELD_MISSING'
    });
    suggestions.push('Specify the dosage (e.g., "10mg", "1 tablet", "5ml")');
  }

  // Dosage format validation
  if (data.dosage && !validateDosageFormat(data.dosage)) {
    warnings.push({
      field: 'dosage',
      message: 'Dosage format may be incorrect',
      severity: 'warning',
      code: 'INVALID_FORMAT'
    });
    suggestions.push('Use standard dosage format: number + unit (e.g., "10mg", "2 tablets")');
  }

  // Name validation
  if (data.name && data.name.length < 2) {
    errors.push({
      field: 'name',
      message: 'Medication name is too short',
      severity: 'error',
      code: 'INVALID_LENGTH'
    });
  }

  if (data.name && data.name.length > 200) {
    errors.push({
      field: 'name',
      message: 'Medication name is too long',
      severity: 'error',
      code: 'INVALID_LENGTH'
    });
  }

  // Check for potentially dangerous characters
  if (data.name && /[<>{}]/.test(data.name)) {
    errors.push({
      field: 'name',
      message: 'Medication name contains invalid characters',
      severity: 'error',
      code: 'INVALID_CHARACTERS'
    });
  }

  // Instructions validation
  if (data.instructions && data.instructions.length > 1000) {
    warnings.push({
      field: 'instructions',
      message: 'Instructions are very long',
      severity: 'warning',
      code: 'EXCESSIVE_LENGTH'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Validate medication schedule
 */
export function validateSchedule(schedule: any): MedicationValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Frequency validation
  const validFrequencies = ['daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'weekly', 'monthly', 'as_needed', 'custom'];
  if (!schedule.frequency || !validFrequencies.includes(schedule.frequency)) {
    errors.push({
      field: 'frequency',
      message: 'Invalid frequency',
      severity: 'critical',
      code: 'INVALID_VALUE'
    });
    suggestions.push(`Frequency must be one of: ${validFrequencies.join(', ')}`);
  }

  // Times validation
  if (!schedule.times || !Array.isArray(schedule.times) || schedule.times.length === 0) {
    if (schedule.frequency !== 'as_needed') {
      errors.push({
        field: 'times',
        message: 'Schedule times are required',
        severity: 'critical',
        code: 'REQUIRED_FIELD_MISSING'
      });
      suggestions.push('Add at least one time in HH:MM format (e.g., "08:00")');
    }
  } else {
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const invalidTimes = schedule.times.filter((time: string) => !timeRegex.test(time));
    
    if (invalidTimes.length > 0) {
      errors.push({
        field: 'times',
        message: `Invalid time format: ${invalidTimes.join(', ')}`,
        severity: 'error',
        code: 'INVALID_FORMAT'
      });
      suggestions.push('Use 24-hour HH:MM format (e.g., "07:00", "19:30")');
    }

    // Check for duplicate times
    const uniqueTimes = new Set(schedule.times);
    if (uniqueTimes.size < schedule.times.length) {
      warnings.push({
        field: 'times',
        message: 'Duplicate times detected',
        severity: 'warning',
        code: 'DUPLICATE_VALUES'
      });
    }

    // Validate time count matches frequency
    const expectedCounts: Record<string, number> = {
      'daily': 1,
      'twice_daily': 2,
      'three_times_daily': 3,
      'four_times_daily': 4
    };

    const expectedCount = expectedCounts[schedule.frequency];
    if (expectedCount && schedule.times.length !== expectedCount) {
      warnings.push({
        field: 'times',
        message: `${schedule.frequency} typically uses ${expectedCount} time(s), but ${schedule.times.length} provided`,
        severity: 'warning',
        code: 'INCONSISTENT_COUNT'
      });
    }
  }

  // Date validation
  if (!schedule.startDate) {
    errors.push({
      field: 'startDate',
      message: 'Start date is required',
      severity: 'critical',
      code: 'REQUIRED_FIELD_MISSING'
    });
  } else {
    const startDate = new Date(schedule.startDate);
    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'startDate',
        message: 'Invalid start date',
        severity: 'error',
        code: 'INVALID_DATE'
      });
    }
  }

  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'endDate',
        message: 'Invalid end date',
        severity: 'error',
        code: 'INVALID_DATE'
      });
    } else if (schedule.startDate) {
      const startDate = new Date(schedule.startDate);
      if (endDate <= startDate) {
        errors.push({
          field: 'endDate',
          message: 'End date must be after start date',
          severity: 'error',
          code: 'INVALID_DATE_RANGE'
        });
      }
    }
  }

  // Dosage amount validation
  if (!schedule.dosageAmount) {
    warnings.push({
      field: 'dosageAmount',
      message: 'Dosage amount not specified',
      severity: 'warning',
      code: 'MISSING_OPTIONAL_FIELD'
    });
    suggestions.push('Specify dosage amount for clarity');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Validate dosage format
 */
export function validateDosageFormat(dosage: string): boolean {
  // Common dosage patterns
  const patterns = [
    /^\d+(\.\d+)?\s*(mg|g|mcg|ml|l|tablet|tablets|capsule|capsules|pill|pills|unit|units|drop|drops|spray|sprays|puff|puffs|patch|patches)$/i,
    /^\d+\/\d+\s*(mg|g|mcg|ml|l|tablet|tablets)$/i, // Fractions like 1/2 tablet
    /^\d+(\.\d+)?\s*to\s*\d+(\.\d+)?\s*(mg|g|mcg|ml|l)$/i // Ranges like 5 to 10mg
  ];

  return patterns.some(pattern => pattern.test(dosage.trim()));
}

/**
 * Cross-field validation (PRN + scheduled times)
 */
export function validateCrossFields(data: any): MedicationValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // PRN medications shouldn't have scheduled times
  if (data.status?.isPRN && data.schedule?.times && data.schedule.times.length > 0) {
    warnings.push({
      field: 'schedule',
      message: 'PRN medications typically do not have scheduled times',
      severity: 'warning',
      code: 'INCONSISTENT_CONFIGURATION'
    });
    suggestions.push('Consider removing scheduled times for PRN medications, or change to non-PRN');
  }

  // Non-PRN medications should have times
  if (data.status?.isPRN === false && data.schedule?.frequency !== 'as_needed' &&
      (!data.schedule?.times || data.schedule.times.length === 0)) {
    errors.push({
      field: 'schedule',
      message: 'Non-PRN medications must have scheduled times',
      severity: 'error',
      code: 'REQUIRED_FIELD_MISSING'
    });
  }

  // Frequency consistency
  if (data.schedule?.frequency === 'as_needed' && data.status?.isPRN === false) {
    warnings.push({
      field: 'frequency',
      message: 'Frequency is "as_needed" but medication is not marked as PRN',
      severity: 'warning',
      code: 'INCONSISTENT_CONFIGURATION'
    });
    suggestions.push('Mark medication as PRN or change frequency');
  }

  // Indefinite schedule validation
  if (data.schedule?.isIndefinite === true && data.schedule?.endDate) {
    warnings.push({
      field: 'schedule',
      message: 'Schedule is marked as indefinite but has an end date',
      severity: 'warning',
      code: 'INCONSISTENT_CONFIGURATION'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Comprehensive validation combining all checks
 */
export function validateCompleteMedication(data: any): MedicationValidationResult {
  const medicationValidation = validateMedicationData(data.medication || data);
  const scheduleValidation = validateSchedule(data.schedule || {});
  const crossFieldValidation = validateCrossFields(data);

  return {
    isValid: medicationValidation.isValid && scheduleValidation.isValid && crossFieldValidation.isValid,
    errors: [
      ...medicationValidation.errors,
      ...scheduleValidation.errors,
      ...crossFieldValidation.errors
    ],
    warnings: [
      ...medicationValidation.warnings,
      ...scheduleValidation.warnings,
      ...crossFieldValidation.warnings
    ],
    suggestions: [
      ...medicationValidation.suggestions,
      ...scheduleValidation.suggestions,
      ...crossFieldValidation.suggestions
    ]
  };
}



