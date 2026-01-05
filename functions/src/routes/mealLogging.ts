import express from 'express';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { authenticate } from '../middleware';

/**
 * Register meal logging routes
 * Handles meal log CRUD operations for patients
 */
export function registerMealLoggingRoutes(
	app: express.Application,
	firestore: Firestore
) {
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
			const mealLogData = req.body;
			
			console.log('🍽️ Creating meal log for patient:', patientId);
			
			// Validate required fields
			if (!mealLogData.date || !mealLogData.mealType) {
				return res.status(400).json({
					success: false,
					error: 'Date and meal type are required'
				});
			}
			
			const newMealLog = {
				patientId,
				date: admin.firestore.Timestamp.fromDate(new Date(mealLogData.date)),
				mealType: mealLogData.mealType,
				foodItems: mealLogData.foodItems || [],
				notes: mealLogData.notes || '',
				loggedAt: admin.firestore.Timestamp.now(),
				estimatedTime: mealLogData.estimatedTime ? admin.firestore.Timestamp.fromDate(new Date(mealLogData.estimatedTime)) : null,
				createdAt: admin.firestore.Timestamp.now(),
				updatedAt: admin.firestore.Timestamp.now()
			};
			
			const mealLogRef = await firestore.collection('meal_logs').add(newMealLog);
			
			console.log('✅ Meal log created successfully:', mealLogRef.id);
			
			res.status(201).json({
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
			const updates = req.body;
			
			const mealLogDoc = await firestore.collection('meal_logs').doc(mealLogId).get();
			
			if (!mealLogDoc.exists) {
				return res.status(404).json({
					success: false,
					error: 'Meal log not found'
				});
			}
			
			const mealLogData = mealLogDoc.data();
			
			// Check if user has access to this meal log
			if (mealLogData?.patientId !== patientId) {
				return res.status(403).json({
					success: false,
					error: 'Access denied'
				});
			}
			
			// Prepare update data
			const updateData: any = {
				updatedAt: admin.firestore.Timestamp.now()
			};
			
			// Handle date conversion
			if (updates.date) {
				updateData.date = admin.firestore.Timestamp.fromDate(new Date(updates.date));
			}
			
			// Copy other fields
			const fieldsToCopy = ['mealType', 'foodItems', 'notes'];
			fieldsToCopy.forEach(field => {
				if (updates[field] !== undefined) {
					updateData[field] = updates[field];
				}
			});
			
			if (updates.estimatedTime !== undefined) {
				updateData.estimatedTime = updates.estimatedTime ? admin.firestore.Timestamp.fromDate(new Date(updates.estimatedTime)) : null;
			}
			
			await mealLogDoc.ref.update(updateData);
			
			// Get updated meal log
			const updatedDoc = await mealLogDoc.ref.get();
			const updatedData = updatedDoc.data();
			
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
			
			const mealLogDoc = await firestore.collection('meal_logs').doc(mealLogId).get();
			
			if (!mealLogDoc.exists) {
				return res.status(404).json({
					success: false,
					error: 'Meal log not found'
				});
			}
			
			const mealLogData = mealLogDoc.data();
			
			// Check if user has access to this meal log
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
}

