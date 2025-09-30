/**
 * Test script to verify medication scheduling fixes
 * Run this in the browser console to test the implemented fixes
 */

import { medicationCalendarApi } from './medicationCalendarApi';
import { quickScheduleDiagnostic, autoRepairMedicationSchedules, validateMedicationScheduling } from './medicationScheduleFixes';

// Test data for validation
const testMedicationData = {
  validMedication: {
    id: 'test-med-1',
    name: 'Test Medication',
    hasReminders: true,
    isActive: true,
    isPRN: false,
    frequency: 'twice daily',
    dosage: '5mg',
    reminderTimes: ['07:00', '19:00']
  },
  invalidMedication: {
    id: 'test-med-2',
    name: 'Invalid Medication',
    hasReminders: true,
    isActive: true,
    isPRN: false,
    frequency: '', // Missing frequency
    dosage: '', // Missing dosage
    reminderTimes: ['25:00'] // Invalid time
  }
};

const testScheduleData = {
  validSchedule: {
    medicationId: 'test-med-1',
    frequency: 'twice_daily' as const,
    times: ['07:00', '19:00'],
    dosageAmount: '5mg',
    startDate: new Date(),
    isIndefinite: true,
    generateCalendarEvents: true,
    reminderMinutesBefore: [15, 5]
  },
  invalidSchedule: {
    medicationId: '', // Missing medication ID
    frequency: undefined, // Missing frequency
    times: [], // Missing times
    dosageAmount: '', // Missing dosage
    startDate: undefined, // Missing start date
  }
};

/**
 * Test the enhanced validation function
 */
export async function testValidationEnhancements(): Promise<void> {
  console.log('🧪 Testing validation enhancements...');
  
  try {
    // Test 1: Valid schedule data
    console.log('🧪 Test 1: Valid schedule validation');
    const validResult = medicationCalendarApi.validateScheduleData(testScheduleData.validSchedule);
    console.log('✅ Valid schedule result:', validResult);
    
    if (!validResult.isValid) {
      console.error('❌ Valid schedule failed validation:', validResult.errors);
    } else {
      console.log('✅ Valid schedule passed validation');
      if (validResult.warnings.length > 0) {
        console.log('⚠️ Warnings for valid schedule:', validResult.warnings);
      }
    }
    
    // Test 2: Invalid schedule data
    console.log('🧪 Test 2: Invalid schedule validation');
    const invalidResult = medicationCalendarApi.validateScheduleData(testScheduleData.invalidSchedule);
    console.log('❌ Invalid schedule result:', invalidResult);
    
    if (invalidResult.isValid) {
      console.error('❌ Invalid schedule incorrectly passed validation');
    } else {
      console.log('✅ Invalid schedule correctly failed validation');
      console.log('📋 Validation errors:', invalidResult.errors);
      console.log('💡 Repair suggestions:', invalidResult.repairSuggestions);
    }
    
    // Test 3: Edge cases
    console.log('🧪 Test 3: Edge case validations');
    
    const edgeCases = [
      {
        name: 'Weekly without days',
        data: { ...testScheduleData.validSchedule, frequency: 'weekly' as const, daysOfWeek: [] }
      },
      {
        name: 'Monthly without day',
        data: { ...testScheduleData.validSchedule, frequency: 'monthly' as const, dayOfMonth: undefined }
      },
      {
        name: 'Duplicate times',
        data: { ...testScheduleData.validSchedule, times: ['07:00', '07:00', '19:00'] }
      },
      {
        name: 'Invalid time format',
        data: { ...testScheduleData.validSchedule, times: ['7:00', '25:00', '19:60'] }
      },
      {
        name: 'End date before start date',
        data: {
          ...testScheduleData.validSchedule,
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-11-01'),
          isIndefinite: false
        }
      }
    ];
    
    edgeCases.forEach(testCase => {
      console.log(`🧪 Testing edge case: ${testCase.name}`);
      const result = medicationCalendarApi.validateScheduleData(testCase.data);
      console.log(`📋 ${testCase.name} result:`, {
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        suggestionCount: result.repairSuggestions.length
      });
      
      if (result.errors.length > 0) {
        console.log(`❌ ${testCase.name} errors:`, result.errors);
      }
      if (result.repairSuggestions.length > 0) {
        console.log(`💡 ${testCase.name} suggestions:`, result.repairSuggestions);
      }
    });
    
  } catch (error) {
    console.error('❌ Validation test failed:', error);
  }
}

