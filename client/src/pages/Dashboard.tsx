import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { signOutUser } from '@/lib/firebase';
import {
  Heart,
  Calendar,
  Pill,
  Users,
  Settings,
  LogOut,
  Plus,
  Bell,
  Activity,
  Shield,
  Mail,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  FileText,
  User,
  Building,
  MapPin,
  Stethoscope,
  Mic,
  CalendarPlus,
  ExternalLink
} from 'lucide-react';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { medicationCalendarApi } from '@/lib/medicationCalendarApi';
import LoadingSpinner from '@/components/LoadingSpinner';
import VisitSummaryCard from '@/components/VisitSummaryCard';
import VisitSummaryForm from '@/components/VisitSummaryForm';
import type { VisitSummary, MedicationCalendarEvent, MedicalEvent } from '@shared/types';

interface TodaysMedication {
  id: string;
  medicationName: string;
  dosageAmount: string;
  scheduledDateTime: Date;
  status: 'scheduled' | 'taken' | 'missed' | 'skipped';
  instructions?: string;
  isOverdue: boolean;
}

export default function Dashboard() {
  const { user, firebaseUser } = useAuth();
  const [recentVisitSummaries, setRecentVisitSummaries] = useState<VisitSummary[]>([]);
  const [loadingVisitSummaries, setLoadingVisitSummaries] = useState(false);
  const [todaysMedications, setTodaysMedications] = useState<TodaysMedication[]>([]);
  const [loadingMedications, setLoadingMedications] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<MedicalEvent[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [selectedMedications, setSelectedMedications] = useState<Set<string>>(new Set());
  const [showVisitRecording, setShowVisitRecording] = useState(false);
  const [actionableEvents, setActionableEvents] = useState<ActionableEvent[]>([]);

  interface ActionableEvent {
    id: string;
    type: 'follow_up_appointment' | 'new_medication' | 'stop_medication' | 'action_item';
    title: string;
    description: string;
    dueDate?: Date;
    source: 'visit_summary';
    sourceId: string;
    providerName?: string;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
    actionable: boolean;
    medicationData?: any;
  }

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const fetchRecentVisitSummaries = async () => {
    try {
      setLoadingVisitSummaries(true);
      const userId = firebaseUser?.uid;
      if (!userId) return;

      console.log('🔍 Fetching recent visit summaries for user:', userId);
      
      const response = await apiClient.get<{ success: boolean; data: VisitSummary[] }>(
        `${API_ENDPOINTS.VISIT_SUMMARIES(userId)}?limit=3&offset=0`
      );
      
      if (response.success && response.data) {
        // Filter to last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentSummaries = response.data.filter(summary => 
          new Date(summary.visitDate) >= thirtyDaysAgo
        );
        
        setRecentVisitSummaries(recentSummaries);
        
        // Extract actionable events from visit summaries
        const events = extractActionableEvents(recentSummaries);
        setActionableEvents(events);
        
        console.log('✅ Recent visit summaries loaded:', recentSummaries.length);
        console.log('✅ Actionable events extracted:', events.length);
      }
    } catch (error) {
      console.error('❌ Error fetching recent visit summaries:', error);
    } finally {
      setLoadingVisitSummaries(false);
    }
  };

  const extractActionableEvents = (summaries: VisitSummary[]): ActionableEvent[] => {
    const events: ActionableEvent[] = [];
    
    summaries.forEach(summary => {
      const aiSummary = summary.aiProcessedSummary;
      if (aiSummary) {
        // Extract follow-up appointments
        if (aiSummary.followUpRequired && aiSummary.followUpDate) {
          events.push({
            id: `followup-${summary.id}`,
            type: 'follow_up_appointment',
            title: 'Follow-up Appointment',
            description: aiSummary.followUpInstructions || 'Schedule follow-up appointment',
            dueDate: aiSummary.followUpDate,
            source: 'visit_summary',
            sourceId: summary.id,
            providerName: summary.providerName,
            urgency: aiSummary.urgencyLevel,
            actionable: true
          });
        }

        // Extract medication changes that need action
        if (aiSummary.medicationChanges) {
          aiSummary.medicationChanges.newMedications.forEach(med => {
            events.push({
              id: `new-med-${summary.id}-${med.name}`,
              type: 'new_medication',
              title: `Start ${med.name}`,
              description: `New medication: ${med.dosage || ''} ${med.instructions || ''}`,
              dueDate: med.startDate || new Date(),
              source: 'visit_summary',
              sourceId: summary.id,
              urgency: aiSummary.urgencyLevel,
              actionable: true,
              medicationData: med
            });
          });

          aiSummary.medicationChanges.stoppedMedications.forEach(med => {
            events.push({
              id: `stop-med-${summary.id}-${med.name}`,
              type: 'stop_medication',
              title: `Stop ${med.name}`,
              description: `Discontinue medication: ${med.reason || 'As directed by provider'}`,
              dueDate: med.stopDate || new Date(),
              source: 'visit_summary',
              sourceId: summary.id,
              urgency: aiSummary.urgencyLevel,
              actionable: true,
              medicationData: med
            });
          });
        }

        // Extract general action items
        aiSummary.actionItems?.forEach((item, index) => {
          // Try to detect if it's a time-sensitive action
          const timeMatch = item.match(/in (\d+) (day|week|month)s?/i);
          let dueDate = new Date();
          
          if (timeMatch) {
            const amount = parseInt(timeMatch[1]);
            const unit = timeMatch[2].toLowerCase();
            
            if (unit === 'day') {
              dueDate.setDate(dueDate.getDate() + amount);
            } else if (unit === 'week') {
              dueDate.setDate(dueDate.getDate() + (amount * 7));
            } else if (unit === 'month') {
              dueDate.setMonth(dueDate.getMonth() + amount);
            }
          }

          events.push({
            id: `action-${summary.id}-${index}`,
            type: 'action_item',
            title: item.length > 50 ? `${item.substring(0, 50)}...` : item,
            description: item,
            dueDate: timeMatch ? dueDate : undefined,
            source: 'visit_summary',
            sourceId: summary.id,
            urgency: aiSummary.urgencyLevel,
            actionable: !!timeMatch // Only actionable if it has a time component
          });
        });
      }
    });

    // Sort by urgency and due date
    return events.sort((a, b) => {
      // First sort by urgency
      const urgencyOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      const urgencyDiff = (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0);
      if (urgencyDiff !== 0) return urgencyDiff;
      
      // Then by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  };

  const handleAddToCalendar = async (event: ActionableEvent) => {
    try {
      if (!event.dueDate) {
        alert('Cannot add event without a due date');
        return;
      }

      const startDate = new Date(event.dueDate);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 minutes default

      const medicalEventData = {
        patientId: firebaseUser?.uid,
        title: event.title,
        description: event.description,
        eventType: event.type === 'follow_up_appointment' ? 'follow_up' : 'appointment',
        priority: event.urgency === 'urgent' ? 'urgent' : event.urgency === 'high' ? 'high' : 'medium',
        status: 'scheduled',
        startDateTime: startDate,
        endDateTime: endDate,
        duration: 30,
        isAllDay: false,
        requiresTransportation: false,
        responsibilityStatus: 'unassigned',
        isRecurring: false,
        reminders: [
          {
            id: `reminder-${Date.now()}`,
            type: 'email',
            minutesBefore: 60,
            isActive: true
          }
        ],
        providerName: event.providerName,
        createdBy: firebaseUser?.uid || ''
      };

      const response = await apiClient.post<{ success: boolean; data?: any; error?: string }>(
        API_ENDPOINTS.MEDICAL_EVENT_CREATE,
        medicalEventData
      );
      
      if (response.success) {
        alert('Event added to calendar successfully!');
        await fetchUpcomingAppointments(); // Refresh appointments
      } else {
        throw new Error(response.error || 'Failed to add event to calendar');
      }
    } catch (error) {
      console.error('Error adding event to calendar:', error);
      alert('Failed to add event to calendar. Please try again.');
    }
  };

  const fetchTodaysMedications = async () => {
    try {
      setLoadingMedications(true);
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('🔍 Dashboard: Fetching today\'s medications from', startOfDay, 'to', endOfDay);

      const result = await medicationCalendarApi.getMedicationCalendarEvents({
        startDate: startOfDay,
        endDate: endOfDay
      });

      console.log('🔍 Dashboard: Medication events result:', result);

      if (result.success && result.data) {
        // Filter to show only medications that need action (not taken or late) AND are for today
        const todaysEvents = result.data
          .filter(event => {
            const eventDate = new Date(event.scheduledDateTime);
            const isToday = eventDate >= startOfDay && eventDate <= endOfDay;
            const needsAction = !['taken', 'late'].includes(event.status); // Hide both taken and late
            
            console.log('🔍 Event filter check:', {
              eventId: event.id,
              medicationName: event.medicationName,
              scheduledDateTime: eventDate.toISOString(),
              status: event.status,
              isToday,
              needsAction,
              willShow: isToday && needsAction
            });
            
            return isToday && needsAction;
          })
          .map(event => ({
            id: event.id,
            medicationName: event.medicationName,
            dosageAmount: event.dosageAmount,
            scheduledDateTime: new Date(event.scheduledDateTime),
            status: event.status as 'scheduled' | 'taken' | 'missed' | 'skipped',
            instructions: event.instructions,
            isOverdue: new Date(event.scheduledDateTime) < now
          }))
          .sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());

        console.log('🔍 Dashboard: Processed today\'s events (filtered by date and status):', todaysEvents);
        console.log('🔍 Dashboard: Total events received:', result.data.length, 'Showing (today + not taken):', todaysEvents.length);
        setTodaysMedications(todaysEvents);
      }
    } catch (error) {
      console.error('❌ Error fetching today\'s medications:', error);
    } finally {
      setLoadingMedications(false);
    }
  };

  const fetchUpcomingAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const userId = firebaseUser?.uid;
      if (!userId) return;

      const response = await apiClient.get<{ success: boolean; data: MedicalEvent[] }>(
        API_ENDPOINTS.MEDICAL_EVENTS(userId)
      );

      if (response.success && response.data) {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const upcoming = response.data
          .filter(event => {
            const eventDate = new Date(event.startDateTime);
            return eventDate >= now && eventDate <= thirtyDaysFromNow && 
                   ['scheduled', 'confirmed'].includes(event.status);
          })
          .map(event => ({
            ...event,
            startDateTime: new Date(event.startDateTime),
            endDateTime: new Date(event.endDateTime),
            createdAt: new Date(event.createdAt),
            updatedAt: new Date(event.updatedAt)
          }))
          .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())
          .slice(0, 5); // Show only next 5 appointments

        setUpcomingAppointments(upcoming);
      }
    } catch (error) {
      console.error('❌ Error fetching upcoming appointments:', error);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleMarkMedicationTaken = async (medicationId: string) => {
    try {
      console.log('🔧 Dashboard: Marking medication as taken:', medicationId);
      setTakingMedication(medicationId);
      
      const result = await medicationCalendarApi.markMedicationTaken(
        medicationId,
        new Date()
      );

      console.log('🔧 Dashboard: Mark medication result:', result);

      if (result.success) {
        console.log('✅ Dashboard: Medication marked as taken successfully');
        await fetchTodaysMedications();
        // Remove from selected medications if it was selected
        setSelectedMedications(prev => {
          const newSet = new Set(prev);
          newSet.delete(medicationId);
          return newSet;
        });
      } else {
        console.error('❌ Dashboard: Failed to mark medication as taken:', result.error);
        // You could add a toast notification here to show the error to the user
        alert(`Failed to mark medication as taken: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Dashboard: Error marking medication as taken:', error);
      // You could add a toast notification here to show the error to the user
      alert('An unexpected error occurred while marking the medication as taken. Please try again.');
    } finally {
      setTakingMedication(null);
    }
  };

  const handleMarkAllSelectedTaken = async () => {
    try {
      console.log('🔧 Dashboard: Marking all selected medications as taken:', Array.from(selectedMedications));
      
      const promises = Array.from(selectedMedications).map(id =>
        medicationCalendarApi.markMedicationTaken(id, new Date())
      );
      
      const results = await Promise.all(promises);
      console.log('🔧 Dashboard: Mark all selected results:', results);
      
      // Check if any failed
      const failedResults = results.filter(result => !result.success);
      if (failedResults.length > 0) {
        console.error('❌ Dashboard: Some medications failed to be marked as taken:', failedResults);
        alert(`Failed to mark ${failedResults.length} medication(s) as taken. Please try again.`);
      } else {
        console.log('✅ Dashboard: All selected medications marked as taken successfully');
      }
      
      await fetchTodaysMedications();
      setSelectedMedications(new Set());
      setSelectAllChecked(false);
    } catch (error) {
      console.error('❌ Dashboard: Error marking selected medications as taken:', error);
      alert('An unexpected error occurred while marking medications as taken. Please try again.');
    }
  };

  const handleSelectAll = () => {
    if (selectAllChecked) {
      setSelectedMedications(new Set());
      setSelectAllChecked(false);
    } else {
      const allMedicationIds = new Set(todaysMedications.map(med => med.id));
      setSelectedMedications(allMedicationIds);
      setSelectAllChecked(true);
    }
  };

  const handleMedicationSelect = (medicationId: string) => {
    setSelectedMedications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(medicationId)) {
        newSet.delete(medicationId);
      } else {
        newSet.add(medicationId);
      }
      
      // Update select all checkbox
      setSelectAllChecked(newSet.size === todaysMedications.length && todaysMedications.length > 0);
      
      return newSet;
    });
  };

  const handleVisitSummarySubmit = async (summary: any) => {
    console.log('✅ Visit summary submitted:', summary);
    setShowVisitRecording(false);
    // Refresh recent visit summaries to show the new one
    await fetchRecentVisitSummaries();
  };

  const handleVisitSummaryCancel = () => {
    setShowVisitRecording(false);
  };

  useEffect(() => {
    if (firebaseUser) {
      fetchRecentVisitSummaries();
      fetchTodaysMedications();
      fetchUpcomingAppointments();
    }
  }, [firebaseUser]);

  // Listen for medication schedule updates
  useEffect(() => {
    const handleScheduleUpdate = () => {
      console.log('🔍 Dashboard: Received schedule update event, refreshing data');
      fetchTodaysMedications();
    };

    window.addEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    
    return () => {
      window.removeEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    };
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
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

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'appointment':
      case 'consultation':
        return <Stethoscope className="w-4 h-4" />;
      case 'surgery':
      case 'procedure':
        return <AlertCircle className="w-4 h-4" />;
      case 'lab_test':
      case 'imaging':
        return <Activity className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-First Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Heart className="w-6 h-6 text-primary-600" />
              <span className="text-lg font-bold text-gray-900">KinConnect</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              
              {firebaseUser?.photoURL && (
                <img
                  src={firebaseUser.photoURL}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              )}
              
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <main className="px-4 py-4 pb-20">
        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-gray-600 text-sm">
            Here's your health overview for today
          </p>
        </div>

        {/* Recent Events Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowVisitRecording(true)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                <Mic className="w-4 h-4" />
                <span>Record Visit</span>
              </button>
              {recentVisitSummaries.length > 0 && (
                <Link
                  to="/visit-summaries"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View All
                </Link>
              )}
            </div>
          </div>
          
          {loadingVisitSummaries ? (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-gray-600 text-sm">Loading recent events...</span>
              </div>
            </div>
          ) : recentVisitSummaries.length > 0 || actionableEvents.length > 0 ? (
            <div className="space-y-3">
              {/* Actionable Events */}
              {actionableEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`p-2 rounded-full ${
                        event.urgency === 'urgent' ? 'bg-red-100' :
                        event.urgency === 'high' ? 'bg-orange-100' :
                        'bg-blue-100'
                      }`}>
                        {event.type === 'follow_up_appointment' ? (
                          <Calendar className={`w-4 h-4 ${
                            event.urgency === 'urgent' ? 'text-red-600' :
                            event.urgency === 'high' ? 'text-orange-600' :
                            'text-blue-600'
                          }`} />
                        ) : event.type === 'new_medication' || event.type === 'stop_medication' ? (
                          <Pill className={`w-4 h-4 ${
                            event.urgency === 'urgent' ? 'text-red-600' :
                            event.urgency === 'high' ? 'text-orange-600' :
                            'text-blue-600'
                          }`} />
                        ) : (
                          <AlertCircle className={`w-4 h-4 ${
                            event.urgency === 'urgent' ? 'text-red-600' :
                            event.urgency === 'high' ? 'text-orange-600' :
                            'text-blue-600'
                          }`} />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {event.title}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          event.urgency === 'urgent' ? 'bg-red-100 text-red-800' :
                          event.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                          event.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {event.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {event.description}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {event.dueDate && (
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(event.dueDate).toLocaleDateString()}</span>
                          </span>
                        )}
                        {event.providerName && (
                          <span className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{event.providerName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      {event.actionable && event.dueDate && (
                        <button
                          onClick={() => handleAddToCalendar(event)}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                          title="Add to calendar"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          <span>Add to Calendar</span>
                        </button>
                      )}
                      {event.type.includes('medication') && (
                        <Link
                          to="/medications"
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                          title="Manage medications"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Manage</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Recent Visit Summaries */}
              {recentVisitSummaries.slice(0, 2).map((summary) => (
                <Link
                  key={summary.id}
                  to={`/visit-summary/${summary.id}`}
                  className="block bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {summary.visitType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Visit
                        </h3>
                        {summary.aiProcessedSummary?.urgencyLevel && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            summary.aiProcessedSummary.urgencyLevel === 'urgent' ? 'bg-red-100 text-red-800' :
                            summary.aiProcessedSummary.urgencyLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {summary.aiProcessedSummary.urgencyLevel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(summary.visitDate).toLocaleDateString()}</span>
                        </span>
                        {summary.providerName && (
                          <span className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{summary.providerName}</span>
                          </span>
                        )}
                      </div>
                      {summary.aiProcessedSummary?.keyPoints && summary.aiProcessedSummary.keyPoints.length > 0 && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {summary.aiProcessedSummary.keyPoints[0]}
                        </p>
                      )}
                      {summary.inputMethod === 'voice' && summary.voiceTranscriptionId && (
                        <div className="mt-2 flex items-center space-x-2 text-xs text-blue-600">
                          <Mic className="w-3 h-3" />
                          <span>Voice recording available</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-3">Nothing new in the last 30 days</p>
              <button
                onClick={() => setShowVisitRecording(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors mx-auto"
              >
                <Mic className="w-4 h-4" />
                <span>Record Your First Visit</span>
              </button>
            </div>
          )}
        </div>

        {/* Today's Medications Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Today's Medications</h2>
            <Link 
              to="/medications" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage
            </Link>
          </div>
          
          {loadingMedications ? (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-gray-600 text-sm">Loading medications...</span>
              </div>
            </div>
          ) : todaysMedications.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200">
              {/* Select All Header */}
              {todaysMedications.length > 1 && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAllChecked}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Select All</span>
                    </label>
                    {selectedMedications.size > 0 && (
                      <button
                        onClick={handleMarkAllSelectedTaken}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                      >
                        Mark {selectedMedications.size} as Taken
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Medications List */}
              <div className="divide-y divide-gray-200">
                {todaysMedications.map((medication) => (
                  <div key={medication.id} className="p-4">
                    <div className="flex items-center space-x-3">
                      {todaysMedications.length > 1 && (
                        <input
                          type="checkbox"
                          checked={selectedMedications.has(medication.id)}
                          onChange={() => handleMedicationSelect(medication.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      )}
                      
                      <div className={`p-2 rounded-full ${
                        medication.isOverdue ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        <Pill className={`w-4 h-4 ${
                          medication.isOverdue ? 'text-red-600' : 'text-blue-600'
                        }`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {medication.medicationName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {medication.dosageAmount}
                        </p>
                        {medication.instructions && (
                          <p className="text-xs text-gray-500 mt-1">
                            {medication.instructions}
                          </p>
                        )}
                        <div className="flex items-center space-x-3 mt-1">
                          <span className={`flex items-center space-x-1 text-xs ${
                            medication.isOverdue ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(medication.scheduledDateTime)}</span>
                          </span>
                          <span className={`text-xs ${
                            medication.isOverdue ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {getTimeUntil(medication.scheduledDateTime)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleMarkMedicationTaken(medication.id)}
                        disabled={takingMedication === medication.id}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md disabled:opacity-50 transition-colors"
                        title="Mark as taken"
                      >
                        {takingMedication === medication.id ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
              <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No medications scheduled for today</p>
            </div>
          )}
        </div>

        {/* Upcoming Appointments Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
            <Link 
              to="/calendar" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View Calendar
            </Link>
          </div>
          
          {loadingAppointments ? (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-gray-600 text-sm">Loading appointments...</span>
              </div>
            </div>
          ) : upcomingAppointments.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getEventTypeIcon(appointment.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm">
                        {appointment.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(appointment.startDateTime)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(appointment.startDateTime)}</span>
                        </span>
                      </div>
                      {appointment.providerName && (
                        <div className="flex items-center space-x-1 mt-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-600">{appointment.providerName}</span>
                        </div>
                      )}
                      {appointment.location && (
                        <div className="flex items-center space-x-1 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-600 truncate">{appointment.location}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No upcoming appointments in the next 30 days</p>
            </div>
          )}
        </div>

        {/* Visit Recording Modal */}
        {showVisitRecording && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <VisitSummaryForm
                patientId={firebaseUser?.uid || ''}
                onSubmit={handleVisitSummarySubmit}
                onCancel={handleVisitSummaryCancel}
                initialData={{
                  visitType: 'walk_in', // Default to walk-in since it's not a scheduled appointment
                  visitDate: new Date()
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
        <div className="flex items-center justify-around">
          <Link
            to="/dashboard"
            className="flex flex-col items-center space-y-1 p-2 text-primary-600"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          
          <Link
            to="/medications"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pill className="w-5 h-5" />
            <span className="text-xs">Medications</span>
          </Link>
          
          <Link
            to="/calendar"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs">Calendar</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </Link>
          
          <Link
            to="/family/invite"
            className="flex flex-col items-center space-y-1 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Family</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
