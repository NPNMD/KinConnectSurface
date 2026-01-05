import express from 'express';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { authenticate } from '../middleware';

/**
 * Register healthcare facility routes
 * Handles CRUD operations for healthcare facilities (pharmacies, hospitals, etc.)
 * 
 * FIXED: Route conflict resolved by using query parameter for "get all" endpoint
 * - GET /healthcare/facilities?userId=xxx - Get all facilities for a user
 * - GET /healthcare/facilities/:facilityId - Get specific facility by ID
 */
export function registerHealthcareFacilityRoutes(
	app: express.Application,
	firestore: Firestore
) {
	// Get healthcare facilities - supports both "get all for user" and "get by ID"
	app.get('/healthcare/facilities/:facilityId?', authenticate, async (req, res) => {
		try {
			const { facilityId } = req.params;
			const { userId } = req.query;
			const currentUserId = (req as any).user.uid;
			
			// If facilityId is provided, get specific facility
			if (facilityId) {
				console.log('🏥 === FACILITY ACCESS DEBUG START ===');
				console.log('🏥 Getting facility:', facilityId, 'requested by:', currentUserId);
				
				// Get the facility
				const facilityDoc = await firestore.collection('healthcare_facilities').doc(facilityId).get();
				
				if (!facilityDoc.exists) {
					console.log('❌ Facility not found:', facilityId);
					return res.status(404).json({
						success: false,
						error: 'Healthcare facility not found'
					});
				}
				
				const facilityData = facilityDoc.data();
				
				console.log('🔍 Facility data:', {
					facilityId,
					hasPatientId: !!facilityData?.patientId,
					patientId: facilityData?.patientId,
					currentUserId,
					patientIdMatch: facilityData?.patientId === currentUserId,
					facilityType: facilityData?.facilityType,
					facilityName: facilityData?.name
				});
				
				// Check if user has access to this facility's patient data
				if (facilityData?.patientId !== currentUserId) {
					console.log('⚠️ Patient ID mismatch - checking family access');
					console.log('🔍 Looking for family access:', {
						familyMemberId: currentUserId,
						patientId: facilityData?.patientId
					});
					
					// Check family access
					const familyAccess = await firestore.collection('family_calendar_access')
						.where('familyMemberId', '==', currentUserId)
						.where('patientId', '==', facilityData?.patientId)
						.where('status', '==', 'active')
						.get();
					
					console.log('🔍 Family access query result:', {
						isEmpty: familyAccess.empty,
						count: familyAccess.docs.length,
						hasAccess: !familyAccess.empty
					});
					
					if (familyAccess.empty) {
						console.log('❌ ACCESS DENIED - No family access found');
						console.log('❌ Facility patientId:', facilityData?.patientId);
						console.log('❌ Current userId:', currentUserId);
						console.log('🏥 === FACILITY ACCESS DEBUG END ===');
						return res.status(403).json({
							success: false,
							error: 'Access denied'
						});
					}
					
					console.log('✅ Family access verified');
				} else {
					console.log('✅ Direct patient access - patient owns this facility');
				}
				
				const facility = {
					id: facilityDoc.id,
					...facilityData,
					createdAt: facilityData?.createdAt?.toDate(),
					updatedAt: facilityData?.updatedAt?.toDate()
				};
				
				console.log('✅ Facility found:', facilityId);
				console.log('🏥 === FACILITY ACCESS DEBUG END ===');
				
				return res.json({
					success: true,
					data: facility
				});
			}
			
			// Otherwise, get all facilities for a user (using query parameter)
			const targetUserId = (userId as string) || currentUserId;
			
			console.log('🏥 Getting all facilities for user:', targetUserId, 'requested by:', currentUserId);
			
			// Check if user has access to this patient's data
			if (targetUserId !== currentUserId) {
				// Check family access
				const familyAccess = await firestore.collection('family_calendar_access')
					.where('familyMemberId', '==', currentUserId)
					.where('patientId', '==', targetUserId)
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
				.where('patientId', '==', targetUserId)
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
}