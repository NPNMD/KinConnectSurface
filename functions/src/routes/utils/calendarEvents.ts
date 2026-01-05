import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';

/**
 * Helper function to generate calendar events for a medication schedule
 */
export async function generateCalendarEventsForSchedule(
	firestore: Firestore,
	scheduleId: string,
	scheduleData: any
) {
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

