import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Target,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';
import type { MedicationAdherence } from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';

interface MedicationAdherenceDashboardProps {
  patientId: string;
}

interface AdherenceSummary {
  totalMedications: number;
  overallAdherenceRate: number;
  totalScheduledDoses: number;
  totalTakenDoses: number;
  totalMissedDoses: number;
  medicationsWithPoorAdherence: number;
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
}

export default function MedicationAdherenceDashboard({ patientId }: MedicationAdherenceDashboardProps) {
  const [summary, setSummary] = useState<AdherenceSummary | null>(null);
  const [medications, setMedications] = useState<MedicationAdherence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAdherenceData();
  }, [patientId, selectedPeriod]);

  const loadAdherenceData = async () => {
    try {
      setIsLoading(true);
      
      // Calculate date range based on selected period
      const endDate = new Date();
      const startDate = new Date();
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      startDate.setDate(endDate.getDate() - days);

      const result = await medicationCalendarApi.getMedicationAdherence({
        startDate,
        endDate
      });

      if (result.success && result.data) {
        setMedications(result.data);
        
        // Calculate summary
        const adherenceData = result.data;
        const calculatedSummary: AdherenceSummary = {
          totalMedications: adherenceData.length,
          overallAdherenceRate: adherenceData.length > 0 
            ? Math.round(adherenceData.reduce((sum, med) => sum + med.adherenceRate, 0) / adherenceData.length * 100) / 100
            : 0,
          totalScheduledDoses: adherenceData.reduce((sum, med) => sum + med.totalScheduledDoses, 0),
          totalTakenDoses: adherenceData.reduce((sum, med) => sum + med.takenDoses, 0),
          totalMissedDoses: adherenceData.reduce((sum, med) => sum + med.missedDoses, 0),
          medicationsWithPoorAdherence: adherenceData.filter(med => med.adherenceRate < 80).length,
          period: {
            startDate,
            endDate,
            days
          }
        };
        
        setSummary(calculatedSummary);
      }
    } catch (error) {
      console.error('Error loading adherence data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAdherenceColor = (rate: number): string => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    if (rate >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAdherenceBgColor = (rate: number): string => {
    if (rate >= 90) return 'bg-green-100 border-green-200';
    if (rate >= 80) return 'bg-yellow-100 border-yellow-200';
    if (rate >= 70) return 'bg-orange-100 border-orange-200';
    return 'bg-red-100 border-red-200';
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100) / 100}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading adherence data...</span>
      </div>
    );
  }

  if (!summary || medications.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No adherence data available</h4>
        <p className="text-gray-500">
          Set up medication schedules to start tracking adherence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selection */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary-600" />
            <span>Medication Adherence</span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Track your medication-taking consistency over time
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Period:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as '7d' | '30d' | '90d')}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Adherence Rate */}
        <div className={`p-4 rounded-lg border ${getAdherenceBgColor(summary.overallAdherenceRate)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Adherence</p>
              <p className={`text-2xl font-bold ${getAdherenceColor(summary.overallAdherenceRate)}`}>
                {formatPercentage(summary.overallAdherenceRate)}
              </p>
            </div>
            <Target className={`w-8 h-8 ${getAdherenceColor(summary.overallAdherenceRate)}`} />
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  summary.overallAdherenceRate >= 90 ? 'bg-green-500' :
                  summary.overallAdherenceRate >= 80 ? 'bg-yellow-500' :
                  summary.overallAdherenceRate >= 70 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(summary.overallAdherenceRate, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Total Doses Taken */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Doses Taken</p>
              <p className="text-2xl font-bold text-blue-600">
                {summary.totalTakenDoses}
              </p>
              <p className="text-xs text-gray-500">
                of {summary.totalScheduledDoses} scheduled
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        {/* Missed Doses */}
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Missed Doses</p>
              <p className="text-2xl font-bold text-red-600">
                {summary.totalMissedDoses}
              </p>
              <p className="text-xs text-gray-500">
                {summary.totalScheduledDoses > 0 
                  ? formatPercentage((summary.totalMissedDoses / summary.totalScheduledDoses) * 100)
                  : '0%'} of total
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Medications Tracked */}
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Medications</p>
              <p className="text-2xl font-bold text-purple-600">
                {summary.totalMedications}
              </p>
              <p className="text-xs text-gray-500">
                {summary.medicationsWithPoorAdherence} need attention
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Individual Medication Adherence */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Individual Medication Adherence</h4>
        <div className="space-y-3">
          {medications.map((medication) => {
            const adherenceRate = medication.adherenceRate;
            const onTimeRate = medication.onTimeRate;
            
            return (
              <div
                key={medication.medicationId}
                className={`p-4 rounded-lg border ${getAdherenceBgColor(adherenceRate)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-medium text-gray-900">
                        Medication ID: {medication.medicationId}
                      </h5>
                      <span className={`text-sm font-medium ${getAdherenceColor(adherenceRate)}`}>
                        {formatPercentage(adherenceRate)} adherence
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Scheduled</p>
                        <p className="font-medium">{medication.totalScheduledDoses}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Taken</p>
                        <p className="font-medium text-green-600">{medication.takenDoses}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Missed</p>
                        <p className="font-medium text-red-600">{medication.missedDoses}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">On Time</p>
                        <p className="font-medium text-blue-600">{formatPercentage(onTimeRate)}</p>
                      </div>
                    </div>

                    {medication.averageDelayMinutes > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Average delay: {medication.averageDelayMinutes} minutes
                        {medication.longestDelayMinutes > 0 && (
                          <span className="ml-2">
                            (longest: {medication.longestDelayMinutes} minutes)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    <div className="w-16 h-16 relative">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="2"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={
                            adherenceRate >= 90 ? '#10b981' :
                            adherenceRate >= 80 ? '#f59e0b' :
                            adherenceRate >= 70 ? '#f97316' : '#ef4444'
                          }
                          strokeWidth="2"
                          strokeDasharray={`${adherenceRate}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xs font-medium ${getAdherenceColor(adherenceRate)}`}>
                          {Math.round(adherenceRate)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{medication.takenDoses} / {medication.totalScheduledDoses}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${medication.totalScheduledDoses > 0 
                          ? (medication.takenDoses / medication.totalScheduledDoses) * 100 
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights and Recommendations */}
      {summary.overallAdherenceRate < 80 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-medium text-yellow-800">Adherence Improvement Needed</h5>
              <p className="text-sm text-yellow-700 mt-1">
                Your overall adherence rate is below 80%. Consider:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• Setting up more frequent reminders</li>
                <li>• Using a pill organizer</li>
                <li>• Discussing timing adjustments with your doctor</li>
                <li>• Identifying and addressing barriers to taking medications</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {summary.overallAdherenceRate >= 90 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-medium text-green-800">Excellent Adherence!</h5>
              <p className="text-sm text-green-700 mt-1">
                You're doing a great job staying consistent with your medications. Keep up the excellent work!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}