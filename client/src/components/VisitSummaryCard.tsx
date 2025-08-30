import React, { useState } from 'react';
import { 
  FileText, 
  Calendar, 
  User, 
  Building, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Pill,
  ListTodo,
  Users,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import type { VisitSummary, UrgencyLevel } from '@shared/types';

interface VisitSummaryCardProps {
  summary: VisitSummary;
  onEdit?: (summary: VisitSummary) => void;
  onDelete?: (summaryId: string) => void;
  onRetryAI?: (summaryId: string) => void;
  showFamilyView?: boolean;
  isFamily?: boolean;
}

export default function VisitSummaryCard({ 
  summary, 
  onEdit, 
  onDelete, 
  onRetryAI,
  showFamilyView = false,
  isFamily = false
}: VisitSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullSummary, setShowFullSummary] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const shouldShowField = (fieldName: string) => {
    if (!isFamily || !summary.restrictedFields) return true;
    return !summary.restrictedFields.includes(fieldName);
  };

  const getFamilyAccessibleContent = () => {
    if (!isFamily) return summary;
    
    switch (summary.familyAccessLevel) {
      case 'full':
        return summary;
      case 'summary_only':
        return {
          ...summary,
          doctorSummary: summary.aiProcessedSummary?.keyPoints?.join('. ') || 'Summary not available',
          treatmentPlan: summary.aiProcessedSummary?.actionItems?.join('. ') || 'Action items not available'
        };
      case 'restricted':
        return {
          ...summary,
          doctorSummary: 'Visit completed successfully',
          treatmentPlan: 'Follow treatment plan as discussed',
          diagnosis: [],
          procedures: [],
          vitalSigns: {}
        };
      case 'none':
        return null;
      default:
        return summary;
    }
  };

  const accessibleSummary = getFamilyAccessibleContent();
  if (!accessibleSummary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-gray-500">
          <EyeOff className="w-5 h-5" />
          <span>This visit summary is not shared with family members</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {summary.visitType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Visit
              </h3>
              
              {/* Processing Status */}
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(summary.processingStatus)}`}>
                {getStatusIcon(summary.processingStatus)}
                <span className="ml-1">{summary.processingStatus}</span>
              </span>

              {/* Urgency Indicator */}
              {summary.aiProcessedSummary?.urgencyLevel && (
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${getUrgencyColor(summary.aiProcessedSummary.urgencyLevel)}`}></div>
                  <span className="text-xs text-gray-500 capitalize">{summary.aiProcessedSummary.urgencyLevel}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(summary.visitDate)}</span>
              </div>
              
              {shouldShowField('providerName') && summary.providerName && (
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{summary.providerName}</span>
                  {summary.providerSpecialty && (
                    <span className="text-gray-400">({summary.providerSpecialty})</span>
                  )}
                </div>
              )}
              
              {shouldShowField('facilityName') && summary.facilityName && (
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4" />
                  <span>{summary.facilityName}</span>
                </div>
              )}
            </div>

            {/* Chief Complaint */}
            {shouldShowField('chiefComplaint') && summary.chiefComplaint && (
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-700">Chief Complaint: </span>
                <span className="text-sm text-gray-600">{summary.chiefComplaint}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!isFamily && (
            <div className="flex items-center space-x-2">
              {summary.processingStatus === 'failed' && onRetryAI && (
                <button
                  onClick={() => onRetryAI(summary.id)}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                  title="Retry AI processing"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              
              {onEdit && (
                <button
                  onClick={() => onEdit(summary)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Edit visit summary"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              
              {onDelete && (
                <button
                  onClick={() => onDelete(summary.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete visit summary"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Family Sharing Indicator */}
        {!isFamily && summary.sharedWithFamily && (
          <div className="mt-2 flex items-center space-x-2 text-sm text-green-600">
            <Users className="w-4 h-4" />
            <span>Shared with family ({summary.familyAccessLevel.replace('_', ' ')})</span>
          </div>
        )}
      </div>

      {/* AI-Generated Content Preview */}
      {summary.aiProcessedSummary && (
        <div className="p-4 bg-blue-50 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-blue-900 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>AI-Generated Summary</span>
            </h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Key Points Preview */}
          {summary.aiProcessedSummary.keyPoints && summary.aiProcessedSummary.keyPoints.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-blue-800 mb-1">Key Points:</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                {summary.aiProcessedSummary.keyPoints.slice(0, isExpanded ? undefined : 2).map((point, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                    <span>{point}</span>
                  </li>
                ))}
                {!isExpanded && summary.aiProcessedSummary.keyPoints.length > 2 && (
                  <li className="text-blue-600 text-xs">
                    +{summary.aiProcessedSummary.keyPoints.length - 2} more points
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Action Items Preview */}
          {summary.aiProcessedSummary.actionItems && summary.aiProcessedSummary.actionItems.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-blue-800 mb-1 flex items-center space-x-1">
                <ListTodo className="w-3 h-3" />
                <span>Action Items:</span>
              </h5>
              <ul className="text-sm text-blue-700 space-y-1">
                {summary.aiProcessedSummary.actionItems.slice(0, isExpanded ? undefined : 2).map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                    <span>{item}</span>
                  </li>
                ))}
                {!isExpanded && summary.aiProcessedSummary.actionItems.length > 2 && (
                  <li className="text-blue-600 text-xs">
                    +{summary.aiProcessedSummary.actionItems.length - 2} more items
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Medication Changes */}
          {summary.aiProcessedSummary.medicationChanges && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {summary.aiProcessedSummary.medicationChanges.newMedications.length > 0 && (
                <div className="bg-green-100 p-2 rounded">
                  <div className="flex items-center space-x-1 text-green-800 font-medium mb-1">
                    <Pill className="w-3 h-3" />
                    <span>New Medications</span>
                  </div>
                  <div className="text-green-700">
                    {summary.aiProcessedSummary.medicationChanges.newMedications.length} added
                  </div>
                </div>
              )}
              
              {summary.aiProcessedSummary.medicationChanges.stoppedMedications.length > 0 && (
                <div className="bg-red-100 p-2 rounded">
                  <div className="flex items-center space-x-1 text-red-800 font-medium mb-1">
                    <Pill className="w-3 h-3" />
                    <span>Stopped Medications</span>
                  </div>
                  <div className="text-red-700">
                    {summary.aiProcessedSummary.medicationChanges.stoppedMedications.length} stopped
                  </div>
                </div>
              )}
              
              {summary.aiProcessedSummary.medicationChanges.changedMedications.length > 0 && (
                <div className="bg-yellow-100 p-2 rounded">
                  <div className="flex items-center space-x-1 text-yellow-800 font-medium mb-1">
                    <Pill className="w-3 h-3" />
                    <span>Changed Medications</span>
                  </div>
                  <div className="text-yellow-700">
                    {summary.aiProcessedSummary.medicationChanges.changedMedications.length} modified
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Original Visit Summary */}
          {shouldShowField('doctorSummary') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-medium text-gray-900">Visit Summary</h5>
                <button
                  onClick={() => setShowFullSummary(!showFullSummary)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {showFullSummary ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {showFullSummary ? accessibleSummary.doctorSummary : 
                  `${accessibleSummary.doctorSummary?.substring(0, 200)}${accessibleSummary.doctorSummary && accessibleSummary.doctorSummary.length > 200 ? '...' : ''}`
                }
              </div>
            </div>
          )}

          {/* Treatment Plan */}
          {shouldShowField('treatmentPlan') && accessibleSummary.treatmentPlan && (
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Treatment Plan</h5>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {accessibleSummary.treatmentPlan}
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {shouldShowField('diagnosis') && summary.diagnosis && summary.diagnosis.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Diagnosis</h5>
              <div className="flex flex-wrap gap-2">
                {summary.diagnosis.map((diagnosis, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {diagnosis}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Procedures */}
          {shouldShowField('procedures') && summary.procedures && summary.procedures.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Procedures</h5>
              <div className="flex flex-wrap gap-2">
                {summary.procedures.map((procedure, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    {procedure}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Vital Signs */}
          {shouldShowField('vitalSigns') && summary.vitalSigns && Object.keys(summary.vitalSigns).length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Vital Signs</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {summary.vitalSigns.bloodPressure && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-600">Blood Pressure</div>
                    <div className="font-medium">{summary.vitalSigns.bloodPressure}</div>
                  </div>
                )}
                {summary.vitalSigns.heartRate && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-600">Heart Rate</div>
                    <div className="font-medium">{summary.vitalSigns.heartRate} bpm</div>
                  </div>
                )}
                {summary.vitalSigns.temperature && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-600">Temperature</div>
                    <div className="font-medium">{summary.vitalSigns.temperature}°F</div>
                  </div>
                )}
                {summary.vitalSigns.weight && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-600">Weight</div>
                    <div className="font-medium">{summary.vitalSigns.weight} lbs</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {summary.tags && summary.tags.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-2">Tags</h5>
              <div className="flex flex-wrap gap-2">
                {summary.tags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span>Created {formatDate(summary.createdAt)} at {formatTime(summary.createdAt)}</span>
          {summary.processingStatus === 'failed' && summary.aiProcessingError && (
            <span className="text-red-600">AI Error: {summary.aiProcessingError}</span>
          )}
        </div>
      </div>
    </div>
  );
}