"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVisitUpload = void 0;
exports.updateVisitStatus = updateVisitStatus;
exports.validateVisitDocument = validateVisitDocument;
const storage_1 = require("firebase-functions/v2/storage");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const pubsub_1 = require("@google-cloud/pubsub");
const firebase_functions_1 = require("firebase-functions");
// Initialize Firebase Admin if not already initialized
try {
    (0, app_1.initializeApp)();
}
catch (error) {
    // App already initialized
}
const db = (0, firestore_1.getFirestore)();
const pubsub = new pubsub_1.PubSub();
// Cloud Function triggered when audio files are uploaded to Storage
exports.processVisitUpload = (0, storage_1.onObjectFinalized)({
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
}, async (event) => {
    const filePath = event.data.name;
    const bucket = event.data.bucket;
    firebase_functions_1.logger.info('🎤 Visit upload trigger started', {
        filePath,
        bucket,
        size: event.data.size,
        contentType: event.data.contentType
    });
    // Parse file path: patient-visits/{uid}/{visitId}/raw.webm
    const pathParts = filePath.split('/');
    if (pathParts.length !== 4 || pathParts[0] !== 'patient-visits' || pathParts[3] !== 'raw.webm') {
        firebase_functions_1.logger.info('⏭️ Skipping non-visit audio file', { filePath });
        return;
    }
    const [, uid, visitId] = pathParts;
    firebase_functions_1.logger.info('📋 Processing visit upload', {
        uid,
        visitId,
        fileSize: event.data.size
    });
    try {
        // Validate file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB
        const fileSize = typeof event.data.size === 'string' ? parseInt(event.data.size) : event.data.size;
        if (fileSize > maxSize) {
            firebase_functions_1.logger.error('❌ File too large', {
                visitId,
                size: fileSize,
                maxSize
            });
            await updateVisitStatus(visitId, 'error', {
                step: 'validation',
                message: 'File size exceeds 100MB limit',
                retryCount: 0
            });
            return;
        }
        // Validate content type
        const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg'];
        if (!allowedTypes.includes(event.data.contentType || '')) {
            firebase_functions_1.logger.warn('⚠️ Unexpected content type', {
                visitId,
                contentType: event.data.contentType,
                allowedTypes
            });
        }
        // Update Firestore document status
        await updateVisitStatus(visitId, 'transcribing', undefined, {
            uploadCompletedAt: new Date(),
            fileSize: fileSize,
            contentType: event.data.contentType
        });
        // Publish message to transcription queue
        const transcribeMessage = {
            uid,
            visitId,
            gcsUri: `gs://${bucket}/${filePath}`,
            language: 'en-US',
            timestamp: new Date().toISOString()
        };
        firebase_functions_1.logger.info('📤 Publishing transcription request', transcribeMessage);
        await pubsub.topic('transcribe-request').publishMessage({
            json: transcribeMessage,
            attributes: {
                visitId,
                uid,
                timestamp: new Date().toISOString()
            }
        });
        firebase_functions_1.logger.info('✅ Visit upload processing initiated successfully', {
            visitId,
            uid,
            nextStep: 'transcription'
        });
    }
    catch (error) {
        firebase_functions_1.logger.error('❌ Error processing visit upload', {
            visitId,
            uid,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        // Update visit status to error
        await updateVisitStatus(visitId, 'error', {
            step: 'upload_processing',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            retryCount: 0
        });
    }
});
// Helper function to update visit status in Firestore
async function updateVisitStatus(visitId, status, error, additionalData) {
    try {
        const visitRef = db.collection('visits').doc(visitId);
        const updateData = {
            status,
            updatedAt: new Date()
        };
        if (error) {
            updateData.error = {
                ...error,
                lastRetry: new Date()
            };
        }
        if (additionalData) {
            Object.assign(updateData, additionalData);
        }
        // Use merge to avoid failures if doc not yet created
        await visitRef.set(updateData, { merge: true });
        firebase_functions_1.logger.info('📝 Visit status updated', {
            visitId,
            status,
            error: error?.message,
            additionalData
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
// Helper function to validate visit document exists
async function validateVisitDocument(visitId) {
    try {
        const visitDoc = await db.collection('visits').doc(visitId).get();
        return visitDoc.exists;
    }
    catch (error) {
        firebase_functions_1.logger.error('❌ Error validating visit document', {
            visitId,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
}
