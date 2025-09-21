import React from 'react';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  Pill,
  AlertTriangle,
  Calendar,
  Check
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

interface TodaysMedicationRemindersProps {
  medications: CategorizedMedications;
  isLoading: boolean;
  onMarkAsTaken: (medicationId: string) => void;
  takingMedication: string | null;
  selectedMedications: Set<string>;
  onMedicationSelect: (medicationId: string) => void;
  selectAllChecked: boolean;
  onSelectAll: () => void;
  onMarkAllSelectedTaken: () => void;
}

export default function TodaysMedicationReminders({
  medications,
  isLoading,
  onMarkAsTaken,
  takingMedication,
  selectedMedications,
  onMedicationSelect,
  selectAllChecked,
  onSelectAll,
  onMarkAllSelectedTaken
}: TodaysMedicationRemindersProps) {
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

  const MedicationCard = ({ medication, isCompleted = false }: { medication: TodaysMedication; isCompleted?: boolean }) => (
    <div className={`p-3 rounded-lg border ${
      isCompleted
        ? 'bg-green-50 border-green-200'
        : medication.status === 'missed'
        ? 'bg-red-50 border-red-200'
        : medication.isOverdue
        ? 'bg-orange-50 border-orange-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {!isCompleted && (
            <input
              type="checkbox"
              checked={selectedMedications.has(medication.id)}
              onChange={() => onMedicationSelect(medication.id)}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          )}
          
          <div className={`p-2 rounded-full ${
            isCompleted
              ? 'bg-green-100'
              : medication.status === 'missed'
              ? 'bg-red-100'
              : medication.isOverdue
              ? 'bg-orange-100'
              : 'bg-blue-100'
          }`}>
            {isCompleted ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : medication.status === 'missed' ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : (
              <Pill className={`w-4 h-4 ${
                medication.isOverdue ? 'text-orange-600' : 'text-blue-600'
              }`} />
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className={`font-medium ${isCompleted ? 'text-gray-600' : 'text-gray-900'}`}>
                {medication.medicationName}
              </h4>
              {isCompleted && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Taken
                </span>
              )}
            </div>
            <p className={`text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-600'}`}>
              {medication.dosageAmount}
            </p>
            {medication.instructions && (
              <p className={`text-xs mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>
                {medication.instructions}
              </p>
            )}
            
            <div className="flex items-center space-x-4 mt-2 text-sm">
              <span className={`flex items-center space-x-1 ${
                isCompleted
                  ? 'text-gray-500'
                  : medication.status === 'missed'
                  ? 'text-red-600'
                  : medication.isOverdue
                  ? 'text-orange-600'
                  : 'text-blue-600'
              }`}>
                <Clock className="w-3 h-3" />
                <span>{formatTime(medication.scheduledDateTime)}</span>
              </span>
              
              {!isCompleted && (
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
              )}
            </div>
          </div>
        </div>
        
        {!isCompleted && (
          <button
            onClick={() => onMarkAsTaken(medication.id)}
            disabled={takingMedication === medication.id}
            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md disabled:opacity-50"
            title="Mark as taken"
          >
            {takingMedication === medication.id ? (
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600 text-sm">Loading today's medications...</span>
        </div>
      </div>
    );
  }

  const hasPending = medications.pending.length > 0;
  const hasCompleted = medications.completed.length > 0;
  const hasAnyMedications = hasPending || hasCompleted;

  if (!hasAnyMedications) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
        <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No medications scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Bell className="w-5 h-5 text-primary-600" />
            <span>Today's Medications</span>
          </h3>
          
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Today</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Pending Medications Section */}
        {hasPending ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {medications.pending.some(m => m.status === 'missed') ? (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                ) : medications.pending.some(m => m.isOverdue) ? (
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                ) : (
                  <Clock className="w-4 h-4 text-blue-600" />
                )}
                <h4 className="text-md font-medium text-gray-900">
                  Pending Medications ({medications.pending.length})
                  {medications.pending.some(m => m.status === 'missed') && (
                    <span className="ml-2 text-xs text-red-600">
                      ({medications.pending.filter(m => m.status === 'missed').length} missed)
                    </span>
                  )}
                </h4>
              </div>
              
              {medications.pending.length > 1 && (
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={selectAllChecked}
                      onChange={onSelectAll}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span>Select all</span>
                  </label>
                  
                  {selectedMedications.size > 0 && (
                    <button
                      onClick={onMarkAllSelectedTaken}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    >
                      Mark Selected as Taken ({selectedMedications.size})
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {medications.pending.map((medication) => (
                <MedicationCard key={medication.id} medication={medication} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="text-lg font-medium text-green-900 mb-1">All medications completed for today!</h4>
            <p className="text-green-700 text-sm">Great job staying on track with your medication schedule.</p>
          </div>
        )}

        {/* Completed Medications Section */}
        {hasCompleted && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Check className="w-4 h-4 text-green-600" />
              <h4 className="text-md font-medium text-gray-900">
                Completed Today ({medications.completed.length})
              </h4>
            </div>
            
            <div className="space-y-3">
              {medications.completed.map((medication) => (
                <MedicationCard key={medication.id} medication={medication} isCompleted={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}