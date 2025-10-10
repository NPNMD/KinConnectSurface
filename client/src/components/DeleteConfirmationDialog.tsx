import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import type { DeleteMedicalEventRequest } from '@shared/types';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (request: DeleteMedicalEventRequest) => Promise<void>;
  eventTitle: string;
  eventId: string;
  patientId: string;
  isRecurring?: boolean;
  deletedBy: string;
}

export default function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
  eventId,
  patientId,
  isRecurring = false,
  deletedBy
}: DeleteConfirmationDialogProps) {
  const [scope, setScope] = useState<'single' | 'future' | 'all'>('single');
  const [reason, setReason] = useState('');
  const [notifyFamily, setNotifyFamily] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    
    try {
      const request: DeleteMedicalEventRequest = {
        eventId,
        patientId,
        scope: isRecurring ? scope : 'single',
        reason: reason.trim() || undefined,
        notifyFamily,
        deletedBy
      };

      await onConfirm(request);
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Delete Event</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete "{eventTitle}"?
          </p>

          {/* Recurring Event Options */}
          {isRecurring && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                This is a recurring event
              </p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="single"
                    checked={scope === 'single'}
                    onChange={(e) => setScope(e.target.value as 'single')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Delete only this event</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="future"
                    checked={scope === 'future'}
                    onChange={(e) => setScope(e.target.value as 'future')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Delete this and future events</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={(e) => setScope(e.target.value as 'all')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Delete all events in series</span>
                </label>
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you deleting this event?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Notify Family */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyFamily}
              onChange={(e) => setNotifyFamily(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Notify family members</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Event'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}