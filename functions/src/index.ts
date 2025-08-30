import * as functions from 'firebase-functions/v1';
import { defineSecret } from 'firebase-functions/params';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Admin SDK once
if (!admin.apps.length) {
	admin.initializeApp();
}

// Use custom database ID for Firestore
const firestore = admin.firestore();
// If you're using a custom database ID, you can specify it like this:
// const firestore = admin.firestore('kinconnect-production');

// Define secrets
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const googleAIApiKey = defineSecret('GOOGLE_AI_API_KEY');

const SENDGRID_FROM_EMAIL = 'mike.nguyen@twfg.com';
const APP_URL = 'https://claritystream-uldp9.web.app';

// Create an Express app
const app = express();

// Security middleware - Configure for OAuth compatibility
app.use(helmet({
    crossOriginOpenerPolicy: false, // Disable COOP entirely for OAuth compatibility
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));

// Add explicit headers for OAuth compatibility
app.use((req, res, next) => {
    // Remove any restrictive COOP headers
    res.removeHeader('Cross-Origin-Opener-Policy');
    // Set permissive COOP for OAuth popups
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    next();
});
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - configured for Firebase Functions
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use a simple key for Firebase Functions to avoid proxy issues
        return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});
app.use(limiter); // Apply to all routes, not just /api/

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
app.get('/health', (req, res) => {
	res.json({ success: true, message: 'Functions API healthy', timestamp: new Date().toISOString() });
});

// Test endpoint to verify deployment
app.get('/test-deployment', (req, res) => {
	res.json({ success: true, message: 'Deployment working!', timestamp: new Date().toISOString() });
});

// Test remove endpoint
app.post('/test-remove/:id', (req, res) => {
	res.json({ success: true, message: 'Test remove endpoint working!', id: req.params.id });
});

// ===== INVITATION ROUTES =====

