import express from 'express';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { authenticate } from '../middleware';

/**
 * Register patient medication preferences routes
 * Handles patient medication timing preferences and validation
 */
export function registerPatientPreferencesRoutes(
	app: express.Application,
	firestore: Firestore
) {
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
				}
			});
		} catch (error) {
			console.error('Error resetting patient preferences:', error);
			res.status(500).json({
				success: false,
				error: 'Internal server error'
			});
		}
	});
}

