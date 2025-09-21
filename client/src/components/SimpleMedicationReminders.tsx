import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Pill, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface TodaysMedication {
  id: string;
  medicationName: string;
  dosageAmount: string;
  scheduledDateTime: Date;
  status: 'scheduled' | 'taken' | 'missed' | 'skipped';
  instructions?: string;
  isOverdue: boolean;
}

interface CategorizedMedications {
  pending: TodaysMedication[];
  completed: TodaysMedication[];
}

interface SimpleMedicationRemindersProps {
  medications: CategorizedMedications;
  isLoading: boolean;
  onMarkAsTaken: (medicationId: string) => void;
  takingMedication: string | null;
}

export default function SimpleMedicationReminders({
  medications,
  isLoading,
  onMarkAsTaken,
  takingMedication
}: SimpleMedicationRemindersProps) {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs < 0) {
      const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
      if (overdueMins < 60) {
        return `${overdueMins}m overdue`;
      } else {
        const overdueHours = Math.floor(overdueMins / 60);
        return `${overdueHours}h overdue`;
      }
    }
    
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) {
      return `in ${mins}m`;
    } else {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `in ${hours}h ${remainingMins}m` : `in ${hours}h`;
    }
  };

  // Get next 3-5 upcoming medications within next 24 hours
  const getUpcomingMedications = () => {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return medications.pending
      .filter(med => {
        const medTime = new Date(med.scheduledDateTime);
        return medTime <= next24Hours;
      })
      .sort((a, b) => new Date(a.scheduledDateTime).getTime() - new Date(b.scheduledDateTime).getTime())
      .slice(0, 5); // Show max 5 upcoming medications
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600 text-sm">Loading medications...</span>
        </div>
      </div>
    );
  }

  const upcomingMedications = getUpcomingMedications();

  if (upcomingMedications.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
        <h4 className="text-lg font-medium text-green-900 mb-1">All caught up!</h4>
        <p className="text-green-700 text-sm mb-3">No upcoming medications in the next 24 hours.</p>
        <Link
          to="/medications"
          className="inline-flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View All Medications</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Upcoming Medications
          </h3>
          <Link
            to="/medications"
            className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View All</span>
          </Link>
        </div>
      </div>

      {/* Medication List */}
      <div className="p-4 space-y-3">
        {upcomingMedications.map((medication) => (
          <div
            key={medication.id}
            className={`p-3 rounded-lg border ${
              medication.status === 'missed'
                ? 'bg-red-50 border-red-200'
                : medication.isOverdue
                ? 'bg-orange-50 border-orange-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className={`p-2 rounded-full ${
                  medication.status === 'missed'
                    ? 'bg-red-100'
                    : medication.isOverdue
                    ? 'bg-orange-100'
                    : 'bg-blue-100'
                }`}>
                  {medication.status === 'missed' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Pill className={`w-4 h-4 ${
                      medication.isOverdue ? 'text-orange-600' : 'text-blue-600'
                    }`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm">
                    {medication.medicationName}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {medication.dosageAmount}
                  </p>
                  
                  <div className="flex items-center space-x-3 mt-1 text-sm">
                    <span className={`flex items-center space-x-1 ${
                      medication.status === 'missed'
                        ? 'text-red-600'
                        : medication.isOverdue
                        ? 'text-orange-600'
                        : 'text-blue-600'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(medication.scheduledDateTime)}</span>
                    </span>
                    
                    <span className={`text-xs ${
                      medication.status === 'missed'
                        ? 'text-red-500'
                        : medication.isOverdue
                        ? 'text-orange-500'
                        : 'text-gray-500'
                    }`}>
                      {medication.status === 'missed'
                        ? 'Missed'
                        : getTimeUntil(medication.scheduledDateTime)
                      }
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onMarkAsTaken(medication.id)}
                disabled={takingMedication === medication.id}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                title="Mark as taken"
              >
                {takingMedication === medication.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Mark Taken'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <Link
          to="/medications"
          className="flex items-center justify-center space-x-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View All Medications</span>
        </Link>
      </div>
    </div>
  );
}