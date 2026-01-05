import { apiClient, API_ENDPOINTS } from './api';
import { unifiedMedicationApi } from './unifiedMedicationApi';
import type {
  UnifiedCalendarEvent,
  DeleteMedicalEventRequest,
  DeleteMedicalEventResponse,
  MedicalEvent,
  ApiResponse
} from '@shared/types';

/**
 * Transform medical event to unified calendar event
 */
function transformMedicalEvent(event: MedicalEvent): UnifiedCalendarEvent {
  // Robust date conversion helper
  const ensureDate = (value: any, fieldName: string): Date => {
    if (!value) {
      return new Date();
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      return value.toDate();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return new Date();
  };
  
  return {
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
}

/**
 * Transform medication event from view API to unified calendar event
 */
function transformMedicationViewEvent(event: any): UnifiedCalendarEvent {
  // Ensure dates are Date objects
  const ensureDate = (val: any) => val instanceof Date ? val : new Date(val);
  
  const scheduledTime = ensureDate(event.scheduledTime);
  
  // Determine status for coloring
  let status = event.status || 'scheduled';
  if (event.actualTime) status = 'taken';
  if (event.minutesLate > 0 && !event.actualTime) status = 'late';
  
  return {
    id: event.eventId,
    type: 'medication',
    patientId: event.patientId || '', // Might need to be passed in or inferred
    title: `💊 ${event.medicationName}`,
    description: `${event.dosageAmount}${event.notes ? ` - ${event.notes}` : ''}`,
    startDateTime: scheduledTime,
    endDateTime: new Date(scheduledTime.getTime() + 15 * 60000), // 15 min duration
    isAllDay: false,
    medicationEvent: {
      id: event.eventId,
      medicationId: event.commandId,
      medicationName: event.medicationName,
      patientId: event.patientId || '',
      scheduledDateTime: scheduledTime,
      actualTakenDateTime: event.actualTime ? ensureDate(event.actualTime) : undefined,
      status: status,
      dosageAmount: event.dosageAmount,
      instructions: event.notes,
      createdAt: new Date(), // Fallback as this might not be in view model
      updatedAt: new Date()
    },
    color: getMedicationStatusColor(status),
    icon: '💊',
    priority: 'medium',
    canEdit: false, // Medication events are read-only in calendar
    canDelete: false, // Medication events cannot be deleted from calendar
    createdAt: new Date(),
    updatedAt: new Date()
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
 * Now uses the Unified Views API for medications
 */
export async function getUnifiedCalendarEvents(
  patientId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ApiResponse<UnifiedCalendarEvent[]>> {
  try {
    console.log('📅 Fetching unified calendar events for patient:', patientId);

    // Fetch medical events (Existing API)
    const medicalEventsPromise = apiClient.get<ApiResponse<MedicalEvent[]>>(
      API_ENDPOINTS.MEDICAL_EVENTS(patientId)
    );

    // Fetch medication events (Unified Views API)
    const params = new URLSearchParams();
    params.append('patientId', patientId);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    params.append('view', 'month'); // Fetch whole month to be safe

    const medicationEventsPromise = apiClient.get<ApiResponse<any>>(
      `${API_ENDPOINTS.UNIFIED_CALENDAR}?${params.toString()}`
    );

    const [medicalResponse, medicationResponse] = await Promise.all([
      medicalEventsPromise,
      medicationEventsPromise
    ]);

    const medicalEvents: MedicalEvent[] = medicalResponse.success && medicalResponse.data
      ? medicalResponse.data
      : [];
    
    // Handle unified view response structure
    // The endpoint returns { eventsByDate: { 'YYYY-MM-DD': [...] } }
    const medicationViewData = medicationResponse.success && medicationResponse.data 
      ? medicationResponse.data 
      : { eventsByDate: {} };
      
    const medicationEvents: any[] = [];
    if (medicationViewData.eventsByDate) {
      Object.values(medicationViewData.eventsByDate).forEach((dayEvents: any) => {
        if (Array.isArray(dayEvents)) {
          medicationEvents.push(...dayEvents);
        }
      });
    }

    console.log('📅 Fetched', medicalEvents.length, 'medical events and', medicationEvents.length, 'medication events');

    // Transform and combine events
    const unifiedEvents: UnifiedCalendarEvent[] = [
      ...medicalEvents.map(transformMedicalEvent),
      ...medicationEvents.map(event => transformMedicationViewEvent({ ...event, patientId }))
    ];

    // Filter by date range if provided (double check, though API should have filtered)
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