// Send family invitation
app.post('/invitations/send', authenticate, async (req, res) => {
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

		// Normalize email to lowercase for consistent comparison
		const normalizedEmail = email.toLowerCase().trim();

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

		// 🚫 PREVENT SELF-INVITATION: Check if user is trying to invite themselves
		if (normalizedEmail === senderData.email?.toLowerCase().trim()) {
			console.log('🚫 Preventing self-invitation attempt:', normalizedEmail);
			return res.status(400).json({
				success: false,
				error: 'You cannot invite yourself to your own medical calendar'
			});
		}

		//  DUPLICATE PREVENTION: Check for existing invitations/relationships
		console.log('🔍 Checking for existing invitations or relationships...');
		const existingQuery = await firestore.collection('family_calendar_access')
			.where('patientId', '==', senderUserId)
			.where('familyMemberEmail', '==', normalizedEmail)
			.get();

		if (!existingQuery.empty) {
			const existingRecord = existingQuery.docs[0].data();
			console.log('⚠️ Found existing record:', {
				status: existingRecord.status,
				id: existingQuery.docs[0].id
			});

			// Handle different existing statuses
			if (existingRecord.status === 'active') {
				return res.status(409).json({
					success: false,
					error: 'This family member already has active access to your medical calendar'
				});
			} else if (existingRecord.status === 'pending') {
				// Check if invitation has expired
				const expiresAt = existingRecord.invitationExpiresAt?.toDate();
				if (expiresAt && new Date() < expiresAt) {
					return res.status(409).json({
						success: false,
						error: 'An invitation is already pending for this email address. Please wait for them to accept or let the invitation expire.'
					});
				} else {
					// Expired invitation - we'll update it below
					console.log('📝 Found expired invitation, will update it');
				}
			} else if (existingRecord.status === 'revoked') {
				// Previously revoked - we can create a new invitation
				console.log('📝 Found revoked relationship, will create new invitation');
			}
		}

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

		// 🔥 USE DETERMINISTIC DOCUMENT ID to prevent duplicates
		// Format: patientId_emailHash (ensures uniqueness per patient-email combination)
		const emailHash = Buffer.from(normalizedEmail).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
		const documentId = `${senderUserId}_${emailHash}`;

		console.log('💾 Creating/updating family access record with ID:', documentId);
		const familyAccessData = {
			patientId: senderUserId,
			familyMemberId: '', // Will be set when invitation is accepted
			familyMemberName: patientName,
			familyMemberEmail: normalizedEmail, // Use normalized email
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

		// Use set() with merge to handle existing records gracefully
		const familyAccessRef = firestore.collection('family_calendar_access').doc(documentId);
		await familyAccessRef.set(familyAccessData, { merge: false }); // Don't merge, replace completely
		console.log('✅ Family access record created/updated:', documentId);

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
						invitationId: documentId,
						emailError: 'SendGrid API key not configured properly'
					}
				});
			}

			sgMail.setApiKey(apiKey);
			const invitationLink = `${APP_URL}/invitation/${invitationToken}`;
			console.log('🔗 Invitation link:', invitationLink);
			
			const emailContent = {
				to: normalizedEmail, // Use normalized email
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
							<p>This invitation was sent to ${normalizedEmail}. If you didn't expect this invitation, you can safely ignore this email.</p>
							<p>The invitation link will expire in 7 days.</p>
						</div>
					</div>
				`
			};

			console.log('📧 Sending email to:', normalizedEmail);
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
				invitationId: documentId,
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
app.get('/family-access', authenticate, async (req, res) => {
	try {
		console.log('🔍 Fetching family access for user:', (req as any).user.uid);
		const userId = (req as any).user.uid;
		
		// Get family access where user is a family member
		const familyMemberQuery = await firestore.collection('family_calendar_access')
			.where('familyMemberId', '==', userId)
			.where('status', '==', 'active')
			.get();
		
		// Get family access where user is the patient (patientId matches userId)
		const patientQuery = await firestore.collection('family_calendar_access')
			.where('patientId', '==', userId)
			.where('status', '==', 'active')
			.get();

		// 🔥 DEDUPLICATION: Use Maps to track unique relationships
		const uniquePatientsMap = new Map();
		const uniqueFamilyMembersMap = new Map();

		// Process patients the user has access to as a family member
		for (const doc of familyMemberQuery.docs) {
			const access = doc.data();
			console.log('👥 Processing family member access:', access);
			
			// 🚫 PREVENT SELF-REFERENTIAL RELATIONSHIPS: Skip if user is trying to access themselves
			if (access.patientId === userId) {
				console.log('🚫 Skipping self-referential relationship - user cannot be family member to themselves:', userId);
				continue;
			}
			
			// Create unique key for this relationship
			const relationshipKey = `${access.patientId}_${userId}`;
			
			// Skip if we already have this relationship (deduplication)
			if (uniquePatientsMap.has(relationshipKey)) {
				console.log('🔄 Skipping duplicate patient relationship:', relationshipKey);
				continue;
			}
			
			// Get patient info using patientId (not createdBy)
			const patientDoc = await firestore.collection('users').doc(access.patientId).get();
			const patientData = patientDoc.data();
			
			if (patientData) {
				const patientAccess = {
					id: doc.id,
					patientId: access.patientId,
					patientName: patientData.name,
					patientEmail: patientData.email,
					accessLevel: access.accessLevel,
					permissions: access.permissions,
					status: access.status,
					acceptedAt: access.acceptedAt?.toDate(),
					relationship: 'family_member'
				};
				
				uniquePatientsMap.set(relationshipKey, patientAccess);
			} else {
				console.warn('⚠️ Patient data not found for patientId:', access.patientId);
			}
		}

		// Process family members who have access to the current user as a patient
		for (const doc of patientQuery.docs) {
			const access = doc.data();
			console.log('🏥 Processing patient access:', access);
			
			if (access.familyMemberId) {
				// 🚫 PREVENT SELF-REFERENTIAL RELATIONSHIPS: Skip if family member is the same as patient
				if (access.familyMemberId === userId) {
					console.log('🚫 Skipping self-referential relationship - user cannot be their own family member:', userId);
					continue;
				}
				
				// Create unique key for this relationship
				const relationshipKey = `${userId}_${access.familyMemberId}`;
				
				// Skip if we already have this relationship (deduplication)
				if (uniqueFamilyMembersMap.has(relationshipKey)) {
					console.log('🔄 Skipping duplicate family member relationship:', relationshipKey);
					continue;
				}
				
				// Get family member info
				const familyMemberDoc = await firestore.collection('users').doc(access.familyMemberId).get();
				const familyMemberData = familyMemberDoc.data();
				
				if (familyMemberData) {
					const familyMemberAccess = {
						id: doc.id,
						familyMemberId: access.familyMemberId,
						familyMemberName: familyMemberData.name,
						familyMemberEmail: familyMemberData.email,
						accessLevel: access.accessLevel,
						permissions: access.permissions,
						status: access.status,
						acceptedAt: access.acceptedAt?.toDate(),
						relationship: 'patient'
					};
					
					uniqueFamilyMembersMap.set(relationshipKey, familyMemberAccess);
				} else {
					console.warn('⚠️ Family member data not found for familyMemberId:', access.familyMemberId);
				}
			}
		}

		// Convert Maps back to arrays
		const patientsIHaveAccessTo = Array.from(uniquePatientsMap.values());
		const familyMembersWithAccessToMe = Array.from(uniqueFamilyMembersMap.values());

		console.log('✅ Family access results:', {
			patientsIHaveAccessTo: patientsIHaveAccessTo.length,
			familyMembersWithAccessToMe: familyMembersWithAccessToMe.length
		});

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

// Remove family member access via POST to family-access
app.post('/family-access', authenticate, async (req, res) => {
	try {
		const { action, accessId } = req.body;
		const userId = (req as any).user.uid;

		if (action !== 'remove' || !accessId) {
			return res.status(400).json({
				success: false,
				error: 'Invalid request. Expected action: "remove" and accessId'
			});
		}

		console.log('🗑️ Removing family access:', { accessId, userId, timestamp: new Date().toISOString() });

		// Get the family access record
		const accessDoc = await firestore.collection('family_calendar_access').doc(accessId).get();
		
		if (!accessDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Family access record not found'
			});
		}

		const accessData = accessDoc.data();
		
		// Check if the current user is the patient (owner) of this access record
		if (accessData?.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied - you can only remove family members from your own care network'
			});
		}

		// Update the status to 'revoked' instead of deleting (for audit trail)
		await accessDoc.ref.update({
			status: 'revoked',
			revokedAt: admin.firestore.Timestamp.now(),
			revokedBy: userId,
			revocationReason: 'Removed by patient',
			updatedAt: admin.firestore.Timestamp.now()
		});

		console.log('✅ Family access revoked successfully');

		res.json({
			success: true,
			message: 'Family member access removed successfully'
		});

	} catch (error) {
		console.error('❌ Error removing family access:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Remove family member access
app.post('/family-access/remove/:accessId', authenticate, async (req, res) => {
	try {
		const { accessId } = req.params;
		const userId = (req as any).user.uid;

		console.log('🗑️ Removing family access:', { accessId, userId, timestamp: new Date().toISOString() });

		// Get the family access record
		const accessDoc = await firestore.collection('family_calendar_access').doc(accessId).get();
		
		if (!accessDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Family access record not found'
			});
		}

		const accessData = accessDoc.data();
		
		// Check if the current user is the patient (owner) of this access record
		if (accessData?.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied - you can only remove family members from your own care network'
			});
		}

		// Update the status to 'revoked' instead of deleting (for audit trail)
		await accessDoc.ref.update({
			status: 'revoked',
			revokedAt: admin.firestore.Timestamp.now(),
			revokedBy: userId,
			revocationReason: 'Removed by patient',
			updatedAt: admin.firestore.Timestamp.now()
		});

		console.log('✅ Family access revoked successfully');

		res.json({
		    success: true,
		    message: 'Family member access removed successfully'
		});

	} catch (error) {
		console.error('❌ Error removing family access:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get invitation details by token
app.get('/invitations/:token', async (req, res) => {
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

		// For family invitations, the sender is the patient, and the invitation is for a family member
		// So both inviterName and patientName should be the same (the patient who sent the invitation)
		res.json({
			success: true,
			data: {
				id: invitationDoc.id,
				inviterName: senderData?.name || 'Unknown',
				inviterEmail: senderData?.email || 'Unknown',
				patientName: senderData?.name || 'Unknown', // This is correct - patient is the one who sent invitation
				patientEmail: senderData?.email || 'Unknown',
				message: invitation.message || '',
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
app.post('/invitations/accept/:token', authenticate, async (req, res) => {
	try {
		const { token } = req.params;
		const userId = (req as any).user.uid;

		console.log('🤝 Processing invitation acceptance:', { token, userId });

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

		console.log('📋 Found invitation:', {
			id: invitationDoc.id,
			patientId: invitation.patientId,
			familyMemberEmail: invitation.familyMemberEmail
		});

		// Check if invitation has expired
		if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt.toDate()) {
			return res.status(400).json({
				success: false,
				error: 'Invitation has expired'
			});
		}

		// 🔥 RACE CONDITION PREVENTION: Check for existing active relationship
		console.log('🔍 Checking for existing active relationships...');
		const existingActiveQuery = await firestore.collection('family_calendar_access')
			.where('patientId', '==', invitation.patientId)
			.where('familyMemberId', '==', userId)
			.where('status', '==', 'active')
			.get();

		if (!existingActiveQuery.empty) {
			console.log('⚠️ User already has active access to this patient');
			return res.status(409).json({
				success: false,
				error: 'You already have active access to this patient\'s medical calendar'
			});
		}

		// 🔥 DUPLICATE PREVENTION: Check if this user already accepted this specific invitation
		if (invitation.familyMemberId && invitation.familyMemberId === userId && invitation.status === 'active') {
			console.log('⚠️ Invitation already accepted by this user');
			return res.status(409).json({
				success: false,
				error: 'This invitation has already been accepted'
			});
		}

		// Use transaction to ensure atomicity and prevent race conditions
		const result = await firestore.runTransaction(async (transaction) => {
			// Re-check the invitation status within the transaction
			const currentInvitation = await transaction.get(invitationDoc.ref);
			
			if (!currentInvitation.exists) {
				throw new Error('Invitation no longer exists');
			}

			const currentData = currentInvitation.data();
			if (currentData?.status !== 'pending') {
				throw new Error('Invitation is no longer pending');
			}

			// Check again for existing active relationships within transaction
			const activeCheck = await firestore.collection('family_calendar_access')
				.where('patientId', '==', invitation.patientId)
				.where('familyMemberId', '==', userId)
				.where('status', '==', 'active')
				.get();

			if (!activeCheck.empty) {
				throw new Error('Active relationship already exists');
			}

			// 🔥 UPDATE USER TYPE: Tag user as family member when accepting invitation
			console.log('👤 Updating user type to family_member for caretaker:', userId);
			const userRef = firestore.collection('users').doc(userId);
			const userDoc = await transaction.get(userRef);
			
			if (userDoc.exists) {
				// Update existing user's type if they're currently a patient (default)
				const userData = userDoc.data();
				if (userData?.userType === 'patient') {
					console.log('🔄 Converting patient to family_member:', userData.email);
					transaction.update(userRef, {
						userType: 'family_member',
						updatedAt: admin.firestore.Timestamp.now()
					});
				}
			} else {
				// Create user record with family_member type (edge case if user doesn't exist yet)
				console.log('📝 Creating new family_member user record:', userId);
				transaction.set(userRef, {
					id: userId,
					email: invitation.familyMemberEmail,
					name: invitation.familyMemberName || 'Family Member',
					userType: 'family_member',
					createdAt: admin.firestore.Timestamp.now(),
					updatedAt: admin.firestore.Timestamp.now()
				}, { merge: true });
			}

			// Update invitation with family member ID and activate
			transaction.update(invitationDoc.ref, {
				familyMemberId: userId,
				status: 'active',
				acceptedAt: admin.firestore.Timestamp.now(),
				updatedAt: admin.firestore.Timestamp.now(),
				invitationToken: admin.firestore.FieldValue.delete(),
				invitationExpiresAt: admin.firestore.FieldValue.delete()
			});

			return {
				id: invitationDoc.id,
				status: 'active'
			};
		});

		console.log('✅ Invitation accepted successfully:', result);

		res.json({
			success: true,
			message: 'Invitation accepted successfully',
			data: result
		});
	} catch (error: any) {
		console.error('❌ Error accepting invitation:', error);
		
		// Handle specific transaction errors
		if (error.message === 'Invitation no longer exists') {
			return res.status(404).json({
				success: false,
				error: 'Invitation no longer exists'
			});
		} else if (error.message === 'Invitation is no longer pending') {
			return res.status(409).json({
				success: false,
				error: 'This invitation has already been processed'
			});
		} else if (error.message === 'Active relationship already exists') {
			return res.status(409).json({
				success: false,
				error: 'You already have active access to this patient\'s medical calendar'
			});
		}

		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== DRUG SEARCH ROUTES =====

// Search for drugs by name using RxNorm API
app.get('/drugs/search', authenticate, async (req, res) => {
	try {
		const { q: query, limit = '20' } = req.query;

		if (!query || typeof query !== 'string' || query.trim().length < 2) {
			return res.status(400).json({
				success: false,
				error: 'Query parameter is required and must be at least 2 characters long'
			});
		}

		const searchLimit = Math.min(parseInt(limit as string, 10), 50); // Cap at 50 results

		// Use RxNorm API for drug search
		const rxnormUrl = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`;

		console.log('🔍 Searching RxNorm for:', query);

		const response = await fetch(rxnormUrl);

		if (!response.ok) {
			console.warn('RxNorm API error:', response.status, response.statusText);
			// Return empty results instead of error for better UX
			return res.json({
				success: true,
				data: [],
				message: 'No results found'
			});
		}

		const rxnormData: any = await response.json();

		if (!rxnormData?.drugGroup?.conceptGroup) {
			return res.json({
				success: true,
				data: [],
				message: 'No results found'
			});
		}

		// Extract and format drug concepts
		const drugConcepts: any[] = [];

		for (const group of rxnormData.drugGroup.conceptGroup) {
			if (group.conceptProperties && Array.isArray(group.conceptProperties)) {
				for (const concept of group.conceptProperties.slice(0, Math.ceil(searchLimit / 2))) {
					if (drugConcepts.length >= searchLimit) break;

					drugConcepts.push({
						rxcui: concept.rxcui,
						name: concept.name,
						synonym: concept.synonym || concept.name,
						tty: concept.tty,
						language: concept.language
					});
				}
			}
		}

		console.log(`✅ Found ${drugConcepts.length} drug results for query: ${query}`);

		res.json({
			success: true,
			data: drugConcepts,
			message: `Found ${drugConcepts.length} results`
		});
	} catch (error) {
		console.error('Error searching drugs:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error while searching drugs'
		});
	}
});

