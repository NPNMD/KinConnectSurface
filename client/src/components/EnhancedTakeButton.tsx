import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  Undo2,
  Loader2,
  AlertCircle,
  Trophy,
  Zap,
  Heart
} from 'lucide-react';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import { useFamily } from '@/contexts/FamilyContext';

interface EnhancedTakeButtonProps {
  commandId: string;
  medicationName: string;
  dosageAmount: string;
  scheduledDateTime: Date;
  onTaken?: (result: any) => void;
  onUndone?: (result: any) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  compactMode?: boolean;
  allowUndo?: boolean;
  undoTimeoutSeconds?: number;
}

type ButtonState = 'ready' | 'taking' | 'taken' | 'undoable' | 'processing_undo' | 'confirmed';

interface TakeButtonState {
  buttonState: ButtonState;
  eventId?: string;
  undoAvailableUntil?: Date;
  adherenceScore?: number;
  timingCategory?: string;
  newMilestones?: any[];
  streakUpdated?: any;
  error?: string;
}

export default function EnhancedTakeButton({
  commandId,
  medicationName,
  dosageAmount,
  scheduledDateTime,
  onTaken,
  onUndone,
  onError,
  disabled = false,
  compactMode = false,
  allowUndo = true,
  undoTimeoutSeconds = 30
}: EnhancedTakeButtonProps) {
  const { hasPermission } = useFamily();
  const [state, setState] = useState<TakeButtonState>({
    buttonState: 'ready'
  });
  const [undoCountdown, setUndoCountdown] = useState<number>(0);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  // Countdown timer for undo availability
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.buttonState === 'undoable' && state.undoAvailableUntil) {
      interval = setInterval(() => {
        const now = new Date();
        const timeLeft = Math.max(0, Math.floor((state.undoAvailableUntil!.getTime() - now.getTime()) / 1000));
        
        setUndoCountdown(timeLeft);

        if (timeLeft <= 0) {
          setState(prev => ({ ...prev, buttonState: 'confirmed' }));
          setUndoCountdown(0);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.buttonState, state.undoAvailableUntil]);

  const handleTake = useCallback(async () => {
    if (!hasPermission('canEdit') || disabled) return;

    setState(prev => ({ ...prev, buttonState: 'taking', error: undefined }));

    try {
      const result = await unifiedMedicationApi.markMedicationTaken(commandId, {
        scheduledDateTime,
        takenAt: new Date(),
        notifyFamily: false,
        circumstances: {
          location: 'home', // Could be enhanced with geolocation
          assistanceType: 'verification'
        }
      });

      if (result.success && result.data) {
        const undoAvailableUntil = new Date(Date.now() + undoTimeoutSeconds * 1000);
        
        setState(prev => ({
          ...prev,
          buttonState: allowUndo ? 'undoable' : 'confirmed',
          eventId: result.data?.eventId,
          undoAvailableUntil: allowUndo ? undoAvailableUntil : undefined,
          adherenceScore: result.data?.adherenceScore,
          timingCategory: result.data?.timingCategory,
          newMilestones: result.data?.newMilestones,
          streakUpdated: result.data?.streakUpdated
        }));

        // Show milestone modal if new milestones achieved
        if (result.data?.newMilestones && result.data.newMilestones.length > 0) {
          setShowMilestoneModal(true);
        }

        onTaken?.(result.data || {});
      } else {
        setState(prev => ({ 
          ...prev, 
          buttonState: 'ready',
          error: result.error || 'Failed to mark medication as taken'
        }));
        onError?.(result.error || 'Failed to mark medication as taken');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({ 
        ...prev, 
        buttonState: 'ready',
        error: errorMessage
      }));
      onError?.(errorMessage);
    }
  }, [commandId, scheduledDateTime, hasPermission, disabled, allowUndo, undoTimeoutSeconds, onTaken, onError]);

  const handleUndo = useCallback(async (undoReason: string) => {
    if (!state.eventId) return;

    setState(prev => ({ ...prev, buttonState: 'processing_undo' }));

    try {
      const result = await unifiedMedicationApi.undoMedicationTaken(commandId, {
        originalEventId: state.eventId!,
        undoReason,
        notifyFamily: false
      });

      if (result.success) {
        setState(prev => ({
          ...prev,
          buttonState: 'ready',
          eventId: undefined,
          undoAvailableUntil: undefined,
          adherenceScore: undefined,
          timingCategory: undefined,
          error: undefined
        }));
        setUndoCountdown(0);
        onUndone?.(result.data);
      } else {
        setState(prev => ({ 
          ...prev, 
          buttonState: 'undoable',
          error: result.error || 'Failed to undo medication'
        }));
        onError?.(result.error || 'Failed to undo medication');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({ 
        ...prev, 
        buttonState: 'undoable',
        error: errorMessage
      }));
      onError?.(errorMessage);
    }
  }, [commandId, state.eventId, onUndone, onError]);

  const getButtonContent = () => {
    switch (state.buttonState) {
      case 'ready':
        return (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Take</span>
          </div>
        );
      
      case 'taking':
        return (
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Taking...</span>
          </div>
        );
      
      case 'taken':
      case 'undoable':
        return (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Taken</span>
            {state.adherenceScore && (
              <span className="text-xs bg-white bg-opacity-20 px-1 rounded">
                {state.adherenceScore}%
              </span>
            )}
          </div>
        );
      
      case 'processing_undo':
        return (
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Undoing...</span>
          </div>
        );
      
      case 'confirmed':
        return (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Confirmed</span>
          </div>
        );
      
      default:
        return <span>Take</span>;
    }
  };

  const getButtonClassName = () => {
    const baseClasses = "px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    
    switch (state.buttonState) {
      case 'ready':
        return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 active:scale-95`;
      
      case 'taking':
        return `${baseClasses} bg-blue-500 text-white cursor-not-allowed`;
      
      case 'taken':
      case 'undoable':
        return `${baseClasses} bg-green-600 text-white hover:bg-green-700 ${state.buttonState === 'undoable' ? 'animate-pulse' : ''}`;
      
      case 'processing_undo':
        return `${baseClasses} bg-orange-500 text-white cursor-not-allowed`;
      
      case 'confirmed':
        return `${baseClasses} bg-green-700 text-white cursor-not-allowed`;
      
      default:
        return `${baseClasses} bg-gray-600 text-white`;
    }
  };

  const canEdit = hasPermission('canEdit');

  if (!canEdit) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
        <span className="text-sm text-gray-600">View only access</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main Take Button */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleTake}
          disabled={disabled || state.buttonState !== 'ready'}
          className={getButtonClassName()}
          title={`Mark ${medicationName} as taken`}
        >
          {getButtonContent()}
        </button>

        {/* Undo Button */}
        {state.buttonState === 'undoable' && allowUndo && (
          <button
            onClick={() => handleUndo('Accidental tap')}
            disabled={state.buttonState !== 'undoable'}
            className="px-3 py-2 bg-orange-100 text-orange-800 hover:bg-orange-200 rounded-md font-medium text-sm transition-colors flex items-center space-x-1 disabled:opacity-50"
            title="Undo this action"
          >
            <Undo2 className="w-3 h-3" />
            <span>Undo</span>
            {undoCountdown > 0 && (
              <span className="text-xs bg-orange-200 px-1 rounded">
                {undoCountdown}s
              </span>
            )}
          </button>
        )}
      </div>

      {/* Adherence Feedback */}
      {state.buttonState === 'undoable' && state.adherenceScore && (
        <div className="flex items-center space-x-2 text-xs">
          {state.adherenceScore >= 90 && (
            <div className="flex items-center space-x-1 text-green-600">
              <Trophy className="w-3 h-3" />
              <span>Excellent adherence!</span>
            </div>
          )}
          {state.timingCategory === 'on_time' && (
            <div className="flex items-center space-x-1 text-blue-600">
              <Clock className="w-3 h-3" />
              <span>Perfect timing</span>
            </div>
          )}
          {state.streakUpdated && state.streakUpdated.newStreak >= 7 && (
            <div className="flex items-center space-x-1 text-purple-600">
              <Zap className="w-3 h-3" />
              <span>{state.streakUpdated.newStreak}-day streak!</span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <div className="flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 text-sm">{state.error}</p>
            <button
              onClick={() => setState(prev => ({ ...prev, error: undefined }))}
              className="text-red-600 hover:text-red-800 text-sm underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Milestone Achievement Modal */}
      {showMilestoneModal && state.newMilestones && state.newMilestones.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                <Trophy className="h-8 w-8 text-yellow-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Congratulations! 🎉
              </h3>
              
              <div className="space-y-2 mb-6">
                {state.newMilestones.map((milestone, index) => (
                  <div key={index} className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">{milestone.icon}</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{milestone.milestone}</p>
                      <p className="text-sm text-gray-600">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {state.streakUpdated && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-900">
                      {state.streakUpdated.newStreak}-Day Streak!
                    </span>
                  </div>
                  <p className="text-sm text-purple-700 mt-1">
                    Keep up the great work with your medication routine!
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowMilestoneModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Reason Modal */}
      {state.buttonState === 'undoable' && (
        <UndoReasonModal
          isOpen={false} // Would be controlled by a separate state
          onClose={() => {}}
          onUndo={handleUndo}
          medicationName={medicationName}
          timeRemaining={undoCountdown}
        />
      )}
    </div>
  );
}

// Undo Reason Modal Component
interface UndoReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUndo: (reason: string) => void;
  medicationName: string;
  timeRemaining: number;
}

function UndoReasonModal({ isOpen, onClose, onUndo, medicationName, timeRemaining }: UndoReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('Accidental tap');
  const [customReason, setCustomReason] = useState('');

  const undoReasons = [
    'Accidental tap',
    'Wrong medication',
    'Wrong time',
    'Took wrong dose',
    'Other'
  ];

  const handleSubmit = () => {
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    onUndo(reason);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Undo Medication
          </h3>
          <div className="text-sm text-orange-600 font-medium">
            {timeRemaining}s remaining
          </div>
        </div>

        <p className="text-gray-600 mb-4">
          Why are you undoing the "{medicationName}" dose?
        </p>

        <div className="space-y-2 mb-4">
          {undoReasons.map((reason) => (
            <label
              key={reason}
              className="flex items-center space-x-3 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="radio"
                name="undoReason"
                value={reason}
                checked={selectedReason === reason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">{reason}</span>
            </label>
          ))}
        </div>

        {selectedReason === 'Other' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please specify:
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedReason === 'Other' && !customReason.trim()}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Undo Medication
          </button>
        </div>
      </div>
    </div>
  );
}