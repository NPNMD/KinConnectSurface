import * as admin from 'firebase-admin';

/**
 * Initialize Firebase Admin SDK and return Firestore instance
 */
export function initializeFirebase() {
	// Initialize Admin SDK once
	if (!admin.apps.length) {
		admin.initializeApp();
	}

	// Use custom database ID for Firestore
	const firestore = admin.firestore();
	// If you're using a custom database ID, you can specify it like this:
	// const firestore = admin.firestore('kinconnect-production');

	return firestore;
}

