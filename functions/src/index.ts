import * as functions from 'firebase-functions/v1';
import { defineSecret } from 'firebase-functions/params';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import unified medication API
import unifiedMedicationApi from './api/unified/unifiedMedicationApi';
import notificationPreferencesApi from './api/notificationPreferences';
import familyAdherenceNotificationsApi from './api/familyAdherenceNotifications';
import medicationCalendarSyncApi from './api/medicationCalendarSync';

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

// Access levels for email template
const ACCESS_LEVELS = [
  { value: 'full', label: 'Full Access', description: 'Can view, create, and edit all medical information' },
  { value: 'limited', label: 'Limited Access', description: 'Can view and create appointments, limited medical info' },
  { value: 'view_only', label: 'View Only', description: 'Can only view basic appointment information' },
  { value: 'emergency_only', label: 'Emergency Only', description: 'Only receives emergency notifications' }
];

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

// Enhanced rate limiting with circuit breaker logic for medication operations
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased from 300 to 500 requests per 15 minutes for medication operations
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use a simple key for Firebase Functions to avoid proxy issues
        return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
    },
    skip: (req) => {
        // Skip rate limiting for health checks and critical medication operations
        const skipPaths = [
            '/health',
            '/medication-calendar/events',
            '/medications',
            '/medication-calendar/check-missing-events'
        ];
        return skipPaths.some(path => req.path.includes(path));
    },
    handler: (req, res) => {
        // Enhanced handler with medication-specific logic
        const isMedicationRequest = req.path.includes('medication');
        console.log('⚠️ Rate limit exceeded for:', req.ip, req.path, 'isMedication:', isMedicationRequest);
        
        // More lenient handling for medication operations
        const retryAfter = isMedicationRequest ? 30 : 60; // Shorter retry for medication ops
        
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.',
            retryAfter,
            isMedicationOperation: isMedicationRequest,
            suggestion: isMedicationRequest ? 'Medication operations have priority - retry in 30 seconds' : 'General rate limit - retry in 60 seconds'
        });
    }
});
app.use(limiter); // Apply to all routes, not just /api/

// Enhanced auth middleware with comprehensive error logging
async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
	try {
		// Enhanced logging for unified medication API requests
		const isUnifiedMedicationAPI = req.path.includes('/unified-medication');
		if (isUnifiedMedicationAPI) {
			console.log('🔐 UNIFIED API AUTH CHECK:', {
				path: req.path,
				method: req.method,
				hasAuthHeader: !!req.headers.authorization,
				timestamp: new Date().toISOString()
			});
		}

		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
		if (!token) {
			console.error('❌ Authentication failed - no token:', {
				path: req.path,
				method: req.method,
				ip: req.ip,
				userAgent: req.headers['user-agent'],
				isUnifiedAPI: isUnifiedMedicationAPI,
				timestamp: new Date().toISOString()
			});
			return res.status(401).json({
				success: false,
				error: 'Access token required',
				errorCode: 'AUTH_TOKEN_MISSING',
				timestamp: new Date().toISOString()
			});
		}
		const decoded = await admin.auth().verifyIdToken(token);
		// Attach to request
		(req as any).user = decoded;
		
		// Enhanced success logging for unified medication API
		if (isUnifiedMedicationAPI) {
			console.log('✅ UNIFIED API AUTH SUCCESS:', {
				path: req.path,
				method: req.method,
				userId: decoded.uid,
				email: decoded.email,
				timestamp: new Date().toISOString()
			});
		}
		
		return next();
	} catch (err) {
		const isUnifiedMedicationAPI = req.path.includes('/unified-medication');
		console.error('❌ Authentication failed - invalid token:', {
			path: req.path,
			method: req.method,
			ip: req.ip,
			error: err instanceof Error ? err.message : 'Unknown error',
			errorCode: (err as any)?.code || 'Unknown code',
			isUnifiedAPI: isUnifiedMedicationAPI,
			timestamp: new Date().toISOString()
		});
		return res.status(403).json({
			success: false,
			error: 'Invalid or expired token',
			errorCode: 'AUTH_TOKEN_INVALID',
			timestamp: new Date().toISOString()
		});
	}
}

// Helper function to generate calendar events for a medication schedule
async function generateCalendarEventsForSchedule(scheduleId: string, scheduleData: any) {
	try {
		console.log('📅 Generating calendar events for schedule:', scheduleId);
		
		// 🔥 DUPLICATE PREVENTION: Check if events already exist for this schedule
		const existingEventsQuery = await firestore.collection('medication_calendar_events')
			.where('medicationScheduleId', '==', scheduleId)
			.limit(1)
			.get();
		
		if (!existingEventsQuery.empty) {
			console.log('⚠️ Calendar events already exist for schedule:', scheduleId, '- skipping generation');
			return;
		}
		
		const startDate = scheduleData.startDate.toDate();
		const endDate = scheduleData.endDate ? scheduleData.endDate.toDate() : null;
		const isIndefinite = scheduleData.isIndefinite;
		
		// Generate events for the next 30 days (or until end date if sooner)
		const generateUntil = new Date();
		if (endDate && !isIndefinite) {
			generateUntil.setTime(Math.min(
				new Date().getTime() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
				endDate.getTime()
			));
		} else {
			generateUntil.setDate(generateUntil.getDate() + 30); // 30 days from now
		}
		
		const events = [];
		const currentDate = new Date(startDate);
		
		while (currentDate <= generateUntil) {
			let shouldCreateEvent = false;
			
			// Check if we should create an event for this date based on frequency
			switch (scheduleData.frequency) {
				case 'daily':
				case 'once_daily':
				case 'twice_daily':
				case 'three_times_daily':
				case 'four_times_daily':
					shouldCreateEvent = true;
					break;
				case 'weekly':
					if (scheduleData.daysOfWeek && scheduleData.daysOfWeek.includes(currentDate.getDay())) {
						shouldCreateEvent = true;
					}
					break;
				case 'monthly':
					if (currentDate.getDate() === (scheduleData.dayOfMonth || 1)) {
						shouldCreateEvent = true;
					}
					break;
				case 'as_needed':
					// Don't generate automatic events for PRN medications
					shouldCreateEvent = false;
					break;
			}
			
			if (shouldCreateEvent) {
				// Create events for each time in the schedule
				for (const time of scheduleData.times) {
					const [hours, minutes] = time.split(':').map(Number);
					const eventDateTime = new Date(currentDate);
					eventDateTime.setHours(hours, minutes, 0, 0);
					
					// Only create events for future times (don't create past events)
					if (eventDateTime > new Date()) {
						const event = {
							medicationScheduleId: scheduleId,
							medicationId: scheduleData.medicationId,
							medicationName: scheduleData.medicationName,
							patientId: scheduleData.patientId,
							scheduledDateTime: admin.firestore.Timestamp.fromDate(eventDateTime),
							dosageAmount: scheduleData.dosageAmount,
							instructions: scheduleData.instructions || '',
							status: 'scheduled',
							reminderMinutesBefore: scheduleData.reminderMinutesBefore || [15, 5],
							isRecurring: true,
							eventType: 'medication',
							createdAt: admin.firestore.Timestamp.now(),
							updatedAt: admin.firestore.Timestamp.now()
						};
						
						events.push(event);
					}
				}
			}
			
			// Move to next day
			currentDate.setDate(currentDate.getDate() + 1);
		}
		
		// Batch create all events with additional duplicate prevention
		if (events.length > 0) {
			console.log(`📅 Creating ${events.length} calendar events for schedule:`, scheduleId);
			
			// 🔥 FINAL DUPLICATE CHECK: Verify no events exist for these exact times
			const eventTimestamps = events.map(e => e.scheduledDateTime);
			const duplicateCheckQuery = await firestore.collection('medication_calendar_events')
				.where('medicationId', '==', scheduleData.medicationId)
				.where('patientId', '==', scheduleData.patientId)
				.get();
			
			const existingTimes = new Set();
			duplicateCheckQuery.docs.forEach(doc => {
				const data = doc.data();
				if (data.scheduledDateTime) {
					existingTimes.add(data.scheduledDateTime.toDate().toISOString());
				}
			});
			
			// Filter out events that would create duplicates
			const uniqueEvents = events.filter(event => {
				const eventTimeISO = event.scheduledDateTime.toDate().toISOString();
				return !existingTimes.has(eventTimeISO);
			});
			
			if (uniqueEvents.length > 0) {
				console.log(`📅 Creating ${uniqueEvents.length} unique calendar events (filtered ${events.length - uniqueEvents.length} duplicates)`);
				
				const batch = firestore.batch();
				uniqueEvents.forEach(event => {
					const eventRef = firestore.collection('medication_calendar_events').doc();
					batch.set(eventRef, event);
				});
				
				await batch.commit();
				console.log('✅ Calendar events created successfully');
			} else {
				console.log('ℹ️ No new calendar events to create (all would be duplicates)');
			}
		} else {
			console.log('ℹ️ No calendar events to create (all would be in the past)');
		}
		
	} catch (error) {
		console.error('❌ Error generating calendar events:', error);
		throw error;
	}
}

