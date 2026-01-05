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
exports.detectMissedMedications = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const MedicationOrchestrator_1 = require("../services/unified/MedicationOrchestrator");
/**
 * Scheduled function to detect missed medications
 * Runs every 15 minutes to check for medications past their grace period
 */
exports.detectMissedMedications = functions
    .runWith({
    memory: '512MB',
    timeoutSeconds: 300,
})
    .pubsub.schedule('*/15 * * * *')
    .timeZone('UTC')
    .onRun(async (context) => {
    const startTime = Date.now();
    console.log('🔍 ===== MISSED MEDICATION DETECTION START =====');
    console.log(`⏰ Execution time (UTC): ${new Date().toISOString()}`);
    try {
        const orchestrator = new MedicationOrchestrator_1.MedicationOrchestrator();
        const result = await orchestrator.processMissedMedicationDetection();
        const executionTime = Date.now() - startTime;
        console.log('📊 ===== MISSED MEDICATION DETECTION SUMMARY =====');
        console.log(`   - Medications processed: ${result.medicationsProcessed}`);
        console.log(`   - Missed doses detected: ${result.missedDetected}`);
        console.log(`   - Workflows executed: ${result.workflowsExecuted}`);
        console.log(`   - Notifications sent: ${result.notificationsSent}`);
        console.log(`   - Errors: ${result.errors.length}`);
        console.log(`   - Execution time: ${executionTime}ms`);
        if (result.errors.length > 0) {
            console.error('❌ Errors during detection:', result.errors.slice(0, 5));
        }
        console.log('🔍 ===== MISSED MEDICATION DETECTION END =====');
        return result;
    }
    catch (error) {
        console.error('❌ Fatal error in missed medication detection:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
        throw error;
    }
});
