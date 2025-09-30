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


