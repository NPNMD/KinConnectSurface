/**
 * Data Migration Script: Fix Night Shift Time Configuration
 * 
 * This script identifies and fixes existing patients with night shift preferences
 * that have the problematic 2 AM default times issue.
 * 
 * Issues Fixed:
 * 1. Evening slot incorrectly set to 01:00-04:00 with 02:00 default
 * 2. Bedtime slot incorrectly set to 05:00-08:00 with 06:00 default
 * 
 * Correct Configuration:
 * - Evening: 23:00-02:00 with 00:00 default (Late Evening)
 * - Bedtime: 06:00-10:00 with 08:00 default (Morning Sleep)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('./claritystream-uldp9-firebase-adminsdk-fbsvc-ed15b6f5e9.json');
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'claritystream-uldp9'
    });
}

const firestore = admin.firestore();

async function fixNightShiftTimeConfiguration() {
    console.log('🔧 Starting Night Shift Time Configuration Fix...');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const results = {
        patientsScanned: 0,
        patientsWithNightShift: 0,
        patientsNeedingFix: 0,
        patientsFixed: 0,
        medicationEventsUpdated: 0,
        schedulesUpdated: 0,
        errors: []
    };
    
    try {
        // Step 1: Find all patient medication preferences
        console.log('🔍 Step 1: Scanning patient medication preferences...');
        const preferencesQuery = await firestore.collection('patient_medication_preferences').get();
        results.patientsScanned = preferencesQuery.docs.length;
        
        console.log(`📊 Found ${results.patientsScanned} patient preference records`);
        
        // Step 2: Identify patients with night shift preferences
        const nightShiftPatients = [];
        
        for (const doc of preferencesQuery.docs) {
            const data = doc.data();
            
            if (data.workSchedule === 'night_shift') {
                results.patientsWithNightShift++;
                
                // Check if they have the problematic configuration
                const hasProblematicEvening = (
                    data.timeSlots?.evening?.start === '01:00' &&
                    data.timeSlots?.evening?.end === '04:00' &&
                    data.timeSlots?.evening?.defaultTime === '02:00'
                );
                
                const hasProblematicBedtime = (
                    data.timeSlots?.bedtime?.start === '05:00' &&
                    data.timeSlots?.bedtime?.end === '08:00' &&
                    data.timeSlots?.bedtime?.defaultTime === '06:00'
                );
                
                if (hasProblematicEvening || hasProblematicBedtime) {
                    results.patientsNeedingFix++;
                    nightShiftPatients.push({
                        docId: doc.id,
                        patientId: data.patientId,
                        data: data,
                        hasProblematicEvening,
                        hasProblematicBedtime
                    });
                    
                    console.log(`❌ Found problematic configuration for patient: ${data.patientId}`, {
                        hasProblematicEvening,
                        hasProblematicBedtime,
                        currentEvening: data.timeSlots?.evening,
                        currentBedtime: data.timeSlots?.bedtime
                    });
                }
            }
        }
        
        console.log(`📊 Night shift analysis:`, {
            totalNightShiftPatients: results.patientsWithNightShift,
            patientsNeedingFix: results.patientsNeedingFix
        });
        
        // Step 3: Fix the problematic configurations
        if (nightShiftPatients.length === 0) {
            console.log('✅ No patients found with problematic night shift configuration');
            return results;
        }
        
        console.log('🔧 Step 3: Fixing problematic configurations...');
        
        for (const patient of nightShiftPatients) {
            try {
                console.log(`🔧 Fixing patient: ${patient.patientId}`);
                
                // Create corrected time slots
                const correctedTimeSlots = {
                    ...patient.data.timeSlots,
                    evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Late Evening' },
                    bedtime: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning Sleep' }
                };
                
                // Update the patient preferences
                await firestore.collection('patient_medication_preferences').doc(patient.docId).update({
                    timeSlots: correctedTimeSlots,
                    updatedAt: admin.firestore.Timestamp.now(),
                    migrationFixedAt: admin.firestore.Timestamp.now(),
                    migrationReason: 'fix_night_shift_2am_default_issue',
                    migrationVersion: '1.0.0'
                });
                
                results.patientsFixed++;
                console.log(`✅ Fixed preferences for patient: ${patient.patientId}`);
                
                // Step 4: Update any existing medication schedules that might be using the old times
                console.log(`🔧 Checking medication schedules for patient: ${patient.patientId}`);
                
                const schedulesQuery = await firestore.collection('medication_schedules')
                    .where('patientId', '==', patient.patientId)
                    .where('isActive', '==', true)
                    .get();
                
                for (const scheduleDoc of schedulesQuery.docs) {
                    const scheduleData = scheduleDoc.data();
                    let needsUpdate = false;
                    const updatedTimes = [...(scheduleData.times || [])];
                    
                    // Check if any scheduled times are 02:00 (the problematic default)
                    for (let i = 0; i < updatedTimes.length; i++) {
                        if (updatedTimes[i] === '02:00') {
                            updatedTimes[i] = '00:00'; // Change to midnight
                            needsUpdate = true;
                            console.log(`🔧 Updating schedule time from 02:00 to 00:00 for medication: ${scheduleData.medicationName}`);
                        }
                        if (updatedTimes[i] === '06:00' && scheduleData.frequency?.includes('bedtime')) {
                            updatedTimes[i] = '08:00'; // Change bedtime from 06:00 to 08:00
                            needsUpdate = true;
                            console.log(`🔧 Updating bedtime schedule from 06:00 to 08:00 for medication: ${scheduleData.medicationName}`);
                        }
                    }
                    
                    if (needsUpdate) {
                        await scheduleDoc.ref.update({
                            times: updatedTimes,
                            updatedAt: admin.firestore.Timestamp.now(),
                            migrationFixedAt: admin.firestore.Timestamp.now(),
                            migrationReason: 'fix_night_shift_2am_default_issue'
                        });
                        results.schedulesUpdated++;
                    }
                }
                
                // Step 5: Update any existing medication calendar events with 02:00 times
                console.log(`🔧 Checking medication calendar events for patient: ${patient.patientId}`);
                
                const eventsQuery = await firestore.collection('medication_calendar_events')
                    .where('patientId', '==', patient.patientId)
                    .where('status', 'in', ['scheduled', 'pending'])
                    .get();
                
                for (const eventDoc of eventsQuery.docs) {
                    const eventData = eventDoc.data();
                    const scheduledTime = eventData.scheduledDateTime?.toDate();
                    
                    if (scheduledTime) {
                        const timeString = scheduledTime.toTimeString().slice(0, 5); // HH:MM format
                        
                        if (timeString === '02:00') {
                            // Update to midnight (00:00)
                            const newDateTime = new Date(scheduledTime);
                            newDateTime.setHours(0, 0, 0, 0);
                            
                            await eventDoc.ref.update({
                                scheduledDateTime: admin.firestore.Timestamp.fromDate(newDateTime),
                                updatedAt: admin.firestore.Timestamp.now(),
                                migrationFixedAt: admin.firestore.Timestamp.now(),
                                migrationReason: 'fix_night_shift_2am_default_issue',
                                originalScheduledTime: eventData.scheduledDateTime
                            });
                            
                            results.medicationEventsUpdated++;
                            console.log(`🔧 Updated medication event from 02:00 to 00:00 for: ${eventData.medicationName}`);
                        }
                    }
                }
                
            } catch (patientError) {
                console.error(`❌ Error fixing patient ${patient.patientId}:`, patientError);
                results.errors.push(`Patient ${patient.patientId}: ${patientError.message}`);
            }
        }
        
        console.log('✅ Migration completed successfully!');
        console.log('📊 Final Results:', results);
        
        return results;
        
    } catch (error) {
        console.error('❌ Critical error in migration:', error);
        results.errors.push(`Critical error: ${error.message}`);
        throw error;
    }
}

// Export for use in other scripts
module.exports = { fixNightShiftTimeConfiguration };

// Run the migration if this script is executed directly
if (require.main === module) {
    fixNightShiftTimeConfiguration()
        .then((results) => {
            console.log('🎉 Migration completed successfully!');
            console.log('📊 Summary:', {
                patientsScanned: results.patientsScanned,
                patientsWithNightShift: results.patientsWithNightShift,
                patientsNeedingFix: results.patientsNeedingFix,
                patientsFixed: results.patientsFixed,
                schedulesUpdated: results.schedulesUpdated,
                medicationEventsUpdated: results.medicationEventsUpdated,
                errorsCount: results.errors.length
            });
            
            if (results.errors.length > 0) {
                console.log('⚠️ Errors encountered:', results.errors);
            }
            
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}