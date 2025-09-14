import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { getCurrentUser } from '@/lib/firebase';

export interface RecordingState {
  status: 'idle' | 'recording' | 'stopping' | 'uploading' | 'processing' | 'completed' | 'error';
  duration: number;
  progress?: number;
  error?: string;
  visitId?: string;
  results?: {
    transcript?: string;
    keyPoints?: string[];
    actionItems?: string[];
    urgencyLevel?: 'low' | 'medium' | 'high' | 'urgent';
  };
}

export interface UseVisitRecordingOptions {
  patientId: string;
  onComplete?: (visitId: string, results: any) => void;
  onError?: (error: string) => void;
}

export const useVisitRecording = ({ patientId, onComplete, onError }: UseVisitRecordingOptions) => {
  const [state, setState] = useState<RecordingState>({
    status: 'idle',
    duration: 0
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const firestoreUnsubscribeRef = useRef<(() => void) | null>(null);

  // Generate unique visit ID
  const generateVisitId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `visit_${timestamp}_${random}`;
  };

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('Microphone permission denied:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.name === 'NotAllowedError' 
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : 'Microphone not available. Please check your microphone connection.'
      }));
      return false;
    }
  };

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, status: 'recording', duration: 0, error: undefined }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder with optimal settings for speech
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000 // Good quality for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data collection
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = () => {
        uploadRecording();
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Recording failed. Please try again.'
        }));
      };

      // Start recording with 1-second chunks
      mediaRecorder.start(1000);

      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));
      }, 1000);

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : 'Failed to start recording. Please check your microphone and try again.'
      }));
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setState(prev => ({ ...prev, status: 'stopping' }));
      mediaRecorderRef.current.stop();
    }

    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Upload recording to Firebase Storage
  const uploadRecording = async () => {
    try {
      setState(prev => ({ ...prev, status: 'uploading' }));

      const user = getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create audio blob
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      
      if (audioBlob.size === 0) {
        throw new Error('No audio data recorded');
      }

      // Generate visit ID and create storage reference
      const visitId = generateVisitId();
      const storageRef = ref(storage, `patient-visits/${user.uid}/${visitId}/raw.webm`);

      // Upload to Firebase Storage
      await uploadBytes(storageRef, audioBlob);

      // Create Firestore document to track processing
      const visitDoc = {
        uid: user.uid,
        patientId,
        status: 'uploaded',
        metadata: {
          duration: state.duration,
          fileSize: audioBlob.size,
          language: 'en-US',
          uploadedAt: serverTimestamp(),
          mimeType: 'audio/webm'
        },
        processing: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'visits', visitId), visitDoc);

      // Listen for processing updates
      const unsubscribe = onSnapshot(doc(db, 'visits', visitId), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          
          const errorMessage = data.error?.message || (data.error ? JSON.stringify(data.error) : undefined);
          setState(prev => ({
            ...prev,
            visitId,
            status: data.status === 'ready' ? 'completed' : (data.status === 'error' ? 'error' : 'processing'),
            results: data.results || undefined,
            error: errorMessage
          }));

          // Call completion callback if processing is done
          if (data.status === 'ready' && onComplete) {
            onComplete(visitId, data.results);
          }

          // Call error callback if processing failed
          if (data.status === 'error' && onError) {
            onError(data.error?.message || (data.error ? JSON.stringify(data.error) : 'Processing failed'));
          }
        }
      });

      firestoreUnsubscribeRef.current = unsubscribe;

      setState(prev => ({ ...prev, status: 'processing', visitId }));

    } catch (error: any) {
      console.error('Failed to upload recording:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to upload recording. Please try again.'
      }));
    }
  };

  // Reset recording state
  const reset = useCallback(() => {
    // Clean up any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Clear timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Unsubscribe from Firestore updates
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }

    // Reset state
    setState({
      status: 'idle',
      duration: 0
    });

    // Clear chunks
    chunksRef.current = [];
  }, []);

  // Check if recording is supported
  const isSupported = !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );

  return {
    state,
    startRecording,
    stopRecording,
    reset,
    requestMicrophonePermission,
    isSupported
  };
};