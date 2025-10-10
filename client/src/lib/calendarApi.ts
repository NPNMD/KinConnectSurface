import { apiClient, API_ENDPOINTS } from './api';
import type {
  UnifiedCalendarEvent,
  DeleteMedicalEventRequest,
  DeleteMedicalEventResponse,
  MedicalEvent,
  MedicationCalendarEvent,
  ApiResponse
} from '@shared/types';

/**
 * Transform medical event to unified calendar event
 */
function transformMedicalEvent(event: MedicalEvent): UnifiedCalendarEvent {
  // DEBUG: Log transformation input
  console.log('🔍 DEBUG: Transforming medical event:', {
    id: event.id,
    startDateTime: event.startDateTime,
    startDateTimeType: typeof event.startDateTime,
    isDate: event.startDateTime instanceof Date
  });
  
  // Robust date conversion helper
  const ensureDate = (value: any, fieldName: string): Date => {
    console.log(`🔍 DEBUG: Converting ${fieldName}:`, {
      value,
      type: typeof value,
      isDate: value instanceof Date,
      hasToDate: typeof value?.toDate === 'function'
    });
    
    if (!value) {
      console.warn(`⚠️ ${fieldName} is null/undefined, using current date`);
      return new Date();
    }
    if (value instanceof Date) {
      console.log(`✅ ${fieldName} is already a Date`);
      return value;
    }
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      console.log(`✅ ${fieldName} has toDate() method (Firestore Timestamp)`);
      return value.toDate();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      console.log(`✅ ${fieldName} is string/number, converting with new Date()`);
      return new Date(value);
    }
    
    console.error(`❌ ${fieldName} has unexpected type, using current date as fallback`);
    return new Date();
  };
  
  const transformed = {
    id: event.id,
    type: 'medical' as const,
    patientId: event.patientId,
    title: event.title,
    description: event.description,
    startDateTime: ensureDate(event.startDateTime, 'startDateTime'),
    endDateTime: ensureDate(event.endDateTime, 'endDateTime'),
    isAllDay: event.isAllDay,
    medicalEvent: {
      ...event,
      startDateTime: ensureDate(event.startDateTime, 'startDateTime'),
      endDateTime: ensureDate(event.endDateTime, 'endDateTime'),
      createdAt: ensureDate(event.createdAt, 'createdAt'),
      updatedAt: ensureDate(event.updatedAt, 'updatedAt')
    },
    color: getPriorityColor(event.priority),
    icon: getEventTypeIcon(event.eventType),
    priority: event.priority === 'emergency' ? 'urgent' : event.priority,
    canEdit: true,
    canDelete: true,
    createdAt: ensureDate(event.createdAt, 'createdAt'),
    updatedAt: ensureDate(event.updatedAt, 'updatedAt')
  };
  
  console.log('🔍 DEBUG: Transformed event dates:', {
    id: transformed.id,
    startDateTime: transformed.startDateTime,
    startDateTimeType: typeof transformed.startDateTime,
    isDate: transformed.startDateTime instanceof Date,
    canCallToLocaleTimeString: typeof transformed.startDateTime.toLocaleTimeString === 'function'
  });
  
  return transformed;
}

/**
 * Transform medication event to unified calendar event
 */
function transformMedicationEvent(event: MedicationCalendarEvent): UnifiedCalendarEvent {
  const scheduledDateTime = (event.scheduledDateTime as any)?.toDate?.() || new Date(event.scheduledDateTime);
  
  return {
    id: event.id,
    type: 'medication',
    patientId: event.patientId,
    title: `💊 ${event.medicationName}`,
    description: `${event.dosageAmount}${event.instructions ? ` - ${event.instructions}` : ''}`,
    startDateTime: scheduledDateTime,
    endDateTime: new Date(scheduledDateTime.getTime() + 15 * 60000), // 15 min duration
    isAllDay: false,
    medicationEvent: event,
    color: getMedicationStatusColor(event.status),
    icon: '💊',
    priority: 'medium',
    canEdit: false, // Medication events are read-only in calendar
    canDelete: false, // Medication events cannot be deleted from calendar
    createdAt: (event.createdAt as any)?.toDate?.() || new Date(event.createdAt),
    updatedAt: (event.updatedAt as any)?.toDate?.() || new Date(event.updatedAt)
  };
}

/**
 * Get color based on priority
 */
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
    case 'emergency':
      return '#ef4444'; // red-500
    case 'high':
      return '#f97316'; // orange-500
    case 'medium':
      return '#3b82f6'; // blue-500
    case 'low':
      return '#10b981'; // green-500
    default:
      return '#6b7280'; // gray-500
  }
}