// Get detailed drug information by RXCUI
app.get('/drugs/:rxcui', authenticate, async (req, res) => {
	try {
		const { rxcui } = req.params;

		if (!rxcui) {
			return res.status(400).json({
				success: false,
				error: 'RXCUI parameter is required'
			});
		}

		// Get drug properties from RxNorm
		const propertiesUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
		const propertiesResponse = await fetch(propertiesUrl);

		if (!propertiesResponse.ok) {
			return res.status(404).json({
				success: false,
				error: 'Drug not found'
			});
		}

		const propertiesData: any = await propertiesResponse.json();

		if (!propertiesData?.properties) {
			return res.status(404).json({
				success: false,
				error: 'Drug properties not found'
			});
		}

		const props = propertiesData.properties;

		const drugDetails = {
			rxcui: props.rxcui,
			name: props.name,
			synonym: props.synonym || props.name,
			tty: props.tty,
			language: props.language,
			suppress: props.suppress
		};

		res.json({
			success: true,
			data: drugDetails
		});
	} catch (error) {
		console.error('Error getting drug details:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get drug interactions for a specific drug
app.get('/drugs/:rxcui/interactions', authenticate, async (req, res) => {
	try {
		const { rxcui } = req.params;

		if (!rxcui) {
			return res.status(400).json({
				success: false,
				error: 'RXCUI parameter is required'
			});
		}

		// Get drug interactions from RxNorm
		const interactionsUrl = `https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`;

		console.log('🔍 Getting interactions for RXCUI:', rxcui);

		const response = await fetch(interactionsUrl);

		if (!response.ok) {
			console.warn('RxNorm interactions API error:', response.status, response.statusText);
			return res.json({
				success: true,
				data: [],
				message: 'No interactions found'
			});
		}

		const interactionsData: any = await response.json();

		if (!interactionsData?.interactionTypeGroup) {
			return res.json({
				success: true,
				data: [],
				message: 'No interactions found'
			});
		}

		// Format interactions data
		const interactions = interactionsData.interactionTypeGroup.map((group: any) => ({
			minConceptItem: {
				rxcui: group.minConceptItem?.rxcui,
				name: group.minConceptItem?.name,
				tty: group.minConceptItem?.tty
			},
			interactionTypeGroup: group.interactionType
		}));

		console.log(`✅ Found ${interactions.length} interaction groups for RXCUI: ${rxcui}`);

		res.json({
			success: true,
			data: interactions
		});
	} catch (error) {
		console.error('Error getting drug interactions:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get spelling suggestions for drug names
app.get('/drugs/suggestions/:query', authenticate, async (req, res) => {
	try {
		const { query } = req.params;

		if (!query || query.trim().length < 2) {
			return res.status(400).json({
				success: false,
				error: 'Query parameter is required and must be at least 2 characters long'
			});
		}

		// Get spelling suggestions from RxNorm
		const suggestionsUrl = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(query)}`;

		console.log('🔍 Getting spelling suggestions for:', query);

		const response = await fetch(suggestionsUrl);

		if (!response.ok) {
			console.warn('RxNorm spelling suggestions API error:', response.status, response.statusText);
			return res.json({
				success: true,
				data: []
			});
		}

		const suggestionsData: any = await response.json();

		const suggestions = suggestionsData?.suggestionGroup?.suggestionList?.suggestion || [];

		console.log(`✅ Found ${suggestions.length} spelling suggestions for: ${query}`);

		res.json({
			success: true,
			data: suggestions
		});
	} catch (error) {
		console.error('Error getting spelling suggestions:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get related drugs (brand names, generics, etc.)
app.get('/drugs/:rxcui/related', authenticate, async (req, res) => {
	try {
		const { rxcui } = req.params;

		if (!rxcui) {
			return res.status(400).json({
				success: false,
				error: 'RXCUI parameter is required'
			});
		}

		// Get related concepts from RxNorm
		const relatedUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=SCD+SBD+GPCK+BPCK`;

		console.log('🔍 Getting related drugs for RXCUI:', rxcui);

		const response = await fetch(relatedUrl);

		if (!response.ok) {
			console.warn('RxNorm related drugs API error:', response.status, response.statusText);
			return res.json({
				success: true,
				data: []
			});
		}

		const relatedData: any = await response.json();

		const relatedDrugs: any[] = [];

		if (relatedData?.relatedGroup?.conceptGroup) {
			for (const group of relatedData.relatedGroup.conceptGroup) {
				if (group.conceptProperties && Array.isArray(group.conceptProperties)) {
					for (const concept of group.conceptProperties) {
						relatedDrugs.push({
							rxcui: concept.rxcui,
							name: concept.name,
							synonym: concept.synonym || concept.name,
							tty: concept.tty,
							language: concept.language
						});
					}
				}
			}
		}

		console.log(`✅ Found ${relatedDrugs.length} related drugs for RXCUI: ${rxcui}`);

		res.json({
			success: true,
			data: relatedDrugs
		});
	} catch (error) {
		console.error('Error getting related drugs:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== EXISTING ROUTES (keeping the working ones) =====

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


// ===== MEDICATION CALENDAR ROUTES =====

// Get medication calendar events
app.get('/medication-calendar/events', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const { startDate, endDate, medicationId, status } = req.query;
		
		// Build query for medication calendar events
		let query = firestore.collection('medication_calendar_events')
			.where('patientId', '==', patientId);
		
		// Add filters if provided
		if (startDate) {
			query = query.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate as string)));
		}
		if (endDate) {
			query = query.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate as string)));
		}
		if (medicationId) {
			query = query.where('medicationId', '==', medicationId);
		}
		if (status) {
			query = query.where('status', '==', status);
		}
		
		const eventsSnapshot = await query.orderBy('scheduledDateTime').get();
		
		const events = eventsSnapshot.docs.map(doc => {
			const data = doc.data();
			return {
				id: doc.id,
				...data,
				scheduledDateTime: data.scheduledDateTime?.toDate(),
				actualTakenDateTime: data.actualTakenDateTime?.toDate(),
				createdAt: data.createdAt?.toDate(),
				updatedAt: data.updatedAt?.toDate()
			};
		});
		
		res.json({
			success: true,
			data: events,
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

// Get medication adherence data
app.get('/medication-calendar/adherence', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const { startDate, endDate, medicationId } = req.query;
		
		// Set default date range if not provided (last 30 days)
		const defaultEndDate = new Date();
		const defaultStartDate = new Date();
		defaultStartDate.setDate(defaultStartDate.getDate() - 30);
		
		const queryStartDate = startDate ? new Date(startDate as string) : defaultStartDate;
		const queryEndDate = endDate ? new Date(endDate as string) : defaultEndDate;
		
		// Build query for medication calendar events in date range
		let query = firestore.collection('medication_calendar_events')
			.where('patientId', '==', patientId)
			.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(queryStartDate))
			.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(queryEndDate));
		
		if (medicationId) {
			query = query.where('medicationId', '==', medicationId);
		}
		
		const eventsSnapshot = await query.get();
		
		// Calculate adherence metrics
		const events = eventsSnapshot.docs.map(doc => doc.data());
		const totalScheduled = events.length;
		const takenEvents = events.filter(e => e.status === 'taken');
		const missedEvents = events.filter(e => e.status === 'missed');
		const skippedEvents = events.filter(e => e.status === 'skipped');
		const lateEvents = events.filter(e => e.status === 'late');
		
		const adherenceData = {
			totalScheduledDoses: totalScheduled,
			takenDoses: takenEvents.length,
			missedDoses: missedEvents.length,
			skippedDoses: skippedEvents.length,
			lateDoses: lateEvents.length,
			adherenceRate: totalScheduled > 0 ? ((takenEvents.length + lateEvents.length) / totalScheduled) * 100 : 0,
			onTimeRate: totalScheduled > 0 ? (takenEvents.length / totalScheduled) * 100 : 0,
			missedRate: totalScheduled > 0 ? (missedEvents.length / totalScheduled) * 100 : 0,
			period: {
				startDate: queryStartDate,
				endDate: queryEndDate,
				days: Math.ceil((queryEndDate.getTime() - queryStartDate.getTime()) / (1000 * 60 * 60 * 24))
			}
		};
		
		res.json({
			success: true,
			data: [adherenceData], // Return as array to match expected format
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

// Mark medication as taken
app.post('/medication-calendar/events/:eventId/taken', authenticate, async (req, res) => {
	try {
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		const { takenAt, notes } = req.body;
		
		const eventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();
		
		if (!eventDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication event not found'
			});
		}
		
		const eventData = eventDoc.data();
		
		// Check if user has access to this event
		if (eventData?.patientId !== userId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', eventData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Update the event
		const updateData = {
			status: 'taken',
			actualTakenDateTime: takenAt ? admin.firestore.Timestamp.fromDate(new Date(takenAt)) : admin.firestore.Timestamp.now(),
			takenBy: userId,
			notes: notes || undefined,
			isOnTime: true, // Calculate based on scheduled time vs actual time
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Calculate if taken on time (within 30 minutes of scheduled time)
		if (eventData?.scheduledDateTime) {
			const scheduledTime = eventData.scheduledDateTime.toDate();
			const takenTime = updateData.actualTakenDateTime.toDate();
			const timeDiffMinutes = Math.abs((takenTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
			updateData.isOnTime = timeDiffMinutes <= 30;
			
			if (timeDiffMinutes > 30) {
				updateData.status = 'late';
				(updateData as any).minutesLate = Math.round(timeDiffMinutes);
			}
		}
		
		await eventDoc.ref.update(updateData);
		
		// Get updated event
		const updatedDoc = await eventDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		res.json({
			success: true,
			data: {
				id: eventId,
				...updatedData,
				scheduledDateTime: updatedData?.scheduledDateTime?.toDate(),
				actualTakenDateTime: updatedData?.actualTakenDateTime?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			},
			message: 'Medication marked as taken successfully'
		});
	} catch (error) {
		console.error('Error marking medication as taken:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== HEALTHCARE PROVIDER ROUTES =====

// Get healthcare providers for a user
app.get('/healthcare/providers/:userId', authenticate, async (req, res) => {
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
app.post('/healthcare/providers', authenticate, async (req, res) => {
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
app.get('/healthcare/facilities/:userId', authenticate, async (req, res) => {
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
app.get('/patients/profile', authenticate, async (req, res) => {
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
app.put('/patients/profile', authenticate, async (req, res) => {
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
app.get('/medications', authenticate, async (req, res) => {
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
app.post('/medications', authenticate, async (req, res) => {
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
app.get('/medical-events/:patientId', authenticate, async (req, res) => {
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
app.post('/medical-events', authenticate, async (req, res) => {
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
app.put('/medical-events/:eventId', authenticate, async (req, res) => {
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
app.delete('/medical-events/:eventId', authenticate, async (req, res) => {
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

// ===== VISIT SUMMARY ROUTES =====

// Google AI Service Helper
async function processVisitSummaryWithAI(doctorSummary: string, treatmentPlan: string) {
  try {
    const apiKey = googleAIApiKey.value();
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Initialize Google AI (will work when package is installed)
    // const genAI = new GoogleGenerativeAI(apiKey);
    // const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are a medical assistant helping to process doctor visit notes.
Please analyze the following visit summary and treatment plan, then provide a structured response.

Visit Summary: ${doctorSummary}
Treatment Plan: ${treatmentPlan}

Please provide a JSON response with the following structure:
{
  "keyPoints": ["bullet point 1", "bullet point 2", ...],
  "actionItems": ["action 1", "action 2", ...],
  "medicationChanges": {
    "newMedications": [{"name": "", "dosage": "", "instructions": "", "startDate": ""}],
    "stoppedMedications": [{"name": "", "reason": "", "stopDate": ""}],
    "changedMedications": [{"name": "", "oldDosage": "", "newDosage": "", "changeReason": ""}]
  },
  "followUpRequired": boolean,
  "followUpDate": "YYYY-MM-DD or null",
  "urgencyLevel": "low|medium|high|urgent",
  "riskFactors": ["risk 1", "risk 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "warningFlags": ["warning 1", "warning 2", ...]
}

Focus on medical accuracy and patient safety. Extract specific, actionable information.
`;

    // For now, return a mock response until Google AI package is properly installed
    // TODO: Replace with actual Google AI call
    // const result = await model.generateContent(prompt);
    // const response = await result.response;
    // const text = response.text();
    
    // Mock response for development
    const mockResponse = {
      keyPoints: [
        "Patient presented with chief complaint",
        "Physical examination findings documented",
        "Treatment plan discussed with patient"
      ],
      actionItems: [
        "Schedule follow-up appointment in 2 weeks",
        "Monitor symptoms and report any changes",
        "Take medications as prescribed"
      ],
      medicationChanges: {
        newMedications: [],
        stoppedMedications: [],
        changedMedications: []
      },
      followUpRequired: true,
      followUpDate: null,
      urgencyLevel: "medium",
      riskFactors: [],
      recommendations: [
        "Continue current treatment plan",
        "Maintain regular exercise routine"
      ],
      warningFlags: []
    };

    return {
      success: true,
      data: mockResponse,
      metadata: {
        promptTokenCount: prompt.length,
        processingTime: 1000,
        model: 'gemini-pro'
      }
    };
  } catch (error) {
    console.error('Error processing visit summary with AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI processing failed'
    };
  }
}

// Create a new visit summary
app.post('/visit-summaries', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const visitData = req.body;
    
    console.log('🏥 Creating visit summary for patient:', visitData.patientId);
    
    if (!visitData.patientId || !visitData.doctorSummary || !visitData.visitDate) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID, doctor summary, and visit date are required'
      });
    }
    
    // Check if user has access to create visit summaries for this patient
    if (visitData.patientId !== userId) {
      // Check family access
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', visitData.patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Check if user has permissions to create visit summaries
      const accessData = familyAccess.docs[0].data();
      if (!accessData.permissions?.canCreate && !accessData.permissions?.canViewMedicalDetails) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to create visit summaries'
        });
      }
    }
    
    // Create visit summary document
    const newVisitSummary = {
      patientId: visitData.patientId,
      medicalEventId: visitData.medicalEventId || null,
      visitDate: admin.firestore.Timestamp.fromDate(new Date(visitData.visitDate)),
      providerName: visitData.providerName || '',
      providerSpecialty: visitData.providerSpecialty || '',
      providerId: visitData.providerId || '',
      facilityName: visitData.facilityName || '',
      facilityId: visitData.facilityId || '',
      visitType: visitData.visitType || 'scheduled',
      visitDuration: visitData.visitDuration || null,
      doctorSummary: visitData.doctorSummary,
      treatmentPlan: visitData.treatmentPlan || '',
      inputMethod: visitData.inputMethod || 'text',
      voiceTranscriptionId: visitData.voiceTranscriptionId || null,
      chiefComplaint: visitData.chiefComplaint || '',
      diagnosis: visitData.diagnosis || [],
      procedures: visitData.procedures || [],
      labResults: visitData.labResults || [],
      imagingResults: visitData.imagingResults || [],
      vitalSigns: visitData.vitalSigns || {},
      processingStatus: 'pending',
      aiProcessingAttempts: 0,
      sharedWithFamily: visitData.sharedWithFamily !== false, // Default to true
      familyAccessLevel: visitData.familyAccessLevel || 'summary_only',
      restrictedFields: visitData.restrictedFields || [],
      tags: visitData.tags || [],
      categories: visitData.categories || [],
      createdBy: userId,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      version: 1
    };
    
    // Save to Firestore
    const visitSummaryRef = await firestore.collection('visit_summaries').add(newVisitSummary);
    console.log('✅ Visit summary created:', visitSummaryRef.id);
    
    // Process with AI asynchronously
    processVisitSummaryWithAI(visitData.doctorSummary, visitData.treatmentPlan || '')
      .then(async (aiResult) => {
        try {
          if (aiResult.success) {
            await visitSummaryRef.update({
              aiProcessedSummary: aiResult.data,
              processingStatus: 'completed',
              googleAIResponseMetadata: aiResult.metadata,
              updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('✅ AI processing completed for visit summary:', visitSummaryRef.id);
          } else {
            await visitSummaryRef.update({
              processingStatus: 'failed',
              aiProcessingError: aiResult.error,
              aiProcessingAttempts: 1,
              lastProcessingAttempt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now()
            });
            console.error('❌ AI processing failed for visit summary:', visitSummaryRef.id, aiResult.error);
          }
        } catch (updateError) {
          console.error('❌ Error updating visit summary with AI results:', updateError);
        }
      })
      .catch((error) => {
        console.error('❌ Unexpected error in AI processing:', error);
      });
    
    // Return immediate response
    res.json({
      success: true,
      data: {
        id: visitSummaryRef.id,
        ...newVisitSummary,
        visitDate: newVisitSummary.visitDate.toDate(),
        createdAt: newVisitSummary.createdAt.toDate(),
        updatedAt: newVisitSummary.updatedAt.toDate()
      },
      message: 'Visit summary created successfully. AI processing in progress.'
    });
    
  } catch (error) {
    console.error('❌ Error creating visit summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get visit summaries for a patient
app.get('/visit-summaries/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const currentUserId = (req as any).user.uid;
    const { limit = '10', offset = '0', status, urgencyLevel } = req.query;
    
    console.log('🔍 Fetching visit summaries for patient:', patientId);
    
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
    
    // Build query
    let query = firestore.collection('visit_summaries')
      .where('patientId', '==', patientId)
      .orderBy('visitDate', 'desc');
    
    // Add filters
    if (status) {
      query = query.where('processingStatus', '==', status);
    }
    
    // Apply pagination
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const offsetNum = parseInt(offset as string, 10);
    
    if (offsetNum > 0) {
      const offsetSnapshot = await query.limit(offsetNum).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }
    
    const summariesSnapshot = await query.limit(limitNum).get();
    
    const summaries = summariesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        visitDate: data.visitDate?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastProcessingAttempt: data.lastProcessingAttempt?.toDate()
      };
    });
    
    	// Filter by urgency level if specified (post-query filter since it's nested)
	let filteredSummaries = summaries;
	if (urgencyLevel) {
		filteredSummaries = summaries.filter((summary: any) =>
			summary.aiProcessedSummary?.urgencyLevel === urgencyLevel
		);
	}
    
    console.log(`✅ Found ${filteredSummaries.length} visit summaries for patient:`, patientId);
    
    res.json({
      success: true,
      data: filteredSummaries,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: summariesSnapshot.docs.length === limitNum
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching visit summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get a specific visit summary
app.get('/visit-summaries/:patientId/:summaryId', authenticate, async (req, res) => {
  try {
    const { patientId, summaryId } = req.params;
    const currentUserId = (req as any).user.uid;
    
    console.log('🔍 Fetching visit summary:', summaryId, 'for patient:', patientId);
    
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
    
    const summaryDoc = await firestore.collection('visit_summaries').doc(summaryId).get();
    
    if (!summaryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Visit summary not found'
      });
    }
    
    const summaryData = summaryDoc.data();
    
    // Verify the summary belongs to the specified patient
    if (summaryData?.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const summary = {
      id: summaryDoc.id,
      ...summaryData,
      visitDate: summaryData?.visitDate?.toDate(),
      createdAt: summaryData?.createdAt?.toDate(),
      updatedAt: summaryData?.updatedAt?.toDate(),
      lastProcessingAttempt: summaryData?.lastProcessingAttempt?.toDate()
    };
    
    console.log('✅ Visit summary found:', summaryId);
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('❌ Error fetching visit summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Retry AI processing for a visit summary
app.post('/visit-summaries/:patientId/:summaryId/retry-ai', authenticate, async (req, res) => {
  try {
    const { patientId, summaryId } = req.params;
    const currentUserId = (req as any).user.uid;
    
    console.log('🔄 Retrying AI processing for visit summary:', summaryId);
    
    // Check access permissions
    if (patientId !== currentUserId) {
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
    
    const summaryDoc = await firestore.collection('visit_summaries').doc(summaryId).get();
    
    if (!summaryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Visit summary not found'
      });
    }
    
    const summaryData = summaryDoc.data();
    
    if (summaryData?.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Update status to processing
    await summaryDoc.ref.update({
      processingStatus: 'processing',
      aiProcessingAttempts: (summaryData?.aiProcessingAttempts || 0) + 1,
      lastProcessingAttempt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    // Process with AI
    const aiResult = await processVisitSummaryWithAI(
      summaryData?.doctorSummary || '',
      summaryData?.treatmentPlan || ''
    );
    
    if (aiResult.success) {
      await summaryDoc.ref.update({
        aiProcessedSummary: aiResult.data,
        processingStatus: 'completed',
        googleAIResponseMetadata: aiResult.metadata,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      res.json({
        success: true,
        data: aiResult.data,
        message: 'AI processing completed successfully'
      });
    } else {
      await summaryDoc.ref.update({
        processingStatus: 'failed',
        aiProcessingError: aiResult.error,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      res.status(500).json({
        success: false,
        error: aiResult.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error retrying AI processing:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update visit summary
app.put('/visit-summaries/:patientId/:summaryId', authenticate, async (req, res) => {
  try {
    const { patientId, summaryId } = req.params;
    const currentUserId = (req as any).user.uid;
    const updateData = req.body;
    
    console.log('📝 Updating visit summary:', summaryId);
    
    // Check access permissions
    if (patientId !== currentUserId) {
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
      
      // Check edit permissions
      const accessData = familyAccess.docs[0].data();
      if (!accessData.permissions?.canEdit) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to edit visit summaries'
        });
      }
    }
    
    const summaryDoc = await firestore.collection('visit_summaries').doc(summaryId).get();
    
    if (!summaryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Visit summary not found'
      });
    }
    
    const existingData = summaryDoc.data();
    
    if (existingData?.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Prepare update data
    const updatedSummary = {
      ...updateData,
      updatedBy: currentUserId,
      updatedAt: admin.firestore.Timestamp.now(),
      version: (existingData?.version || 1) + 1
    };
    
    // Convert date strings to timestamps if provided
    if (updateData.visitDate) {
      updatedSummary.visitDate = admin.firestore.Timestamp.fromDate(new Date(updateData.visitDate));
    }
    
    // Remove fields that shouldn't be updated
    delete updatedSummary.id;
    delete updatedSummary.patientId;
    delete updatedSummary.createdAt;
    delete updatedSummary.createdBy;
    
    await summaryDoc.ref.update(updatedSummary);
    
    // Get updated document
    const updatedDoc = await summaryDoc.ref.get();
    const updatedData = updatedDoc.data();
    
    res.json({
      success: true,
      data: {
        id: summaryId,
        ...updatedData,
        visitDate: updatedData?.visitDate?.toDate(),
        createdAt: updatedData?.createdAt?.toDate(),
        updatedAt: updatedData?.updatedAt?.toDate()
      },
      message: 'Visit summary updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating visit summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete visit summary
app.delete('/visit-summaries/:patientId/:summaryId', authenticate, async (req, res) => {
  try {
    const { patientId, summaryId } = req.params;
    const currentUserId = (req as any).user.uid;
    
    console.log('🗑️ Deleting visit summary:', summaryId);
    
    // Check access permissions
    if (patientId !== currentUserId) {
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
      
      // Check delete permissions
      const accessData = familyAccess.docs[0].data();
      if (!accessData.permissions?.canDelete) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to delete visit summaries'
        });
      }
    }
    
    const summaryDoc = await firestore.collection('visit_summaries').doc(summaryId).get();
    
    if (!summaryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Visit summary not found'
      });
    }
    
    const summaryData = summaryDoc.data();
    
    if (summaryData?.patientId !== patientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    await summaryDoc.ref.delete();
    
    res.json({
      success: true,
      message: 'Visit summary deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting visit summary:', error);
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
		secrets: [sendgridApiKey, googleAIApiKey]
	})
	.https.onRequest(app);
