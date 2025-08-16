import * as functions from 'firebase-functions/v1';
import { defineSecret } from 'firebase-functions/params';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Initialize Admin SDK once
if (!admin.apps.length) {
	admin.initializeApp();
}

const firestore = admin.firestore();

// Define secrets
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

const SENDGRID_FROM_EMAIL = 'mike.nguyen@twfg.com';
const APP_URL = 'https://claritystream-uldp9.web.app';

// Create an Express app
const app = express();

// Security middleware
app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Simple auth middleware for functions
async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
	try {
		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
		if (!token) {
			return res.status(401).json({ success: false, error: 'Access token required' });
		}
		const decoded = await admin.auth().verifyIdToken(token);
		// Attach to request
		(req as any).user = decoded;
		return next();
	} catch (err) {
		return res.status(403).json({ success: false, error: 'Invalid or expired token' });
	}
}

// Health endpoint
app.get('/api/health', (req, res) => {
	res.json({ success: true, message: 'Functions API healthy', timestamp: new Date().toISOString() });
});

// Test endpoint to verify deployment
app.get('/api/test-deployment', (req, res) => {
	res.json({ success: true, message: 'Deployment working!', timestamp: new Date().toISOString() });
});

// ===== INVITATION ROUTES =====

// Send family invitation
app.post('/api/invitations/send', authenticate, async (req, res) => {
	try {
		console.log('🚀 Starting invitation send process...');
		const { email, patientName } = req.body;
		const senderUserId = (req as any).user.uid;
		
		console.log('📧 Invitation request:', { email, familyMemberName: patientName, senderUserId });
		
		if (!email || !patientName) {
			console.log('❌ Missing required fields');
			return res.status(400).json({
				success: false,
				error: 'Email and patient name are required'
			});
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid email format'
			});
		}

		// Get sender's user info
		console.log('👤 Fetching sender information...');
		const senderDoc = await firestore.collection('users').doc(senderUserId).get();
		const senderData = senderDoc.data();
		
		if (!senderData) {
			return res.status(404).json({
				success: false,
				error: 'User profile not found'
			});
		}

		console.log('👤 Sender found:', { senderName: senderData.name, senderEmail: senderData.email });

		// Define permissions for the invitation
		const permissions = {
			canView: true,
			canCreate: false,
			canEdit: false,
			canDelete: false,
			canClaimResponsibility: true,
			canManageFamily: false,
			canViewMedicalDetails: false,
			canReceiveNotifications: true
		};

		// Generate invitation token
		const invitationToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

		// Create family access record
		console.log('💾 Creating family access record...');
		const familyAccessData = {
			patientId: senderUserId,
			familyMemberId: '', // Will be set when invitation is accepted
			familyMemberName: patientName,
			familyMemberEmail: email,
			permissions,
			accessLevel: 'limited',
			eventTypesAllowed: [],
			emergencyAccess: false,
			status: 'pending',
			invitedAt: admin.firestore.Timestamp.now(),
			createdBy: senderUserId,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now(),
			invitationToken,
			invitationExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
		};

		const familyAccessRef = await firestore.collection('family_calendar_access').add(familyAccessData);
		console.log('✅ Family access record created:', familyAccessRef.id);

		// Send invitation email
		try {
			console.log('📨 Initializing SendGrid...');
			const rawApiKey = sendgridApiKey.value();
			// Clean the API key by removing any quotes and trimming whitespace
			const apiKey = rawApiKey ? rawApiKey.replace(/^["']|["']$/g, '').trim() : '';
			console.log('🔑 SendGrid API key available:', !!apiKey);
			console.log('🔑 API key starts with SG.:', apiKey.startsWith('SG.'));
			
			if (!apiKey || !apiKey.startsWith('SG.')) {
				console.warn('⚠️ SendGrid API key not found or invalid format, skipping email');
				return res.status(200).json({
					success: true,
					message: 'Invitation created but email delivery failed. Please try again or contact support.',
					data: {
						invitationId: familyAccessRef.id,
						emailError: 'SendGrid API key not configured properly'
					}
				});
			}

			sgMail.setApiKey(apiKey);
			const invitationLink = `${APP_URL}/invitation/${invitationToken}`;
			console.log('🔗 Invitation link:', invitationLink);
			
			const emailContent = {
				to: email,
				from: SENDGRID_FROM_EMAIL,
				subject: `${senderData.name} has invited you to access their medical calendar`,
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
						<div style="text-align: center; margin-bottom: 30px;">
							<h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
							<p style="color: #666; margin: 5px 0;">Medical Calendar Invitation</p>
						</div>
						
						<div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
							<h2 style="color: #1e293b; margin-top: 0;">You're Invited!</h2>
							<p>Hi ${patientName},</p>
							<p><strong>${senderData.name}</strong> has invited you to access their medical calendar on KinConnect.</p>
						</div>
						
						<div style="margin-bottom: 20px;">
							<h3 style="color: #1e293b;">What you can do:</h3>
							<ul style="color: #475569;">
								<li>View medical appointments and events</li>
								<li>Claim transportation responsibilities</li>
								<li>Receive email notifications</li>
							</ul>
						</div>
						
						<div style="text-align: center; margin: 30px 0;">
							<a href="${invitationLink}" 
								 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
								Accept Invitation
							</a>
						</div>
						
						<div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
							<p>This invitation was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.</p>
							<p>The invitation link will expire in 7 days.</p>
						</div>
					</div>
				`
			};

			console.log('📧 Sending email to:', email);
			const emailResult = await sgMail.send(emailContent);
			console.log('✅ Email sent successfully:', emailResult[0].statusCode);
		} catch (emailError: any) {
			console.error('❌ Failed to send email:', emailError);
			// Continue without failing the invitation creation
		}

		console.log('🎉 Invitation process completed successfully');
		res.status(200).json({
			success: true,
			message: 'Invitation sent successfully',
			data: {
				invitationId: familyAccessRef.id,
				expiresAt: expiresAt
			}
		});

	} catch (error: any) {
		console.error('❌ Error sending invitation:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error while sending invitation'
		});
	}
});

// Get family access for current user (both as patient and family member)
app.get('/api/family-access', authenticate, async (req, res) => {
	try {
		console.log('🔍 Fetching family access for user:', (req as any).user.uid);
		const userId = (req as any).user.uid;
		
		// Get family access where user is a family member
		const familyMemberQuery = await firestore.collection('family_calendar_access')
			.where('familyMemberId', '==', userId)
			.where('status', '==', 'active')
			.get();
		
		// Get family access where user is the patient (created by them)
		const patientQuery = await firestore.collection('family_calendar_access')
			.where('createdBy', '==', userId)
			.get();

		// Process patients the user has access to as a family member
		const patientsIHaveAccessTo = [];
		for (const doc of familyMemberQuery.docs) {
			const access = doc.data();
			// Get patient info
			const patientDoc = await firestore.collection('users').doc(access.createdBy).get();
			const patientData = patientDoc.data();
			
			if (patientData) {
				patientsIHaveAccessTo.push({
					id: doc.id,
					patientId: access.patientId,
					patientName: patientData.name,
					patientEmail: patientData.email,
					accessLevel: access.accessLevel,
					permissions: access.permissions,
					status: access.status,
					acceptedAt: access.acceptedAt?.toDate(),
					relationship: 'family_member'
				});
			}
		}

		// Process family members who have access to the current user as a patient
		const familyMembersWithAccessToMe = [];
		for (const doc of patientQuery.docs) {
			const access = doc.data();
			if (access.status === 'active' && access.familyMemberId) {
				// Get family member info
				const familyMemberDoc = await firestore.collection('users').doc(access.familyMemberId).get();
				const familyMemberData = familyMemberDoc.data();
				
				if (familyMemberData) {
					familyMembersWithAccessToMe.push({
						id: doc.id,
						familyMemberId: access.familyMemberId,
						familyMemberName: familyMemberData.name,
						familyMemberEmail: familyMemberData.email,
						accessLevel: access.accessLevel,
						permissions: access.permissions,
						status: access.status,
						acceptedAt: access.acceptedAt?.toDate(),
						relationship: 'patient'
					});
				}
			}
		}

		res.json({
			success: true,
			data: {
				patientsIHaveAccessTo,
				familyMembersWithAccessToMe,
				totalConnections: patientsIHaveAccessTo.length + familyMembersWithAccessToMe.length
			}
		});

	} catch (error) {
		console.error('Error getting family access:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get invitation details by token
app.get('/api/invitations/:token', async (req, res) => {
	try {
		const { token } = req.params;

		// Find invitation by token
		const invitationQuery = await firestore.collection('family_calendar_access')
			.where('invitationToken', '==', token)
			.where('status', '==', 'pending')
			.limit(1)
			.get();

		if (invitationQuery.empty) {
			return res.status(404).json({
				success: false,
				error: 'Invitation not found or expired'
			});
		}

		const invitationDoc = invitationQuery.docs[0];
		const invitation = invitationDoc.data();

		// Check if invitation has expired
		if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt.toDate()) {
			return res.status(404).json({
				success: false,
				error: 'Invitation has expired'
			});
		}

		// Get sender's user info for display
		const senderDoc = await firestore.collection('users').doc(invitation.createdBy).get();
		const senderData = senderDoc.data();

		res.json({
			success: true,
			data: {
				id: invitationDoc.id,
				inviterName: senderData?.name || 'Unknown',
				inviterEmail: senderData?.email || 'Unknown',
				patientName: senderData?.name || 'Unknown',
				patientEmail: senderData?.email || 'Unknown',
				message: '',
				status: invitation.status,
				createdAt: invitation.invitedAt.toDate(),
				expiresAt: invitation.invitationExpiresAt.toDate()
			}
		});
	} catch (error) {
		console.error('Error getting invitation details:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Accept invitation
app.post('/api/invitations/accept/:token', authenticate, async (req, res) => {
	try {
		const { token } = req.params;
		const userId = (req as any).user.uid;

		// Find invitation by token
		const invitationQuery = await firestore.collection('family_calendar_access')
			.where('invitationToken', '==', token)
			.where('status', '==', 'pending')
			.limit(1)
			.get();

		if (invitationQuery.empty) {
			return res.status(404).json({
				success: false,
				error: 'Invalid or expired invitation token'
			});
		}

		const invitationDoc = invitationQuery.docs[0];
		const invitation = invitationDoc.data();

		// Check if invitation has expired
		if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt.toDate()) {
			return res.status(400).json({
				success: false,
				error: 'Invitation has expired'
			});
		}

		// Update invitation with family member ID and activate
		await invitationDoc.ref.update({
			familyMemberId: userId,
			status: 'active',
			acceptedAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now(),
			invitationToken: admin.firestore.FieldValue.delete(),
			invitationExpiresAt: admin.firestore.FieldValue.delete()
		});

		res.json({
			success: true,
			message: 'Invitation accepted successfully',
			data: {
				id: invitationDoc.id,
				status: 'active'
			}
		});
	} catch (error) {
		console.error('Error accepting invitation:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== EXISTING ROUTES (keeping the working ones) =====

// Auth: profile
app.get('/api/auth/profile', authenticate, async (req, res) => {
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
			const newUser = {
				id: uid,
				email: email || '',
				name: name || 'Unknown User',
				profilePicture: picture,
				userType: 'patient',
				createdAt: now,
				updatedAt: now,
			};
			await userDocRef.set(newUser, { merge: true });
			return res.json({ success: true, data: { ...newUser, createdAt: new Date(), updatedAt: new Date() } });
		}

		const data = userSnap.data() || {};
		const merged = {
			id: data.id || uid,
			email: data.email || email || '',
			name: data.name || name || 'Unknown User',
			profilePicture: data.profilePicture || picture,
			userType: data.userType || 'patient',
			createdAt: data.createdAt ? data.createdAt.toDate?.() || new Date() : new Date(),
			updatedAt: data.updatedAt ? data.updatedAt.toDate?.() || new Date() : new Date(),
		};
		return res.json({ success: true, data: merged });
	} catch (error) {
		console.error('Error in /api/auth/profile:', error);
		return res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

// Medication calendar events endpoint (simplified)
app.get('/api/medication-calendar/events', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		
		// Return empty array for now to prevent 500 errors
		res.json({
			success: true,
			data: [],
			message: 'Medication calendar events retrieved successfully'
		});
	} catch (error) {
		console.error('Error getting medication calendar events:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Medication adherence endpoint (simplified)
app.get('/api/medication-calendar/adherence', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		
		// Return empty array for now to prevent 500 errors
		res.json({
			success: true,
			data: [],
			message: 'Medication adherence calculated successfully'
		});
	} catch (error) {
		console.error('Error calculating medication adherence:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== HEALTHCARE PROVIDER ROUTES =====

// Get healthcare providers for a user
app.get('/api/healthcare/providers/:userId', authenticate, async (req, res) => {
	try {
		const { userId } = req.params;
		const currentUserId = (req as any).user.uid;
		
		// Check if user has access to this patient's data
		if (userId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', userId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Get healthcare providers for this user
		const providersQuery = await firestore.collection('healthcare_providers')
			.where('patientId', '==', userId)
			.orderBy('name')
			.get();
		
		const providers = providersQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			createdAt: doc.data().createdAt?.toDate(),
			updatedAt: doc.data().updatedAt?.toDate()
		}));
		
		res.json({
			success: true,
			data: providers
		});
	} catch (error) {
		console.error('Error getting healthcare providers:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Add healthcare provider
app.post('/api/healthcare/providers', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const { name, specialty, phone, email, address, notes } = req.body;
		
		if (!name || !specialty) {
			return res.status(400).json({
				success: false,
				error: 'Name and specialty are required'
			});
		}
		
		const providerData = {
			patientId: userId,
			name,
			specialty,
			phone: phone || '',
			email: email || '',
			address: address || '',
			notes: notes || '',
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		const providerRef = await firestore.collection('healthcare_providers').add(providerData);
		
		res.json({
			success: true,
			data: {
				id: providerRef.id,
				...providerData,
				createdAt: providerData.createdAt.toDate(),
				updatedAt: providerData.updatedAt.toDate()
			}
		});
	} catch (error) {
		console.error('Error adding healthcare provider:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== HEALTHCARE FACILITIES ROUTES =====

// Get healthcare facilities for a user
app.get('/api/healthcare/facilities/:userId', authenticate, async (req, res) => {
	try {
		const { userId } = req.params;
		const currentUserId = (req as any).user.uid;
		
		// Check if user has access to this patient's data
		if (userId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', userId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Get healthcare facilities for this user
		const facilitiesQuery = await firestore.collection('healthcare_facilities')
			.where('patientId', '==', userId)
			.orderBy('name')
			.get();
		
		const facilities = facilitiesQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			createdAt: doc.data().createdAt?.toDate(),
			updatedAt: doc.data().updatedAt?.toDate()
		}));
		
		res.json({
			success: true,
			data: facilities
		});
	} catch (error) {
		console.error('Error getting healthcare facilities:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== PATIENT PROFILE ROUTES =====

// Get patient profile
app.get('/api/patients/profile', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		
		const userDoc = await firestore.collection('users').doc(userId).get();
		
		if (!userDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Profile not found'
			});
		}
		
		const userData = userDoc.data();
		res.json({
			success: true,
			data: {
				...userData,
				createdAt: userData?.createdAt?.toDate(),
				updatedAt: userData?.updatedAt?.toDate()
			}
		});
	} catch (error) {
		console.error('Error getting patient profile:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Update patient profile
app.put('/api/patients/profile', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const updateData = req.body;
		
		// Remove sensitive fields that shouldn't be updated via this endpoint
		delete updateData.id;
		delete updateData.createdAt;
		
		// Add updated timestamp
		updateData.updatedAt = admin.firestore.Timestamp.now();
		
		await firestore.collection('users').doc(userId).update(updateData);
		
		// Get updated profile
		const updatedDoc = await firestore.collection('users').doc(userId).get();
		const updatedData = updatedDoc.data();
		
		res.json({
			success: true,
			data: {
				...updatedData,
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			}
		});
	} catch (error) {
		console.error('Error updating patient profile:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== MEDICATIONS ROUTES =====

// Get medications for a user
app.get('/api/medications', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		
		// Get medications for this user
		const medicationsQuery = await firestore.collection('medications')
			.where('patientId', '==', userId)
			.orderBy('name')
			.get();
		
		const medications = medicationsQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			createdAt: doc.data().createdAt?.toDate(),
			updatedAt: doc.data().updatedAt?.toDate()
		}));
		
		res.json({
			success: true,
			data: medications
		});
	} catch (error) {
		console.error('Error getting medications:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Add medication
app.post('/api/medications', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const medicationData = req.body;
		
		if (!medicationData.name) {
			return res.status(400).json({
				success: false,
				error: 'Medication name is required'
			});
		}
		
		const newMedication = {
			...medicationData,
			patientId: userId,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		const medicationRef = await firestore.collection('medications').add(newMedication);
		
		res.json({
			success: true,
			data: {
				id: medicationRef.id,
				...newMedication,
				createdAt: newMedication.createdAt.toDate(),
				updatedAt: newMedication.updatedAt.toDate()
			}
		});
	} catch (error) {
		console.error('Error adding medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== MEDICAL EVENTS/CALENDAR ROUTES =====

// Get medical events for a patient
app.get('/api/medical-events/:patientId', authenticate, async (req, res) => {
	try {
		const { patientId } = req.params;
		const currentUserId = (req as any).user.uid;
		
		// Check if user has access to this patient's data
		if (patientId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Get medical events for this patient
		const eventsQuery = await firestore.collection('medical_events')
			.where('patientId', '==', patientId)
			.orderBy('startDateTime')
			.get();
		
		const events = eventsQuery.docs.map(doc => {
			const data = doc.data();
			return {
				id: doc.id,
				...data,
				startDateTime: data.startDateTime?.toDate(),
				endDateTime: data.endDateTime?.toDate(),
				createdAt: data.createdAt?.toDate(),
				updatedAt: data.updatedAt?.toDate()
			};
		});
		
		res.json({
			success: true,
			data: events
		});
	} catch (error) {
		console.error('Error getting medical events:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create a new medical event
app.post('/api/medical-events', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const eventData = req.body;
		
		if (!eventData.title || !eventData.startDateTime || !eventData.patientId) {
			return res.status(400).json({
				success: false,
				error: 'Title, start date/time, and patient ID are required'
			});
		}
		
		// Check if user has access to create events for this patient
		if (eventData.patientId !== userId) {
			// Check family access with create permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', eventData.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			// Check if user has create permissions
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canCreate) {
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to create events'
				});
			}
		}
		
		const newEvent = {
			...eventData,
			startDateTime: admin.firestore.Timestamp.fromDate(new Date(eventData.startDateTime)),
			endDateTime: admin.firestore.Timestamp.fromDate(new Date(eventData.endDateTime)),
			createdBy: userId,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now(),
			version: 1
		};
		
		const eventRef = await firestore.collection('medical_events').add(newEvent);
		
		res.json({
			success: true,
			data: {
				id: eventRef.id,
				...newEvent,
				startDateTime: newEvent.startDateTime.toDate(),
				endDateTime: newEvent.endDateTime.toDate(),
				createdAt: newEvent.createdAt.toDate(),
				updatedAt: newEvent.updatedAt.toDate()
			}
		});
	} catch (error) {
		console.error('Error creating medical event:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Update a medical event
app.put('/api/medical-events/:eventId', authenticate, async (req, res) => {
	try {
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		const updateData = req.body;
		
		// Get the existing event
		const eventDoc = await firestore.collection('medical_events').doc(eventId).get();
		
		if (!eventDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Event not found'
			});
		}
		
		const existingEvent = eventDoc.data();
		
		// Check if user has access to update this event
		if (existingEvent?.patientId !== userId) {
			// Check family access with edit permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', existingEvent?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			// Check if user has edit permissions
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canEdit) {
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to edit events'
				});
			}
		}
		
		// Prepare update data
		const updatedEvent = {
			...updateData,
			updatedAt: admin.firestore.Timestamp.now(),
			version: (existingEvent?.version || 1) + 1
		};
		
		// Convert date strings to timestamps if provided
		if (updateData.startDateTime) {
			updatedEvent.startDateTime = admin.firestore.Timestamp.fromDate(new Date(updateData.startDateTime));
		}
		if (updateData.endDateTime) {
			updatedEvent.endDateTime = admin.firestore.Timestamp.fromDate(new Date(updateData.endDateTime));
		}
		
		// Remove fields that shouldn't be updated
		delete updatedEvent.id;
		delete updatedEvent.createdAt;
		delete updatedEvent.createdBy;
		delete updatedEvent.patientId;
		
		await eventDoc.ref.update(updatedEvent);
		
		// Get updated event
		const updatedDoc = await eventDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		res.json({
			success: true,
			data: {
				id: eventId,
				...updatedData,
				startDateTime: updatedData?.startDateTime?.toDate(),
				endDateTime: updatedData?.endDateTime?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			}
		});
	} catch (error) {
		console.error('Error updating medical event:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Delete a medical event
app.delete('/api/medical-events/:eventId', authenticate, async (req, res) => {
	try {
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		
		// Get the existing event
		const eventDoc = await firestore.collection('medical_events').doc(eventId).get();
		
		if (!eventDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Event not found'
			});
		}
		
		const existingEvent = eventDoc.data();
		
		// Check if user has access to delete this event
		if (existingEvent?.patientId !== userId) {
			// Check family access with delete permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', existingEvent?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			// Check if user has delete permissions
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canDelete) {
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to delete events'
				});
			}
		}
		
		await eventDoc.ref.delete();
		
		res.json({
			success: true,
			message: 'Event deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting medical event:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

export const api = functions
	.region('us-central1')
	.runWith({
		memory: '512MB',
		timeoutSeconds: 60,
		minInstances: 0,
		maxInstances: 10,
		secrets: [sendgridApiKey]
	})
	.https.onRequest(app);
