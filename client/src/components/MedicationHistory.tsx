import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Filter,
  X
} from 'lucide-react';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import { useFamily } from '@/contexts/FamilyContext';
import LoadingSpinner from './LoadingSpinner';

interface DailySummary {
  date: string;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  totalSkipped: number;
  adherenceRate: number;
  medications: Array<{
    medicationId: string;
    medicationName: string;
    scheduled: number;
    taken: number;
    missed: number;
    skipped: number;
  }>;
}

interface MedicationHistoryProps {
  patientId?: string;
  defaultDays?: number;
}

export default function MedicationHistory({
  patientId,
  defaultDays = 30
}: MedicationHistoryProps) {
  const { getEffectivePatientId } = useFamily();
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  const [showFilters, setShowFilters] = useState(false);

  const effectivePatientId = patientId || getEffectivePatientId();

  useEffect(() => {
    if (effectivePatientId) {
      loadDailySummaries();
    }
  }, [effectivePatientId, dateRange]);

  const loadDailySummaries = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!effectivePatientId) {
        setError('No patient ID available');
        return;
      }

      const response = await medicationCalendarApi.getDailySummaries(
        effectivePatientId,
        dateRange.startDate,
        dateRange.endDate
      );

      if (response.success && response.data) {
        setSummaries(response.data);
      } else {
        setError(response.error || 'Failed to load medication history');
      }
    } catch (err) {
      console.error('Error loading daily summaries:', err);
      setError('Failed to load medication history');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDayDetails = async (date: string) => {
    try {
      if (!effectivePatientId) return;

      const response = await medicationCalendarApi.getDailySummary(
        effectivePatientId,
        new Date(date)
      );

      if (response.success && response.data) {
        setSelectedSummary(response.data);
        setSelectedDate(date);
      }
    } catch (err) {
      console.error('Error loading day details:', err);
    }
  };

  const getAdherenceColor = (rate: number): string => {
    if (rate >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (rate >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getAdherenceIcon = (rate: number) => {
    if (rate >= 90) return <TrendingUp className="w-4 h-4" />;
    if (rate >= 70) return <Clock className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const adjustDateRange = (days: number) => {
    const newEndDate = new Date();
    const newStartDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setDateRange({ startDate: newStartDate, endDate: newEndDate });
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateShort = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" />
        <span className="ml-3 text-gray-600">Loading medication history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading History</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadDailySummaries}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const overallStats = summaries.reduce(
    (acc, summary) => ({
      totalScheduled: acc.totalScheduled + summary.totalScheduled,
      totalTaken: acc.totalTaken + summary.totalTaken,
      totalMissed: acc.totalMissed + summary.totalMissed,
      totalSkipped: acc.totalSkipped + summary.totalSkipped
    }),
    { totalScheduled: 0, totalTaken: 0, totalMissed: 0, totalSkipped: 0 }
  );

  const overallAdherence = overallStats.totalScheduled > 0
    ? Math.round((overallStats.totalTaken / overallStats.totalScheduled) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <span>Medication History</span>
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>

        {/* Date Range Filters */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Quick Select:</span>
              <button
                onClick={() => adjustDateRange(7)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                7 Days
              </button>
              <button
                onClick={() => adjustDateRange(30)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                30 Days
              </button>
              <button
                onClick={() => adjustDateRange(90)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                90 Days
              </button>
            </div>
          </div>
        )}

        {/* Overall Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">
              {overallAdherence}%
            </div>
            <div className="text-sm text-gray-600">Overall Adherence</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">
              {overallStats.totalTaken}
            </div>
            <div className="text-sm text-gray-600">Doses Taken</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">
              {overallStats.totalMissed}
            </div>
            <div className="text-sm text-gray-600">Doses Missed</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">
              {overallStats.totalSkipped}
            </div>
            <div className="text-sm text-gray-600">Doses Skipped</div>
          </div>
        </div>
      </div>

      {/* Daily Summaries List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Daily History</h3>
          <p className="text-sm text-gray-600">
            Showing {summaries.length} days from {formatDate(dateRange.startDate.toISOString())} to {formatDate(dateRange.endDate.toISOString())}
          </p>
        </div>

        {summaries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No medication history available for this date range</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {summaries.map((summary) => (
              <div
                key={summary.date}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => loadDayDetails(summary.date)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {formatDate(summary.date)}
                      </h4>
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-sm font-medium border ${getAdherenceColor(summary.adherenceRate)}`}>
                        {getAdherenceIcon(summary.adherenceRate)}
                        <span>{Math.round(summary.adherenceRate)}%</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>{summary.totalTaken} taken</span>
                      </span>
                      {summary.totalMissed > 0 && (
                        <span className="flex items-center space-x-1">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span>{summary.totalMissed} missed</span>
                        </span>
                      )}
                      {summary.totalSkipped > 0 && (
                        <span className="flex items-center space-x-1">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <span>{summary.totalSkipped} skipped</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day Details Modal */}
      {selectedSummary && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {formatDate(selectedDate)}
              </h3>
              <button
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedSummary(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Day Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xl font-bold text-green-600">
                    {selectedSummary.totalTaken}
                  </div>
                  <div className="text-xs text-gray-600">Taken</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-xl font-bold text-red-600">
                    {selectedSummary.totalMissed}
                  </div>
                  <div className="text-xs text-gray-600">Missed</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-xl font-bold text-yellow-600">
                    {selectedSummary.totalSkipped}
                  </div>
                  <div className="text-xs text-gray-600">Skipped</div>
                </div>
              </div>

              {/* Medication Breakdown */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Medication Breakdown</h4>
                <div className="space-y-2">
                  {selectedSummary.medications.map((med) => (
                    <div
                      key={med.medicationId}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">{med.medicationName}</h5>
                        <span className="text-sm text-gray-600">
                          {med.taken}/{med.scheduled} doses
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-sm">
                        {med.taken > 0 && (
                          <span className="flex items-center space-x-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            <span>{med.taken} taken</span>
                          </span>
                        )}
                        {med.missed > 0 && (
                          <span className="flex items-center space-x-1 text-red-600">
                            <XCircle className="w-3 h-3" />
                            <span>{med.missed} missed</span>
                          </span>
                        )}
                        {med.skipped > 0 && (
                          <span className="flex items-center space-x-1 text-yellow-600">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{med.skipped} skipped</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}