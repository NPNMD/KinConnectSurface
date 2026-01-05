import * as functions from 'firebase-functions/v1';
import express from 'express';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import modularized components
import { createApp } from './config/app';
import { initializeFirebase } from './config/firebase';
import { sendgridApiKey, googleAIApiKey } from './config/secrets';
import { SENDGRID_FROM_EMAIL, APP_URL, ACCESS_LEVELS } from './config/constants';
import { authenticate, addDeprecationHeaders } from './middleware';

// Import unified medication API
import unifiedMedicationApi from './api/unified/unifiedMedicationApi';
import notificationPreferencesApi from './api/notificationPreferences';
import familyAdherenceNotificationsApi from './api/familyAdherenceNotifications';
import medicationCalendarSyncApi from './api/medicationCalendarSync';
import { generateCalendarEventsForSchedule } from './utils/legacyEventGenerator';

// Initialize Firebase Admin SDK and get Firestore instance
const firestore = initializeFirebase();

// Create Express app with all middleware configured
const app = createApp();

// Register all routes
import { registerAllRoutes } from './routes';
registerAllRoutes(app, firestore);

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

// NOTE: Invitation and family access routes have been moved to routes/invitationsAndFamilyAccess.ts
// They are registered via registerAllRoutes() above

// NOTE: Drug search routes have been moved to routes/drugSearch.ts
// They are registered via registerAllRoutes() above

// NOTE: Auth/profile routes have been moved to routes/auth.ts
// They are registered via registerAllRoutes() above

// NOTE: Patient preferences routes have been moved to routes/patientPreferences.ts
// They are registered via registerAllRoutes() above

// NOTE: Meal logging routes have been moved to routes/mealLogging.ts
// They are registered via registerAllRoutes() above

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

// DEPRECATED: Moved to functions/src/routes/healthcareFacilities.ts to fix route conflicts
/*
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
*/


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
app.delete('/medications/:medicationId',
  authenticate,
  addDeprecationHeaders(
    '/medications/:medicationId',
    '/unified-medication/medication-commands/:id',
    '2025-12-31'
  ),
  async (req, res) => {
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
			message: 'Medication deleted successfully',
			_deprecated: {
				isDeprecated: true,
				sunsetDate: '2025-12-31',
				replacement: 'DELETE /unified-medication/medication-commands/:id',
				notice: 'This endpoint is deprecated. Use DELETE /unified-medication/medication-commands/:id for proper cascade deletion.',
				migrationGuide: 'https://docs.kinconnect.app/api/migration/unified-medication'
			}
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
app.get('/medications/:medicationId',
  authenticate,
  addDeprecationHeaders(
    '/medications/:medicationId',
    '/unified-medication/medication-commands/:id',
    '2025-12-31'
  ),
  async (req, res) => {
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


// ===== LEGACY ENDPOINT REMOVED =====
// POST /medications has been removed - use POST /unified-medication/medication-commands instead
// This legacy endpoint created medications in the old fragmented model
// The unified API provides better data consistency and event-driven architecture
// Migration date: 2025-10-24

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
					await generateCalendarEventsForSchedule(firestore, scheduleRef.id, scheduleData);
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

// ===== LEGACY ENDPOINT REMOVED =====
// PUT /medications/:medicationId has been removed - use PUT /unified-medication/medication-commands/:id instead
// This legacy endpoint updated medications in the old fragmented model
// The unified API provides better data consistency and transactional updates
// Migration date: 2025-10-24

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
  // Reconstruct path to match unifiedMedicationApi routing structure
  // unifiedMedicationApi expects /medication-commands prefix
  req.url = `/medication-commands${req.url}`;
  unifiedMedicationApi(req, res, next);
});

app.use('/medication-events', authenticate, (req, res, next) => {
  console.log('🔄 Redirecting legacy /medication-events to unified API');
  // Reconstruct path to match unifiedMedicationApi routing structure
  // unifiedMedicationApi expects /medication-events prefix
  req.url = `/medication-events${req.url}`;
  unifiedMedicationApi(req, res, next);
});

app.use('/medication-views', authenticate, (req, res, next) => {
  console.log('🔄 Redirecting legacy /medication-views to unified API');
  // Reconstruct path to match unifiedMedicationApi routing structure
  // unifiedMedicationApi expects /medication-views prefix
  req.url = `/medication-views${req.url}`;
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

// Export CASCADE DELETE trigger for medication commands
export { onMedicationCommandDelete } from './triggers/medicationCascadeDelete';

  
// Export new unified medication scheduled functions  
export { generateDailyMedicationEvents } from './scheduled/generateDailyMedicationEvents';  
export { detectMissedMedicationsUnified } from './scheduled/detectMissedMedicationsUnified'; 
