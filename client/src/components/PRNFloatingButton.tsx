import React, { useState } from 'react';
import { Pill, X } from 'lucide-react';
import { Medication } from '@shared/types';
import PRNQuickAccess from './PRNQuickAccess';

interface PRNFloatingButtonProps {
  medications: Medication[];
  onMedicationAction?: (medicationId: string, action: 'take' | 'skip') => void;
}

export default function PRNFloatingButton({
  medications,
  onMedicationAction
}: PRNFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter PRN medications
  const prnMedications = medications.filter(med => med.isPRN && med.isActive);

  // Don't show button if no PRN medications
  if (prnMedications.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 z-50 p-4 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Quick access to PRN medications"
      >
        <Pill className="w-6 h-6" />
        {prnMedications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {prnMedications.length}
          </span>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
            <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Pill className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        As Needed Medications
                      </h3>
                      <p className="text-sm text-purple-100">
                        Quick access to PRN medications
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                <PRNQuickAccess
                  medications={medications}
                  onMedicationAction={(medId, action) => {
                    onMedicationAction?.(medId, action);
                    // Close modal after action
                    setTimeout(() => setIsOpen(false), 500);
                  }}
                  compactMode={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}