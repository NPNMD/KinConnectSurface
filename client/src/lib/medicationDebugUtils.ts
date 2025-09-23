import { medicationCalendarApi } from './medicationCalendarApi';
import { useFamily } from '@/contexts/FamilyContext';

/**
 * Utility functions for debugging and testing medication data flow
 */

export interface MedicationDataFlowReport {
  timestamp: Date;
  patientId: string | null;
  userRole: string;
  activePatientName?: string;
  dataFlow: {
    schedules: {
      success: boolean;
      count: number;
      error?: string;
    };
    calendarEvents: {
      success: boolean;
      count: number;
      error?: string;
    };
    todayBuckets: {
      success: boolean;
      totalMedications: number;
      bucketCounts: {
        overdue: number;
        now: number;
        dueSoon: number;
        morning: number;
        noon: number;
        evening: number;
        bedtime: number;
        completed: number;
      };
      error?: string;
    };
    missingEvents: {
      success: boolean;
      count: number;
      error?: string;
    };
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Comprehensive test of the medication data flow
 */
export async function testMedicationDataFlow(patientId?: string): Promise<MedicationDataFlowReport> {
  const report: MedicationDataFlowReport = {
    timestamp: new Date(),
    patientId: patientId || null,
    userRole: 'unknown',
    dataFlow: {
      schedules: { success: false, count: 0 },
      calendarEvents: { success: false, count: 0 },
      todayBuckets: { 
        success: false, 
        totalMedications: 0,
        bucketCounts: {
          overdue: 0,
          now: 0,
          dueSoon: 0,
          morning: 0,
          noon: 0,
          evening: 0,
          bedtime: 0,
          completed: 0
        }
      },
      missingEvents: { success: false, count: 0 }
    },
    issues: [],
    recommendations: []
  };

  try {
    console.log('🔍 Starting comprehensive medication data flow test...');

    // Step 1: Test medication schedules
    console.log('📋 Testing medication schedules...');
    try {
      const schedulesResult = await medicationCalendarApi.getMedicationSchedules(patientId);
      if (schedulesResult.success && schedulesResult.data) {
        report.dataFlow.schedules.success = true;
        report.dataFlow.schedules.count = schedulesResult.data.length;
        console.log(`✅ Found ${schedulesResult.data.length} medication schedules`);
      } else {
        report.dataFlow.schedules.error = schedulesResult.error || 'Unknown error';
        report.issues.push(`Failed to load medication schedules: ${report.dataFlow.schedules.error}`);
      }
    } catch (error) {
      report.dataFlow.schedules.error = error instanceof Error ? error.message : 'Unknown error';
      report.issues.push(`Error loading schedules: ${report.dataFlow.schedules.error}`);
    }

    // Step 2: Test calendar events
    console.log('📅 Testing calendar events...');
    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const eventsResult = await medicationCalendarApi.getMedicationCalendarEvents({
        startDate: startOfDay,
        endDate: endOfDay,
        patientId,
        forceFresh: true
      });

      if (eventsResult.success && eventsResult.data) {
        report.dataFlow.calendarEvents.success = true;
        report.dataFlow.calendarEvents.count = eventsResult.data.length;
        console.log(`✅ Found ${eventsResult.data.length} calendar events for today`);
      } else {
        report.dataFlow.calendarEvents.error = eventsResult.error || 'Unknown error';
        report.issues.push(`Failed to load calendar events: ${report.dataFlow.calendarEvents.error}`);
      }
    } catch (error) {
      report.dataFlow.calendarEvents.error = error instanceof Error ? error.message : 'Unknown error';
      report.issues.push(`Error loading calendar events: ${report.dataFlow.calendarEvents.error}`);
    }

    // Step 3: Test today's medication buckets
    console.log('🗂️ Testing today\'s medication buckets...');
    try {
      const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(new Date(), {
        patientId,
        forceFresh: true
      });

      if (bucketsResult.success && bucketsResult.data) {
        report.dataFlow.todayBuckets.success = true;
        const buckets = bucketsResult.data;
        
        report.dataFlow.todayBuckets.bucketCounts = {
          overdue: buckets.overdue?.length || 0,
          now: buckets.now?.length || 0,
          dueSoon: buckets.dueSoon?.length || 0,
          morning: buckets.morning?.length || 0,
          noon: buckets.noon?.length || 0,
          evening: buckets.evening?.length || 0,
          bedtime: buckets.bedtime?.length || 0,
          completed: buckets.completed?.length || 0
        };

        report.dataFlow.todayBuckets.totalMedications = Object.values(report.dataFlow.todayBuckets.bucketCounts)
          .reduce((sum, count) => sum + count, 0);

        console.log(`✅ Today's buckets loaded successfully:`, report.dataFlow.todayBuckets.bucketCounts);
      } else {
        report.dataFlow.todayBuckets.error = bucketsResult.error || 'Unknown error';
        report.issues.push(`Failed to load today's buckets: ${report.dataFlow.todayBuckets.error}`);
      }
    } catch (error) {
      report.dataFlow.todayBuckets.error = error instanceof Error ? error.message : 'Unknown error';
      report.issues.push(`Error loading today's buckets: ${report.dataFlow.todayBuckets.error}`);
    }

    // Step 4: Check for missing calendar events
    console.log('🔍 Checking for missing calendar events...');
    try {
      const missingEventsResult = await medicationCalendarApi.checkMissingCalendarEvents();
      if (missingEventsResult.success && missingEventsResult.data) {
        report.dataFlow.missingEvents.success = true;
        report.dataFlow.missingEvents.count = missingEventsResult.data.totalCount;
        
        if (missingEventsResult.data.totalCount > 0) {
          report.issues.push(`Found ${missingEventsResult.data.totalCount} medications with schedules but no calendar events`);
          report.recommendations.push('Run medicationCalendarApi.generateMissingCalendarEvents() to fix missing events');
        }
        
        console.log(`✅ Missing events check complete: ${missingEventsResult.data.totalCount} missing`);
      } else {
        report.dataFlow.missingEvents.error = missingEventsResult.error || 'Unknown error';
        report.issues.push(`Failed to check missing events: ${report.dataFlow.missingEvents.error}`);
      }
    } catch (error) {
      report.dataFlow.missingEvents.error = error instanceof Error ? error.message : 'Unknown error';
      report.issues.push(`Error checking missing events: ${report.dataFlow.missingEvents.error}`);
    }

    // Generate recommendations based on findings
    if (report.dataFlow.schedules.count > 0 && report.dataFlow.calendarEvents.count === 0) {
      report.recommendations.push('You have medication schedules but no calendar events. Generate missing events.');
    }

    if (report.dataFlow.calendarEvents.count > 0 && report.dataFlow.todayBuckets.totalMedications === 0) {
      report.recommendations.push('You have calendar events but no medications in today\'s buckets. Check bucket organization logic.');
    }

    if (report.dataFlow.schedules.count === 0) {
      report.recommendations.push('No medication schedules found. Add medications and create schedules.');
    }

    if (report.issues.length === 0) {
      console.log('✅ Medication data flow test completed successfully - no issues found!');
    } else {
      console.warn(`⚠️ Medication data flow test completed with ${report.issues.length} issues`);
    }

  } catch (error) {
    console.error('❌ Critical error during medication data flow test:', error);
    report.issues.push(`Critical test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return report;
}

/**
 * Quick diagnostic function for debugging medication loading issues
 */
export async function quickMedicationDiagnostic(patientId?: string): Promise<void> {
  console.log('🔍 Running quick medication diagnostic...');
  
  try {
    // Test effective patient ID resolution
    const effectivePatientId = patientId || await medicationCalendarApi.getEffectivePatientId();
    console.log('👤 Effective Patient ID:', effectivePatientId);

    // Test data pipeline validation
    const pipelineResult = await medicationCalendarApi.validateAndRepairDataPipeline(effectivePatientId || undefined);
    console.log('🔧 Pipeline Validation:', pipelineResult);

    // Test today's buckets with detailed logging
    const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(new Date(), {
      patientId: effectivePatientId || undefined,
      forceFresh: true
    });
    
    console.log('🗂️ Today\'s Buckets Result:', {
      success: bucketsResult.success,
      error: bucketsResult.error,
      dataExists: !!bucketsResult.data,
      bucketCounts: bucketsResult.data ? {
        overdue: bucketsResult.data.overdue?.length || 0,
        now: bucketsResult.data.now?.length || 0,
        dueSoon: bucketsResult.data.dueSoon?.length || 0,
        morning: bucketsResult.data.morning?.length || 0,
        noon: bucketsResult.data.noon?.length || 0,
        evening: bucketsResult.data.evening?.length || 0,
        bedtime: bucketsResult.data.bedtime?.length || 0,
        completed: bucketsResult.data.completed?.length || 0
      } : null
    });

  } catch (error) {
    console.error('❌ Quick diagnostic failed:', error);
  }
}

/**
 * Function to repair common medication data issues
 */
export async function repairMedicationDataIssues(patientId?: string): Promise<{
  success: boolean;
  repairsApplied: string[];
  errors: string[];
}> {
  const result = {
    success: true,
    repairsApplied: [] as string[],
    errors: [] as string[]
  };

  try {
    console.log('🔧 Starting medication data repair process...');

    // Step 1: Validate and repair data pipeline
    const pipelineResult = await medicationCalendarApi.validateAndRepairDataPipeline(patientId);
    if (pipelineResult.repaired.length > 0) {
      result.repairsApplied.push(...pipelineResult.repaired);
    }
    if (pipelineResult.issues.length > 0) {
      result.errors.push(...pipelineResult.issues);
    }

    // Step 2: Generate missing calendar events
    const missingEventsResult = await medicationCalendarApi.generateMissingCalendarEvents();
    if (missingEventsResult.success && missingEventsResult.data && missingEventsResult.data.generated > 0) {
      result.repairsApplied.push(`Generated ${missingEventsResult.data.generated} missing calendar events`);
    } else if (!missingEventsResult.success) {
      result.errors.push(`Failed to generate missing events: ${missingEventsResult.error}`);
    }

    // Step 3: Clear caches to ensure fresh data
    medicationCalendarApi.clearMedicationCaches(patientId);
    result.repairsApplied.push('Cleared medication caches for fresh data');

    if (result.errors.length > 0) {
      result.success = false;
    }

    console.log('🔧 Medication data repair completed:', result);

  } catch (error) {
    console.error('❌ Medication data repair failed:', error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown repair error');
  }

  return result;
}

// Export for use in browser console during debugging
if (typeof window !== 'undefined') {
  (window as any).medicationDebugUtils = {
    testMedicationDataFlow,
    quickMedicationDiagnostic,
    repairMedicationDataIssues
  };
}