/**
 * Get color based on medication status
 */
function getMedicationStatusColor(status: string): string {
  switch (status) {
    case 'taken':
      return '#10b981'; // green-500
    case 'missed':
      return '#ef4444'; // red-500
    case 'skipped':
      return '#f59e0b'; // amber-500
    case 'late':
      return '#f97316'; // orange-500
    case 'scheduled':
    default:
      return '#3b82f6'; // blue-500
  }
}

/**
 * Get icon based on event type
 */
function getEventTypeIcon(eventType: string): string {
  switch (eventType) {
    case 'appointment':
    case 'consultation':
      return '🩺';
    case 'surgery':
    case 'procedure':
      return '🏥';
    case 'lab_test':
      return '🧪';
    case 'imaging':
      return '📷';
    case 'vaccination':
      return '💉';
    case 'therapy_session':
      return '🧘';
    case 'follow_up':
      return '📋';
    default:
      return '📅';
  }
}

/**
 * Get unified calendar events from both medical and medication sources
 */
export async function getUnifiedCalendarEvents(
  patientId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ApiResponse<UnifiedCalendarEvent[]>> {
  try {
    console.log('📅 Fetching unified calendar events for patient:', patientId);

    // Fetch medical events
    const medicalEventsResponse = await apiClient.get<ApiResponse<MedicalEvent[]>>(
      API_ENDPOINTS.MEDICAL_EVENTS(patientId)
    );

    // Fetch medication calendar events
    const medicationEventsResponse = await apiClient.get<ApiResponse<MedicationCalendarEvent[]>>(
      `/medication-calendar/events?patientId=${patientId}`
    );

    const medicalEvents: MedicalEvent[] = medicalEventsResponse.success && medicalEventsResponse.data
      ? medicalEventsResponse.data
      : [];
    
    const medicationEvents: MedicationCalendarEvent[] = medicationEventsResponse.success && medicationEventsResponse.data
      ? medicationEventsResponse.data
      : [];

    console.log('📅 Fetched', medicalEvents.length, 'medical events and', medicationEvents.length, 'medication events');
    
    // DEBUG: Log the actual data structure of the first medical event
    if (medicalEvents.length > 0) {
      const firstEvent = medicalEvents[0];
      console.log('🔍 DEBUG: First medical event raw data:', {
        id: firstEvent.id,
        startDateTime: firstEvent.startDateTime,
        startDateTimeType: typeof firstEvent.startDateTime,
        startDateTimeConstructor: firstEvent.startDateTime?.constructor?.name,
        isDate: firstEvent.startDateTime instanceof Date,
        hasToDate: typeof (firstEvent.startDateTime as any)?.toDate === 'function',
        rawValue: JSON.stringify(firstEvent.startDateTime)
      });
    }

    // Transform and combine events
    const unifiedEvents: UnifiedCalendarEvent[] = [
      ...medicalEvents.map(transformMedicalEvent),
      ...medicationEvents.map(transformMedicationEvent)
    ];

    // Filter by date range if provided
    let filteredEvents = unifiedEvents;
    if (startDate || endDate) {
      filteredEvents = unifiedEvents.filter(event => {
        const eventDate = event.startDateTime;
        if (startDate && eventDate < startDate) return false;
        if (endDate && eventDate > endDate) return false;
        return true;
      });
    }

    // Sort by start date
    filteredEvents.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());

    console.log('✅ Returning', filteredEvents.length, 'unified calendar events');

    return {
      success: true,
      data: filteredEvents
    };
  } catch (error) {
    console.error('❌ Error fetching unified calendar events:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch calendar events'
    };
  }
}

/**
 * Delete a medical event
 */
export async function deleteMedicalEvent(
  request: DeleteMedicalEventRequest
): Promise<DeleteMedicalEventResponse> {
  try {
    console.log('🗑️ Deleting medical event:', request);

    // Send the request body with DELETE method
    const response = await apiClient.delete<DeleteMedicalEventResponse>(
      API_ENDPOINTS.MEDICAL_EVENT_DELETE(request.eventId),
      {
        scope: request.scope,
        reason: request.reason,
        notifyFamily: request.notifyFamily
      }
    );

    if (response.success) {
      console.log('✅ Medical event deleted successfully');
      return response;
    } else {
      throw new Error(response.error || 'Failed to delete medical event');
    }
  } catch (error) {
    console.error('❌ Error deleting medical event:', error);
    return {
      success: false,
      deletedCount: 0,
      affectedEventIds: [],
      error: error instanceof Error ? error.message : 'Failed to delete medical event'
    };
  }
}