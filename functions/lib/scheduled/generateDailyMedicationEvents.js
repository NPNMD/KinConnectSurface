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
exports.generateDailyMedicationEvents = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const MedicationOrchestrator_1 = require("../services/unified/MedicationOrchestrator");
const admin = __importStar(require("firebase-admin"));
exports.generateDailyMedicationEvents = functions
    .runWith({
    memory: '1GB',
    timeoutSeconds: 540,
})
    .pubsub.schedule('0 2 * * *') // 2 AM UTC daily
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('📅 Starting daily event generation');
    const firestore = admin.firestore();
    const orchestrator = new MedicationOrchestrator_1.MedicationOrchestrator();
    // Get all active medications with reminders
    const commandsQuery = await firestore
        .collection('medication_commands')
        .where('status.isActive', '==', true)
        .where('reminders.enabled', '==', true)
        .where('status.isPRN', '==', false)
        .get();
    const results = {
        processed: 0,
        eventsGenerated: 0,
        errors: []
    };
    for (const doc of commandsQuery.docs) {
        try {
            results.processed++;
            const result = await orchestrator.regenerateScheduledEvents(doc.id);
            if (result.success) {
                results.eventsGenerated += result.created;
            }
            else {
                results.errors.push(`${doc.id}: ${result.error}`);
            }
        }
        catch (error) {
            results.errors.push(`${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    console.log('✅ Daily event generation complete:', results);
    return results;
});
