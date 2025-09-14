import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { SNOOZE_OPTIONS } from '@shared/types';

interface SnoozeOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (minutes: number, reason?: string) => void;
  medicationName: string;
}

export default function SnoozeOptionsModal({
  isOpen,
  onClose,
  onSnooze,
  medicationName
}: SnoozeOptionsModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [useCustomTime, setUseCustomTime] = useState(false);

  if (!isOpen) return null;

  const handleSnooze = () => {
    const minutes = useCustomTime ? parseInt(customMinutes) || 30 : selectedMinutes;
    onSnooze(minutes, reason.trim() || undefined);
    
    // Reset form
    setSelectedMinutes(30);
    setCustomMinutes('');
    setReason('');
    setUseCustomTime(false);
  };

  const handleClose = () => {
    onClose();
    // Reset form
    setSelectedMinutes(30);
    setCustomMinutes('');
    setReason('');
    setUseCustomTime(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Snooze Medication</h3>
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
            <p className="text-sm text-gray-600">Snoozing medication:</p>
            <p className="font-medium text-gray-900">{medicationName}</p>
          </div>

          {/* Snooze Duration Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How long would you like to snooze?
            </label>
            
            {/* Preset Options */}
            <div className="space-y-2 mb-4">
              {SNOOZE_OPTIONS.map((option) => (
                <label
                  key={option.minutes}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="snoozeOption"
                    value={option.minutes}
                    checked={!useCustomTime && selectedMinutes === option.minutes}
                    onChange={() => {
                      setSelectedMinutes(option.minutes);
                      setUseCustomTime(false);
                    }}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{option.label}</span>
                  </div>
                </label>
              ))}
              
              {/* Custom Time Option */}
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="snoozeOption"
                  checked={useCustomTime}
                  onChange={() => setUseCustomTime(true)}
                  className="text-orange-600 focus:ring-orange-500"
                />
                <div className="flex items-center space-x-2 flex-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">Custom:</span>
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => {
                      setCustomMinutes(e.target.value);
                      setUseCustomTime(true);
                    }}
                    placeholder="30"
                    min="1"
                    max="480"
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <span className="text-sm text-gray-500">minutes</span>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., eating breakfast, in meeting, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Snooze Info */}
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> The medication will be reminded again after the snooze period. 
              You can snooze multiple times if needed.
            </p>
          </div>
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
            onClick={handleSnooze}
            disabled={useCustomTime && (!customMinutes || parseInt(customMinutes) < 1)}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Snooze {useCustomTime ? customMinutes || '30' : selectedMinutes} minutes
          </button>
        </div>
      </div>
    </div>
  );
}