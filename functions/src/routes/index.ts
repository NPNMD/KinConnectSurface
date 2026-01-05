import express from 'express';
import { Firestore } from 'firebase-admin/firestore';
import { registerHealthRoutes } from './health';
import { registerInvitationAndFamilyAccessRoutes } from './invitationsAndFamilyAccess';
import { registerDrugSearchRoutes } from './drugSearch';
import { registerAuthRoutes } from './auth';
import { registerPatientPreferencesRoutes } from './patientPreferences';
import { registerMealLoggingRoutes } from './mealLogging';
import { registerHealthcareFacilityRoutes } from './healthcareFacilities';

/**
 * Register all routes on the Express application
 * This is the central routing configuration
 */
export function registerAllRoutes(
	app: express.Application,
	firestore: Firestore
) {
	// Register health/test routes (no auth required)
	registerHealthRoutes(app);

	// Register invitation and family access routes
	registerInvitationAndFamilyAccessRoutes(app, firestore);

	// Register drug search routes
	registerDrugSearchRoutes(app);

	// Register auth/profile routes
	registerAuthRoutes(app, firestore);

	// Register patient preferences routes
	registerPatientPreferencesRoutes(app, firestore);

	// Register meal logging routes
	registerMealLoggingRoutes(app, firestore);

	// Register healthcare facility routes
	registerHealthcareFacilityRoutes(app, firestore);

	// TODO: Register other route modules here as they are extracted
	// Example:
	// registerHealthcareProviderRoutes(app, firestore);
	// ... etc
}
