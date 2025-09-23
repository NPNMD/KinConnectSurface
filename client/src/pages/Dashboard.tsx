import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
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
import { createSmartRefresh, createSmartRefreshWithMount, createDebouncedFunction } from '@/lib/requestDebouncer';
import LoadingSpinner from '@/components/LoadingSpinner';
import VisitSummaryCard from '@/components/VisitSummaryCard';
import VisitSummaryForm from '@/components/VisitSummaryForm';
import TimeBucketView from '@/components/TimeBucketView';
import PatientSwitcher from '@/components/PatientSwitcher';
import { CreatePermissionWrapper, EditPermissionWrapper } from '@/components/PermissionWrapper';
import type { VisitSummary, MedicationCalendarEvent, MedicalEvent, Medication, TodayMedicationBuckets } from '@shared/types';

export default function Dashboard() {
  const { user, firebaseUser } = useAuth();
  const {
    userRole,
    activePatientAccess,
    getEffectivePatientId,
    hasPermission,
    isLoading: familyLoading
  } = useFamily();
  
  // Track if this is the initial mount to bypass cache on navigation
  const isInitialMount = useRef(true);
  const [recentVisitSummaries, setRecentVisitSummaries] = useState<VisitSummary[]>([]);
  const [loadingVisitSummaries, setLoadingVisitSummaries] = useState(false);
  const [todaysMedications, setTodaysMedications] = useState<TodayMedicationBuckets | null>(null);
  const [loadingMedications, setLoadingMedications] = useState(false);
  const [medicationFilter, setMedicationFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState<MedicalEvent[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
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
      const effectivePatientId = getEffectivePatientId();
      if (!effectivePatientId) return;

      console.log('🔍 Fetching recent visit summaries for patient:', effectivePatientId);
      
      const response = await apiClient.get<{ success: boolean; data: VisitSummary[] }>(
        `${API_ENDPOINTS.VISIT_SUMMARIES(effectivePatientId)}?limit=3&offset=0`
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
        patientId: getEffectivePatientId(),
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
      
      console.log('🔍 Dashboard: Fetching today\'s medication buckets');

      const effectivePatientId = getEffectivePatientId();
      console.log('🔍 Dashboard: Using effective patient ID for medication buckets:', effectivePatientId);
      
      const result = await medicationCalendarApi.getTodayMedicationBuckets(now, {
        patientId: effectivePatientId || undefined,
        forceFresh: false
      });

      console.log('🔍 Dashboard: Medication buckets result:', result);

      if (result.success && result.data) {
        setTodaysMedications(result.data);
        console.log('🔍 Dashboard: Today\'s medication buckets loaded:', {
          overdue: result.data.overdue.length,
          now: result.data.now.length,
          dueSoon: result.data.dueSoon.length,
          morning: result.data.morning.length,
          noon: result.data.noon.length,
          evening: result.data.evening.length,
          bedtime: result.data.bedtime.length
        });
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
      const effectivePatientId = getEffectivePatientId();
      if (!effectivePatientId) return;

      const response = await apiClient.get<{ success: boolean; data: MedicalEvent[] }>(
        API_ENDPOINTS.MEDICAL_EVENTS(effectivePatientId)
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


  const handleMedicationAction = (eventId: string, action: 'take' | 'snooze' | 'skip' | 'reschedule') => {
    console.log('🔧 Dashboard: Medication action performed:', { eventId, action });
    // Refresh medications and trigger refresh
    setTimeout(() => {
      fetchTodaysMedications();
      setRefreshTrigger(prev => prev + 1);
    }, 1000); // 1 second delay to batch updates
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

  // Create mount-aware smart refresh functions to fix navigation blank page issues
  const smartFetchVisitSummaries = createSmartRefreshWithMount(
    fetchRecentVisitSummaries,
    30000, // 30 seconds minimum between calls
    'dashboard_visit_summaries'
  );

  const smartFetchTodaysMedications = createSmartRefreshWithMount(
    fetchTodaysMedications,
    10000, // 10 seconds minimum between calls (shorter for medication actions)
    'dashboard_todays_medications'
  );


  const smartFetchUpcomingAppointments = createSmartRefreshWithMount(
    fetchUpcomingAppointments,
    120000, // 2 minutes minimum between calls
    'dashboard_appointments'
  );

  useEffect(() => {
    const effectivePatientId = getEffectivePatientId();
    console.log('🔍 Dashboard useEffect triggered:', {
      hasFirebaseUser: !!firebaseUser,
      familyLoading,
      effectivePatientId,
      userRole,
      isInitialMount: isInitialMount.current
    });

    if (firebaseUser && !familyLoading && effectivePatientId) {
      console.log('✅ Dashboard: All conditions met, fetching data with staggered timing...');
      
      // Use mount-aware cache bypassing - bypass cache on initial mount, use normal cache for subsequent calls
      const bypassCache = isInitialMount.current;
      
      if (bypassCache) {
        console.log('🔄 Dashboard: Initial mount detected, bypassing cache for fresh data');
      }
      
      // Stagger API calls to prevent rate limiting
      smartFetchVisitSummaries(bypassCache);
      
      setTimeout(() => {
        smartFetchTodaysMedications(bypassCache);
      }, 200);
      
      setTimeout(() => {
        smartFetchUpcomingAppointments(bypassCache);
      }, 400);
      
      // Mark that initial mount is complete
      if (isInitialMount.current) {
        isInitialMount.current = false;
      }
    } else {
      console.log('⏳ Dashboard: Waiting for conditions to be met');
    }
  }, [firebaseUser, familyLoading, getEffectivePatientId(), userRole]);

  // Midnight refresh effect - automatically refresh medications at midnight
  useEffect(() => {
    const setupMidnightRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0); // 1 second after midnight
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      console.log(`🕛 Setting up midnight refresh in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
      
      const timeoutId = setTimeout(() => {
        console.log('🕛 Midnight refresh triggered - refreshing today\'s medications');
        
        // Force fresh data at midnight
        if (firebaseUser && !familyLoading && getEffectivePatientId()) {
          smartFetchTodaysMedications(true); // Force fresh
          
          // Set up the next midnight refresh
          setupMidnightRefresh();
        }
      }, msUntilMidnight);
      
      return timeoutId;
    };
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (firebaseUser && !familyLoading && getEffectivePatientId()) {
      timeoutId = setupMidnightRefresh();
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [firebaseUser, familyLoading, getEffectivePatientId()]);

  // Additional effect to handle navigation refresh issues
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && firebaseUser && !familyLoading && getEffectivePatientId()) {
        console.log('🔄 Dashboard: Page became visible, refreshing data with staggered timing...');
        
        // Use normal cache behavior for visibility changes (not bypassing cache)
        const bypassCache = false;
        
        // Stagger refresh calls to prevent rate limiting
        smartFetchVisitSummaries(bypassCache);
        
        setTimeout(() => {
          smartFetchTodaysMedications(bypassCache);
        }, 300);
        
        setTimeout(() => {
          smartFetchUpcomingAppointments(bypassCache);
        }, 600);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [firebaseUser, familyLoading, getEffectivePatientId()]);

  // Listen for medication schedule updates with debounced refresh
  useEffect(() => {
    const debouncedRefresh = createDebouncedFunction(
      async () => {
        console.log('🔍 Dashboard: Refreshing data after schedule update');
        // Use normal cache behavior for schedule updates (not bypassing cache)
        await smartFetchTodaysMedications(false);
      },
      2000, // 2 second debounce
      'dashboard_schedule_update'
    );

    const handleScheduleUpdate = () => {
      console.log('🔍 Dashboard: Received schedule update event');
      debouncedRefresh();
    };

    window.addEventListener('medicationScheduleUpdated', handleScheduleUpdate);
    
    return () => {
      window.removeEventListener('medicationScheduleUpdated', handleScheduleUpdate);
      debouncedRefresh.cancel();
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
            
            {/* Patient Switcher for Family Members */}
            <div className="flex-1 flex justify-center">
              <PatientSwitcher />
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
            {userRole === 'family_member' && activePatientAccess ? (
              <>Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋</>
            ) : (
              <>Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋</>
            )}
          </h1>
          <p className="text-gray-600 text-sm">
            {userRole === 'family_member' && activePatientAccess ? (
              <>Viewing {activePatientAccess.patientName}'s health overview for today</>
            ) : (
              <>Here's your health overview for today</>
            )}
          </p>
        </div>

        {/* Recent Events Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
            <div className="flex items-center space-x-2">
              <CreatePermissionWrapper>
                <button
                  onClick={() => setShowVisitRecording(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  <span>Record Visit</span>
                </button>
              </CreatePermissionWrapper>
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
                      {event.actionable && event.dueDate && hasPermission('canCreate') && (
                        <button
                          onClick={() => handleAddToCalendar(event)}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
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
              <CreatePermissionWrapper>
                <button
                  onClick={() => setShowVisitRecording(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors mx-auto"
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {userRole === 'family_member' && activePatientAccess
                      ? `Record Visit for ${activePatientAccess.patientName}`
                      : 'Record Your First Visit'
                    }
                  </span>
                </button>
              </CreatePermissionWrapper>
            </div>
          )}
        </div>

        {/* Today's Medications Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Today's Medications</h2>
            <div className="flex items-center space-x-2">
              {/* Filter Tabs */}
              <div className="flex rounded-lg border border-gray-200 bg-white text-xs">
                {[
                  { key: 'active', label: 'Active' },
                  { key: 'inactive', label: 'Past/Inactive' },
                  { key: 'all', label: 'All' }
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setMedicationFilter(filter.key as any)}
                    className={`px-2 py-1 font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      medicationFilter === filter.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <Link
                to="/medications"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </Link>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {loadingMedications ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-gray-600 text-sm">Loading today's medications...</span>
              </div>
            ) : todaysMedications ? (
              <TimeBucketView
                patientId={getEffectivePatientId() || ''}
                date={new Date()}
                onMedicationAction={handleMedicationAction}
                compactMode={true}
                refreshTrigger={refreshTrigger}
              />
            ) : (
              <div className="text-center py-8">
                <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No medications scheduled for today</p>
              </div>
            )}
          </div>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <VisitSummaryForm
                patientId={getEffectivePatientId() || ''}
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
      <nav className="mobile-nav-container">
        <div className="flex items-center justify-around">
          <button
            onClick={() => {
              console.log('🏠 Home button clicked - forcing dashboard refresh');
              // Force refresh all data by bypassing smart refresh cache
              smartFetchVisitSummaries(true);
              setTimeout(() => smartFetchTodaysMedications(true), 200);
              setTimeout(() => smartFetchUpcomingAppointments(true), 400);
            }}
            className="flex flex-col items-center space-y-1 p-2 text-primary-600"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          
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