/**
 * Test the diagnostic tools
 */
export async function testDiagnosticTools(): Promise<void> {
  console.log('🧪 Testing diagnostic tools...');
  
  try {
    // Test 1: Quick diagnostic
    console.log('🧪 Test 1: Quick schedule diagnostic');
    const quickDiag = await quickScheduleDiagnostic([
      testMedicationData.validMedication as any,
      testMedicationData.invalidMedication as any
    ]);
    
    console.log('📊 Quick diagnostic result:', quickDiag);
    
    // Test 2: Individual medication validation
    console.log('🧪 Test 2: Individual medication validation');
    const medValidation = await validateMedicationScheduling(testMedicationData.validMedication as any);
    console.log('📋 Medication validation result:', medValidation);
    
    // Test 3: Health check
    console.log('🧪 Test 3: Schedule health check');
    const healthCheck = await medicationCalendarApi.performScheduleHealthCheck();
    console.log('🏥 Health check result:', healthCheck);
    
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error);
  }
}

/**
 * Test the repair functionality
 */
export async function testRepairFunctionality(): Promise<void> {
  console.log('🧪 Testing repair functionality...');
  
  try {
    // Test 1: Auto-repair
    console.log('🧪 Test 1: Auto-repair medications');
    const autoRepair = await autoRepairMedicationSchedules([
      testMedicationData.validMedication as any,
      testMedicationData.invalidMedication as any
    ]);
    
    console.log('🔧 Auto-repair result:', autoRepair);
    
    // Test 2: Data pipeline validation and repair
    console.log('🧪 Test 2: Data pipeline repair');
    const pipelineRepair = await medicationCalendarApi.validateAndRepairDataPipeline();
    console.log('🔧 Pipeline repair result:', pipelineRepair);
    
    // Test 3: Missing calendar events generation
    console.log('🧪 Test 3: Missing calendar events generation');
    const eventsGeneration = await medicationCalendarApi.generateMissingCalendarEvents();
    console.log('📅 Events generation result:', eventsGeneration);
    
  } catch (error) {
    console.error('❌ Repair test failed:', error);
  }
}

/**
 * Test the bulk schedule creation improvements
 */
export async function testBulkScheduleCreation(): Promise<void> {
  console.log('🧪 Testing bulk schedule creation...');
  
  try {
    // Test bulk creation with enhanced feedback
    const bulkResult = await medicationCalendarApi.createBulkSchedules();
    console.log('📅 Bulk schedule creation result:', bulkResult);
    
    if (bulkResult.success && bulkResult.data) {
      console.log('📊 Bulk creation statistics:', {
        processed: bulkResult.data.processed,
        created: bulkResult.data.created,
        skipped: bulkResult.data.skipped,
        errors: bulkResult.data.errors?.length || 0
      });
      
      if (bulkResult.data.errors && bulkResult.data.errors.length > 0) {
        console.log('❌ Bulk creation errors:', bulkResult.data.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ Bulk schedule creation test failed:', error);
  }
}

/**
 * Run all tests
 */
export async function runAllScheduleFixTests(): Promise<void> {
  console.log('🧪 ===== RUNNING ALL MEDICATION SCHEDULE FIX TESTS =====');
  
  try {
    await testValidationEnhancements();
    console.log('');
    
    await testDiagnosticTools();
    console.log('');
    
    await testRepairFunctionality();
    console.log('');
    
    await testBulkScheduleCreation();
    console.log('');
    
    console.log('✅ ===== ALL TESTS COMPLETED =====');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).testScheduleFixes = {
    runAllTests: runAllScheduleFixTests,
    testValidation: testValidationEnhancements,
    testDiagnostic: testDiagnosticTools,
    testRepair: testRepairFunctionality,
    testBulkCreation: testBulkScheduleCreation,
    
    // Quick access to test data
    testData: {
      validMedication: testMedicationData.validMedication,
      invalidMedication: testMedicationData.invalidMedication,
      validSchedule: testScheduleData.validSchedule,
      invalidSchedule: testScheduleData.invalidSchedule
    }
  };
  
  console.log('🧪 Schedule fix tests loaded. Run window.testScheduleFixes.runAllTests() to test all fixes');
}