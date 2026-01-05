"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllRoutes = registerAllRoutes;
const health_1 = require("./health");
const invitationsAndFamilyAccess_1 = require("./invitationsAndFamilyAccess");
const drugSearch_1 = require("./drugSearch");
const auth_1 = require("./auth");
const patientPreferences_1 = require("./patientPreferences");
const mealLogging_1 = require("./mealLogging");
const healthcareFacilities_1 = require("./healthcareFacilities");
/**
 * Register all routes on the Express application
 * This is the central routing configuration
 */
function registerAllRoutes(app, firestore) {
    // Register health/test routes (no auth required)
    (0, health_1.registerHealthRoutes)(app);
    // Register invitation and family access routes
    (0, invitationsAndFamilyAccess_1.registerInvitationAndFamilyAccessRoutes)(app, firestore);
    // Register drug search routes
    (0, drugSearch_1.registerDrugSearchRoutes)(app);
    // Register auth/profile routes
    (0, auth_1.registerAuthRoutes)(app, firestore);
    // Register patient preferences routes
    (0, patientPreferences_1.registerPatientPreferencesRoutes)(app, firestore);
    // Register meal logging routes
    (0, mealLogging_1.registerMealLoggingRoutes)(app, firestore);
    // Register healthcare facility routes
    (0, healthcareFacilities_1.registerHealthcareFacilityRoutes)(app, firestore);
    // TODO: Register other route modules here as they are extracted
    // Example:
    // registerHealthcareProviderRoutes(app, firestore);
    // ... etc
}
