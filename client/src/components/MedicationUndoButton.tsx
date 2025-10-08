/**
 * MedicationUndoButton Component
 * 
 * Provides undo functionality for accidental medication markings with:
 * - 30-second countdown timer for undo window
 * - Visual feedback for undo state
 * - Correction dialog for older events
 * - Undo history display
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react';

interface MedicationUndoButtonProps {
  eventId: string;
  commandId: string;
  medicationName: string;
  takenAt: Date;
  onUndoComplete?: () => void;
  onUndoError?: (error: string) => void;
}

interface UndoState {
  status: 'available' | 'processing' | 'success' | 'expired' | 'error';
  secondsRemaining: number;
  errorMessage?: string;
}

export const MedicationUndoButton: React.FC<MedicationUndoButtonProps> = ({
  eventId,
  commandId,
  medicationName,
  takenAt,
  onUndoComplete,
  onUndoError
}) => {
  const [undoState, setUndoState] = useState<UndoState>({
    status: 'available',
    secondsRemaining: 30
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [undoReason, setUndoReason] = useState('');

  // Calculate seconds remaining
  useEffect(() => {
    const calculateSecondsRemaining = () => {
      const now = Date.now();
      const takenTime = new Date(takenAt).getTime();
      const elapsed = Math.floor((now - takenTime) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      
      return remaining;
    };

    // Initial calculation
    const remaining = calculateSecondsRemaining();
    setUndoState(prev => ({ ...prev, secondsRemaining: remaining }));

    if (remaining === 0) {
      setUndoState(prev => ({ ...prev, status: 'expired' }));
      return;
    }

    // Update countdown every second
    const interval = setInterval(() => {
      const newRemaining = calculateSecondsRemaining();
      
      if (newRemaining === 0) {
        setUndoState(prev => ({ ...prev, status: 'expired', secondsRemaining: 0 }));
        clearInterval(interval);
      } else {
        setUndoState(prev => ({ ...prev, secondsRemaining: newRemaining }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [takenAt]);

  const handleUndoClick = useCallback(() => {
    if (undoState.status !== 'available') return;
    setShowConfirmation(true);
  }, [undoState.status]);

  const handleConfirmUndo = useCallback(async () => {
    if (!undoReason.trim()) {
      setUndoState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Please provide a reason for undoing'
      }));
      return;
    }

    setUndoState(prev => ({ ...prev, status: 'processing' }));
    setShowConfirmation(false);

    try {
      const response = await fetch(`/api/medication-commands/${commandId}/undo-take`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalEventId: eventId,
          undoReason: undoReason.trim(),
          correctedAction: 'none'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Check if requires correction workflow
        if (result.requiresCorrection) {
          setUndoState({
            status: 'expired',
            secondsRemaining: 0,
            errorMessage: 'Undo window expired. Use correction workflow instead.'
          });
        } else {
          setUndoState({
            status: 'error',
            secondsRemaining: undoState.secondsRemaining,
            errorMessage: result.error || 'Failed to undo medication'
          });
        }
        
        if (onUndoError) {
          onUndoError(result.error || 'Failed to undo medication');
        }
        return;
      }

      setUndoState({
        status: 'success',
        secondsRemaining: 0
      });

      if (onUndoComplete) {
        onUndoComplete();
      }

    } catch (error) {
      console.error('Error undoing medication:', error);
      setUndoState({
        status: 'error',
        secondsRemaining: undoState.secondsRemaining,
        errorMessage: error instanceof Error ? error.message : 'Network error'
      });
      
      if (onUndoError) {
        onUndoError(error instanceof Error ? error.message : 'Network error');
      }
    }
  }, [eventId, commandId, undoReason, undoState.secondsRemaining, onUndoComplete, onUndoError]);

  const handleCancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
    setUndoReason('');
  }, []);

  // Don't show button if expired or already processed
  if (undoState.status === 'expired' || undoState.status === 'success') {
    return null;
  }

  // Calculate progress percentage for visual feedback
  const progressPercentage = (undoState.secondsRemaining / 30) * 100;

  return (
    <>
      {/* Undo Button */}
      <div className="relative inline-block">
        <button
          onClick={handleUndoClick}
          disabled={undoState.status !== 'available'}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
            ${undoState.status === 'available' 
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-md hover:shadow-lg' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
            ${undoState.status === 'processing' ? 'opacity-50 cursor-wait' : ''}
          `}
          title={`Undo within ${undoState.secondsRemaining} seconds`}
        >
          {undoState.status === 'processing' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Undoing...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" />
              <span>Undo</span>
              <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-white/20 rounded">
                <Clock className="w-3 h-3" />
                <span className="text-sm font-bold">{undoState.secondsRemaining}s</span>
              </div>
            </>
          )}
        </button>

        {/* Progress bar */}
        {undoState.status === 'available' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-yellow-600 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {undoState.status === 'error' && undoState.errorMessage && (
        <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
          <XCircle className="w-4 h-4" />
          <span>{undoState.errorMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Undo Medication Marking?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will undo the marking for <strong>{medicationName}</strong>.
                  You have <strong>{undoState.secondsRemaining} seconds</strong> remaining.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="undoReason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for undo <span className="text-red-500">*</span>
              </label>
              <textarea
                id="undoReason"
                value={undoReason}
                onChange={(e) => setUndoReason(e.target.value)}
                placeholder="e.g., Accidentally clicked, Wrong medication, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                rows={3}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirmation}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUndo}
                disabled={!undoReason.trim()}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-medium transition-colors
                  ${undoReason.trim()
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                Confirm Undo
              </button>
            </div>

            {/* Countdown warning */}
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Time remaining: {undoState.secondsRemaining} seconds</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * MedicationUndoHistory Component
 * 
 * Displays undo history for a medication
 */
interface UndoHistoryItem {
  undoEventId: string;
  originalEventId: string;
  undoReason: string;
  undoTimestamp: Date;
  correctedAction?: string;
  timeSinceOriginal: number;
}

interface MedicationUndoHistoryProps {
  commandId: string;
  medicationName: string;
}

export const MedicationUndoHistory: React.FC<MedicationUndoHistoryProps> = ({
  commandId,
  medicationName
}) => {
  const [history, setHistory] = useState<UndoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/medication-commands/${commandId}/undo-history`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch undo history');
        }

        setHistory(result.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching undo history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [commandId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 py-4">
        <XCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>No undo history for this medication</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <RotateCcw className="w-4 h-4" />
        Undo History for {medicationName}
      </h4>

      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.undoEventId}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Undone {formatTimestamp(item.undoTimestamp)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 ml-6">
                  <strong>Reason:</strong> {item.undoReason}
                </p>
                
                {item.correctedAction && item.correctedAction !== 'none' && (
                  <p className="text-sm text-gray-600 ml-6">
                    <strong>Corrected to:</strong> {item.correctedAction}
                  </p>
                )}
                
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  Undone {item.timeSinceOriginal} seconds after original action
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * CorrectionDialog Component
 * 
 * Dialog for correcting older medication events (beyond 30-second window)
 */
interface CorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  commandId: string;
  medicationName: string;
  onCorrectionComplete?: () => void;
}

export const CorrectionDialog: React.FC<CorrectionDialogProps> = ({
  isOpen,
  onClose,
  eventId,
  commandId,
  medicationName,
  onCorrectionComplete
}) => {
  const [correctedAction, setCorrectedAction] = useState<'missed' | 'skipped' | 'rescheduled'>('missed');
  const [correctionReason, setCorrectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!correctionReason.trim()) {
      setError('Please provide a reason for the correction');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/medication-commands/${commandId}/correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalEventId: eventId,
          correctedAction,
          correctionReason: correctionReason.trim()
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to correct medication event');
      }

      if (onCorrectionComplete) {
        onCorrectionComplete();
      }

      onClose();
    } catch (err) {
      console.error('Error correcting medication:', err);
      setError(err instanceof Error ? err.message : 'Failed to correct medication');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Correct Medication Event
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              The 30-second undo window has expired. You can still correct this event for <strong>{medicationName}</strong>.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What actually happened? <span className="text-red-500">*</span>
            </label>
            <select
              value={correctedAction}
              onChange={(e) => setCorrectedAction(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="missed">Dose was missed</option>
              <option value="skipped">Dose was skipped intentionally</option>
              <option value="rescheduled">Dose was rescheduled</option>
            </select>
          </div>

          <div>
            <label htmlFor="correctionReason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for correction <span className="text-red-500">*</span>
            </label>
            <textarea
              id="correctionReason"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Explain why you're correcting this event..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!correctionReason.trim() || processing}
              className={`
                flex-1 px-4 py-2 rounded-lg font-medium transition-colors
                ${correctionReason.trim() && !processing
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                'Submit Correction'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format timestamp
function formatTimestamp(timestamp: Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}