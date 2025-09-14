# Speech-to-Text API Debugging Guide

## Issue Summary

The visit summary recording feature is failing because the Google Speech-to-Text API returns successful responses but with empty transcriptions. This document provides a comprehensive debugging approach.

## Current Problem Analysis

### Console Log Evidence
```
🎤 API Response: {success: true, data: {…}}
🎤 API Response structure: {success: true, hasData: true, dataKeys: Array(3), transcription: '', transcriptionLength: 0, ...}
✅ Audio transcription API response received
🎯 Confidence: 0%
⚠️ Empty transcription received from API
```

### Key Findings
1. ✅ Microphone access works
2. ✅ Audio recording captures data (146KB, ~9 seconds)
3. ✅ Backend API receives the request
4. ✅ Google Speech-to-Text API responds successfully
5. ❌ **Transcription is empty despite successful API response**

## Root Cause Hypotheses

### 1. Audio Format/Encoding Issues
**Problem**: Mismatch between recorded audio format and Speech-to-Text expectations

**Evidence**:
- Frontend records: `audio/webm;codecs=opus`
- Backend expects: `WEBM_OPUS` at 48000 Hz
- Potential sample rate mismatch or encoding artifacts

### 2. Audio Quality Issues
**Problem**: Audio contains silence, is too quiet, or has poor quality

**Evidence**:
- 146KB for 9 seconds suggests very low bitrate
- Confidence level is 0%, indicating poor audio quality

### 3. Google Cloud Configuration Issues
**Problem**: API quotas, permissions, or regional restrictions

**Evidence**:
- Need to check Speech-to-Text API usage logs
- Verify service account permissions
- Check API quotas and billing

## Debugging Steps

### Step 1: Check Google Cloud Speech-to-Text API Logs

1. Go to Google Cloud Console → claritystream-uldp9 project
2. Navigate to **Logging** → **Logs Explorer**
3. Use this filter to find Speech-to-Text API calls:
```
resource.type="cloud_function"
resource.labels.function_name="api"
resource.labels.region="us-central1"
jsonPayload.message=~"Speech-to-Text"
```

4. Look for these specific log entries:
   - API request details
   - Response structure
   - Error messages
   - Audio processing information

### Step 2: Audio Format Debugging Script

Create `debug-audio-format.cjs`:
```javascript
const admin = require('firebase-admin');

async function debugAudioFormat() {
  try {
    console.log('🧪 Testing different audio configurations...');
    
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();
    
    // Test different configurations
    const configs = [
      {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        model: 'latest_long'
      },
      {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 16000,
        model: 'latest_short'
      },
      {
        encoding: 'OGG_OPUS',
        sampleRateHertz: 48000,
        model: 'latest_long'
      }
    ];
    
    // Create test audio (silence)
    const testAudio = Buffer.alloc(1024, 0);
    
    for (const config of configs) {
      console.log(`\n🔧 Testing config:`, config);
      
      try {
        const request = {
          audio: { content: testAudio },
          config: {
            ...config,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            useEnhanced: true
          }
        };
        
        const [response] = await client.recognize(request);
        console.log(`✅ Config works:`, {
          resultsCount: response.results?.length || 0,
          hasTranscription: !!(response.results?.[0]?.alternatives?.[0]?.transcript)
        });
        
      } catch (error) {
        console.log(`❌ Config failed:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAudioFormat();
```

### Step 3: Enhanced Backend Logging

Add this enhanced logging to the transcription endpoint in `functions/src/index.ts`:

```typescript
// Add before the Speech-to-Text API call
console.log('🎤 Enhanced Audio Analysis:', {
  audioBufferSize: audioBuffer.length,
  audioBufferFirst100Bytes: audioBuffer.slice(0, 100).toString('hex'),
  audioBufferLast100Bytes: audioBuffer.slice(-100).toString('hex'),
  isAllZeros: audioBuffer.every(byte => byte === 0),
  hasNonZeroBytes: audioBuffer.some(byte => byte !== 0),
  averageValue: audioBuffer.reduce((sum, byte) => sum + byte, 0) / audioBuffer.length
});

// Add after the Speech-to-Text API call
console.log('🎤 Detailed API Response:', {
  fullResponse: JSON.stringify(response, null, 2),
  resultsArray: response.results,
  firstResultDetails: response.results?.[0] ? {
    alternatives: response.results[0].alternatives,
    isFinal: response.results[0].isFinal,
    stability: response.results[0].stability,
    resultEndTime: response.results[0].resultEndTime
  } : null
});
```

### Step 4: Frontend Audio Quality Check

Add this debugging to `VisitSummaryForm.tsx` before sending audio:

```typescript
// Add after audioBlob creation
console.log('🎤 Frontend Audio Analysis:', {
  blobSize: audioBlob.size,
  blobType: audioBlob.type,
  estimatedBitrate: Math.round((audioBlob.size * 8) / (9 * 1000)), // bits per second
  chunks: audioChunksRef.current.map(chunk => ({
    size: chunk.size,
    type: chunk.type
  }))
});

// Test if audio contains actual data
const reader = new FileReader();
reader.onload = function(e) {
  const arrayBuffer = e.target?.result as ArrayBuffer;
  const uint8Array = new Uint8Array(arrayBuffer);
  
  console.log('🎤 Audio Content Analysis:', {
    totalBytes: uint8Array.length,
    nonZeroBytes: uint8Array.filter(byte => byte !== 0).length,
    averageValue: uint8Array.reduce((sum, byte) => sum + byte, 0) / uint8Array.length,
    firstBytes: Array.from(uint8Array.slice(0, 20)),
    lastBytes: Array.from(uint8Array.slice(-20))
  });
};
reader.readAsArrayBuffer(audioBlob);
```

## Immediate Action Plan

### Phase 1: Verify API Configuration
1. Check Google Cloud Console Speech-to-Text API logs
2. Verify API is enabled and has proper quotas
3. Check service account permissions

### Phase 2: Test Audio Pipeline
1. Run the audio format debugging script
2. Add enhanced logging to backend
3. Test with known good audio samples

### Phase 3: Fix Audio Quality Issues
1. Implement audio level detection before recording
2. Add audio visualization to show recording activity
3. Test different MediaRecorder configurations

### Phase 4: Implement Fallbacks
1. Add retry logic with different configurations
2. Implement client-side audio validation
3. Add manual text input as fallback

## Expected Outcomes

After running these debugging steps, you should be able to:

1. **Identify the exact failure point** in the Speech-to-Text pipeline
2. **Determine if the issue is** audio quality, format, or API configuration
3. **See specific error messages** from Google Cloud logs
4. **Implement targeted fixes** based on the findings

## Next Steps

Once you've run the debugging steps and gathered the logs:

1. Share the Google Cloud Speech-to-Text API logs
2. Run the audio format debugging script
3. Test with the enhanced logging enabled
4. Based on findings, we can implement specific fixes

## Common Solutions

Based on the debugging results, common fixes include:

### If Audio Quality Issue:
- Implement audio level monitoring
- Add recording quality validation
- Improve microphone settings

### If Format Issue:
- Change MediaRecorder configuration
- Try different audio encodings
- Adjust sample rates

### If API Configuration Issue:
- Update service account permissions
- Check API quotas and billing
- Verify regional settings

## Testing Checklist

- [ ] Google Cloud Speech-to-Text API logs reviewed
- [ ] Audio format debugging script executed
- [ ] Enhanced backend logging implemented
- [ ] Frontend audio analysis added
- [ ] Test recordings with known speech content
- [ ] Verify microphone permissions and settings
- [ ] Check network connectivity during recording
- [ ] Test with different browsers/devices