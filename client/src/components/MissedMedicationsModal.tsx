import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Pill,
  Package,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';
import { MedicationCalendarEvent, SkipReason, EnhancedMedicationCalendarEvent } from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from './LoadingSpinner';
import { showSuccess, showError } from '@/utils/toast';

interface MissedMedicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMedicationAction?: (eventId: string, action: 'take' | 'skip') => void;
}

interface GroupedMissedMedication {
  date: string;
  medications: (MedicationCalendarEvent | EnhancedMedicationCalendarEvent)[];
}

const SKIP_REASONS = [
  { value: 'forgot', label: 'Forgot to take it', icon: '🤔' },
  { value: 'felt_sick', label: 'Felt sick/nauseous', icon: '🤢' },
  { value: 'ran_out', label: 'Ran out of medication', icon: '📦' },
  { value: 'side_effects', label: 'Experiencing side effects', icon: '⚠️' },
  { value: 'other', label: 'Other reason', icon: '💭' }
] as const;

export default function MissedMedicationsModal({
  isOpen,
  onClose,
  onMedicationAction
}: MissedMedicationsModalProps) {
  const { getEffectivePatientId, hasPermission, userRole, activePatientAccess } = useFamily();
  const [missedMedications, setMissedMedications] = useState<(MedicationCalendarEvent | EnhancedMedicationCalendarEvent)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [showSkipModal, setShowSkipModal] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<SkipReason>('forgot');
  const [skipNotes, setSkipNotes] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Load missed medications when modal opens and manage focus
  useEffect(() => {
    if (isOpen) {
      loadMissedMedications();
      // Focus the close button when modal opens for keyboard accessibility
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      // Trap focus within modal
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadMissedMedications = async () => {
    try {
      setIsLoading(true);
      const patientId = getEffectivePatientId();
      if (!patientId) return;

      // Get missed medications from last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const response = await medicationCalendarApi.getMissedMedications({
        patientId,
        startDate,
        endDate,
        limit: 50
      });

      if (response.success && response.data) {
        setMissedMedications(response.data);
        
        // Auto-expand today and yesterday
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        setExpandedDates(new Set([today, yesterdayStr]));
      }
    } catch (error) {
      console.error('Error loading missed medications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group medications by date
  const groupedMedications: GroupedMissedMedication[] = React.useMemo(() => {
    const groups: { [key: string]: (MedicationCalendarEvent | EnhancedMedicationCalendarEvent)[] } = {};
    
    missedMedications.forEach(med => {
      const date = new Date(med.scheduledDateTime).toISOString().split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(med);
    });

    return Object.entries(groups)
      .map(([date, medications]) => ({ date, medications }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [missedMedications]);

  const handleMarkAsTakenLate = async (eventId: string) => {
    try {
      setProcessingEventId(eventId);
      
      const result = await medicationCalendarApi.markMedicationTaken(eventId, new Date());
      
      if (result.success) {
        // Remove from missed medications list
        setMissedMedications(prev => prev.filter(med => med.id !== eventId));
        onMedicationAction?.(eventId, 'take');
        showSuccess('Medication marked as taken!');
      } else {
        showError(`Failed to mark medication as taken: ${result.error}`);
      }
    } catch (error) {
      console.error('Error marking medication as taken late:', error);
      showError('Failed to mark medication as taken. Please try again.');
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleSkipMedication = async (eventId: string) => {
    try {
      setProcessingEventId(eventId);
      
      const result = await medicationCalendarApi.skipMedication(
        eventId,
        skipReason,
        skipNotes.trim() || undefined
      );
      
      if (result.success) {
        // Remove from missed medications list
        setMissedMedications(prev => prev.filter(med => med.id !== eventId));
        onMedicationAction?.(eventId, 'skip');
        setShowSkipModal(null);
        setSkipNotes('');
        setSkipReason('forgot');
        showSuccess('Medication skipped and recorded');
      } else {
        showError(`Failed to skip medication: ${result.error}`);
      }
    } catch (error) {
      console.error('Error skipping medication:', error);
      showError('Failed to skip medication. Please try again.');
    } finally {
      setProcessingEventId(null);
    }
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missed-medications-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 id="missed-medications-title" className="text-xl font-semibold text-gray-900">Missed Medications</h2>
              <p id="missed-medications-description" className="text-sm text-gray-600">
                {missedMedications.length} missed medication{missedMedications.length !== 1 ? 's' : ''} from the last 7 days
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close missed medications dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-140px)] sm:max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="sm" />
              <span className="ml-3 text-gray-600">Loading missed medications...</span>
            </div>
          ) : missedMedications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
              <p className="text-gray-600">
                No missed medications in the last 7 days. Great job staying on track!
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {groupedMedications.map(({ date, medications }) => (
                <div key={date} className="border border-gray-200 rounded-lg">
                  {/* Date Header */}
                  <button
                    onClick={() => toggleDateExpansion(date)}
                    className="w-full flex items-center justify-between p-4 min-h-[60px] hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <div className="text-left">
                        <h3 className="font-medium text-gray-900">{formatDate(date)}</h3>
                        <p className="text-sm text-gray-600">
                          {medications.length} missed medication{medications.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {expandedDates.has(date) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Medications List */}
                  {expandedDates.has(date) && (
                    <div className="border-t border-gray-200 p-4 space-y-3">
                      {medications.map((medication) => (
                        <div
                          key={medication.id}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Pill className="w-5 h-5 text-red-600" />
                                <h4 className="font-medium text-gray-900">
                                  {medication.medicationName}
                                </h4>
                                {'isPartOfPack' in medication && medication.isPartOfPack && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Package className="w-3 h-3 mr-1" />
                                    Pack
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 mb-2">
                                {medication.dosageAmount}
                              </p>
                              
                              {medication.instructions && (
                                <p className="text-xs text-gray-500 mb-2">
                                  {medication.instructions}
                                </p>
                              )}
                              
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center space-x-1 text-red-600">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    Scheduled: {formatTime(new Date(medication.scheduledDateTime))}
                                  </span>
                                </span>
                                <span className="text-gray-500">
                                  {getTimeAgo(new Date(medication.scheduledDateTime))}
                                </span>
                              </div>
                            </div>
                            
                            {/* Permission-based Action Buttons */}
                            <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 w-full sm:w-auto sm:ml-4">
                              {(() => {
                                const canEdit = hasPermission('canEdit');
                                
                                // Debug logging for permission checks
                                console.log('🔍 MissedMedicationsModal: Permission check for medication actions:', {
                                  eventId: medication.id,
                                  medicationName: medication.medicationName,
                                  userRole,
                                  canEdit,
                                  activePatientAccess: activePatientAccess ? {
                                    patientName: activePatientAccess.patientName,
                                    permissions: activePatientAccess.permissions,
                                    accessLevel: activePatientAccess.accessLevel
                                  } : null
                                });
                                
                                if (!canEdit) {
                                  return (
                                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 px-4 py-3 min-h-[44px] bg-gray-50 border border-gray-200 rounded-md">
                                      <Lock className="w-4 h-4" />
                                      <span>View only access</span>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <>
                                    <button
                                      onClick={() => handleMarkAsTakenLate(medication.id)}
                                      disabled={processingEventId === medication.id}
                                      className="px-4 py-3 min-h-[44px] bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                      aria-label={`Mark ${medication.medicationName} as taken late`}
                                    >
                                      {processingEventId === medication.id ? (
                                        <div className="flex items-center space-x-1">
                                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                          <span>Taking...</span>
                                        </div>
                                      ) : (
                                        'Mark as Taken Late'
                                      )}
                                    </button>
                                    
                                    <button
                                      onClick={() => setShowSkipModal(medication.id)}
                                      disabled={processingEventId === medication.id}
                                      className="px-4 py-3 min-h-[44px] bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                      aria-label={`Skip ${medication.medicationName} with reason`}
                                    >
                                      Skip with Reason
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Medications are automatically marked as missed after their grace period expires.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-3 min-h-[44px] bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
              aria-label="Close dialog"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Skip Reason Modal */}
      {showSkipModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-reason-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <h3 id="skip-reason-title" className="text-lg font-semibold text-gray-900 mb-4">
                Why are you skipping this medication?
              </h3>
              
              <div className="space-y-3 mb-4">
                {SKIP_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className="flex items-center space-x-3 p-3 min-h-[52px] border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="skipReason"
                      value={reason.value}
                      checked={skipReason === reason.value}
                      onChange={(e) => setSkipReason(e.target.value as SkipReason)}
                      className="text-primary-600 focus:ring-primary-500"
                      aria-label={reason.label}
                    />
                    <span className="text-lg" aria-hidden="true">{reason.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{reason.label}</span>
                  </label>
                ))}
              </div>
              
              <div className="mb-6">
                <label htmlFor="skip-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional notes (optional)
                </label>
                <textarea
                  id="skip-notes"
                  value={skipNotes}
                  onChange={(e) => setSkipNotes(e.target.value)}
                  placeholder="Any additional details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  aria-describedby="skip-notes-hint"
                />
                <span id="skip-notes-hint" className="sr-only">Provide any additional details about why you're skipping this medication</span>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowSkipModal(null);
                    setSkipNotes('');
                    setSkipReason('forgot');
                  }}
                  className="px-4 py-3 min-h-[44px] text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
                  aria-label="Cancel skipping medication"
                >
                  Cancel
                </button>
                <button
                  onClick={() => showSkipModal && handleSkipMedication(showSkipModal)}
                  disabled={processingEventId === showSkipModal}
                  className="px-4 py-3 min-h-[44px] bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  aria-label="Confirm skip medication"
                >
                  {processingEventId === showSkipModal ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Skipping...</span>
                    </div>
                  ) : (
                    'Skip Medication'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}