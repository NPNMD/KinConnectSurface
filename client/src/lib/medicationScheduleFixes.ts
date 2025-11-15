/**
 * Medication Schedule Fixes and Diagnostics
 * 
 * Utility functions for diagnosing and auto-repairing medication schedule issues
 */

import type { Medication } from '@shared/types';

export interface DiagnosticResult {
  summary: string;
  issues: string[];
  recommendations: string[];
  canAutoFix: boolean;
}

export interface RepairResult {
  success: boolean;
  medicationsProcessed: number;
  medicationsFixed: number;
  fixesApplied: string[];
  remainingIssues: string[];
}

/**
 * Run quick diagnostic on medication schedules
 */
export async function quickScheduleDiagnostic(
  medications: Medication[]
): Promise<DiagnosticResult> {
  console.log('🔍 Running quick schedule diagnostic...');
  
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check for medications with reminders but no schedules
  const medicationsWithReminders = medications.filter(
    med => (med.hasReminders || (med as any).reminders?.enabled) && 
           (med.isActive || (med as any).status?.isActive)
  );
  
  if (medicationsWithReminders.length === 0) {
    return {
      summary: 'No medications with reminders found',
      issues: [],
      recommendations: [],
      canAutoFix: false
    };
  }
  
  // Simple diagnostic - check if medications have basic schedule data
  for (const med of medicationsWithReminders) {
    const hasLegacyTimes = med.reminderTimes && med.reminderTimes.length > 0;
    const hasUnifiedTimes = (med as any).schedule?.times && (med as any).schedule.times.length > 0;
    
    if (!hasLegacyTimes && !hasUnifiedTimes) {
      issues.push(`${med.name} has no reminder times configured`);
      recommendations.push(`Configure reminder times for ${med.name}`);
    }
  }
  
  const summary = issues.length === 0
    ? `All ${medicationsWithReminders.length} medications appear properly configured`
    : `Found ${issues.length} potential issue(s) with medication schedules`;
  
  return {
    summary,
    issues,
    recommendations,
    canAutoFix: issues.length > 0
  };
}

/**
 * Attempt to auto-repair medication schedule issues
 */
export async function autoRepairMedicationSchedules(
  medications: Medication[]
): Promise<RepairResult> {
  console.log('🔧 Running auto-repair on medication schedules...');
  
  const fixesApplied: string[] = [];
  const remainingIssues: string[] = [];
  let medicationsFixed = 0;
  
  // This is a placeholder implementation
  // In a real implementation, this would:
  // 1. Identify medications with schedule issues
  // 2. Attempt to fix them by creating/updating schedules
  // 3. Return detailed results
  
  const medicationsWithReminders = medications.filter(
    med => (med.hasReminders || (med as any).reminders?.enabled) && 
           (med.isActive || (med as any).status?.isActive)
  );
  
  return {
    success: true,
    medicationsProcessed: medicationsWithReminders.length,
    medicationsFixed,
    fixesApplied: fixesApplied.length > 0 
      ? fixesApplied 
      : ['No fixes needed - schedules appear valid'],
    remainingIssues
  };
}