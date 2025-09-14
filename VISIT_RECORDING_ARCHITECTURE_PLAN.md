# Visit Recording Architecture Plan

## Executive Summary

**Current Problem**: The existing recording implementation in [`VisitSummaryForm.tsx`](client/src/components/VisitSummaryForm.tsx) is overly complex (1,810 lines) with browser-based speech recognition that's unreliable and hard to maintain.

**Proposed Solution**: Migrate to a cloud-based architecture using Firebase Storage + Cloud Functions + Google Speech-to-Text v2 + Vertex AI for a robust, scalable recording and transcription pipeline.

**Assessment**: ✅ **Your proposed architecture is excellent and significantly better than the current implementation.**

## Current Implementation Analysis

### Issues Identified
- **Complexity**: 1,810 lines of complex audio handling code
- **Reliability**: Browser Speech Recognition API inconsistent across browsers
- **Scalability**: Client-side processing limits quality and performance
- **Maintenance**: Multiple failure points with complex state management
- **User Experience**: Inconsistent microphone handling and error states

### Current Flow Problems
```
Browser → Web Speech API → Local Processing → API Call
   ↓           ↓              ↓              ↓
Unreliable  Limited      Resource      Complex
Support     Quality      Intensive     Error Handling
```

## Proposed Architecture (RECOMMENDED)

### High-Level Flow
```
Frontend (React + Firebase SDK)
    ↓ Mic permission → record (MediaRecorder) → stop → preview → upload
Firebase Storage
    ↓ Storage finalize trigger
Cloud Function (Upload Handler)
    ↓ Validate + flip status + publish message
Pub/Sub → Speech-to-Text Worker
    ↓ Transcribe + publish next message
Pub/Sub → Summarization Worker (Vertex AI)
    ↓ Generate summary + publish next message
Pub/Sub → TTS Worker (Optional)
    ↓ Generate audio summary
Firestore (Real-time status updates)
```

## Detailed Architecture Design

### 1. Frontend Recording Flow (Simplified)

**New Implementation** (~200 lines vs current 1,810 lines):

```typescript
// Simplified recording component
interface RecordingState {
  status: 'idle' | 'recording' | 'uploading' | 'processing' | 'completed' | 'error';
  duration: number;
  progress?: number;
  error?: string;
}

const useSimpleRecording = () => {
  const [state, setState] = useState<RecordingState>({ status: 'idle', duration: 0 });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    // 1. Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 2. Create MediaRecorder with optimal settings
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus', // Optimal for speech
      audioBitsPerSecond: 64000 // Good quality for speech
    });
    
    // 3. Simple event handlers
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    
    mediaRecorder.onstop = () => uploadRecording();
    
    // 4. Start recording
    mediaRecorder.start(1000); // 1-second chunks
    setState({ status: 'recording', duration: 0 });
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const uploadRecording = async () => {
    setState({ status: 'uploading', duration: state.duration });
    
    // Create audio blob
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    
    // Upload to Firebase Storage
    const visitId = generateVisitId();
    const storageRef = ref(storage, `patient-visits/${uid}/${visitId}/raw.webm`);
    
    await uploadBytes(storageRef, audioBlob);
    
    // Create Firestore document to track processing
    await setDoc(doc(firestore, 'visits', visitId), {
      uid,
      status: 'uploaded',
      metadata: {
        duration: state.duration,
        fileSize: audioBlob.size,
        language: 'en-US',
        uploadedAt: serverTimestamp()
      }
    });
    
    setState({ status: 'processing', duration: state.duration });
  };
};
```

### 2. Firebase Storage Strategy

**File Organization**:
```
patient-visits/{uid}/{visitId}/
├── raw.webm                    # Original recording
├── transcript.json             # Full STT response with confidence
├── transcript.txt              # Clean text for display
├── summary.json               # AI-generated structured summary
├── summary.md                 # Patient-friendly markdown
└── summary.mp3               # Optional TTS audio (if enabled)
```

**Storage Rules**:
```javascript
// Firebase Storage Security Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /patient-visits/{uid}/{visitId}/{file} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null && 
        exists(/databases/(default)/documents/family-access/$(request.auth.uid + '_' + uid));
    }
  }
}
```

### 3. Firestore Document Structure

