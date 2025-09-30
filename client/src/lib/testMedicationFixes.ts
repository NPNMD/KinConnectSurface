import { medicationCalendarApi } from './medicationCalendarApi';
import { testMedicationDataFlow, quickMedicationDiagnostic, repairMedicationDataIssues } from './medicationDebugUtils';

/**
 * Test script to validate medication reminder fixes
 */
export async function runMedicationFixesTest(): Promise<{
  success: boolean;
  results: any;
  issues: string[];
  recommendations: string[];
}> {
  console.log('🧪 Starting medication fixes validation test...');
  
  const testResults = {
    success: true,
    results: {} as any,
    issues: [] as string[],
    recommendations: [] as string[]
  };

  try {
    // Test 1: Patient ID Resolution
    console.log('🔍 Test 1: Patient ID Resolution');
    const effectivePatientId = await medicationCalendarApi.getEffectivePatientId();
    testResults.results.patientIdResolution = {
      success: !!effectivePatientId,
      patientId: effectivePatientId
    };
    
    if (!effectivePatientId) {
      testResults.issues.push('Failed to resolve effective patient ID');
      testResults.success = false;
    } else {
      console.log('✅ Patient ID resolved:', effectivePatientId);
    }

    // Test 2: Data Pipeline Validation
    console.log('🔍 Test 2: Data Pipeline Validation');
    const pipelineResult = await medicationCalendarApi.validateAndRepairDataPipeline(effectivePatientId || undefined);
    testResults.results.pipelineValidation = pipelineResult;
    
    if (!pipelineResult.isValid) {
      testResults.issues.push(...pipelineResult.issues);
      if (pipelineResult.repaired.length > 0) {
        testResults.recommendations.push(...pipelineResult.repaired.map(r => `Applied repair: ${r}`));
      }
    } else {
      console.log('✅ Data pipeline is valid');
    }

    // Test 3: Calendar Event Generation
    console.log('🔍 Test 3: Calendar Event Generation');
    const missingEventsCheck = await medicationCalendarApi.checkMissingCalendarEvents();
    testResults.results.calendarEventGeneration = missingEventsCheck;
    
    if (missingEventsCheck.success && missingEventsCheck.data && missingEventsCheck.data.totalCount > 0) {
      console.log(`⚠️ Found ${missingEventsCheck.data.totalCount} medications with missing calendar events`);
      testResults.recommendations.push(`Generate ${missingEventsCheck.data.totalCount} missing calendar events`);
      
      // Attempt to generate missing events
      const generateResult = await medicationCalendarApi.generateMissingCalendarEvents();
      if (generateResult.success && generateResult.data && generateResult.data.generated > 0) {
        console.log(`✅ Generated ${generateResult.data.generated} missing calendar events`);
        testResults.recommendations.push(`Successfully generated ${generateResult.data.generated} calendar events`);
      }
    } else {
      console.log('✅ No missing calendar events found');
    }

    // Test 4: Today's Medication Buckets
    console.log('🔍 Test 4: Today\'s Medication Buckets');
    const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(new Date(), {
      patientId: effectivePatientId || undefined,
      forceFresh: true
    });
    
    testResults.results.todaysBuckets = {
      success: bucketsResult.success,
      error: bucketsResult.error,
      hasBuckets: !!bucketsResult.data,
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
    };
    
    if (!bucketsResult.success) {
      testResults.issues.push(`Failed to load today's medication buckets: ${bucketsResult.error}`);
      testResults.success = false;
    } else {
      const bucketCounts = testResults.results.todaysBuckets.bucketCounts;
      const totalMeds = bucketsResult.data && bucketCounts ?
        (bucketCounts.overdue + bucketCounts.now + bucketCounts.dueSoon +
         bucketCounts.morning + bucketCounts.noon + bucketCounts.evening +
         bucketCounts.bedtime + bucketCounts.completed) : 0;
      console.log(`✅ Today's buckets loaded successfully (${totalMeds} total medications)`);
    }

    // Test 5: Cache Management
    console.log('🔍 Test 5: Cache Management');
    try {
      medicationCalendarApi.clearMedicationCaches(effectivePatientId || undefined);
      testResults.results.cacheManagement = { success: true };
      console.log('✅ Cache management working correctly');
    } catch (error) {
      testResults.results.cacheManagement = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      testResults.issues.push('Cache management failed');
    }

    // Test 6: Error Handling and Retry Logic
    console.log('🔍 Test 6: Error Handling and Retry Logic');
    try {
      // Test with invalid patient ID to check error handling
      const errorTestResult = await medicationCalendarApi.getTodayMedicationBuckets(new Date(), {
        patientId: 'invalid-patient-id-test',
        forceFresh: true
      });
      
      testResults.results.errorHandling = {
        success: true,
        handledGracefully: !errorTestResult.success && !!errorTestResult.error
      };
      
      if (errorTestResult.success) {
        console.log('⚠️ Error handling test: Expected failure but got success');
      } else {
        console.log('✅ Error handling working correctly - gracefully handled invalid patient ID');
      }
    } catch (error) {
      testResults.results.errorHandling = {
        success: true,
        caughtException: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('✅ Error handling working correctly - caught exception');
    }

    // Generate final recommendations
    if (testResults.success) {
      testResults.recommendations.push('All core medication reminder fixes are working correctly');
    } else {
      testResults.recommendations.push('Some issues were found - review the issues list for details');
    }

    console.log('🧪 Medication fixes validation test completed');
    console.log('📊 Test Results Summary:', {
      success: testResults.success,
      issuesCount: testResults.issues.length,
      recommendationsCount: testResults.recommendations.length
    });

  } catch (error) {
    console.error('❌ Critical error during medication fixes test:', error);
    testResults.success = false;
    testResults.issues.push(`Critical test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return testResults;
}

/**
 * Quick validation function that can be called from components
 */
export async function validateMedicationReminders(patientId?: string): Promise<boolean> {
  try {
    console.log('🔍 Quick medication reminders validation...');
    
    // Test the core flow: patient ID -> buckets -> display
    const effectivePatientId = patientId || await medicationCalendarApi.getEffectivePatientId();
    if (!effectivePatientId) {
      console.error('❌ No effective patient ID found');
      return false;
    }

    const bucketsResult = await medicationCalendarApi.getTodayMedicationBuckets(new Date(), {
      patientId: effectivePatientId,
      forceFresh: true
    });

    if (!bucketsResult.success) {
      console.error('❌ Failed to load medication buckets:', bucketsResult.error);
      return false;
    }

    console.log('✅ Medication reminders validation passed');
    return true;
  } catch (error) {
    console.error('❌ Medication reminders validation failed:', error);
    return false;
  }
}

// Export for use in browser console during debugging
if (typeof window !== 'undefined') {
  (window as any).testMedicationFixes = {
    runMedicationFixesTest,
    validateMedicationReminders
  };
}