import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { useCalendar } from '@/contexts/CalendarContext';
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
  ExternalLink,
  LayoutDashboard
} from 'lucide-react';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { unifiedMedicationApi } from '@/lib/unifiedMedicationApi';
import { createSmartRefresh, createSmartRefreshWithMount, createDebouncedFunction } from '@/lib/requestDebouncer';
import LoadingSpinner from '@/components/LoadingSpinner';
import VisitSummaryCard from '@/components/VisitSummaryCard';
import VisitSummaryForm from '@/components/VisitSummaryForm';
import TimeBucketView from '@/components/TimeBucketView';
import PatientSwitcher from '@/components/PatientSwitcher';
import { PermissionGate } from '@/components/PermissionGate';
import { ViewOnlyBanner } from '@/components/ViewOnlyBanner';
import Onboarding from '@/components/Onboarding';
import { showSuccess, showError } from '@/utils/toast';
import type { VisitSummary, MedicationCalendarEvent, MedicalEvent, Medication, TodayMedicationBuckets } from '@shared/types';

import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

export default function Dashboard() {
  const { user, firebaseUser, refreshUser } = useAuth();
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
  const { events: calendarEvents, loading: loadingCalendar } = useCalendar();
  const [upcomingAppointments, setUpcomingAppointments] = useState<MedicalEvent[]>([]);
  const [takingMedication, setTakingMedication] = useState<string | null>(null);
  const [showVisitRecording, setShowVisitRecording] = useState(false);
  const [actionableEvents, setActionableEvents] = useState<ActionableEvent[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  const handleOnboardingComplete = async () => {
    try {
      console.log('🎉 Onboarding completed');
      
      // Mark onboarding as complete in the backend
      const token = await firebaseUser?.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/auth/complete-onboarding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completedAt: new Date().toISOString(),
          skipped: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark onboarding as complete');
      }

      // Refresh user data to get updated onboarding status
      await refreshUser();
      
      setShowOnboarding(false);
      showSuccess('Welcome to FamMedicalCare! 🎉');
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      showError('Failed to save onboarding status. Please try again.');
    }
  };

  const handleOnboardingSkip = async () => {
    try {
      console.log('⏭️ Onboarding skipped');
      
      // Mark onboarding as skipped in the backend
      const token = await firebaseUser?.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('https://us-central1-claritystream-uldp9.cloudfunctions.net/api/auth/complete-onboarding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completedAt: new Date().toISOString(),
          skipped: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark onboarding as skipped');
      }

      // Refresh user data to get updated onboarding status
      await refreshUser();
      
      setShowOnboarding(false);
      showSuccess('You can access the tour anytime from settings.');
    } catch (error) {
      console.error('❌ Error skipping onboarding:', error);
      showError('Failed to save onboarding status. Please try again.');
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
        showError('Cannot add event without a due date');
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
        showSuccess('Event added to calendar successfully!');
        
        // Remove the event from actionable events list
        setActionableEvents(prevEvents => prevEvents.filter(e => e.id !== event.id));
      } else {
        throw new Error(response.error || 'Failed to add event to calendar');
      }
    } catch (error) {
      console.error('Error adding event to calendar:', error);
      showError('Failed to add event to calendar. Please try again.');
    }
  };

  const fetchTodaysMedications = async () => {
    try {
      setLoadingMedications(true);
      const now = new Date();
      
      console.log('🔍 Dashboard: Fetching today\'s medication buckets');

      const effectivePatientId = getEffectivePatientId();
      console.log('🔍 Dashboard: Using effective patient ID for medication buckets:', effectivePatientId);
      
      const result = await unifiedMedicationApi.getTodayMedicationBuckets(now, {
        patientId: effectivePatientId || undefined,
        forceFresh: false
      });

      console.log('🔍 Dashboard: Medication buckets result:', result);

      if (result.success && result.data) {
        // Map unified API response to legacy format for compatibility
        const mappedData: TodayMedicationBuckets = {
          now: result.data.now as any || [],
          dueSoon: result.data.dueSoon as any || [],
          morning: result.data.morning as any || [],
          noon: result.data.lunch as any || [],
          evening: result.data.evening as any || [],
          bedtime: result.data.beforeBed as any || [],
          overdue: result.data.overdue as any || [],
          completed: result.data.completed as any || [],
          patientPreferences: {
            timeSlots: {
              morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
              noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Lunch' },
              evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
              bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Before Bed' }
            }
          } as any,
          lastUpdated: result.data.lastUpdated
        };
        setTodaysMedications(mappedData);
        console.log('🔍 Dashboard: Today\'s medication buckets loaded:', {
          overdue: result.data.overdue.length,
          now: result.data.now.length,
          dueSoon: result.data.dueSoon.length,
          morning: result.data.morning.length,
          noon: result.data.lunch?.length || 0,
          evening: result.data.evening.length,
          bedtime: result.data.beforeBed?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ Error fetching today\'s medications:', error);
    } finally {
      setLoadingMedications(false);
    }
  };

  // Extract upcoming appointments from calendar context
  useEffect(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcoming = calendarEvents
      .filter(event =>
        event.type === 'medical' &&
        event.medicalEvent &&
        event.startDateTime >= now &&
        event.startDateTime <= thirtyDaysFromNow &&
        ['scheduled', 'confirmed'].includes(event.medicalEvent.status)
      )
      .map(event => event.medicalEvent!)
      .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())
      .slice(0, 5); // Show only next 5 appointments

    setUpcomingAppointments(upcoming);
  }, [calendarEvents]);


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



  useEffect(() => {
    const effectivePatientId = getEffectivePatientId();
    console.log('🔍 Dashboard useEffect triggered:', {
      hasFirebaseUser: !!firebaseUser,
      familyLoading,
      effectivePatientId,
      userRole,
      isInitialMount: isInitialMount.current
    });

    // CRITICAL: For family members, ensure activePatientId is set before fetching data
    if (userRole === 'family_member' && !effectivePatientId) {
      console.warn('⚠️ Dashboard: Family member detected but no patient ID set yet, waiting...');
      return;
    }

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

  // Listen for patient switch events and refresh all data
  useEffect(() => {
    const handlePatientSwitch = (event: CustomEvent) => {
      console.log('🔄 Dashboard: Patient switched, refreshing all data...', event.detail);
      
      // Note: The PatientSwitcher component already triggers a page reload
      // This listener is here for future enhancements where we might want
      // to refresh data without a full page reload
    };

    window.addEventListener('patientSwitched', handlePatientSwitch as EventListener);
    
    return () => {
      window.removeEventListener('patientSwitched', handlePatientSwitch as EventListener);
    };
  }, []);

  const formatTime = (date: Date): string => {
    console.log('🔍 DEBUG formatTime called with:', {
      date,
      type: typeof date,
      isDate: date instanceof Date,
      hasToLocaleTimeString: typeof date?.toLocaleTimeString === 'function',
      constructor: date?.constructor?.name
    });
    
    // Defensive: ensure we have a valid Date object
    if (!(date instanceof Date)) {
      console.error('❌ formatTime received non-Date value, attempting conversion:', date);
      const converted = new Date(date as any);
      console.log('🔄 Converted to:', converted);
      return converted.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date): string => {
    console.log('🔍 DEBUG formatDate called with:', {
      date,
      type: typeof date,
      isDate: date instanceof Date
    });
    
    // Defensive: ensure we have a valid Date object
    if (!(date instanceof Date)) {
      console.error('❌ formatDate received non-Date value, attempting conversion:', date);
      const converted = new Date(date as any);
      return converted.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
    
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

  // Check if user needs to see onboarding (only for new users after authentication)
  useEffect(() => {
    if (user && firebaseUser && !familyLoading) {
      // Only show onboarding for patients who haven't completed it
      // Don't show for family members as they're accessing someone else's account
      if (userRole === 'patient' && user.hasCompletedOnboarding === false) {
        console.log('👋 New user detected, showing onboarding');
        setShowOnboarding(true);
      }
    }
  }, [user, firebaseUser, familyLoading, userRole]);

  // Show loading state for family members waiting for patient context
  if (userRole === 'family_member' && !getEffectivePatientId() && !familyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <LoadingSpinner size="lg" />
          <h2 className="text-xl font-semibold text-gray-900 mt-4 mb-2">
            Loading patient information...
          </h2>
          <p className="text-gray-600 text-sm">
            Setting up your access to the patient's dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* View-Only Banner */}
      <ViewOnlyBanner />
      
      {/* Enhanced Header for Desktop & Mobile */}
      <Header />

      {/* Main Content - Responsive Layout */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-20 md:pb-8">
        
        {/* Welcome Section - Desktop Enhanced */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              {userRole === 'family_member' && activePatientAccess ? (
                <>Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋</>
              ) : (
                <>Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋</>
              )}
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              {userRole === 'family_member' && activePatientAccess ? (
                <>Viewing <span className="font-semibold text-primary-700">{activePatientAccess.patientName}'s</span> health overview for today</>
              ) : (
                <>Here's your health overview for today</>
              )}
            </p>
          </div>
          
          <PermissionGate requiredPermission="canCreate">
            <button
              onClick={() => setShowVisitRecording(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto"
              aria-label="Record a new visit summary"
            >
              <Mic className="w-4 h-4" />
              <span>Record New Visit</span>
            </button>
          </PermissionGate>
        </div>

        {/* Responsive Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Column (Main Content) - 8/12 width on large screens */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Actionable Events (Priority) */}
            {actionableEvents.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    Action Required
                  </h2>
                </div>
                
                <div className="grid gap-4">
                  {actionableEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full flex-shrink-0 ${
                          event.urgency === 'urgent' ? 'bg-red-100 text-red-600' :
                          event.urgency === 'high' ? 'bg-orange-100 text-orange-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {event.type === 'follow_up_appointment' ? <Calendar className="w-5 h-5" /> :
                           event.type.includes('medication') ? <Pill className="w-5 h-5" /> :
                           <AlertCircle className="w-5 h-5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{event.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                              event.urgency === 'urgent' ? 'bg-red-100 text-red-800' :
                              event.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {event.urgency}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{event.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            {event.dueDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                Due: {new Date(event.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {event.providerName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {event.providerName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          {event.actionable && event.dueDate && hasPermission('canCreate') && (
                            <button
                              onClick={() => handleAddToCalendar(event)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Add to Calendar"
                            >
                              <CalendarPlus className="w-5 h-5" />
                            </button>
                          )}
                          {event.type.includes('medication') && (
                            <Link
                              to="/medications"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Manage Medication"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Medications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-primary-600" />
                  Today's Medications
                </h2>
                
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex rounded-lg border border-gray-200 bg-white text-xs overflow-hidden">
                    {[
                      { key: 'active', label: 'Active' },
                      { key: 'inactive', label: 'Past' },
                      { key: 'all', label: 'All' }
                    ].map(filter => (
                      <button
                        key={filter.key}
                        onClick={() => setMedicationFilter(filter.key as any)}
                        className={`px-3 py-1.5 font-medium transition-colors ${
                          medicationFilter === filter.key
                            ? 'bg-primary-600 text-white'
                            : 'hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <Link
                    to="/medications"
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    View All <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              
              <div className="p-4">
                {loadingMedications ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : todaysMedications ? (
                  <TimeBucketView
                    patientId={getEffectivePatientId() || ''}
                    date={new Date()}
                    onMedicationAction={handleMedicationAction}
                    compactMode={false} // Use standard mode for better desktop experience
                    refreshTrigger={refreshTrigger}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Pill className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No medications scheduled for today</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Visit Summaries (Desktop Layout) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Recent Visits
                </h2>
                <Link
                  to="/visit-summaries"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              <div className="divide-y divide-gray-100">
                {loadingVisitSummaries ? (
                  <div className="p-8 flex justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : recentVisitSummaries.length > 0 ? (
                  recentVisitSummaries.slice(0, 3).map((summary) => (
                    <Link
                      key={summary.id}
                      to={`/visit-summary/${summary.id}`}
                      className="block p-4 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {summary.visitType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Visit
                            </h3>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {new Date(summary.visitDate).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                            {summary.providerName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {summary.providerName}
                              </span>
                            )}
                            {summary.aiProcessedSummary?.urgencyLevel && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${
                                summary.aiProcessedSummary.urgencyLevel === 'urgent' ? 'bg-red-100 text-red-800' :
                                summary.aiProcessedSummary.urgencyLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {summary.aiProcessedSummary.urgencyLevel} Priority
                              </span>
                            )}
                          </div>
                          
                          {summary.aiProcessedSummary?.keyPoints && summary.aiProcessedSummary.keyPoints.length > 0 && (
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {summary.aiProcessedSummary.keyPoints[0]}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 self-center" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No recent visits recorded.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column (Sidebar) - 4/12 width on large screens */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upcoming Appointments Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Upcoming
                </h2>
                <Link to="/calendar" className="text-purple-600 hover:text-purple-700">
                  <Plus className="w-5 h-5" />
                </Link>
              </div>
              
              <div className="divide-y divide-gray-100">
                {loadingCalendar ? (
                  <div className="p-8 flex justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 text-center min-w-[3rem] bg-purple-50 rounded p-1">
                          <span className="block text-xs font-bold text-purple-700 uppercase">
                            {new Date(appointment.startDateTime).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="block text-lg font-bold text-purple-900 leading-none">
                            {new Date(appointment.startDateTime).getDate()}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm truncate">{appointment.title}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(appointment.startDateTime)}
                          </div>
                          {appointment.location && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 truncate">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              {appointment.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">No appointments coming up.</p>
                  </div>
                )}
              </div>
              
              {upcomingAppointments.length > 0 && (
                <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
                  <Link to="/calendar" className="text-sm font-medium text-purple-600 hover:text-purple-700">
                    View Full Calendar
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Stats / Info Card */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl shadow-md p-6 text-white">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Health Summary
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-primary-100 text-sm">Medications Taken</span>
                  <span className="font-bold text-xl">
                    {todaysMedications?.completed?.filter(e => e.status === 'taken').length || 0}
                    <span className="text-primary-300 text-sm font-normal"> / {
                      (todaysMedications ? 
                        (todaysMedications.now.length + 
                         todaysMedications.dueSoon.length + 
                         todaysMedications.morning.length + 
                         todaysMedications.noon.length + 
                         todaysMedications.evening.length + 
                         todaysMedications.bedtime.length +
                         todaysMedications.overdue.length +
                         todaysMedications.completed.length) : 0)
                    }</span>
                  </span>
                </div>
                
                <div className="w-full bg-primary-800 rounded-full h-2">
                  <div 
                    className="bg-white rounded-full h-2 transition-all duration-500"
                    style={{ 
                      width: `${(() => {
                        const total = (todaysMedications ? 
                          (todaysMedications.now.length + 
                           todaysMedications.dueSoon.length + 
                           todaysMedications.morning.length + 
                           todaysMedications.noon.length + 
                           todaysMedications.evening.length + 
                           todaysMedications.bedtime.length +
                           todaysMedications.overdue.length +
                           todaysMedications.completed.length) : 0);
                        const taken = todaysMedications?.completed?.filter(e => e.status === 'taken').length || 0;
                        return total > 0 ? (taken / total) * 100 : 0;
                      })()}%` 
                    }}
                  />
                </div>
                
                <div className="pt-4 border-t border-primary-500/50 mt-4">
                  <p className="text-sm text-primary-100 italic">
                    "Consistent medication adherence is key to better health outcomes."
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Links */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Links</h3>
              <nav className="space-y-2">
                <Link to="/profile" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                  <div className="bg-green-100 p-1.5 rounded-md text-green-600">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">My Profile</span>
                </Link>
                <Link to="/family-management" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                  <div className="bg-amber-100 p-1.5 rounded-md text-amber-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Manage Family</span>
                </Link>
                <Link to="/settings" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                  <div className="bg-gray-100 p-1.5 rounded-md text-gray-600">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Settings</span>
                </Link>
              </nav>
            </div>

          </div>
        </div>

        {/* Onboarding Modal */}
        {showOnboarding && (
          <Onboarding
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}

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

      {/* Mobile Bottom Navigation - Hidden on Desktop */}
      <MobileNav 
        onHomeClick={() => {
          console.log('🏠 Home button clicked - forcing dashboard refresh');
          // Force refresh all data by bypassing smart refresh cache
          smartFetchVisitSummaries(true);
          setTimeout(() => smartFetchTodaysMedications(true), 200);
        }} 
      />
    </div>
  );
}