**Visit Document** (`visits/{visitId}`):
```typescript
interface VisitDocument {
  uid: string;
  status: 'uploaded' | 'transcribing' | 'summarizing' | 'tts' | 'ready' | 'error';
  
  metadata: {
    duration: number;           // Recording duration in seconds
    fileSize: number;          // File size in bytes
    language: string;          // Language code (e.g., 'en-US')
    uploadedAt: Timestamp;     // When uploaded
    visitDate?: Timestamp;     // Actual visit date
    providerName?: string;     // Healthcare provider
    visitType?: string;        // Type of visit
  };
  
  processing: {
    transcription?: {
      confidence: number;      // Overall confidence score
      completedAt: Timestamp;
      service: 'google-stt-v2';
    };
    summarization?: {
      completedAt: Timestamp;
      service: 'vertex-ai';
      model: string;
    };
    tts?: {
      completedAt: Timestamp;
      voice: string;
    };
  };
  
  results?: {
    transcript: string;        // Clean transcript text
    keyPoints: string[];       // AI-extracted key points
    actionItems: string[];     // Patient action items
    medications: {             // Medication changes
      new: MedicationChange[];
      stopped: MedicationChange[];
      modified: MedicationChange[];
    };
    followUp?: {
      required: boolean;
      date?: Timestamp;
      instructions?: string;
    };
    urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  };
  
  error?: {
    step: string;             // Which step failed
    message: string;          // Error message
    retryCount: number;       // Number of retries attempted
    lastRetry: Timestamp;
  };
  
  // Family sharing
  sharedWithFamily: boolean;
  familyAccessLevel: 'full' | 'summary_only' | 'restricted' | 'none';
}
```

### 4. Cloud Function Trigger

**Upload Handler** (`functions/src/visitUploadTrigger.ts`):
```typescript
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { PubSub } from '@google-cloud/pubsub';

export const processVisitUpload = onObjectFinalized({
  bucket: 'your-project.appspot.com',
  region: 'us-central1'
}, async (event) => {
  const filePath = event.data.name; // patient-visits/{uid}/{visitId}/raw.webm
  
  // Parse file path
  const pathParts = filePath.split('/');
  if (pathParts.length !== 4 || pathParts[3] !== 'raw.webm') return;
  
  const [, uid, visitId] = pathParts;
  
  // Validate file
  const fileSize = event.data.size;
  if (fileSize > 100 * 1024 * 1024) { // 100MB limit
    await updateVisitStatus(visitId, 'error', 'File too large');
    return;
  }
  
  // Update Firestore status
  await updateVisitStatus(visitId, 'transcribing');
  
  // Publish to transcription queue
  const pubsub = new PubSub();
  await pubsub.topic('transcribe-request').publishMessage({
    json: {
      uid,
      visitId,
      gcsUri: `gs://${event.data.bucket}/${filePath}`,
      language: 'en-US'
    }
  });
});
```

### 5. Pub/Sub Topic Structure

**Topics**:
- `transcribe-request` → Speech-to-Text Worker
- `summarize-request` → AI Summarization Worker  
- `tts-request` → Text-to-Speech Worker (optional)

**Dead Letter Queues**:
- `transcribe-request-dlq`
- `summarize-request-dlq`
- `tts-request-dlq`

### 6. Speech-to-Text Worker (Cloud Run)

**Configuration**:
```typescript
// Optimal STT configuration for medical visits
const sttConfig = {
  model: 'latest_long',                    // Best for longer recordings
  languageCode: 'en-US',
  enableAutomaticPunctuation: true,
  enableSpeakerDiarization: false,         // Usually single speaker
  audioChannelCount: 1,
  sampleRateHertz: 48000,
  
  // Medical context for better accuracy
  speechContexts: [{
    phrases: [
      'blood pressure', 'heart rate', 'temperature',
      'medication', 'prescription', 'dosage',
      'follow up', 'appointment', 'symptoms',
      'diagnosis', 'treatment', 'therapy'
    ],
    boost: 10.0
  }]
};
```

### 7. AI Summarization Worker (Vertex AI)

**Prompt Template**:
```typescript
const MEDICAL_SUMMARY_PROMPT = `
You are a medical AI assistant. Analyze this visit transcript and provide:

1. KEY POINTS (3-5 bullet points of main findings)
2. ACTION ITEMS (specific tasks for patient/family)
3. MEDICATION CHANGES (new, stopped, or modified medications)
4. FOLLOW-UP REQUIREMENTS (if any)
5. URGENCY LEVEL (low/medium/high/urgent)

Transcript: {transcript}

Respond in JSON format:
{
  "keyPoints": ["point1", "point2"],
  "actionItems": ["action1", "action2"],
  "medications": {
    "new": [{"name": "...", "dosage": "...", "instructions": "..."}],
    "stopped": [...],
    "modified": [...]
  },
  "followUp": {
    "required": boolean,
    "timeframe": "...",
    "instructions": "..."
  },
  "urgencyLevel": "low|medium|high|urgent"
}
`;
```

## Cost Optimization Strategies

### Storage Lifecycle
```javascript
// Lifecycle rules for cost optimization
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["patient-visits/", "raw.webm"]
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["patient-visits/"]
        }
      }
    ]
  }
}
```

### Processing Optimization
- **Audio Format**: Use Opus codec in WebM for 50% smaller files
- **STT Model**: Use `latest_long` only for recordings > 1 minute
- **Batch Processing**: Process multiple requests together when possible
- **Caching**: Cache common medical terms and phrases

## Development Setup Checklist

### Firebase Project Setup
- [ ] Enable Cloud Storage
- [ ] Enable Firestore
- [ ] Enable Cloud Functions
- [ ] Enable Pub/Sub
- [ ] Configure IAM roles

### Google Cloud APIs
- [ ] Speech-to-Text API v2
- [ ] Vertex AI API
- [ ] Text-to-Speech API (optional)
- [ ] Cloud Run API

### Service Accounts
- [ ] Create service account with minimal permissions:
  - `storage.objectViewer`
  - `pubsub.publisher`
  - `pubsub.subscriber`
  - `speech.client`
  - `aiplatform.user`

### Environment Variables
```bash
# Cloud Functions
GOOGLE_CLOUD_PROJECT=your-project-id
STORAGE_BUCKET=your-project.appspot.com
PUBSUB_TRANSCRIBE_TOPIC=transcribe-request
PUBSUB_SUMMARIZE_TOPIC=summarize-request

