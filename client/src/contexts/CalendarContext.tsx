import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useFamily } from './FamilyContext';
import type {
  UnifiedCalendarEvent,
  CalendarContextState,
  CalendarContextActions,
  DeleteMedicalEventRequest,
  DeleteMedicalEventResponse,
  MedicalEvent,
  MedicationCalendarEvent
} from '@shared/types';
import { getUnifiedCalendarEvents, deleteMedicalEvent } from '@/lib/calendarApi';

interface CalendarContextValue extends CalendarContextState, CalendarContextActions {}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const { getEffectivePatientId } = useFamily();
  
  const [state, setState] = useState<CalendarContextState>({
    events: [],
    loading: false,
    error: null,
    lastUpdated: null
  });

  /**
   * Fetch unified calendar events from both medical_events and medication_calendar_events
   */
  const fetchEvents = useCallback(async (
    patientId: string,
    startDate?: Date,
    endDate?: Date
  ) => {
    if (!patientId) {
      console.warn('CalendarContext: No patient ID provided');
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('📅 CalendarContext: Fetching unified events for patient:', patientId);
      
      const response = await getUnifiedCalendarEvents(patientId, startDate, endDate);
      
      if (response.success && response.data) {
        setState({
          events: response.data,
          loading: false,
          error: null,
          lastUpdated: new Date()
        });
        
        console.log('✅ CalendarContext: Loaded', response.data.length, 'unified events');
      } else {
        throw new Error(response.error || 'Failed to fetch calendar events');
      }
    } catch (error) {
      console.error('❌ CalendarContext: Error fetching events:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch calendar events'
      }));
    }
  }, []);

  /**
   * Delete a medical event with optimistic updates
   */
  const deleteEvent = useCallback(async (
    request: DeleteMedicalEventRequest
  ): Promise<DeleteMedicalEventResponse> => {
    console.log('🗑️ CalendarContext: Deleting event:', request);

    // Optimistic update - remove event from UI immediately
    const eventToDelete = state.events.find(e => e.id === request.eventId);
    if (eventToDelete) {
      setState(prev => ({
        ...prev,
        events: prev.events.filter(e => e.id !== request.eventId)
      }));
    }

    try {
      const response = await deleteMedicalEvent(request);
      
      if (response.success) {
        console.log('✅ CalendarContext: Event deleted successfully');
        
        // Refresh events to get updated state
        await refreshEvents();
        
        return response;
      } else {
        // Rollback optimistic update on failure
        if (eventToDelete) {
          setState(prev => ({
            ...prev,
            events: [...prev.events, eventToDelete].sort(
              (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
            )
          }));
        }
        
        throw new Error(response.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('❌ CalendarContext: Error deleting event:', error);
      
      // Rollback optimistic update on error
      if (eventToDelete) {
        setState(prev => ({
          ...prev,
          events: [...prev.events, eventToDelete].sort(
            (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
          )
        }));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete event';
      setState(prev => ({ ...prev, error: errorMessage }));
      
      return {
        success: false,
        deletedCount: 0,
        affectedEventIds: [],
        error: errorMessage
      };
    }
  }, [state.events]);

  /**
   * Refresh events for current patient
   */
  const refreshEvents = useCallback(async () => {
    const patientId = getEffectivePatientId();
    if (patientId) {
      await fetchEvents(patientId);
    }
  }, [fetchEvents, getEffectivePatientId]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Auto-fetch events when patient changes
   */
  useEffect(() => {
    const patientId = getEffectivePatientId();
    if (firebaseUser && patientId) {
      console.log('📅 CalendarContext: Patient changed, fetching events for:', patientId);
      fetchEvents(patientId);
    }
  }, [firebaseUser, getEffectivePatientId, fetchEvents]);

  const value: CalendarContextValue = {
    ...state,
    fetchEvents,
    deleteEvent,
    refreshEvents,
    clearError
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

/**
 * Hook to use calendar context
 */
export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
}