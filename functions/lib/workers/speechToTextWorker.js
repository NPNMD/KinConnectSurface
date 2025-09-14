"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = void 0;
exports.saveTranscriptFiles = saveTranscriptFiles;
exports.updateVisitStatus = updateVisitStatus;
const pubsub_1 = require("firebase-functions/v2/pubsub");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const pubsub_2 = require("@google-cloud/pubsub");
const speech_1 = require("@google-cloud/speech");
const firebase_functions_1 = require("firebase-functions");
// Initialize Firebase Admin if not already initialized
try {
    (0, app_1.initializeApp)();
}
catch (error) {
    // App already initialized
}
const db = (0, firestore_1.getFirestore)();
const storage = (0, storage_1.getStorage)();
const pubsub = new pubsub_2.PubSub();
const speechClient = new speech_1.SpeechClient();
// Speech-to-Text worker triggered by Pub/Sub messages
exports.transcribeAudio = (0, pubsub_1.onMessagePublished)({
    topic: 'transcribe-request',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300, // 5 minutes for longer audio files
    maxInstances: 10
}, async (event) => {
    const message = event.data.message;
    const { uid, visitId, gcsUri, language } = message.json;
    firebase_functions_1.logger.info('🎤 Starting audio transcription', {
        visitId,
        uid,
        gcsUri,
        language
    });
    try {
        // Update status to transcribing
        await updateVisitStatus(visitId, 'transcribing', {
            transcriptionStartedAt: new Date()
        });
        // Configure Speech-to-Text for medical content
        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: language || 'en-US',
            model: 'latest_long', // Best for longer recordings
            useEnhanced: true,
            enableAutomaticPunctuation: true,
            enableSpeakerDiarization: false, // Usually single speaker for visit summaries
            audioChannelCount: 1,
            // Medical context for better accuracy
            speechContexts: [{
                    phrases: [
                        // Medical terms
                        'blood pressure', 'heart rate', 'temperature', 'pulse', 'oxygen saturation',
                        'medication', 'prescription', 'dosage', 'milligrams', 'tablets', 'capsules',
                        'diagnosis', 'symptoms', 'treatment', 'therapy', 'procedure',
                        'follow up', 'follow-up', 'appointment', 'referral', 'specialist',
                        'allergies', 'side effects', 'contraindications',
                        'chronic', 'acute', 'condition', 'disease', 'disorder',
                        'laboratory', 'lab results', 'blood work', 'imaging', 'x-ray', 'MRI', 'CT scan',
                        'insurance', 'copay', 'deductible', 'prior authorization',
                        // Common medical specialties
                        'cardiology', 'dermatology', 'endocrinology', 'gastroenterology',
                        'neurology', 'oncology', 'orthopedics', 'psychiatry', 'pulmonology',
                        'rheumatology', 'urology', 'ophthalmology', 'otolaryngology',
                        // Common medications (generic names)
                        'lisinopril', 'metformin', 'amlodipine', 'metoprolol', 'omeprazole',
                        'atorvastatin', 'levothyroxine', 'albuterol', 'hydrochlorothiazide',
                        'losartan', 'gabapentin', 'sertraline', 'escitalopram', 'prednisone'
                    ],
                    boost: 15.0 // Higher boost for medical terms
                }],
            // Alternative language codes for better recognition
            alternativeLanguageCodes: ['en-GB', 'en-AU'] // English variants
        };
        const request = {
            audio: { uri: gcsUri },
            config
        };
        firebase_functions_1.logger.info('📤 Sending request to Speech-to-Text API', {
            visitId,
            model: config.model,
            language: config.languageCode,
            contextPhrases: config.speechContexts[0].phrases.length
        });
        // Call Speech-to-Text API with retry logic
        let transcriptionResult;
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
            try {
                const [operation] = await speechClient.longRunningRecognize(request);
                const [result] = await operation.promise();
                transcriptionResult = result;
                break;
            }
            catch (apiError) {
                retryCount++;
                firebase_functions_1.logger.warn(`⚠️ Speech-to-Text API error (attempt ${retryCount}/${maxRetries})`, {
                    visitId,
                    error: apiError.message,
                    code: apiError.code
                });
                if (retryCount >= maxRetries) {
                    throw apiError;
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            }
        }
        // Process transcription results
        if (!transcriptionResult?.results || transcriptionResult.results.length === 0) {
            throw new Error('No transcription results returned from Speech-to-Text API');
        }
        // Combine all transcription alternatives
        let fullTranscript = '';
        let totalConfidence = 0;
        let segmentCount = 0;
        for (const result of transcriptionResult.results) {
            if (result.alternatives && result.alternatives.length > 0) {
                const alternative = result.alternatives[0];
                if (alternative.transcript) {
                    fullTranscript += alternative.transcript + ' ';
                    totalConfidence += alternative.confidence || 0;
                    segmentCount++;
                }
            }
        }
        fullTranscript = fullTranscript.trim();
        const averageConfidence = segmentCount > 0 ? totalConfidence / segmentCount : 0;
        if (!fullTranscript) {
            throw new Error('No speech detected in audio recording');
        }
        firebase_functions_1.logger.info('✅ Transcription completed', {
            visitId,
            transcriptLength: fullTranscript.length,
            confidence: Math.round(averageConfidence * 100) / 100,
            segmentCount
        });
        // Save transcript files to Storage
        await saveTranscriptFiles(uid, visitId, fullTranscript, transcriptionResult);
        // Update Firestore with transcription results
        await updateVisitStatus(visitId, 'summarizing', {
            transcriptionCompletedAt: new Date(),
            processing: {
                transcription: {
                    confidence: averageConfidence,
                    completedAt: new Date(),
                    service: 'google-stt-v2',
                    segmentCount,
                    transcriptLength: fullTranscript.length
                }
            }
        });
        // Publish message to summarization queue
        const summarizeMessage = {
            uid,
            visitId,
            transcript: fullTranscript,
            confidence: averageConfidence,
            timestamp: new Date().toISOString()
        };
        await pubsub.topic('summarize-request').publishMessage({
            json: summarizeMessage,
            attributes: {
                visitId,
                uid,
                timestamp: new Date().toISOString()
            }
        });
        firebase_functions_1.logger.info('📤 Published summarization request', {
            visitId,
            transcriptLength: fullTranscript.length
        });
    }
    catch (error) {
        firebase_functions_1.logger.error('❌ Transcription failed', {
            visitId,
            uid,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        // Update visit status to error
        await updateVisitStatus(visitId, 'error', {
            error: {
                step: 'transcription',
                message: error instanceof Error ? error.message : 'Transcription failed',
                retryCount: 0,
                lastRetry: new Date()
            }
        });
        // Optionally publish to dead letter queue for manual review
        try {
            await pubsub.topic('transcribe-request-dlq').publishMessage({
                json: { uid, visitId, gcsUri, language, error: error instanceof Error ? error.message : 'Unknown error' },
                attributes: {
                    visitId,
                    uid,
                    errorType: 'transcription_failed',
                    timestamp: new Date().toISOString()
                }
            });
        }
        catch (dlqError) {
            firebase_functions_1.logger.error('❌ Failed to publish to DLQ', { visitId, dlqError });
        }
    }
});
// Helper function to save transcript files to Storage
async function saveTranscriptFiles(uid, visitId, transcript, fullResult) {
    const bucket = storage.bucket();
    try {
        // Save clean transcript as text file
        const transcriptFile = bucket.file(`patient-visits/${uid}/${visitId}/transcript.txt`);
        await transcriptFile.save(transcript, {
            metadata: {
                contentType: 'text/plain',
                metadata: {
                    visitId,
                    uid,
                    createdAt: new Date().toISOString(),
                    type: 'transcript'
                }
            }
        });
        // Save full JSON response for debugging/analysis
        const jsonFile = bucket.file(`patient-visits/${uid}/${visitId}/transcript.json`);
        await jsonFile.save(JSON.stringify(fullResult, null, 2), {
            metadata: {
                contentType: 'application/json',
                metadata: {
                    visitId,
                    uid,
                    createdAt: new Date().toISOString(),
                    type: 'full_transcription_result'
                }
            }
        });
        firebase_functions_1.logger.info('💾 Transcript files saved to Storage', {
            visitId,
            transcriptPath: `patient-visits/${uid}/${visitId}/transcript.txt`,
            jsonPath: `patient-visits/${uid}/${visitId}/transcript.json`
        });
    }
    catch (saveError) {
        firebase_functions_1.logger.error('❌ Failed to save transcript files', {
            visitId,
            error: saveError instanceof Error ? saveError.message : 'Unknown error'
        });
        // Don't throw here - transcription was successful, file saving is secondary
    }
}
// Helper function to update visit status
async function updateVisitStatus(visitId, status, additionalData) {
    try {
        const visitRef = db.collection('visits').doc(visitId);
        const updateData = {
            status,
            updatedAt: new Date()
        };
        if (additionalData) {
            Object.assign(updateData, additionalData);
        }
        // Use merge to avoid failures if the document hasn't been created yet
        await visitRef.set(updateData, { merge: true });
        firebase_functions_1.logger.info('📝 Visit status updated', {
            visitId,
            status,
            additionalData: Object.keys(additionalData || {})
        });
    }
    catch (updateError) {
        firebase_functions_1.logger.error('❌ Failed to update visit status', {
            visitId,
            status,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
    }
}