# Cloud Run Workers
STT_MODEL=latest_long
VERTEX_AI_MODEL=gemini-pro
TTS_VOICE=en-US-Neural2-C
```

## Migration Strategy

### Phase 1: Parallel Implementation (Week 1)
- [ ] Create new simplified recording component
- [ ] Set up Firebase Storage and Firestore structure
- [ ] Deploy basic Cloud Function trigger
- [ ] Test end-to-end with simple transcription

### Phase 2: Core Processing (Week 2)
- [ ] Implement STT worker with medical context
- [ ] Add basic AI summarization
- [ ] Implement error handling and retries
- [ ] Add real-time status updates

### Phase 3: Feature Parity (Week 3)
- [ ] Add advanced AI features (medication detection, urgency assessment)
- [ ] Implement TTS worker
- [ ] Add family sharing controls
- [ ] Performance optimization

### Phase 4: Migration & Cleanup (Week 4)
- [ ] A/B test new vs old implementation
- [ ] Migrate existing users
- [ ] Remove old complex recording code
- [ ] Monitor and optimize costs

## Testing Strategy

### Unit Tests
- [ ] Recording component state management
- [ ] Audio blob creation and validation
- [ ] Firebase Storage upload logic
- [ ] Firestore document updates

### Integration Tests
- [ ] End-to-end recording → transcription → summarization
- [ ] Error handling and retry mechanisms
- [ ] Family access controls
- [ ] Real-time status updates

### Load Testing
- [ ] Concurrent uploads
- [ ] Processing queue performance
- [ ] Cost analysis under load

## Success Metrics

### Technical Metrics
- **Code Complexity**: Reduce from 1,810 lines to ~200 lines
- **Reliability**: > 99% successful transcriptions
- **Performance**: < 30 seconds average processing time
- **Error Rate**: < 1% unrecoverable errors

### User Experience Metrics
- **Recording Success Rate**: > 95%
- **Transcription Accuracy**: > 90% for medical content
- **User Satisfaction**: Measured via feedback

### Cost Metrics
- **Storage Costs**: < $0.10 per visit
- **Processing Costs**: < $0.50 per visit
- **Total Cost**: < $1.00 per visit including all services

## Conclusion

Your proposed architecture is **significantly superior** to the current implementation:

✅ **Simplified Frontend**: 200 lines vs 1,810 lines
✅ **Better Reliability**: Cloud services vs browser APIs  
✅ **Improved Scalability**: Auto-scaling workers vs client processing
✅ **Enhanced Quality**: Medical-optimized STT vs generic browser recognition
✅ **Real-time Updates**: Firestore vs complex state management
✅ **Cost Effective**: Pay-per-use vs always-on complexity

**Recommendation**: Proceed with the proposed architecture immediately. It addresses all current pain points and provides a robust foundation for future enhancements.