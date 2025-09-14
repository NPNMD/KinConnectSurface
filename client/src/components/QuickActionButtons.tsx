import React, { useState } from 'react';
import { 
  CheckCircle, 
  Clock, 
  X, 
  RotateCcw,
  MoreHorizontal 
} from 'lucide-react';
import type { EnhancedMedicationCalendarEvent, SkipReason } from '@shared/types';
import SnoozeOptionsModal from './SnoozeOptionsModal';
import SkipReasonModal from './SkipReasonModal';
import RescheduleModal from './RescheduleModal';

interface QuickActionButtonsProps {
  event: EnhancedMedicationCalendarEvent;
  onTake: () => void;
  onSnooze: (minutes: number, reason?: string) => void;
  onSkip: (reason: SkipReason, notes?: string) => void;
  onReschedule: (newTime: Date, reason: string, isOneTime: boolean) => void;
  isProcessing?: boolean;
  compactMode?: boolean;
  showAdvancedOptions?: boolean;
}

export default function QuickActionButtons({
  event,
  onTake,
  onSnooze,
  onSkip,
  onReschedule,
  isProcessing = false,
  compactMode = false,
  showAdvancedOptions = true
}: QuickActionButtonsProps) {
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const handleTake = () => {
    onTake();
  };

  const handleSnooze = (minutes: number, reason?: string) => {
    onSnooze(minutes, reason);
    setShowSnoozeModal(false);
  };

  const handleSkip = (reason: SkipReason, notes?: string) => {
    onSkip(reason, notes);
    setShowSkipModal(false);
  };

  const handleReschedule = (newTime: Date, reason: string, isOneTime: boolean) => {
    onReschedule(newTime, reason, isOneTime);
    setShowRescheduleModal(false);
  };

  const isOverdue = event.isOverdue || false;
  const isDueSoon = event.timeBucket === 'now' || event.timeBucket === 'due_soon';

  if (compactMode) {
    return (
      <div className="flex items-center space-x-1">
        {/* Take Button */}
        <button
          onClick={handleTake}
          disabled={isProcessing}
          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md disabled:opacity-50 transition-colors"
          title="Mark as taken"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
        </button>

        {/* More Options */}
        {showAdvancedOptions && (
          <div className="relative">
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            
            {showMoreOptions && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
                <button
                  onClick={() => {
                    setShowSnoozeModal(true);
                    setShowMoreOptions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Clock className="w-3 h-3" />
                  <span>Snooze</span>
                </button>
                <button
                  onClick={() => {
                    setShowSkipModal(true);
                    setShowMoreOptions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <X className="w-3 h-3" />
                  <span>Skip</span>
                </button>
                <button
                  onClick={() => {
                    setShowRescheduleModal(true);
                    setShowMoreOptions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reschedule</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Take Button - Always visible and prominent */}
      <button
        onClick={handleTake}
        disabled={isProcessing}
        className={`px-3 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 ${
          isOverdue || isDueSoon
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-green-100 text-green-800 hover:bg-green-200'
        }`}
        title="Mark as taken"
      >
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Taking...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Take</span>
          </div>
        )}
      </button>

      {/* Quick Snooze - Show for overdue and due now */}
      {(isOverdue || isDueSoon) && showAdvancedOptions && (
        <button
          onClick={() => setShowSnoozeModal(true)}
          className="px-3 py-2 bg-orange-100 text-orange-800 hover:bg-orange-200 rounded-md font-medium text-sm transition-colors"
          title="Snooze medication"
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Snooze</span>
          </div>
        </button>
      )}

      {/* More Options */}
      {showAdvancedOptions && (
        <div className="relative">
          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {showMoreOptions && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-36">
              {!isOverdue && !isDueSoon && (
                <button
                  onClick={() => {
                    setShowSnoozeModal(true);
                    setShowMoreOptions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Clock className="w-3 h-3" />
                  <span>Snooze</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowSkipModal(true);
                  setShowMoreOptions(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <X className="w-3 h-3" />
                <span>Skip dose</span>
              </button>
              <button
                onClick={() => {
                  setShowRescheduleModal(true);
                  setShowMoreOptions(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reschedule</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <SnoozeOptionsModal
        isOpen={showSnoozeModal}
        onClose={() => setShowSnoozeModal(false)}
        onSnooze={handleSnooze}
        medicationName={event.medicationName}
      />
      
      <SkipReasonModal
        isOpen={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        onSkip={handleSkip}
        medicationName={event.medicationName}
      />
      
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        onReschedule={handleReschedule}
        event={event}
      />
    </div>
  );
}