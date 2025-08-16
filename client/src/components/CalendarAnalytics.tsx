import React, { useMemo } from 'react';
import { Calendar, Clock, TrendingUp, Users, Car, AlertTriangle, CheckCircle, BarChart3, PieChart } from 'lucide-react';
import type { MedicalEvent, MedicalEventType, MedicalEventStatus } from '@shared/types';

interface CalendarAnalyticsProps {
  events: MedicalEvent[];
  patientId: string;
  onClose: () => void;
}

export default function CalendarAnalytics({ events, patientId, onClose }: CalendarAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    // Filter events for different time periods
    const last30Days = events.filter(e => new Date(e.startDateTime) >= thirtyDaysAgo);
    const last90Days = events.filter(e => new Date(e.startDateTime) >= ninetyDaysAgo);
    const upcoming = events.filter(e => new Date(e.startDateTime) > now);
    const past = events.filter(e => new Date(e.startDateTime) <= now);

    // Event type distribution
    const eventTypeCount: Record<MedicalEventType, number> = {} as Record<MedicalEventType, number>;
    events.forEach(event => {
      eventTypeCount[event.eventType] = (eventTypeCount[event.eventType] || 0) + 1;
    });

    // Status distribution
    const statusCount: Record<MedicalEventStatus, number> = {} as Record<MedicalEventStatus, number>;
    events.forEach(event => {
      statusCount[event.status] = (statusCount[event.status] || 0) + 1;
    });

    // Monthly trends
    const monthlyData: Record<string, number> = {};
    last90Days.forEach(event => {
      const month = new Date(event.startDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    // Provider analysis
    const providerCount: Record<string, number> = {};
    events.forEach(event => {
      if (event.providerName) {
        providerCount[event.providerName] = (providerCount[event.providerName] || 0) + 1;
      }
    });

    // Transportation analysis
    const transportationNeeded = events.filter(e => e.requiresTransportation).length;
    const transportationAssigned = events.filter(e => e.requiresTransportation && e.responsiblePersonId).length;

    // Completion rate
    const completedEvents = past.filter(e => e.status === 'completed').length;
    const completionRate = past.length > 0 ? (completedEvents / past.length) * 100 : 0;

    // No-show rate
    const noShowEvents = past.filter(e => e.status === 'no_show').length;
    const noShowRate = past.length > 0 ? (noShowEvents / past.length) * 100 : 0;

    // Average appointment duration
    const totalDuration = events.reduce((sum, event) => sum + event.duration, 0);
    const avgDuration = events.length > 0 ? totalDuration / events.length : 0;

    return {
      totalEvents: events.length,
      last30Days: last30Days.length,
      last90Days: last90Days.length,
      upcoming: upcoming.length,
      eventTypeCount,
      statusCount,
      monthlyData,
      providerCount,
      transportationNeeded,
      transportationAssigned,
      completionRate,
      noShowRate,
      avgDuration
    };
  }, [events]);

  const getEventTypeColor = (type: MedicalEventType) => {
    const colors: Record<MedicalEventType, string> = {
      appointment: 'bg-blue-500',
      consultation: 'bg-blue-400',
      surgery: 'bg-red-500',
      procedure: 'bg-red-400',
      lab_test: 'bg-green-500',
      imaging: 'bg-green-400',
      medication_reminder: 'bg-purple-500',
      medication_refill: 'bg-purple-400',
      therapy_session: 'bg-yellow-500',
      vaccination: 'bg-indigo-500',
      follow_up: 'bg-cyan-500',
      emergency_visit: 'bg-red-600',
      hospital_admission: 'bg-red-700',
      discharge: 'bg-green-600',
      insurance_deadline: 'bg-orange-500',
      health_screening: 'bg-teal-500',
      wellness_check: 'bg-emerald-500',
      specialist_referral: 'bg-pink-500',
      test_results_review: 'bg-violet-500',
      care_plan_review: 'bg-slate-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const topEventTypes = Object.entries(analytics.eventTypeCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  const topProviders = Object.entries(analytics.providerCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
          <BarChart3 className="w-6 h-6" />
          <span>Calendar Analytics</span>
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.totalEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.upcoming}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.completionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Duration</p>
              <p className="text-2xl font-semibold text-gray-900">{Math.round(analytics.avgDuration)}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Types Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <PieChart className="w-5 h-5" />
            <span>Event Types</span>
          </h3>
          <div className="space-y-3">
            {topEventTypes.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getEventTypeColor(type as MedicalEventType)}`}></div>
                  <span className="text-sm text-gray-700 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                  <span className="text-xs text-gray-500">
                    ({((count / analytics.totalEvents) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Appointment Status</h3>
          <div className="space-y-3">
            {Object.entries(analytics.statusCount).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 capitalize">
                  {status.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'completed' ? 'bg-green-500' :
                        status === 'cancelled' ? 'bg-red-500' :
                        status === 'confirmed' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`}
                      style={{ width: `${(count / analytics.totalEvents) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transportation Analysis */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Car className="w-5 h-5" />
            <span>Transportation</span>
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Needs Transportation</span>
              <span className="text-sm font-medium text-gray-900">{analytics.transportationNeeded}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Assigned</span>
              <span className="text-sm font-medium text-gray-900">{analytics.transportationAssigned}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Assignment Rate</span>
              <span className="text-sm font-medium text-gray-900">
                {analytics.transportationNeeded > 0 
                  ? ((analytics.transportationAssigned / analytics.transportationNeeded) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            {analytics.transportationNeeded > analytics.transportationAssigned && (
              <div className="flex items-center space-x-2 text-orange-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">
                  {analytics.transportationNeeded - analytics.transportationAssigned} appointments need transportation
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top Providers */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Top Providers</span>
          </h3>
          <div className="space-y-3">
            {topProviders.length > 0 ? (
              topProviders.map(([provider, count]) => (
                <div key={provider} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1">{provider}</span>
                  <span className="text-sm font-medium text-gray-900 ml-2">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No provider data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{analytics.completionRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Completion Rate</div>
            <div className="text-xs text-gray-500 mt-1">
              {events.filter(e => e.status === 'completed').length} of {events.filter(e => new Date(e.startDateTime) <= new Date()).length} past appointments
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{analytics.noShowRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">No-Show Rate</div>
            <div className="text-xs text-gray-500 mt-1">
              {events.filter(e => e.status === 'no_show').length} missed appointments
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{analytics.last30Days}</div>
            <div className="text-sm text-gray-600">Last 30 Days</div>
            <div className="text-xs text-gray-500 mt-1">
              {analytics.last30Days > analytics.last90Days / 3 ? 'Above' : 'Below'} average activity
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}