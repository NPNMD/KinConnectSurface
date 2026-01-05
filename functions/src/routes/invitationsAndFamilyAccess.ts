import express from 'express';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import sgMail from '@sendgrid/mail';
import { authenticate } from '../middleware';
import { SENDGRID_FROM_EMAIL, APP_URL, ACCESS_LEVELS } from '../config/constants';
import { sendgridApiKey } from '../config/secrets';

/**
 * Register invitation and family access routes
 * Handles all family member invitation and access management functionality
 */
export function registerInvitationAndFamilyAccessRoutes(
	app: express.Application,
	firestore: Firestore
) {
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

	// Resend pending invitation
	app.post('/invitations/:invitationId/resend', authenticate, async (req, res) => {
		try {
			const { invitationId } = req.params;
			const userId = (req as any).user.uid;

			// Get the invitation
			const invitationDoc = await firestore.collection('family_calendar_access').doc(invitationId).get();

			if (!invitationDoc.exists) {
				return res.status(404).json({
					success: false,
					error: 'Invitation not found'
				});
			}

			const invitation = invitationDoc.data() as any;

			// Verify user owns this patient record
			if (invitation.patientId !== userId) {
				return res.status(403).json({
					success: false,
					error: 'Access denied - you can only resend your own invitations'
				});
			}

			// Verify invitation is still pending
			if (invitation.status !== 'pending') {
				return res.status(400).json({
					success: false,
					error: 'Can only resend pending invitations'
				});
			}

			// Generate new token and extend expiration
			const newToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

			await invitationDoc.ref.update({
				invitationToken: newToken,
				invitationExpiresAt: admin.firestore.Timestamp.fromDate(newExpiresAt),
				updatedAt: admin.firestore.Timestamp.now()
			});

			// Send new invitation email (simplified - you may need to implement email sending)
			console.log('Invitation resent:', {
				invitationId,
				newToken,
				expiresAt: newExpiresAt,
				familyMemberEmail: invitation.familyMemberEmail
			});

			res.json({
				success: true,
				message: 'Invitation resent successfully',
				data: {
					invitationId,
					expiresAt: newExpiresAt
				}
			});
		} catch (error) {
			console.error('Error resending invitation:', error);
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

	// ===== FAMILY ACCESS ROUTES =====

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
		} catch (error) {
			console.error('Error getting family access:', error);
			res.status(500).json({
				success: false,
				error: 'Internal server error'
			});
		}
	});

	// Get all family members for a patient (pending + accepted)
	app.get('/family-access/patient/:patientId', authenticate, async (req, res) => {
		try {
			console.log('🔍 GET /family-access/patient/:patientId route handler called');
			const { patientId } = req.params;
			const userId = (req as any).user.uid;

			console.log('🔍 Route params:', { patientId, userId, match: userId === patientId });

			// Verify the requesting user is the patient
			if (userId !== patientId) {
				console.log('❌ Authorization failed: user is not the patient');
				return res.status(403).json({
					success: false,
					error: 'Unauthorized: You can only view your own family members'
				});
			}

			// Get all family access records for this patient
			const familyAccessQuery = await firestore.collection('family_calendar_access')
				.where('patientId', '==', patientId)
				.get();

			if (familyAccessQuery.empty) {
				return res.json({
					success: true,
					data: []
				});
			}

			// Process the records
			const familyMembers = [];
			for (const doc of familyAccessQuery.docs) {
				const access = doc.data();

				// Get family member details if available
				let familyMemberDetails = null;
				if (access.familyMemberId) {
					const familyMemberDoc = await firestore.collection('users').doc(access.familyMemberId).get();
					if (familyMemberDoc.exists) {
						const familyMemberData = familyMemberDoc.data();
						familyMemberDetails = {
							name: familyMemberData?.name,
							email: familyMemberData?.email
						};
					}
				}

				familyMembers.push({
					id: doc.id,
					familyMemberId: access.familyMemberId,
					familyMemberName: access.familyMemberName,
					familyMemberEmail: access.familyMemberEmail,
					accessLevel: access.accessLevel,
					status: access.status,
					acceptedAt: access.acceptedAt?.toDate(),
					invitedAt: access.invitedAt?.toDate(),
					invitationExpiresAt: access.invitationExpiresAt?.toDate(),
					familyMemberDetails
				});
			}

			// Sort: pending first, then by date
			const sorted = familyMembers.sort((a, b) => {
				if (a.status === 'pending' && b.status !== 'pending') return -1;
				if (a.status !== 'pending' && b.status === 'pending') return 1;
				return new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime();
			});

			res.json({
				success: true,
				data: sorted
			});
		} catch (error) {
			console.error('❌ Error fetching family members:', error);
			console.error('❌ Error details:', {
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : 'No stack',
				patientId: req.params?.patientId,
				userId: (req as any)?.user?.uid
			});
			res.status(500).json({
				success: false,
				error: 'Failed to fetch family members'
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
	app.delete('/family-access/:accessId', authenticate, async (req, res) => {
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

	console.log('✅ Invitation and family access routes registered successfully');
}

