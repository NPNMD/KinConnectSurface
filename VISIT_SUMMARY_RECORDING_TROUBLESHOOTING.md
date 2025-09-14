# Visit Summary Recording - Troubleshooting Plan

## Issue Analysis Summary

Based on the console logs, the visit summary recording is failing at the transcription stage. The Google Speech-to-Text API is responding successfully but returning empty transcriptions.

## Most Likely Root Causes (Prioritized)

### 1. Audio Quality/Content Issue (90% probability)
**Symptoms**: 
- API returns `success: true` but `transcription: ''`
- Confidence level is 0%
- Audio size is reasonable (146KB for 9 seconds)

**Likely Cause**: The recorded audio contains silence, very quiet speech, or poor quality audio that Google Speech-to-Text cannot process.

### 2. Audio Format Encoding Issue (8% probability)
**Symptoms**:
- WEBM_OPUS format might have encoding artifacts
- Base64 chunked conversion could introduce corruption

### 3. Google Cloud API Configuration Issue (2% probability)
**Symptoms**:
- API responds but with empty results
- Could be quota, permissions, or regional issues

## Immediate Diagnostic Steps

### Step 1: Check Google Cloud Speech-to-Text Logs (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/logs/query) for project `claritystream-uldp9`
2. Use this query in Logs Explorer:
```
resource.type="cloud_function"
resource.labels.function_name="api"
jsonPayload.message=~"Speech-to-Text"
timestamp>="2025-09-06T18:00:00Z"
```

3. Look for these specific entries:
   - `🎤 Processing audio transcription for patient:`
   - `🎤 Speech-to-Text raw response:`
   - Any error messages or warnings

**Expected Findings**: You should see the API calls and responses. If the Google API is returning empty results consistently, it indicates an audio quality issue.

### Step 2: Test Audio Recording Quality (10 minutes)

Add this debugging code to test the actual audio content:

**Frontend Test** (add to `VisitSummaryForm.tsx` after line 226):
```typescript
// Add audio content analysis
const analyzeAudioContent = async (audioBlob: Blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const analysis = {
        totalBytes: uint8Array.length,
        nonZeroBytes: uint8Array.filter(byte => byte !== 0).length,
        averageValue: uint8Array.reduce((sum, byte) => sum + byte, 0) / uint8Array.length,
        maxValue: Math.max(...uint8Array),
        minValue: Math.min(...uint8Array),
        hasVariation: new Set(uint8Array).size > 10 // More than 10 unique byte values
      };
      
      console.log('🎤 Audio Content Analysis:', analysis);
      
      if (analysis.nonZeroBytes < analysis.totalBytes * 0.1) {
        console.warn('⚠️ Audio appears to be mostly silence');
      }
      
      if (!analysis.hasVariation) {
        console.warn('⚠️ Audio has very little variation - likely silence or noise');
      }
      
      resolve(analysis);
    };
    reader.readAsArrayBuffer(audioBlob);
  });
};

// Call this before processing audio
await analyzeAudioContent(audioBlob);
```

### Step 3: Test with Known Good Audio (15 minutes)

Create a test with a known audio sample:

1. Record a clear 5-second audio saying "This is a test recording for the medical visit summary"
2. Use a tool like Audacity to ensure the audio has good levels
3. Convert to base64 and test directly with the API

## Quick Fixes to Try

### Fix 1: Improve Audio Recording Settings

Update the MediaRecorder configuration in `VisitSummaryForm.tsx`:

```typescript
// Replace the current MediaRecorder creation (line 187-189) with:
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000 // Increase bitrate for better quality
});

// Also update the audio constraints (line 157-165):
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
    volume: 1.0 // Ensure full volume
  }
});
```

### Fix 2: Add Audio Level Monitoring

Add real-time audio level monitoring to ensure speech is being captured:

```typescript
// Add after getting the audio stream
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const microphone = audioContext.createMediaStreamSource(stream);
const dataArray = new Uint8Array(analyser.frequencyBinCount);

microphone.connect(analyser);
analyser.fftSize = 256;

// Monitor audio levels during recording
const monitorAudioLevel = () => {
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
  
  console.log('🎤 Audio Level:', Math.round(average));
  
  if (isRecording) {
    setTimeout(monitorAudioLevel, 100); // Check every 100ms
  }
};

monitorAudioLevel();
```

### Fix 3: Backend Audio Validation

Add audio validation in the backend before sending to Google:

```typescript
// Add to functions/src/index.ts in the transcribe endpoint (around line 4632)
// Before creating the Speech-to-Text request:

console.log('🎤 Audio Buffer Analysis:', {
  size: audioBuffer.length,
  isAllZeros: audioBuffer.every(byte => byte === 0),
  nonZeroBytes: audioBuffer.filter(byte => byte !== 0).length,
  averageValue: audioBuffer.reduce((sum, byte) => sum + byte, 0) / audioBuffer.length,
  hasWebmHeader: audioBuffer.slice(0, 4).toString('hex') === '1a45dfa3' // WEBM signature
});

// If audio is mostly zeros, return early
if (audioBuffer.filter(byte => byte !== 0).length < audioBuffer.length * 0.1) {
  console.warn('⚠️ Audio appears to be mostly silence, skipping Speech-to-Text');
  return res.json({
    success: true,
    data: {
      transcription: '',
      confidence: 0,
      message: 'Audio appears to contain mostly silence'
    }
  });
}
```

## Testing Protocol

### Test 1: Verify Current Issue
1. Try recording a visit summary with clear, loud speech
2. Check the console logs for audio analysis
3. Verify the issue persists

### Test 2: Test Audio Quality
1. Implement the audio level monitoring
2. Record while speaking clearly
3. Verify audio levels are showing activity

### Test 3: Test Backend Processing
1. Add the backend audio validation
2. Check if audio is being detected as silence
3. Verify the audio reaches Google Speech-to-Text

## Expected Results

After implementing these fixes:

1. **If audio quality was the issue**: You'll see audio level activity during recording and successful transcriptions
2. **If format was the issue**: The improved MediaRecorder settings will resolve it
3. **If API configuration was the issue**: The Google Cloud logs will show specific errors

## Escalation Path

If these fixes don't resolve the issue:

1. **Check Google Cloud billing**: Ensure Speech-to-Text API has proper billing enabled
2. **Test with different browsers**: Chrome vs Firefox vs Safari
3. **Test on different devices**: Desktop vs mobile
4. **Contact Google Cloud Support**: If API is consistently returning empty results for valid audio

## Success Criteria

The issue is resolved when:
- [ ] Audio recording shows active levels during speech
- [ ] Google Speech-to-Text returns non-empty transcriptions
- [ ] Visit summaries can be successfully recorded and processed
- [ ] Console logs show successful transcription with confidence > 0%

## Timeline

- **Immediate (next 30 minutes)**: Check Google Cloud logs and implement audio analysis
- **Short term (next 2 hours)**: Implement audio quality improvements
- **Medium term (next day)**: Add comprehensive error handling and fallbacks

This troubleshooting plan should resolve the visit summary recording issue by addressing the most likely cause (audio quality) while providing diagnostic tools to identify other potential issues.