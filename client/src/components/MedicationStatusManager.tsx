import React, { useState } from 'react';
import { 
  Pause, 
  Play, 
  StopCircle, 
  RefreshCw, 
  Calendar,
  AlertTriangle,
  Info,
  Save,
  X,
  Clock
} from 'lucide-react';
import type { 
  Medication, 
  MedicationStatusChange, 
  NewMedicationStatusChange,
  MedicationWithHistory
} from '@shared/types';

interface MedicationStatusManagerProps {
  medication: MedicationWithHistory;
  onStatusChange: (change: NewMedicationStatusChange) => Promise<void>;
  isLoading?: boolean;
}

export default function MedicationStatusManager({
  medication,
  onStatusChange,
  isLoading = false
}: MedicationStatusManagerProps) {
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showDiscontinueModal, setShowDiscontinueModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  
  // Hold form data
  const [holdReason, setHoldReason] = useState('');
  const [holdUntil, setHoldUntil] = useState('');
  const [autoResume, setAutoResume] = useState(false);
  const [holdInstructions, setHoldInstructions] = useState('');
  
  // Discontinue form data
  const [discontinueReason, setDiscontinueReason] = useState('');
  const [stopDate, setStopDate] = useState(new Date().toISOString().split('T')[0]);
  const [needsTaper, setNeedsTaper] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpInstructions, setFollowUpInstructions] = useState('');
  
  // Replace form data
  const [replaceReason, setReplaceReason] = useState('');
  const [newMedicationName, setNewMedicationName] = useState('');
  const [transitionPlan, setTransitionPlan] = useState('');
  const [overlapDays, setOverlapDays] = useState(0);

  const handleHold = async () => {
    try {
      const changeData: NewMedicationStatusChange = {
        medicationId: medication.id,
        patientId: medication.patientId,
        changeType: 'hold',
        holdData: {
          reason: holdReason,
          holdUntil: holdUntil ? new Date(holdUntil) : undefined,
          autoResumeEnabled: autoResume,
          holdInstructions: holdInstructions.trim() || undefined
        },
        performedBy: medication.patientId, // TODO: Get actual user ID
        notes: `Medication held: ${holdReason}`
      };

      await onStatusChange(changeData);
      setShowHoldModal(false);
      resetHoldForm();
    } catch (error) {
      console.error('Error holding medication:', error);
    }
  };

  const handleResume = async () => {
    try {
      const changeData: NewMedicationStatusChange = {
        medicationId: medication.id,
        patientId: medication.patientId,
        changeType: 'resume',
        performedBy: medication.patientId, // TODO: Get actual user ID
        notes: 'Medication resumed'
      };

      await onStatusChange(changeData);
    } catch (error) {
      console.error('Error resuming medication:', error);
    }
  };

  const handleDiscontinue = async () => {
    try {
      const changeData: NewMedicationStatusChange = {
        medicationId: medication.id,
        patientId: medication.patientId,
        changeType: 'discontinue',
        discontinueData: {
          reason: discontinueReason,
          stopDate: new Date(stopDate),
          followUpRequired,
          followUpInstructions: followUpInstructions.trim() || undefined
        },
        performedBy: medication.patientId, // TODO: Get actual user ID
        notes: `Medication discontinued: ${discontinueReason}`
      };

      await onStatusChange(changeData);
      setShowDiscontinueModal(false);
      resetDiscontinueForm();
    } catch (error) {
      console.error('Error discontinuing medication:', error);
    }
  };

  const handleReplace = async () => {
    try {
      const changeData: NewMedicationStatusChange = {
        medicationId: medication.id,
        patientId: medication.patientId,
        changeType: 'replace',
        replacementData: {
          reason: replaceReason,
          transitionPlan: transitionPlan.trim() || undefined,
          overlapDays: overlapDays > 0 ? overlapDays : undefined
        },
        performedBy: medication.patientId, // TODO: Get actual user ID
        notes: `Medication replacement: ${replaceReason}`
      };

      await onStatusChange(changeData);
      setShowReplaceModal(false);
      resetReplaceForm();
    } catch (error) {
      console.error('Error replacing medication:', error);
    }
  };

  const resetHoldForm = () => {
    setHoldReason('');
    setHoldUntil('');
    setAutoResume(false);
    setHoldInstructions('');
  };

  const resetDiscontinueForm = () => {
    setDiscontinueReason('');
    setStopDate(new Date().toISOString().split('T')[0]);
    setNeedsTaper(false);
    setFollowUpRequired(false);
    setFollowUpInstructions('');
  };

  const resetReplaceForm = () => {
    setReplaceReason('');
    setNewMedicationName('');
    setTransitionPlan('');
    setOverlapDays(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'held':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'discontinued':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'replaced':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4" />;
      case 'held':
        return <Pause className="w-4 h-4" />;
      case 'discontinued':
        return <StopCircle className="w-4 h-4" />;
      case 'replaced':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">Medication Status</h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(medication.currentStatus)}`}>
              {getStatusIcon(medication.currentStatus)}
              <span className="ml-1 capitalize">{medication.currentStatus}</span>
            </span>
          </div>
        </div>

        {/* Medication Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <h4 className="font-medium text-gray-900">{medication.name}</h4>
          <p className="text-sm text-gray-600">{medication.dosage} • {medication.frequency}</p>
          {medication.statusReason && (
            <p className="text-xs text-gray-500 mt-1">
              {medication.statusReason}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {medication.currentStatus === 'active' && (
            <>
              <button
                onClick={() => setShowHoldModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                <Pause className="w-4 h-4" />
                <span>Hold Temporarily</span>
              </button>
              
              <button
                onClick={() => setShowDiscontinueModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                <span>Discontinue</span>
              </button>
              
              <button
                onClick={() => setShowReplaceModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Replace</span>
              </button>
            </>
          )}
          
          {medication.currentStatus === 'held' && (
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>Resume</span>
            </button>
          )}
        </div>
      </div>

      {/* Status History */}
      {medication.statusHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-md font-medium text-gray-900 mb-3">Status History</h4>
          <div className="space-y-3">
            {medication.statusHistory.slice(0, 5).map((change) => (
              <div key={change.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(change.changeType)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {change.changeType}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(change.performedAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {change.holdData && (
                    <p className="text-sm text-gray-600">
                      Reason: {change.holdData.reason}
                      {change.holdData.holdUntil && (
                        <span> • Until: {new Date(change.holdData.holdUntil).toLocaleDateString()}</span>
                      )}
                    </p>
                  )}
                  
                  {change.discontinueData && (
                    <p className="text-sm text-gray-600">
                      Reason: {change.discontinueData.reason}
                      {change.discontinueData.followUpRequired && (
                        <span> • Follow-up required</span>
                      )}
                    </p>
                  )}
                  
                  {change.replacementData && (
                    <p className="text-sm text-gray-600">
                      Reason: {change.replacementData.reason}
                      {change.replacementData.overlapDays && (
                        <span> • {change.replacementData.overlapDays} day overlap</span>
                      )}
                    </p>
                  )}
                  
                  {change.notes && (
                    <p className="text-xs text-gray-500 mt-1">{change.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hold Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Hold Medication</h3>
              <button
                onClick={() => setShowHoldModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <div className="flex items-start space-x-2">
                  <Pause className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Temporarily hold {medication.name}</p>
                    <p>This will pause all reminders and scheduled doses until resumed.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for holding *
                </label>
                <select
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a reason</option>
                  <option value="surgery">Surgery/procedure</option>
                  <option value="side_effects">Side effects</option>
                  <option value="drug_interaction">Drug interaction</option>
                  <option value="illness">Illness/infection</option>
                  <option value="travel">Travel</option>
                  <option value="provider_instruction">Provider instruction</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hold until (optional)
                </label>
                <input
                  type="date"
                  value={holdUntil}
                  onChange={(e) => setHoldUntil(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {holdUntil && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoResume"
                    checked={autoResume}
                    onChange={(e) => setAutoResume(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="autoResume" className="text-sm text-gray-700">
                    Automatically resume on this date
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special instructions (optional)
                </label>
                <textarea
                  value={holdInstructions}
                  onChange={(e) => setHoldInstructions(e.target.value)}
                  placeholder="Any special instructions for when to resume..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowHoldModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHold}
                disabled={!holdReason || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                Hold Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discontinue Modal */}
      {showDiscontinueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Discontinue Medication</h3>
              <button
                onClick={() => setShowDiscontinueModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Permanently discontinue {medication.name}</p>
                    <p>This action will stop all future doses and cannot be easily undone.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for discontinuing *
                </label>
                <select
                  value={discontinueReason}
                  onChange={(e) => setDiscontinueReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a reason</option>
                  <option value="treatment_complete">Treatment completed</option>
                  <option value="ineffective">Medication not effective</option>
                  <option value="side_effects">Intolerable side effects</option>
                  <option value="allergic_reaction">Allergic reaction</option>
                  <option value="drug_interaction">Drug interaction</option>
                  <option value="provider_decision">Provider decision</option>
                  <option value="patient_preference">Patient preference</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop date
                </label>
                <input
                  type="date"
                  value={stopDate}
                  onChange={(e) => setStopDate(e.target.value)}
                  max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Max 30 days in future
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="followUpRequired"
                  checked={followUpRequired}
                  onChange={(e) => setFollowUpRequired(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="followUpRequired" className="text-sm text-gray-700">
                  Follow-up appointment required
                </label>
              </div>

              {followUpRequired && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Follow-up instructions
                  </label>
                  <textarea
                    value={followUpInstructions}
                    onChange={(e) => setFollowUpInstructions(e.target.value)}
                    placeholder="Instructions for follow-up care..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowDiscontinueModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscontinue}
                disabled={!discontinueReason || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Discontinue Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Replace Medication</h3>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="flex items-start space-x-2">
                  <RefreshCw className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-purple-800">
                    <p className="font-medium">Replace {medication.name}</p>
                    <p>This will help track the transition to a new medication.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for replacement *
                </label>
                <select
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a reason</option>
                  <option value="dosage_adjustment">Dosage adjustment needed</option>
                  <option value="formulation_change">Different formulation</option>
                  <option value="generic_to_brand">Switch to brand name</option>
                  <option value="brand_to_generic">Switch to generic</option>
                  <option value="side_effects">Side effects</option>
                  <option value="effectiveness">Effectiveness concerns</option>
                  <option value="cost">Cost considerations</option>
                  <option value="availability">Availability issues</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transition plan
                </label>
                <textarea
                  value={transitionPlan}
                  onChange={(e) => setTransitionPlan(e.target.value)}
                  placeholder="Describe how to transition to the new medication..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overlap period (days)
                </label>
                <input
                  type="number"
                  value={overlapDays}
                  onChange={(e) => setOverlapDays(parseInt(e.target.value) || 0)}
                  min="0"
                  max="30"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of days to take both old and new medications
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowReplaceModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReplace}
                disabled={!replaceReason || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Replace Medication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}