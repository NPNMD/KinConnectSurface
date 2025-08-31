[1mdiff --git a/functions/src/index.ts b/functions/src/index.ts[m
[1mindex d9caff9..9015061 100644[m
[1m--- a/functions/src/index.ts[m
[1m+++ b/functions/src/index.ts[m
[36m@@ -1880,9 +1880,31 @@[m [mapp.post('/medication-calendar/events/:eventId/taken', authenticate, async (req,[m
 		const userId = (req as any).user.uid;[m
 		const { takenAt, notes } = req.body;[m
 		[m
[31m-		const eventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();[m
[32m+[m		[32mconsole.log('💊 Marking medication as taken:', { eventId, userId, takenAt, notes });[m
[32m+[m[41m		[m
[32m+[m		[32m// Validate eventId[m
[32m+[m		[32mif (!eventId || typeof eventId !== 'string') {[m
[32m+[m			[32mconsole.log('❌ Invalid eventId:', eventId);[m
[32m+[m			[32mreturn res.status(400).json({[m
[32m+[m				[32msuccess: false,[m
[32m+[m				[32merror: 'Invalid event ID'[m
[32m+[m			[32m});[m
[32m+[m		[32m}[m
[32m+[m[41m		[m
[32m+[m		[32m// Get the event document with better error handling[m
[32m+[m		[32mlet eventDoc;[m
[32m+[m		[32mtry {[m
[32m+[m			[32meventDoc = await firestore.collection('medication_calendar_events').doc(eventId).get();[m
[32m+[m		[32m} catch (firestoreError) {[m
[32m+[m			[32mconsole.error('❌ Firestore error getting event:', firestoreError);[m
[32m+[m			[32mreturn res.status(500).json({[m
[32m+[m				[32msuccess: false,[m
[32m+[m				[32merror: 'Database error retrieving event'[m
[32m+[m			[32m});[m
[32m+[m		[32m}[m
 		[m
 		if (!eventDoc.exists) {[m
[32m+[m			[32mconsole.log('❌ Medication event not found:', eventId);[m
 			return res.status(404).json({[m
 				success: false,[m
 				error: 'Medication event not found'[m
[36m@@ -1890,70 +1912,199 @@[m [mapp.post('/medication-calendar/events/:eventId/taken', authenticate, async (req,[m
 		}[m
 		[m
 		const eventData = eventDoc.data();[m
[32m+[m		[32mif (!eventData) {[m
[32m+[m			[32mconsole.log('❌ Event data is null:', eventId);[m
[32m+[m			[32mreturn res.status(404).json({[m
[32m+[m				[32msuccess: false,[m
[32m+[m				[32merror: 'Event data not found'[m
[32m+[m			[32m});[m
[32m+[m		[32m}[m
[32m+[m[41m		[m
[32m+[m		[32mconsole.log('📋 Current event data:', {[m
[32m+[m			[32mid: eventId,[m
[32m+[m			[32mpatientId: eventData.patientId,[m
[32m+[m			[32mstatus: eventData.status,[m
[32m+[m			[32mmedicationName: eventData.medicationName[m
[32m+[m		[32m});[m
 		[m
 		// Check if user has access to this event[m
[31m-		if (eventData?.patientId !== userId) {[m
[31m-			// Check family access[m
[31m-			const familyAccess = await firestore.collection('family_calendar_access')[m
[31m-				.where('familyMemberId', '==', userId)[m
[31m-				.where('patientId', '==', eventData?.patientId)[m
[31m-				.where('status', '==', 'active')[m
[31m-				.get();[m
[32m+[m		[32mif (eventData.patientId !== userId) {[m
[32m+[m			[32mconsole.log('🔍 Checking family access for user:', userId, 'to patient:', eventData.patientId);[m
 			[m
[31m-			if (familyAccess.empty) {[m
[31m-				return res.status(403).json({[m
[32m+[m			[32mtry {[m
[32m+[m				[32m// Check family access[m
[32m+[m				[32mconst familyAccess = await firestore.collection('family_calendar_access')[m
[32m+[m					[32m.where('familyMemberId', '==', userId)[m
[32m+[m					[32m.where('patientId', '==', eventData.patientId)[m
[32m+[m					[32m.where('status', '==', 'active')[m
[32m+[m					[32m.get();[m
[32m+[m[41m				[m
[32m+[m				[32mif (familyAccess.empty) {[m
[32m+[m					[32mconsole.log('❌ Access denied for user:', userId, 'to event:', eventId);[m
[32m+[m					[32mreturn res.status(403).json({[m
[32m+[m						[32msuccess: false,[m
[32m+[m						[32merror: 'Access denied'[m
[32m+[m					[32m});[m
[32m+[m				[32m}[m
[32m+[m[41m				[m
[32m+[m				[32mconsole.log('✅ Family access verified for user:', userId);[m
[32m+[m			[32m} catch (accessError) {[m
[32m+[m				[32mconsole.error('❌ Error checking family access:', accessError);[m
[32m+[m				[32mreturn res.status(500).json({[m
 					success: false,[m
[31m-					error: 'Access denied'[m
[32m+[m					[32merror: 'Error verifying access permissions'[m
 				});[m
 			}[m
 		}[m
 		[m
[31m-		// Update the event[m
[31m-		const updateData = {[m
[32m+[m		[32m// Prepare update data with better error handling[m
[32m+[m		[32mconst updateData: any = {[m
 			status: 'taken',[m
[31m-			actualTakenDateTime: takenAt ? admin.firestore.Timestamp.fromDate(new Date(takenAt)) : admin.firestore.Timestamp.now(),[m
 			takenBy: userId,[m
[31m-			notes: notes || undefined,[m
[31m-			isOnTime: true, // Calculate based on scheduled time vs actual time[m
 			updatedAt: admin.firestore.Timestamp.now()[m
 		};[m
 		[m
[31m-		// Calculate if taken on time (within 30 minutes of scheduled time)[m
[31m-		if (eventData?.scheduledDateTime) {[m
[31m-			const scheduledTime = eventData.scheduledDateTime.toDate();[m
[31m-			const takenTime = updateData.actualTakenDateTime.toDate();[m
[31m-			const timeDiffMinutes = Math.abs((takenTime.getTime() - scheduledTime.getTime()) / (1000 * 60));[m
[31m-			updateData.isOnTime = timeDiffMinutes <= 30;[m
[32m+[m		[32m// Handle takenAt timestamp safely with better validation[m
[32m+[m		[32mtry {[m
[32m+[m			[32mlet takenDateTime: Date;[m
 			[m
[31m-			if (timeDiffMinutes > 30) {[m
[31m-				updateData.status = 'late';[m
[31m-				(updateData as any).minutesLate = Math.round(timeDiffMinutes);[m
[32m+[m			[32mif (takenAt) {[m
[32m+[m				[32mif (typeof takenAt === 'string') {[m
[32m+[m					[32m// Try to parse the string as a date[m
[32m+[m					[32mtakenDateTime = new Date(takenAt);[m
[32m+[m					[32mif (isNaN(takenDateTime.getTime())) {[m
[32m+[m						[32mconsole.warn('⚠️ Invalid takenAt date string, using current time:', takenAt);[m
[32m+[m						[32mtakenDateTime = new Date();[m
[32m+[m					[32m}[m
[32m+[m				[32m} else if (takenAt instanceof Date) {[m
[32m+[m					[32mtakenDateTime = takenAt;[m
[32m+[m				[32m} else {[m
[32m+[m					[32mconsole.warn('⚠️ Invalid takenAt type, using current time:', typeof takenAt);[m
[32m+[m					[32mtakenDateTime = new Date();[m
[32m+[m				[32m}[m
[32m+[m			[32m} else {[m
[32m+[m				[32mtakenDateTime = new Date();[m
 			}[m
[32m+[m[41m			[m
[32m+[m			[32mupdateData.actualTakenDateTime = admin.firestore.Timestamp.fromDate(takenDateTime);[m
[32m+[m			[32mconsole.log('📅 Set actualTakenDateTime to:', takenDateTime.toISOString());[m
[32m+[m		[32m} catch (dateError) {[m
[32m+[m			[32mconsole.error('❌ Error processing takenAt date:', dateError);[m
[32m+[m			[32mupdateData.actualTakenDateTime = admin.firestore.Timestamp.now();[m
 		}[m
 		[m
[31m-		await eventDoc.ref.update(updateData);[m
[32m+[m		[32m// Add notes if provided and valid - ONLY add if not undefined[m
[32m+[m		[32mif (notes !== undefined && notes !== null && typeof notes === 'string' && notes.trim().length > 0) {[m
[32m+[m			[32mupdateData.notes = notes.trim();[m
[32m+[m		[32m}[m
[32m+[m		[32m// Do not add notes field at all if it's undefined, null, or empty[m
 		[m
[31m-		// Get updated event[m
[31m-		const updatedDoc = await eventDoc.ref.get();[m
[31m-		const updatedData = updatedDoc.data();[m
[32m+[m		[32m// Calculate if taken on time (within 30 minutes of scheduled time)[m
[32m+[m		[32mupdateData.isOnTime = true; // Default to true[m
[32m+[m[41m		[m
[32m+[m		[32mtry {[m
[32m+[m			[32mif (eventData.scheduledDateTime && updateData.actualTakenDateTime) {[m
[32m+[m				[32mconst scheduledTime = eventData.scheduledDateTime.toDate();[m
[32m+[m				[32mconst takenTime = updateData.actualTakenDateTime.toDate();[m
[32m+[m				[32mconst timeDiffMinutes = Math.abs((takenTime.getTime() - scheduledTime.getTime()) / (1000 * 60));[m
[32m+[m				[32mupdateData.isOnTime = timeDiffMinutes <= 30;[m
[32m+[m[41m				[m
[32m+[m