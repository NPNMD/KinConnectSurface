import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Trophy
} from 'lucide-react';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from './LoadingSpinner';

interface AdherenceDashboardProps {
  patientId?: string;
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
  showFamilyView?: boolean;
  compactMode?: boolean;
}

interface AdherenceData {
  summary: {
    overallAdherenceRate: number;
    totalMedications: number;
    totalDoses: number;
    onTimeRate: number;
    improvementTrend: string;
    riskLevel: string;
  };
  analytics: any[];
  milestones: {
    newMilestones: any[];
    currentStreaks: any[];
  };
}

export default function AdherenceDashboard({
  patientId,
  timeRange = 'month',
  showFamilyView = false,
  compactMode = false
}: AdherenceDashboardProps) {
  const { getEffectivePatientId, hasPermission, userRole, activePatientAccess } = useFamily();
  const [adherenceData, setAdherenceData] = useState<AdherenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  const effectivePatientId = patientId || getEffectivePatientId();

  useEffect(() => {
    if (effectivePatientId) {
      loadAdherenceData();
    }
  }, [effectivePatientId, selectedTimeRange]);

  const loadAdherenceData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (selectedTimeRange) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'quarter':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case 'year':
          startDate.setDate(startDate.getDate() - 365);
          break;
      }

      // Load comprehensive adherence data
      const [analyticsResult, reportResult, milestonesResult] = await Promise.all([
        unifiedMedicationApi.getComprehensiveAdherence({
          patientId: effectivePatientId || undefined,
          startDate,
          endDate,
          includePatterns: true,
          includePredictions: true,
          includeFamilyData: showFamilyView
        }),
        unifiedMedicationApi.generateAdherenceReport({
          patientId: effectivePatientId || undefined,
          reportType: selectedTimeRange === 'week' ? 'weekly' : 'monthly',
          format: showFamilyView ? 'family_friendly' : 'detailed',
          includeCharts: true
        }),
        unifiedMedicationApi.checkAdherenceMilestones({
          patientId: effectivePatientId || undefined
        })
      ]);

      if (reportResult.success && reportResult.data) {
        setAdherenceData({
          summary: reportResult.data.summary,
          analytics: reportResult.data.analytics || [],
          milestones: milestonesResult.data || { newMilestones: [], currentStreaks: [] }
        });
      } else {
        setError(reportResult.error || 'Failed to load adherence data');
      }

    } catch (error) {
      console.error('Error loading adherence data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load adherence data');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-blue-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-gray-600">Loading adherence data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-medium text-red-900">Error Loading Adherence Data</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
        <button
          onClick={loadAdherenceData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!adherenceData) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Adherence Data</h3>
        <p className="text-gray-500">No medication adherence data available for the selected time period.</p>
      </div>
    );
  }

  const { summary, analytics, milestones } = adherenceData;

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Medication Adherence</h2>
          {showFamilyView && activePatientAccess && (
            <p className="text-sm text-gray-600">
              Viewing adherence for {activePatientAccess.patientName}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {['week', 'month', 'quarter', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range as any)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                selectedTimeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Adherence Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Adherence</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(summary.overallAdherenceRate)}%
              </p>
            </div>
            <div className={`p-2 rounded-lg ${getRiskLevelColor(summary.riskLevel)}`}>
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-1">
            {getTrendIcon(summary.improvementTrend)}
            <span className="text-sm text-gray-600 capitalize">
              {summary.improvementTrend}
            </span>
          </div>
        </div>

        {/* On-Time Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On-Time Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(summary.onTimeRate)}%
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Doses taken within 30 minutes of scheduled time
          </p>
        </div>

        {/* Total Medications */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Medications</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.totalMedications}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {summary.totalDoses} doses taken this period
          </p>
        </div>

        {/* Risk Level */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Risk Level</p>
              <p className={`text-lg font-bold capitalize ${getRiskLevelColor(summary.riskLevel).split(' ')[0]}`}>
                {summary.riskLevel}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${getRiskLevelColor(summary.riskLevel)}`}>
              {summary.riskLevel === 'low' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Based on recent adherence patterns
          </p>
        </div>
      </div>

      {/* Current Streaks */}
      {milestones.currentStreaks && milestones.currentStreaks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Award className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Current Streaks</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {milestones.currentStreaks.map((streak: any, index: number) => (
              <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate">
                    {streak.medicationName}
                  </h4>
                  <span className="text-2xl">🔥</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-purple-600">
                    {streak.streakDays}
                  </span>
                  <span className="text-sm text-gray-600">
                    day{streak.streakDays !== 1 ? 's' : ''}
                  </span>
                </div>
                {streak.nextMilestone && (
                  <p className="text-xs text-purple-600 mt-1">
                    Next: {streak.nextMilestone}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Milestones */}
      {milestones.newMilestones && milestones.newMilestones.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recent Achievements</h3>
          </div>
          
          <div className="space-y-3">
            {milestones.newMilestones.map((milestone: any, index: number) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <span className="text-2xl">{milestone.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{milestone.milestone}</h4>
                  <p className="text-sm text-gray-600">{milestone.description}</p>
                  <p className="text-xs text-gray-500">
                    Achieved {new Date(milestone.achievedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analytics */}
      {!compactMode && analytics && analytics.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Medication Details</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <BarChart3 className="w-4 h-4" />
              <span>Last {selectedTimeRange}</span>
            </div>
          </div>

          <div className="space-y-4">
            {analytics.map((med: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    {med.medicationId || 'Unknown Medication'}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(med.riskAssessment?.currentRiskLevel || 'low')}`}>
                      {med.riskAssessment?.currentRiskLevel || 'Low'} Risk
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">
                      {Math.round(med.adherenceMetrics?.overallAdherenceRate || 0)}%
                    </p>
                    <p className="text-xs text-gray-600">Adherence</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">
                      {med.adherenceMetrics?.totalTakenDoses || 0}
                    </p>
                    <p className="text-xs text-gray-600">Doses Taken</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">
                      {med.patterns?.currentAdherenceStreak || 0}
                    </p>
                    <p className="text-xs text-gray-600">Current Streak</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-orange-600">
                      {Math.round(med.adherenceMetrics?.onTimeAdherenceRate || 0)}%
                    </p>
                    <p className="text-xs text-gray-600">On Time</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(med.adherenceMetrics?.overallAdherenceRate || 0, 100)}%` }}
                  ></div>
                </div>

                {/* Patterns and Insights */}
                {med.patterns && (
                  <div className="text-xs text-gray-600 space-y-1">
                    {med.patterns.mostMissedTimeSlot && (
                      <p>Most missed: {med.patterns.mostMissedTimeSlot} doses</p>
                    )}
                    {med.patterns.improvementTrend !== 'stable' && (
                      <p className={med.patterns.improvementTrend === 'improving' ? 'text-green-600' : 'text-red-600'}>
                        Trend: {med.patterns.improvementTrend}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family View Insights */}
      {showFamilyView && userRole === 'family_member' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Family Insights</h3>
          </div>

          <div className="space-y-3">
            {summary.riskLevel === 'high' || summary.riskLevel === 'critical' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="font-medium text-red-900 mb-2">Attention Needed</h4>
                <p className="text-sm text-red-700">
                  {activePatientAccess?.patientName}'s medication adherence needs attention. 
                  Consider reaching out to offer support or reminders.
                </p>
              </div>
            ) : summary.overallAdherenceRate >= 90 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <h4 className="font-medium text-green-900 mb-2">Excellent Progress!</h4>
                <p className="text-sm text-green-700">
                  {activePatientAccess?.patientName} is doing great with their medication routine. 
                  Keep encouraging this positive behavior!
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h4 className="font-medium text-yellow-900 mb-2">Room for Improvement</h4>
                <p className="text-sm text-yellow-700">
                  {activePatientAccess?.patientName}'s adherence could be better. 
                  Consider gentle reminders or schedule adjustments.
                </p>
              </div>
            )}

            {/* Family Action Suggestions */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <h4 className="font-medium text-gray-900 mb-2">How You Can Help</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Send encouraging messages about medication routine</li>
                <li>• Offer gentle reminders for missed doses</li>
                <li>• Help identify barriers to taking medications</li>
                <li>• Celebrate adherence milestones and achievements</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {hasPermission('canEdit') && !compactMode && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => loadAdherenceData()}
              className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Activity className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Refresh Data</span>
            </button>
            
            <button
              onClick={() => {
                // Would open detailed report modal
                console.log('Generate detailed report');
              }}
              className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <PieChart className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Detailed Report</span>
            </button>
            
            <button
              onClick={() => {
                // Would open settings modal
                console.log('Open adherence settings');
              }}
              className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Target className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}