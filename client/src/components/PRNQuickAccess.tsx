import React, { useState, useEffect } from 'react';
import {
  Pill,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Medication } from '@shared/types';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import { useFamily } from '@/contexts/FamilyContext';
import QuickActionButtons from './QuickActionButtons';
import LoadingSpinner from './LoadingSpinner';

interface PRNQuickAccessProps {
  medications: Medication[];
  onMedicationAction?: (medicationId: string, action: 'take' | 'skip') => void;
  compactMode?: boolean;
}

interface PRNMedicationWithHistory extends Medication {
  lastTaken?: Date;
  timeSinceLastTaken?: string;
  todayDoseCount?: number;
  isNearMaxDose?: boolean;
}

export default function PRNQuickAccess({
  medications,
  onMedicationAction,
  compactMode = false
}: PRNQuickAccessProps) {
  const [prnMedications, setPrnMedications] = useState<PRNMedicationWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [processingMedId, setProcessingMedId] = useState<string | null>(null);
  const { hasPermission, getEffectivePatientId } = useFamily();

  useEffect(() => {
    loadPRNMedications();
  }, [medications]);

  const loadPRNMedications = async () => {
    try {
      setIsLoading(true);
      
      // Filter PRN medications
      const prnMeds = medications.filter(med => med.isPRN && med.isActive);
      
      // Enrich with history data
      const enrichedMeds = await Promise.all(
        prnMeds.map(async (med) => {
          try {
            // For now, we'll use a simplified approach without history
            // This can be enhanced when the history API is available
            let lastTaken: Date | undefined;
            let todayDoseCount = 0;

            // Calculate time since last taken
            let timeSinceLastTaken: string | undefined;
            if (lastTaken) {
              const diffMs = Date.now() - lastTaken.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              
              if (diffHours > 0) {
                timeSinceLastTaken = `${diffHours}h ${diffMins}m ago`;
              } else {
                timeSinceLastTaken = `${diffMins}m ago`;
              }
            }

            // Check if near max daily dose
            const maxDailyDose = med.maxDailyDose ? parseInt(med.maxDailyDose) : null;
            const isNearMaxDose = maxDailyDose ? todayDoseCount >= maxDailyDose * 0.8 : false;

            return {
              ...med,
              lastTaken,
              timeSinceLastTaken,
              todayDoseCount,
              isNearMaxDose
            };
          } catch (error) {
            console.error(`Error loading history for ${med.name}:`, error);
            return med;
          }
        })
      );

      setPrnMedications(enrichedMeds);
    } catch (error) {
      console.error('Error loading PRN medications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakePRN = async (medication: PRNMedicationWithHistory) => {
    try {
      setProcessingMedId(medication.id);
      
      // Use unified API to mark as taken
      const result = await unifiedMedicationApi.markMedicationTaken(medication.id, {
        scheduledDateTime: new Date(),
        takenAt: new Date(),
        notes: 'PRN dose taken'
      });

      if (result.success) {
        onMedicationAction?.(medication.id, 'take');
        // Reload to update history
        await loadPRNMedications();
      }
    } catch (error) {
      console.error('Error taking PRN medication:', error);
    } finally {
      setProcessingMedId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-600">Loading PRN medications...</span>
        </div>
      </div>
    );
  }

  if (prnMedications.length === 0) {
    return null; // Don't show section if no PRN medications
  }

  const canEdit = hasPermission('canEdit');

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-purple-100/50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Pill className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <span>As Needed Medications</span>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full text-xs font-bold">
                PRN
              </span>
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              {prnMedications.length} medication{prnMedications.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Take these medications only when needed. Check dosage limits before taking.
            </p>
          </div>

          {/* PRN Medications List */}
          {prnMedications.map((med) => (
            <div
              key={med.id}
              className={`bg-white rounded-lg border p-4 transition-all ${
                med.isNearMaxDose
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Medication Name */}
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{med.name}</h4>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                      AS NEEDED
                    </span>
                  </div>

                  {/* Dosage */}
                  <p className="text-sm text-gray-700 mb-3">{med.dosage}</p>

                  {/* Status Information */}
                  <div className="space-y-2">
                    {/* Last Taken */}
                    {med.lastTaken && med.timeSinceLastTaken ? (
                      <div className="flex items-center space-x-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">
                          Last taken: <span className="font-medium">{med.timeSinceLastTaken}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Not taken today</span>
                      </div>
                    )}

                    {/* Daily Dose Count */}
                    {med.maxDailyDose && (
                      <div className="flex items-center space-x-2 text-sm">
                        {med.isNearMaxDose ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <span className="text-orange-800 font-medium">
                              {med.todayDoseCount} of {med.maxDailyDose} max daily doses taken
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-gray-600">
                              {med.todayDoseCount} of {med.maxDailyDose} max daily doses
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Instructions */}
                    {med.instructions && (
                      <p className="text-xs text-gray-600 italic mt-2">
                        {med.instructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {canEdit && (
                  <div className="flex-shrink-0">
                    {med.isNearMaxDose ? (
                      <div className="px-4 py-3 bg-orange-100 border border-orange-300 rounded-md text-center">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                        <p className="text-xs text-orange-800 font-medium">Near limit</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTakePRN(med)}
                        disabled={processingMedId === med.id}
                        className="px-4 py-3 min-h-[44px] bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium text-sm whitespace-nowrap"
                      >
                        {processingMedId === med.id ? (
                          <div className="flex items-center space-x-2">
                            <LoadingSpinner size="sm" />
                            <span>Taking...</span>
                          </div>
                        ) : (
                          'Take Now'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}