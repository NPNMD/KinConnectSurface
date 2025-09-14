import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Save,
  X,
  Calendar,
  BarChart3
} from 'lucide-react';
import type {
  Medication,
  PRNMedicationLog,
  NewPRNMedicationLog,
  PRNReason
} from '@shared/types';
import { PRN_REASONS, PAIN_SCALE } from '@shared/types';

interface PRNLoggerProps {
  medication: Medication;
  onLogPRN?: (log: PRNMedicationLog) => void;
  recentLogs?: PRNMedicationLog[];
  compactMode?: boolean;
}

interface PRNFormData {
  reason: PRNReason;
  customReason: string;
  dosageAmount: string;
  painScoreBefore?: number;
  symptoms: string[];
  notes: string;
}

export default function PRNLogger({
  medication,
  onLogPRN,
  recentLogs = [],
  compactMode = false
}: PRNLoggerProps) {
  const [showLogForm, setShowLogForm] = useState(false);
  const [formData, setFormData] = useState<PRNFormData>({
    reason: 'pain',
    customReason: '',
    dosageAmount: medication.dosage,
    symptoms: [],
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Calculate recent usage stats
  const last24Hours = recentLogs.filter(log => {
    const logTime = new Date(log.takenAt);
    const now = new Date();
    return (now.getTime() - logTime.getTime()) <= (24 * 60 * 60 * 1000);
  }).length;

  const last7Days = recentLogs.filter(log => {
    const logTime = new Date(log.takenAt);
    const now = new Date();
    return (now.getTime() - logTime.getTime()) <= (7 * 24 * 60 * 60 * 1000);
  }).length;

  const lastDose = recentLogs.length > 0 ? recentLogs[0] : null;
  const timeSinceLastDose = lastDose ? 
    Math.floor((new Date().getTime() - new Date(lastDose.takenAt).getTime()) / (1000 * 60 * 60)) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      const prnLogData: NewPRNMedicationLog = {
        medicationId: medication.id,
        patientId: medication.patientId,
        takenAt: new Date(),
        dosageAmount: formData.dosageAmount,
        reason: formData.reason === 'other' ? formData.customReason : formData.reason,
        painScoreBefore: formData.painScoreBefore,
        symptoms: formData.symptoms,
        notes: formData.notes.trim() || undefined,
        loggedBy: medication.patientId // TODO: Get actual user ID
      };

      // TODO: Implement API call to create PRN log
      console.log('Creating PRN log:', prnLogData);
      
      // Simulate success for now
      const newPRNLog: PRNMedicationLog = {
        id: `prn_${Date.now()}`,
        ...prnLogData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      onLogPRN?.(newPRNLog);
      handleCancel();
      
    } catch (error) {
      console.error('Error logging PRN medication:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowLogForm(false);
    setFormData({
      reason: 'pain',
      customReason: '',
      dosageAmount: medication.dosage,
      symptoms: [],
      notes: ''
    });
  };

  const getPainScaleColor = (score: number): string => {
    const painLevel = PAIN_SCALE.find(p => p.value === score);
    return painLevel?.color || 'text-gray-600';
  };

  const getReasonData = (reason: PRNReason) => {
    return PRN_REASONS.find(r => r.value === reason);
  };

  const isRecentDose = timeSinceLastDose !== null && timeSinceLastDose < 4; // Within 4 hours
  const dailyLimitConcern = last24Hours >= 4; // More than 4 doses in 24 hours

  if (compactMode) {
    return (
      <div className="space-y-3">
        {/* Quick PRN Button */}
        <button
          onClick={() => setShowLogForm(true)}
          className={`w-full flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed transition-colors ${
            isRecentDose || dailyLimitConcern
              ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
              : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
          }`}
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Log PRN Dose</span>
        </button>

        {/* Usage Warning */}
        {(isRecentDose || dailyLimitConcern) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                {isRecentDose && (
                  <p>Last dose was {timeSinceLastDose} hour{timeSinceLastDose !== 1 ? 's' : ''} ago.</p>
                )}
                {dailyLimitConcern && (
                  <p>{last24Hours} doses in the last 24 hours. Consider consulting your doctor.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Log Form */}
        {showLogForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for taking {medication.name}
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value as PRNReason }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRN_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.icon} {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.reason === 'other' && (
                <div>
                  <input
                    type="text"
                    value={formData.customReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                    placeholder="Describe the reason..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {getReasonData(formData.reason)?.requiresPainScore && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pain level before taking medication
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, painScoreBefore: score }))}
                        className={`p-2 text-xs rounded border transition-colors ${
                          formData.painScoreBefore === score
                            ? 'border-blue-500 bg-blue-100 text-blue-900'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  {formData.painScoreBefore && (
                    <p className={`text-xs mt-1 ${getPainScaleColor(formData.painScoreBefore)}`}>
                      {PAIN_SCALE.find(p => p.value === formData.painScoreBefore)?.description}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Logging...' : 'Log Dose'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900">PRN Medication</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            As Needed
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          {!showLogForm && (
            <button
              onClick={() => setShowLogForm(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Log PRN Dose</span>
            </button>
          )}
        </div>
      </div>

      {/* Medication Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900">{medication.name}</h4>
        <p className="text-sm text-gray-600">{medication.dosage} • As needed</p>
        {medication.maxDailyDose && (
          <p className="text-xs text-gray-500 mt-1">
            Maximum: {medication.maxDailyDose} per day
          </p>
        )}
      </div>

      {/* Usage Warnings */}
      {(isRecentDose || dailyLimitConcern) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Usage Alert</p>
              {isRecentDose && (
                <p>• Last dose was {timeSinceLastDose} hour{timeSinceLastDose !== 1 ? 's' : ''} ago</p>
              )}
              {dailyLimitConcern && (
                <p>• {last24Hours} doses in the last 24 hours</p>
              )}
              <p className="mt-2 text-xs">Consider consulting your healthcare provider if you're using this medication frequently.</p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      {showAnalytics && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Usage Analytics</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{last24Hours}</div>
              <div className="text-xs text-blue-800">Last 24 hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{last7Days}</div>
              <div className="text-xs text-blue-800">Last 7 days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {last7Days > 0 ? Math.round((last7Days / 7) * 10) / 10 : 0}
              </div>
              <div className="text-xs text-blue-800">Daily average</div>
            </div>
          </div>
        </div>
      )}

      {/* Log Form */}
      {showLogForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">Log PRN Dose</h4>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you taking this medication?
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PRN_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.reason === reason.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.value}
                      checked={formData.reason === reason.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value as PRNReason }))}
                      className="sr-only"
                    />
                    <span className="text-lg">{reason.icon}</span>
                    <span className="text-sm">{reason.label}</span>
                  </label>
                ))}
              </div>
              
              {formData.reason === 'other' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={formData.customReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                    placeholder="Describe the reason..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              )}
            </div>

            {/* Pain Score (if applicable) */}
            {getReasonData(formData.reason)?.requiresPainScore && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pain level before taking medication (1-10 scale)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {PAIN_SCALE.map((painLevel) => (
                    <button
                      key={painLevel.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, painScoreBefore: painLevel.value }))}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        formData.painScoreBefore === painLevel.value
                          ? 'border-blue-500 bg-blue-100'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-lg font-bold">{painLevel.value}</div>
                      <div className="text-xs">{painLevel.label}</div>
                    </button>
                  ))}
                </div>
                {formData.painScoreBefore && (
                  <p className={`text-sm mt-2 ${getPainScaleColor(formData.painScoreBefore)}`}>
                    {PAIN_SCALE.find(p => p.value === formData.painScoreBefore)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Dosage Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dosage Amount
              </label>
              <input
                type="text"
                value={formData.dosageAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, dosageAmount: e.target.value }))}
                placeholder="e.g., 1 tablet, 5ml, 200mg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional details about symptoms, timing, or circumstances..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Logging...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Log Dose</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Recent PRN Doses</h4>
          <div className="space-y-2">
            {recentLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="bg-white border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {log.dosageAmount}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.takenAt).toLocaleString([], { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      Reason: {log.reason}
                    </p>
                    
                    {log.painScoreBefore && (
                      <p className="text-xs text-gray-500">
                        Pain level: {log.painScoreBefore}/10
                      </p>
                    )}
                    
                    {log.effectiveness && (
                      <div className="flex items-center space-x-1 mt-1">
                        <TrendingUp className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-green-600 capitalize">
                          {log.effectiveness.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}