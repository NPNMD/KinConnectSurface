import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  X, 
  ChevronDown, 
  ChevronUp,
  Info,
  AlertCircle,
  XCircle
} from 'lucide-react';
import type { MedicationSafetyAlert } from '@shared/types';

interface SafetyAlertBannerProps {
  patientId: string;
  alerts: MedicationSafetyAlert[];
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  compactMode?: boolean;
}

export default function SafetyAlertBanner({
  patientId,
  alerts,
  onAcknowledge,
  onDismiss,
  compactMode = false
}: SafetyAlertBannerProps) {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [processingAlert, setProcessingAlert] = useState<string | null>(null);

  // Filter active alerts and sort by severity
  const activeAlerts = alerts
    .filter(alert => alert.isActive && !alert.acknowledgedAt && !alert.dismissedAt)
    .sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning');
  const infoAlerts = activeAlerts.filter(alert => alert.severity === 'info');

  const toggleAlertExpansion = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      setProcessingAlert(alertId);
      await onAcknowledge?.(alertId);
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setProcessingAlert(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      setProcessingAlert(alertId);
      await onDismiss?.(alertId);
    } catch (error) {
      console.error('Error dismissing alert:', error);
    } finally {
      setProcessingAlert(null);
    }
  };

  const getAlertIcon = (severity: string, alertType: string) => {
    if (severity === 'critical') {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else if (severity === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    } else {
      return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getAlertTypeLabel = (alertType: string) => {
    switch (alertType) {
      case 'interaction':
        return 'Drug Interaction';
      case 'duplicate':
        return 'Duplicate Medication';
      case 'separation':
        return 'Timing Separation Required';
      case 'contraindication':
        return 'Contraindication';
      case 'allergy':
        return 'Allergy Alert';
      case 'dosage_concern':
        return 'Dosage Concern';
      default:
        return 'Safety Alert';
    }
  };

  if (activeAlerts.length === 0) {
    return null;
  }

  if (compactMode) {
    return (
      <div className="space-y-2">
        {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                {criticalAlerts.length} critical safety alert{criticalAlerts.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
        
        {warningAlerts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">
                {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Shield className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Safety Alerts</h3>
        <span className="text-sm text-gray-500">
          ({activeAlerts.length} active)
        </span>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-lg border p-4 ${getAlertColor(alert.severity)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getAlertIcon(alert.severity, alert.alertType)}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-medium">{alert.title}</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {getAlertTypeLabel(alert.alertType)}
                  </span>
                </div>
                
                <p className="text-sm mb-2">{alert.description}</p>
                
                {/* Affected Medications */}
                <div className="mb-2">
                  <p className="text-xs font-medium mb-1">Affected medications:</p>
                  <div className="flex flex-wrap gap-1">
                    {alert.affectedMedications.map((med, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white bg-opacity-50"
                      >
                        {med.medicationName}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {expandedAlerts.has(alert.id) && alert.recommendations.length > 0 && (
                  <div className="mt-3 p-3 bg-white bg-opacity-50 rounded-lg">
                    <p className="text-xs font-medium mb-2">Recommendations:</p>
                    <ul className="text-xs space-y-1">
                      {alert.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start space-x-1">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Expand/Collapse */}
              <button
                onClick={() => toggleAlertExpansion(alert.id)}
                className="p-1 text-gray-600 hover:text-gray-800"
                title={expandedAlerts.has(alert.id) ? 'Show less' : 'Show more'}
              >
                {expandedAlerts.has(alert.id) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* Actions */}
              {alert.severity === 'critical' ? (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={processingAlert === alert.id}
                  className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {processingAlert === alert.id ? 'Processing...' : 'Acknowledge'}
                </button>
              ) : (
                <button
                  onClick={() => handleDismiss(alert.id)}
                  disabled={processingAlert === alert.id}
                  className="p-1 text-gray-600 hover:text-gray-800"
                  title="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Warning Alerts */}
      {warningAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-lg border p-4 ${getAlertColor(alert.severity)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getAlertIcon(alert.severity, alert.alertType)}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-medium">{alert.title}</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {getAlertTypeLabel(alert.alertType)}
                  </span>
                </div>
                
                <p className="text-sm mb-2">{alert.description}</p>
                
                {expandedAlerts.has(alert.id) && (
                  <div className="space-y-2">
                    {/* Affected Medications */}
                    <div>
                      <p className="text-xs font-medium mb-1">Affected medications:</p>
                      <div className="flex flex-wrap gap-1">
                        {alert.affectedMedications.map((med, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white bg-opacity-50"
                          >
                            {med.medicationName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    {alert.recommendations.length > 0 && (
                      <div className="p-3 bg-white bg-opacity-50 rounded-lg">
                        <p className="text-xs font-medium mb-2">Recommendations:</p>
                        <ul className="text-xs space-y-1">
                          {alert.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start space-x-1">
                              <span>•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => toggleAlertExpansion(alert.id)}
                className="p-1 text-gray-600 hover:text-gray-800"
              >
                {expandedAlerts.has(alert.id) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={() => handleDismiss(alert.id)}
                disabled={processingAlert === alert.id}
                className="p-1 text-gray-600 hover:text-gray-800"
                title="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Info Alerts - Collapsed by default */}
      {infoAlerts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {infoAlerts.length} informational alert{infoAlerts.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => {
                if (expandedAlerts.has('info-alerts')) {
                  setExpandedAlerts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete('info-alerts');
                    return newSet;
                  });
                } else {
                  setExpandedAlerts(prev => new Set([...prev, 'info-alerts']));
                }
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              {expandedAlerts.has('info-alerts') ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
          
          {expandedAlerts.has('info-alerts') && (
            <div className="mt-3 space-y-2">
              {infoAlerts.map((alert) => (
                <div key={alert.id} className="bg-white bg-opacity-50 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-blue-900">{alert.title}</h5>
                      <p className="text-sm text-blue-800 mt-1">{alert.description}</p>
                      
                      {alert.recommendations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-blue-900 mb-1">Recommendations:</p>
                          <ul className="text-xs text-blue-800 space-y-1">
                            {alert.recommendations.map((rec, index) => (
                              <li key={index}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      disabled={processingAlert === alert.id}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="Dismiss alert"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safety Summary */}
      {activeAlerts.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Medication Safety Summary:</p>
              <ul className="space-y-1 text-xs">
                {criticalAlerts.length > 0 && (
                  <li className="text-red-600">• {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} requiring immediate attention</li>
                )}
                {warningAlerts.length > 0 && (
                  <li className="text-yellow-600">• {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''} to review</li>
                )}
                {infoAlerts.length > 0 && (
                  <li className="text-blue-600">• {infoAlerts.length} informational alert{infoAlerts.length > 1 ? 's' : ''}</li>
                )}
                <li className="text-gray-500">• Review alerts with your healthcare provider if you have questions</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}