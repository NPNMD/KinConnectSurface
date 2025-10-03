import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  FileAudio,
  User
} from 'lucide-react';
import { useVisitRecording } from '@/hooks/useVisitRecording';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import type { HealthcareProvider } from '@shared/types';

interface SimpleVisitRecorderProps {
  patientId: string;
  onComplete?: (visitId: string, results: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function SimpleVisitRecorder({
  patientId,
  onComplete,
  onError,
  className = ''
}: SimpleVisitRecorderProps) {
  const [providers, setProviders] = useState<HealthcareProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedProviderName, setSelectedProviderName] = useState<string>('');
  const [selectedProviderSpecialty, setSelectedProviderSpecialty] = useState<string>('');

  // Load healthcare providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoadingProviders(true);
        const response = await apiClient.get<{ success: boolean; data: HealthcareProvider[] }>(
          API_ENDPOINTS.HEALTHCARE_PROVIDERS(patientId)
        );
        
        if (response.success && response.data) {
          setProviders(response.data);
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProviders();
  }, [patientId]);

  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    setSelectedProviderId(providerId);
    if (providerId) {
      const provider = providers.find(p => p.id === providerId);
      if (provider) {
        setSelectedProviderName(provider.name);
        setSelectedProviderSpecialty(provider.specialty || '');
      }
    } else {
      setSelectedProviderName('');
      setSelectedProviderSpecialty('');
    }
  };

  const { state, startRecording, stopRecording, reset, requestMicrophonePermission, isSupported } = useVisitRecording({
    patientId,
    providerId: selectedProviderId || undefined,
    providerName: selectedProviderName || undefined,
    providerSpecialty: selectedProviderSpecialty || undefined,
    onComplete,
    onError
  });

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    switch (state.status) {
      case 'idle':
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: <Mic className="w-5 h-5" />,
          text: 'Ready to Record'
        };
      case 'recording':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />,
          text: 'Recording...'
        };
      case 'stopping':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          icon: <Square className="w-5 h-5" />,
          text: 'Stopping...'
        };
      case 'uploading':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: <Upload className="w-5 h-5" />,
          text: 'Uploading...'
        };
      case 'processing':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          text: 'Processing with AI...'
        };
      case 'completed':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: <CheckCircle className="w-5 h-5" />,
          text: 'Completed!'
        };
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: <AlertCircle className="w-5 h-5" />,
          text: 'Error'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: <Mic className="w-5 h-5" />,
          text: 'Ready'
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const isRecording = state.status === 'recording';
  const isProcessing = ['stopping', 'uploading', 'processing'].includes(state.status);
  const canRecord = state.status === 'idle';
  const canStop = state.status === 'recording';

  // Handle record button click
  const handleRecordClick = async () => {
    if (canRecord) {
      // Request permission first if needed
      const hasPermission = await requestMicrophonePermission();
      if (hasPermission) {
        startRecording();
      }
    } else if (canStop) {
      stopRecording();
    }
  };

  // Show browser compatibility warning
  if (!isSupported) {
    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-yellow-800">
              Recording Not Supported
            </div>
            <div className="text-xs text-yellow-700 mt-1">
              Your browser doesn't support audio recording. Please use Chrome, Firefox, or Edge for the best experience.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Provider Selection */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span>Healthcare Provider (Optional)</span>
          </div>
        </label>
        {loadingProviders ? (
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading providers...</span>
          </div>
        ) : providers.length > 0 ? (
          <select
            value={selectedProviderId}
            onChange={(e) => handleProviderSelect(e.target.value)}
            disabled={state.status === 'recording' || isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select a provider or leave blank for new provider</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name} - {provider.specialty}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-gray-500">
            No providers found. You can add providers in your profile settings.
          </div>
        )}
      </div>

      {/* Main Recording Interface */}
      <div className={`p-6 rounded-lg border-2 transition-all duration-200 ${statusDisplay.bgColor} border-gray-200`}>
        <div className="flex items-center justify-between">
          {/* Status and Duration */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${statusDisplay.color}`}>
              {statusDisplay.icon}
              <span className="font-medium">{statusDisplay.text}</span>
            </div>
            
            {(isRecording || state.duration > 0) && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-sm">{formatDuration(state.duration)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Record/Stop Button */}
            <button
              onClick={handleRecordClick}
              disabled={isProcessing}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                  : canRecord
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? (
                <Square className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>

            {/* Reset Button */}
            {(state.status === 'completed' || state.status === 'error') && (
              <button
                onClick={reset}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                New Recording
              </button>
            )}
          </div>
        </div>

        {/* Recording Instructions */}
        {canRecord && (
          <div className="mt-4 text-sm text-gray-600">
            <p className="mb-2">
              <strong>Instructions:</strong> Click the microphone to start recording your visit summary.
            </p>
            <ul className="text-xs space-y-1 text-gray-500">
              <li>• Speak clearly about the visit details</li>
              <li>• Include provider name, diagnosis, and treatment plan</li>
              <li>• Mention any medication changes or follow-up requirements</li>
              <li>• Recording will be processed automatically when you stop</li>
            </ul>
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">
              {state.status === 'uploading' && 'Uploading your recording...'}
              {state.status === 'processing' && 'AI is analyzing your visit summary...'}
              {state.status === 'stopping' && 'Finalizing recording...'}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress || 30}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              This usually takes 30-60 seconds
            </div>
          </div>
        )}
      </div>

      {/* Results Display */}
      {state.status === 'completed' && state.results && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-green-800 mb-2">
                ✅ Visit Summary Processed Successfully!
              </div>
              
              {/* Transcript Preview */}
              {state.results.transcript && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-green-700 mb-1">Transcript:</div>
                  <div className="text-xs text-green-600 bg-white p-2 rounded border">
                    {state.results.transcript.substring(0, 200)}
                    {state.results.transcript.length > 200 && '...'}
                  </div>
                </div>
              )}

              {/* Key Points */}
              {state.results.keyPoints && state.results.keyPoints.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-green-700 mb-1">Key Points:</div>
                  <ul className="text-xs text-green-600 space-y-1">
                    {state.results.keyPoints.slice(0, 3).map((point: string, index: number) => (
                      <li key={index} className="flex items-start space-x-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Urgency Level */}
              {state.results.urgencyLevel && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-green-700">Urgency Level:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    state.results.urgencyLevel === 'urgent' ? 'bg-red-100 text-red-700' :
                    state.results.urgencyLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                    state.results.urgencyLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {state.results.urgencyLevel.charAt(0).toUpperCase() + state.results.urgencyLevel.slice(1)}
                  </span>
                </div>
              )}

              <div className="text-xs text-green-600 mt-2">
                Visit ID: {state.visitId}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.status === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-red-800">
                Recording Error
              </div>
              <div className="text-xs text-red-700 mt-1">
                {state.error || 'An unexpected error occurred. Please try again.'}
              </div>
              <button
                onClick={reset}
                className="mt-2 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browser Tips */}
      <div className="text-xs text-gray-500 text-center">
        💡 For best results, use Chrome or Edge browser with a good microphone in a quiet environment
      </div>
    </div>
  );
}