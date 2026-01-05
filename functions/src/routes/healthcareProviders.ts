import express from 'express';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { authenticate } from '../middleware';

/**
 * Register healthcare provider routes
 * Handles CRUD operations for healthcare providers
 */
export function registerHealthcareProviderRoutes(
	app: express.Application,
	firestore: Firestore
) {
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
}

