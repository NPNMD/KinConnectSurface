import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Clock, MapPin, User, Stethoscope, AlertCircle, CheckCircle, Users, Car, Settings, ChevronLeft, ChevronRight, Search, Filter, Download, Share2, BarChart3, FileText } from 'lucide-react';
import HealthcareProviderSearch from './HealthcareProviderSearch';
import FamilyAccessControls from './FamilyAccessControls';
import FamilyResponsibilityDashboard from './FamilyResponsibilityDashboard';
import NotificationSystem from './NotificationSystem';
import CalendarAnalytics from './CalendarAnalytics';
import AppointmentTemplates from './AppointmentTemplates';
import type {
  MedicalEvent,
  MedicalEventType,
  MedicalEventPriority,
  MedicalEventStatus,
  GooglePlaceResult,
  MEDICAL_EVENT_TYPES,
  MEDICAL_EVENT_PRIORITIES,
  MEDICAL_EVENT_STATUSES
} from '@shared/types';

// Import the types we need
const MEDICAL_EVENT_TYPES_ARRAY = [
  'appointment',
  'medication_reminder',
  'lab_test',
  'imaging',
  'procedure',
  'surgery',
  'therapy_session',
  'vaccination',
  'follow_up',
  'consultation',
  'emergency_visit',
  'hospital_admission',
  'discharge',
  'medication_refill',
  'insurance_deadline',
  'health_screening',
  'wellness_check',
  'specialist_referral',
  'test_results_review',
  'care_plan_review'
] as const;

const MEDICAL_EVENT_PRIORITIES_ARRAY = ['low', 'medium', 'high', 'urgent', 'emergency'] as const;
const MEDICAL_EVENT_STATUSES_ARRAY = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show', 'pending_confirmation'] as const;

interface CalendarIntegrationProps {
  patientId: string;
}

