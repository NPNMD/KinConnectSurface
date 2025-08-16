import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  X, 
  AlertTriangle, 
  Calendar,
  Pill,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import type { MedicationCalendarEvent } from '@shared/types';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';

interface MedicationRemindersProps {
  patientId: string;
  showUpcoming?: boolean;
  showOverdue?: boolean;
  maxItems?: number;
}

export default function MedicationReminders({ 
  patientId, 
  showUpcoming = true, 
  showOverdue = true,
  maxItems = 10
}: MedicationRemindersProps) {
  const [upcomingEvents, setUpcomingEvents] = useState<MedicationCalendarEvent[]>([]);
  const [overdueEvents, setOverdueEvents] = useState<MedicationCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadReminders();
    
    // Set up interval to refresh reminders every minute
    const interval = setInterval(loadReminders, 60000);
    return () => clearInterval(interval);
  }, [patientId]);

  const loadReminders = async () => {
    try {
      setIsLoading(true);
      
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      // Get today's medication events
      const result = await medicationCalendarApi.getMedicationCalendarEvents({
        startDate: startOfDay,
        endDate: endOfDay
      });

      if (result.success && result.data) {
        const events = result.data;
        
        // Separate upcoming and overdue events
        const upcoming: MedicationCalendarEvent[] = [];
        const overdue: MedicationCalendarEvent[] = [];
        
        events.forEach(event => {
          if (event.status === 'scheduled') {
            const eventTime = new Date(event.scheduledDateTime);
            if (eventTime > now) {
              upcoming.push(event);
            } else {
              overdue.push(event);
            }
          }
        });

        // Sort by scheduled time
        upcoming.sort((a, b) => new Date(a.scheduledDateTime).getTime() - new Date(b.scheduledDateTime).getTime());
        overdue.sort((a, b) => new Date(b.scheduledDateTime).getTime() - new Date(a.scheduledDateTime).getTime());

        setUpcomingEvents(upcoming.slice(0, maxItems));
        setOverdueEvents(overdue.slice(0, maxItems));
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsTaken = async (event: MedicationCalendarEvent, withNotes = false) => {
    if (withNotes) {
      setShowNotes(event.id);
      return;
    }

    try {
      setTakingMedication(event.id);
      
      const result = await medicationCalendarApi.markMedicationTaken(
        event.id,
        new Date(),
        notes || undefined
      );

      if (result.success) {
        await loadReminders();
        setNotes('');
        setShowNotes(null);
      } else {
        console.error('Failed to mark medication as taken:', result.error);
      }
    } catch (error) {
      console.error('Error marking medication as taken:', error);
    } finally {
      setTakingMedication(null);
    }
  };

  const handleMarkAsTakenWithNotes = async (event: MedicationCalendarEvent) => {
    await handleMarkAsTaken(event, false);
  };

  const formatTime = (dateTime: string | Date): string => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (dateTime: string | Date): string => {
    const now = new Date();
    const eventTime = new Date(dateTime);
    const diffMs = eventTime.getTime() - now.getTime();
    
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

  const ReminderCard = ({ event, isOverdue = false }: { event: MedicationCalendarEvent; isOverdue?: boolean }) => (
    <div className={`p-4 rounded-lg border ${
      isOverdue 
        ? 'bg-red-50 border-red-200' 
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`p-2 rounded-full ${
            isOverdue ? 'bg-red-100' : 'bg-blue-100'
          }`}>
            <Pill className={`w-4 h-4 ${
              isOverdue ? 'text-red-600' : 'text-blue-600'
            }`} />
          </div>
          
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">
              {event.medicationName}
            </h4>
            <p className="text-sm text-gray-600">
              {event.dosageAmount}
            </p>
            {event.instructions && (
              <p className="text-xs text-gray-500 mt-1">
                {event.instructions}
              </p>
            )}
            
            <div className="flex items-center space-x-4 mt-2 text-sm">
              <span className={`flex items-center space-x-1 ${
                isOverdue ? 'text-red-600' : 'text-blue-600'
              }`}>
                <Clock className="w-3 h-3" />
                <span>{formatTime(event.scheduledDateTime)}</span>
              </span>
              
              <span className={`text-xs ${
                isOverdue ? 'text-red-500' : 'text-gray-500'
              }`}>
                {getTimeUntil(event.scheduledDateTime)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {showNotes === event.id ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes (optional)"
                className="text-sm border border-gray-300 rounded px-2 py-1 w-32"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleMarkAsTakenWithNotes(event);
                  }
                }}
              />
              <button
                onClick={() => handleMarkAsTakenWithNotes(event)}
                disabled={takingMedication === event.id}
                className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowNotes(null);
                  setNotes('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleMarkAsTaken(event)}
                disabled={takingMedication === event.id}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md disabled:opacity-50"
                title="Mark as taken"
              >
                {takingMedication === event.id ? (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
              </button>
              
              <button
                onClick={() => setShowNotes(event.id)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                title="Add notes"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading reminders...</span>
      </div>
    );
  }

  const hasReminders = (showOverdue && overdueEvents.length > 0) || (showUpcoming && upcomingEvents.length > 0);

  if (!hasReminders) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No reminders</h4>
        <p className="text-gray-500">
          {showUpcoming && showOverdue 
            ? "You're all caught up! No upcoming or overdue medications."
            : showUpcoming 
            ? "No upcoming medications scheduled for today."
            : "No overdue medications."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <span>Medication Reminders</span>
        </h3>
        
        {(overdueEvents.length > 0 || upcomingEvents.length > 0) && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Today</span>
          </div>
        )}
      </div>

      {/* Overdue Medications */}
      {showOverdue && overdueEvents.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h4 className="text-md font-medium text-red-900">
              Overdue ({overdueEvents.length})
            </h4>
          </div>
          <div className="space-y-3">
            {overdueEvents.map((event) => (
              <ReminderCard key={event.id} event={event} isOverdue={true} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Medications */}
      {showUpcoming && upcomingEvents.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <h4 className="text-md font-medium text-blue-900">
              Upcoming ({upcomingEvents.length})
            </h4>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <ReminderCard key={event.id} event={event} isOverdue={false} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h5 className="text-sm font-medium text-gray-900 mb-2">Quick Tips</h5>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Tap the checkmark to quickly mark a dose as taken</li>
          <li>• Use the plus icon to add notes about side effects or timing</li>
          <li>• Overdue medications are highlighted in red</li>
          <li>• Set up medication schedules for automatic reminders</li>
        </ul>
      </div>
    </div>
  );
}