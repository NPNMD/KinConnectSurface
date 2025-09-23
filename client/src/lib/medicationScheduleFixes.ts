import { medicationCalendarApi } from './medicationCalendarApi';
import type { Medication } from '@shared/types';

/**
 * Comprehensive medication scheduling fixes and utilities
 * This module provides tools to diagnose and repair medication scheduling issues
 */

export interface ScheduleFixReport {
  timestamp: Date;
  medicationsAnalyzed: number;
  issuesFound: number;
  issuesFixed: number;
  remainingIssues: number;
  healthScoreImprovement: number;
  details: {
    beforeHealthCheck: any;
    afterHealthCheck: any;
    fixesApplied: string[];
    remainingProblems: string[];
  };
}

/**
 * Comprehensive fix for medication scheduling issues
 */
export async function fixMedicationSchedulingIssues(medications: Medication[]): Promise<ScheduleFixReport> {
  const report: ScheduleFixReport = {
    timestamp: new Date(),
    medicationsAnalyzed: 0,
    issuesFound: 0,
    issuesFixed: 0,
    remainingIssues: 0,
    healthScoreImprovement: 0,
    details: {
      beforeHealthCheck: null,
      afterHealthCheck: null,
      fixesApplied: [],
      remainingProblems: []
    }
  };

  try {
    console.log('🔧 Starting comprehensive medication scheduling fixes...');

    // Step 1: Perform initial health check
    console.log('📊 Step 1: Initial health assessment...');
    const initialHealthCheck = await medicationCalendarApi.performScheduleHealthCheck();
    
    if (initialHealthCheck.success && initialHealthCheck.data) {
      report.details.beforeHealthCheck = initialHealthCheck.data;
      report.medicationsAnalyzed = initialHealthCheck.data.medicationsWithReminders;
      report.issuesFound = initialHealthCheck.data.medicationsNeedingRepair;
      
      console.log('📊 Initial health score:', initialHealthCheck.data.overallHealthScore);
    }

    // Step 2: Run bulk schedule creation for missing schedules
    console.log('📅 Step 2: Creating missing schedules...');
    const bulkCreateResult = await medicationCalendarApi.createBulkSchedules();
    
    if (bulkCreateResult.success && bulkCreateResult.data) {
      if (bulkCreateResult.data.created > 0) {
        report.details.fixesApplied.push(`Created ${bulkCreateResult.data.created} missing schedules`);
        report.issuesFixed += bulkCreateResult.data.created;
      }
      
      if (bulkCreateResult.data.skipped > 0) {
        report.details.fixesApplied.push(`${bulkCreateResult.data.skipped} medications already had schedules`);
      }
      
      if (bulkCreateResult.data.errors && bulkCreateResult.data.errors.length > 0) {
        report.details.remainingProblems.push(...bulkCreateResult.data.errors);
      }
    }

    // Step 3: Generate missing calendar events
    console.log('📅 Step 3: Generating missing calendar events...');
    const generateEventsResult = await medicationCalendarApi.generateMissingCalendarEvents();
    
    if (generateEventsResult.success && generateEventsResult.data) {
      if (generateEventsResult.data.generated > 0) {
        report.details.fixesApplied.push(`Generated ${generateEventsResult.data.generated} missing calendar events`);
        report.issuesFixed += generateEventsResult.data.generated;
      }
    }

    // Step 4: Validate and repair data pipeline
    console.log('🔧 Step 4: Validating and repairing data pipeline...');
    const pipelineResult = await medicationCalendarApi.validateAndRepairDataPipeline();
    
    if (pipelineResult.repaired.length > 0) {
      report.details.fixesApplied.push(...pipelineResult.repaired);
    }
    
    if (pipelineResult.issues.length > 0) {
      report.details.remainingProblems.push(...pipelineResult.issues);
    }

    // Step 5: Clear caches to ensure fresh data
    console.log('🗑️ Step 5: Clearing caches for fresh data...');
    medicationCalendarApi.clearMedicationCaches();
    report.details.fixesApplied.push('Cleared medication caches for fresh data');

    // Step 6: Perform final health check
    console.log('📊 Step 6: Final health assessment...');
    const finalHealthCheck = await medicationCalendarApi.performScheduleHealthCheck();
    
    if (finalHealthCheck.success && finalHealthCheck.data) {
      report.details.afterHealthCheck = finalHealthCheck.data;
      report.remainingIssues = finalHealthCheck.data.medicationsNeedingRepair;
      
      // Calculate improvement
      const initialScore = report.details.beforeHealthCheck?.overallHealthScore || 0;
      const finalScore = finalHealthCheck.data.overallHealthScore;
      report.healthScoreImprovement = finalScore - initialScore;
      
      console.log('📊 Final health score:', finalScore, '(improvement:', report.healthScoreImprovement, ')');
    }

    console.log('✅ Comprehensive medication scheduling fixes completed:', report);
    
  } catch (error) {
    console.error('❌ Error during medication scheduling fixes:', error);
    report.details.remainingProblems.push(`Fix process error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return report;
}

/**
 * Quick diagnostic for medication scheduling issues
 */
export async function quickScheduleDiagnostic(medications: Medication[]): Promise<{
  summary: string;
  issues: string[];
  recommendations: string[];
  canAutoFix: boolean;
}> {
  try {
    console.log('🔍 Running quick schedule diagnostic...');
    
    const medicationsWithReminders = medications.filter(med => 
      med.hasReminders && med.isActive && !med.isPRN
    );
    
    if (medicationsWithReminders.length === 0) {
      return {
        summary: 'No medications with reminders found',
        issues: [],
        recommendations: ['Add medications with reminders enabled to see scheduling options'],
        canAutoFix: false
      };
    }

    const healthCheck = await medicationCalendarApi.performScheduleHealthCheck();
    
    if (!healthCheck.success || !healthCheck.data) {
      return {
        summary: 'Unable to perform health check',
        issues: ['Health check failed'],
        recommendations: ['Try refreshing the page and running the diagnostic again'],
        canAutoFix: false
      };
    }

    const data = healthCheck.data;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze issues
    if (data.medicationsNeedingRepair > 0) {
      issues.push(`${data.medicationsNeedingRepair} medication${data.medicationsNeedingRepair !== 1 ? 's' : ''} need${data.medicationsNeedingRepair === 1 ? 's' : ''} schedule repair`);
    }
    
    const errorIssues = data.issues.filter(issue => issue.severity === 'error');
    if (errorIssues.length > 0) {
      issues.push(`${errorIssues.length} critical validation error${errorIssues.length !== 1 ? 's' : ''} found`);
    }
    
    const warningIssues = data.issues.filter(issue => issue.severity === 'warning');
    if (warningIssues.length > 0) {
      issues.push(`${warningIssues.length} warning${warningIssues.length !== 1 ? 's' : ''} found`);
    }

    // Add recommendations
    recommendations.push(...data.recommendations);
    recommendations.push(...data.repairActions);

    const canAutoFix = data.medicationsNeedingRepair > 0 && errorIssues.length === 0;
    
    const summary = data.overallHealthScore >= 90 
      ? 'Medication schedules are in good health'
      : data.overallHealthScore >= 70
      ? 'Medication schedules have minor issues'
      : data.overallHealthScore >= 50
      ? 'Medication schedules need attention'
      : 'Medication schedules have serious issues';

    return {
      summary,
      issues,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      canAutoFix
    };
    
  } catch (error) {
    console.error('❌ Quick diagnostic failed:', error);
    return {
      summary: 'Diagnostic failed',
      issues: ['Unable to run diagnostic'],
      recommendations: ['Check console for errors and try again'],
      canAutoFix: false
    };
  }
}

/**
 * Validate a single medication's scheduling setup
 */
export async function validateMedicationScheduling(medication: Medication): Promise<{
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  hasSchedules: boolean;
  scheduleCount: number;
}> {
  try {
    console.log('🔍 Validating scheduling for medication:', medication.name);
    
    // Check if medication should have schedules
    if (!medication.hasReminders || !medication.isActive || medication.isPRN) {
      return {
        isValid: true,
        issues: [],
        suggestions: [],
        hasSchedules: false,
        scheduleCount: 0
      };
    }

    // Get diagnostic for this medication
    const diagnostic = await medicationCalendarApi.diagnoseMedicationScheduleIssues(medication.id);
    
    if (!diagnostic.success || !diagnostic.data) {
      return {
        isValid: false,
        issues: ['Failed to check medication schedules'],
        suggestions: ['Try refreshing and checking again'],
        hasSchedules: false,
        scheduleCount: 0
      };
    }

    const data = diagnostic.data;
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Analyze the diagnostic results
    if (!data.hasSchedules) {
      issues.push('No schedules found for medication with reminders enabled');
      suggestions.push('Create a medication schedule');
    } else if (data.validSchedules === 0) {
      issues.push('All schedules have validation errors');
      suggestions.push('Fix validation issues in existing schedules');
    } else if (data.invalidSchedules > 0) {
      issues.push(`${data.invalidSchedules} schedule${data.invalidSchedules !== 1 ? 's have' : ' has'} validation errors`);
      suggestions.push('Review and fix schedule validation issues');
    }

    // Add specific issue descriptions
    data.issues.forEach(issue => {
      if (issue.severity === 'error') {
        issues.push(issue.description);
        suggestions.push(issue.repairAction);
      }
    });

    const isValid = issues.length === 0;
    
    return {
      isValid,
      issues,
      suggestions: [...new Set(suggestions)], // Remove duplicates
      hasSchedules: data.hasSchedules,
      scheduleCount: data.scheduleCount
    };
    
  } catch (error) {
    console.error('❌ Error validating medication scheduling:', error);
    return {
      isValid: false,
      issues: ['Validation check failed'],
      suggestions: ['Check console for errors'],
      hasSchedules: false,
      scheduleCount: 0
    };
  }
}

/**
 * Auto-repair medication scheduling issues
 */
export async function autoRepairMedicationSchedules(medications: Medication[]): Promise<{
  success: boolean;
  medicationsProcessed: number;
  medicationsFixed: number;
  fixesApplied: string[];
  remainingIssues: string[];
}> {
  const result = {
    success: true,
    medicationsProcessed: 0,
    medicationsFixed: 0,
    fixesApplied: [] as string[],
    remainingIssues: [] as string[]
  };

  try {
    console.log('🔧 Starting auto-repair for medication schedules...');
    
    const medicationsWithReminders = medications.filter(med => 
      med.hasReminders && med.isActive && !med.isPRN
    );
    
    result.medicationsProcessed = medicationsWithReminders.length;
    
    if (medicationsWithReminders.length === 0) {
      result.fixesApplied.push('No medications with reminders found - nothing to repair');
      return result;
    }

    // Run comprehensive fix
    const fixReport = await fixMedicationSchedulingIssues(medications);
    
    result.medicationsFixed = fixReport.issuesFixed;
    result.fixesApplied.push(...fixReport.details.fixesApplied);
    result.remainingIssues.push(...fixReport.details.remainingProblems);
    
    if (fixReport.details.remainingProblems.length > 0) {
      result.success = false;
    }

    console.log('🔧 Auto-repair completed:', result);
    
  } catch (error) {
    console.error('❌ Auto-repair failed:', error);
    result.success = false;
    result.remainingIssues.push(`Auto-repair error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Export diagnostic tools for browser console debugging
 */
if (typeof window !== 'undefined') {
  (window as any).medicationScheduleFixes = {
    fixMedicationSchedulingIssues,
    quickScheduleDiagnostic,
    validateMedicationScheduling,
    autoRepairMedicationSchedules,
    
    // Quick access to API methods
    performHealthCheck: () => medicationCalendarApi.performScheduleHealthCheck(),
    createBulkSchedules: () => medicationCalendarApi.createBulkSchedules(),
    generateMissingEvents: () => medicationCalendarApi.generateMissingCalendarEvents(),
    clearCaches: () => medicationCalendarApi.clearMedicationCaches(),
    
    // Diagnostic shortcuts
    diagnose: (medicationId: string) => medicationCalendarApi.diagnoseMedicationScheduleIssues(medicationId),
    repair: (medicationId: string, options?: any) => medicationCalendarApi.repairMedicationScheduleIssues(medicationId, options)
  };
  
  console.log('🔧 Medication schedule fixes loaded. Available in window.medicationScheduleFixes');
}