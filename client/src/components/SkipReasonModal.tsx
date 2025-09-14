import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SKIP_REASONS, SkipReason } from '@shared/types';

interface SkipReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkip: (reason: SkipReason, notes?: string) => void;
  medicationName: string;
}

export default function SkipReasonModal({
  isOpen,
  onClose,
  onSkip,
  medicationName
}: SkipReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<SkipReason>('forgot');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleSkip = () => {
    onSkip(selectedReason, notes.trim() || undefined);
    
    // Reset form
    setSelectedReason('forgot');
    setNotes('');
  };

  const handleClose = () => {
    onClose();
    // Reset form
    setSelectedReason('forgot');
    setNotes('');
  };

  const selectedReasonData = SKIP_REASONS.find(r => r.value === selectedReason);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⏭️</span>
            <h3 className="text-lg font-semibold text-gray-900">Skip Medication</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Medication Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Skipping medication:</p>
            <p className="font-medium text-gray-900">{medicationName}</p>
          </div>

          {/* Skip Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Why are you skipping this dose?
            </label>
            
            <div className="space-y-2">
              {SKIP_REASONS.map((reasonOption) => (
                <label
                  key={reasonOption.value}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="skipReason"
                    value={reasonOption.value}
                    checked={selectedReason === reasonOption.value}
                    onChange={() => setSelectedReason(reasonOption.value)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{reasonOption.icon}</span>
                    <span className="text-sm text-gray-900">{reasonOption.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about why you're skipping this dose..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
          </div>

          {/* Skip Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 text-lg">⚠️</span>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Skipping medications can affect your treatment</li>
                  <li>• This dose will be marked as skipped in your adherence record</li>
                  <li>• Consider talking to your doctor if you frequently skip doses</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reason-specific advice */}
          {selectedReasonData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <span className="text-lg">{selectedReasonData.icon}</span>
                <div className="text-sm text-blue-800">
                  {selectedReason === 'forgot' && (
                    <p>Consider setting additional reminders or moving your medication to a more visible location.</p>
                  )}
                  {selectedReason === 'felt_sick' && (
                    <p>If you frequently feel sick after taking this medication, discuss with your doctor about timing or taking it with food.</p>
                  )}
                  {selectedReason === 'ran_out' && (
                    <p>Contact your pharmacy or doctor to refill your prescription. Consider setting up automatic refills.</p>
                  )}
                  {selectedReason === 'side_effects' && (
                    <p>If you're experiencing side effects, contact your healthcare provider before skipping more doses.</p>
                  )}
                  {selectedReason === 'other' && (
                    <p>Please provide details in the notes section to help track patterns.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Skip This Dose
          </button>
        </div>
      </div>
    </div>
  );
}