// Health endpoint
app.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'Enhanced Functions API healthy with family access improvements',
		timestamp: new Date().toISOString(),
		version: '2.0.0'
	});
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
		console.log('🚀 Starting unified invitation send process...');
		const {
			email,
			patientName,
			message,
			phone,
			relationship,
			accessLevel,
			permissions: requestedPermissions,
			isEmergencyContact,
			preferredContactMethod
		} = req.body;
		const senderUserId = (req as any).user.uid;
		
		console.log('📧 Unified invitation request:', {
			email,
			familyMemberName: patientName,
			senderUserId,
			hasAdvancedData: !!(relationship || accessLevel || requestedPermissions),
			accessLevel,
			permissionsCount: requestedPermissions?.length || 0,
			relationship
		});
		
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

		// 🚫 Restrict: Only patients can send invitations (family members cannot)
		if (senderData.userType && senderData.userType !== 'patient') {
			return res.status(403).json({
				success: false,
				error: 'Only patients can invite family members'
			});
		}

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

		// Define permissions for the invitation - use advanced data if provided
		let finalPermissions;
		let finalAccessLevel = 'limited';
		
		if (requestedPermissions && accessLevel) {
			// Advanced mode - use provided permissions
			console.log('🎯 Using advanced permission data:', { accessLevel, requestedPermissions });
			finalAccessLevel = accessLevel;
			
			// Convert array of permission strings to permission object
			finalPermissions = {
				canView: requestedPermissions.includes('view_appointments'),
				canCreate: requestedPermissions.includes('create_appointments'),
				canEdit: requestedPermissions.includes('edit_appointments'),
				canDelete: requestedPermissions.includes('cancel_appointments'),
				canClaimResponsibility: true, // Always allow claiming responsibility
				canManageFamily: false, // Reserved for patients only
				canViewMedicalDetails: requestedPermissions.includes('view_medical_records'),
				canReceiveNotifications: requestedPermissions.includes('receive_notifications')
			};
		} else {
			// Simple mode - use default basic permissions
			console.log('🎯 Using default basic permissions for simple invitation');
			finalPermissions = {
				canView: true,
				canCreate: false,
				canEdit: false,
				canDelete: false,
				canClaimResponsibility: true,
				canManageFamily: false,
				canViewMedicalDetails: false,
				canReceiveNotifications: true
			};
		}
		
		console.log('🔐 Final permissions to be saved:', finalPermissions);

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
			permissions: finalPermissions,
			accessLevel: finalAccessLevel,
			
			// Advanced invitation data
			relationship: relationship || 'family_member',
			phone: phone || '',
			isEmergencyContact: isEmergencyContact || false,
			preferredContactMethod: preferredContactMethod || 'email',
			invitationMessage: message || '',
			
			eventTypesAllowed: [],
			emergencyAccess: isEmergencyContact || false,
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
			
			// Generate permission list for email
			const permissionsList = [];
			if (finalPermissions.canView) permissionsList.push('View medical appointments and events');
			if (finalPermissions.canCreate) permissionsList.push('Schedule new appointments');
			if (finalPermissions.canEdit) permissionsList.push('Edit existing appointments');
			if (finalPermissions.canDelete) permissionsList.push('Cancel appointments');
			if (finalPermissions.canViewMedicalDetails) permissionsList.push('Access medical records and details');
			if (finalPermissions.canClaimResponsibility) permissionsList.push('Claim transportation responsibilities');
			if (finalPermissions.canReceiveNotifications) permissionsList.push('Receive email notifications and reminders');
			if (isEmergencyContact) permissionsList.push('Receive emergency medical notifications');

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
							<p><strong>${senderData.name}</strong> has invited you to access their medical calendar on KinConnect${relationship && relationship !== 'family_member' ? ` as their ${relationship.replace(/_/g, ' ')}` : ''}.</p>
							${message ? `<div style="background: #e0f2fe; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #0288d1;"><p style="margin: 0; font-style: italic;">"${message}"</p></div>` : ''}
						</div>
						
						<div style="margin-bottom: 20px;">
							<h3 style="color: #1e293b;">Your Access Level: ${ACCESS_LEVELS.find(l => l.value === finalAccessLevel)?.label || 'Limited Access'}</h3>
							<p style="color: #64748b; margin-bottom: 15px;">${ACCESS_LEVELS.find(l => l.value === finalAccessLevel)?.description || 'You can view and coordinate basic medical information.'}</p>
							<h4 style="color: #1e293b; margin-bottom: 10px;">What you can do:</h4>
							<ul style="color: #475569;">
								${permissionsList.map(permission => `<li>${permission}</li>`).join('')}
							</ul>
							${isEmergencyContact ? '<p style="color: #dc2626; font-weight: bold; margin-top: 15px;">⚠️ You are designated as an emergency contact</p>' : ''}
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
							${phone ? `<p>Contact method: ${preferredContactMethod || 'email'}</p>` : ''}
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
		const userEmail = (req as any).user.email;
		
		// Get family access where user is a family member
		const familyMemberQuery = await firestore.collection('family_calendar_access')
			.where('familyMemberId', '==', userId)
			.where('status', '==', 'active')
			.get();
		
		let familyMemberDocs = familyMemberQuery.docs;
		
		// 🔧 FALLBACK: If no results and user has email, check by email
		if (familyMemberDocs.length === 0 && userEmail) {
			console.log('🔧 No familyMemberId matches, checking by email fallback:', userEmail);
			
			const emailFallbackQuery = await firestore.collection('family_calendar_access')
				.where('familyMemberEmail', '==', userEmail.toLowerCase())
				.where('status', '==', 'active')
				.get();
			
			// Auto-repair missing familyMemberId
			const repairPromises = [];
			for (const doc of emailFallbackQuery.docs) {
				const data = doc.data();
				if (!data.familyMemberId) {
					console.log('🔧 Auto-repairing missing familyMemberId for document:', doc.id);
					
					repairPromises.push(
						doc.ref.update({
							familyMemberId: userId,
							updatedAt: admin.firestore.Timestamp.now(),
							repairedAt: admin.firestore.Timestamp.now(),
							repairReason: 'auto_repair_missing_family_member_id'
						})
					);
				}
			}
			
			// Execute repairs
			if (repairPromises.length > 0) {
				await Promise.all(repairPromises);
				console.log(`✅ Auto-repaired ${repairPromises.length} family access records`);
			}
			
			familyMemberDocs = emailFallbackQuery.docs;
		}
		
		// Get family access where user is the patient (patientId matches userId)
		const patientQuery = await firestore.collection('family_calendar_access')
			.where('patientId', '==', userId)
			.where('status', '==', 'active')
			.get();

		// 🔥 DEDUPLICATION: Use Maps to track unique relationships
		const uniquePatientsMap = new Map();
		const uniqueFamilyMembersMap = new Map();

		// Process patients the user has access to as a family member
		for (const doc of familyMemberDocs) {
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
		
// Repair endpoint for family member patient links
app.post('/repair-family-member-patient-links', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const userEmail = (req as any).user.email;
		
		console.log('🔧 Starting family member patient links repair for user:', userId);
		
		const repairResults = {
			familyMembersScanned: 0,
			familyMembersNeedingRepair: 0,
			familyMembersRepaired: 0,
			patientsUpdated: 0,
			errors: [] as string[]
		};
		
		// Step 1: Find all family member users
		console.log('🔍 Step 1: Scanning for family member users...');
		const familyMembersQuery = await firestore.collection('users')
			.where('userType', '==', 'family_member')
			.get();
		
		repairResults.familyMembersScanned = familyMembersQuery.docs.length;
		console.log(`📊 Found ${repairResults.familyMembersScanned} family member users`);
		
		// Step 2: Check each family member for missing patient links
		for (const familyMemberDoc of familyMembersQuery.docs) {
			const familyMemberData = familyMemberDoc.data();
			const familyMemberId = familyMemberDoc.id;
			
			console.log(`👤 Checking family member: ${familyMemberData.name} (${familyMemberData.email})`);
			
			// Check if patient links are missing
			const hasLinkedPatients = familyMemberData.linkedPatientIds && Array.isArray(familyMemberData.linkedPatientIds);
			const hasPrimaryPatient = !!familyMemberData.primaryPatientId;
			
			if (!hasLinkedPatients || !hasPrimaryPatient) {
				repairResults.familyMembersNeedingRepair++;
				console.log(`❌ Family member needs repair: missing patient links`);
				
				// Find patient relationships for this family member
				const familyAccessQuery = await firestore.collection('family_calendar_access')
					.where('familyMemberId', '==', familyMemberId)
					.where('status', '==', 'active')
					.get();
				
				if (familyAccessQuery.empty && familyMemberData.email) {
					// Try email fallback
					const emailFallbackQuery = await firestore.collection('family_calendar_access')
						.where('familyMemberEmail', '==', familyMemberData.email.toLowerCase())
						.where('status', '==', 'active')
						.get();
					
					// Also repair the familyMemberId while we're here
					for (const doc of emailFallbackQuery.docs) {
						const accessData = doc.data();
						if (!accessData.familyMemberId) {
							await doc.ref.update({
								familyMemberId: familyMemberId,
								updatedAt: admin.firestore.Timestamp.now(),
								repairedAt: admin.firestore.Timestamp.now(),
								repairReason: 'repair_endpoint_family_member_id'
							});
							console.log(`🔧 Also repaired missing familyMemberId in access record: ${doc.id}`);
						}
					}
					familyAccessQuery.docs.push(...emailFallbackQuery.docs);
				}
				
				if (familyAccessQuery.docs.length === 0) {
					console.log(`❌ No family access relationships found for: ${familyMemberData.email}`);
					repairResults.errors.push(`No relationships found for ${familyMemberData.email}`);
					continue;
				}
				
				// Extract patient IDs and repair user document
				const patientIds: string[] = [];
				
				for (const accessDoc of familyAccessQuery.docs) {
					const accessData = accessDoc.data();
					if (accessData.patientId && !patientIds.includes(accessData.patientId)) {
						patientIds.push(accessData.patientId);
					}
				}
				
				if (patientIds.length === 0) {
					console.log(`❌ No valid patient IDs found in relationships`);
					repairResults.errors.push(`No valid patient IDs for ${familyMemberData.email}`);
					continue;
				}
				
				console.log(`✅ Found ${patientIds.length} patient relationships:`, patientIds);
				
				// Update family member user document
				const familyMemberUpdates = {
					linkedPatientIds: patientIds,
					primaryPatientId: patientIds[0],
					updatedAt: admin.firestore.Timestamp.now(),
					repairedAt: admin.firestore.Timestamp.now(),
					repairReason: 'repair_endpoint_missing_patient_links'
				};
				
				await familyMemberDoc.ref.update(familyMemberUpdates);
				
				// Update patient user documents with reciprocal links
				for (const patientId of patientIds) {
					try {
						const patientRef = firestore.collection('users').doc(patientId);
						await patientRef.update({
							familyMemberIds: admin.firestore.FieldValue.arrayUnion(familyMemberId),
							updatedAt: admin.firestore.Timestamp.now(),
							repairedAt: admin.firestore.Timestamp.now(),
							repairReason: 'repair_endpoint_missing_family_member_links'
						});
						repairResults.patientsUpdated++;
					} catch (patientError: any) {
						console.error(`❌ Error updating patient ${patientId}:`, patientError);
						repairResults.errors.push(`Failed to update patient ${patientId}: ${patientError?.message || 'Unknown error'}`);
					}
				}
				
				repairResults.familyMembersRepaired++;
				console.log(`✅ Successfully repaired family member: ${familyMemberData.name}`);
			}
		}
		
		res.json({
			success: true,
			data: repairResults,
			message: `Repair completed. Fixed ${repairResults.familyMembersRepaired} family members.`
		});
		
	} catch (error) {
		console.error('Error in family member patient links repair:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

		// Health check endpoint for family access data consistency
		app.post('/family-access-health-check', authenticate, async (req, res) => {
			try {
				const userId = (req as any).user.uid;
				const userEmail = (req as any).user.email;
				
				console.log('🔍 Running family access health check for user:', userId);
				
				const issues = [];
				const repairs = [];
				
				// Check 1: User marked as family_member but no family access records
				const userDoc = await firestore.collection('users').doc(userId).get();
				const userData = userDoc.data();
				
				if (userData?.userType === 'family_member') {
					const familyAccessQuery = await firestore.collection('family_calendar_access')
						.where('familyMemberId', '==', userId)
						.where('status', '==', 'active')
						.get();
					
					if (familyAccessQuery.empty && userEmail) {
						// Check for records with matching email but missing familyMemberId
						const emailQuery = await firestore.collection('family_calendar_access')
							.where('familyMemberEmail', '==', userEmail.toLowerCase())
							.where('status', '==', 'active')
							.get();
						
						for (const doc of emailQuery.docs) {
							const data = doc.data();
							if (!data.familyMemberId) {
								issues.push({
									type: 'missing_family_member_id',
									documentId: doc.id,
									patientId: data.patientId,
									email: data.familyMemberEmail
								});
								
								// Auto-repair
								await doc.ref.update({
									familyMemberId: userId,
									updatedAt: admin.firestore.Timestamp.now(),
									healthCheckRepairAt: admin.firestore.Timestamp.now()
								});
								
								repairs.push({
									type: 'repaired_missing_family_member_id',
									documentId: doc.id
								});
							}
						}
					}
				}
				
				res.json({
					success: true,
					data: {
						issuesFound: issues.length,
						repairsPerformed: repairs.length,
						issues,
						repairs
					},
					message: `Health check completed. Found ${issues.length} issues, performed ${repairs.length} repairs.`
				});
				
			} catch (error) {
				console.error('Error in family access health check:', error);
				res.status(500).json({
					success: false,
					error: 'Internal server error'
				});
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

		console.log('🤝 === INVITATION ACCEPTANCE DEBUG START ===');
		console.log('🤝 Processing invitation acceptance:', { token, userId, timestamp: new Date().toISOString() });

		// Find invitation by token
		const invitationQuery = await firestore.collection('family_calendar_access')
			.where('invitationToken', '==', token)
			.where('status', '==', 'pending')
			.limit(1)
			.get();

		if (invitationQuery.empty) {
			console.log('❌ No pending invitation found for token:', token);
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
			familyMemberEmail: invitation.familyMemberEmail,
			familyMemberName: invitation.familyMemberName,
			status: invitation.status,
			invitedAt: invitation.invitedAt?.toDate()?.toISOString(),
			expiresAt: invitation.invitationExpiresAt?.toDate()?.toISOString()
		});

		// Check if invitation has expired
		if (invitation.invitationExpiresAt && new Date() > invitation.invitationExpiresAt.toDate()) {
			console.log('❌ Invitation has expired:', invitation.invitationExpiresAt.toDate());
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

		// Get current user data before transaction
		console.log('👤 Getting current user data before transaction...');
		const preTransactionUserDoc = await firestore.collection('users').doc(userId).get();
		const preTransactionUserData = preTransactionUserDoc.data();
		
		console.log('👤 Pre-transaction user data:', {
			exists: preTransactionUserDoc.exists,
			userType: preTransactionUserData?.userType,
			email: preTransactionUserData?.email,
			name: preTransactionUserData?.name,
			hasLinkedPatients: !!(preTransactionUserData?.linkedPatientIds),
			hasPrimaryPatient: !!(preTransactionUserData?.primaryPatientId),
			currentLinkedPatients: preTransactionUserData?.linkedPatientIds || [],
			currentPrimaryPatient: preTransactionUserData?.primaryPatientId || 'none',
			familyMemberIds: preTransactionUserData?.familyMemberIds || []
		});

		// Use transaction to ensure atomicity and prevent race conditions
		console.log('🔄 Starting Firestore transaction...');
		const result = await firestore.runTransaction(async (transaction) => {
			console.log('🔄 Inside transaction - re-checking invitation status...');
			
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

			console.log('🔄 Transaction checks passed, proceeding with user updates...');

			// 🔥 UPDATE USER TYPE: Tag user as family member when accepting invitation
			console.log('👤 Step 1: Updating user type to family_member for caretaker:', userId);
			const userRef = firestore.collection('users').doc(userId);
			const userDoc = await transaction.get(userRef);
			
			console.log('👤 User document in transaction:', {
				exists: userDoc.exists,
				data: userDoc.exists ? userDoc.data() : null
			});
			
			if (userDoc.exists) {
				// Update existing user's type if they're currently a patient (default)
				const userData = userDoc.data();
				console.log('👤 Current user data in transaction:', {
					userType: userData?.userType,
					email: userData?.email,
					name: userData?.name,
					linkedPatientIds: userData?.linkedPatientIds,
					primaryPatientId: userData?.primaryPatientId
				});
				
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

			// 🔗 Write reciprocal links between family member and patient user documents
			console.log('👤 Step 2: Creating reciprocal links between family member and patient...');
			const patientUserRef = firestore.collection('users').doc(invitation.patientId);
			
			// 🔧 FIX: Get fresh user document reference to avoid stale data issues
			const freshUserDoc = await transaction.get(userRef);
			const currentUserData = freshUserDoc.data();
			
			console.log('👤 Fresh user data for reciprocal linking:', {
				exists: freshUserDoc.exists,
				userType: currentUserData?.userType,
				hasLinkedPatients: !!(currentUserData?.linkedPatientIds),
				hasPrimaryPatient: !!(currentUserData?.primaryPatientId),
				currentLinkedPatients: currentUserData?.linkedPatientIds || [],
				currentPrimaryPatient: currentUserData?.primaryPatientId || 'none',
				email: currentUserData?.email,
				name: currentUserData?.name
			});
			
			const familyMemberLinkUpdates: any = {
				linkedPatientIds: admin.firestore.FieldValue.arrayUnion(invitation.patientId),
				updatedAt: admin.firestore.Timestamp.now(),
				lastInvitationAcceptedAt: admin.firestore.Timestamp.now(),
				lastInvitationAcceptedFrom: invitation.patientId
			};

			// 🔧 CRITICAL FIX: Always set primaryPatientId for family members
			// This is the key issue - we need to ensure primaryPatientId is ALWAYS set
			console.log('🎯 CRITICAL: Setting primaryPatientId...');
			if (!currentUserData?.primaryPatientId) {
				familyMemberLinkUpdates.primaryPatientId = invitation.patientId;
				console.log('🎯 Setting NEW primaryPatientId to:', invitation.patientId);
			} else {
				console.log('ℹ️ primaryPatientId already exists:', currentUserData.primaryPatientId);
				// For debugging: let's also update it to ensure it's correct
				familyMemberLinkUpdates.primaryPatientId = invitation.patientId;
				console.log('🎯 OVERRIDING primaryPatientId to:', invitation.patientId);
			}

			// 🔧 FIX: Use update instead of set for existing documents to avoid merge conflicts
			try {
				console.log('👤 Step 3: Applying family member updates...');
				console.log('👤 Updates to apply:', familyMemberLinkUpdates);
				
				if (freshUserDoc.exists) {
					console.log('📝 Updating existing family member user document...');
					transaction.update(userRef, familyMemberLinkUpdates);
				} else {
					console.log('📝 Creating new family member user document...');
					transaction.set(userRef, {
						id: userId,
						email: invitation.familyMemberEmail,
						name: invitation.familyMemberName || 'Family Member',
						userType: 'family_member',
						...familyMemberLinkUpdates,
						createdAt: admin.firestore.Timestamp.now()
					});
				}
				
				// Update patient user document with reciprocal link
				console.log('👤 Step 4: Updating patient user document with family member link...');
				const patientUpdates = {
					familyMemberIds: admin.firestore.FieldValue.arrayUnion(userId),
					updatedAt: admin.firestore.Timestamp.now(),
					lastFamilyMemberAdded: userId,
					lastFamilyMemberAddedAt: admin.firestore.Timestamp.now()
				};
				
				console.log('👤 Patient updates to apply:', patientUpdates);
				transaction.update(patientUserRef, patientUpdates);
				
				console.log('✅ Reciprocal links created successfully:', {
					familyMemberId: userId,
					patientId: invitation.patientId,
					primaryPatientIdSet: familyMemberLinkUpdates.primaryPatientId
				});
				
			} catch (linkingError: any) {
				console.error('❌ Reciprocal linking failed:', linkingError);
				console.error('❌ Linking error details:', {
					message: linkingError?.message,
					code: linkingError?.code,
					stack: linkingError?.stack
				});
				throw new Error(`Failed to create user relationships: ${linkingError?.message || 'Unknown linking error'}`);
			}

			// Update invitation with family member ID and activate
			console.log('👤 Step 5: Updating invitation status to active...');
			const invitationUpdates = {
				familyMemberId: userId,
				status: 'active',
				acceptedAt: admin.firestore.Timestamp.now(),
				updatedAt: admin.firestore.Timestamp.now(),
				invitationToken: admin.firestore.FieldValue.delete(),
				invitationExpiresAt: admin.firestore.FieldValue.delete()
			};
			
			console.log('👤 Invitation updates to apply:', invitationUpdates);
			transaction.update(invitationDoc.ref, invitationUpdates);

			console.log('✅ Transaction completed successfully');
			return {
				id: invitationDoc.id,
				status: 'active',
				familyMemberId: userId,
				patientId: invitation.patientId,
				primaryPatientIdSet: familyMemberLinkUpdates.primaryPatientId
			};
		});

		console.log('✅ Invitation accepted successfully:', result);

		// Post-transaction verification
		console.log('🔍 Post-transaction verification...');
		const postTransactionUserDoc = await firestore.collection('users').doc(userId).get();
		const postTransactionUserData = postTransactionUserDoc.data();
		
		console.log('👤 Post-transaction user data:', {
			exists: postTransactionUserDoc.exists,
			userType: postTransactionUserData?.userType,
			hasLinkedPatients: !!(postTransactionUserData?.linkedPatientIds),
			hasPrimaryPatient: !!(postTransactionUserData?.primaryPatientId),
			linkedPatientIds: postTransactionUserData?.linkedPatientIds || [],
			primaryPatientId: postTransactionUserData?.primaryPatientId || 'MISSING!',
			familyMemberIds: postTransactionUserData?.familyMemberIds || [],
			lastInvitationAcceptedAt: postTransactionUserData?.lastInvitationAcceptedAt?.toDate()?.toISOString(),
			lastInvitationAcceptedFrom: postTransactionUserData?.lastInvitationAcceptedFrom
		});

		// 🔧 CRITICAL REPAIR: If primaryPatientId is missing, fix it immediately
		if (!postTransactionUserData?.primaryPatientId) {
			console.error('🚨 CRITICAL ERROR: primaryPatientId is still missing after transaction!');
			console.log('🔧 Attempting immediate repair...');
			
			try {
				const repairUpdates = {
					primaryPatientId: invitation.patientId,
					linkedPatientIds: admin.firestore.FieldValue.arrayUnion(invitation.patientId),
					userType: 'family_member',
					updatedAt: admin.firestore.Timestamp.now(),
					repairedAt: admin.firestore.Timestamp.now(),
					repairReason: 'post_transaction_primary_patient_id_missing'
				};
				
				console.log('🔧 Applying repair updates:', repairUpdates);
				await firestore.collection('users').doc(userId).update(repairUpdates);
				
				// Verify repair
				const repairedUserDoc = await firestore.collection('users').doc(userId).get();
				const repairedUserData = repairedUserDoc.data();
				
				console.log('✅ REPAIR SUCCESSFUL: primaryPatientId now set to:', repairedUserData?.primaryPatientId);
				
				// Update result to reflect repair
				(result as any).primaryPatientIdSet = repairedUserData?.primaryPatientId;
				(result as any).wasRepaired = true;
				
			} catch (repairError: any) {
				console.error('❌ REPAIR FAILED:', repairError);
				(result as any).repairError = repairError?.message || 'Unknown repair error';
			}
		} else {
			console.log('✅ SUCCESS: primaryPatientId is properly set to:', postTransactionUserData.primaryPatientId);
		}

		// Also verify the family_calendar_access record was updated correctly
		console.log('🔍 Verifying family_calendar_access record...');
		const verifyAccessDoc = await firestore.collection('family_calendar_access').doc(invitationDoc.id).get();
		const verifyAccessData = verifyAccessDoc.data();
		
		console.log('📋 Family access record verification:', {
			exists: verifyAccessDoc.exists,
			status: verifyAccessData?.status,
			familyMemberId: verifyAccessData?.familyMemberId,
			hasInvitationToken: !!verifyAccessData?.invitationToken,
			acceptedAt: verifyAccessData?.acceptedAt?.toDate()?.toISOString()
		});

		console.log('🤝 === INVITATION ACCEPTANCE DEBUG END ===');

		// Get final user data for response
		const finalUserDoc = await firestore.collection('users').doc(userId).get();
		const finalUserData = finalUserDoc.data();

		res.json({
			success: true,
			message: 'Invitation accepted successfully',
			data: result,
			debug: {
				primaryPatientIdSet: finalUserData?.primaryPatientId,
				userType: finalUserData?.userType,
				linkedPatients: finalUserData?.linkedPatientIds?.length || 0,
				wasRepaired: (result as any).wasRepaired || false,
				accessRecordStatus: verifyAccessData?.status,
				repairError: (result as any).repairError
			}
		});
	} catch (error: any) {
		console.error('❌ Error accepting invitation:', error);
		console.error('❌ Error stack:', error?.stack);
		
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
			error: 'Internal server error',
			details: error?.message
		});
	}
});

// ===== DRUG SEARCH ROUTES =====

// Search for drugs by name using OpenFDA API with RxNorm fallback
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
		const cleanQuery = query.trim().toLowerCase();

		console.log('🔍 Searching OpenFDA for:', cleanQuery);

		let allResults: any[] = [];

		// Strategy 1: OpenFDA Brand Name Search (Primary - works great for partial search)
		try {
			const fdaBrandUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(cleanQuery)}*&limit=${Math.min(searchLimit, 20)}`;
			console.log('🔍 Trying OpenFDA brand search:', fdaBrandUrl);
			const fdaBrandResponse = await fetch(fdaBrandUrl);
			
			if (fdaBrandResponse.ok) {
				const fdaBrandData: any = await fdaBrandResponse.json();
				if (fdaBrandData?.results) {
					for (const result of fdaBrandData.results) {
						const brandNames = result.openfda?.brand_name || [];
						const genericNames = result.openfda?.generic_name || [];
						const rxcuis = result.openfda?.rxcui || [];
						const dosageForms = result.openfda?.dosage_form || [];
						const routes = result.openfda?.route || [];
						const strengths = result.openfda?.substance_name || [];
						
						// Extract dosage instructions and indications
						const dosageInstructions = result.dosage_and_administration?.[0] || '';
						const indications = result.indications_and_usage?.[0] || '';
						
						// Add brand names with enhanced data
						brandNames.forEach((name: string, index: number) => {
							allResults.push({
								rxcui: rxcuis[index] || `fda_brand_${Date.now()}_${index}`,
								name: name,
								synonym: genericNames[0] || name,
								tty: 'SBD', // Semantic Branded Drug
								language: 'ENG',
								source: 'FDA_Brand',
								dosageForm: dosageForms[0] || 'Unknown',
								route: routes[0] || 'Unknown',
								strength: strengths[0] || name,
								dosageInstructions: dosageInstructions,
								indications: indications
							});
						});
						
						// Add generic names if different
						genericNames.forEach((name: string, index: number) => {
							if (!brandNames.includes(name)) {
								allResults.push({
									rxcui: rxcuis[index] || `fda_generic_${Date.now()}_${index}`,
									name: name,
									synonym: brandNames[0] || name,
									tty: 'SCD', // Semantic Clinical Drug
									language: 'ENG',
									source: 'FDA_Generic',
									dosageForm: dosageForms[0] || 'Unknown',
									route: routes[0] || 'Unknown',
									strength: strengths[0] || name,
									dosageInstructions: dosageInstructions,
									indications: indications
								});
							}
						});
					}
				}
			}
		} catch (error) {
			console.warn('OpenFDA brand search failed:', error);
		}

		// Strategy 2: OpenFDA Generic Name Search
		if (allResults.length < 10) {
			try {
				const fdaGenericUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(cleanQuery)}*&limit=${Math.min(searchLimit, 20)}`;
				console.log('🔍 Trying OpenFDA generic search:', fdaGenericUrl);
				const fdaGenericResponse = await fetch(fdaGenericUrl);
				
				if (fdaGenericResponse.ok) {
					const fdaGenericData: any = await fdaGenericResponse.json();
					if (fdaGenericData?.results) {
						for (const result of fdaGenericData.results) {
							const genericNames = result.openfda?.generic_name || [];
							const brandNames = result.openfda?.brand_name || [];
							const rxcuis = result.openfda?.rxcui || [];
							const dosageForms = result.openfda?.dosage_form || [];
							const routes = result.openfda?.route || [];
							const strengths = result.openfda?.substance_name || [];
							
							// Extract dosage instructions and indications
							const dosageInstructions = result.dosage_and_administration?.[0] || '';
							const indications = result.indications_and_usage?.[0] || '';
							
							genericNames.forEach((name: string, index: number) => {
								// Avoid duplicates
								if (!allResults.some(r => r.name.toLowerCase() === name.toLowerCase())) {
									allResults.push({
										rxcui: rxcuis[index] || `fda_generic2_${Date.now()}_${index}`,
										name: name,
										synonym: brandNames[0] || name,
										tty: 'SCD',
										language: 'ENG',
										source: 'FDA_Generic',
										dosageForm: dosageForms[0] || 'Unknown',
										route: routes[0] || 'Unknown',
										strength: strengths[0] || name,
										dosageInstructions: dosageInstructions,
										indications: indications
									});
								}
							});
						}
					}
				}
			} catch (error) {
				console.warn('OpenFDA generic search failed:', error);
			}
		}

		// Strategy 3: OpenFDA Substance Name Search (for comprehensive coverage)
		if (allResults.length < 5) {
			try {
				console.log('🔍 Trying OpenFDA substance search');
				const fdaSubstanceUrl = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:${encodeURIComponent(cleanQuery)}*&limit=${Math.min(searchLimit, 15)}`;
				const fdaSubstanceResponse = await fetch(fdaSubstanceUrl);
				
				if (fdaSubstanceResponse.ok) {
					const fdaSubstanceData: any = await fdaSubstanceResponse.json();
					if (fdaSubstanceData?.results) {
						for (const result of fdaSubstanceData.results) {
							const substanceNames = result.openfda?.substance_name || [];
							const brandNames = result.openfda?.brand_name || [];
							const genericNames = result.openfda?.generic_name || [];
							const dosageForms = result.openfda?.dosage_form || [];
							const routes = result.openfda?.route || [];
							
							// Extract dosage instructions and indications
							const dosageInstructions = result.dosage_and_administration?.[0] || '';
							const indications = result.indications_and_usage?.[0] || '';
							
							// Add substance-based results
							substanceNames.forEach((substance: string, index: number) => {
								if (!allResults.some(r => r.name.toLowerCase() === substance.toLowerCase())) {
									allResults.push({
										rxcui: `fda_substance_${Date.now()}_${index}`,
										name: substance,
										synonym: genericNames[0] || brandNames[0] || substance,
										tty: 'IN', // Ingredient
										language: 'ENG',
										source: 'FDA_Substance',
										dosageForm: dosageForms[0] || 'Unknown',
										route: routes[0] || 'Unknown',
										strength: substance,
										dosageInstructions: dosageInstructions,
										indications: indications
									});
								}
							});
						}
					}
				}
			} catch (error) {
				console.warn('OpenFDA substance search failed:', error);
			}
		}

		// Add standard dosing recommendations for common medications
		const standardDosing: Record<string, any> = {
			'metformin': {
				commonDoses: ['500mg', '850mg', '1000mg'],
				standardInstructions: [
					'500mg twice daily with meals',
					'850mg once daily with dinner',
					'1000mg twice daily with meals'
				],
				maxDailyDose: '2550mg',
				commonForm: 'tablet',
				route: 'oral'
			},
			'ibuprofen': {
				commonDoses: ['200mg', '400mg', '600mg', '800mg'],
				standardInstructions: [
					'200mg every 4-6 hours as needed',
					'400mg every 6-8 hours as needed',
					'600mg every 6-8 hours as needed',
					'800mg every 8 hours as needed'
				],
				maxDailyDose: '3200mg',
				commonForm: 'tablet',
				route: 'oral'
			},
			'acetaminophen': {
				commonDoses: ['325mg', '500mg', '650mg'],
				standardInstructions: [
					'325mg every 4-6 hours as needed',
					'500mg every 6 hours as needed',
					'650mg every 6 hours as needed'
				],
				maxDailyDose: '3000mg',
				commonForm: 'tablet',
				route: 'oral'
			},
			'aspirin': {
				commonDoses: ['81mg', '325mg', '500mg'],
				standardInstructions: [
					'81mg once daily (low dose)',
					'325mg every 4 hours as needed',
					'500mg every 4 hours as needed'
				],
				maxDailyDose: '4000mg',
				commonForm: 'tablet',
				route: 'oral'
			},
			'lisinopril': {
				commonDoses: ['2.5mg', '5mg', '10mg', '20mg', '40mg'],
				standardInstructions: [
					'2.5mg once daily',
					'5mg once daily',
					'10mg once daily',
					'20mg once daily',
					'40mg once daily'
				],
				maxDailyDose: '40mg',
				commonForm: 'tablet',
				route: 'oral'
			},
			'atorvastatin': {
				commonDoses: ['10mg', '20mg', '40mg', '80mg'],
				standardInstructions: [
					'10mg once daily in the evening',
					'20mg once daily in the evening',
					'40mg once daily in the evening',
					'80mg once daily in the evening'
				],
				maxDailyDose: '80mg',
				commonForm: 'tablet',
				route: 'oral'
			}
		};

		// Remove duplicates and format results with enhanced dosage data
		const seenNames = new Set();
		const drugConcepts: any[] = [];

		for (const concept of allResults) {
			const normalizedName = concept.name.toLowerCase().trim();
			if (!seenNames.has(normalizedName) && drugConcepts.length < searchLimit) {
				seenNames.add(normalizedName);
				
				// Extract dosage from name if available
				const dosageMatch = concept.name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
				const extractedDosage = dosageMatch ? `${dosageMatch[1]} ${dosageMatch[2].toLowerCase()}` : '';
				
				// Find standard dosing for this medication
				const genericName = (concept.synonym || concept.name).toLowerCase();
				let standardDosingInfo = null;
				
				// Check if this medication has standard dosing recommendations
				for (const [medName, dosing] of Object.entries(standardDosing)) {
					if (genericName.includes(medName) || concept.name.toLowerCase().includes(medName)) {
						standardDosingInfo = dosing;
						break;
					}
				}
				
				drugConcepts.push({
					rxcui: concept.rxcui,
					name: concept.name,
					synonym: concept.synonym || concept.name,
					tty: concept.tty,
					language: concept.language || 'ENG',
					source: concept.source || 'Unknown',
					// Enhanced dosage information
					dosageForm: concept.dosageForm || 'Unknown',
					route: concept.route || 'Unknown',
					strength: concept.strength || concept.name,
					extractedDosage: extractedDosage,
					dosageInstructions: concept.dosageInstructions || '',
					indications: concept.indications || '',
					// Standard dosing recommendations
					standardDosing: standardDosingInfo
				});
			}
		}

		// Sort results: prioritize relevance and common drug types
		drugConcepts.sort((a, b) => {
			// Primary sort: prefer names that start with the query
			const aStartsWithQuery = a.name.toLowerCase().startsWith(cleanQuery);
			const bStartsWithQuery = b.name.toLowerCase().startsWith(cleanQuery);
			
			if (aStartsWithQuery && !bStartsWithQuery) return -1;
			if (!aStartsWithQuery && bStartsWithQuery) return 1;
			
			// Secondary sort: prioritize FDA results over RxNorm
			const aIsFDA = a.source?.startsWith('FDA');
			const bIsFDA = b.source?.startsWith('FDA');
			
			if (aIsFDA && !bIsFDA) return -1;
			if (!aIsFDA && bIsFDA) return 1;
			
			// Tertiary sort: prioritize common drug types
			const priorityOrder = ['SCD', 'SBD', 'IN', 'PIN', 'MIN', 'GPCK', 'BPCK'];
			const aPriority = priorityOrder.indexOf(a.tty) !== -1 ? priorityOrder.indexOf(a.tty) : 999;
			const bPriority = priorityOrder.indexOf(b.tty) !== -1 ? priorityOrder.indexOf(b.tty) : 999;
			
			if (aPriority !== bPriority) {
				return aPriority - bPriority;
			}
			
			// Final sort by name length (shorter names first)
			return a.name.length - b.name.length;
		});

		console.log(`✅ Found ${drugConcepts.length} drug results for query: ${query} (OpenFDA + RxNorm)`);

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
// Get detailed medication information with dosing recommendations
app.get('/drugs/:rxcui/dosing', authenticate, async (req, res) => {
	try {
		const { rxcui } = req.params;

		if (!rxcui) {
			return res.status(400).json({
				success: false,
				error: 'RXCUI parameter is required'
			});
		}

		console.log('🔍 Getting detailed dosing info for RXCUI:', rxcui);

		// Get basic drug properties from RxNorm
		const propertiesUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
		const propertiesResponse = await fetch(propertiesUrl);
		
		let drugInfo: any = {};
		
		if (propertiesResponse.ok) {
			const propertiesData: any = await propertiesResponse.json();
			if (propertiesData?.properties) {
				drugInfo = propertiesData.properties;
			}
		}

		// Try to get additional info from OpenFDA if we have a drug name
		let fdaInfo: any = {};
		if (drugInfo.name) {
			try {
				const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drugInfo.name)}"&limit=1`;
				const fdaResponse = await fetch(fdaUrl);
				
				if (fdaResponse.ok) {
					const fdaData: any = await fdaResponse.json();
					if (fdaData?.results?.[0]) {
						const result = fdaData.results[0];
						fdaInfo = {
							dosageForm: result.openfda?.dosage_form?.[0] || 'Unknown',
							route: result.openfda?.route?.[0] || 'Unknown',
							dosageInstructions: result.dosage_and_administration?.[0] || '',
							indications: result.indications_and_usage?.[0] || '',
							brandNames: result.openfda?.brand_name || [],
							genericNames: result.openfda?.generic_name || []
						};
					}
				}
			} catch (error) {
				console.warn('Failed to get FDA info:', error);
			}
		}

		// Standard dosing recommendations
		const standardDosing: Record<string, any> = {
			'metformin': {
				commonDoses: ['500mg', '850mg', '1000mg'],
				standardInstructions: [
					'500mg twice daily with meals',
					'850mg once daily with dinner',
					'1000mg twice daily with meals'
				],
				maxDailyDose: '2550mg',
				commonForm: 'tablet',
				route: 'oral',
				timing: ['with meals'],
				frequency: ['once daily', 'twice daily'],
				notes: 'Take with food to reduce stomach upset'
			},
			'ibuprofen': {
				commonDoses: ['200mg', '400mg', '600mg', '800mg'],
				standardInstructions: [
					'200mg every 4-6 hours as needed',
					'400mg every 6-8 hours as needed',
					'600mg every 6-8 hours as needed',
					'800mg every 8 hours as needed'
				],
				maxDailyDose: '3200mg',
				commonForm: 'tablet',
				route: 'oral',
				timing: ['with food'],
				frequency: ['as needed', 'every 4-6 hours', 'every 6-8 hours'],
				notes: 'Take with food to reduce stomach irritation'
			},
			'acetaminophen': {
				commonDoses: ['325mg', '500mg', '650mg'],
				standardInstructions: [
					'325mg every 4-6 hours as needed',
					'500mg every 6 hours as needed',
					'650mg every 6 hours as needed'
				],
				maxDailyDose: '3000mg',
				commonForm: 'tablet',
				route: 'oral',
				timing: ['any time'],
				frequency: ['as needed', 'every 4-6 hours'],
				notes: 'Do not exceed maximum daily dose'
			},
			'aspirin': {
				commonDoses: ['81mg', '325mg', '500mg'],
				standardInstructions: [
					'81mg once daily (low dose)',
					'325mg every 4 hours as needed',
					'500mg every 4 hours as needed'
				],
				maxDailyDose: '4000mg',
				commonForm: 'tablet',
				route: 'oral',
				timing: ['with food'],
				frequency: ['once daily', 'every 4 hours'],
				notes: 'Take with food to reduce stomach irritation'
			},
			'lisinopril': {
				commonDoses: ['2.5mg', '5mg', '10mg', '20mg', '40mg'],
				standardInstructions: [
					'2.5mg once daily',
					'5mg once daily',
					'10mg once daily',
					'20mg once daily',
					'40mg once daily'
				],
				maxDailyDose: '40mg',
				commonForm: 'tablet',
				route: 'oral',
				timing: ['same time each day'],
				frequency: ['once daily'],
				notes: 'Take at the same time each day'
			},
			'atorvastatin': {
				commonDoses: ['10mg', '20mg', '40mg', '80mg'],
				standardInstructions: [
					'10mg once daily in the evening',
					'20mg once daily in the evening',
					'40mg once daily in the evening',
					'80mg once daily in the evening'
				],
				maxDailyDose: '80mg',
				commonForm: 'tablet',
				route: 'oral',
				timing: ['evening'],
				frequency: ['once daily'],
				notes: 'Take in the evening for best effectiveness'
			}
		};

		// Find standard dosing for this medication
		const genericName = (drugInfo.synonym || drugInfo.name || '').toLowerCase();
		let standardDosingInfo = null;
		
		for (const [medName, dosing] of Object.entries(standardDosing)) {
			if (genericName.includes(medName)) {
				standardDosingInfo = dosing;
				break;
			}
		}

		// Combine all information
		const detailedDrugInfo = {
			rxcui: drugInfo.rxcui || rxcui,
			name: drugInfo.name || 'Unknown',
			synonym: drugInfo.synonym || drugInfo.name,
			tty: drugInfo.tty || 'Unknown',
			language: drugInfo.language || 'ENG',
			// FDA information
			dosageForm: fdaInfo.dosageForm || 'Unknown',
			route: fdaInfo.route || 'Unknown',
			dosageInstructions: fdaInfo.dosageInstructions || '',
			indications: fdaInfo.indications || '',
			brandNames: fdaInfo.brandNames || [],
			genericNames: fdaInfo.genericNames || [],
			// Standard dosing recommendations
			standardDosing: standardDosingInfo
		};

		res.json({
			success: true,
			data: detailedDrugInfo
		});
	} catch (error) {
		console.error('Error getting detailed drug dosing info:', error);
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


// ===== MEDICATION CALENDAR ROUTES =====

// Get medication calendar events (supports family member access via patientId parameter)
app.get('/medication-calendar/events', authenticate, async (req, res) => {
	try {
		const currentUserId = (req as any).user.uid;
		const { patientId, startDate, endDate, medicationId, status } = req.query;
		
		// Determine which patient's events to fetch
		const targetPatientId = patientId as string || currentUserId;
		
		console.log('📅 Getting medication calendar events for patient:', targetPatientId, 'requested by:', currentUserId);
		console.log('📅 Query params:', { startDate, endDate, medicationId, status });
		
		// Check if user has access to this patient's medication events
		if (targetPatientId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', targetPatientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			console.log('✅ Family access verified for medication calendar events');
		}
		
		// Build query for medication calendar events
		let query = firestore.collection('medication_calendar_events')
			.where('patientId', '==', targetPatientId);
		
		// Add filters if provided - handle potential query limitations
		try {
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
			
			console.log('✅ Found', events.length, 'medication calendar events');
			
			res.json({
				success: true,
				data: events,
				message: 'Medication calendar events retrieved successfully'
			});
		} catch (queryError) {
			console.error('❌ Query error for medication calendar events:', queryError);
			// Return empty array instead of error to prevent frontend crashes
			res.json({
				success: true,
				data: [],
				message: 'No medication calendar events found'
			});
		}
	} catch (error) {
		console.error('❌ Error getting medication calendar events:', error);
		console.error('❌ Calendar events error details:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : 'No stack',
			userId: (req as any)?.user?.uid || 'Unknown',
			patientId: req.query?.patientId || 'None',
			queryParams: req.query,
			requestPath: req.path,
			timestamp: new Date().toISOString()
		});
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error',
			errorCode: 'GET_CALENDAR_EVENTS_FAILED',
			timestamp: new Date().toISOString()
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

// Mark medication as taken with enhanced error logging
app.post('/medication-calendar/events/:eventId/taken', authenticate, async (req, res) => {
	try {
		console.log('🚀 === MARK MEDICATION AS TAKEN - START ===');
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		const { takenAt, notes } = req.body;
		
		console.log('💊 Marking medication as taken:', {
			eventId,
			userId,
			takenAt,
			notes,
			requestPath: req.path,
			requestMethod: req.method,
			userAgent: req.headers['user-agent'],
			timestamp: new Date().toISOString()
		});
		console.log('💊 Request body type check:', {
			takenAtType: typeof takenAt,
			notesType: typeof notes,
			bodyKeys: Object.keys(req.body),
			rawBody: req.body
		});
		console.log('💊 Step 1: Initial validation - PASSED');
		
		// Validate eventId
		if (!eventId || typeof eventId !== 'string') {
			console.log('❌ Step 2: Invalid eventId:', eventId);
			return res.status(400).json({
				success: false,
				error: 'Invalid event ID'
			});
		}
		console.log('💊 Step 2: EventId validation - PASSED');
		
		// Get the event document with better error handling
		console.log('💊 Step 3: Attempting to fetch event from Firestore...');
		let eventDoc;
		try {
			eventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();
			console.log('💊 Step 3: Firestore fetch - SUCCESS');
		} catch (firestoreError) {
			console.error('❌ Step 3: Firestore error getting event:', firestoreError);
			console.error('❌ Step 3: Error details:', {
				message: firestoreError instanceof Error ? firestoreError.message : 'Unknown error',
				code: (firestoreError as any)?.code || 'Unknown code',
				stack: firestoreError instanceof Error ? firestoreError.stack : 'No stack'
			});
			return res.status(500).json({
				success: false,
				error: 'Database error retrieving event',
				details: firestoreError instanceof Error ? firestoreError.message : 'Unknown error'
			});
		}
		
		if (!eventDoc.exists) {
			console.log('❌ Step 4: Medication event not found:', eventId);
			return res.status(404).json({
				success: false,
				error: 'Medication event not found'
			});
		}
		console.log('💊 Step 4: Event exists - PASSED');
		
		const eventData = eventDoc.data();
		if (!eventData) {
			console.log('❌ Step 5: Event data is null:', eventId);
			return res.status(404).json({
				success: false,
				error: 'Event data not found'
			});
		}
		console.log('💊 Step 5: Event data retrieved - PASSED');
		
		console.log('📋 Current event data:', {
			id: eventId,
			patientId: eventData.patientId,
			status: eventData.status,
			medicationName: eventData.medicationName
		});
		
		// Check if user has access to this event
		if (eventData.patientId !== userId) {
			console.log('🔍 Checking family access for user:', userId, 'to patient:', eventData.patientId);
			
			try {
				// Check family access
				const familyAccess = await firestore.collection('family_calendar_access')
					.where('familyMemberId', '==', userId)
					.where('patientId', '==', eventData.patientId)
					.where('status', '==', 'active')
					.get();
				
				if (familyAccess.empty) {
					console.log('❌ Access denied for user:', userId, 'to event:', eventId);
					return res.status(403).json({
						success: false,
						error: 'Access denied'
					});
				}
				
				console.log('✅ Family access verified for user:', userId);
			} catch (accessError) {
				console.error('❌ Error checking family access:', accessError);
				return res.status(500).json({
					success: false,
					error: 'Error verifying access permissions'
				});
			}
		}
		
		// Prepare update data with better error handling
		const updateData: any = {
			status: 'taken',
			takenBy: userId,
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		console.log('💊 Initial update data:', updateData);
		
		// Handle takenAt timestamp safely with better validation
		try {
			let takenDateTime: Date;
			
			if (takenAt) {
				if (typeof takenAt === 'string') {
					// Try to parse the string as a date
					takenDateTime = new Date(takenAt);
					if (isNaN(takenDateTime.getTime())) {
						console.warn('⚠️ Invalid takenAt date string, using current time:', takenAt);
						takenDateTime = new Date();
					}
				} else if (takenAt instanceof Date) {
					takenDateTime = takenAt;
				} else {
					console.warn('⚠️ Invalid takenAt type, using current time:', typeof takenAt);
					takenDateTime = new Date();
				}
			} else {
				takenDateTime = new Date();
			}
			
			updateData.actualTakenDateTime = admin.firestore.Timestamp.fromDate(takenDateTime);
			console.log('📅 Set actualTakenDateTime to:', takenDateTime.toISOString());
		} catch (dateError) {
			console.error('❌ Error processing takenAt date:', dateError);
			updateData.actualTakenDateTime = admin.firestore.Timestamp.now();
		}
		
		// Add notes if provided and valid - ONLY add if not undefined
		if (notes && typeof notes === 'string' && notes.trim().length > 0) {
			updateData.notes = notes.trim();
		}
		// Do not add notes field at all if it's undefined, null, or empty
		
		// Calculate if taken on time and record lateness as metadata
		updateData.isOnTime = true; // Default to true
		
		try {
			if (eventData.scheduledDateTime && updateData.actualTakenDateTime) {
				const scheduledTime = eventData.scheduledDateTime.toDate();
				const takenTime = updateData.actualTakenDateTime.toDate();
				const timeDiffMinutes = Math.abs((takenTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
				updateData.isOnTime = timeDiffMinutes <= 30;
				// Always keep status as 'taken' for UI logic; record lateness separately
				updateData.status = 'taken';
				if (timeDiffMinutes > 0) {
					updateData.minutesLate = Math.round(timeDiffMinutes);
					updateData.wasLate = timeDiffMinutes > 240; // extremely late flag
				}
				
				console.log('⏰ Time calculation:', {
					scheduledTime: scheduledTime.toISOString(),
					takenTime: takenTime.toISOString(),
					timeDiffMinutes,
					isOnTime: updateData.isOnTime,
					status: updateData.status
				});
			}
		} catch (timeError) {
			console.error('❌ Error calculating timing:', timeError);
			// Don't fail the request, just log the error
		}
		
		console.log('📝 Final update data for event:', {
			...updateData,
			actualTakenDateTime: updateData.actualTakenDateTime?.toDate()?.toISOString()
		});
		
		// Validate update data before sending to Firestore
		const cleanUpdateData: any = {};
		Object.keys(updateData).forEach(key => {
			const value = updateData[key];
			if (value !== undefined && value !== null) {
				cleanUpdateData[key] = value;
			}
		});
		
		console.log('📝 Cleaned update data for Firestore:', cleanUpdateData);
		
		// Update the event document with better error handling
		console.log('💊 Step 6: Attempting Firestore update...');
		try {
			await eventDoc.ref.update(cleanUpdateData);
			console.log('✅ Step 6: Event updated successfully');
		} catch (updateError) {
			console.error('❌ Step 6: Error updating event document:', updateError);
			console.error('❌ Step 6: Update data that caused error:', cleanUpdateData);
			console.error('❌ Step 6: Error details:', {
				message: updateError instanceof Error ? updateError.message : 'Unknown error',
				code: (updateError as any)?.code || 'Unknown code',
				stack: updateError instanceof Error ? updateError.stack : 'No stack'
			});
			return res.status(500).json({
				success: false,
				error: 'Failed to update medication event',
				details: updateError instanceof Error ? updateError.message : 'Unknown update error'
			});
		}
		
		// Get updated event with error handling
		let updatedDoc;
		let updatedData;
		try {
			updatedDoc = await eventDoc.ref.get();
			updatedData = updatedDoc.data();
		} catch (fetchError) {
			console.error('❌ Error fetching updated event:', fetchError);
			// Still return success since the update worked
			return res.json({
				success: true,
				data: {
					id: eventId,
					status: cleanUpdateData.status,
					takenBy: cleanUpdateData.takenBy,
					actualTakenDateTime: cleanUpdateData.actualTakenDateTime?.toDate(),
					updatedAt: cleanUpdateData.updatedAt?.toDate()
				},
				message: 'Medication marked as taken successfully'
			});
		}
		
		console.log('✅ Medication marked as taken successfully:', eventId);
		
		// Return the response with safe data conversion
		const responseData: any = {
			id: eventId,
			...updatedData
		};
		
		// Safely convert timestamps to dates
		try {
			if (updatedData?.scheduledDateTime?.toDate) {
				responseData.scheduledDateTime = updatedData.scheduledDateTime.toDate();
			}
			if (updatedData?.actualTakenDateTime?.toDate) {
				responseData.actualTakenDateTime = updatedData.actualTakenDateTime.toDate();
			}
			if (updatedData?.createdAt?.toDate) {
				responseData.createdAt = updatedData.createdAt.toDate();
			}
			if (updatedData?.updatedAt?.toDate) {
				responseData.updatedAt = updatedData.updatedAt.toDate();
			}
		} catch (conversionError) {
			console.warn('⚠️ Error converting timestamps:', conversionError);
		}
		
		res.json({
			success: true,
			data: responseData,
			message: 'Medication marked as taken successfully'
		});
	} catch (error) {
		console.error('❌ === MARK MEDICATION AS TAKEN - FATAL ERROR ===');
		console.error('❌ Error marking medication as taken:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
		console.error('❌ Comprehensive error details:', {
			message: error instanceof Error ? error.message : 'Unknown error',
			code: (error as any)?.code || 'Unknown code',
			name: error instanceof Error ? error.name : 'Unknown name',
			eventId: req.params?.eventId || 'Unknown eventId',
			userId: (req as any)?.user?.uid || 'Unknown userId',
			requestBody: req.body,
			requestPath: req.path,
			requestMethod: req.method,
			userAgent: req.headers['user-agent'],
			timestamp: new Date().toISOString(),
			firestoreRegion: 'us-central1',
			functionMemory: '512MB'
		});
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error',
			errorCode: 'MARK_TAKEN_FAILED',
			timestamp: new Date().toISOString(),
			eventId: req.params?.eventId
		});
	}
});

// ===== ENHANCED MEDICATION ACTIONS ROUTES =====

// Snooze a medication
app.post('/medication-calendar/events/:eventId/snooze', authenticate, async (req, res) => {
	try {
		console.log('💤 Snoozing medication event:', req.params.eventId);
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		const { snoozeMinutes, reason } = req.body;
		
		if (!snoozeMinutes || snoozeMinutes < 1 || snoozeMinutes > 480) {
			return res.status(400).json({
				success: false,
				error: 'Snooze minutes must be between 1 and 480 (8 hours)'
			});
		}
		
		// Get the event document
		const eventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();
		
		if (!eventDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication event not found'
			});
		}
		
		const eventData = eventDoc.data();
		
		// Check access permissions
		if (eventData?.patientId !== userId) {
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
		
		// Calculate new scheduled time
		const originalTime = eventData?.scheduledDateTime?.toDate() || new Date();
		const newScheduledTime = new Date(originalTime.getTime() + (snoozeMinutes * 60 * 1000));
		
		// Update event with snooze information
		const snoozeEntry = {
			snoozedAt: admin.firestore.Timestamp.now(),
			snoozeMinutes,
			reason: reason?.trim() || undefined,
			snoozedBy: userId
		};
		
		const updateData = {
			scheduledDateTime: admin.firestore.Timestamp.fromDate(newScheduledTime),
			snoozeCount: (eventData?.snoozeCount || 0) + 1,
			snoozeHistory: admin.firestore.FieldValue.arrayUnion(snoozeEntry),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		await eventDoc.ref.update(updateData);
		
		// Get updated event
		const updatedDoc = await eventDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication snoozed successfully:', eventId);
		
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
			message: `Medication snoozed for ${snoozeMinutes} minutes`
		});
	} catch (error) {
		console.error('❌ Error snoozing medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Skip a medication
app.post('/medication-calendar/events/:eventId/skip', authenticate, async (req, res) => {
	try {
		console.log('⏭️ Skipping medication event:', req.params.eventId);
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		const { reason, notes } = req.body;
		
		if (!reason) {
			return res.status(400).json({
				success: false,
				error: 'Skip reason is required'
			});
		}
		
		// Get the event document
		const eventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();
		
		if (!eventDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication event not found'
			});
		}
		
		const eventData = eventDoc.data();
		
		// Check access permissions
		if (eventData?.patientId !== userId) {
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
		
		// Create skip entry
		const skipEntry = {
			skippedAt: admin.firestore.Timestamp.now(),
			reason,
			notes: notes?.trim() || undefined,
			skippedBy: userId
		};
		
		const updateData = {
			status: 'skipped',
			skipHistory: admin.firestore.FieldValue.arrayUnion(skipEntry),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		await eventDoc.ref.update(updateData);
		
		// Get updated event
		const updatedDoc = await eventDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication skipped successfully:', eventId);
		
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
			message: 'Medication skipped successfully'
		});
	} catch (error) {
		console.error('❌ Error skipping medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Reschedule a medication
app.post('/medication-calendar/events/:eventId/reschedule', authenticate, async (req, res) => {
	try {
		console.log('🔄 Rescheduling medication event:', req.params.eventId);
		const { eventId } = req.params;
		const userId = (req as any).user.uid;
		const { newDateTime, reason, isOneTime } = req.body;
		
		if (!newDateTime || !reason) {
			return res.status(400).json({
				success: false,
				error: 'New date/time and reason are required'
			});
		}
		
		const newDate = new Date(newDateTime);
		if (newDate <= new Date()) {
			return res.status(400).json({
				success: false,
				error: 'New date/time must be in the future'
			});
		}
		
		// Get the event document
		const eventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();
		
		if (!eventDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication event not found'
			});
		}
		
		const eventData = eventDoc.data();
		
		// Check access permissions
		if (eventData?.patientId !== userId) {
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
		
		// Create reschedule entry
		const rescheduleEntry = {
			originalDateTime: eventData?.scheduledDateTime || admin.firestore.Timestamp.now(),
			newDateTime: admin.firestore.Timestamp.fromDate(newDate),
			reason: reason.trim(),
			isOneTime: !!isOneTime,
			rescheduledAt: admin.firestore.Timestamp.now(),
			rescheduledBy: userId
		};
		
		const updateData = {
			scheduledDateTime: admin.firestore.Timestamp.fromDate(newDate),
			rescheduleHistory: admin.firestore.FieldValue.arrayUnion(rescheduleEntry),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		await eventDoc.ref.update(updateData);
		
		// If this is not a one-time reschedule, update the medication schedule
		if (!isOneTime && eventData?.medicationScheduleId) {
			try {
				const scheduleDoc = await firestore.collection('medication_schedules').doc(eventData.medicationScheduleId).get();
				if (scheduleDoc.exists) {
					const scheduleData = scheduleDoc.data();
					const newTimeStr = newDate.toTimeString().slice(0, 5); // HH:MM format
					
					// Update the schedule times
					const updatedTimes = scheduleData?.times?.map((time: string, index: number) => {
						// For simplicity, update the first time slot
						return index === 0 ? newTimeStr : time;
					}) || [newTimeStr];
					
					await scheduleDoc.ref.update({
						times: updatedTimes,
						updatedAt: admin.firestore.Timestamp.now()
					});
					
					console.log('✅ Updated medication schedule times:', eventData.medicationScheduleId);
				}
			} catch (scheduleError) {
				console.warn('⚠️ Failed to update medication schedule:', scheduleError);
				// Don't fail the reschedule if schedule update fails
			}
		}
		
		// Get updated event
		const updatedDoc = await eventDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication rescheduled successfully:', eventId);
		
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
			message: 'Medication rescheduled successfully'
		});
	} catch (error) {
		console.error('❌ Error rescheduling medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get today's medications organized by time buckets (supports family member access)
app.get('/medication-calendar/events/today-buckets', authenticate, async (req, res) => {
	try {
		const currentUserId = (req as any).user.uid;
		const { patientId, date } = req.query;
		
		// Determine which patient's buckets to fetch
		const targetPatientId = patientId as string || currentUserId;
		
		console.log('🗂️ Getting today\'s medication buckets for patient:', targetPatientId, 'requested by:', currentUserId);
		
		// Check if user has access to this patient's medication buckets
		if (targetPatientId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', targetPatientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			console.log('✅ Family access verified for medication buckets');
		}
		
		// Parse target date or use today
		const targetDate = date ? new Date(date as string) : new Date();
		const startOfDay = new Date(targetDate);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(targetDate);
		endOfDay.setHours(23, 59, 59, 999);
		
		// Get today's medication events (scheduled today)
		const eventsQuery = await firestore.collection('medication_calendar_events')
			.where('patientId', '==', targetPatientId)
			.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
			.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
			.orderBy('scheduledDateTime')
			.get();
		
		// Query for events completed today (regardless of when scheduled)
		const completedTodayQuery = await firestore.collection('medication_calendar_events')
			.where('patientId', '==', targetPatientId)
			.where('status', 'in', ['taken', 'late', 'skipped', 'missed'])
			.where('actualTakenDateTime', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
			.where('actualTakenDateTime', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
			.get();
		
		console.log('📊 Query results:', {
			scheduledToday: eventsQuery.docs.length,
			completedToday: completedTodayQuery.docs.length
		});
		
		// Merge and deduplicate events from both queries
		const eventMap = new Map();
		
		// Add events scheduled today
		eventsQuery.docs.forEach(doc => {
			eventMap.set(doc.id, doc);
		});
		
		// Add events completed today (may overlap with scheduled today)
		completedTodayQuery.docs.forEach(doc => {
			if (!eventMap.has(doc.id)) {
				eventMap.set(doc.id, doc);
			}
		});
		
		console.log('📊 Total unique events after merge:', eventMap.size);
		
		const events = Array.from(eventMap.values()).map(doc => {
			const data = doc.data();
			return {
				id: doc.id,
				...data,
				scheduledDateTime: data.scheduledDateTime?.toDate(),
				actualTakenDateTime: data.actualTakenDateTime?.toDate(),
				createdAt: data.createdAt?.toDate(),
				updatedAt: data.updatedAt?.toDate(),
				// Initialize enhanced fields if not present
				status: data.status,
				snoozeCount: data.snoozeCount || 0,
				snoozeHistory: data.snoozeHistory || [],
				skipHistory: data.skipHistory || [],
				rescheduleHistory: data.rescheduleHistory || [],
				isPartOfPack: !!data.packId,
				packPosition: data.packPosition || 0
			};
		});
		
		// Get or create patient preferences
		let preferences: any = {
			id: targetPatientId,
			patientId: targetPatientId,
			timeSlots: {
				morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
				noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
				evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
				bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
			},
			workSchedule: 'standard',
			quietHours: {
				start: '22:00',
				end: '07:00',
				enabled: true
			},
			createdAt: new Date(),
			updatedAt: new Date()
		};
		
		try {
			const prefsDoc = await firestore.collection('patient_medication_preferences').doc(targetPatientId).get();
			if (prefsDoc.exists) {
				const prefsData = prefsDoc.data();
				if (prefsData) {
					preferences = {
						id: prefsDoc.id,
						...prefsData,
						createdAt: prefsData.createdAt?.toDate(),
						updatedAt: prefsData.updatedAt?.toDate()
					};
				}
			} else {
				// Create default preferences
				const defaultPrefs = {
					patientId: targetPatientId,
					timeSlots: {
						morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
						noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
						evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
						bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
					},
					workSchedule: 'standard',
					quietHours: {
						start: '22:00',
						end: '07:00',
						enabled: true
					},
					createdAt: admin.firestore.Timestamp.now(),
					updatedAt: admin.firestore.Timestamp.now()
				};
				
				await firestore.collection('patient_medication_preferences').doc(targetPatientId).set(defaultPrefs);
				preferences = {
					id: targetPatientId,
					...defaultPrefs,
					createdAt: defaultPrefs.createdAt.toDate(),
					updatedAt: defaultPrefs.updatedAt.toDate()
				};
			}
		} catch (prefsError) {
			console.warn('⚠️ Error getting patient preferences, using defaults:', prefsError);
			// preferences already set to defaults above
		}
		
		// Organize events into time buckets
		const now = new Date();
		const buckets = {
			now: [] as any[],
			dueSoon: [] as any[],
			morning: [] as any[],
			noon: [] as any[],
			evening: [] as any[],
			bedtime: [] as any[],
			overdue: [] as any[],
			completed: [] as any[], // Add completed bucket for taken medications
			patientPreferences: preferences,
			lastUpdated: now
		};
		
		events.forEach(event => {
			const eventTime = new Date(event.scheduledDateTime);
			const minutesUntilDue = Math.floor((eventTime.getTime() - now.getTime()) / (1000 * 60));
			
			// Handle completed medications - only include if actually taken today
			if (['taken', 'late', 'skipped', 'missed'].includes(event.status)) {
				// Verify the event was actually completed today
				const actualTakenTime = event.actualTakenDateTime ? new Date(event.actualTakenDateTime) : null;
				const wasCompletedToday = actualTakenTime &&
					actualTakenTime >= startOfDay &&
					actualTakenTime <= endOfDay;
				
				if (wasCompletedToday) {
					const enhancedEvent: any = {
						...event,
						minutesUntilDue,
						isOverdue: minutesUntilDue < 0,
						minutesOverdue: minutesUntilDue < 0 ? Math.abs(minutesUntilDue) : 0,
						timeBucket: 'completed'
					};
					buckets.completed.push(enhancedEvent);
				}
				return;
			}
			
			// Skip truly non-actionable medications (cancelled, paused, completed)
			const nonActionableStatuses = ['cancelled', 'paused', 'completed'];
			if (nonActionableStatuses.includes(event.status)) {
				return;
			}
			
			// Enhanced event with time bucket info
			const enhancedEvent: any = {
				...event,
				minutesUntilDue,
				isOverdue: minutesUntilDue < 0,
				minutesOverdue: minutesUntilDue < 0 ? Math.abs(minutesUntilDue) : 0,
				timeBucket: 'morning' // Will be set below
			};
			
			// Classify into buckets
			if (minutesUntilDue < 0) {
				enhancedEvent.timeBucket = 'overdue';
				buckets.overdue.push(enhancedEvent);
			} else if (minutesUntilDue <= 15) {
				enhancedEvent.timeBucket = 'now';
				buckets.now.push(enhancedEvent);
			} else if (minutesUntilDue <= 60) {
				enhancedEvent.timeBucket = 'due_soon';
				buckets.dueSoon.push(enhancedEvent);
			} else {
				// Classify by time slot
				const eventTimeStr = eventTime.toTimeString().slice(0, 5);
				const timeSlots = preferences.timeSlots;
				
				if (timeSlots && eventTimeStr >= timeSlots.morning.start && eventTimeStr <= timeSlots.morning.end) {
					enhancedEvent.timeBucket = 'morning';
					buckets.morning.push(enhancedEvent);
				} else if (timeSlots && eventTimeStr >= timeSlots.noon.start && eventTimeStr <= timeSlots.noon.end) {
					enhancedEvent.timeBucket = 'noon';
					buckets.noon.push(enhancedEvent);
				} else if (timeSlots && eventTimeStr >= timeSlots.evening.start && eventTimeStr <= timeSlots.evening.end) {
					enhancedEvent.timeBucket = 'evening';
					buckets.evening.push(enhancedEvent);
				} else {
					enhancedEvent.timeBucket = 'bedtime';
					buckets.bedtime.push(enhancedEvent);
				}
			}
		});
		
		console.log('✅ Organized medications into time buckets:', {
			now: buckets.now.length,
			dueSoon: buckets.dueSoon.length,
			morning: buckets.morning.length,
			noon: buckets.noon.length,
			evening: buckets.evening.length,
			bedtime: buckets.bedtime.length,
			overdue: buckets.overdue.length
		});
		
		res.json({
			success: true,
			data: buckets,
			message: 'Time buckets retrieved successfully'
		});
	} catch (error) {
		console.error('❌ Error getting time buckets:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== PATIENT MEDICATION PREFERENCES ROUTES =====

// Get patient medication timing preferences
app.get('/patients/preferences/medication-timing', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		
		const prefsDoc = await firestore.collection('patient_medication_preferences').doc(patientId).get();
		
		if (!prefsDoc.exists) {
			// Create default preferences
			const defaultPrefs = {
				patientId,
				timeSlots: {
					morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
					noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
					evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
					bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
				},
				workSchedule: 'standard',
				quietHours: {
					start: '22:00',
					end: '07:00',
					enabled: true
				},
				createdAt: admin.firestore.Timestamp.now(),
				updatedAt: admin.firestore.Timestamp.now()
			};
			
			await prefsDoc.ref.set(defaultPrefs);
			
			res.json({
				success: true,
				data: {
					id: patientId,
					...defaultPrefs,
					createdAt: defaultPrefs.createdAt.toDate(),
					updatedAt: defaultPrefs.updatedAt.toDate()
				}
			});
		} else {
			const prefsData = prefsDoc.data();
			res.json({
				success: true,
				data: {
					id: prefsDoc.id,
					...prefsData,
					createdAt: prefsData?.createdAt?.toDate(),
					updatedAt: prefsData?.updatedAt?.toDate()
				}
			});
		}
	} catch (error) {
		console.error('Error getting patient medication preferences:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Update patient medication timing preferences
app.put('/patients/preferences/medication-timing', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const updateData = req.body;
		
		// Enhanced validation for time slots including 2 AM default prevention
		if (updateData.timeSlots && updateData.workSchedule) {
			const validation = validateTimeSlots(updateData.timeSlots, updateData.workSchedule);
			const twoAMValidation = validateAndPrevent2AMDefaults(updateData.timeSlots, updateData.workSchedule);
			
			if (!validation.isValid || !twoAMValidation.isValid) {
				const allErrors = [...validation.errors, ...twoAMValidation.errors];
				console.error('❌ Invalid time slot configuration in update:', allErrors);
				return res.status(400).json({
					success: false,
					error: 'Invalid time slot configuration',
					details: allErrors,
					suggestedFixes: twoAMValidation.fixes
				});
			}
			
			// Apply any automatic fixes for 2 AM issues
			if (Object.keys(twoAMValidation.fixes).length > 0) {
				console.log('🔧 Applying automatic fixes for 2 AM default issues:', twoAMValidation.fixes);
				updateData.timeSlots = {
					...updateData.timeSlots,
					...twoAMValidation.fixes
				};
			}
		}
		
		const updatePrefs = {
			...updateData,
			patientId,
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Remove fields that shouldn't be updated
		delete updatePrefs.id;
		delete updatePrefs.createdAt;
		
		await firestore.collection('patient_medication_preferences').doc(patientId).set(updatePrefs, { merge: true });
		
		// Get updated preferences
		const updatedDoc = await firestore.collection('patient_medication_preferences').doc(patientId).get();
		const updatedData = updatedDoc.data();
		
		res.json({
			success: true,
			data: {
				id: patientId,
				...updatedData,
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			}
		});
	} catch (error) {
		console.error('Error updating patient medication preferences:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Validation function for time slot configurations
function validateTimeSlots(timeSlots: any, workSchedule: string): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];
	
	// Enhanced validation for the problematic 2 AM default time issue
	if (workSchedule === 'night_shift') {
		// Check for the specific 2 AM default time issue
		if (timeSlots.evening?.defaultTime === '02:00') {
			errors.push('Night shift evening slot should not default to 2 AM - use 00:00 (midnight) instead');
		}
		
		// Check for the incorrect evening slot range
		if (timeSlots.evening?.start === '01:00' && timeSlots.evening?.end === '04:00') {
			errors.push('Night shift evening slot should be 23:00-02:00, not 01:00-04:00');
		}
		
		// Check for incorrect bedtime default
		if (timeSlots.bedtime?.defaultTime === '06:00') {
			errors.push('Night shift bedtime slot should default to 08:00, not 06:00');
		}
		
		// Additional validation: Check for any 2 AM times in any slot for night shift
		Object.entries(timeSlots).forEach(([slotName, config]: [string, any]) => {
			if (config?.defaultTime === '02:00' && slotName !== 'evening') {
				errors.push(`Night shift ${slotName} slot should not default to 2 AM - this may cause scheduling conflicts`);
			}
			if (config?.start === '02:00' || config?.end === '02:00') {
				if (slotName !== 'evening') {
					errors.push(`Night shift ${slotName} slot should not use 2 AM as start/end time - this may cause confusion with evening slot`);
				}
			}
		});
		
		// Validate that evening slot uses correct configuration
		if (timeSlots.evening && timeSlots.evening.defaultTime !== '00:00') {
			if (timeSlots.evening.start === '23:00' && timeSlots.evening.end === '02:00') {
				errors.push('Night shift evening slot (23:00-02:00) should default to 00:00 (midnight), not ' + timeSlots.evening.defaultTime);
			}
		}
	}
	
	// General validation: Warn about any 2 AM default times regardless of work schedule
	Object.entries(timeSlots).forEach(([slotName, config]: [string, any]) => {
		if (config?.defaultTime === '02:00' && workSchedule !== 'night_shift') {
			errors.push(`${slotName} slot defaulting to 2 AM is unusual for ${workSchedule} schedule - please verify this is intentional`);
		}
	});
	
	// Validate time format (HH:MM)
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	Object.entries(timeSlots).forEach(([slot, config]: [string, any]) => {
		if (!timeRegex.test(config.start)) {
			errors.push(`Invalid start time format for ${slot}: ${config.start}`);
		}
		if (!timeRegex.test(config.end)) {
			errors.push(`Invalid end time format for ${slot}: ${config.end}`);
		}
		if (!timeRegex.test(config.defaultTime)) {
			errors.push(`Invalid default time format for ${slot}: ${config.defaultTime}`);
		}
	});
	
	// Validate that default time is within the slot range
	Object.entries(timeSlots).forEach(([slot, config]: [string, any]) => {
		const start = config.start;
		const end = config.end;
		const defaultTime = config.defaultTime;
		
		// Handle overnight slots (e.g., 23:00-02:00)
		if (start > end) {
			// Overnight slot
			if (!(defaultTime >= start || defaultTime <= end)) {
				errors.push(`Default time ${defaultTime} for ${slot} is not within range ${start}-${end}`);
			}
		} else {
			// Regular slot
			if (!(defaultTime >= start && defaultTime <= end)) {
				errors.push(`Default time ${defaultTime} for ${slot} is not within range ${start}-${end}`);
			}
		}
	});
	
	return {
		isValid: errors.length === 0,
		errors
	};
}

// Enhanced validation function specifically for preventing 2 AM default time issues
function validateAndPrevent2AMDefaults(timeSlots: any, workSchedule: string): { isValid: boolean; errors: string[]; fixes: any } {
	const errors: string[] = [];
	const fixes: any = {};
	
	console.log('🔍 Validating time slots for 2 AM default issues:', { workSchedule, timeSlots });
	
	// Check each time slot for problematic 2 AM defaults
	Object.entries(timeSlots).forEach(([slotName, config]: [string, any]) => {
		if (config?.defaultTime === '02:00') {
			if (workSchedule === 'night_shift' && slotName === 'evening') {
				// This is the known issue - evening slot should default to 00:00 (midnight)
				errors.push(`CRITICAL: Night shift evening slot defaulting to 2 AM instead of midnight (00:00)`);
				fixes[slotName] = { ...config, defaultTime: '00:00' };
			} else if (workSchedule === 'night_shift') {
				// Other slots in night shift shouldn't default to 2 AM
				errors.push(`WARNING: Night shift ${slotName} slot defaulting to 2 AM may cause confusion`);
				// Suggest appropriate defaults based on slot
				const suggestedDefaults: Record<string, string> = {
					morning: '15:00',
					noon: '20:00',
					bedtime: '08:00'
				};
				fixes[slotName] = { ...config, defaultTime: suggestedDefaults[slotName] || '08:00' };
			} else {
				// Standard schedule shouldn't have 2 AM defaults
				errors.push(`WARNING: ${slotName} slot defaulting to 2 AM is unusual for ${workSchedule} schedule`);
				fixes[slotName] = { ...config, defaultTime: '08:00' }; // Default to 8 AM
			}
		}
	});
	
	// Specific validation for night shift evening slot
	if (workSchedule === 'night_shift' && timeSlots.evening) {
		const evening = timeSlots.evening;
		
		// Check for the exact problematic configuration
		if (evening.start === '01:00' && evening.end === '04:00' && evening.defaultTime === '02:00') {
			errors.push('CRITICAL: Detected exact problematic night shift configuration (01:00-04:00 defaulting to 02:00)');
			fixes.evening = { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Late Evening' };
		}
		
		// Ensure evening slot uses correct range and default
		if (evening.start === '23:00' && evening.end === '02:00' && evening.defaultTime !== '00:00') {
			errors.push(`Night shift evening slot (23:00-02:00) should default to 00:00, not ${evening.defaultTime}`);
			fixes.evening = { ...evening, defaultTime: '00:00' };
		}
	}
	
	return {
		isValid: errors.length === 0,
		errors,
		fixes
	};
}

// Reset patient preferences to defaults
app.post('/patients/preferences/medication-timing/reset-defaults', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const { workSchedule = 'standard' } = req.body;
		
		const defaultTimeSlots = workSchedule === 'night_shift' ? {
			morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
			noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
			evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Late Evening' },
			bedtime: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning Sleep' }
		} : {
			morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
			noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
			evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
			bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
		};
		
		// 🔥 CRITICAL VALIDATION: Ensure no 2 AM default times are ever set
		Object.entries(defaultTimeSlots).forEach(([slotName, config]) => {
			if (config.defaultTime === '02:00') {
				console.error(`🚨 CRITICAL ERROR: ${slotName} slot has problematic 2 AM default time in ${workSchedule} schedule`);
				throw new Error(`Invalid default time configuration: ${slotName} slot cannot default to 2 AM`);
			}
		});
		
		// Validate the time slots configuration
		const validation = validateTimeSlots(defaultTimeSlots, workSchedule);
		if (!validation.isValid) {
			console.error('❌ Invalid time slot configuration:', validation.errors);
			return res.status(400).json({
				success: false,
				error: 'Invalid time slot configuration',
				details: validation.errors
			});
		}
		
		const defaultPrefs = {
			patientId,
			timeSlots: defaultTimeSlots,
			workSchedule,
			quietHours: {
				start: '22:00',
				end: '07:00',
				enabled: true
			},
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		await firestore.collection('patient_medication_preferences').doc(patientId).set(defaultPrefs);
		
		res.json({
			success: true,
			data: {
				id: patientId,
				...defaultPrefs,
				createdAt: defaultPrefs.createdAt.toDate(),
				updatedAt: defaultPrefs.updatedAt.toDate()
			},
			message: 'Patient preferences reset to defaults'
		});
	} catch (error) {
		console.error('Error resetting patient medication preferences:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== MEAL LOGGING ROUTES =====

// Get meal logs for a patient
app.get('/meal-logs', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const { date, startDate, endDate } = req.query;
		
		console.log('🍽️ Getting meal logs for patient:', patientId);
		
		let query = firestore.collection('meal_logs')
			.where('patientId', '==', patientId);
		
		// Filter by specific date or date range
		if (date) {
			const targetDate = new Date(date as string);
			const startOfDay = new Date(targetDate);
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date(targetDate);
			endOfDay.setHours(23, 59, 59, 999);
			
			query = query
				.where('date', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
				.where('date', '<=', admin.firestore.Timestamp.fromDate(endOfDay));
		} else if (startDate && endDate) {
			query = query
				.where('date', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate as string)))
				.where('date', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate as string)));
		}
		
		const mealLogsSnapshot = await query.orderBy('date', 'desc').orderBy('loggedAt', 'desc').get();
		
		const mealLogs = mealLogsSnapshot.docs.map(doc => {
			const data = doc.data();
			return {
				id: doc.id,
				...data,
				date: data.date?.toDate(),
				loggedAt: data.loggedAt?.toDate(),
				estimatedTime: data.estimatedTime?.toDate(),
				createdAt: data.createdAt?.toDate(),
				updatedAt: data.updatedAt?.toDate()
			};
		});
		
		console.log('✅ Found', mealLogs.length, 'meal logs');
		
		res.json({
			success: true,
			data: mealLogs,
			message: 'Meal logs retrieved successfully'
		});
	} catch (error) {
		console.error('❌ Error getting meal logs:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create a new meal log
app.post('/meal-logs', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const { date, mealType, loggedAt, estimatedTime, notes } = req.body;
		
		console.log('🍽️ Creating meal log for patient:', patientId);
		
		if (!date || !mealType) {
			return res.status(400).json({
				success: false,
				error: 'Date and meal type are required'
			});
		}
		
		// Check for existing meal log for the same date and meal type
		const existingQuery = await firestore.collection('meal_logs')
			.where('patientId', '==', patientId)
			.where('date', '==', admin.firestore.Timestamp.fromDate(new Date(date)))
			.where('mealType', '==', mealType)
			.get();
		
		if (!existingQuery.empty) {
			return res.status(409).json({
				success: false,
				error: `${mealType} is already logged for this date. Use PUT to update it.`
			});
		}
		
		const newMealLog = {
			patientId,
			date: admin.firestore.Timestamp.fromDate(new Date(date)),
			mealType,
			loggedAt: admin.firestore.Timestamp.fromDate(new Date(loggedAt || new Date())),
			estimatedTime: estimatedTime ? admin.firestore.Timestamp.fromDate(new Date(estimatedTime)) : null,
			notes: notes?.trim() || null,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		const mealLogRef = await firestore.collection('meal_logs').add(newMealLog);
		
		console.log('✅ Meal log created successfully:', mealLogRef.id);
		
		res.json({
			success: true,
			data: {
				id: mealLogRef.id,
				...newMealLog,
				date: newMealLog.date.toDate(),
				loggedAt: newMealLog.loggedAt.toDate(),
				estimatedTime: newMealLog.estimatedTime?.toDate(),
				createdAt: newMealLog.createdAt.toDate(),
				updatedAt: newMealLog.updatedAt.toDate()
			},
			message: 'Meal log created successfully'
		});
	} catch (error) {
		console.error('❌ Error creating meal log:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Update a meal log
app.put('/meal-logs/:mealLogId', authenticate, async (req, res) => {
	try {
		const { mealLogId } = req.params;
		const patientId = (req as any).user.uid;
		const { mealType, loggedAt, estimatedTime, notes } = req.body;
		
		console.log('🍽️ Updating meal log:', mealLogId);
		
		const mealLogDoc = await firestore.collection('meal_logs').doc(mealLogId).get();
		
		if (!mealLogDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Meal log not found'
			});
		}
		
		const mealLogData = mealLogDoc.data();
		
		// Check if user owns this meal log
		if (mealLogData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		const updateData: any = {
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		if (mealType) updateData.mealType = mealType;
		if (loggedAt) updateData.loggedAt = admin.firestore.Timestamp.fromDate(new Date(loggedAt));
		if (estimatedTime) updateData.estimatedTime = admin.firestore.Timestamp.fromDate(new Date(estimatedTime));
		if (notes !== undefined) updateData.notes = notes?.trim() || null;
		
		await mealLogDoc.ref.update(updateData);
		
		// Get updated meal log
		const updatedDoc = await mealLogDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Meal log updated successfully:', mealLogId);
		
		res.json({
			success: true,
			data: {
				id: mealLogId,
				...updatedData,
				date: updatedData?.date?.toDate(),
				loggedAt: updatedData?.loggedAt?.toDate(),
				estimatedTime: updatedData?.estimatedTime?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			},
			message: 'Meal log updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating meal log:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Delete a meal log
app.delete('/meal-logs/:mealLogId', authenticate, async (req, res) => {
	try {
		const { mealLogId } = req.params;
		const patientId = (req as any).user.uid;
		
		console.log('🗑️ Deleting meal log:', mealLogId);
		
		const mealLogDoc = await firestore.collection('meal_logs').doc(mealLogId).get();
		
		if (!mealLogDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Meal log not found'
			});
		}
		
		const mealLogData = mealLogDoc.data();
		
		// Check if user owns this meal log
		if (mealLogData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		await mealLogDoc.ref.delete();
		
		console.log('✅ Meal log deleted successfully:', mealLogId);
		
		res.json({
			success: true,
			message: 'Meal log deleted successfully'
		});
	} catch (error) {
		console.error('❌ Error deleting meal log:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== MEDICATION SCHEDULE ROUTES (DEPRECATED - Use Unified Model) =====

// Get medication schedules for the current user
// DEPRECATED: Schedules are now embedded in medications. Use GET /medications instead.
app.get('/medication-calendar/schedules', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		
		console.warn('⚠️ DEPRECATED ENDPOINT: /medication-calendar/schedules - Use GET /medications with unified model instead');

		const schedulesQuery = await firestore.collection('medication_schedules')
			.where('patientId', '==', patientId)
			.get();

		const schedules = schedulesQuery.docs.map(doc => {
			const data = doc.data();
			return {
				id: doc.id,
				...data,
				startDate: data.startDate?.toDate(),
				endDate: data.endDate?.toDate(),
				createdAt: data.createdAt?.toDate(),
				updatedAt: data.updatedAt?.toDate(),
				pausedUntil: data.pausedUntil?.toDate()
			};
		});

		res.json({
			success: true,
			data: schedules,
			message: 'Medication schedules retrieved successfully',
			deprecated: true,
			deprecationNotice: 'This endpoint is deprecated. Use GET /medications to get medications with embedded schedules.'
		});
	} catch (error) {
		console.error('Error getting medication schedules:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get medication schedules for a specific medication
// DEPRECATED: Schedules are now embedded in medications. Use GET /medications/:medicationId instead.
app.get('/medication-calendar/schedules/medication/:medicationId', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;

		console.log('📅 Getting medication schedules for medication:', medicationId, 'patient:', patientId);

		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			console.log('❌ Medication not found:', medicationId);
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}

		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			console.log('❌ Access denied to medication:', medicationId, 'for patient:', patientId);
			return res.status(403).json({
				success: false,
				error: 'Access denied to this medication'
			});
		}

		try {
			const schedulesQuery = await firestore.collection('medication_schedules')
				.where('patientId', '==', patientId)
				.where('medicationId', '==', medicationId)
				.orderBy('createdAt', 'desc')
				.get();

			const schedules = schedulesQuery.docs.map(doc => {
				const data = doc.data();
				return {
					id: doc.id,
					...data,
					startDate: data.startDate?.toDate(),
					endDate: data.endDate?.toDate(),
					createdAt: data.createdAt?.toDate(),
					updatedAt: data.updatedAt?.toDate(),
					pausedUntil: data.pausedUntil?.toDate()
				};
			});

			console.log('✅ Found', schedules.length, 'medication schedules for medication:', medicationId);

			res.json({
				success: true,
				data: schedules,
				message: 'Medication schedules retrieved successfully',
				deprecated: true,
				deprecationNotice: 'This endpoint is deprecated. Use GET /medications/:medicationId to get medication with embedded schedule.'
			});
		} catch (queryError) {
			console.error('❌ Query error for medication schedules:', queryError);
			// Return empty array instead of error to prevent frontend crashes
			res.json({
				success: true,
				data: [],
				message: 'No medication schedules found'
			});
		}
	} catch (error) {
		console.error('❌ Error getting medication schedules by medication ID:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create a new medication schedule
// DEPRECATED: Schedules are now embedded in medications. Use PATCH /medications/:medicationId/schedule instead.
app.post('/medication-calendar/schedules', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const scheduleData = req.body;

		console.log('📅 Creating medication schedule for patient:', patientId);
		console.log('📅 Schedule data:', scheduleData);

		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(scheduleData.medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}

		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied to this medication'
			});
		}

		// Auto-include medication data and set defaults
		const frequency = scheduleData.frequency || 'daily';
		const dosageAmount = scheduleData.dosageAmount || medicationData?.dosage || '1 tablet';
		
		// Generate default times based on frequency (7am for once daily, 7am & 7pm for twice daily, etc.)
		let defaultTimes = ['07:00']; // Default to 7am
		
		console.log('🔍 Backend Schedule Creation: Processing frequency:', frequency);
		
		switch (frequency) {
			case 'daily':
			case 'once_daily':
				defaultTimes = ['07:00'];
				console.log('🔍 Backend Schedule Creation: Set daily times:', defaultTimes);
				break;
			case 'twice_daily':
				defaultTimes = ['07:00', '19:00']; // 7am and 7pm
				console.log('🔍 Backend Schedule Creation: Set twice_daily times:', defaultTimes);
				break;
			case 'three_times_daily':
				defaultTimes = ['07:00', '13:00', '19:00']; // 7am, 1pm, and 7pm
				console.log('🔍 Backend Schedule Creation: Set three_times_daily times:', defaultTimes);
				break;
			case 'four_times_daily':
				defaultTimes = ['07:00', '12:00', '17:00', '22:00']; // 7am, 12pm, 5pm, 10pm
				console.log('🔍 Backend Schedule Creation: Set four_times_daily times:', defaultTimes);
				break;
			case 'weekly':
				defaultTimes = ['07:00'];
				console.log('🔍 Backend Schedule Creation: Set weekly times:', defaultTimes);
				break;
			case 'monthly':
				defaultTimes = ['07:00'];
				console.log('🔍 Backend Schedule Creation: Set monthly times:', defaultTimes);
				break;
			default:
				defaultTimes = ['07:00'];
				console.log('🔍 Backend Schedule Creation: Set default times:', defaultTimes);
		}

		const times = scheduleData.times && scheduleData.times.length > 0 ? scheduleData.times : defaultTimes;

		// Validate required fields after auto-filling
		if (!scheduleData.medicationId || !frequency || !times || !dosageAmount) {
			return res.status(400).json({
				success: false,
				error: 'Missing required fields'
			});
		}

		// Create the schedule with medication data included
		const newSchedule = {
			medicationId: scheduleData.medicationId,
			medicationName: medicationData?.name || 'Unknown Medication',
			medicationDosage: medicationData?.dosage || '',
			medicationForm: medicationData?.dosageForm || '',
			medicationRoute: medicationData?.route || 'oral',
			medicationInstructions: medicationData?.instructions || '',
			patientId,
			frequency,
			times,
			daysOfWeek: scheduleData.daysOfWeek || [],
			dayOfMonth: scheduleData.dayOfMonth || 1,
			startDate: admin.firestore.Timestamp.fromDate(new Date(scheduleData.startDate || new Date())),
			endDate: scheduleData.endDate ? admin.firestore.Timestamp.fromDate(new Date(scheduleData.endDate)) : null,
			isIndefinite: scheduleData.isIndefinite !== false, // Default to true
			dosageAmount,
			instructions: scheduleData.instructions || medicationData?.instructions || '',
			generateCalendarEvents: scheduleData.generateCalendarEvents !== false, // Default to true
			reminderMinutesBefore: scheduleData.reminderMinutesBefore || [15, 5], // Default reminders
			isActive: true,
			isPaused: false,
			pausedUntil: null,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};

		const scheduleRef = await firestore.collection('medication_schedules').add(newSchedule);

		console.log('✅ Medication schedule created successfully:', scheduleRef.id);

		// Generate calendar events if requested
		if (newSchedule.generateCalendarEvents) {
			console.log('📅 Generating calendar events for schedule:', scheduleRef.id);
			try {
				await generateCalendarEventsForSchedule(scheduleRef.id, newSchedule);
				console.log('✅ Calendar events generation completed for schedule:', scheduleRef.id);
			} catch (eventError) {
				console.error('❌ Error generating calendar events:', eventError);
				// Don't fail the schedule creation if event generation fails
			}
		}

		res.status(201).json({
			success: true,
			data: {
				id: scheduleRef.id,
				...newSchedule,
				startDate: newSchedule.startDate.toDate(),
				endDate: newSchedule.endDate?.toDate(),
				createdAt: newSchedule.createdAt.toDate(),
				updatedAt: newSchedule.updatedAt.toDate()
			},
			message: 'Medication schedule created successfully',
			deprecated: true,
			deprecationNotice: 'This endpoint is deprecated. Use PATCH /medications/:medicationId/schedule to update medication schedule.'
		});
	} catch (error) {
		console.error('❌ Error creating medication schedule:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Update a medication schedule
// DEPRECATED: Schedules are now embedded in medications. Use PATCH /medications/:medicationId/schedule instead.
app.put('/medication-calendar/schedules/:scheduleId', authenticate, async (req, res) => {
	try {
		const { scheduleId } = req.params;
		const patientId = (req as any).user.uid;
		const updates = req.body;

		const scheduleDoc = await firestore.collection('medication_schedules').doc(scheduleId).get();

		if (!scheduleDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication schedule not found'
			});
		}

		const scheduleData = scheduleDoc.data();

		// Check if user has access to this schedule
		if (scheduleData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}

		// Prepare update data
		const updateData: any = {
			updatedAt: admin.firestore.Timestamp.now()
		};

		// Handle date conversions
		if (updates.startDate) {
			updateData.startDate = admin.firestore.Timestamp.fromDate(new Date(updates.startDate));
		}
		if (updates.endDate !== undefined) {
			updateData.endDate = updates.endDate ? admin.firestore.Timestamp.fromDate(new Date(updates.endDate)) : null;
		}

		// Copy other fields
		const fieldsToCopy = [
			'frequency', 'times', 'daysOfWeek', 'dayOfMonth', 'isIndefinite',
			'dosageAmount', 'instructions', 'generateCalendarEvents', 'reminderMinutesBefore'
		];

		fieldsToCopy.forEach(field => {
			if (updates[field] !== undefined) {
				updateData[field] = updates[field];
			}
		});

		await scheduleDoc.ref.update(updateData);

		// Get updated schedule
		const updatedDoc = await scheduleDoc.ref.get();
		const updatedData = updatedDoc.data();

		res.json({
			success: true,
			data: {
				id: scheduleId,
				...updatedData,
				startDate: updatedData?.startDate?.toDate(),
				endDate: updatedData?.endDate?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate(),
				pausedUntil: updatedData?.pausedUntil?.toDate()
			},
			message: 'Medication schedule updated successfully',
			deprecated: true,
			deprecationNotice: 'This endpoint is deprecated. Use PATCH /medications/:medicationId/schedule to update medication schedule.'
		});
	} catch (error) {
		console.error('Error updating medication schedule:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Pause a medication schedule
app.post('/medication-calendar/schedules/:scheduleId/pause', authenticate, async (req, res) => {
	try {
		const { scheduleId } = req.params;
		const patientId = (req as any).user.uid;
		const { pausedUntil } = req.body;

		const scheduleDoc = await firestore.collection('medication_schedules').doc(scheduleId).get();

		if (!scheduleDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication schedule not found'
			});
		}

		const scheduleData = scheduleDoc.data();

		// Check if user has access to this schedule
		if (scheduleData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}

		const updateData = {
			isPaused: true,
			pausedUntil: pausedUntil ? admin.firestore.Timestamp.fromDate(new Date(pausedUntil)) : null,
			updatedAt: admin.firestore.Timestamp.now()
		};

		await scheduleDoc.ref.update(updateData);

		// Get updated schedule
		const updatedDoc = await scheduleDoc.ref.get();
		const updatedData = updatedDoc.data();

		res.json({
			success: true,
			data: {
				id: scheduleId,
				...updatedData,
				startDate: updatedData?.startDate?.toDate(),
				endDate: updatedData?.endDate?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate(),
				pausedUntil: updatedData?.pausedUntil?.toDate()
			},
			message: 'Medication schedule paused successfully'
		});
	} catch (error) {
		console.error('Error pausing medication schedule:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Resume a medication schedule
app.post('/medication-calendar/schedules/:scheduleId/resume', authenticate, async (req, res) => {
	try {
		const { scheduleId } = req.params;
		const patientId = (req as any).user.uid;

		const scheduleDoc = await firestore.collection('medication_schedules').doc(scheduleId).get();

		if (!scheduleDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication schedule not found'
			});
		}

		const scheduleData = scheduleDoc.data();

		// Check if user has access to this schedule
		if (scheduleData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}

		const updateData = {
			isPaused: false,
			pausedUntil: null,
			updatedAt: admin.firestore.Timestamp.now()
		};

		await scheduleDoc.ref.update(updateData);

		// Get updated schedule
		const updatedDoc = await scheduleDoc.ref.get();
		const updatedData = updatedDoc.data();

		res.json({
			success: true,
			data: {
				id: scheduleId,
				...updatedData,
				startDate: updatedData?.startDate?.toDate(),
				endDate: updatedData?.endDate?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate(),
				pausedUntil: updatedData?.pausedUntil?.toDate()
			},
			message: 'Medication schedule resumed successfully'
		});
	} catch (error) {
		console.error('Error resuming medication schedule:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get adherence summary for dashboard
app.get('/medication-calendar/adherence/summary', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;

		// Get date range (default to last 30 days)
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 30);

		// Get all medication schedules for this patient
		const schedulesQuery = await firestore.collection('medication_schedules')
			.where('patientId', '==', patientId)
			.where('isActive', '==', true)
			.get();

		const medicationIds = schedulesQuery.docs.map(doc => doc.data().medicationId);
		const uniqueMedicationIds = [...new Set(medicationIds)];

		// Get calendar events for the period
		const eventsQuery = await firestore.collection('medication_calendar_events')
			.where('patientId', '==', patientId)
			.where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(startDate))
			.where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(endDate))
			.get();

		const events = eventsQuery.docs.map(doc => doc.data());

		// Calculate summary metrics
		const totalScheduled = events.length;
		const takenEvents = events.filter(e => e.status === 'taken');
		const missedEvents = events.filter(e => e.status === 'missed');
		const lateEvents = events.filter(e => e.status === 'late');

		const summary = {
			totalMedications: uniqueMedicationIds.length,
			overallAdherenceRate: totalScheduled > 0 ? ((takenEvents.length + lateEvents.length) / totalScheduled) * 100 : 0,
			totalScheduledDoses: totalScheduled,
			totalTakenDoses: takenEvents.length + lateEvents.length,
			totalMissedDoses: missedEvents.length,
			medicationsWithPoorAdherence: 0, // Calculate this based on per-medication adherence
			period: {
				startDate,
				endDate,
				days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
			}
		};

		// Calculate per-medication adherence
		const medications = await Promise.all(uniqueMedicationIds.map(async (medicationId) => {
			const medEvents = events.filter(e => e.medicationId === medicationId);
			const medTaken = medEvents.filter(e => e.status === 'taken' || e.status === 'late').length;
			const medMissed = medEvents.filter(e => e.status === 'missed').length;
			const medAdherenceRate = medEvents.length > 0 ? (medTaken / medEvents.length) * 100 : 0;

			// Get medication details
			const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
			const medicationData = medicationDoc.data();

			return {
				id: medicationId,
				name: medicationData?.name || 'Unknown Medication',
				totalScheduled: medEvents.length,
				takenDoses: medTaken,
				missedDoses: medMissed,
				adherenceRate: medAdherenceRate,
				isPoorAdherence: medAdherenceRate < 80 // Less than 80% is considered poor
			};
		}));

		// Update medications with poor adherence count
		summary.medicationsWithPoorAdherence = medications.filter(m => m.isPoorAdherence).length;

		res.json({
			success: true,
			data: {
				summary,
				medications
			},
			message: 'Adherence summary retrieved successfully'
		});
	} catch (error) {
		console.error('Error getting adherence summary:', error);
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
		console.log('🏥 === PROVIDER CREATION DEBUG START ===');
		const userId = (req as any).user.uid;
		const requestData = req.body;
		
		console.log('👤 User ID:', userId);
		console.log('📤 Request data keys:', Object.keys(requestData));
		console.log('📤 Full request data:', requestData);
		
		// Extract and validate required fields
		const {
			name,
			specialty,
			phoneNumber, // Client sends phoneNumber, not phone
			phone, // Legacy support
			email,
			address,
			notes,
			// Extended fields from client
			patientId,
			subSpecialty,
			credentials,
			website,
			city,
			state,
			zipCode,
			country,
			placeId,
			googleRating,
			googleReviews,
			businessStatus,
			practiceName,
			hospitalAffiliation,
			acceptedInsurance,
			languages,
			preferredAppointmentTime,
			typicalWaitTime,
			isPrimary,
			relationshipStart,
			lastVisit,
			nextAppointment,
			isActive
		} = requestData;
		
		console.log('📋 Extracted fields:', {
			name: !!name,
			specialty: !!specialty,
			phoneNumber: !!phoneNumber,
			phone: !!phone,
			email: !!email,
			address: !!address,
			hasExtendedFields: !!(subSpecialty || credentials || website)
		});
		
		if (!name || !specialty) {
			console.log('❌ Validation failed: missing required fields');
			return res.status(400).json({
				success: false,
				error: 'Name and specialty are required',
				received: { name: !!name, specialty: !!specialty }
			});
		}
		
		// Use patientId from request if provided, otherwise use authenticated user ID
		const targetPatientId = patientId || userId;
		console.log('🎯 Target patient ID:', targetPatientId);
		
		// Handle date conversions safely
		const convertToTimestamp = (dateValue: any) => {
			if (!dateValue) return undefined;
			try {
				if (dateValue instanceof Date) {
					return admin.firestore.Timestamp.fromDate(dateValue);
				}
				if (typeof dateValue === 'string') {
					return admin.firestore.Timestamp.fromDate(new Date(dateValue));
				}
				return undefined;
			} catch (error) {
				console.warn('⚠️ Invalid date value:', dateValue);
				return undefined;
			}
		};
		
		// Create comprehensive provider data with all client fields
		const providerData = {
			patientId: targetPatientId,
			name: name.trim(),
			specialty: specialty.trim(),
			subSpecialty: subSpecialty?.trim() || undefined,
			credentials: credentials?.trim() || undefined,
			phoneNumber: phoneNumber?.trim() || phone?.trim() || undefined, // Handle both field names
			email: email?.trim() || undefined,
			website: website?.trim() || undefined,
			address: address?.trim() || undefined,
			city: city?.trim() || undefined,
			state: state?.trim() || undefined,
			zipCode: zipCode?.trim() || undefined,
			country: country?.trim() || undefined,
			placeId: placeId?.trim() || undefined,
			googleRating: typeof googleRating === 'number' ? googleRating : undefined,
			googleReviews: typeof googleReviews === 'number' ? googleReviews : undefined,
			businessStatus: businessStatus || undefined,
			practiceName: practiceName?.trim() || undefined,
			hospitalAffiliation: Array.isArray(hospitalAffiliation) ? hospitalAffiliation.filter(h => h?.trim()) : [],
			acceptedInsurance: Array.isArray(acceptedInsurance) ? acceptedInsurance.filter(i => i?.trim()) : [],
			languages: Array.isArray(languages) ? languages.filter(l => l?.trim()) : [],
			preferredAppointmentTime: preferredAppointmentTime?.trim() || undefined,
			typicalWaitTime: typicalWaitTime?.trim() || undefined,
			isPrimary: !!isPrimary,
			relationshipStart: convertToTimestamp(relationshipStart),
			lastVisit: convertToTimestamp(lastVisit),
			nextAppointment: convertToTimestamp(nextAppointment),
			notes: notes?.trim() || undefined,
			isActive: isActive !== false, // Default to true
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Remove undefined fields to keep Firestore clean
		const cleanProviderData = Object.fromEntries(
			Object.entries(providerData).filter(([_, value]) => value !== undefined)
		);
		
		console.log('💾 Final provider data to save:', {
			fieldCount: Object.keys(cleanProviderData).length,
			fields: Object.keys(cleanProviderData),
			hasPhoneNumber: !!cleanProviderData.phoneNumber,
			hasExtendedFields: !!(cleanProviderData.subSpecialty || cleanProviderData.credentials)
		});
		
		// Save to Firestore with enhanced error handling
		let providerRef;
		try {
			providerRef = await firestore.collection('healthcare_providers').add(cleanProviderData);
			console.log('✅ Provider saved successfully:', providerRef.id);
		} catch (firestoreError) {
			console.error('❌ Firestore save error:', firestoreError);
			return res.status(500).json({
				success: false,
				error: 'Failed to save provider to database',
				details: firestoreError instanceof Error ? firestoreError.message : 'Unknown database error'
			});
		}
		
		// Prepare response data with proper date conversion
		const responseData = {
			id: providerRef.id,
			...cleanProviderData,
			createdAt: cleanProviderData.createdAt.toDate(),
			updatedAt: cleanProviderData.updatedAt.toDate(),
			relationshipStart: cleanProviderData.relationshipStart?.toDate(),
			lastVisit: cleanProviderData.lastVisit?.toDate(),
			nextAppointment: cleanProviderData.nextAppointment?.toDate()
		};
		
		console.log('📤 Sending response with provider ID:', providerRef.id);
		console.log('🏥 === PROVIDER CREATION DEBUG END ===');
		
		res.json({
			success: true,
			data: responseData,
			message: 'Healthcare provider added successfully'
		});
	} catch (error) {
		console.error('❌ Error adding healthcare provider:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
		console.error('❌ Request body:', req.body);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});
// Update healthcare provider
app.put('/healthcare/providers/:providerId', authenticate, async (req, res) => {
	try {
		console.log('🏥 === PROVIDER UPDATE DEBUG START ===');
		const { providerId } = req.params;
		const userId = (req as any).user.uid;
		const requestData = req.body;
		
		console.log('👤 User ID:', userId);
		console.log('🆔 Provider ID:', providerId);
		console.log('📤 Update data keys:', Object.keys(requestData));
		
		// Get existing provider
		const providerDoc = await firestore.collection('healthcare_providers').doc(providerId).get();
		
		if (!providerDoc.exists) {
			console.log('❌ Provider not found:', providerId);
			return res.status(404).json({
				success: false,
				error: 'Healthcare provider not found'
			});
		}
		
		const existingData = providerDoc.data();
		console.log('📋 Existing provider data:', existingData);
		
		// Check access permissions
		if (existingData?.patientId !== userId) {
			// Check family access with edit permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', existingData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				console.log('❌ Access denied for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canEdit) {
				console.log('❌ Insufficient permissions for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to edit providers'
				});
			}
		}
		
		// Extract all fields from request
		const {
			name,
			specialty,
			phoneNumber,
			phone,
			email,
			address,
			notes,
			subSpecialty,
			credentials,
			website,
			city,
			state,
			zipCode,
			country,
			placeId,
			googleRating,
			googleReviews,
			businessStatus,
			practiceName,
			hospitalAffiliation,
			acceptedInsurance,
			languages,
			preferredAppointmentTime,
			typicalWaitTime,
			isPrimary,
			relationshipStart,
			lastVisit,
			nextAppointment,
			isActive
		} = requestData;
		
		// Handle date conversions safely
		const convertToTimestamp = (dateValue: any) => {
			if (!dateValue) return undefined;
			try {
				if (dateValue instanceof Date) {
					return admin.firestore.Timestamp.fromDate(dateValue);
				}
				if (typeof dateValue === 'string') {
					return admin.firestore.Timestamp.fromDate(new Date(dateValue));
				}
				return undefined;
			} catch (error) {
				console.warn('⚠️ Invalid date value:', dateValue);
				return undefined;
			}
		};
		
		// Create comprehensive update data
		const updateData: any = {
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Only update fields that are provided
		if (name !== undefined) updateData.name = name.trim();
		if (specialty !== undefined) updateData.specialty = specialty.trim();
		if (subSpecialty !== undefined) updateData.subSpecialty = subSpecialty?.trim() || undefined;
		if (credentials !== undefined) updateData.credentials = credentials?.trim() || undefined;
		if (phoneNumber !== undefined || phone !== undefined) {
			updateData.phoneNumber = phoneNumber?.trim() || phone?.trim() || undefined;
		}
		if (email !== undefined) updateData.email = email?.trim() || undefined;
		if (website !== undefined) updateData.website = website?.trim() || undefined;
		if (address !== undefined) updateData.address = address?.trim() || undefined;
		if (city !== undefined) updateData.city = city?.trim() || undefined;
		if (state !== undefined) updateData.state = state?.trim() || undefined;
		if (zipCode !== undefined) updateData.zipCode = zipCode?.trim() || undefined;
		if (country !== undefined) updateData.country = country?.trim() || undefined;
		if (placeId !== undefined) updateData.placeId = placeId?.trim() || undefined;
		if (googleRating !== undefined) updateData.googleRating = typeof googleRating === 'number' ? googleRating : undefined;
		if (googleReviews !== undefined) updateData.googleReviews = typeof googleReviews === 'number' ? googleReviews : undefined;
		if (businessStatus !== undefined) updateData.businessStatus = businessStatus || undefined;
		if (practiceName !== undefined) updateData.practiceName = practiceName?.trim() || undefined;
		if (hospitalAffiliation !== undefined) updateData.hospitalAffiliation = Array.isArray(hospitalAffiliation) ? hospitalAffiliation.filter(h => h?.trim()) : [];
		if (acceptedInsurance !== undefined) updateData.acceptedInsurance = Array.isArray(acceptedInsurance) ? acceptedInsurance.filter(i => i?.trim()) : [];
		if (languages !== undefined) updateData.languages = Array.isArray(languages) ? languages.filter(l => l?.trim()) : [];
		if (preferredAppointmentTime !== undefined) updateData.preferredAppointmentTime = preferredAppointmentTime?.trim() || undefined;
		if (typicalWaitTime !== undefined) updateData.typicalWaitTime = typicalWaitTime?.trim() || undefined;
		if (isPrimary !== undefined) updateData.isPrimary = !!isPrimary;
		if (relationshipStart !== undefined) updateData.relationshipStart = convertToTimestamp(relationshipStart);
		if (lastVisit !== undefined) updateData.lastVisit = convertToTimestamp(lastVisit);
		if (nextAppointment !== undefined) updateData.nextAppointment = convertToTimestamp(nextAppointment);
		if (notes !== undefined) updateData.notes = notes?.trim() || undefined;
		if (isActive !== undefined) updateData.isActive = !!isActive;
		
		// Remove undefined fields
		const cleanUpdateData = Object.fromEntries(
			Object.entries(updateData).filter(([_, value]) => value !== undefined)
		);
		
		console.log('💾 Clean update data:', {
			fieldCount: Object.keys(cleanUpdateData).length,
			fields: Object.keys(cleanUpdateData)
		});
		
		// Update the provider
		try {
			await providerDoc.ref.update(cleanUpdateData);
			console.log('✅ Provider updated successfully:', providerId);
		} catch (updateError) {
			console.error('❌ Firestore update error:', updateError);
			return res.status(500).json({
				success: false,
				error: 'Failed to update provider',
				details: updateError instanceof Error ? updateError.message : 'Unknown update error'
			});
		}
		
		// Get updated provider data
		const updatedDoc = await providerDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		// Prepare response data with proper date conversion
		const responseData = {
			id: providerId,
			...updatedData,
			createdAt: updatedData?.createdAt?.toDate(),
			updatedAt: updatedData?.updatedAt?.toDate(),
			relationshipStart: updatedData?.relationshipStart?.toDate(),
			lastVisit: updatedData?.lastVisit?.toDate(),
			nextAppointment: updatedData?.nextAppointment?.toDate()
		};
		
		console.log('📤 Sending response for provider:', providerId);
		console.log('🔍 Response includes isPrimary:', {
			isPrimary: (responseData as any).isPrimary,
			name: (responseData as any).name,
			providerId
		});
		console.log('🏥 === PROVIDER UPDATE DEBUG END ===');
		
		res.json({
			success: true,
			data: responseData,
			message: 'Healthcare provider updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating healthcare provider:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Delete healthcare provider
app.delete('/healthcare/providers/:providerId', authenticate, async (req, res) => {
	try {
		console.log('🗑️ === PROVIDER DELETE DEBUG START ===');
		const { providerId } = req.params;
		const userId = (req as any).user.uid;
		
		console.log('👤 User ID:', userId);
		console.log('🆔 Provider ID:', providerId);
		
		// Get existing provider
		const providerDoc = await firestore.collection('healthcare_providers').doc(providerId).get();
		
		if (!providerDoc.exists) {
			console.log('❌ Provider not found:', providerId);
			return res.status(404).json({
				success: false,
				error: 'Healthcare provider not found'
			});
		}
		
		const providerData = providerDoc.data();
		console.log('📋 Provider to delete:', { name: providerData?.name, patientId: providerData?.patientId });
		
		// Check access permissions
		if (providerData?.patientId !== userId) {
			// Check family access with delete permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', providerData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				console.log('❌ Access denied for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canDelete) {
				console.log('❌ Insufficient permissions for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to delete providers'
				});
			}
		}
		
		// Soft delete by setting isActive to false instead of hard delete
		try {
			await providerDoc.ref.update({
				isActive: false,
				deletedAt: admin.firestore.Timestamp.now(),
				deletedBy: userId,
				updatedAt: admin.firestore.Timestamp.now()
			});
			console.log('✅ Provider soft deleted successfully:', providerId);
		} catch (deleteError) {
			console.error('❌ Firestore delete error:', deleteError);
			return res.status(500).json({
				success: false,
				error: 'Failed to delete provider',
				details: deleteError instanceof Error ? deleteError.message : 'Unknown delete error'
			});
		}
		
		console.log('🗑️ === PROVIDER DELETE DEBUG END ===');
		
		res.json({
			success: true,
			message: 'Healthcare provider deleted successfully'
		});
	} catch (error) {
		console.error('❌ Error deleting healthcare provider:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
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

// Add healthcare facility
app.post('/healthcare/facilities', authenticate, async (req, res) => {
	try {
		console.log('🏥 === FACILITY CREATION DEBUG START ===');
		const userId = (req as any).user.uid;
		const requestData = req.body;
		
		console.log('👤 User ID:', userId);
		console.log('📤 Request data keys:', Object.keys(requestData));
		
		// Extract and validate required fields
		const {
			name,
			facilityType,
			phoneNumber,
			phone,
			email,
			address,
			notes,
			patientId,
			website,
			city,
			state,
			zipCode,
			country,
			placeId,
			googleRating,
			googleReviews,
			businessStatus,
			services,
			acceptedInsurance,
			emergencyServices,
			isPreferred,
			isActive
		} = requestData;
		
		if (!name || !facilityType) {
			console.log('❌ Validation failed: missing required fields');
			return res.status(400).json({
				success: false,
				error: 'Name and facility type are required',
				received: { name: !!name, facilityType: !!facilityType }
			});
		}
		
		// Use patientId from request if provided, otherwise use authenticated user ID
		const targetPatientId = patientId || userId;
		console.log('🎯 Target patient ID:', targetPatientId);
		
		// Create comprehensive facility data
		const facilityData = {
			patientId: targetPatientId,
			name: name.trim(),
			facilityType: facilityType,
			phoneNumber: phoneNumber?.trim() || phone?.trim() || undefined,
			email: email?.trim() || undefined,
			website: website?.trim() || undefined,
			address: address?.trim() || undefined,
			city: city?.trim() || undefined,
			state: state?.trim() || undefined,
			zipCode: zipCode?.trim() || undefined,
			country: country?.trim() || undefined,
			placeId: placeId?.trim() || undefined,
			googleRating: typeof googleRating === 'number' ? googleRating : undefined,
			googleReviews: typeof googleReviews === 'number' ? googleReviews : undefined,
			businessStatus: businessStatus || undefined,
			services: Array.isArray(services) ? services.filter(s => s?.trim()) : [],
			acceptedInsurance: Array.isArray(acceptedInsurance) ? acceptedInsurance.filter(i => i?.trim()) : [],
			emergencyServices: !!emergencyServices,
			isPreferred: !!isPreferred,
			notes: notes?.trim() || undefined,
			isActive: isActive !== false,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Remove undefined fields
		const cleanFacilityData = Object.fromEntries(
			Object.entries(facilityData).filter(([_, value]) => value !== undefined)
		);
		
		console.log('💾 Final facility data to save:', {
			fieldCount: Object.keys(cleanFacilityData).length,
			fields: Object.keys(cleanFacilityData),
			facilityType: cleanFacilityData.facilityType,
			isPreferred: cleanFacilityData.isPreferred
		});
		
		// Save to Firestore
		let facilityRef;
		try {
			facilityRef = await firestore.collection('healthcare_facilities').add(cleanFacilityData);
			console.log('✅ Facility saved successfully:', facilityRef.id);
		} catch (firestoreError) {
			console.error('❌ Firestore save error:', firestoreError);
			return res.status(500).json({
				success: false,
				error: 'Failed to save facility to database',
				details: firestoreError instanceof Error ? firestoreError.message : 'Unknown database error'
			});
		}
		
		// Prepare response data
		const responseData = {
			id: facilityRef.id,
			...cleanFacilityData,
			createdAt: cleanFacilityData.createdAt.toDate(),
			updatedAt: cleanFacilityData.updatedAt.toDate()
		};
		
		console.log('📤 Sending response with facility ID:', facilityRef.id);
		console.log('🏥 === FACILITY CREATION DEBUG END ===');
		
		res.json({
			success: true,
			data: responseData,
			message: 'Healthcare facility added successfully'
		});
	} catch (error) {
		console.error('❌ Error adding healthcare facility:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Update healthcare facility
app.put('/healthcare/facilities/:facilityId', authenticate, async (req, res) => {
	try {
		console.log('🏥 === FACILITY UPDATE DEBUG START ===');
		const { facilityId } = req.params;
		const userId = (req as any).user.uid;
		const requestData = req.body;
		
		console.log('👤 User ID:', userId);
		console.log('🆔 Facility ID:', facilityId);
		console.log('📤 Update data keys:', Object.keys(requestData));
		
		// Get existing facility
		const facilityDoc = await firestore.collection('healthcare_facilities').doc(facilityId).get();
		
		if (!facilityDoc.exists) {
			console.log('❌ Facility not found:', facilityId);
			return res.status(404).json({
				success: false,
				error: 'Healthcare facility not found'
			});
		}
		
		const existingData = facilityDoc.data();
		console.log('📋 Existing facility data:', existingData);
		
		// Check access permissions
		if (existingData?.patientId !== userId) {
			// Check family access with edit permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', existingData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				console.log('❌ Access denied for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canEdit) {
				console.log('❌ Insufficient permissions for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to edit facilities'
				});
			}
		}
		
		// Extract all fields from request
		const {
			name,
			facilityType,
			phoneNumber,
			phone,
			email,
			address,
			notes,
			website,
			city,
			state,
			zipCode,
			country,
			placeId,
			googleRating,
			googleReviews,
			businessStatus,
			services,
			acceptedInsurance,
			emergencyServices,
			isPreferred,
			isActive
		} = requestData;
		
		// Create comprehensive update data
		const updateData: any = {
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Only update fields that are provided
		if (name !== undefined) updateData.name = name.trim();
		if (facilityType !== undefined) updateData.facilityType = facilityType;
		if (phoneNumber !== undefined || phone !== undefined) {
			updateData.phoneNumber = phoneNumber?.trim() || phone?.trim() || undefined;
		}
		if (email !== undefined) updateData.email = email?.trim() || undefined;
		if (website !== undefined) updateData.website = website?.trim() || undefined;
		if (address !== undefined) updateData.address = address?.trim() || undefined;
		if (city !== undefined) updateData.city = city?.trim() || undefined;
		if (state !== undefined) updateData.state = state?.trim() || undefined;
		if (zipCode !== undefined) updateData.zipCode = zipCode?.trim() || undefined;
		if (country !== undefined) updateData.country = country?.trim() || undefined;
		if (placeId !== undefined) updateData.placeId = placeId?.trim() || undefined;
		if (googleRating !== undefined) updateData.googleRating = typeof googleRating === 'number' ? googleRating : undefined;
		if (googleReviews !== undefined) updateData.googleReviews = typeof googleReviews === 'number' ? googleReviews : undefined;
		if (businessStatus !== undefined) updateData.businessStatus = businessStatus || undefined;
		if (services !== undefined) updateData.services = Array.isArray(services) ? services.filter(s => s?.trim()) : [];
		if (acceptedInsurance !== undefined) updateData.acceptedInsurance = Array.isArray(acceptedInsurance) ? acceptedInsurance.filter(i => i?.trim()) : [];
		if (emergencyServices !== undefined) updateData.emergencyServices = !!emergencyServices;
		if (isPreferred !== undefined) updateData.isPreferred = !!isPreferred;
		if (notes !== undefined) updateData.notes = notes?.trim() || undefined;
		if (isActive !== undefined) updateData.isActive = !!isActive;
		
		// Remove undefined fields
		const cleanUpdateData = Object.fromEntries(
			Object.entries(updateData).filter(([_, value]) => value !== undefined)
		);
		
		console.log('💾 Clean update data:', {
			fieldCount: Object.keys(cleanUpdateData).length,
			fields: Object.keys(cleanUpdateData)
		});
		
		// Update the facility
		try {
			await facilityDoc.ref.update(cleanUpdateData);
			console.log('✅ Facility updated successfully:', facilityId);
		} catch (updateError) {
			console.error('❌ Firestore update error:', updateError);
			return res.status(500).json({
				success: false,
				error: 'Failed to update facility',
				details: updateError instanceof Error ? updateError.message : 'Unknown update error'
			});
		}
		
		// Get updated facility data
		const updatedDoc = await facilityDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		// Prepare response data
		const responseData = {
			id: facilityId,
			...updatedData,
			createdAt: updatedData?.createdAt?.toDate(),
			updatedAt: updatedData?.updatedAt?.toDate()
		};
		
		console.log('📤 Sending response for facility:', facilityId);
		console.log('🏥 === FACILITY UPDATE DEBUG END ===');
		
		res.json({
			success: true,
			data: responseData,
			message: 'Healthcare facility updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating healthcare facility:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Delete healthcare facility
app.delete('/healthcare/facilities/:facilityId', authenticate, async (req, res) => {
	try {
		console.log('🗑️ === FACILITY DELETE DEBUG START ===');
		const { facilityId } = req.params;
		const userId = (req as any).user.uid;
		
		console.log('👤 User ID:', userId);
		console.log('🆔 Facility ID:', facilityId);
		
		// Get existing facility
		const facilityDoc = await firestore.collection('healthcare_facilities').doc(facilityId).get();
		
		if (!facilityDoc.exists) {
			console.log('❌ Facility not found:', facilityId);
			return res.status(404).json({
				success: false,
				error: 'Healthcare facility not found'
			});
		}
		
		const facilityData = facilityDoc.data();
		console.log('📋 Facility to delete:', { name: facilityData?.name, patientId: facilityData?.patientId });
		
		// Check access permissions
		if (facilityData?.patientId !== userId) {
			// Check family access with delete permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', facilityData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				console.log('❌ Access denied for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canDelete) {
				console.log('❌ Insufficient permissions for user:', userId);
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to delete facilities'
				});
			}
		}
		
		// Soft delete by setting isActive to false
		try {
			await facilityDoc.ref.update({
				isActive: false,
				deletedAt: admin.firestore.Timestamp.now(),
				deletedBy: userId,
				updatedAt: admin.firestore.Timestamp.now()
			});
			console.log('✅ Facility soft deleted successfully:', facilityId);
		} catch (deleteError) {
			console.error('❌ Firestore delete error:', deleteError);
			return res.status(500).json({
				success: false,
				error: 'Failed to delete facility',
				details: deleteError instanceof Error ? deleteError.message : 'Unknown delete error'
			});
		}
		
		console.log('🗑️ === FACILITY DELETE DEBUG END ===');
		
		res.json({
			success: true,
			message: 'Healthcare facility deleted successfully'
		});
	} catch (error) {
		console.error('❌ Error deleting healthcare facility:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Get specific healthcare facility by ID
app.get('/healthcare/facilities/:facilityId', authenticate, async (req, res) => {
	try {
		const { facilityId } = req.params;
		const currentUserId = (req as any).user.uid;
		
		console.log('🏥 Getting facility:', facilityId, 'requested by:', currentUserId);
		
		// Get the facility
		const facilityDoc = await firestore.collection('healthcare_facilities').doc(facilityId).get();
		
		if (!facilityDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Healthcare facility not found'
			});
		}
		
		const facilityData = facilityDoc.data();
		
		// Check if user has access to this facility's patient data
		if (facilityData?.patientId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', facilityData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		const facility = {
			id: facilityDoc.id,
			...facilityData,
			createdAt: facilityData?.createdAt?.toDate(),
			updatedAt: facilityData?.updatedAt?.toDate()
		};
		
		console.log('✅ Facility found:', facilityId);
		
		res.json({
			success: true,
			data: facility
		});
	} catch (error) {
		console.error('Error getting healthcare facility:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});


// ===== INSURANCE INFORMATION ROUTES =====

// Get insurance information for a patient
app.get('/insurance/:patientId', authenticate, async (req, res) => {
	try {
		const { patientId } = req.params;
		const currentUserId = (req as any).user.uid;
		
		console.log('💳 Getting insurance information for patient:', patientId, 'requested by:', currentUserId);
		
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
			
			// Check if user has permission to view medical details
			const accessData = familyAccess.docs[0].data();
			if (!accessData.permissions?.canViewMedicalDetails) {
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions to view insurance information'
				});
			}
		}
		
		// Get insurance information for this patient
		const insuranceQuery = await firestore.collection('insurance_information')
			.where('patientId', '==', patientId)
			.where('isActive', '==', true)
			.orderBy('isPrimary', 'desc')
			.orderBy('createdAt', 'desc')
			.get();
		
		const insuranceCards = insuranceQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			effectiveDate: doc.data().effectiveDate?.toDate(),
			expirationDate: doc.data().expirationDate?.toDate(),
			createdAt: doc.data().createdAt?.toDate(),
			updatedAt: doc.data().updatedAt?.toDate()
		}));
		
		console.log('✅ Found', insuranceCards.length, 'insurance cards for patient:', patientId);
		
		res.json({
			success: true,
			data: insuranceCards
		});
	} catch (error) {
		console.error('❌ Error getting insurance information:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create new insurance information
app.post('/insurance', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const insuranceData = req.body;
		
		console.log('💳 Creating insurance information for patient:', insuranceData.patientId);
		
		// Verify user is creating insurance for themselves
		if (insuranceData.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'You can only create insurance information for yourself'
			});
		}
		
		// Validate required fields
		if (!insuranceData.providerName || !insuranceData.policyNumber || !insuranceData.insuranceType) {
			return res.status(400).json({
				success: false,
				error: 'Provider name, policy number, and insurance type are required'
			});
		}
		
		// If this is being set as primary, unmark any existing primary insurance
		if (insuranceData.isPrimary) {
			const existingPrimaryQuery = await firestore.collection('insurance_information')
				.where('patientId', '==', userId)
				.where('isPrimary', '==', true)
				.get();
			
			const batch = firestore.batch();
			existingPrimaryQuery.docs.forEach(doc => {
				batch.update(doc.ref, {
					isPrimary: false,
					updatedAt: admin.firestore.Timestamp.now()
				});
			});
			await batch.commit();
		}
		
		// Handle date conversions
		const convertToTimestamp = (dateValue: any) => {
			if (!dateValue) return undefined;
			try {
				if (dateValue instanceof Date) {
					return admin.firestore.Timestamp.fromDate(dateValue);
				}
				if (typeof dateValue === 'string') {
					return admin.firestore.Timestamp.fromDate(new Date(dateValue));
				}
				return undefined;
			} catch (error) {
				console.warn('⚠️ Invalid date value:', dateValue);
				return undefined;
			}
		};
		
		const newInsurance = {
			patientId: userId,
			insuranceType: insuranceData.insuranceType,
			providerName: insuranceData.providerName.trim(),
			policyNumber: insuranceData.policyNumber.trim(),
			groupNumber: insuranceData.groupNumber?.trim() || undefined,
			subscriberName: insuranceData.subscriberName?.trim() || undefined,
			subscriberRelationship: insuranceData.subscriberRelationship || undefined,
			subscriberId: insuranceData.subscriberId?.trim() || undefined,
			effectiveDate: convertToTimestamp(insuranceData.effectiveDate),
			expirationDate: convertToTimestamp(insuranceData.expirationDate),
			cardFrontUrl: insuranceData.cardFrontUrl || undefined,
			cardBackUrl: insuranceData.cardBackUrl || undefined,
			cardFrontStoragePath: insuranceData.cardFrontStoragePath || undefined,
			cardBackStoragePath: insuranceData.cardBackStoragePath || undefined,
			customerServicePhone: insuranceData.customerServicePhone?.trim() || undefined,
			claimsAddress: insuranceData.claimsAddress?.trim() || undefined,
			rxBin: insuranceData.rxBin?.trim() || undefined,
			rxPcn: insuranceData.rxPcn?.trim() || undefined,
			rxGroup: insuranceData.rxGroup?.trim() || undefined,
			isActive: insuranceData.isActive !== false,
			isPrimary: !!insuranceData.isPrimary,
			notes: insuranceData.notes?.trim() || undefined,
			createdBy: userId,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Remove undefined fields
		const cleanInsuranceData = Object.fromEntries(
			Object.entries(newInsurance).filter(([_, value]) => value !== undefined)
		);
		
		const insuranceRef = await firestore.collection('insurance_information').add(cleanInsuranceData);
		
		// Update patient record with primary insurance reference if applicable
		if (insuranceData.isPrimary) {
			await firestore.collection('users').doc(userId).update({
				primaryInsuranceId: insuranceRef.id,
				hasInsurance: true,
				updatedAt: admin.firestore.Timestamp.now()
			});
		}
		
		console.log('✅ Insurance information created successfully:', insuranceRef.id);
		
		res.json({
			success: true,
			data: {
				id: insuranceRef.id,
				...cleanInsuranceData,
				effectiveDate: cleanInsuranceData.effectiveDate?.toDate(),
				expirationDate: cleanInsuranceData.expirationDate?.toDate(),
				createdAt: cleanInsuranceData.createdAt.toDate(),
				updatedAt: cleanInsuranceData.updatedAt.toDate()
			},
			message: 'Insurance information added successfully'
		});
	} catch (error) {
		console.error('❌ Error creating insurance information:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Update insurance information
app.put('/insurance/:insuranceId', authenticate, async (req, res) => {
	try {
		const { insuranceId } = req.params;
		const userId = (req as any).user.uid;
		const updateData = req.body;
		
		console.log('💳 Updating insurance information:', insuranceId);
		
		// Get existing insurance
		const insuranceDoc = await firestore.collection('insurance_information').doc(insuranceId).get();
		
		if (!insuranceDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Insurance information not found'
			});
		}
		
		const existingData = insuranceDoc.data();
		
		// Check if user owns this insurance
		if (existingData?.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		// If this is being set as primary, unmark any existing primary insurance
		if (updateData.isPrimary && !existingData?.isPrimary) {
			const existingPrimaryQuery = await firestore.collection('insurance_information')
				.where('patientId', '==', userId)
				.where('isPrimary', '==', true)
				.get();
			
			const batch = firestore.batch();
			existingPrimaryQuery.docs.forEach(doc => {
				if (doc.id !== insuranceId) {
					batch.update(doc.ref, {
						isPrimary: false,
						updatedAt: admin.firestore.Timestamp.now()
					});
				}
			});
			await batch.commit();
		}
		
		// Handle date conversions
		const convertToTimestamp = (dateValue: any) => {
			if (!dateValue) return undefined;
			try {
				if (dateValue instanceof Date) {
					return admin.firestore.Timestamp.fromDate(dateValue);
				}
				if (typeof dateValue === 'string') {
					return admin.firestore.Timestamp.fromDate(new Date(dateValue));
				}
				return undefined;
			} catch (error) {
				console.warn('⚠️ Invalid date value:', dateValue);
				return undefined;
			}
		};
		
		const updatedInsurance: any = {
			updatedBy: userId,
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		// Only update fields that are provided
		if (updateData.insuranceType !== undefined) updatedInsurance.insuranceType = updateData.insuranceType;
		if (updateData.providerName !== undefined) updatedInsurance.providerName = updateData.providerName.trim();
		if (updateData.policyNumber !== undefined) updatedInsurance.policyNumber = updateData.policyNumber.trim();
		if (updateData.groupNumber !== undefined) updatedInsurance.groupNumber = updateData.groupNumber?.trim() || undefined;
		if (updateData.subscriberName !== undefined) updatedInsurance.subscriberName = updateData.subscriberName?.trim() || undefined;
		if (updateData.subscriberRelationship !== undefined) updatedInsurance.subscriberRelationship = updateData.subscriberRelationship;
		if (updateData.subscriberId !== undefined) updatedInsurance.subscriberId = updateData.subscriberId?.trim() || undefined;
		if (updateData.effectiveDate !== undefined) updatedInsurance.effectiveDate = convertToTimestamp(updateData.effectiveDate);
		if (updateData.expirationDate !== undefined) updatedInsurance.expirationDate = convertToTimestamp(updateData.expirationDate);
		if (updateData.cardFrontUrl !== undefined) updatedInsurance.cardFrontUrl = updateData.cardFrontUrl || undefined;
		if (updateData.cardBackUrl !== undefined) updatedInsurance.cardBackUrl = updateData.cardBackUrl || undefined;
		if (updateData.cardFrontStoragePath !== undefined) updatedInsurance.cardFrontStoragePath = updateData.cardFrontStoragePath || undefined;
		if (updateData.cardBackStoragePath !== undefined) updatedInsurance.cardBackStoragePath = updateData.cardBackStoragePath || undefined;
		if (updateData.customerServicePhone !== undefined) updatedInsurance.customerServicePhone = updateData.customerServicePhone?.trim() || undefined;
		if (updateData.claimsAddress !== undefined) updatedInsurance.claimsAddress = updateData.claimsAddress?.trim() || undefined;
		if (updateData.rxBin !== undefined) updatedInsurance.rxBin = updateData.rxBin?.trim() || undefined;
		if (updateData.rxPcn !== undefined) updatedInsurance.rxPcn = updateData.rxPcn?.trim() || undefined;
		if (updateData.rxGroup !== undefined) updatedInsurance.rxGroup = updateData.rxGroup?.trim() || undefined;
		if (updateData.isActive !== undefined) updatedInsurance.isActive = !!updateData.isActive;
		if (updateData.isPrimary !== undefined) updatedInsurance.isPrimary = !!updateData.isPrimary;
		if (updateData.notes !== undefined) updatedInsurance.notes = updateData.notes?.trim() || undefined;
		
		// Remove undefined fields
		const cleanUpdateData = Object.fromEntries(
			Object.entries(updatedInsurance).filter(([_, value]) => value !== undefined)
		);
		
		await insuranceDoc.ref.update(cleanUpdateData);
		
		// Update patient record if primary insurance changed
		if (updateData.isPrimary) {
			await firestore.collection('users').doc(userId).update({
				primaryInsuranceId: insuranceId,
				hasInsurance: true,
				updatedAt: admin.firestore.Timestamp.now()
			});
		}
		
		// Get updated insurance
		const updatedDoc = await insuranceDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Insurance information updated successfully:', insuranceId);
		
		res.json({
			success: true,
			data: {
				id: insuranceId,
				...updatedData,
				effectiveDate: updatedData?.effectiveDate?.toDate(),
				expirationDate: updatedData?.expirationDate?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			},
			message: 'Insurance information updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating insurance information:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Delete insurance information
app.delete('/insurance/:insuranceId', authenticate, async (req, res) => {
	try {
		const { insuranceId } = req.params;
		const userId = (req as any).user.uid;
		
		console.log('🗑️ Deleting insurance information:', insuranceId);
		
		// Get existing insurance
		const insuranceDoc = await firestore.collection('insurance_information').doc(insuranceId).get();
		
		if (!insuranceDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Insurance information not found'
			});
		}
		
		const insuranceData = insuranceDoc.data();
		
		// Check if user owns this insurance
		if (insuranceData?.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		// Delete the insurance document
		await insuranceDoc.ref.delete();
		
		// If this was the primary insurance, update patient record
		if (insuranceData?.isPrimary) {
			await firestore.collection('users').doc(userId).update({
				primaryInsuranceId: admin.firestore.FieldValue.delete(),
				updatedAt: admin.firestore.Timestamp.now()
			});
		}
		
		console.log('✅ Insurance information deleted successfully:', insuranceId);
		
		res.json({
			success: true,
			message: 'Insurance information deleted successfully'
		});
	} catch (error) {
		console.error('❌ Error deleting insurance information:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
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

// ===== MEDICATIONS ROUTES (UNIFIED MODEL) =====

// Get medications for a user (supports family member access via patientId parameter)
// UPDATED: Now returns unified medication model with embedded schedule and reminders
app.get('/medications', authenticate, async (req, res) => {
	try {
		const currentUserId = (req as any).user.uid;
		const { patientId, includeInactive } = req.query;
		
		// Determine which patient's medications to fetch
		const targetPatientId = patientId as string || currentUserId;
		
		console.log('💊 [UNIFIED] Getting medications for patient:', targetPatientId, 'requested by:', currentUserId);
		
		// Check if user has access to this patient's medications
		if (targetPatientId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', targetPatientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			console.log('✅ Family access verified for medications');
		}
		
		// Get medications for the target patient
		const medicationsQuery = await firestore.collection('medications')
			.where('patientId', '==', targetPatientId)
			.orderBy('name')
			.get();
		
		const medications = medicationsQuery.docs.map(doc => {
			const data = doc.data();
			
			// Check if this is a unified medication (has metadata.version)
			const isUnified = !!data.metadata?.version;
			
			if (isUnified) {
				// Return unified format with proper date conversions
				return {
					id: doc.id,
					...data,
					schedule: {
						...data.schedule,
						startDate: data.schedule?.startDate?.toDate?.() || data.schedule?.startDate,
						endDate: data.schedule?.endDate?.toDate?.() || data.schedule?.endDate
					},
					metadata: {
						...data.metadata,
						createdAt: data.metadata?.createdAt?.toDate?.() || data.metadata?.createdAt,
						updatedAt: data.metadata?.updatedAt?.toDate?.() || data.metadata?.updatedAt,
						migratedFrom: data.metadata?.migratedFrom ? {
							...data.metadata.migratedFrom,
							migratedAt: data.metadata.migratedFrom.migratedAt?.toDate?.() || data.metadata.migratedFrom.migratedAt
						} : undefined
					}
				};
			} else {
				// Return legacy format for backward compatibility
				return {
					id: doc.id,
					...data,
					createdAt: data.createdAt?.toDate(),
					updatedAt: data.updatedAt?.toDate(),
					_legacy: true // Flag to indicate this is old format
				};
			}
		});
		
		// Filter out inactive medications unless explicitly requested
		const filteredMedications = includeInactive === 'true'
			? medications
			: medications.filter((med: any) => {
				// For unified: check status.isActive
				// For legacy: check isActive
				return med.status?.isActive !== false && med.isActive !== false;
			});
		
		console.log('✅ Found', filteredMedications.length, 'medications for patient:', targetPatientId);
		console.log('📊 Medication format breakdown:', {
			unified: medications.filter((m: any) => !m._legacy).length,
			legacy: medications.filter((m: any) => m._legacy).length
		});
		
		res.json({
			success: true,
			data: filteredMedications,
			metadata: {
				total: filteredMedications.length,
				unified: medications.filter((m: any) => !m._legacy).length,
				legacy: medications.filter((m: any) => m._legacy).length
			}
		});
	} catch (error) {
		console.error('❌ Error getting medications:', error);
		console.error('❌ Get medications error details:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : 'No stack',
			userId: (req as any)?.user?.uid || 'Unknown',
			patientId: req.query?.patientId || 'None',
			requestPath: req.path,
			timestamp: new Date().toISOString()
		});
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error',
			errorCode: 'GET_MEDICATIONS_FAILED',
			timestamp: new Date().toISOString()
		});
	}
});

// Delete medication
app.delete('/medications/:medicationId', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const userId = (req as any).user.uid;
		
		console.log('🗑️ Deleting medication:', { medicationId, userId });
		
		// Get the medication document
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		
		// Check if user owns this medication
		if (medicationData?.patientId !== userId) {
			// Check family access with delete permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', medicationData?.patientId)
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
					error: 'Insufficient permissions to delete medications'
				});
			}
		}
		
		// Delete associated schedules
		const schedulesQuery = await firestore.collection('medication_schedules')
			.where('medicationId', '==', medicationId)
			.get();
		
		const batch = firestore.batch();
		schedulesQuery.docs.forEach(doc => {
			batch.delete(doc.ref);
		});
		
		// Delete associated calendar events
		const eventsQuery = await firestore.collection('medication_calendar_events')
			.where('medicationId', '==', medicationId)
			.get();
		
		eventsQuery.docs.forEach(doc => {
			batch.delete(doc.ref);
		});
		
		// Delete associated reminders
		const remindersQuery = await firestore.collection('medication_reminders')
			.where('medicationId', '==', medicationId)
			.get();
		
		remindersQuery.docs.forEach(doc => {
			batch.delete(doc.ref);
		});
		
		// Delete the medication
		batch.delete(medicationDoc.ref);
		
		await batch.commit();
		
		console.log('✅ Medication and associated data deleted successfully:', medicationId);
		
		res.json({
			success: true,
			message: 'Medication deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});
// Get single medication by ID (UNIFIED MODEL)
// UPDATED: Returns unified medication model with embedded schedule and reminders
app.get('/medications/:medicationId', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const currentUserId = (req as any).user.uid;
		
		console.log('💊 [UNIFIED] Getting medication:', medicationId, 'requested by:', currentUserId);
		
		// Get the medication document
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		
		if (!medicationData) {
			return res.status(404).json({
				success: false,
				error: 'Medication data not found'
			});
		}
		
		// Check if user has access to this medication
		if (medicationData.patientId !== currentUserId) {
			// Check family access
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', currentUserId)
				.where('patientId', '==', medicationData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			console.log('✅ Family access verified for medication');
		}
		
		// Check if this is a unified medication (has metadata.version)
		const isUnified = !!medicationData.metadata?.version;
		
		let medication;
		if (isUnified) {
			// Return unified format with proper date conversions
			medication = {
				id: medicationDoc.id,
				...medicationData,
				schedule: {
					...medicationData.schedule,
					startDate: medicationData.schedule?.startDate?.toDate?.() || medicationData.schedule?.startDate,
					endDate: medicationData.schedule?.endDate?.toDate?.() || medicationData.schedule?.endDate
				},
				metadata: {
					...medicationData.metadata,
					createdAt: medicationData.metadata?.createdAt?.toDate?.() || medicationData.metadata?.createdAt,
					updatedAt: medicationData.metadata?.updatedAt?.toDate?.() || medicationData.metadata?.updatedAt,
					migratedFrom: medicationData.metadata?.migratedFrom ? {
						...medicationData.metadata.migratedFrom,
						migratedAt: medicationData.metadata.migratedFrom.migratedAt?.toDate?.() || medicationData.metadata.migratedFrom.migratedAt
					} : undefined
				}
			};
		} else {
			// Return legacy format for backward compatibility
			medication = {
				id: medicationDoc.id,
				...medicationData,
				createdAt: medicationData.createdAt?.toDate(),
				updatedAt: medicationData.updatedAt?.toDate(),
				_legacy: true // Flag to indicate this is old format
			};
		}
		
		console.log('✅ Medication retrieved:', medicationId, 'format:', isUnified ? 'unified' : 'legacy');
		
		res.json({
			success: true,
			data: medication
		});
	} catch (error) {
		console.error('❌ Error getting medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// PATCH: Update medication schedule only (UNIFIED MODEL)
app.patch('/medications/:medicationId/schedule', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const userId = (req as any).user.uid;
		const scheduleUpdates = req.body;
		
		console.log('📅 [UNIFIED] Updating medication schedule:', medicationId);
		
		// Get the medication document
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		
		if (!medicationData) {
			return res.status(404).json({
				success: false,
				error: 'Medication data not found'
			});
		}
		
		// Check access permissions
		if (medicationData.patientId !== userId) {
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', medicationData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty || !familyAccess.docs[0].data().permissions?.canEdit) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Check if this is a unified medication
		if (!medicationData.metadata?.version) {
			return res.status(400).json({
				success: false,
				error: 'This medication must be migrated to unified model first',
				hint: 'Use POST /medications/migrate-all to migrate all medications'
			});
		}
		
		// Prepare schedule updates
		const updatedSchedule: any = {
			...medicationData.schedule
		};
		
		// Update only provided fields
		if (scheduleUpdates.frequency !== undefined) updatedSchedule.frequency = scheduleUpdates.frequency;
		if (scheduleUpdates.times !== undefined) updatedSchedule.times = scheduleUpdates.times;
		if (scheduleUpdates.startDate !== undefined) {
			updatedSchedule.startDate = new Date(scheduleUpdates.startDate);
		}
		if (scheduleUpdates.endDate !== undefined) {
			updatedSchedule.endDate = scheduleUpdates.endDate ? new Date(scheduleUpdates.endDate) : null;
		}
		if (scheduleUpdates.isIndefinite !== undefined) updatedSchedule.isIndefinite = scheduleUpdates.isIndefinite;
		if (scheduleUpdates.dosageAmount !== undefined) updatedSchedule.dosageAmount = scheduleUpdates.dosageAmount;
		
		// Update medication document
		await medicationDoc.ref.update({
			schedule: updatedSchedule,
			'metadata.updatedAt': new Date()
		});
		
		// Get updated medication
		const updatedDoc = await medicationDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication schedule updated successfully');
		
		res.json({
			success: true,
			data: {
				id: medicationId,
				schedule: {
					...updatedData?.schedule,
					startDate: updatedData?.schedule?.startDate?.toDate?.() || updatedData?.schedule?.startDate,
					endDate: updatedData?.schedule?.endDate?.toDate?.() || updatedData?.schedule?.endDate
				}
			},
			message: 'Medication schedule updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating medication schedule:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// PATCH: Update medication reminders only (UNIFIED MODEL)
app.patch('/medications/:medicationId/reminders', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const userId = (req as any).user.uid;
		const reminderUpdates = req.body;
		
		console.log('🔔 [UNIFIED] Updating medication reminders:', medicationId);
		
		// Get the medication document
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		
		if (!medicationData) {
			return res.status(404).json({
				success: false,
				error: 'Medication data not found'
			});
		}
		
		// Check access permissions
		if (medicationData.patientId !== userId) {
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', medicationData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty || !familyAccess.docs[0].data().permissions?.canEdit) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Check if this is a unified medication
		if (!medicationData.metadata?.version) {
			return res.status(400).json({
				success: false,
				error: 'This medication must be migrated to unified model first',
				hint: 'Use POST /medications/migrate-all to migrate all medications'
			});
		}
		
		// Prepare reminder updates
		const updatedReminders: any = {
			...medicationData.reminders
		};
		
		// Update only provided fields
		if (reminderUpdates.enabled !== undefined) updatedReminders.enabled = reminderUpdates.enabled;
		if (reminderUpdates.minutesBefore !== undefined) updatedReminders.minutesBefore = reminderUpdates.minutesBefore;
		if (reminderUpdates.notificationMethods !== undefined) updatedReminders.notificationMethods = reminderUpdates.notificationMethods;
		
		// Update medication document
		await medicationDoc.ref.update({
			reminders: updatedReminders,
			'metadata.updatedAt': new Date()
		});
		
		// Get updated medication
		const updatedDoc = await medicationDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication reminders updated successfully');
		
		res.json({
			success: true,
			data: {
				id: medicationId,
				reminders: updatedData?.reminders
			},
			message: 'Medication reminders updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating medication reminders:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// PATCH: Update medication status only (UNIFIED MODEL)
app.patch('/medications/:medicationId/status', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const userId = (req as any).user.uid;
		const statusUpdates = req.body;
		
		console.log('🔄 [UNIFIED] Updating medication status:', medicationId);
		
		// Get the medication document
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		
		if (!medicationData) {
			return res.status(404).json({
				success: false,
				error: 'Medication data not found'
			});
		}
		
		// Check access permissions
		if (medicationData.patientId !== userId) {
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', medicationData?.patientId)
				.where('status', '==', 'active')
				.get();
			
			if (familyAccess.empty || !familyAccess.docs[0].data().permissions?.canEdit) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
		}
		
		// Check if this is a unified medication
		if (!medicationData.metadata?.version) {
			return res.status(400).json({
				success: false,
				error: 'This medication must be migrated to unified model first',
				hint: 'Use POST /medications/migrate-all to migrate all medications'
			});
		}
		
		// Prepare status updates
		const updatedStatus: any = {
			...medicationData.status
		};
		
		// Update only provided fields
		if (statusUpdates.isActive !== undefined) updatedStatus.isActive = statusUpdates.isActive;
		if (statusUpdates.isPRN !== undefined) updatedStatus.isPRN = statusUpdates.isPRN;
		if (statusUpdates.current !== undefined) updatedStatus.current = statusUpdates.current;
		
		// Update medication document
		await medicationDoc.ref.update({
			status: updatedStatus,
			'metadata.updatedAt': new Date()
		});
		
		// Get updated medication
		const updatedDoc = await medicationDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication status updated successfully');
		
		res.json({
			success: true,
			data: {
				id: medicationId,
				status: updatedData?.status
			},
			message: 'Medication status updated successfully'
		});
	} catch (error) {
		console.error('❌ Error updating medication status:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// ===== UNIFIED MEDICATION MIGRATION ENDPOINTS =====

// Import production migration functions
import { 
	migrateAllMedications, 
	migrateMedicationsForPatient,
	getMigrationStatus 
} from './migrations/migrateToUnifiedMedications';

// Trigger full migration of all medications (Admin endpoint)
app.post('/medications/migrate-all', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const { batchSize = 10, dryRun = false } = req.body;
		
		console.log('🚀 [MIGRATION] Full medication migration requested by:', userId);
		console.log('📊 Migration parameters:', { batchSize, dryRun });
		
		// Optional: Add admin check here if needed
		// For now, any authenticated user can trigger migration for their own medications
		
		// Run migration
		const migrationResult = await migrateAllMedications(batchSize, dryRun);
		
		console.log('✅ Migration completed:', {
			total: migrationResult.totalMedications,
			successful: migrationResult.successful,
			failed: migrationResult.failed,
			skipped: migrationResult.skipped
		});
		
		res.json({
			success: true,
			data: migrationResult,
			message: `Migration completed: ${migrationResult.successful} successful, ${migrationResult.failed} failed, ${migrationResult.skipped} skipped`
		});
	} catch (error) {
		console.error('❌ Error in migration endpoint:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Migrate medications for current user only
app.post('/medications/migrate-my-medications', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const { dryRun = false } = req.body;
		
		console.log('🚀 [MIGRATION] User medication migration requested by:', userId);
		
		// Run migration for this user only
		const migrationResult = await migrateMedicationsForPatient(userId, dryRun);
		
		console.log('✅ User migration completed:', {
			total: migrationResult.totalMedications,
			successful: migrationResult.successful,
			failed: migrationResult.failed,
			skipped: migrationResult.skipped
		});
		
		res.json({
			success: true,
			data: migrationResult,
			message: `Migration completed: ${migrationResult.successful} successful, ${migrationResult.failed} failed, ${migrationResult.skipped} skipped`
		});
	} catch (error) {
		console.error('❌ Error in user migration endpoint:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Get migration status
app.get('/medications/migration-status', authenticate, async (req, res) => {
	try {
		const status = await getMigrationStatus();
		
		res.json({
			success: true,
			data: status,
			message: `${status.migratedCount} of ${status.totalMedications} medications migrated (${status.migrationPercentage}%)`
		});
	} catch (error) {
		console.error('❌ Error getting migration status:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});


// Add medication
app.post('/medications', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const medicationData = req.body;
		
		console.log('💊 Creating medication with data:', {
			name: medicationData.name,
			hasReminders: medicationData.hasReminders,
			reminderTimes: medicationData.reminderTimes,
			frequency: medicationData.frequency,
			isPRN: medicationData.isPRN
		});
		
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
		console.log('✅ Medication created successfully:', medicationRef.id);
		
		// 🔥 CRITICAL FIX: Auto-create schedule if hasReminders is true and not PRN
		if (medicationData.hasReminders && !medicationData.isPRN && medicationData.frequency) {
			console.log('📅 Auto-creating schedule for medication with reminders:', medicationRef.id);
			
			try {
				// Generate default times based on frequency if not provided
				let defaultTimes = ['07:00']; // Morning default (7 AM)
				const frequency = medicationData.frequency.toLowerCase().trim();
				
				console.log('🔍 Backend: Parsing medication frequency:', frequency);
				
				// Enhanced frequency parsing with comprehensive variations
				if (frequency.includes('once daily') || frequency.includes('once a day') || frequency === 'daily' || frequency.includes('once')) {
					defaultTimes = ['07:00']; // Morning (7 AM)
					console.log('🔍 Backend: Mapped to daily times:', defaultTimes);
				} else if (frequency.includes('twice daily') || frequency.includes('twice a day') || frequency.includes('bid') || frequency.includes('twice') || frequency.includes('2x daily') || frequency.includes('twice per day')) {
					defaultTimes = ['07:00', '19:00']; // Morning & Evening (7 AM, 7 PM)
					console.log('🔍 Backend: Mapped to twice_daily times:', defaultTimes);
				} else if (frequency.includes('three times daily') || frequency.includes('three times a day') || frequency.includes('tid') || frequency.includes('three') || frequency.includes('3x daily') || frequency.includes('three times per day')) {
					defaultTimes = ['07:00', '13:00', '19:00']; // Morning, Afternoon, Evening
					console.log('🔍 Backend: Mapped to three_times_daily times:', defaultTimes);
				} else if (frequency.includes('four times daily') || frequency.includes('four times a day') || frequency.includes('qid') || frequency.includes('four') || frequency.includes('4x daily') || frequency.includes('four times per day')) {
					defaultTimes = ['07:00', '12:00', '17:00', '22:00']; // Morning, Afternoon, Evening, Bedtime
					console.log('🔍 Backend: Mapped to four_times_daily times:', defaultTimes);
				} else if (frequency.includes('every 4 hours')) {
					defaultTimes = ['07:00', '11:00', '15:00', '19:00', '23:00']; // Every 4 hours starting at 7 AM
					console.log('🔍 Backend: Mapped every 4 hours to times:', defaultTimes);
				} else if (frequency.includes('every 6 hours')) {
					defaultTimes = ['07:00', '13:00', '19:00', '01:00']; // Every 6 hours starting at 7 AM
					console.log('🔍 Backend: Mapped every 6 hours to times:', defaultTimes);
				} else if (frequency.includes('every 8 hours')) {
					defaultTimes = ['07:00', '15:00', '23:00']; // Every 8 hours starting at 7 AM
					console.log('🔍 Backend: Mapped every 8 hours to times:', defaultTimes);
				} else if (frequency.includes('every 12 hours')) {
					defaultTimes = ['07:00', '19:00']; // Every 12 hours
					console.log('🔍 Backend: Mapped every 12 hours to times:', defaultTimes);
				} else if (frequency.includes('weekly')) {
					defaultTimes = ['07:00'];
					console.log('🔍 Backend: Mapped to weekly times:', defaultTimes);
				} else if (frequency.includes('monthly')) {
					defaultTimes = ['07:00'];
					console.log('🔍 Backend: Mapped to monthly times:', defaultTimes);
				} else {
					console.warn(`⚠️ Backend: Unknown frequency "${frequency}", defaulting to daily`);
					defaultTimes = ['07:00']; // Default fallback
				}
				
				// Use provided reminderTimes or defaults
				const scheduleTimes = medicationData.reminderTimes && medicationData.reminderTimes.length > 0
					? medicationData.reminderTimes
					: defaultTimes;
				
				// Map frequency to schedule frequency format with enhanced parsing
				let scheduleFrequency = 'daily';
				if (frequency.includes('twice daily') || frequency.includes('twice a day') || frequency.includes('bid') || frequency.includes('twice') || frequency.includes('2x daily') || frequency.includes('twice per day') || frequency.includes('every 12 hours')) {
					scheduleFrequency = 'twice_daily';
				} else if (frequency.includes('three times daily') || frequency.includes('three times a day') || frequency.includes('tid') || frequency.includes('three') || frequency.includes('3x daily') || frequency.includes('three times per day') || frequency.includes('every 8 hours')) {
					scheduleFrequency = 'three_times_daily';
				} else if (frequency.includes('four times daily') || frequency.includes('four times a day') || frequency.includes('qid') || frequency.includes('four') || frequency.includes('4x daily') || frequency.includes('four times per day') || frequency.includes('every 6 hours') || frequency.includes('every 4 hours')) {
					scheduleFrequency = 'four_times_daily';
				} else if (frequency.includes('weekly')) {
					scheduleFrequency = 'weekly';
				} else if (frequency.includes('monthly')) {
					scheduleFrequency = 'monthly';
				} else if (frequency.includes('needed') || frequency.includes('prn') || frequency.includes('as needed')) {
					scheduleFrequency = 'as_needed';
				}
				
				console.log('🔍 Backend: Mapped to schedule frequency:', scheduleFrequency);
				
				const scheduleData = {
					medicationId: medicationRef.id,
					medicationName: medicationData.name,
					medicationDosage: medicationData.dosage || '',
					medicationForm: medicationData.dosageForm || '',
					medicationRoute: medicationData.route || 'oral',
					medicationInstructions: medicationData.instructions || '',
					patientId: userId,
					frequency: scheduleFrequency,
					times: scheduleTimes,
					daysOfWeek: [],
					dayOfMonth: 1,
					startDate: admin.firestore.Timestamp.fromDate(medicationData.startDate ? new Date(medicationData.startDate) : new Date()),
					endDate: medicationData.endDate ? admin.firestore.Timestamp.fromDate(new Date(medicationData.endDate)) : null,
					isIndefinite: !medicationData.endDate, // Indefinite if no end date
					dosageAmount: medicationData.dosage || '1 tablet',
					instructions: medicationData.instructions || '',
					generateCalendarEvents: true, // Always generate events for reminders
					reminderMinutesBefore: medicationData.reminderMinutesBefore || [15, 5],
					isActive: true,
					isPaused: false,
					pausedUntil: null,
					createdAt: admin.firestore.Timestamp.now(),
					updatedAt: admin.firestore.Timestamp.now(),
					autoCreated: true, // Flag to indicate this was auto-created
					autoCreatedReason: 'medication_has_reminders'
				};
				
				const scheduleRef = await firestore.collection('medication_schedules').add(scheduleData);
				console.log('✅ Auto-created medication schedule:', scheduleRef.id);
				
				// Generate calendar events for the new schedule
				try {
					await generateCalendarEventsForSchedule(scheduleRef.id, scheduleData);
					console.log('✅ Auto-generated calendar events for schedule:', scheduleRef.id);
				} catch (eventError) {
					console.error('❌ Error auto-generating calendar events:', eventError);
					// Don't fail medication creation if event generation fails
				}
				
			} catch (scheduleError) {
				console.error('❌ Error auto-creating schedule for medication:', scheduleError);
				// Don't fail medication creation if schedule creation fails
				// The user can manually create a schedule later
			}
		}
		
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
		console.error('❌ Error adding medication:', error);
		console.error('❌ Add medication error details:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : 'No stack',
			userId: (req as any)?.user?.uid || 'Unknown',
			medicationName: req.body?.name || 'Unknown',
			requestBody: req.body,
			requestPath: req.path,
			timestamp: new Date().toISOString()
		});
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error',
			errorCode: 'ADD_MEDICATION_FAILED',
			timestamp: new Date().toISOString()
		});
	}
});

// 🔥 BULK SCHEDULE CREATION: Create schedules for existing medications without them
app.post('/medications/bulk-create-schedules', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		console.log('📅 Starting bulk schedule creation for patient:', userId);
		
		// 🔍 DIAGNOSTIC: Get ALL medications first to see what we're working with
		const allMedicationsQuery = await firestore.collection('medications')
			.where('patientId', '==', userId)
			.get();
		
		const allMedications = allMedicationsQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data()
		})) as any[];
		
		console.log('🔍 DIAGNOSTIC: All medications for patient:', {
			totalCount: allMedications.length,
			medications: allMedications.map(med => ({
				id: med.id,
				name: med.name,
				isActive: med.isActive,
				hasReminders: med.hasReminders,
				isPRN: med.isPRN,
				frequency: med.frequency,
				dosage: med.dosage
			}))
		});
		
		// Get all active medications for this patient that have reminders enabled
		const medicationsQuery = await firestore.collection('medications')
			.where('patientId', '==', userId)
			.where('isActive', '==', true)
			.where('hasReminders', '==', true)
			.get();
		
		const medications = medicationsQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data()
		})) as any[];
		
		console.log(`📊 Found ${medications.length} medications with reminders enabled`);
		console.log('🔍 DIAGNOSTIC: Medications with reminders:', medications.map(med => ({
			id: med.id,
			name: med.name,
			frequency: med.frequency,
			hasReminders: med.hasReminders,
			isPRN: med.isPRN,
			isActive: med.isActive
		})));
		
		const results = {
			processed: 0,
			created: 0,
			skipped: 0,
			errors: [] as string[]
		};
		
		// Process each medication with enhanced validation
		for (const medication of medications) {
			try {
				results.processed++;
				
				console.log(`🔍 DIAGNOSTIC: Processing medication "${medication.name}":`, {
					id: medication.id,
					name: medication.name,
					frequency: medication.frequency,
					dosage: medication.dosage,
					hasReminders: medication.hasReminders,
					isPRN: medication.isPRN,
					isActive: medication.isActive,
					reminderTimes: medication.reminderTimes
				});
				
				// Enhanced validation with detailed feedback
				const validationIssues: string[] = [];
				
				// Skip PRN medications
				if (medication.isPRN) {
					console.log(`⏭️ SKIP REASON: PRN medication: ${medication.name}`);
					results.skipped++;
					continue;
				}
				
				// 🔍 ENHANCED: Check frequency field with suggestions
				if (!medication.frequency || typeof medication.frequency !== 'string' || medication.frequency.trim() === '') {
					validationIssues.push('Missing frequency - add dosing frequency (e.g., "twice daily", "once daily")');
				}
				
				// 🔍 ENHANCED: Check dosage field with suggestions
				if (!medication.dosage || typeof medication.dosage !== 'string' || medication.dosage.trim() === '') {
					validationIssues.push('Missing dosage - add dosage amount (e.g., "5mg", "1 tablet")');
				}
				
				// 🔍 ENHANCED: Check reminder times if provided
				if (medication.reminderTimes && Array.isArray(medication.reminderTimes)) {
					const invalidTimes = medication.reminderTimes.filter((time: any) =>
						typeof time !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)
					);
					if (invalidTimes.length > 0) {
						validationIssues.push(`Invalid reminder times: ${invalidTimes.join(', ')} - use HH:MM format`);
					}
				}
				
				// If there are validation issues, skip with detailed error
				if (validationIssues.length > 0) {
					const errorMessage = `${medication.name}: ${validationIssues.join('; ')}`;
					console.log(`⏭️ SKIP REASON: Validation issues for medication: ${medication.name}`, validationIssues);
					results.skipped++;
					results.errors.push(errorMessage);
					continue;
				}
				
				// Check if schedule already exists (enhanced check)
				const existingScheduleQuery = await firestore.collection('medication_schedules')
					.where('medicationId', '==', medication.id)
					.where('isActive', '==', true)
					.limit(1)
					.get();
				
				if (!existingScheduleQuery.empty) {
					// Check if existing schedule is valid
					const existingSchedule = existingScheduleQuery.docs[0].data();
					const hasValidTimes = existingSchedule.times && Array.isArray(existingSchedule.times) && existingSchedule.times.length > 0;
					const hasValidFrequency = existingSchedule.frequency && typeof existingSchedule.frequency === 'string';
					const hasValidDosage = existingSchedule.dosageAmount && typeof existingSchedule.dosageAmount === 'string';
					
					if (hasValidTimes && hasValidFrequency && hasValidDosage) {
						console.log(`⏭️ SKIP REASON: Valid schedule already exists for medication: ${medication.name}`);
						results.skipped++;
						continue;
					} else {
						console.log(`⚠️ REPAIR NEEDED: Invalid existing schedule for medication: ${medication.name}`, {
							hasValidTimes,
							hasValidFrequency,
							hasValidDosage,
							existingTimes: existingSchedule.times,
							existingFrequency: existingSchedule.frequency,
							existingDosage: existingSchedule.dosageAmount
						});
						results.errors.push(`${medication.name}: Existing schedule has validation issues and needs manual review`);
						results.skipped++;
						continue;
					}
				}
				
				// Generate default times based on frequency
				let defaultTimes = ['07:00']; // Morning default (7 AM)
				const frequency = (medication.frequency || '').toLowerCase().trim();
				
				console.log('🔍 Backend Bulk: Parsing medication frequency:', frequency);
				
				// Enhanced frequency parsing with comprehensive variations
				if (frequency.includes('once daily') || frequency.includes('once a day') || frequency === 'daily' || frequency.includes('once')) {
					defaultTimes = ['07:00']; // Morning (7 AM)
					console.log('🔍 Backend Bulk: Mapped to daily times:', defaultTimes);
				} else if (frequency.includes('twice daily') || frequency.includes('twice a day') || frequency.includes('bid') || frequency.includes('twice') || frequency.includes('2x daily') || frequency.includes('twice per day')) {
					defaultTimes = ['07:00', '19:00']; // Morning & Evening (7 AM, 7 PM)
					console.log('🔍 Backend Bulk: Mapped to twice_daily times:', defaultTimes);
				} else if (frequency.includes('three times daily') || frequency.includes('three times a day') || frequency.includes('tid') || frequency.includes('three') || frequency.includes('3x daily') || frequency.includes('three times per day')) {
					defaultTimes = ['07:00', '13:00', '19:00']; // Morning, Afternoon, Evening
					console.log('🔍 Backend Bulk: Mapped to three_times_daily times:', defaultTimes);
				} else if (frequency.includes('four times daily') || frequency.includes('four times a day') || frequency.includes('qid') || frequency.includes('four') || frequency.includes('4x daily') || frequency.includes('four times per day')) {
					defaultTimes = ['07:00', '12:00', '17:00', '22:00']; // Morning, Afternoon, Evening, Bedtime
					console.log('🔍 Backend Bulk: Mapped to four_times_daily times:', defaultTimes);
				} else if (frequency.includes('every 4 hours')) {
					defaultTimes = ['07:00', '11:00', '15:00', '19:00', '23:00']; // Every 4 hours starting at 7 AM
					console.log('🔍 Backend Bulk: Mapped every 4 hours to times:', defaultTimes);
				} else if (frequency.includes('every 6 hours')) {
					defaultTimes = ['07:00', '13:00', '19:00', '01:00']; // Every 6 hours starting at 7 AM
					console.log('🔍 Backend Bulk: Mapped every 6 hours to times:', defaultTimes);
				} else if (frequency.includes('every 8 hours')) {
					defaultTimes = ['07:00', '15:00', '23:00']; // Every 8 hours starting at 7 AM
					console.log('🔍 Backend Bulk: Mapped every 8 hours to times:', defaultTimes);
				} else if (frequency.includes('every 12 hours')) {
					defaultTimes = ['07:00', '19:00']; // Every 12 hours
					console.log('🔍 Backend Bulk: Mapped every 12 hours to times:', defaultTimes);
				} else if (frequency.includes('weekly')) {
					defaultTimes = ['07:00'];
					console.log('🔍 Backend Bulk: Mapped to weekly times:', defaultTimes);
				} else if (frequency.includes('monthly')) {
					defaultTimes = ['07:00'];
					console.log('🔍 Backend Bulk: Mapped to monthly times:', defaultTimes);
				} else {
					console.warn(`⚠️ Backend Bulk: Unknown frequency "${frequency}", defaulting to daily`);
					defaultTimes = ['07:00']; // Default fallback
				}
				
				// Use provided reminderTimes or defaults
				const scheduleTimes = medication.reminderTimes && medication.reminderTimes.length > 0
					? medication.reminderTimes
					: defaultTimes;
				
				// Map frequency to schedule frequency format with enhanced parsing
				let scheduleFrequency = 'daily';
				if (frequency.includes('twice daily') || frequency.includes('twice a day') || frequency.includes('bid') || frequency.includes('twice') || frequency.includes('2x daily') || frequency.includes('twice per day') || frequency.includes('every 12 hours')) {
					scheduleFrequency = 'twice_daily';
				} else if (frequency.includes('three times daily') || frequency.includes('three times a day') || frequency.includes('tid') || frequency.includes('three') || frequency.includes('3x daily') || frequency.includes('three times per day') || frequency.includes('every 8 hours')) {
					scheduleFrequency = 'three_times_daily';
				} else if (frequency.includes('four times daily') || frequency.includes('four times a day') || frequency.includes('qid') || frequency.includes('four') || frequency.includes('4x daily') || frequency.includes('four times per day') || frequency.includes('every 6 hours') || frequency.includes('every 4 hours')) {
					scheduleFrequency = 'four_times_daily';
				} else if (frequency.includes('weekly')) {
					scheduleFrequency = 'weekly';
				} else if (frequency.includes('monthly')) {
					scheduleFrequency = 'monthly';
				} else if (frequency.includes('needed') || frequency.includes('prn') || frequency.includes('as needed')) {
					scheduleFrequency = 'as_needed';
				}
				
				console.log('🔍 Backend Bulk: Mapped to schedule frequency:', scheduleFrequency);
				
				const scheduleData = {
					medicationId: medication.id,
					medicationName: medication.name,
					medicationDosage: medication.dosage || '',
					medicationForm: medication.dosageForm || '',
					medicationRoute: medication.route || 'oral',
					medicationInstructions: medication.instructions || '',
					patientId: userId,
					frequency: scheduleFrequency,
					times: scheduleTimes,
					daysOfWeek: [],
					dayOfMonth: 1,
					startDate: admin.firestore.Timestamp.fromDate(medication.startDate ? new Date(medication.startDate) : new Date()),
					endDate: medication.endDate ? admin.firestore.Timestamp.fromDate(new Date(medication.endDate)) : null,
					isIndefinite: !medication.endDate, // Indefinite if no end date
					dosageAmount: medication.dosage || '1 tablet',
					instructions: medication.instructions || '',
					generateCalendarEvents: true, // Always generate events for reminders
					reminderMinutesBefore: medication.reminderMinutesBefore || [15, 5],
					isActive: true,
					isPaused: false,
					pausedUntil: null,
					createdAt: admin.firestore.Timestamp.now(),
					updatedAt: admin.firestore.Timestamp.now(),
					autoCreated: true, // Flag to indicate this was auto-created
					autoCreatedReason: 'bulk_schedule_creation'
				};
				
				const scheduleRef = await firestore.collection('medication_schedules').add(scheduleData);
				console.log(`✅ Created schedule for ${medication.name}:`, scheduleRef.id);
				
				// Generate calendar events for the new schedule
				try {
					await generateCalendarEventsForSchedule(scheduleRef.id, scheduleData);
					console.log(`✅ Generated calendar events for ${medication.name}`);
				} catch (eventError) {
					console.error(`❌ Error generating calendar events for ${medication.name}:`, eventError);
					// Don't fail the entire process if event generation fails for one medication
				}
				
				results.created++;
				
			} catch (medicationError) {
				console.error(`❌ Error processing medication ${medication.name}:`, medicationError);
				results.errors.push(`Failed to create schedule for ${medication.name}: ${medicationError instanceof Error ? medicationError.message : 'Unknown error'}`);
			}
		}
		
		console.log('📊 Bulk schedule creation completed:', results);
		
		res.json({
			success: true,
			data: results,
			message: `Bulk schedule creation completed. Created ${results.created} schedules, skipped ${results.skipped}, ${results.errors.length} errors.`
		});
		
	} catch (error) {
		console.error('❌ Error in bulk schedule creation:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// Update medication with enhanced error logging
app.put('/medications/:medicationId', authenticate, async (req, res) => {
	try {
		console.log('🚀 === MEDICATION UPDATE DEBUG START ===');
		const { medicationId } = req.params;
		const userId = (req as any).user.uid;
		const updateData = req.body;
		
		console.log('📝 Step 1: Initial request data:', {
			medicationId,
			userId,
			updateDataKeys: Object.keys(updateData),
			updateDataTypes: Object.fromEntries(Object.entries(updateData).map(([k, v]) => [k, typeof v])),
			rawUpdateData: updateData,
			requestPath: req.path,
			requestMethod: req.method,
			userAgent: req.headers['user-agent'],
			timestamp: new Date().toISOString()
		});
		
		// Get the medication document
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		
		if (!medicationDoc.exists) {
			console.log('❌ Medication not found:', medicationId);
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		console.log('📋 Current medication data:', medicationData);
		
		// Check if user owns this medication
		if (medicationData?.patientId !== userId) {
			// Check family access with edit permissions
			const familyAccess = await firestore.collection('family_calendar_access')
				.where('familyMemberId', '==', userId)
				.where('patientId', '==', medicationData?.patientId)
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
					error: 'Insufficient permissions to edit medications'
				});
			}
		}
		
		console.log('📝 Step 2: Preparing update data with enhanced validation...');
		
		// Prepare update data - be more careful with date handling
		const updatedMedication: any = {
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		console.log('📝 Step 3: Processing each field in update data...');
		
		// Only convert date fields if they are actually date strings, not other data
		Object.keys(updateData).forEach(key => {
			console.log(`📝 Processing field: ${key} = ${updateData[key]} (type: ${typeof updateData[key]})`);
			
			try {
				if (key === 'prescribedDate' || key === 'startDate' || key === 'endDate') {
					// Enhanced date validation with comprehensive error handling
					const dateValue = updateData[key];
					
					// Skip if explicitly null or undefined
					if (dateValue === null || dateValue === undefined) {
						updatedMedication[key] = null;
						console.log(`✅ Set ${key} to null (explicit null/undefined)`);
						return;
					}
					
					// Skip if empty string
					if (dateValue === '') {
						console.log(`⚠️ Skipping empty string for ${key}`);
						return;
					}
					
					// Validate and convert date strings with comprehensive checks
					if (typeof dateValue === 'string') {
						const trimmedDate = dateValue.trim();
						
						// Check for obviously invalid patterns
						if (trimmedDate.length < 4 ||
							trimmedDate === 'Invalid Date' ||
							trimmedDate === 'null' ||
							trimmedDate === 'undefined' ||
							/^[0-9]{1,2}$/.test(trimmedDate)) { // Just a number
							console.warn(`⚠️ Invalid date pattern for ${key}:`, trimmedDate);
							return;
						}
						
						try {
							const parsedDate = new Date(trimmedDate);
							
							// Comprehensive date validation
							if (isNaN(parsedDate.getTime())) {
								console.warn(`⚠️ Invalid date string for ${key}:`, trimmedDate);
								return;
							}
							
							// Additional sanity checks for reasonable date ranges
							const year = parsedDate.getFullYear();
							if (year < 1900 || year > 2100) {
								console.warn(`⚠️ Date year out of reasonable range for ${key}:`, year);
								return;
							}
							
							// Convert to Firestore timestamp
							updatedMedication[key] = admin.firestore.Timestamp.fromDate(parsedDate);
							console.log(`✅ Converted ${key} to timestamp:`, parsedDate.toISOString());
							
						} catch (dateError) {
							console.error(`❌ Date conversion error for ${key}:`, {
								value: trimmedDate,
								error: dateError instanceof Error ? dateError.message : 'Unknown error'
							});
							// Skip invalid dates instead of failing the entire request
							return;
						}
					} else if (dateValue instanceof Date) {
						// Validate Date object
						if (isNaN(dateValue.getTime())) {
							console.warn(`⚠️ Invalid Date object for ${key}:`, dateValue);
							return;
						}
						
						updatedMedication[key] = admin.firestore.Timestamp.fromDate(dateValue);
						console.log(`✅ Converted ${key} Date object to timestamp`);
					} else {
						console.warn(`⚠️ Unexpected date type for ${key}:`, typeof dateValue, dateValue);
						return;
					}
				} else {
					// For non-date fields, copy directly with validation
					// Special handling for reminder fields to ensure they're valid
					if (key === 'reminderTimes' && Array.isArray(updateData[key])) {
						// Validate that reminderTimes is an array of valid time strings
						const validTimes = updateData[key].filter(time => {
							const isValid = typeof time === 'string' && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
							if (!isValid) {
								console.warn(`⚠️ Invalid reminder time format: ${time}`);
							}
							return isValid;
						});
						updatedMedication[key] = validTimes;
						console.log(`✅ Validated reminderTimes: ${validTimes.length} valid times`);
					} else if (key === 'hasReminders' && typeof updateData[key] === 'boolean') {
						// Ensure hasReminders is a boolean
						updatedMedication[key] = updateData[key];
						console.log(`✅ Set hasReminders to: ${updateData[key]}`);
					} else if (key === 'reminderMinutesBefore' && Array.isArray(updateData[key])) {
						// Validate reminderMinutesBefore is an array of numbers
						const validMinutes = updateData[key].filter(minutes => {
							const isValid = typeof minutes === 'number' && minutes >= 0 && minutes <= 1440; // 0-24 hours
							if (!isValid) {
								console.warn(`⚠️ Invalid reminder minutes: ${minutes}`);
							}
							return isValid;
						});
						updatedMedication[key] = validMinutes;
						console.log(`✅ Validated reminderMinutesBefore: ${validMinutes.length} valid entries`);
					} else {
						// For all other non-date fields, copy directly but validate type safety
						if (updateData[key] !== undefined) {
							updatedMedication[key] = updateData[key];
							console.log(`✅ Copied field ${key}: ${typeof updateData[key]}`);
						}
					}
				}
			} catch (fieldError) {
				console.error(`❌ Error processing field ${key}:`, fieldError);
				// Skip problematic fields instead of failing the entire update
			}
		});
		
		// Remove fields that shouldn't be updated
		delete updatedMedication.id;
		delete updatedMedication.createdAt;
		delete updatedMedication.patientId;
		
		console.log('📝 Step 4: Final update data prepared:', {
			fieldCount: Object.keys(updatedMedication).length,
			fields: Object.keys(updatedMedication),
			hasDateFields: Object.keys(updatedMedication).some(k => k.includes('Date')),
			hasReminderFields: Object.keys(updatedMedication).some(k => k.includes('reminder')),
			finalUpdateData: updatedMedication
		});
		
		// Validate the update data before sending to Firestore
		try {
			await medicationDoc.ref.update(updatedMedication);
		} catch (updateError) {
			console.error('❌ Firestore update error:', updateError);
			console.error('❌ Update data that caused error:', updatedMedication);
			console.error('❌ Original request data:', updateData);
			
			// Provide more specific error information
			if (updateError instanceof Error) {
				console.error('❌ Error message:', updateError.message);
				console.error('❌ Error stack:', updateError.stack);
			}
			
			return res.status(500).json({
				success: false,
				error: 'Failed to update medication',
				details: updateError instanceof Error ? updateError.message : 'Unknown update error',
				debugInfo: {
					updateData: updatedMedication,
					originalData: updateData
				}
			});
		}
		
		// 🔥 CRITICAL FIX: Auto-create schedule if reminders are being enabled
		// Check if this update is enabling reminders on a medication that didn't have them before
		const isEnablingReminders =
			updateData.hasReminders === true &&
			medicationData?.hasReminders !== true &&
			!updateData.isPRN &&
			updateData.frequency;
		
		console.log('🔍 Checking if schedule auto-creation needed:', {
			isEnablingReminders,
			updateHasReminders: updateData.hasReminders,
			previousHasReminders: medicationData?.hasReminders,
			isPRN: updateData.isPRN,
			hasFrequency: !!updateData.frequency
		});
		
		if (isEnablingReminders) {
			console.log('📅 Auto-creating schedule for medication with newly enabled reminders:', medicationId);
			
			try {
				// Check if schedule already exists
				const existingScheduleQuery = await firestore.collection('medication_schedules')
					.where('medicationId', '==', medicationId)
					.where('isActive', '==', true)
					.limit(1)
					.get();
				
				if (existingScheduleQuery.empty) {
					// Generate default times based on frequency
					let defaultTimes = ['07:00'];
					const frequency = (updateData.frequency || medicationData?.frequency || '').toLowerCase().trim();
					
					console.log('🔍 Backend PUT: Parsing medication frequency:', frequency);
					
					// Parse frequency to determine default times
					if (frequency.includes('once daily') || frequency.includes('once a day') || frequency === 'daily' || frequency.includes('once')) {
						defaultTimes = ['07:00'];
					} else if (frequency.includes('twice daily') || frequency.includes('twice a day') || frequency.includes('bid') || frequency.includes('twice')) {
						defaultTimes = ['07:00', '19:00'];
					} else if (frequency.includes('three times daily') || frequency.includes('three times a day') || frequency.includes('tid') || frequency.includes('three')) {
						defaultTimes = ['07:00', '13:00', '19:00'];
					} else if (frequency.includes('four times daily') || frequency.includes('four times a day') || frequency.includes('qid') || frequency.includes('four')) {
						defaultTimes = ['07:00', '12:00', '17:00', '22:00'];
					}
					
					// Use provided reminderTimes or defaults
					const scheduleTimes = updateData.reminderTimes && updateData.reminderTimes.length > 0
						? updateData.reminderTimes
						: defaultTimes;
					
					// Map frequency to schedule frequency format
					let scheduleFrequency = 'daily';
					if (frequency.includes('twice daily') || frequency.includes('twice a day') || frequency.includes('bid') || frequency.includes('twice')) {
						scheduleFrequency = 'twice_daily';
					} else if (frequency.includes('three times daily') || frequency.includes('three times a day') || frequency.includes('tid') || frequency.includes('three')) {
						scheduleFrequency = 'three_times_daily';
					} else if (frequency.includes('four times daily') || frequency.includes('four times a day') || frequency.includes('qid') || frequency.includes('four')) {
						scheduleFrequency = 'four_times_daily';
					}
					
					const scheduleData = {
						medicationId: medicationId,
						medicationName: updatedMedication?.name || medicationData?.name || 'Unknown Medication',
						medicationDosage: updatedMedication?.dosage || medicationData?.dosage || '',
						medicationForm: updatedMedication?.dosageForm || medicationData?.dosageForm || '',
						medicationRoute: updatedMedication?.route || medicationData?.route || 'oral',
						medicationInstructions: updatedMedication?.instructions || medicationData?.instructions || '',
						patientId: medicationData?.patientId || userId,
						frequency: scheduleFrequency,
						times: scheduleTimes,
						daysOfWeek: [],
						dayOfMonth: 1,
						startDate: admin.firestore.Timestamp.fromDate(new Date()),
						endDate: null,
						isIndefinite: true,
						dosageAmount: updatedMedication?.dosage || medicationData?.dosage || '1 tablet',
						instructions: updatedMedication?.instructions || medicationData?.instructions || '',
						generateCalendarEvents: true,
						reminderMinutesBefore: updateData.reminderMinutesBefore || [15, 5],
						isActive: true,
						isPaused: false,
						pausedUntil: null,
						createdAt: admin.firestore.Timestamp.now(),
						updatedAt: admin.firestore.Timestamp.now(),
						autoCreated: true,
						autoCreatedReason: 'reminders_enabled_via_update'
					};
					
					const scheduleRef = await firestore.collection('medication_schedules').add(scheduleData);
					console.log('✅ Auto-created medication schedule via PUT:', scheduleRef.id);
					
					// Generate calendar events for the new schedule
					try {
						await generateCalendarEventsForSchedule(scheduleRef.id, scheduleData);
						console.log('✅ Auto-generated calendar events for schedule:', scheduleRef.id);
					} catch (eventError) {
						console.error('❌ Error auto-generating calendar events:', eventError);
					}
				} else {
					console.log('ℹ️ Schedule already exists for medication, skipping auto-creation');
				}
			} catch (scheduleError) {
				console.error('❌ Error auto-creating schedule during medication update:', scheduleError);
				// Don't fail the medication update if schedule creation fails
			}
		}
		
		// Get updated medication
		const updatedDoc = await medicationDoc.ref.get();
		const updatedData = updatedDoc.data();
		
		console.log('✅ Medication updated successfully:', medicationId);
		
		res.json({
			success: true,
			data: {
				id: medicationId,
				...updatedData,
				prescribedDate: updatedData?.prescribedDate?.toDate(),
				startDate: updatedData?.startDate?.toDate(),
				endDate: updatedData?.endDate?.toDate(),
				createdAt: updatedData?.createdAt?.toDate(),
				updatedAt: updatedData?.updatedAt?.toDate()
			}
		});
	} catch (error) {
		console.error('❌ Error updating medication:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// ===== MEDICATION REMINDERS ROUTES =====

// Get medication reminders for a user
app.get('/medication-reminders', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		
		// Get medication reminders for this user
		const remindersQuery = await firestore.collection('medication_reminders')
			.where('patientId', '==', userId)
			.where('isActive', '==', true)
			.orderBy('createdAt', 'desc')
			.get();
		
		const reminders = remindersQuery.docs.map(doc => ({
			id: doc.id,
			...doc.data(),
			createdAt: doc.data().createdAt?.toDate(),
			updatedAt: doc.data().updatedAt?.toDate()
		}));
		
		res.json({
			success: true,
			data: reminders
		});
	} catch (error) {
		console.error('Error getting medication reminders:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create medication reminder
app.post('/medication-reminders', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user.uid;
		const { medicationId, reminderTimes, notificationMethods, isActive = true } = req.body;
		
		if (!medicationId || !reminderTimes || !Array.isArray(reminderTimes)) {
			return res.status(400).json({
				success: false,
				error: 'Medication ID and reminder times are required'
			});
		}
		
		// Verify the medication belongs to the user
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		const reminderData = {
			patientId: userId,
			medicationId,
			medicationName: medicationData?.name || 'Unknown Medication',
			reminderTimes: reminderTimes.map((time: string) => parseInt(time, 10)), // Convert to numbers
			notificationMethods: notificationMethods || ['browser'],
			isActive,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		const reminderRef = await firestore.collection('medication_reminders').add(reminderData);
		
		console.log('✅ Medication reminder created:', reminderRef.id);
		
		res.json({
			success: true,
			data: {
				id: reminderRef.id,
				...reminderData,
				createdAt: reminderData.createdAt.toDate(),
				updatedAt: reminderData.updatedAt.toDate()
			}
		});
	} catch (error) {
		console.error('Error creating medication reminder:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Delete medication reminder
app.delete('/medication-reminders/:reminderId', authenticate, async (req, res) => {
	try {
		const { reminderId } = req.params;
		const userId = (req as any).user.uid;
		
		// Get the reminder document
		const reminderDoc = await firestore.collection('medication_reminders').doc(reminderId).get();
		
		if (!reminderDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication reminder not found'
			});
		}
		
		const reminderData = reminderDoc.data();
		
		// Check if user owns this reminder
		if (reminderData?.patientId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		// Delete the reminder
		await reminderDoc.ref.delete();
		
		res.json({
			success: true,
			message: 'Medication reminder deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting medication reminder:', error);
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
async function processVisitSummaryWithAI(doctorSummary: string, treatmentPlan?: string) {
  try {
    const apiKey = googleAIApiKey.value();
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Available Gemini models in order of preference
    const GEMINI_MODELS = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-001',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro-001'
    ] as const;
    
    // Find the first available model
    let selectedModel = 'gemini-1.5-flash-latest'; // Default
    for (const modelName of GEMINI_MODELS) {
      try {
        const testModel = genAI.getGenerativeModel({ model: modelName });
        // Test with a simple prompt
        await testModel.generateContent('Test');
        selectedModel = modelName;
        break;
      } catch (error) {
        console.warn(`Model ${modelName} not available, trying next...`);
        continue;
      }
    }
    
    const model = genAI.getGenerativeModel({ model: selectedModel });

    const prompt = `
You are a medical assistant helping to process doctor visit notes.
Please analyze the following visit summary and provide a structured response.

Visit Summary: ${doctorSummary}
${treatmentPlan ? `Treatment Plan: ${treatmentPlan}` : ''}

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

    // Use Google Gemini AI for processing
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Try to parse the JSON response from Gemini
      let processedSummary;
      try {
        processedSummary = JSON.parse(text);
      } catch (parseError) {
        console.warn('Failed to parse Gemini response as JSON, using fallback analysis');
        // Fallback to pattern-based analysis if JSON parsing fails
        processedSummary = analyzeVisitSummary(doctorSummary, treatmentPlan);
      }
      
      return {
        success: true,
        data: processedSummary,
        metadata: {
          promptTokenCount: prompt.length,
          candidatesTokenCount: text.length,
          totalTokenCount: prompt.length + text.length,
          processingTime: Date.now(),
          model: selectedModel
        }
      };
    } catch (geminiError) {
      console.warn('Gemini AI processing failed, using fallback analysis:', geminiError);
      // Fallback to enhanced pattern-based analysis
      const processedSummary = analyzeVisitSummary(doctorSummary, treatmentPlan);
      
      return {
        success: true,
        data: processedSummary,
        metadata: {
          promptTokenCount: prompt.length,
          processingTime: 1000,
          model: `${selectedModel}-fallback`
        }
      };
    }
  } catch (error) {
    console.error('Error processing visit summary with AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI processing failed'
    };
  }
}

// Enhanced AI analysis function with better pattern detection
function analyzeVisitSummary(doctorSummary: string, treatmentPlan?: string) {
  const fullText = `${doctorSummary} ${treatmentPlan || ''}`.toLowerCase();
  
  // Extract key points from the summary
  const keyPoints = extractKeyPoints(doctorSummary);
  
  // Extract actionable items with time-based detection
  const actionItems = extractActionItems(fullText);
  
  // Detect medication changes
  const medicationChanges = detectMedicationChanges(fullText);
  
  // Detect follow-up requirements
  const followUpInfo = detectFollowUpRequirements(fullText);
  
  // Assess urgency level
  const urgencyLevel = assessUrgencyLevel(fullText);
  
  // Extract recommendations and warnings
  const recommendations = extractRecommendations(fullText);
  const riskFactors = extractRiskFactors(fullText);
  const warningFlags = extractWarningFlags(fullText);
  
  return {
    keyPoints,
    actionItems,
    medicationChanges,
    followUpRequired: followUpInfo.required,
    followUpDate: followUpInfo.date,
    followUpInstructions: followUpInfo.instructions,
    urgencyLevel,
    riskFactors,
    recommendations,
    warningFlags
  };
}

function extractKeyPoints(summary: string): string[] {
  const points: string[] = [];
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Take first few meaningful sentences as key points
  sentences.slice(0, 4).forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 15) {
      points.push(trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
    }
  });
  
  return points.length > 0 ? points : ["Visit completed successfully"];
}

function extractActionItems(text: string): string[] {
  const actionItems: string[] = [];
  
  // Time-based patterns for follow-up appointments
  const timePatterns = [
    /(?:see|follow.?up|return|come back|schedule|appointment).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:schedule|book|make).{0,20}(?:appointment|visit).{0,20}(?:in|within|for)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:return|come back).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:follow.?up|check.?up).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi
  ];
  
  timePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = match[1];
      const unit = match[2];
      actionItems.push(`Schedule follow-up appointment in ${amount} ${unit}${amount !== '1' ? 's' : ''}`);
    }
  });
  
  // Medication-related actions
  const medicationPatterns = [
    /(?:start|begin|take|add).{0,30}(?:medication|medicine|drug|pill)/gi,
    /(?:stop|discontinue|cease).{0,30}(?:medication|medicine|drug|pill)/gi,
    /(?:increase|decrease|change|adjust).{0,30}(?:dose|dosage|medication)/gi,
    /(?:monitor|check|measure).{0,30}(?:blood pressure|bp|heart rate|weight|glucose|sugar)/gi
  ];
  
  medicationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 10) {
        actionItems.push(fullMatch.charAt(0).toUpperCase() + fullMatch.slice(1));
      }
    }
  });
  
  // Lab/test related actions
  const testPatterns = [
    /(?:order|get|schedule).{0,30}(?:lab|blood work|test|x.?ray|mri|ct scan|ultrasound)/gi,
    /(?:repeat|recheck).{0,30}(?:lab|blood work|test)/gi
  ];
  
  testPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 10) {
        actionItems.push(fullMatch.charAt(0).toUpperCase() + fullMatch.slice(1));
      }
    }
  });
  
  // Lifestyle/monitoring actions
  const lifestylePatterns = [
    /(?:monitor|track|record|log).{0,30}(?:daily|weekly|regularly)/gi,
    /(?:exercise|diet|lifestyle).{0,30}(?:change|modification|improvement)/gi,
    /(?:call|contact).{0,30}(?:office|doctor|provider).{0,30}(?:if|when)/gi
  ];
  
  lifestylePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 15) {
        actionItems.push(fullMatch.charAt(0).toUpperCase() + fullMatch.slice(1));
      }
    }
  });
  
  // Remove duplicates and return unique action items
  return [...new Set(actionItems)].slice(0, 8);
}

function detectMedicationChanges(text: string) {
  const changes = {
    newMedications: [] as any[],
    stoppedMedications: [] as any[],
    changedMedications: [] as any[]
  };
  
  // Common medication names to look for
  const commonMeds = [
    'lisinopril', 'metformin', 'atorvastatin', 'amlodipine', 'metoprolol',
    'losartan', 'hydrochlorothiazide', 'simvastatin', 'omeprazole', 'levothyroxine',
    'gabapentin', 'sertraline', 'trazodone', 'prednisone', 'albuterol',
    'ibuprofen', 'acetaminophen', 'aspirin', 'insulin', 'warfarin'
  ];
  
  // Detect new medications
  const newMedPatterns = [
    /(?:start|begin|prescrib|add).{0,30}(lisinopril|metformin|atorvastatin|amlodipine|metoprolol|losartan|hydrochlorothiazide|simvastatin|omeprazole|levothyroxine|gabapentin|sertraline|trazodone|prednisone|albuterol).{0,30}(\d+\s*mg)/gi,
    /(?:new|starting).{0,20}(?:medication|medicine).{0,30}([\w\s]+?)(?:\s+(\d+\s*mg))/gi
  ];
  
  newMedPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medName = match[1]?.trim();
      const dosage = match[2]?.trim();
      if (medName && dosage) {
        changes.newMedications.push({
          name: medName.charAt(0).toUpperCase() + medName.slice(1),
          dosage: dosage,
          instructions: "Take as directed",
          startDate: new Date().toISOString().split('T')[0]
        });
      }
    }
  });
  
  // Detect stopped medications
  const stopMedPatterns = [
    /(?:stop|discontinue|cease).{0,30}(lisinopril|metformin|atorvastatin|amlodipine|metoprolol|losartan|hydrochlorothiazide|simvastatin|omeprazole|levothyroxine|gabapentin|sertraline|trazodone|prednisone|albuterol)/gi,
    /(?:no longer|not taking).{0,30}([\w\s]+?)(?:\s+medication)/gi
  ];
  
  stopMedPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medName = match[1]?.trim();
      if (medName && commonMeds.includes(medName.toLowerCase())) {
        changes.stoppedMedications.push({
          name: medName.charAt(0).toUpperCase() + medName.slice(1),
          reason: "As directed by provider",
          stopDate: new Date().toISOString().split('T')[0]
        });
      }
    }
  });
  
  return changes;
}

function detectFollowUpRequirements(text: string) {
  const followUpPatterns = [
    /(?:follow.?up|return|come back|see me|appointment).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:schedule|book).{0,20}(?:appointment|visit).{0,20}(?:in|for)\s+(\d+)\s+(day|week|month)s?/gi,
    /(?:recheck|re.?evaluate).{0,20}(?:in|within)\s+(\d+)\s+(day|week|month)s?/gi
  ];
  
  for (const pattern of followUpPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      const followUpDate = new Date();
      if (unit === 'day') {
        followUpDate.setDate(followUpDate.getDate() + amount);
      } else if (unit === 'week') {
        followUpDate.setDate(followUpDate.getDate() + (amount * 7));
      } else if (unit === 'month') {
        followUpDate.setMonth(followUpDate.getMonth() + amount);
      }
      
      return {
        required: true,
        date: followUpDate.toISOString().split('T')[0],
        instructions: `Follow-up appointment needed in ${amount} ${unit}${amount !== 1 ? 's' : ''}`
      };
    }
  }
  
  // Check for general follow-up mentions
  if (/follow.?up|return|recheck|re.?evaluate/gi.test(text)) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14); // Default to 2 weeks
    
    return {
      required: true,
      date: defaultDate.toISOString().split('T')[0],
      instructions: "Follow-up appointment recommended"
    };
  }
  
  return {
    required: false,
    date: null,
    instructions: null
  };
}

function assessUrgencyLevel(text: string): 'low' | 'medium' | 'high' | 'urgent' {
  const urgentKeywords = ['urgent', 'emergency', 'immediate', 'asap', 'critical', 'severe'];
  const highKeywords = ['important', 'soon', 'promptly', 'quickly', 'elevated', 'high'];
  const mediumKeywords = ['monitor', 'watch', 'follow', 'check', 'routine'];
  
  if (urgentKeywords.some(keyword => text.includes(keyword))) {
    return 'urgent';
  }
  if (highKeywords.some(keyword => text.includes(keyword))) {
    return 'high';
  }
  if (mediumKeywords.some(keyword => text.includes(keyword))) {
    return 'medium';
  }
  
  return 'low';
}

function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];
  
  // Common medical recommendations
  const recPatterns = [
    /(?:recommend|suggest|advise).{0,50}(?:exercise|diet|lifestyle|rest|activity)/gi,
    /(?:continue|maintain).{0,30}(?:current|treatment|medication|therapy)/gi,
    /(?:avoid|limit|reduce).{0,30}(?:sodium|alcohol|caffeine|stress|activity)/gi,
    /(?:increase|improve).{0,30}(?:fluid|water|fiber|activity|exercise)/gi
  ];
  
  recPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const rec = match[0].trim();
      if (rec.length > 15) {
        recommendations.push(rec.charAt(0).toUpperCase() + rec.slice(1));
      }
    }
  });
  
  return [...new Set(recommendations)].slice(0, 5);
}

function extractRiskFactors(text: string): string[] {
  const riskFactors: string[] = [];
  
  const riskPatterns = [
    /(?:risk|concern|worry).{0,30}(?:for|of|about).{0,30}([\w\s]{5,30})/gi,
    /(?:elevated|high|increased).{0,20}(blood pressure|cholesterol|glucose|heart rate)/gi,
    /(?:family history|genetic risk).{0,30}([\w\s]{5,30})/gi
  ];
  
  riskPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const risk = match[1]?.trim();
      if (risk && risk.length > 5) {
        riskFactors.push(risk.charAt(0).toUpperCase() + risk.slice(1));
      }
    }
  });
  
  return [...new Set(riskFactors)].slice(0, 3);
}

function extractWarningFlags(text: string): string[] {
  const warningFlags: string[] = [];
  
  const warningPatterns = [
    /(?:warning|caution|alert|concern).{0,50}/gi,
    /(?:side effect|adverse|reaction).{0,30}/gi,
    /(?:emergency|urgent|immediate).{0,30}(?:care|attention|contact)/gi
  ];
  
  warningPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const warning = match[0].trim();
      if (warning.length > 10) {
        warningFlags.push(warning.charAt(0).toUpperCase() + warning.slice(1));
      }
    }
  });
  
  return [...new Set(warningFlags)].slice(0, 3);
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
    
    // Restrict: Only the patient can create visit summaries
    if (visitData.patientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the patient can record visit summaries'
      });
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

// Enhanced audio transcription with detailed debug logging
app.post('/audio/transcribe', authenticate, async (req, res) => {
  try {
    console.log('🔍 === BACKEND TRANSCRIPTION DEBUG START ===');
    const { audioData, patientId, audioQuality, audioMetadata } = req.body;
    
    console.log('🔍 Step 1: Request Analysis:', {
      hasAudioData: !!audioData,
      audioDataLength: audioData?.length || 0,
      audioDataSizeKB: audioData ? Math.round(audioData.length / 1024) : 0,
      patientId,
      audioQuality,
      audioMetadata,
      requestBodyKeys: Object.keys(req.body),
      timestamp: new Date().toISOString()
    });
    
    if (!audioData || !patientId) {
      console.error('❌ Missing required fields:', { hasAudioData: !!audioData, hasPatientId: !!patientId });
      return res.status(400).json({
        success: false,
        error: 'Audio data and patient ID are required'
      });
    }

    console.log('🔍 Step 2: Audio Data Validation Passed');

    // Import Google Speech-to-Text
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();

    console.log('🔍 Step 3: Speech Client Initialized');

    // Convert base64 audio data to buffer with detailed validation
    let audioBuffer: Buffer;
    try {
      console.log('🔍 Step 4: Converting base64 to buffer...');
      audioBuffer = Buffer.from(audioData, 'base64');
      
      console.log('🔍 Step 4: Buffer Conversion Success:', {
        bufferLength: audioBuffer.length,
        bufferSizeKB: Math.round(audioBuffer.length / 1024),
        originalBase64Length: audioData.length,
        conversionRatio: Math.round((audioBuffer.length / audioData.length) * 100) / 100
      });
    } catch (conversionError) {
      console.error('❌ Base64 conversion failed:', conversionError);
      return res.status(400).json({
        success: false,
        error: 'Invalid audio data format'
      });
    }

    // Comprehensive audio buffer analysis
    const bufferAnalysis = {
      size: audioBuffer.length,
      sizeKB: Math.round(audioBuffer.length / 1024),
      isAllZeros: audioBuffer.every(byte => byte === 0),
      nonZeroBytes: audioBuffer.filter(byte => byte !== 0).length,
      averageValue: audioBuffer.reduce((sum, byte) => sum + byte, 0) / audioBuffer.length,
      maxValue: Math.max(...audioBuffer),
      minValue: Math.min(...audioBuffer),
      uniqueValues: new Set(audioBuffer).size,
      hasWebmHeader: audioBuffer.slice(0, 4).toString('hex') === '1a45dfa3',
      firstBytes: audioBuffer.slice(0, 20).toString('hex'),
      lastBytes: audioBuffer.slice(-20).toString('hex'),
      estimatedDuration: Math.round(audioBuffer.length / 16000), // Rough estimate
      // Additional quality metrics
      variance: audioBuffer.length > 1 ? audioBuffer.reduce((sum, val, i, arr) => {
        if (i === 0) return 0;
        const diff = val - arr[i-1];
        return sum + (diff * diff);
      }, 0) / (audioBuffer.length - 1) : 0,
      entropy: (() => {
        const freq: { [key: number]: number } = {};
        audioBuffer.forEach(byte => freq[byte] = (freq[byte] || 0) + 1);
        return Object.values(freq).reduce((sum, count) => {
          const p = count / audioBuffer.length;
          return sum - p * Math.log2(p);
        }, 0);
      })()
    };

    console.log('🔍 Step 5: Comprehensive Audio Buffer Analysis:', bufferAnalysis);

    // More lenient audio validation for debugging
    if (bufferAnalysis.isAllZeros) {
      console.warn('⚠️ Audio buffer contains only zeros (complete silence)');
      return res.json({
        success: true,
        data: {
          transcription: '',
          confidence: 0,
          message: 'Audio contains only silence - no speech detected',
          analysis: 'complete_silence',
          debugInfo: bufferAnalysis
        }
      });
    }

    const nonZeroPercentage = (bufferAnalysis.nonZeroBytes / bufferAnalysis.size) * 100;
    console.log('🔍 Step 6: Audio Content Validation:', {
      nonZeroPercentage: Math.round(nonZeroPercentage * 100) / 100,
      uniqueValues: bufferAnalysis.uniqueValues,
      averageValue: Math.round(bufferAnalysis.averageValue * 100) / 100,
      entropy: Math.round(bufferAnalysis.entropy * 100) / 100,
      variance: Math.round(bufferAnalysis.variance * 100) / 100
    });

    // More lenient validation - allow processing even with lower quality for debugging
    if (nonZeroPercentage < 0.5) {  // Only reject if truly empty
      console.warn('⚠️ Audio buffer appears to be mostly silence, but proceeding for debugging');
    }

    if (bufferAnalysis.uniqueValues < 3) {  // Very lenient threshold
      console.warn('⚠️ Audio has very little variation, but proceeding for debugging');
    }

    console.log('🔍 Step 7: Audio validation passed, proceeding to Speech-to-Text...');

    // Simplified Speech-to-Text configuration for better compatibility
    const getOptimalConfig = (quality: string) => {
      // Use basic, proven configuration that works reliably
      return {
        encoding: 'WEBM_OPUS' as const,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'default', // Use default model instead of latest_long
        // Remove complex features that might cause issues
        speechContexts: [{
          phrases: [
            'patient', 'doctor', 'visit', 'medication', 'blood pressure',
            'checkup', 'appointment', 'treatment', 'symptoms', 'diagnosis'
          ],
          boost: 3.0 // Very low boost
        }]
      };
    };

    const config = getOptimalConfig(audioQuality || 'unknown');
    const request = {
      audio: { content: audioBuffer },
      config
    };

    console.log('🔍 Step 8: Speech-to-Text Request Configuration:', {
      encoding: config.encoding,
      sampleRate: config.sampleRateHertz,
      language: config.languageCode,
      model: config.model,
      audioSize: bufferAnalysis.size,
      audioQuality: audioQuality || 'unknown',
      medicalContextEnabled: !!config.speechContexts,
      speechContextPhrases: config.speechContexts?.[0]?.phrases?.length || 0,
      boost: config.speechContexts?.[0]?.boost || 0,
      enableAutomaticPunctuation: config.enableAutomaticPunctuation
    });

    // Perform transcription with detailed retry logic and logging
    let response;
    let retryCount = 0;
    const maxRetries = 2;

    console.log('🔍 Step 9: Starting Speech-to-Text Recognition...');

    while (retryCount <= maxRetries) {
      try {
        console.log(`🔍 Transcription attempt ${retryCount + 1}/${maxRetries + 1}:`, {
          model: request.config.model,
          audioBufferSize: audioBuffer.length,
          timestamp: new Date().toISOString()
        });
        
        const recognitionStartTime = Date.now();
        [response] = await client.recognize(request);
        const recognitionTime = Date.now() - recognitionStartTime;
        
        console.log('🔍 Speech-to-Text API Response Time:', recognitionTime + 'ms');
        break; // Success, exit retry loop
      } catch (speechApiError: any) {
        retryCount++;
        console.error(`❌ Speech-to-Text API error (attempt ${retryCount}):`, {
          message: speechApiError?.message || 'Unknown error',
          code: speechApiError?.code || 'Unknown code',
          details: speechApiError?.details || 'No details',
          stack: speechApiError?.stack || 'No stack'
        });

        if (retryCount > maxRetries) {
          console.log('🔄 All retries failed, trying fallback configuration...');
          
          // Try with very basic configuration
          request.config = {
            encoding: 'WEBM_OPUS' as const,
            sampleRateHertz: 48000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: false,
            model: 'default',
            speechContexts: [{
              phrases: ['patient', 'doctor'],
              boost: 1.0
            }]
          };
          
          try {
            console.log('🔍 Trying basic fallback configuration...');
            [response] = await client.recognize(request);
            console.log('✅ Basic fallback configuration succeeded');
            break;
          } catch (fallbackError) {
            console.error('❌ Basic fallback configuration also failed:', fallbackError);
          }

          return res.status(500).json({
            success: false,
            error: 'Speech-to-Text API error after all retries: ' + (speechApiError?.message || 'Unknown error'),
            details: speechApiError?.code || 'Unknown code',
            retryCount,
            debugInfo: {
              audioSize: audioBuffer.length,
              audioQuality,
              configUsed: request.config
            }
          });
        }

        // Wait before retry
        console.log(`🔍 Waiting ${1000 * retryCount}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    console.log('🔍 Step 10: Speech-to-Text API call completed successfully');

    // Detailed response analysis with comprehensive logging
    const responseAnalysis = {
      resultsCount: response.results?.length || 0,
      hasResults: !!(response.results && response.results.length > 0),
      totalAlternatives: response.results?.reduce((sum: number, result: any) =>
        sum + (result.alternatives?.length || 0), 0) || 0,
      rawResponse: response
    };

    console.log('🔍 Step 11: Detailed Speech-to-Text Response Analysis:', responseAnalysis);

    if (!response.results || response.results.length === 0) {
      console.warn('⚠️ No transcription results from Google Speech-to-Text');
      console.log('🔍 Full API Response for debugging:', JSON.stringify(response, null, 2));

      return res.json({
        success: true,
        data: {
          transcription: '',
          confidence: 0,
          message: 'No speech detected in audio recording',
          analysis: 'no_results',
          debugInfo: {
            bufferAnalysis,
            apiResponse: response,
            configUsed: config
          }
        }
      });
    }

    // Enhanced transcription extraction with detailed logging
    const transcriptionParts: Array<{text: string, confidence: number, resultIndex: number}> = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    console.log('🔍 Step 12: Processing transcription results...');
    
    response.results.forEach((result: any, index: number) => {
      console.log(`🔍 Processing result ${index + 1}:`, {
        hasAlternatives: !!(result.alternatives && result.alternatives.length > 0),
        alternativesCount: result.alternatives?.length || 0,
        isFinal: result.isFinal,
        stability: result.stability,
        languageCode: result.languageCode
      });

      if (result.alternatives && result.alternatives.length > 0) {
        result.alternatives.forEach((alternative: any, altIndex: number) => {
          const confidence = alternative.confidence || 0;
          const transcript = alternative.transcript || '';
          
          console.log(`🔍 Alternative ${altIndex + 1} for result ${index + 1}:`, {
            transcript: `"${transcript}"`,
            transcriptLength: transcript.length,
            confidence: Math.round(confidence * 100) + '%',
            hasWords: !!(alternative.words && alternative.words.length > 0),
            wordCount: alternative.words?.length || 0
          });

          if (altIndex === 0 && transcript && transcript.trim()) { // Only use first alternative
            transcriptionParts.push({
              text: transcript.trim(),
              confidence,
              resultIndex: index
            });
            totalConfidence += confidence;
            confidenceCount++;
          }
        });
      } else {
        console.warn(`⚠️ Result ${index + 1} has no alternatives`);
      }
    });

    console.log('🔍 Step 13: Transcription Parts Analysis:', {
      totalParts: transcriptionParts.length,
      parts: transcriptionParts.map((part, index) => ({
        partIndex: index,
        resultIndex: part.resultIndex,
        text: `"${part.text}"`,
        textLength: part.text.length,
        confidence: Math.round(part.confidence * 100) + '%'
      }))
    });

    const transcription = transcriptionParts.map(part => part.text).join(' ').trim();
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    console.log('🔍 Step 14: Final Transcription Assembly:', {
      individualParts: transcriptionParts.map(p => `"${p.text}"`),
      joinedTranscription: `"${transcription}"`,
      originalLength: transcriptionParts.map(p => p.text).join(' ').length,
      trimmedLength: transcription.length,
      isEmpty: transcription.length === 0,
      averageConfidence: Math.round(averageConfidence * 100) + '%',
      partCount: transcriptionParts.length,
      retryCount
    });

    // Final validation with detailed logging
    if (!transcription || transcription.trim().length === 0) {
      console.warn('⚠️ Empty transcription result despite having API results');
      console.log('🔍 Debug - Raw transcription parts:', transcriptionParts);
      console.log('🔍 Debug - Full API response:', JSON.stringify(response, null, 2));
      
      return res.json({
        success: true,
        data: {
          transcription: '',
          confidence: 0,
          message: 'No recognizable speech detected in audio recording',
          analysis: 'empty_transcription',
          debugInfo: {
            transcriptionParts,
            apiResponse: response,
            bufferAnalysis
          }
        }
      });
    }

    // Success response with comprehensive metadata
    console.log('🔍 Step 15: Transcription Success!', {
      finalTranscription: `"${transcription}"`,
      length: transcription.length,
      confidence: Math.round(averageConfidence * 100) + '%',
      preview: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
      processingTime: Date.now(),
      totalProcessingSteps: 15
    });

    console.log('🔍 === BACKEND TRANSCRIPTION DEBUG END ===');

    res.json({
      success: true,
      data: {
        transcription,
        confidence: averageConfidence,
        metadata: {
          audioAnalysis: bufferAnalysis,
          processingAttempts: retryCount + 1,
          configUsed: config.model,
          partCount: transcriptionParts.length,
          transcriptionParts: transcriptionParts.map(p => ({
            text: p.text,
            confidence: p.confidence,
            length: p.text.length
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ Critical error in audio transcription:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    res.status(500).json({
      success: false,
      error: 'Failed to process audio transcription',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// ===== MEDICATION SAFETY ROUTES =====

// Get medication safety alerts for a patient
app.get('/medications/safety-alerts', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		
		console.log('🛡️ Getting safety alerts for patient:', patientId);
		
		// For now, return empty array since we haven't implemented full safety checking yet
		const alerts: any[] = [];
		
		res.json({
			success: true,
			data: alerts,
			message: 'Safety alerts retrieved successfully'
		});
	} catch (error) {
		console.error('❌ Error getting safety alerts:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Perform safety check for a medication
app.post('/medications/safety-check', authenticate, async (req, res) => {
	try {
		const patientId = (req as any).user.uid;
		const { medicationData, existingMedications } = req.body;
		
		console.log('🛡️ Performing safety check for medication:', medicationData.name);
		
		const safetyAlerts: any[] = [];
		
		// Basic duplicate check
		const duplicates = existingMedications.filter((med: any) =>
			med.name.toLowerCase() === medicationData.name.toLowerCase() ||
			med.genericName?.toLowerCase() === medicationData.genericName?.toLowerCase()
		);
		
		if (duplicates.length > 0) {
			safetyAlerts.push({
				alertType: 'duplicate',
				severity: 'warning',
				title: 'Potential Duplicate Medication',
				description: `${medicationData.name} appears to be similar to existing medications in your list.`,
				affectedMedications: [
					{ medicationId: 'new', medicationName: medicationData.name, role: 'primary' },
					...duplicates.map((med: any) => ({
						medicationId: med.id,
						medicationName: med.name,
						role: 'secondary'
					}))
				],
				recommendations: [
					'Verify this is a different medication or dosage',
					'Consult with your healthcare provider if unsure',
					'Check if this replaces an existing medication'
				],
				source: 'clinical_rules'
			});
		}
		
		res.json({
			success: true,
			data: {
				alerts: safetyAlerts,
				riskLevel: safetyAlerts.length > 0 ? 'medium' : 'low',
				recommendedActions: safetyAlerts.length > 0 ? ['Review alerts before adding medication'] : []
			},
			message: 'Safety check completed'
		});
	} catch (error) {
		console.error('❌ Error performing safety check:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== PRN MEDICATION ROUTES =====

// Get PRN logs for a medication
app.get('/medications/:medicationId/prn-logs', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		const { limit = '50' } = req.query;
		
		console.log('💊 Getting PRN logs for medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		// For now, return empty array since PRN logs collection doesn't exist yet
		const prnLogs: any[] = [];
		
		res.json({
			success: true,
			data: prnLogs,
			message: 'PRN logs retrieved successfully'
		});
	} catch (error) {
		console.error('❌ Error getting PRN logs:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create a new PRN log
app.post('/medications/:medicationId/prn-logs', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		const { takenAt, dosageAmount, reason, painScoreBefore, symptoms, notes } = req.body;
		
		console.log('💊 Creating PRN log for medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		if (!dosageAmount || !reason) {
			return res.status(400).json({
				success: false,
				error: 'Dosage amount and reason are required'
			});
		}
		
		const newPRNLog = {
			medicationId,
			patientId,
			takenAt: admin.firestore.Timestamp.fromDate(new Date(takenAt || new Date())),
			dosageAmount,
			reason,
			painScoreBefore: painScoreBefore || null,
			symptoms: symptoms || [],
			notes: notes?.trim() || null,
			loggedBy: patientId,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		const prnLogRef = await firestore.collection('prn_medication_logs').add(newPRNLog);
		
		console.log('✅ PRN log created successfully:', prnLogRef.id);
		
		res.json({
			success: true,
			data: {
				id: prnLogRef.id,
				...newPRNLog,
				takenAt: newPRNLog.takenAt.toDate(),
				createdAt: newPRNLog.createdAt.toDate(),
				updatedAt: newPRNLog.updatedAt.toDate()
			},
			message: 'PRN log created successfully'
		});
	} catch (error) {
		console.error('❌ Error creating PRN log:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== MEDICATION STATUS MANAGEMENT ROUTES =====

// Hold a medication
app.post('/medications/:medicationId/hold', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		const { reason, holdUntil, autoResumeEnabled, holdInstructions } = req.body;
		
		console.log('⏸️ Holding medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		if (!reason) {
			return res.status(400).json({
				success: false,
				error: 'Reason is required'
			});
		}
		
		// Create status change record
		const statusChange = {
			medicationId,
			patientId,
			changeType: 'hold',
			holdData: {
				reason,
				holdUntil: holdUntil ? admin.firestore.Timestamp.fromDate(new Date(holdUntil)) : null,
				autoResumeEnabled: !!autoResumeEnabled,
				holdInstructions: holdInstructions?.trim() || null
			},
			performedBy: patientId,
			performedAt: admin.firestore.Timestamp.now(),
			notes: `Medication held: ${reason}`
		};
		
		await firestore.collection('medication_status_changes').add(statusChange);
		
		// Pause all active schedules for this medication
		const schedulesQuery = await firestore.collection('medication_schedules')
			.where('medicationId', '==', medicationId)
			.where('isActive', '==', true)
			.get();
		
		const batch = firestore.batch();
		schedulesQuery.docs.forEach(doc => {
			batch.update(doc.ref, {
				isPaused: true,
				pausedUntil: holdUntil ? admin.firestore.Timestamp.fromDate(new Date(holdUntil)) : null,
				updatedAt: admin.firestore.Timestamp.now()
			});
		});
		await batch.commit();
		
		console.log('✅ Medication held successfully:', medicationId);
		
		res.json({
			success: true,
			message: 'Medication held successfully'
		});
	} catch (error) {
		console.error('❌ Error holding medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Resume a held medication
app.post('/medications/:medicationId/resume', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		
		console.log('▶️ Resuming medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		// Create status change record
		const statusChange = {
			medicationId,
			patientId,
			changeType: 'resume',
			performedBy: patientId,
			performedAt: admin.firestore.Timestamp.now(),
			notes: 'Medication resumed'
		};
		
		await firestore.collection('medication_status_changes').add(statusChange);
		
		// Resume all paused schedules for this medication
		const schedulesQuery = await firestore.collection('medication_schedules')
			.where('medicationId', '==', medicationId)
			.where('isPaused', '==', true)
			.get();
		
		const batch = firestore.batch();
		schedulesQuery.docs.forEach(doc => {
			batch.update(doc.ref, {
				isPaused: false,
				pausedUntil: null,
				updatedAt: admin.firestore.Timestamp.now()
			});
		});
		await batch.commit();
		
		console.log('✅ Medication resumed successfully:', medicationId);
		
		res.json({
			success: true,
			message: 'Medication resumed successfully'
		});
	} catch (error) {
		console.error('❌ Error resuming medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Discontinue a medication
app.post('/medications/:medicationId/discontinue', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		const { reason, stopDate, followUpRequired, followUpInstructions } = req.body;
		
		console.log('🛑 Discontinuing medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		if (!reason) {
			return res.status(400).json({
				success: false,
				error: 'Reason is required'
			});
		}
		
		// Create status change record
		const statusChange = {
			medicationId,
			patientId,
			changeType: 'discontinue',
			discontinueData: {
				reason,
				stopDate: admin.firestore.Timestamp.fromDate(new Date(stopDate || new Date())),
				followUpRequired: !!followUpRequired,
				followUpInstructions: followUpInstructions?.trim() || null
			},
			performedBy: patientId,
			performedAt: admin.firestore.Timestamp.now(),
			notes: `Medication discontinued: ${reason}`
		};
		
		await firestore.collection('medication_status_changes').add(statusChange);
		
		// Update medication status
		await medicationDoc.ref.update({
			isActive: false,
			endDate: admin.firestore.Timestamp.fromDate(new Date(stopDate || new Date())),
			updatedAt: admin.firestore.Timestamp.now()
		});
		
		// Deactivate all schedules for this medication
		const schedulesQuery = await firestore.collection('medication_schedules')
			.where('medicationId', '==', medicationId)
			.where('isActive', '==', true)
			.get();
		
		const batch = firestore.batch();
		schedulesQuery.docs.forEach(doc => {
			batch.update(doc.ref, {
				isActive: false,
				endDate: admin.firestore.Timestamp.fromDate(new Date(stopDate || new Date())),
				updatedAt: admin.firestore.Timestamp.now()
			});
		});
		await batch.commit();
		
		console.log('✅ Medication discontinued successfully:', medicationId);
		
		res.json({
			success: true,
			message: 'Medication discontinued successfully'
		});
	} catch (error) {
		console.error('❌ Error discontinuing medication:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Get PRN logs for a medication
app.get('/medications/:medicationId/prn-logs', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		
		console.log('💊 Getting PRN logs for medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		// For now, return empty array since PRN logs collection doesn't exist yet
		const prnLogs: any[] = [];
		
		res.json({
			success: true,
			data: prnLogs,
			message: 'PRN logs retrieved successfully'
		});
	} catch (error) {
		console.error('❌ Error getting PRN logs:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// Create a new PRN log
app.post('/medications/:medicationId/prn-logs', authenticate, async (req, res) => {
	try {
		const { medicationId } = req.params;
		const patientId = (req as any).user.uid;
		const { takenAt, dosageAmount, reason, painScoreBefore, symptoms, notes } = req.body;
		
		console.log('💊 Creating PRN log for medication:', medicationId);
		
		// Verify medication exists and user has access
		const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
		if (!medicationDoc.exists) {
			return res.status(404).json({
				success: false,
				error: 'Medication not found'
			});
		}
		
		const medicationData = medicationDoc.data();
		if (medicationData?.patientId !== patientId) {
			return res.status(403).json({
				success: false,
				error: 'Access denied'
			});
		}
		
		if (!dosageAmount || !reason) {
			return res.status(400).json({
				success: false,
				error: 'Dosage amount and reason are required'
			});
		}
		
		const newPRNLog = {
			medicationId,
			patientId,
			takenAt: admin.firestore.Timestamp.fromDate(new Date(takenAt || new Date())),
			dosageAmount,
			reason,
			painScoreBefore: painScoreBefore || null,
			symptoms: symptoms || [],
			notes: notes?.trim() || null,
			loggedBy: patientId,
			createdAt: admin.firestore.Timestamp.now(),
			updatedAt: admin.firestore.Timestamp.now()
		};
		
		const prnLogRef = await firestore.collection('prn_medication_logs').add(newPRNLog);
		
		console.log('✅ PRN log created successfully:', prnLogRef.id);
		
		res.json({
			success: true,
			data: {
				id: prnLogRef.id,
				...newPRNLog,
				takenAt: newPRNLog.takenAt.toDate(),
				createdAt: newPRNLog.createdAt.toDate(),
				updatedAt: newPRNLog.updatedAt.toDate()
			},
			message: 'PRN log created successfully'
		});
	} catch (error) {
		console.error('❌ Error creating PRN log:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

// ===== GRACE PERIOD MANAGEMENT API ENDPOINTS =====

// Get patient grace period configuration
app.get('/patients/grace-periods', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    
    const gracePeriodEngine = new GracePeriodEngine();
    
    // Try to get existing configuration
    const configDoc = await firestore.collection('medication_grace_periods').doc(patientId).get();
    
    if (!configDoc.exists) {
      // Create and return default configuration
      await gracePeriodEngine.createDefaultGracePeriodConfig(patientId);
      
      const newConfigDoc = await firestore.collection('medication_grace_periods').doc(patientId).get();
      const newConfig = newConfigDoc.data();
      
      return res.json({
        success: true,
        data: {
          id: patientId,
          ...newConfig,
          createdAt: newConfig?.createdAt?.toDate(),
          updatedAt: newConfig?.updatedAt?.toDate()
        },
        message: 'Default grace period configuration created'
      });
    }
    
    const config = configDoc.data();
    res.json({
      success: true,
      data: {
        id: configDoc.id,
        ...config,
        createdAt: config?.createdAt?.toDate(),
        updatedAt: config?.updatedAt?.toDate()
      }
    });
    
  } catch (error) {
    console.error('Error getting grace period configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update patient grace period configuration
app.put('/patients/grace-periods', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    const updateData = req.body;
    
    const gracePeriodEngine = new GracePeriodEngine();
    
    // Validate grace period values
    const validation = gracePeriodEngine.validateGracePeriodConfig(updateData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid grace period configuration',
        details: validation.errors
      });
    }
    
    await gracePeriodEngine.updatePatientGraceConfig(patientId, updateData);
    
    // Get updated configuration
    const updatedDoc = await firestore.collection('medication_grace_periods').doc(patientId).get();
    const updatedData = updatedDoc.data();
    
    res.json({
      success: true,
      data: {
        id: patientId,
        ...updatedData,
        createdAt: updatedData?.createdAt?.toDate(),
        updatedAt: updatedData?.updatedAt?.toDate()
      },
      message: 'Grace period configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating grace period configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get missed medications for a patient
app.get('/medication-calendar/missed', authenticate, async (req, res) => {
  try {
    const currentUserId = (req as any).user.uid;
    const { patientId, limit = '50', startDate, endDate } = req.query;
    
    // Determine target patient
    const targetPatientId = patientId as string || currentUserId;
    
    // Check access permissions
    if (targetPatientId !== currentUserId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', currentUserId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    const detector = new MissedMedicationDetector();
    const startDateObj = startDate ? new Date(startDate as string) : undefined;
    const endDateObj = endDate ? new Date(endDate as string) : undefined;
    
    const missedMedications = await detector.getMissedMedications(
      targetPatientId,
      startDateObj,
      endDateObj,
      parseInt(limit as string, 10)
    );
    
    res.json({
      success: true,
      data: missedMedications,
      message: `Found ${missedMedications.length} missed medications`
    });
    
  } catch (error) {
    console.error('Error getting missed medications:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Manual missed detection trigger
app.post('/medication-calendar/detect-missed', authenticate, async (req, res) => {
  try {
    const patientId = (req as any).user.uid;
    
    const detector = new MissedMedicationDetector();
    const results = await detector.detectMissedMedicationsForPatient(patientId);
    
    res.json({
      success: true,
      data: results,
      message: `Detected ${results.missed} missed medications`
    });
    
  } catch (error) {
    console.error('Error in manual missed detection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Mark medication as missed manually
app.post('/medication-calendar/events/:eventId/mark-missed', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).user.uid;
    const { reason = 'manual_mark' } = req.body;
    
    const detector = new MissedMedicationDetector();
    const result = await detector.markEventAsMissed(eventId, userId, reason);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Medication marked as missed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('Error marking medication as missed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get missed medication statistics
app.get('/medication-calendar/missed-stats', authenticate, async (req, res) => {
  try {
    const currentUserId = (req as any).user.uid;
    const { patientId, days = '30' } = req.query;
    
    // Determine target patient
    const targetPatientId = patientId as string || currentUserId;
    
    // Check access permissions
    if (targetPatientId !== currentUserId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', currentUserId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    const detector = new MissedMedicationDetector();
    const stats = await detector.getMissedMedicationStats(
      targetPatientId,
      parseInt(days as string, 10)
    );
    
    res.json({
      success: true,
      data: stats,
      message: 'Missed medication statistics retrieved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error getting missed medication statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      endpoint: 'missed-stats',
      timestamp: new Date().toISOString()
    });
  }
});

// Check for missing medication calendar events (MISSING ENDPOINT FIX)
app.get('/medication-calendar/check-missing-events', authenticate, async (req, res) => {
  try {
    console.log('🔍 === CHECK MISSING EVENTS ENDPOINT START ===');
    const currentUserId = (req as any).user.uid;
    const { patientId, startDate, endDate, autoFix = 'false' } = req.query;
    
    // Determine target patient
    const targetPatientId = patientId as string || currentUserId;
    
    console.log('🔍 Checking missing events for patient:', targetPatientId, 'requested by:', currentUserId);
    
    // Check access permissions
    if (targetPatientId !== currentUserId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', currentUserId)
        .where('patientId', '==', targetPatientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        console.log('❌ Access denied for user:', currentUserId, 'to patient:', targetPatientId);
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    // Set date range (default to last 7 days and next 30 days)
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 7);
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 30);
    
    const queryStartDate = startDate ? new Date(startDate as string) : defaultStartDate;
    const queryEndDate = endDate ? new Date(endDate as string) : defaultEndDate;
    
    console.log('📅 Date range for missing events check:', {
      startDate: queryStartDate.toISOString(),
      endDate: queryEndDate.toISOString()
    });
    
    // Get all active medication schedules for the patient
    const schedulesQuery = await firestore.collection('medication_schedules')
      .where('patientId', '==', targetPatientId)
      .where('isActive', '==', true)
      .where('isPaused', '==', false)
      .get();
    
    const schedules = schedulesQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        medicationId: data.medicationId,
        medicationName: data.medicationName,
        patientId: data.patientId,
        frequency: data.frequency,
        times: data.times,
        daysOfWeek: data.daysOfWeek,
        dayOfMonth: data.dayOfMonth,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive,
        isPaused: data.isPaused,
        dosageAmount: data.dosageAmount,
        instructions: data.instructions,
        reminderMinutesBefore: data.reminderMinutesBefore,
        ...data
      };
    });
    
    console.log('📊 Found', schedules.length, 'active medication schedules');
    
    const missingEventsReport = {
      schedulesChecked: schedules.length,
      missingEventsBySchedule: [] as any[],
      totalMissingEvents: 0,
      eventsGenerated: 0,
      errors: [] as string[],
      dateRange: {
        startDate: queryStartDate,
        endDate: queryEndDate
      }
    };
    
    // Check each schedule for missing events
    for (const schedule of schedules) {
      try {
        console.log('🔍 Checking schedule:', schedule.id, 'for medication:', schedule.medicationName);
        
        // Get existing events for this schedule in the date range
        const existingEventsQuery = await firestore.collection('medication_calendar_events')
          .where('medicationScheduleId', '==', schedule.id)
          .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(queryStartDate))
          .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(queryEndDate))
          .get();
        
        const existingEvents = existingEventsQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          scheduledDateTime: doc.data().scheduledDateTime?.toDate()
        }));
        
        console.log('📅 Found', existingEvents.length, 'existing events for schedule:', schedule.id);
        
        // Calculate expected events based on schedule frequency
        const expectedEvents = calculateExpectedEvents(schedule, queryStartDate, queryEndDate);
        const missingEvents = findMissingEvents(expectedEvents, existingEvents);
        
        if (missingEvents.length > 0) {
          console.log('⚠️ Found', missingEvents.length, 'missing events for schedule:', schedule.id);
          
          const scheduleReport = {
            scheduleId: schedule.id,
            medicationId: schedule.medicationId,
            medicationName: schedule.medicationName,
            frequency: schedule.frequency,
            expectedEvents: expectedEvents.length,
            existingEvents: existingEvents.length,
            missingEvents: missingEvents.length,
            missingEventDetails: missingEvents.map(event => ({
              scheduledDateTime: event.scheduledDateTime,
              dosageAmount: event.dosageAmount,
              reason: 'missing_from_calendar'
            }))
          };
          
          missingEventsReport.missingEventsBySchedule.push(scheduleReport);
          missingEventsReport.totalMissingEvents += missingEvents.length;
          
          // Auto-generate missing events if requested
          if (autoFix === 'true') {
            try {
              console.log('🔧 Auto-generating', missingEvents.length, 'missing events for schedule:', schedule.id);
              
              const batch = firestore.batch();
              missingEvents.forEach(event => {
                const eventRef = firestore.collection('medication_calendar_events').doc();
                batch.set(eventRef, {
                  ...event,
                  createdAt: admin.firestore.Timestamp.now(),
                  updatedAt: admin.firestore.Timestamp.now(),
                  autoGenerated: true,
                  autoGeneratedReason: 'missing_events_check'
                });
              });
              
              await batch.commit();
              missingEventsReport.eventsGenerated += missingEvents.length;
              console.log('✅ Auto-generated', missingEvents.length, 'missing events');
              
            } catch (generateError) {
              console.error('❌ Error auto-generating events:', generateError);
              missingEventsReport.errors.push(`Failed to generate events for ${schedule.medicationName}: ${generateError instanceof Error ? generateError.message : 'Unknown error'}`);
            }
          }
        }
        
      } catch (scheduleError) {
        console.error('❌ Error checking schedule:', schedule.id, scheduleError);
        missingEventsReport.errors.push(`Error checking schedule ${schedule.medicationName}: ${scheduleError instanceof Error ? scheduleError.message : 'Unknown error'}`);
      }
    }
    
    console.log('✅ Missing events check completed:', {
      totalMissing: missingEventsReport.totalMissingEvents,
      schedulesWithMissing: missingEventsReport.missingEventsBySchedule.length,
      eventsGenerated: missingEventsReport.eventsGenerated,
      errors: missingEventsReport.errors.length
    });
    
    res.json({
      success: true,
      data: missingEventsReport,
      message: `Found ${missingEventsReport.totalMissingEvents} missing events across ${missingEventsReport.missingEventsBySchedule.length} schedules`
    });
    
  } catch (error) {
    console.error('❌ Error in check missing events:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      endpoint: 'check-missing-events',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to calculate expected events for a schedule
function calculateExpectedEvents(schedule: any, startDate: Date, endDate: Date): any[] {
  const events = [];
  const currentDate = new Date(Math.max(startDate.getTime(), schedule.startDate?.toDate?.()?.getTime() || startDate.getTime()));
  const scheduleEndDate = schedule.endDate?.toDate?.() || endDate;
  const actualEndDate = new Date(Math.min(endDate.getTime(), scheduleEndDate.getTime()));
  
  while (currentDate <= actualEndDate) {
    let shouldCreateEvent = false;
    
    // Check if we should create an event for this date based on frequency
    switch (schedule.frequency) {
      case 'daily':
      case 'once_daily':
      case 'twice_daily':
      case 'three_times_daily':
      case 'four_times_daily':
        shouldCreateEvent = true;
        break;
      case 'weekly':
        if (schedule.daysOfWeek && schedule.daysOfWeek.includes(currentDate.getDay())) {
          shouldCreateEvent = true;
        }
        break;
      case 'monthly':
        if (currentDate.getDate() === (schedule.dayOfMonth || 1)) {
          shouldCreateEvent = true;
        }
        break;
      case 'as_needed':
        // Don't generate automatic events for PRN medications
        shouldCreateEvent = false;
        break;
    }
    
    if (shouldCreateEvent && schedule.times) {
      // Create events for each time in the schedule
      for (const time of schedule.times) {
        const [hours, minutes] = time.split(':').map(Number);
        const eventDateTime = new Date(currentDate);
        eventDateTime.setHours(hours, minutes, 0, 0);
        
        // Only include events within our date range
        if (eventDateTime >= startDate && eventDateTime <= endDate) {
          events.push({
            medicationScheduleId: schedule.id,
            medicationId: schedule.medicationId,
            medicationName: schedule.medicationName,
            patientId: schedule.patientId,
            scheduledDateTime: admin.firestore.Timestamp.fromDate(eventDateTime),
            dosageAmount: schedule.dosageAmount,
            instructions: schedule.instructions || '',
            status: 'scheduled',
            reminderMinutesBefore: schedule.reminderMinutesBefore || [15, 5],
            isRecurring: true,
            eventType: 'medication'
          });
        }
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return events;
}

// Helper function to find missing events by comparing expected vs existing
function findMissingEvents(expectedEvents: any[], existingEvents: any[]): any[] {
  const existingTimes = new Set();
  existingEvents.forEach(event => {
    if (event.scheduledDateTime) {
      existingTimes.add(event.scheduledDateTime.toISOString());
    }
  });
  
  return expectedEvents.filter(expectedEvent => {
    const expectedTimeISO = expectedEvent.scheduledDateTime.toDate().toISOString();
    return !existingTimes.has(expectedTimeISO);
  });
}

// ===== DRUG SAFETY API ENDPOINTS =====

// Get patient safety profile
app.get('/patients/:patientId/safety-profile', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).user.uid;

    console.log('🛡️ Getting safety profile for patient:', patientId, 'requested by:', userId);

    // Verify access to patient
    if (patientId !== userId) {
      // Check family access
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to patient data'
        });
      }
    }

    // Get patient safety profile from Firestore
    const safetyProfileRef = firestore.collection('patient_safety_profiles').doc(patientId);
    const safetyProfileDoc = await safetyProfileRef.get();

    if (!safetyProfileDoc.exists) {
      // Create default safety profile if none exists
      const defaultProfile = {
        id: patientId,
        patientId: patientId,
        allergies: [],
        contraindications: [],
        medicalConditions: [],
        riskFactors: [],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      await safetyProfileRef.set(defaultProfile);
      
      console.log('✅ Created default safety profile for patient:', patientId);
      
      return res.json({
        success: true,
        data: {
          ...defaultProfile,
          createdAt: defaultProfile.createdAt.toDate(),
          updatedAt: defaultProfile.updatedAt.toDate()
        }
      });
    }

    const safetyProfileData = safetyProfileDoc.data();
    const safetyProfile = {
      id: safetyProfileDoc.id,
      ...safetyProfileData,
      createdAt: safetyProfileData?.createdAt?.toDate(),
      updatedAt: safetyProfileData?.updatedAt?.toDate()
    };

    console.log('✅ Retrieved safety profile for patient:', patientId);

    res.json({
      success: true,
      data: safetyProfile
    });

  } catch (error) {
    console.error('❌ Error fetching patient safety profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient safety profile'
    });
  }
});

// Update patient safety profile
app.put('/patients/:patientId/safety-profile', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).user.uid;
    const updates = req.body;

    console.log('🛡️ Updating safety profile for patient:', patientId, 'by user:', userId);

    // Verify access to patient
    if (patientId !== userId) {
      // Check family access with edit permissions
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to patient data'
        });
      }
      
      const accessData = familyAccess.docs[0].data();
      if (!accessData.permissions?.canEdit) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to edit safety profile'
        });
      }
    }

    // Validate required fields
    if (!updates.allergies && !updates.contraindications && !updates.medicalConditions && !updates.riskFactors) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided for update'
      });
    }

    // Update safety profile
    const safetyProfileRef = firestore.collection('patient_safety_profiles').doc(patientId);
    const updateData = {
      ...updates,
      patientId,
      updatedAt: admin.firestore.Timestamp.now()
    };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.createdAt;

    await safetyProfileRef.set(updateData, { merge: true });

    // Get updated profile
    const updatedDoc = await safetyProfileRef.get();
    const updatedProfileData = updatedDoc.data();
    const updatedProfile = {
      id: updatedDoc.id,
      ...updatedProfileData,
      createdAt: updatedProfileData?.createdAt?.toDate(),
      updatedAt: updatedProfileData?.updatedAt?.toDate()
    };

    console.log('✅ Updated safety profile for patient:', patientId);

    res.json({
      success: true,
      data: updatedProfile
    });

  } catch (error) {
    console.error('❌ Error updating patient safety profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update patient safety profile'
    });
  }
});

// Analyze medication list for safety issues
app.post('/patients/:patientId/medications/safety-analysis', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { medicationIds } = req.body;
    const userId = (req as any).user.uid;

    console.log('🛡️ Performing safety analysis for patient:', patientId, 'medications:', medicationIds?.length);

    // Verify access to patient
    if (patientId !== userId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to patient data'
        });
      }
    }

    if (!medicationIds || !Array.isArray(medicationIds)) {
      return res.status(400).json({
        success: false,
        error: 'medicationIds array is required'
      });
    }

    // Get medications
    const medicationPromises = medicationIds.map(id =>
      firestore.collection('medications').doc(id).get()
    );
    const medicationDocs = await Promise.all(medicationPromises);
    
    const medications = medicationDocs
      .filter(doc => doc.exists)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    // Get patient safety profile
    const safetyProfileRef = firestore.collection('patient_safety_profiles').doc(patientId);
    const safetyProfileDoc = await safetyProfileRef.get();
    const safetyProfile = safetyProfileDoc.exists ? safetyProfileDoc.data() : null;

    // Perform safety analysis
    const analysisResults = {
      interactions: [],
      allergyConflicts: [],
      contraindications: [],
      duplicateTherapy: [],
      timingSeparation: [],
      totalIssues: 0,
      riskLevel: 'low'
    };

    // Drug-drug interaction analysis (simplified)
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        // Check for known interactions
        const interaction = checkDrugInteraction(med1, med2);
        if (interaction) {
          (analysisResults.interactions as any[]).push(interaction);
        }
      }
    }

    // Allergy conflict analysis
    if (safetyProfile?.allergies) {
      for (const medication of medications) {
        for (const allergy of safetyProfile.allergies) {
          if (isAllergyConflict(medication, allergy)) {
            (analysisResults.allergyConflicts as any[]).push({
              medicationId: medication.id,
              medicationName: (medication as any).name || 'Unknown Medication',
              allergen: allergy.allergen,
              severity: allergy.severity,
              symptoms: allergy.symptoms
            });
          }
        }
      }
    }

    // Contraindication analysis
    if (safetyProfile?.contraindications) {
      for (const medication of medications) {
        for (const contraindication of safetyProfile.contraindications) {
          if (isContraindicated(medication, contraindication)) {
            (analysisResults.contraindications as any[]).push({
              medicationId: medication.id,
              medicationName: (medication as any).name || 'Unknown Medication',
              reason: contraindication.reason,
              source: contraindication.source
            });
          }
        }
      }
    }

    // Calculate total issues and risk level
    analysisResults.totalIssues =
      analysisResults.interactions.length +
      analysisResults.allergyConflicts.length +
      analysisResults.contraindications.length +
      analysisResults.duplicateTherapy.length +
      analysisResults.timingSeparation.length;

    // Determine risk level
    if (analysisResults.allergyConflicts.length > 0 || analysisResults.contraindications.length > 0) {
      analysisResults.riskLevel = 'high';
    } else if (analysisResults.interactions.length > 2 || analysisResults.totalIssues > 3) {
      analysisResults.riskLevel = 'medium';
    } else if (analysisResults.totalIssues > 0) {
      analysisResults.riskLevel = 'low';
    }

    console.log('✅ Safety analysis completed:', {
      totalIssues: analysisResults.totalIssues,
      riskLevel: analysisResults.riskLevel,
      interactions: analysisResults.interactions.length,
      allergyConflicts: analysisResults.allergyConflicts.length
    });

    res.json({
      success: true,
      data: analysisResults
    });

  } catch (error) {
    console.error('❌ Error performing safety analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform medication safety analysis'
    });
  }
});

// Helper functions for drug safety analysis
function checkDrugInteraction(med1: any, med2: any): any {
  // Simplified interaction checking logic
  const knownInteractions = [
    {
      drug1: 'warfarin',
      drug2: 'aspirin',
      severity: 'major',
      description: 'Increased risk of bleeding',
      management: 'Monitor INR closely'
    },
    {
      drug1: 'levothyroxine',
      drug2: 'calcium',
      severity: 'moderate',
      description: 'Reduced thyroid hormone absorption',
      management: 'Separate by 4 hours'
    },
    {
      drug1: 'metformin',
      drug2: 'alcohol',
      severity: 'moderate',
      description: 'Increased risk of lactic acidosis',
      management: 'Limit alcohol consumption'
    }
  ];

  for (const interaction of knownInteractions) {
    const med1Name = (med1 as any).name?.toLowerCase() || '';
    const med2Name = (med2 as any).name?.toLowerCase() || '';
    
    if ((med1Name.includes(interaction.drug1) && med2Name.includes(interaction.drug2)) ||
        (med1Name.includes(interaction.drug2) && med2Name.includes(interaction.drug1))) {
      return {
        medication1: (med1 as any).name || 'Unknown',
        medication2: (med2 as any).name || 'Unknown',
        severity: interaction.severity,
        description: interaction.description,
        management: interaction.management,
        source: 'clinical_rules'
      };
    }
  }

  return null;
}

function isAllergyConflict(medication: any, allergy: any): boolean {
  const medName = (medication as any).name?.toLowerCase() || '';
  const allergen = allergy.allergen?.toLowerCase() || '';
  
  return medName.includes(allergen) ||
         ((medication as any).genericName && (medication as any).genericName.toLowerCase().includes(allergen)) ||
         ((medication as any).brandName && (medication as any).brandName.toLowerCase().includes(allergen));
}

function isContraindicated(medication: any, contraindication: any): boolean {
  const medName = (medication as any).name?.toLowerCase() || '';
  const contraindicatedMed = contraindication.medication?.toLowerCase() || '';
  
  return medName.includes(contraindicatedMed) || contraindicatedMed.includes(medName);
}

// ===== UNIFIED MEDICATION POC ENDPOINTS =====

// Import POC migration functions
import { migrateMedicationToPOC, readUnifiedMedicationPOC, compareReadPerformance } from './migrations/unifiedMedicationPOC';

// POC: Migrate a single medication to unified model
app.post('/medications/poc/migrate/:medicationId', authenticate, async (req, res) => {
  try {
    const { medicationId } = req.params;
    const userId = (req as any).user.uid;
    
    console.log('🔄 POC Migration requested for medication:', medicationId, 'by user:', userId);
    
    // Verify medication exists and user has access
    const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
    
    if (!medicationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }
    
    const medicationData = medicationDoc.data();
    
    // Check access permissions
    if (medicationData?.patientId !== userId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', medicationData?.patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    // Perform migration
    const migrationResult = await migrateMedicationToPOC(medicationId);
    
    if (!migrationResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Migration failed',
        details: migrationResult.errors
      });
    }
    
    console.log('✅ POC migration completed successfully');
    
    res.json({
      success: true,
      data: migrationResult,
      message: 'Medication migrated to unified POC model successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in POC migration endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POC: Read unified medication (demonstrates single-read efficiency)
app.get('/medications/poc/:medicationId', authenticate, async (req, res) => {
  try {
    const { medicationId } = req.params;
    const userId = (req as any).user.uid;
    
    console.log('📖 POC Read requested for medication:', medicationId, 'by user:', userId);
    
    // Read from unified POC collection
    const unifiedMedication = await readUnifiedMedicationPOC(medicationId);
    
    if (!unifiedMedication) {
      return res.status(404).json({
        success: false,
        error: 'Unified medication not found in POC collection',
        hint: 'Use POST /medications/poc/migrate/:medicationId to migrate this medication first'
      });
    }
    
    // Check access permissions
    if (unifiedMedication.patientId !== userId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', unifiedMedication.patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    console.log('✅ POC read completed successfully');
    
    res.json({
      success: true,
      data: unifiedMedication,
      message: 'Unified medication retrieved successfully (single read operation)'
    });
    
  } catch (error) {
    console.error('❌ Error in POC read endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POC: Compare read performance (old vs new approach)
app.get('/medications/poc/:medicationId/performance', authenticate, async (req, res) => {
  try {
    const { medicationId } = req.params;
    const userId = (req as any).user.uid;
    
    console.log('⚡ POC Performance comparison requested for medication:', medicationId);
    
    // Verify access
    const medicationDoc = await firestore.collection('medications').doc(medicationId).get();
    
    if (!medicationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }
    
    const medicationData = medicationDoc.data();
    
    if (medicationData?.patientId !== userId) {
      const familyAccess = await firestore.collection('family_calendar_access')
        .where('familyMemberId', '==', userId)
        .where('patientId', '==', medicationData?.patientId)
        .where('status', '==', 'active')
        .get();
      
      if (familyAccess.empty) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }
    
    // Run performance comparison
    const performanceResult = await compareReadPerformance(medicationId);
    
    console.log('✅ Performance comparison completed');
    
    res.json({
      success: true,
      data: performanceResult,
      message: 'Performance comparison completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in POC performance comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced error handling middleware with comprehensive logging
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ === UNHANDLED ERROR CAUGHT ===');
  console.error('❌ Unhandled error:', err);
  console.error('❌ Comprehensive error context:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    requestPath: req.path,
    requestMethod: req.method,
    requestBody: req.body,
    requestQuery: req.query,
    requestParams: req.params,
    userId: (req as any)?.user?.uid || 'Unknown',
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
    errorCode: (err as any)?.code || 'UNHANDLED_ERROR'
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message,
    errorCode: 'UNHANDLED_ERROR',
    timestamp: new Date().toISOString()
  });
});

// ===== NIGHT SHIFT TIME CONFIGURATION MIGRATION ENDPOINT =====

// Import migration functions
import {
  fixNightShiftDefaults,
  rollbackNightShiftFix,
  getMigrationStatus as getNightShiftMigrationStatus,
  generateMigrationReport
} from './migrations/fixNightShiftDefaults';

// Run night shift time configuration migration
app.post('/migrations/fix-night-shift-defaults', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { dryRun = true } = req.body;
    
    console.log('🔧 Night shift migration requested by:', userId, 'dryRun:', dryRun);
    
    // Run migration
    const migrationResult = await fixNightShiftDefaults(dryRun, userId);
    
    // Generate report
    const report = generateMigrationReport(migrationResult);
    
    res.json({
      success: migrationResult.success,
      data: migrationResult,
      report,
      message: dryRun 
        ? `DRY RUN: Found ${migrationResult.patientsNeedingFix} patients needing fixes`
        : `Migration completed: ${migrationResult.patientsFixed} patients fixed`
    });
    
  } catch (error) {
    console.error('❌ Error in migration endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Rollback night shift migration
app.post('/migrations/rollback-night-shift-fix', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const { backupId } = req.body;
    
    if (!backupId) {
      return res.status(400).json({
        success: false,
        error: 'Backup ID is required'
      });
    }
    
    console.log('🔄 Rollback requested by:', userId, 'backupId:', backupId);
    
    const rollbackResult = await rollbackNightShiftFix(backupId);
    
    res.json({
      success: rollbackResult.success,
      data: rollbackResult,
      message: `Rollback completed: ${rollbackResult.patientsRestored} patients restored`
    });
    
  } catch (error) {
    console.error('❌ Error in rollback endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get migration status
app.get('/migrations/night-shift-status', authenticate, async (req, res) => {
  try {
    const status = await getNightShiftMigrationStatus();
    
    res.json({
      success: true,
      data: status,
      message: status.hasBeenRun
        ? `Migration has been run: ${status.totalFixed} patients fixed`
        : 'Migration has not been run yet'
    });
    
  } catch (error) {
    console.error('❌ Error getting migration status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== UNIFIED MEDICATION API INTEGRATION =====

// Mount unified medication API with authentication middleware
app.use('/unified-medication', authenticate, unifiedMedicationApi);

// Mount notification preferences API with authentication middleware
app.use('/notification-preferences', authenticate, notificationPreferencesApi);

// Mount family adherence notifications API with authentication middleware
app.use('/api', authenticate, familyAdherenceNotificationsApi);

// Mount medication calendar sync API with authentication middleware
app.use('/medication-calendar-sync', authenticate, medicationCalendarSyncApi);

// Backward compatibility routes (redirect to unified API) with authentication
app.use('/medication-commands', authenticate, (req, res, next) => {
  console.log('🔄 Redirecting legacy /medication-commands to unified API');
  req.url = `/unified-medication${req.url}`;
  unifiedMedicationApi(req, res, next);
});

app.use('/medication-events', authenticate, (req, res, next) => {
  console.log('🔄 Redirecting legacy /medication-events to unified API');
  req.url = `/unified-medication${req.url}`;
  unifiedMedicationApi(req, res, next);
});

app.use('/medication-views', authenticate, (req, res, next) => {
  console.log('🔄 Redirecting legacy /medication-views to unified API');
  req.url = `/unified-medication${req.url}`;
  unifiedMedicationApi(req, res, next);
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

// ===== MISSED MEDICATION DETECTION SCHEDULED FUNCTION =====

// Import the missed medication detector
import { MissedMedicationDetector } from './services/missedMedicationDetector';
import { GracePeriodEngine } from './services/gracePeriodEngine';

// Scheduled function to detect missed medications (runs every 15 minutes)
export const detectMissedMedications = functions
  .runWith({
    memory: '256MB',
    timeoutSeconds: 540, // 9 minutes
  })
  .pubsub.schedule('every 15 minutes')
  .onRun(async (context) => {
    console.log('🔍 Starting scheduled missed medication detection...');
    
    try {
      const detector = new MissedMedicationDetector();
      const results = await detector.detectMissedMedications();
      
      console.log('✅ Missed medication detection completed:', {
        processed: results.processed,
        missed: results.missed,
        errors: results.errors.length,
        timestamp: results.detectionTime.toISOString()
      });
      
      // Log metrics for monitoring
      if (results.errors.length > 0) {
        console.error('❌ Missed detection errors:', results.errors);
      }
      
      // Log summary for monitoring dashboard
      if (results.missed > 0) {
        console.log(`📊 Missed medications by patient:`,
          results.batchResults?.reduce((acc: any, result) => {
            acc[result.patientId] = (acc[result.patientId] || 0) + 1;
            return acc;
          }, {})
        );
      }
      
      return results;
    } catch (error) {
      console.error('❌ Fatal error in missed medication detection:', error);
      return {
        processed: 0,
        missed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        detectionTime: new Date()
      };
    }
  });


// Export new visit recording functions
export { processVisitUpload } from './visitUploadTrigger';
export { transcribeAudio } from './workers/speechToTextWorker';
export { summarizeVisit } from './workers/aiSummarizationWorker';

// Export daily medication reset scheduled function
export { scheduledMedicationDailyReset } from './scheduledMedicationDailyReset';

// Export unified medication missed detection scheduled function
export { scheduledMissedDetection } from './scheduledMissedDetection';

// Export scheduled medication reminders function
export { scheduledMedicationReminders } from './scheduledMedicationReminders';

// Export scheduled adherence summary functions
export {
  scheduledWeeklyAdherenceSummaries,
  scheduledMonthlyAdherenceSummaries,
  scheduledAdherencePatternDetection
} from './scheduledAdherenceSummaries';