export default function CalendarIntegration({ patientId }: CalendarIntegrationProps) {
  const [events, setEvents] = useState<MedicalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MedicalEvent | null>(null);
  const [selectedEventTypes, setSelectedEventTypes] = useState<MedicalEventType[]>(MEDICAL_EVENT_TYPES_ARRAY.slice());
  const [selectedView, setSelectedView] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showProviderSearch, setShowProviderSearch] = useState(false);
  const [showFamilyControls, setShowFamilyControls] = useState(false);
  const [showResponsibilityDashboard, setShowResponsibilityDashboard] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventType: 'appointment' as MedicalEventType,
    priority: 'medium' as MedicalEventPriority,
    status: 'scheduled' as MedicalEventStatus,
    date: '',
    time: '',
    duration: 60,
    isAllDay: false,
    location: '',
    address: '',
    facilityId: '',
    facilityName: '',
    room: '',
    providerId: '',
    providerName: '',
    providerSpecialty: '',
    providerPhone: '',
    providerEmail: '',
    medicalConditions: [] as string[],
    medications: [] as string[],
    allergies: [] as string[],
    specialInstructions: '',
    preparationInstructions: '',
    requiresTransportation: false,
    responsiblePersonId: '',
    responsiblePersonName: '',
    transportationNotes: '',
    accompanimentRequired: false,
    isRecurring: false,
    insuranceRequired: false,
    copayAmount: 0,
    preAuthRequired: false,
    preAuthNumber: '',
    notes: '',
    tags: [] as string[]
  });

  // Initialize Google Calendar API
  useEffect(() => {
    const initializeGoogleCalendar = async () => {
      try {
        // Check if Google Calendar API is available
        const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        
        console.log('📅 Checking Google Calendar API credentials...');
        console.log('📅 API Key available:', !!apiKey);
        console.log('📅 Client ID available:', !!clientId);
        console.log('📅 Environment variables available:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
        
        if (!apiKey || !clientId) {
          console.warn('📅 Google Calendar API credentials not found');
          if (!apiKey) console.warn('📅 Missing: VITE_GOOGLE_CALENDAR_API_KEY');
          if (!clientId) console.warn('📅 Missing: VITE_GOOGLE_CLIENT_ID');
          return;
        }
        
        console.log('📅 Google Calendar API credentials found, initializing...');

        // Load Google API
        if (typeof window !== 'undefined' && (window as any).gapi) {
          await (window as any).gapi.load('auth2', () => {
            (window as any).gapi.auth2.init({
              client_id: clientId,
            });
          });
          
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error initializing Google Calendar:', error);
      }
    };

    initializeGoogleCalendar();
  }, []);

  // Calendar view utility functions
  const getCalendarDays = (date: Date, view: 'month' | 'week') => {
    const days = [];
    let startDate: Date;
    
    if (view === 'month') {
      // Get first day of month, then go back to start of week
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      startDate = new Date(firstOfMonth);
      startDate.setDate(startDate.getDate() - firstOfMonth.getDay());
      
      // Generate 42 days (6 weeks) for month view
      for (let i = 0; i < 42; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        days.push(day);
      }
    } else {
      // Week view - start from Sunday of current week
      startDate = new Date(date);
      startDate.setDate(date.getDate() - date.getDay());
      
      // Generate 7 days for week view
      for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        days.push(day);
      }
    }
    
    return days;
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (selectedView) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const getViewTitle = () => {
    const options: Intl.DateTimeFormatOptions = {};
    
    switch (selectedView) {
      case 'month':
        options.year = 'numeric';
        options.month = 'long';
        break;
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
        } else {
          return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${weekEnd.getFullYear()}`;
        }
      case 'day':
        options.weekday = 'long';
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        break;
      default:
        return 'Calendar';
    }
    
    return currentDate.toLocaleDateString('en-US', options);
  };

  // Event conflict detection
  const detectConflicts = (newEvent: Partial<MedicalEvent>) => {
    if (!newEvent.startDateTime || !newEvent.endDateTime) return [];
    
    const conflicts = events.filter(event => {
      if (event.id === newEvent.id) return false; // Don't check against itself when editing
      
      const eventStart = new Date(event.startDateTime);
      const eventEnd = new Date(event.endDateTime);
      const newStart = new Date(newEvent.startDateTime!);
      const newEnd = new Date(newEvent.endDateTime!);
      
      // Check for time overlap
      return (newStart < eventEnd && newEnd > eventStart);
    });
    
    return conflicts.map(event =>
      `Conflicts with "${event.title}" at ${formatEventTime(event.startDateTime, event.endDateTime)}`
    );
  };

  // Filter and search events
  const filteredAndSearchedEvents = useMemo(() => {
    let filtered = events.filter(event => selectedEventTypes.includes(event.eventType));
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.providerName?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query)
      );
    }
    
    // Filter by current view date range
    if (selectedView !== 'list') {
      const viewStart = new Date(currentDate);
      const viewEnd = new Date(currentDate);
      
      switch (selectedView) {
        case 'month':
          viewStart.setDate(1);
          viewEnd.setMonth(viewEnd.getMonth() + 1, 0);
          break;
        case 'week':
          viewStart.setDate(currentDate.getDate() - currentDate.getDay());
          viewEnd.setDate(viewStart.getDate() + 6);
          break;
        case 'day':
          viewEnd.setDate(viewStart.getDate());
          break;
      }
      
      viewStart.setHours(0, 0, 0, 0);
      viewEnd.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.startDateTime);
        return eventDate >= viewStart && eventDate <= viewEnd;
      });
    }
    
    return filtered.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }, [events, selectedEventTypes, searchQuery, selectedView, currentDate]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    return filteredAndSearchedEvents.filter(event => {
      const eventDate = new Date(event.startDateTime);
      return eventDate >= dayStart && eventDate <= dayEnd;
    });
  };

  const handleGoogleSignIn = async () => {
    try {
      if ((window as any).gapi && (window as any).gapi.auth2) {
        const authInstance = (window as any).gapi.auth2.getAuthInstance();
        await authInstance.signIn({
          scope: 'https://www.googleapis.com/auth/calendar'
        });
        setIsAuthenticated(true);
        loadCalendarEvents();
      }
    } catch (error) {
      console.error('Error signing in to Google:', error);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would fetch from our medical calendar API
      // For now, we start with an empty array to show the empty state
      const events: MedicalEvent[] = [];
      
      setEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvent = async () => {
    try {
      if (!newEvent.title || !newEvent.date || !newEvent.time) {
        alert('Please fill in all required fields');
        return;
      }

      const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const endDateTime = new Date(startDateTime.getTime() + newEvent.duration * 60 * 1000);

      // Check for conflicts
      const conflicts = detectConflicts({ startDateTime, endDateTime });
      if (conflicts.length > 0) {
        const proceed = confirm(`Warning: This appointment conflicts with existing events:\n\n${conflicts.join('\n')}\n\nDo you want to schedule it anyway?`);
        if (!proceed) return;
      }

      const event: MedicalEvent = {
        id: Date.now().toString(),
        patientId,
        title: newEvent.title,
        description: newEvent.description,
        eventType: newEvent.eventType,
        priority: newEvent.priority,
        status: newEvent.status,
        startDateTime,
        endDateTime,
        duration: newEvent.duration,
        isAllDay: newEvent.isAllDay,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: newEvent.location,
        address: newEvent.address,
        facilityId: newEvent.facilityId,
        facilityName: newEvent.facilityName,
        room: newEvent.room,
        providerId: newEvent.providerId,
        providerName: newEvent.providerName,
        providerSpecialty: newEvent.providerSpecialty,
        providerPhone: newEvent.providerPhone,
        providerEmail: newEvent.providerEmail,
        medicalConditions: newEvent.medicalConditions,
        medications: newEvent.medications,
        allergies: newEvent.allergies,
        specialInstructions: newEvent.specialInstructions,
        preparationInstructions: newEvent.preparationInstructions,
        requiresTransportation: newEvent.requiresTransportation,
        responsiblePersonId: newEvent.responsiblePersonId,
        responsiblePersonName: newEvent.responsiblePersonName,
        responsibilityStatus: 'unassigned',
        transportationNotes: newEvent.transportationNotes,
        accompanimentRequired: newEvent.accompanimentRequired,
        isRecurring: newEvent.isRecurring,
        reminders: [],
        insuranceRequired: newEvent.insuranceRequired,
        copayAmount: newEvent.copayAmount,
        preAuthRequired: newEvent.preAuthRequired,
        preAuthNumber: newEvent.preAuthNumber,
        notes: newEvent.notes,
        tags: newEvent.tags,
        createdBy: patientId, // In real app, this would be the current user ID
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      // In a real implementation, this would create the event via our medical calendar API
      setEvents(prev => [...prev, event]);
      
      // Reset form
      setNewEvent({
        title: '',
        description: '',
        eventType: 'appointment',
        priority: 'medium',
        status: 'scheduled',
        date: '',
        time: '',
        duration: 60,
        isAllDay: false,
        location: '',
        address: '',
        facilityId: '',
        facilityName: '',
        room: '',
        providerId: '',
        providerName: '',
        providerSpecialty: '',
        providerPhone: '',
        providerEmail: '',
        medicalConditions: [],
        medications: [],
        allergies: [],
        specialInstructions: '',
        preparationInstructions: '',
        requiresTransportation: false,
        responsiblePersonId: '',
        responsiblePersonName: '',
        transportationNotes: '',
        accompanimentRequired: false,
        isRecurring: false,
        insuranceRequired: false,
        copayAmount: 0,
        preAuthRequired: false,
        preAuthNumber: '',
        notes: '',
        tags: []
      });
      setShowAddEvent(false);
      
      console.log('Medical event added:', event);
    } catch (error) {
      console.error('Error adding medical event:', error);
    }
  };

  const handleEditEvent = (event: MedicalEvent) => {
    // Populate the form with existing event data
    setNewEvent({
      title: event.title,
      description: event.description || '',
      eventType: event.eventType,
      priority: event.priority,
      status: event.status,
      date: event.startDateTime.toISOString().split('T')[0],
      time: event.startDateTime.toTimeString().slice(0, 5),
      duration: event.duration,
      isAllDay: event.isAllDay,
      location: event.location || '',
      address: event.address || '',
      facilityId: event.facilityId || '',
      facilityName: event.facilityName || '',
      room: event.room || '',
      providerId: event.providerId || '',
      providerName: event.providerName || '',
      providerSpecialty: event.providerSpecialty || '',
      providerPhone: event.providerPhone || '',
      providerEmail: event.providerEmail || '',
      medicalConditions: event.medicalConditions || [],
      medications: event.medications || [],
      allergies: event.allergies || [],
      specialInstructions: event.specialInstructions || '',
      preparationInstructions: event.preparationInstructions || '',
      requiresTransportation: event.requiresTransportation || false,
      responsiblePersonId: event.responsiblePersonId || '',
      responsiblePersonName: event.responsiblePersonName || '',
      transportationNotes: event.transportationNotes || '',
      accompanimentRequired: event.accompanimentRequired || false,
      isRecurring: event.isRecurring || false,
      insuranceRequired: event.insuranceRequired || false,
      copayAmount: event.copayAmount || 0,
      preAuthRequired: event.preAuthRequired || false,
      preAuthNumber: event.preAuthNumber || '',
      notes: event.notes || '',
      tags: event.tags || []
    });
    setEditingEvent(event);
    setShowAddEvent(true);
  };

  const handleUpdateEvent = async () => {
    try {
      if (!editingEvent || !newEvent.title || !newEvent.date || !newEvent.time) {
        alert('Please fill in all required fields');
        return;
      }

      const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const endDateTime = new Date(startDateTime.getTime() + newEvent.duration * 60 * 1000);

      // Check for conflicts (excluding the current event being edited)
      const conflicts = detectConflicts({ id: editingEvent.id, startDateTime, endDateTime });
      if (conflicts.length > 0) {
        const proceed = confirm(`Warning: This appointment conflicts with existing events:\n\n${conflicts.join('\n')}\n\nDo you want to update it anyway?`);
        if (!proceed) return;
      }

      const updatedEvent: MedicalEvent = {
        ...editingEvent,
        title: newEvent.title,
        description: newEvent.description,
        eventType: newEvent.eventType,
        priority: newEvent.priority,
        status: newEvent.status,
        startDateTime,
        endDateTime,
        duration: newEvent.duration,
        isAllDay: newEvent.isAllDay,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: newEvent.location,
        address: newEvent.address,
        facilityId: newEvent.facilityId,
        facilityName: newEvent.facilityName,
        room: newEvent.room,
        providerId: newEvent.providerId,
        providerName: newEvent.providerName,
        providerSpecialty: newEvent.providerSpecialty,
        providerPhone: newEvent.providerPhone,
        providerEmail: newEvent.providerEmail,
        medicalConditions: newEvent.medicalConditions,
        medications: newEvent.medications,
        allergies: newEvent.allergies,
        specialInstructions: newEvent.specialInstructions,
        preparationInstructions: newEvent.preparationInstructions,
        requiresTransportation: newEvent.requiresTransportation,
        responsiblePersonId: newEvent.responsiblePersonId,
        responsiblePersonName: newEvent.responsiblePersonName,
        transportationNotes: newEvent.transportationNotes,
        accompanimentRequired: newEvent.accompanimentRequired,
        isRecurring: newEvent.isRecurring,
        insuranceRequired: newEvent.insuranceRequired,
        copayAmount: newEvent.copayAmount,
        preAuthRequired: newEvent.preAuthRequired,
        preAuthNumber: newEvent.preAuthNumber,
        notes: newEvent.notes,
        tags: newEvent.tags,
        updatedAt: new Date(),
        version: editingEvent.version + 1
      };

      // Update the event in the list
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? updatedEvent : e));
      
      // Reset form and editing state
      setNewEvent({
        title: '',
        description: '',
        eventType: 'appointment',
        priority: 'medium',
        status: 'scheduled',
        date: '',
        time: '',
        duration: 60,
        isAllDay: false,
        location: '',
        address: '',
        facilityId: '',
        facilityName: '',
        room: '',
        providerId: '',
        providerName: '',
        providerSpecialty: '',
        providerPhone: '',
        providerEmail: '',
        medicalConditions: [],
        medications: [],
        allergies: [],
        specialInstructions: '',
        preparationInstructions: '',
        requiresTransportation: false,
        responsiblePersonId: '',
        responsiblePersonName: '',
        transportationNotes: '',
        accompanimentRequired: false,
        isRecurring: false,
        insuranceRequired: false,
        copayAmount: 0,
        preAuthRequired: false,
        preAuthNumber: '',
        notes: '',
        tags: []
      });
      setEditingEvent(null);
      setShowAddEvent(false);
      
      console.log('Medical event updated:', updatedEvent);
    } catch (error) {
      console.error('Error updating medical event:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setShowAddEvent(false);
    // Reset form
    setNewEvent({
      title: '',
      description: '',
      eventType: 'appointment',
      priority: 'medium',
      status: 'scheduled',
      date: '',
      time: '',
      duration: 60,
      isAllDay: false,
      location: '',
      address: '',
      facilityId: '',
      facilityName: '',
      room: '',
      providerId: '',
      providerName: '',
      providerSpecialty: '',
      providerPhone: '',
      providerEmail: '',
      medicalConditions: [],
      medications: [],
      allergies: [],
      specialInstructions: '',
      preparationInstructions: '',
      requiresTransportation: false,
      responsiblePersonId: '',
      responsiblePersonName: '',
      transportationNotes: '',
      accompanimentRequired: false,
      isRecurring: false,
      insuranceRequired: false,
      copayAmount: 0,
      preAuthRequired: false,
      preAuthNumber: '',
      notes: '',
      tags: []
    });
  };

  const formatEventTime = (startDateTime: Date, endDateTime: Date) => {
    const startTime = startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  const formatEventDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEventTypeIcon = (eventType: MedicalEventType) => {
    switch (eventType) {
      case 'appointment':
      case 'consultation':
        return <Stethoscope className="w-4 h-4" />;
      case 'surgery':
      case 'procedure':
        return <AlertCircle className="w-4 h-4" />;
      case 'lab_test':
      case 'imaging':
        return <CheckCircle className="w-4 h-4" />;
      case 'medication_reminder':
      case 'medication_refill':
        return <Clock className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getEventTypeColor = (eventType: MedicalEventType) => {
    switch (eventType) {
      case 'appointment':
      case 'consultation':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'surgery':
      case 'procedure':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'lab_test':
      case 'imaging':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medication_reminder':
      case 'medication_refill':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'emergency_visit':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: MedicalEventPriority) => {
    switch (priority) {
      case 'emergency':
        return 'bg-red-500';
      case 'urgent':
        return 'bg-orange-500';
      case 'high':
        return 'bg-yellow-500';
      case 'medium':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleProviderSelect = (provider: GooglePlaceResult, specialty: string) => {
    setNewEvent(prev => ({
      ...prev,
      providerId: provider.place_id,
      providerName: provider.name,
      providerSpecialty: specialty,
      providerPhone: provider.formatted_phone_number || '',
      providerEmail: '',
      location: provider.formatted_address,
      address: provider.formatted_address
    }));
    setShowProviderSearch(false);
  };

  // Event status management functions
  const updateEventStatus = async (eventId: string, newStatus: MedicalEventStatus) => {
    try {
      setEvents(prev => prev.map(event =>
        event.id === eventId
          ? { ...event, status: newStatus, updatedAt: new Date(), version: event.version + 1 }
          : event
      ));
      
      // In a real implementation, this would call the API
      console.log(`Event ${eventId} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  const confirmAppointment = async (eventId: string) => {
    await updateEventStatus(eventId, 'confirmed');
  };

  const cancelAppointment = async (eventId: string) => {
    const proceed = confirm('Are you sure you want to cancel this appointment?');
    if (proceed) {
      await updateEventStatus(eventId, 'cancelled');
    }
  };

  const markAsCompleted = async (eventId: string) => {
    await updateEventStatus(eventId, 'completed');
  };

  // Handle template usage
  const handleUseTemplate = (template: any) => {
    setNewEvent({
      title: template.name,
      description: template.description,
      eventType: template.eventType,
      priority: template.priority,
      status: 'scheduled',
      date: '',
      time: '',
      duration: template.duration,
      isAllDay: false,
      location: template.location || '',
      address: template.location || '',
      facilityId: template.facilityId || '',
      facilityName: template.facilityName || '',
      room: '',
      providerId: template.providerId || '',
      providerName: template.providerName || '',
      providerSpecialty: '',
      providerPhone: '',
      providerEmail: '',
      medicalConditions: [],
      medications: [],
      allergies: [],
      specialInstructions: template.specialInstructions || '',
      preparationInstructions: template.preparationInstructions || '',
      requiresTransportation: template.requiresTransportation,
      responsiblePersonId: '',
      responsiblePersonName: '',
      transportationNotes: '',
      accompanimentRequired: false,
      isRecurring: false,
      insuranceRequired: template.insuranceRequired,
      copayAmount: template.copayAmount || 0,
      preAuthRequired: template.preAuthRequired,
      preAuthNumber: '',
      notes: '',
      tags: template.tags || []
    });
    setShowAddEvent(true);
  };

  // Export calendar data
  const exportCalendar = (format: 'csv' | 'ics' | 'pdf') => {
    const eventsToExport = filteredAndSearchedEvents;
    
    if (format === 'csv') {
      const csvContent = [
        'Title,Date,Time,Duration,Type,Priority,Status,Provider,Location,Description',
        ...eventsToExport.map(event => [
          event.title,
          event.startDateTime.toLocaleDateString(),
          formatEventTime(event.startDateTime, event.endDateTime),
          `${event.duration} minutes`,
          event.eventType.replace(/_/g, ' '),
          event.priority,
          event.status,
          event.providerName || '',
          event.location || '',
          event.description || ''
        ].map(field => `"${field}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical-calendar-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    // ICS and PDF export would be implemented here
    console.log(`Exporting calendar as ${format}`);
  };

  // Filter events based on selected types
  const filteredEvents = filteredAndSearchedEvents;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Medical Calendar</span>
        </h3>
        
        <div className="flex items-center space-x-3">
          {/* Notification System */}
          <NotificationSystem events={events} patientId={patientId} />
          
          <button
            onClick={() => setShowResponsibilityDashboard(true)}
            className="btn-secondary flex items-center space-x-2 relative"
          >
            <Car className="w-4 h-4" />
            <span className="hidden sm:inline">Family Help</span>
            {/* Notification badge for unassigned responsibilities */}
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              2
            </span>
          </button>
          
          <button
            onClick={() => setShowFamilyControls(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Family Access</span>
          </button>
          
          {!isAuthenticated ? (
            <button
              onClick={handleGoogleSignIn}
              className="btn-secondary text-sm"
            >
              <span className="hidden sm:inline">Connect Google Calendar</span>
              <span className="sm:hidden">Connect</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddEvent(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Medical Event</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Navigation and Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col space-y-4">
          {/* Top Row: Navigation and View Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Calendar Navigation */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateCalendar('prev')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                  {getViewTitle()}
                </h2>
                <button
                  onClick={() => navigateCalendar('next')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              >
                Today
              </button>
            </div>

            {/* View Controls and Actions */}
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-md transition-colors ${
                  showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>

              {/* Templates */}
              <button
                onClick={() => setShowTemplates(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Appointment Templates"
              >
                <FileText className="w-5 h-5" />
              </button>

              {/* Analytics */}
              <button
                onClick={() => setShowAnalytics(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="View Analytics"
              >
                <BarChart3 className="w-5 h-5" />
              </button>

              {/* Export */}
              <button
                onClick={() => exportCalendar('csv')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Export Calendar"
              >
                <Download className="w-5 h-5" />
              </button>

              {/* View Selector */}
              <div className="flex rounded-md border border-gray-200">
                {(['month', 'week', 'day', 'list'] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => setSelectedView(view)}
                    className={`px-3 py-2 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                      selectedView === view
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filters Row (Collapsible) */}
          {showFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex flex-col space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Types</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedEventTypes(MEDICAL_EVENT_TYPES_ARRAY.slice())}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedEventTypes.length === MEDICAL_EVENT_TYPES_ARRAY.length
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {MEDICAL_EVENT_TYPES_ARRAY.slice(0, 8).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          if (selectedEventTypes.includes(type)) {
                            setSelectedEventTypes(prev => prev.filter(t => t !== type));
                          } else {
                            setSelectedEventTypes(prev => [...prev, type]);
                          }
                        }}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedEventTypes.includes(type)
                            ? getEventTypeColor(type)
                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {getEventTypeIcon(type)}
                        <span className="ml-1">{type.replace(/_/g, ' ')}</span>
                      </button>
                    ))}
                    {MEDICAL_EVENT_TYPES_ARRAY.length > 8 && (
                      <button className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200">
                        +{MEDICAL_EVENT_TYPES_ARRAY.length - 8} more
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Views */}
      {selectedView !== 'list' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {selectedView === 'month' && (
            <div className="p-4">
              {/* Month View */}
              <div className="grid grid-cols-7 gap-px bg-gray-200">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
                    {day}
                  </div>
                ))}
                
                {/* Calendar Days */}
                {getCalendarDays(currentDate, 'month').map((date, index) => {
                  const dayEvents = getEventsForDay(date);
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={index}
                      className={`bg-white p-2 min-h-[100px] border-r border-b border-gray-200 ${
                        !isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''
                      } ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${getEventTypeColor(event.eventType)}`}
                            onClick={() => handleEditEvent(event)}
                            title={`${event.title} - ${formatEventTime(event.startDateTime, event.endDateTime)}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedView === 'week' && (
            <div className="p-4">
              {/* Week View */}
              <div className="grid grid-cols-8 gap-px bg-gray-200">
                {/* Time Column Header */}
                <div className="bg-gray-50 p-2"></div>
                
                {/* Day Headers */}
                {getCalendarDays(currentDate, 'week').map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div key={index} className={`bg-gray-50 p-2 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className="text-sm font-medium text-gray-700">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
                
                {/* Time Slots */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <React.Fragment key={hour}>
                    {/* Time Label */}
                    <div className="bg-white p-2 text-right text-sm text-gray-500 border-r border-b border-gray-200">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                    
                    {/* Day Columns */}
                    {getCalendarDays(currentDate, 'week').map((date, dayIndex) => {
                      const dayEvents = getEventsForDay(date).filter(event => {
                        const eventHour = new Date(event.startDateTime).getHours();
                        return eventHour === hour;
                      });
                      
                      return (
                        <div key={dayIndex} className="bg-white p-1 min-h-[60px] border-r border-b border-gray-200 relative">
                          {dayEvents.map(event => (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded mb-1 cursor-pointer hover:opacity-80 ${getEventTypeColor(event.eventType)}`}
                              onClick={() => handleEditEvent(event)}
                              title={`${event.title} - ${formatEventTime(event.startDateTime, event.endDateTime)}`}
                            >
                              <div className="font-medium truncate">{event.title}</div>
                              <div className="truncate">{formatEventTime(event.startDateTime, event.endDateTime)}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {selectedView === 'day' && (
            <div className="p-4">
              {/* Day View */}
              <div className="grid grid-cols-2 gap-px bg-gray-200">
                {/* Time Column */}
                <div className="bg-gray-50 p-2 text-center font-medium text-gray-700">
                  Time
                </div>
                <div className="bg-gray-50 p-2 text-center font-medium text-gray-700">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                
                {/* Time Slots */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <React.Fragment key={hour}>
                    <div className="bg-white p-2 text-right text-sm text-gray-500 border-r border-b border-gray-200">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                    <div className="bg-white p-2 min-h-[60px] border-r border-b border-gray-200">
                      {getEventsForDay(currentDate)
                        .filter(event => new Date(event.startDateTime).getHours() === hour)
                        .map(event => (
                          <div
                            key={event.id}
                            className={`text-sm p-2 rounded mb-2 cursor-pointer hover:opacity-80 ${getEventTypeColor(event.eventType)}`}
                            onClick={() => handleEditEvent(event)}
                          >
                            <div className="font-medium">{event.title}</div>
                            <div className="text-xs">{formatEventTime(event.startDateTime, event.endDateTime)}</div>
                            {event.providerName && (
                              <div className="text-xs mt-1">{event.providerName}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Event Form */}
      {showAddEvent && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">
              {editingEvent ? 'Edit Medical Event' : 'Schedule New Appointment'}
            </h4>
            <button
              onClick={editingEvent ? handleCancelEdit : () => setShowAddEvent(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Appointment Title *</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="e.g., Dr. Smith - Annual Checkup"
              />
            </div>

            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                className="input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="label">Time *</label>
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                className="input"
              />
            </div>

            <div>
              <label className="label">Duration (minutes)</label>
              <select
                value={newEvent.duration}
                onChange={(e) => setNewEvent(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                className="input"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div>
              <label className="label">Event Type</label>
              <select
                value={newEvent.eventType}
                onChange={(e) => setNewEvent(prev => ({ ...prev, eventType: e.target.value as MedicalEventType }))}
                className="input"
              >
                {MEDICAL_EVENT_TYPES_ARRAY.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Priority</label>
              <select
                value={newEvent.priority}
                onChange={(e) => setNewEvent(prev => ({ ...prev, priority: e.target.value as MedicalEventPriority }))}
                className="input"
              >
                {MEDICAL_EVENT_PRIORITIES_ARRAY.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Healthcare Provider</label>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newEvent.providerName}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, providerName: e.target.value }))}
                    className="input flex-1"
                    placeholder="Dr. Smith, Cardiologist"
                    readOnly={!!newEvent.providerId}
                  />
                  <button
                    type="button"
                    onClick={() => setShowProviderSearch(!showProviderSearch)}
                    className="btn-secondary px-3 py-2 text-sm"
                  >
                    {showProviderSearch ? 'Cancel' : 'Search'}
                  </button>
                </div>
                
                {newEvent.providerId && (
                  <div className="text-sm text-gray-600 space-y-1">
                    {newEvent.providerSpecialty && (
                      <div>Specialty: {newEvent.providerSpecialty}</div>
                    )}
                    {newEvent.providerPhone && (
                      <div>Phone: {newEvent.providerPhone}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => setNewEvent(prev => ({
                        ...prev,
                        providerId: '',
                        providerName: '',
                        providerSpecialty: '',
                        providerPhone: '',
                        providerEmail: ''
                      }))}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Clear Provider
                    </button>
                  </div>
                )}
                
                {showProviderSearch && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <HealthcareProviderSearch
                      onSelect={handleProviderSelect}
                      searchType="doctor"
                      placeholder="Search for healthcare providers..."
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="label">Medical Facility</label>
              <div className="space-y-2">
                <select
                  value={newEvent.facilityId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    // In a real app, this would fetch facility details from the ID
                    const facilityData = {
                      'facility1': { name: 'City General Hospital', address: '123 Main St, City, State 12345' },
                      'facility2': { name: 'Regional Medical Center', address: '456 Health Ave, City, State 12345' },
                      'facility3': { name: 'Specialty Care Clinic', address: '789 Care Blvd, City, State 12345' },
                      'facility4': { name: 'Emergency Care Center', address: '321 Emergency Dr, City, State 12345' }
                    };
                    
                    const facility = facilityData[selectedId as keyof typeof facilityData];
                    setNewEvent(prev => ({
                      ...prev,
                      facilityId: selectedId,
                      facilityName: facility?.name || '',
                      // Only update location if not already set by provider
                      location: prev.providerId ? prev.location : (facility?.address || ''),
                      address: prev.providerId ? prev.address : (facility?.address || '')
                    }));
                  }}
                  className="input"
                >
                  <option value="">Select facility (optional)</option>
                  <option value="facility1">City General Hospital</option>
                  <option value="facility2">Regional Medical Center</option>
                  <option value="facility3">Specialty Care Clinic</option>
                  <option value="facility4">Emergency Care Center</option>
                </select>
                
                {newEvent.facilityId && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Facility: {newEvent.facilityName}</div>
                    <button
                      type="button"
                      onClick={() => setNewEvent(prev => ({
                        ...prev,
                        facilityId: '',
                        facilityName: '',
                        // Only clear location if it wasn't set by provider
                        location: prev.providerId ? prev.location : '',
                        address: prev.providerId ? prev.address : ''
                      }))}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Clear Facility
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="label">Room/Department</label>
              <input
                type="text"
                value={newEvent.room}
                onChange={(e) => setNewEvent(prev => ({ ...prev, room: e.target.value }))}
                className="input"
                placeholder="e.g., Room 205, Cardiology Dept"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Location</label>
              <input
                type="text"
                value={newEvent.location}
                onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                className="input"
                placeholder="123 Medical Center Dr, City, State"
                readOnly={!!(newEvent.providerId || newEvent.facilityId)}
              />
              {(newEvent.providerId || newEvent.facilityId) && (
                <p className="text-xs text-gray-500 mt-1">
                  Location auto-filled from selected {newEvent.providerId ? 'provider' : 'facility'}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label">Special Instructions</label>
              <textarea
                value={newEvent.specialInstructions}
                onChange={(e) => setNewEvent(prev => ({ ...prev, specialInstructions: e.target.value }))}
                className="input"
                rows={2}
                placeholder="Special instructions for this appointment"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Preparation Instructions</label>
              <textarea
                value={newEvent.preparationInstructions}
                onChange={(e) => setNewEvent(prev => ({ ...prev, preparationInstructions: e.target.value }))}
                className="input"
                rows={2}
                placeholder="How to prepare for this appointment (e.g., fasting, bring documents)"
              />
            </div>

            {/* Transportation Section */}
            <div className="md:col-span-2 border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Transportation & Family Coordination</h5>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requiresTransportation"
                    checked={newEvent.requiresTransportation}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, requiresTransportation: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="requiresTransportation" className="text-sm text-gray-700">
                    Transportation assistance needed
                  </label>
                </div>

                {newEvent.requiresTransportation && (
                  <div className="ml-6 space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="accompanimentRequired"
                        checked={newEvent.accompanimentRequired}
                        onChange={(e) => setNewEvent(prev => ({ ...prev, accompanimentRequired: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="accompanimentRequired" className="text-sm text-gray-700">
                        Someone needs to stay during the appointment
                      </label>
                    </div>

                    <div>
                      <label className="label text-sm">Transportation Notes</label>
                      <textarea
                        value={newEvent.transportationNotes}
                        onChange={(e) => setNewEvent(prev => ({ ...prev, transportationNotes: e.target.value }))}
                        className="input"
                        rows={2}
                        placeholder="Special transportation requirements or instructions"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Insurance Section */}
            <div className="md:col-span-2 border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Insurance & Financial</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="insuranceRequired"
                    checked={newEvent.insuranceRequired}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, insuranceRequired: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="insuranceRequired" className="text-sm text-gray-700">
                    Insurance verification required
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="preAuthRequired"
                    checked={newEvent.preAuthRequired}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, preAuthRequired: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="preAuthRequired" className="text-sm text-gray-700">
                    Pre-authorization required
                  </label>
                </div>

                <div>
                  <label className="label text-sm">Estimated Copay ($)</label>
                  <input
                    type="number"
                    value={newEvent.copayAmount}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, copayAmount: parseFloat(e.target.value) || 0 }))}
                    className="input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {newEvent.preAuthRequired && (
                  <div>
                    <label className="label text-sm">Pre-authorization Number</label>
                    <input
                      type="text"
                      value={newEvent.preAuthNumber}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, preAuthNumber: e.target.value }))}
                      className="input"
                      placeholder="Enter pre-auth number"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Family Responsibility Assignment */}
            <div className="md:col-span-2 border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Family Coordination</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-sm">Responsible Family Member</label>
                  <select
                    value={newEvent.responsiblePersonId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      // In a real app, this would fetch the family member's name from the ID
                      const selectedName = selectedId === 'family1' ? 'Sarah Johnson' :
                                         selectedId === 'family2' ? 'Mike Johnson' :
                                         selectedId === 'family3' ? 'Emma Johnson' : '';
                      setNewEvent(prev => ({
                        ...prev,
                        responsiblePersonId: selectedId,
                        responsiblePersonName: selectedName
                      }));
                    }}
                    className="input"
                  >
                    <option value="">Select family member (optional)</option>
                    <option value="family1">Sarah Johnson (Spouse)</option>
                    <option value="family2">Mike Johnson (Son)</option>
                    <option value="family3">Emma Johnson (Daughter)</option>
                  </select>
                  {newEvent.responsiblePersonId && (
                    <p className="text-xs text-gray-500 mt-1">
                      This person will receive notifications and reminders
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={newEvent.isRecurring}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isRecurring" className="text-sm text-gray-700">
                    Recurring appointment
                  </label>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">Additional Notes</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                rows={3}
                placeholder="Additional notes about the appointment"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={editingEvent ? handleCancelEdit : () => setShowAddEvent(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={editingEvent ? handleUpdateEvent : handleAddEvent}
              className="btn-primary"
            >
              {editingEvent ? 'Update Event' : 'Schedule Appointment'}
            </button>
          </div>
        </div>
      )}

      {/* Events List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">{event.title}</h4>
                  
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.eventType)}`}>
                      {getEventTypeIcon(event.eventType)}
                      <span className="ml-1">{event.eventType.replace(/_/g, ' ')}</span>
                    </span>
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(event.priority)}`} title={`Priority: ${event.priority}`}></div>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatEventDate(event.startDateTime)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatEventTime(event.startDateTime, event.endDateTime)}</span>
                    </div>
                    
                    {event.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {event.providerName && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{event.providerName}</span>
                        {event.providerSpecialty && <span className="text-gray-400">({event.providerSpecialty})</span>}
                      </div>
                    )}

                    {event.requiresTransportation && (
                      <div className="flex items-center space-x-2">
                        <Car className="w-4 h-4" />
                        <span className="text-orange-600">Transportation needed</span>
                        {event.responsiblePersonName && (
                          <span className="text-green-600">- {event.responsiblePersonName}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditEvent(event)}
                    className="text-blue-600 hover:text-blue-700 p-1"
                    title="Edit event"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button className="text-gray-400 hover:text-gray-600 p-1" title="More options">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            {events.length === 0 ? 'No medical events scheduled' : 'No events match your filters'}
          </h4>
          <p className="text-gray-500 mb-4">
            {events.length === 0
              ? 'Schedule your first medical event to get started.'
              : 'Try adjusting your filters to see more events.'
            }
          </p>
          {isAuthenticated && (
            <button
              onClick={() => setShowAddEvent(true)}
              className="btn-primary flex items-center space-x-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Medical Event</span>
            </button>
          )}
        </div>
      )}

      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Connect Google Calendar</h4>
              <p className="text-sm text-blue-700 mt-1">
                Connect your Google Calendar to sync appointments and get reminders across all your devices.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="mt-3 text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Connect Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Access Controls Modal */}
      {showFamilyControls && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <FamilyAccessControls
                patientId={patientId}
                onClose={() => setShowFamilyControls(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Family Responsibility Dashboard Modal */}
      {showResponsibilityDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <FamilyResponsibilityDashboard
                patientId={patientId}
                currentUserId="user1" // In real app, this would be the current user's ID
                onClose={() => setShowResponsibilityDashboard(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Calendar Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <CalendarAnalytics
                events={events}
                patientId={patientId}
                onClose={() => setShowAnalytics(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Appointment Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <AppointmentTemplates
                patientId={patientId}
                onUseTemplate={handleUseTemplate}
                onClose={() => setShowTemplates(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}