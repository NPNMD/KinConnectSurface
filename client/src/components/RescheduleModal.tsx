import React, { useState } from 'react';
import { X, RotateCcw, Calendar, Clock } from 'lucide-react';
import type { EnhancedMedicationCalendarEvent } from '@shared/types';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReschedule: (newTime: Date, reason: string, isOneTime: boolean) => void;
  event: EnhancedMedicationCalendarEvent;
}

export default function RescheduleModal({
  isOpen,
  onClose,
  onReschedule,
  event
}: RescheduleModalProps) {
  const [newDate, setNewDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [newTime, setNewTime] = useState<string>(() => {
    const originalTime = new Date(event.scheduledDateTime);
    return originalTime.toTimeString().slice(0, 5); // HH:MM format
  });
  const [reason, setReason] = useState<string>('');
  const [isOneTime, setIsOneTime] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleReschedule = () => {
    if (!newDate || !newTime || !reason.trim()) {
      return;
    }

    const newDateTime = new Date(`${newDate}T${newTime}`);
    onReschedule(newDateTime, reason.trim(), isOneTime);
    
    // Reset form
    const today = new Date();
    setNewDate(today.toISOString().split('T')[0]);
    const originalTime = new Date(event.scheduledDateTime);
    setNewTime(originalTime.toTimeString().slice(0, 5));
    setReason('');
    setIsOneTime(true);
  };

  const handleClose = () => {
    onClose();
    // Reset form
    const today = new Date();
    setNewDate(today.toISOString().split('T')[0]);
    const originalTime = new Date(event.scheduledDateTime);
    setNewTime(originalTime.toTimeString().slice(0, 5));
    setReason('');
    setIsOneTime(true);
  };

  const originalDateTime = new Date(event.scheduledDateTime);
  const newDateTime = new Date(`${newDate}T${newTime}`);
  const isValidDateTime = newDateTime > new Date();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Reschedule Medication</h3>
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
            <p className="text-sm text-gray-600">Rescheduling medication:</p>
            <p className="font-medium text-gray-900">{event.medicationName}</p>
            <p className="text-sm text-gray-500">
              Originally scheduled: {originalDateTime.toLocaleString([], { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>

          {/* New Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* New DateTime Preview */}
          {isValidDateTime && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>New time:</strong> {newDateTime.toLocaleString([], { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          )}

          {/* Validation Error */}
          {!isValidDateTime && newDate && newTime && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                Please select a future date and time.
              </p>
            </div>
          )}

          {/* Reschedule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Reschedule type
            </label>
            
            <div className="space-y-2">
              <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="rescheduleType"
                  checked={isOneTime}
                  onChange={() => setIsOneTime(true)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Just this dose</div>
                  <div className="text-xs text-gray-500">
                    Only reschedule this single dose. Future doses remain on the original schedule.
                  </div>
                </div>
              </label>
              
              <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="rescheduleType"
                  checked={!isOneTime}
                  onChange={() => setIsOneTime(false)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Change ongoing schedule</div>
                  <div className="text-xs text-gray-500">
                    Update the regular schedule time for this medication going forward.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for rescheduling *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., doctor appointment ran late, work meeting, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Reschedule Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> Rescheduling helps maintain your medication schedule while accommodating 
              life events. The original time will be recorded for adherence tracking.
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
            onClick={handleReschedule}
            disabled={!isValidDateTime || !reason.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}