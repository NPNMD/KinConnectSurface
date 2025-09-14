import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Building,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Pill,
  ListTodo,
  Users,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  Share2,
  Mic
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import VisitSummaryCard from '@/components/VisitSummaryCard';
import type { VisitSummary } from '@shared/types';

export default function VisitSummaryDetail() {
  const { summaryId } = useParams<{ summaryId: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  useEffect(() => {
    if (summaryId && firebaseUser?.uid) {
      fetchVisitSummary();
    }
  }, [summaryId, firebaseUser?.uid]);

  const fetchVisitSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = firebaseUser?.uid;
      if (!userId || !summaryId) return;

      console.log('🔍 Fetching visit summary:', { userId, summaryId });
      
      const response = await apiClient.get<{ success: boolean; data: VisitSummary }>(
        API_ENDPOINTS.VISIT_SUMMARY_BY_ID(userId, summaryId)
      );
      
      if (response.success && response.data) {
        // Convert date strings to Date objects
        const summaryData = {
          ...response.data,
          visitDate: new Date(response.data.visitDate),
          createdAt: new Date(response.data.createdAt),
          updatedAt: new Date(response.data.updatedAt),
          lastProcessingAttempt: response.data.lastProcessingAttempt 
            ? new Date(response.data.lastProcessingAttempt) 
            : undefined,
          aiProcessedSummary: response.data.aiProcessedSummary ? {
            ...response.data.aiProcessedSummary,
            followUpDate: response.data.aiProcessedSummary.followUpDate 
              ? new Date(response.data.aiProcessedSummary.followUpDate)
              : undefined
          } : undefined
        };
        
        setSummary(summaryData);
        console.log('✅ Visit summary loaded:', summaryData);
      } else {
        setError('Visit summary not found');
      }
    } catch (error) {
      console.error('❌ Error fetching visit summary:', error);
      setError('Failed to load visit summary');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (summary: VisitSummary) => {
    // TODO: Implement edit functionality
    console.log('Edit summary:', summary.id);
  };

  const handleDelete = async (summaryId: string) => {
    if (!confirm('Are you sure you want to delete this visit summary? This action cannot be undone.')) {
      return;
    }

    try {
      const userId = firebaseUser?.uid;
      if (!userId) return;

      const response = await apiClient.delete<{ success: boolean }>(
        API_ENDPOINTS.VISIT_SUMMARY_DELETE(userId, summaryId)
      );

      if (response.success) {
        navigate('/dashboard');
      } else {
        alert('Failed to delete visit summary');
      }
    } catch (error) {
      console.error('Error deleting visit summary:', error);
      alert('Failed to delete visit summary');
    }
  };

  const handleRetryAI = async (summaryId: string) => {
    try {
      const userId = firebaseUser?.uid;
      if (!userId) return;

      const response = await apiClient.post<{ success: boolean }>(
        API_ENDPOINTS.VISIT_SUMMARY_RETRY_AI(userId, summaryId)
      );

      if (response.success) {
        // Refresh the summary to show updated processing status
        await fetchVisitSummary();
      } else {
        alert('Failed to retry AI processing');
      }
    } catch (error) {
      console.error('Error retrying AI processing:', error);
      alert('Failed to retry AI processing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Visit Summary Not Found'}
          </h1>
          <p className="text-gray-600 mb-4">
            The visit summary you're looking for could not be loaded.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2">
                <FileText className="w-6 h-6 text-blue-600" />
                <h1 className="text-lg font-semibold text-gray-900">Visit Summary</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFullTranscript(!showFullTranscript)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={showFullTranscript ? 'Hide full transcript' : 'Show full transcript'}
              >
                {showFullTranscript ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              
              <button
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Share summary"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Visit Summary Card */}
          <div className="mb-6">
            <VisitSummaryCard
              summary={summary}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRetryAI={handleRetryAI}
              showFamilyView={false}
              isFamily={false}
            />
          </div>

          {/* Full Transcript Section */}
          {summary.inputMethod === 'voice' && summary.voiceTranscriptionId && showFullTranscript && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <Mic className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Full Voice Transcript</h2>
                <span className="text-sm text-gray-500">
                  Recording ID: {summary.voiceTranscriptionId}
                </span>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {summary.doctorSummary}
                </div>
              </div>
              
              {summary.processingStatus === 'completed' && summary.aiProcessedSummary && (
                <div className="mt-4 text-sm text-green-600 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    This transcript has been processed by AI to extract key points and action items shown above.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* AI Processing Details */}
          {summary.aiProcessedSummary && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">AI Analysis Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Key Points */}
                {summary.aiProcessedSummary.keyPoints && summary.aiProcessedSummary.keyPoints.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <ListTodo className="w-4 h-4 text-blue-600" />
                      <span>Key Points</span>
                    </h3>
                    <ul className="space-y-2">
                      {summary.aiProcessedSummary.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-sm text-gray-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {summary.aiProcessedSummary.actionItems && summary.aiProcessedSummary.actionItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Action Items</span>
                    </h3>
                    <ul className="space-y-2">
                      {summary.aiProcessedSummary.actionItems.map((item, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-sm text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Medication Changes */}
              {summary.aiProcessedSummary.medicationChanges && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <Pill className="w-4 h-4 text-purple-600" />
                    <span>Medication Changes</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* New Medications */}
                    {summary.aiProcessedSummary.medicationChanges.newMedications.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-green-800 mb-2">New Medications</h4>
                        <ul className="space-y-2">
                          {summary.aiProcessedSummary.medicationChanges.newMedications.map((med, index) => (
                            <li key={index} className="text-sm text-green-700">
                              <div className="font-medium">{med.name}</div>
                              {med.dosage && <div className="text-xs">{med.dosage}</div>}
                              {med.instructions && <div className="text-xs italic">{med.instructions}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Stopped Medications */}
                    {summary.aiProcessedSummary.medicationChanges.stoppedMedications.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-red-800 mb-2">Stopped Medications</h4>
                        <ul className="space-y-2">
                          {summary.aiProcessedSummary.medicationChanges.stoppedMedications.map((med, index) => (
                            <li key={index} className="text-sm text-red-700">
                              <div className="font-medium">{med.name}</div>
                              {med.reason && <div className="text-xs italic">{med.reason}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Changed Medications */}
                    {summary.aiProcessedSummary.medicationChanges.changedMedications.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-yellow-800 mb-2">Modified Medications</h4>
                        <ul className="space-y-2">
                          {summary.aiProcessedSummary.medicationChanges.changedMedications.map((med, index) => (
                            <li key={index} className="text-sm text-yellow-700">
                              <div className="font-medium">{med.name}</div>
                              {med.oldDosage && med.newDosage && (
                                <div className="text-xs">
                                  {med.oldDosage} → {med.newDosage}
                                </div>
                              )}
                              {med.reason && <div className="text-xs italic">{med.reason}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Follow-up Information */}
              {summary.aiProcessedSummary.followUpRequired && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Follow-up Required</span>
                  </h3>
                  
                  {summary.aiProcessedSummary.followUpDate && (
                    <div className="text-sm text-blue-700 mb-2">
                      <strong>When:</strong> {summary.aiProcessedSummary.followUpDate.toLocaleDateString()}
                    </div>
                  )}
                  
                  {summary.aiProcessedSummary.followUpInstructions && (
                    <div className="text-sm text-blue-700">
                      <strong>Instructions:</strong> {summary.aiProcessedSummary.followUpInstructions}
                    </div>
                  )}
                </div>
              )}

              {/* Risk Factors and Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {summary.aiProcessedSummary.riskFactors && summary.aiProcessedSummary.riskFactors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <span>Risk Factors</span>
                    </h3>
                    <ul className="space-y-2">
                      {summary.aiProcessedSummary.riskFactors.map((factor, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-sm text-gray-700">{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.aiProcessedSummary.recommendations && summary.aiProcessedSummary.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Recommendations</span>
                    </h3>
                    <ul className="space-y-2">
                      {summary.aiProcessedSummary.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-sm text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing Status */}
          {summary.processingStatus !== 'completed' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                {summary.processingStatus === 'processing' ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : summary.processingStatus === 'failed' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
                <h2 className="text-lg font-semibold text-gray-900">
                  Processing Status: {summary.processingStatus}
                </h2>
              </div>

              {summary.processingStatus === 'failed' && summary.aiProcessingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-700">
                    <strong>Error:</strong> {summary.aiProcessingError}
                  </p>
                  <button
                    onClick={() => handleRetryAI(summary.id)}
                    className="mt-2 inline-flex items-center space-x-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry AI Processing</span>
                  </button>
                </div>
              )}

              {summary.processingStatus === 'processing' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    AI is currently analyzing your visit transcript. This usually takes 1-2 minutes.
                  </p>
                </div>
              )}

              {summary.processingStatus === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-700">
                    Your visit summary is queued for AI processing. Processing will begin shortly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Raw Visit Data */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Visit Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Visit Information</h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-gray-500">Visit Type</dt>
                    <dd className="text-sm text-gray-900">
                      {summary.visitType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Date</dt>
                    <dd className="text-sm text-gray-900">
                      {summary.visitDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Input Method</dt>
                    <dd className="text-sm text-gray-900 capitalize">
                      {summary.inputMethod === 'voice' ? 'Voice Recording' : summary.inputMethod}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Provider Information</h3>
                <dl className="space-y-2">
                  {summary.providerName && (
                    <div>
                      <dt className="text-xs text-gray-500">Provider</dt>
                      <dd className="text-sm text-gray-900">{summary.providerName}</dd>
                    </div>
                  )}
                  {summary.providerSpecialty && (
                    <div>
                      <dt className="text-xs text-gray-500">Specialty</dt>
                      <dd className="text-sm text-gray-900">{summary.providerSpecialty}</dd>
                    </div>
                  )}
                  {summary.facilityName && (
                    <div>
                      <dt className="text-xs text-gray-500">Facility</dt>
                      <dd className="text-sm text-gray-900">{summary.facilityName}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Additional Visit Context */}
            {(summary.chiefComplaint || summary.diagnosis?.length || summary.procedures?.length || 
              (summary.vitalSigns && Object.keys(summary.vitalSigns).length > 0)) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Additional Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {summary.chiefComplaint && (
                      <div>
                        <dt className="text-xs text-gray-500 mb-1">Chief Complaint</dt>
                        <dd className="text-sm text-gray-900">{summary.chiefComplaint}</dd>
                      </div>
                    )}
                    
                    {summary.diagnosis && summary.diagnosis.length > 0 && (
                      <div>
                        <dt className="text-xs text-gray-500 mb-1">Diagnosis</dt>
                        <dd className="flex flex-wrap gap-2">
                          {summary.diagnosis.map((diagnosis, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {diagnosis}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                    
                    {summary.procedures && summary.procedures.length > 0 && (
                      <div>
                        <dt className="text-xs text-gray-500 mb-1">Procedures</dt>
                        <dd className="flex flex-wrap gap-2">
                          {summary.procedures.map((procedure, index) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              {procedure}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                  </div>

                  {/* Vital Signs */}
                  {summary.vitalSigns && Object.keys(summary.vitalSigns).length > 0 && (
                    <div>
                      <dt className="text-xs text-gray-500 mb-2">Vital Signs</dt>
                      <dd className="grid grid-cols-2 gap-3">
                        {summary.vitalSigns.bloodPressure && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-600">Blood Pressure</div>
                            <div className="text-sm font-medium">{summary.vitalSigns.bloodPressure}</div>
                          </div>
                        )}
                        {summary.vitalSigns.heartRate && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-600">Heart Rate</div>
                            <div className="text-sm font-medium">{summary.vitalSigns.heartRate} bpm</div>
                          </div>
                        )}
                        {summary.vitalSigns.temperature && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-600">Temperature</div>
                            <div className="text-sm font-medium">{summary.vitalSigns.temperature}°F</div>
                          </div>
                        )}
                        {summary.vitalSigns.weight && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-600">Weight</div>
                            <div className="text-sm font-medium">{summary.vitalSigns.weight} lbs</div>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Family Sharing Status */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Sharing Settings</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {summary.sharedWithFamily ? 'Shared with family' : 'Not shared with family'}
                  </span>
                </div>
                {summary.sharedWithFamily && (
                  <span className="text-xs text-gray-500">
                    Access level: {summary.familyAccessLevel.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Summary Information</h3>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
                <div>
                  <dt>Created</dt>
                  <dd>{summary.createdAt.toLocaleDateString()} at {summary.createdAt.toLocaleTimeString()}</dd>
                </div>
                <div>
                  <dt>Last Updated</dt>
                  <dd>{summary.updatedAt.toLocaleDateString()} at {summary.updatedAt.toLocaleTimeString()}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{summary.version}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}