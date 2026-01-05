import express from 'express';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { authenticate } from '../middleware';

/**
 * Register authentication and profile routes
 * Handles user profile retrieval and management
 */
export function registerAuthRoutes(
	app: express.Application,
	firestore: Firestore
) {
	// Auth: profile
	app.get('/auth/profile', authenticate, async (req, res) => {
		try {
			const decoded: any = (req as any).user;
			const uid: string = decoded.uid;
			const email: string | undefined = decoded.email;
			const name: string | undefined = decoded.name;
			const picture: string | undefined = decoded.picture;

			const usersCol = firestore.collection('users');
			const userDocRef = usersCol.doc(uid);
			const userSnap = await userDocRef.get();

			const now = admin.firestore.Timestamp.now();

			if (!userSnap.exists) {
				// 🔥 SMART USER TYPE ASSIGNMENT: Check if user has pending invitations
				console.log('👤 New user detected, checking for pending invitations:', email);
				let userType = 'patient'; // Default to patient
				
				if (email) {
					// Check for pending invitations for this email
					const pendingInvitations = await firestore.collection('family_calendar_access')
						.where('familyMemberEmail', '==', email.toLowerCase().trim())
						.where('status', '==', 'pending')
						.limit(1)
						.get();
					
					if (!pendingInvitations.empty) {
						userType = 'family_member';
						console.log('🎯 User has pending invitations, setting type to family_member');
					}
				}

				const newUser = {
					id: uid,
					email: email || '',
					name: name || 'Unknown User',
					profilePicture: picture,
					userType,
					createdAt: now,
					updatedAt: now,
				};
				await userDocRef.set(newUser, { merge: true });
				console.log('✅ Created new user with type:', userType);
				return res.json({ success: true, data: { ...newUser, createdAt: new Date(), updatedAt: new Date() } });
			}

			const data = userSnap.data() || {};

			// Auto-repair: if user is family_member but missing primaryPatientId, try inferring from active access
			try {
				if ((data.userType === 'family_member') && !data.primaryPatientId) {
					const activeForUser = await firestore.collection('family_calendar_access')
						.where('familyMemberId', '==', uid)
						.where('status', '==', 'active')
						.limit(1)
						.get();
					if (!activeForUser.empty) {
						const inferredPatientId = activeForUser.docs[0].data().patientId;
						await userDocRef.set({
							primaryPatientId: inferredPatientId,
							linkedPatientIds: admin.firestore.FieldValue.arrayUnion(inferredPatientId),
							updatedAt: now,
							repairedAt: now,
							repairReason: 'auto_infer_primary_patient_from_access'
						}, { merge: true });
						const patientUserRef = firestore.collection('users').doc(inferredPatientId);
						await patientUserRef.set({
							familyMemberIds: admin.firestore.FieldValue.arrayUnion(uid),
							updatedAt: now
						}, { merge: true });
						data.primaryPatientId = inferredPatientId;
					}
				}
			} catch (e) {
				console.warn('Auto-repair primaryPatientId failed:', e);
			}

			const merged = {
				id: data.id || uid,
				email: data.email || email || '',
				name: data.name || name || 'Unknown User',
				profilePicture: data.profilePicture || picture,
				userType: data.userType || 'patient',
				primaryPatientId: data.primaryPatientId || null,
				createdAt: data.createdAt ? data.createdAt.toDate?.() || new Date() : new Date(),
				updatedAt: data.updatedAt ? data.updatedAt.toDate?.() || new Date() : new Date(),
			};
			return res.json({ success: true, data: merged });
		} catch (error) {
			console.error('Error in /api/auth/profile:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	});
}

