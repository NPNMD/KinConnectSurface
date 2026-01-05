import React from 'react';
import {
  Edit,
  Trash2,
  Pill,
  CheckCircle,
  Bell,
  BellOff,
  AlertTriangle,
  Clock,
  Calendar,
  Info,
  Plus,
  Lock
} from 'lucide-react';
import { Medication, MedicationCalendarEvent } from '@shared/types';
import { MedicationWithStatus } from '../types/medicationTypes';

interface MedicationListProps {
  medications: MedicationWithStatus[];
  onEdit: (medication: Medication) => void;
  onDelete: (id: string) => void;
  onCreateSchedule: (medication: Medication) => void;
  onMarkTaken: (eventId: string) => void;
  takingMedication: string | null;
  creatingSchedule: string | null;
  canEdit: boolean;
}

export default function MedicationList({
  medications,
  onEdit,
  onDelete,
  onCreateSchedule,
  onMarkTaken,
  takingMedication,
  creatingSchedule,
  canEdit
}: MedicationListProps) {
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

  const getStatusIcon = (medication: MedicationWithStatus) => {
    if (medication.scheduleStatus === 'scheduled') {
      return <Bell className="w-4 h-4 text-green-600" />;
    } else if (medication.scheduleStatus === 'paused') {
      return <BellOff className="w-4 h-4 text-yellow-600" />;
    } else {
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    }
  };

  const getStatusText = (medication: MedicationWithStatus) => {
    switch (medication.scheduleStatus) {
      case 'scheduled':
        return 'Scheduled';
      case 'paused':
        return 'Paused';
      case 'unscheduled':
        return 'No Schedule';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (medication: MedicationWithStatus) => {
    switch (medication.scheduleStatus) {
      case 'scheduled':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unscheduled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (medications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {medications.map((medication) => (
        <div
          key={medication.id}
          className={`bg-white rounded-lg border p-4 max-w-full ${
            medication.scheduleStatus === 'unscheduled'
              ? 'border-orange-200 bg-orange-50'
              : medication.scheduleStatus === 'paused'
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <div className={`p-2 rounded-full ${
                medication.scheduleStatus === 'scheduled' ? 'bg-green-100' :
                medication.scheduleStatus === 'paused' ? 'bg-yellow-100' :
                'bg-orange-100'
              }`}>
                <Pill className={`w-4 h-4 ${
                  medication.scheduleStatus === 'scheduled' ? 'text-green-600' :
                  medication.scheduleStatus === 'paused' ? 'text-yellow-600' :
                  'text-orange-600'
                }`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1 flex-wrap">
                  <h5 className="font-medium text-gray-900">{medication.name}</h5>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(medication)}`}>
                    {getStatusIcon(medication)}
                    <span className="ml-1">{getStatusText(medication)}</span>
                  </span>
                  {medication.isPRN && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      PRN
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-2">
                  {medication.dosage} • {medication.frequency}
                </p>

                {/* Schedule Status Details */}
                {medication.scheduleStatus === 'scheduled' && medication.nextDose && (
                  <div className="flex items-center space-x-4 text-sm mb-2">
                    <span className="flex items-center space-x-1 text-blue-600">
                      <Clock className="w-3 h-3" />
                      <span>Next: {formatTime(new Date(medication.nextDose.scheduledDateTime))}</span>
                    </span>
                    <span className="text-gray-500">
                      {getTimeUntil(new Date(medication.nextDose.scheduledDateTime))}
                    </span>
                  </div>
                )}

                {medication.scheduleStatus === 'unscheduled' && (
                  <div className="flex items-center space-x-1 text-sm text-orange-600 mb-2">
                    <Info className="w-3 h-3" />
                    <span>No reminders set - medication won't appear in daily schedule</span>
                  </div>
                )}

                {medication.scheduleStatus === 'paused' && (
                  <div className="flex items-center space-x-1 text-sm text-yellow-600 mb-2">
                    <BellOff className="w-3 h-3" />
                    <span>Reminders paused</span>
                  </div>
                )}

                {medication.instructions && (
                  <p className="text-sm text-gray-500 mt-1">{medication.instructions}</p>
                )}
                
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Prescribed: {
                      medication.prescribedDate instanceof Date
                        ? medication.prescribedDate.toLocaleDateString()
                        : new Date(medication.prescribedDate).toLocaleDateString()
                    }</span>
                  </span>
                  {medication.prescribedBy && (
                    <span>By: {medication.prescribedBy}</span>
                  )}
                </div>

                {/* Today's Doses Summary */}
                {medication.scheduleStatus === 'scheduled' && medication.todaysEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Today's doses:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">
                          {medication.todaysEvents.filter(e => e.status === 'taken').length} taken
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-blue-600">
                          {medication.todaysEvents.filter(e => e.status === 'scheduled').length} pending
                        </span>
                        {medication.todaysEvents.filter(e => e.status === 'missed').length > 0 && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-red-600">
                              {medication.todaysEvents.filter(e => e.status === 'missed').length} missed
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {!canEdit ? (
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Lock className="w-3 h-3" />
                  <span>View only</span>
                </div>
              ) : (
                <>
                  {medication.scheduleStatus === 'scheduled' && medication.nextDose && (
                    <button
                      onClick={() => onMarkTaken(medication.nextDose!.id)}
                      disabled={takingMedication === medication.nextDose!.id}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md disabled:opacity-50 transition-colors"
                      title="Mark as taken"
                    >
                      {takingMedication === medication.nextDose!.id ? (
                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {medication.scheduleStatus === 'unscheduled' && (
                    <button
                      onClick={() => onCreateSchedule(medication)}
                      disabled={creatingSchedule === medication.id}
                      className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                      title="Create medication schedule"
                    >
                      {creatingSchedule === medication.id ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">Schedule</span>
                      <span className="sm:hidden">+</span>
                    </button>
                  )}

                  <button
                    onClick={() => onEdit(medication)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Edit medication"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(medication.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete medication"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

