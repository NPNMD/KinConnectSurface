import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  X,
  RotateCcw,
  MoreHorizontal,
  AlertCircle,
  Loader2,
  Lock,
  Undo2
} from 'lucide-react';
import type { EnhancedMedicationCalendarEvent, SkipReason } from '@shared/types';
import { useFamily } from '@/contexts/FamilyContext';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import SnoozeOptionsModal from './SnoozeOptionsModal';
import SkipReasonModal from './SkipReasonModal';
import RescheduleModal from './RescheduleModal';
import EnhancedTakeButton from './EnhancedTakeButton';

interface QuickActionButtonsProps {
  event: EnhancedMedicationCalendarEvent;
  onTake: () => void;
  onSnooze: (minutes: number, reason?: string) => void;
  onSkip: (reason: SkipReason, notes?: string) => void;
  onReschedule: (newTime: Date, reason: string, isOneTime: boolean) => void;
  isProcessing?: boolean;
  compactMode?: boolean;
  showAdvancedOptions?: boolean;
  error?: string;
  onClearError?: () => void;
  useEnhancedTakeButton?: boolean; // New prop to enable enhanced functionality
}

export default function QuickActionButtons({
  event,
  onTake,
  onSnooze,
  onSkip,
  onReschedule,
  isProcessing = false,
  compactMode = false,
  showAdvancedOptions = true,
  error,
  onClearError,
  useEnhancedTakeButton = true
}: QuickActionButtonsProps) {
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Add family context for permission checks
  const { hasPermission, userRole, activePatientAccess } = useFamily();

  const handleTake = () => {
    setActionError(null);
    onClearError?.();
    onTake();
  };

  const handleSnooze = (minutes: number, reason?: string) => {
    setActionError(null);
    onClearError?.();
    onSnooze(minutes, reason);
    setShowSnoozeModal(false);
  };

  const handleSkip = (reason: SkipReason, notes?: string) => {
    setActionError(null);
    onClearError?.();
    onSkip(reason, notes);
    setShowSkipModal(false);
  };

  const handleReschedule = (newTime: Date, reason: string, isOneTime: boolean) => {
    setActionError(null);
    onClearError?.();
    onReschedule(newTime, reason, isOneTime);
    setShowRescheduleModal(false);
  };

  const isOverdue = event.isOverdue || false;
  const isDueSoon = event.timeBucket === 'now' || event.timeBucket === 'due_soon';
  const displayError = error || actionError;
  const canEdit = hasPermission('canEdit');

  // Debug logging for permission checks
  console.log('🔍 QuickActionButtons: Permission check:', {
    eventId: event.id,
    medicationName: event.medicationName,
    userRole,
    canEdit,
    activePatientAccess: activePatientAccess ? {
      patientName: activePatientAccess.patientName,
      permissions: activePatientAccess.permissions,
      accessLevel: activePatientAccess.accessLevel
    } : null
  });

  // If user doesn't have edit permissions, show permission message
  if (!canEdit) {
    return (
      <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md min-h-[44px]">
        <Lock className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">
          {userRole === 'family_member' ? 'View only access' : 'No edit permissions'}
        </span>
      </div>
    );
  }

  // Use enhanced take button if enabled AND we have a commandId (unified flow)
  if (useEnhancedTakeButton && compactMode && event && (event as any).commandId) {
    return (
      <div className="flex items-center space-x-2">
        {/* Enhanced Take Button (requires commandId for unified API) */}
        <EnhancedTakeButton
          commandId={(event as any).commandId}
          medicationName={event.medicationName}
          dosageAmount={event.dosageAmount}
          scheduledDateTime={new Date(event.scheduledDateTime)}
          onTaken={(result) => {
            console.log('✅ Enhanced take completed:', result);
            onTake();
          }}
          onUndone={(result) => {
            console.log('🔄 Enhanced undo completed:', result);
            onTake(); // Refresh the view
          }}
          onError={(error) => {
            console.error('❌ Enhanced take error:', error);
            onClearError?.();
          }}
          disabled={isProcessing}
          compactMode={true}
          allowUndo={true}
          undoTimeoutSeconds={30}
        />

        {/* Simplified More Options */}
        {showAdvancedOptions && (
          <div className="relative">
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              disabled={isProcessing}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMoreOptions && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
                <button
                  onClick={() => {
                    setShowSnoozeModal(true);
                    setShowMoreOptions(false);
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center"
                >
                  Snooze
                </button>
                <button
                  onClick={() => {
                    setShowSkipModal(true);
                    setShowMoreOptions(false);
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center"
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        )}

        {/* Simplified Error Message */}
        {displayError && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 z-10">
            {displayError}
          </div>
        )}
      </div>
    );
  }

  // Use enhanced take button for full mode as well when commandId exists
  if (useEnhancedTakeButton && event && (event as any).commandId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          {/* Enhanced Take Button (requires commandId for unified API) */}
          <EnhancedTakeButton
            commandId={(event as any).commandId}
            medicationName={event.medicationName}
            dosageAmount={event.dosageAmount}
            scheduledDateTime={new Date(event.scheduledDateTime)}
            onTaken={(result) => {
              console.log('✅ Enhanced take completed:', result);
              onTake();
            }}
            onUndone={(result) => {
              console.log('🔄 Enhanced undo completed:', result);
              onTake(); // Refresh the view
            }}
            onError={(error) => {
              console.error('❌ Enhanced take error:', error);
              onClearError?.();
            }}
            disabled={isProcessing}
            compactMode={false}
            allowUndo={true}
            undoTimeoutSeconds={30}
          />
        </div>

        {/* Quick Snooze - Show for overdue and due now */}
        {(isOverdue || isDueSoon) && showAdvancedOptions && (
          <button
            onClick={() => setShowSnoozeModal(true)}
            disabled={isProcessing}
            className="px-4 py-3 min-h-[44px] bg-orange-100 text-orange-800 hover:bg-orange-200 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
            title="Snooze medication"
          >
            <div className="flex items-center justify-center space-x-2">
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
              disabled={isProcessing}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMoreOptions && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
                {!isOverdue && !isDueSoon && (
                  <button
                    onClick={() => {
                      setShowSnoozeModal(true);
                      setShowMoreOptions(false);
                    }}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Snooze</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSkipModal(true);
                    setShowMoreOptions(false);
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Skip dose</span>
                </button>
                <button
                  onClick={() => {
                    setShowRescheduleModal(true);
                    setShowMoreOptions(false);
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reschedule</span>
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Error Message */}
        {displayError && (
          <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{displayError}</p>
              <button
                onClick={() => {
                  setActionError(null);
                  onClearError?.();
                }}
                className="text-red-600 hover:text-red-800 text-sm underline mt-1"
              >
                Dismiss
              </button>
            </div>
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

  // Fallback to original implementation
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        {/* Take Button - Always visible and prominent */}
        <button
          onClick={handleTake}
          disabled={isProcessing}
          className={`px-4 py-3 min-h-[44px] rounded-md font-medium text-sm transition-colors disabled:opacity-50 ${
            isOverdue || isDueSoon
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-100 text-green-800 hover:bg-green-200'
          }`}
          title="Mark as taken"
        >
          {isProcessing ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
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
            disabled={isProcessing}
            className="px-4 py-3 min-h-[44px] bg-orange-100 text-orange-800 hover:bg-orange-200 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
            title="Snooze medication"
          >
            <div className="flex items-center justify-center space-x-2">
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
              disabled={isProcessing}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMoreOptions && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
                {!isOverdue && !isDueSoon && (
                  <button
                    onClick={() => {
                      setShowSnoozeModal(true);
                      setShowMoreOptions(false);
                    }}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Snooze</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSkipModal(true);
                    setShowMoreOptions(false);
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Skip dose</span>
                </button>
                <button
                  onClick={() => {
                    setShowRescheduleModal(true);
                    setShowMoreOptions(false);
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reschedule</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {displayError && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 text-sm">{displayError}</p>
            <button
              onClick={() => {
                setActionError(null);
                onClearError?.();
              }}
              className="text-red-600 hover:text-red-800 text-sm underline mt-1"
            >
              Dismiss
            </button>
          </div>
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