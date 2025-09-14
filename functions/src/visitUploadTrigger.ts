import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { logger } from 'firebase-functions';

// Initialize Firebase Admin if not already initialized
try {
  initializeApp();
} catch (error) {
  // App already initialized
}

const db = getFirestore();
const pubsub = new PubSub();

// Cloud Function triggered when audio files are uploaded to Storage
export const processVisitUpload = onObjectFinalized({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60
}, async (event) => {
  const filePath = event.data.name;
  const bucket = event.data.bucket;
  
  logger.info('🎤 Visit upload trigger started', {
    filePath,
    bucket,
    size: event.data.size,
    contentType: event.data.contentType
  });

  // Parse file path: patient-visits/{uid}/{visitId}/raw.webm
  const pathParts = filePath.split('/');
  if (pathParts.length !== 4 || pathParts[0] !== 'patient-visits' || pathParts[3] !== 'raw.webm') {
    logger.info('⏭️ Skipping non-visit audio file', { filePath });
    return;
  }

  const [, uid, visitId] = pathParts;
  
  logger.info('📋 Processing visit upload', {
    uid,
    visitId,
    fileSize: event.data.size
  });

  try {
    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    const fileSize = typeof event.data.size === 'string' ? parseInt(event.data.size) : event.data.size;
    if (fileSize > maxSize) {
      logger.error('❌ File too large', {
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
      logger.warn('⚠️ Unexpected content type', {
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

    logger.info('📤 Publishing transcription request', transcribeMessage);

    await pubsub.topic('transcribe-request').publishMessage({
      json: transcribeMessage,
      attributes: {
        visitId,
        uid,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('✅ Visit upload processing initiated successfully', {
      visitId,
      uid,
      nextStep: 'transcription'
    });

  } catch (error) {
    logger.error('❌ Error processing visit upload', {
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
async function updateVisitStatus(
  visitId: string, 
  status: string, 
  error?: { step: string; message: string; retryCount: number },
  additionalData?: Record<string, any>
) {
  try {
    const visitRef = db.collection('visits').doc(visitId);
    
    const updateData: any = {
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
    
    logger.info('📝 Visit status updated', {
      visitId,
      status,
      error: error?.message,
      additionalData
    });

  } catch (updateError) {
    logger.error('❌ Failed to update visit status', {
      visitId,
      status,
      error: updateError instanceof Error ? updateError.message : 'Unknown error'
    });
  }
}

// Helper function to validate visit document exists
async function validateVisitDocument(visitId: string): Promise<boolean> {
  try {
    const visitDoc = await db.collection('visits').doc(visitId).get();
    return visitDoc.exists;
  } catch (error) {
    logger.error('❌ Error validating visit document', {
      visitId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

// Export helper functions for testing
export { updateVisitStatus, validateVisitDocument };