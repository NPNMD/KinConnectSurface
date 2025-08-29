import { getIdToken } from './firebase';

// Always use the production Firebase Functions URL
const API_BASE_URL = 'https://us-central1-claritystream-uldp9.cloudfunctions.net/api';

// Local storage keys for development fallback
const STORAGE_KEYS = {
  HEALTHCARE_PROVIDERS: 'kinconnect_healthcare_providers',
  PATIENT_PROFILE: 'kinconnect_patient_profile',
  MEDICATIONS: 'kinconnect_medications',
  MEDICAL_FACILITIES: 'kinconnect_medical_facilities',
} as const;

// Development fallback data
const createEmptyProvider = () => ({
  id: '',
  name: '',
  specialty: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  patientId: '',
  createdAt: new Date(),
  updatedAt: new Date()
});

// API client class
class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const token = await getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private getLocalStorageData<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setLocalStorageData<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private async requestWithFallback<T>(
    endpoint: string,
    options: RequestInit = {},
    fallbackHandler?: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.request<T>(endpoint, options);
    } catch (error) {
      console.warn(`API request failed for ${endpoint}, attempting fallback:`, error);
      
      if (fallbackHandler) {
        try {
          return await fallbackHandler();
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${endpoint}:`, fallbackError);
          throw error; // Throw original error, not fallback error
        }
      }
      
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await this.getHeaders();

    const config: RequestInit = {
      headers,
      ...options,
    };

    // Add diagnostic logging
    console.log(`🔧 API Request: ${options.method || 'GET'} ${url}`);
    console.log('🔧 Headers:', headers);

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If we can't parse error response, use status-based message
          if (response.status === 401) {
            errorMessage = 'Authentication required';
          } else if (response.status === 403) {
            errorMessage = 'Access denied';
          } else if (response.status === 404) {
            errorMessage = 'Resource not found';
          } else if (response.status >= 500) {
            errorMessage = 'Internal server error';
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ API request failed for ${endpoint}:`, error);
      console.error(`❌ Full URL: ${url}`);
      console.error(`❌ Request config:`, config);
      
      // Add more context to network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error - please check your internet connection');
      }
      
      throw error;
    }
  }

  // GET request with fallback
  async get<T>(endpoint: string): Promise<T> {
    // Special handling for healthcare providers
    if (endpoint.includes('/healthcare/providers/')) {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        const providers = this.getLocalStorageData(STORAGE_KEYS.HEALTHCARE_PROVIDERS, []);
        return { success: true, data: providers } as T;
      });
    }

    // Special handling for patient profile
    if (endpoint === '/patients/profile') {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        const profile = this.getLocalStorageData(STORAGE_KEYS.PATIENT_PROFILE, {
          id: '',
          name: '',
          email: '',
          dateOfBirth: '',
          phone: '',
          address: '',
          emergencyContact: {
            name: '',
            phone: '',
            relationship: ''
          }
        });
        return { success: true, data: profile } as T;
      });
    }

    // Special handling for medications
    if (endpoint === '/medications') {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        const medications = this.getLocalStorageData(STORAGE_KEYS.MEDICATIONS, []);
        return { success: true, data: medications } as T;
      });
    }

    // Special handling for medication calendar events
    if (endpoint.includes('/medication-calendar/events')) {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        console.warn('Medication calendar API unavailable, returning empty events');
        return { success: true, data: [], message: 'Medication calendar temporarily unavailable' } as T;
      });
    }

    // Special handling for medication adherence
    if (endpoint.includes('/medication-calendar/adherence')) {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        console.warn('Medication adherence API unavailable, returning empty data');
        return { success: true, data: [], message: 'Medication adherence data temporarily unavailable' } as T;
      });
    }

    // Special handling for family access
    if (endpoint === '/family-access') {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        console.warn('Family access API unavailable, returning empty data');
        return {
          success: true,
          data: {
            patientsIHaveAccessTo: [],
            familyMembersWithAccessToMe: [],
            totalConnections: 0
          },
          message: 'Family access data temporarily unavailable'
        } as T;
      });
    }

    // Special handling for medical events
    if (endpoint.includes('/medical-events/')) {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        console.warn('Medical events API unavailable, returning empty events');
        return { success: true, data: [], message: 'Medical events temporarily unavailable' } as T;
      });
    }

    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request with fallback
  async post<T>(endpoint: string, data?: any): Promise<T> {
    // Special handling for adding healthcare providers
    if (endpoint === '/healthcare/providers') {
      return this.requestWithFallback<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }, async () => {
        const providers: any[] = this.getLocalStorageData(STORAGE_KEYS.HEALTHCARE_PROVIDERS, []);
        const newProvider = {
          ...createEmptyProvider(),
          ...data,
          id: `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          patientId: 'current_user',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        providers.push(newProvider);
        this.setLocalStorageData(STORAGE_KEYS.HEALTHCARE_PROVIDERS, providers);
        return { success: true, data: newProvider } as T;
      });
    }

    // Special handling for medical events creation
    if (endpoint === '/medical-events') {
      return this.requestWithFallback<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }, async () => {
        console.warn('Medical events creation API unavailable, storing locally');
        // Store in localStorage as fallback
        const events: any[] = this.getLocalStorageData('kinconnect_medical_events', []);
        const newEvent = {
          ...data,
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          _isLocalOnly: true // Flag to indicate this is stored locally
        };
        events.push(newEvent);
        this.setLocalStorageData('kinconnect_medical_events', events);
        return { success: true, data: newEvent, message: 'Event saved locally - will sync when connection is restored' } as T;
      });
    }

    // Special handling for family invitations
    if (endpoint === '/invitations/send') {
      return this.requestWithFallback<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }, async () => {
        console.warn('Family invitation API unavailable');
        throw new Error('Unable to send invitation at this time. Please try again later.');
      });
    }

    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request with fallback
  async put<T>(endpoint: string, data?: any): Promise<T> {
    // Special handling for patient profile updates
    if (endpoint === '/patients/profile') {
      return this.requestWithFallback<T>(endpoint, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      }, async () => {
        const currentProfile = this.getLocalStorageData(STORAGE_KEYS.PATIENT_PROFILE, {});
        const updatedProfile = { ...currentProfile, ...data, updatedAt: new Date() };
        this.setLocalStorageData(STORAGE_KEYS.PATIENT_PROFILE, updatedProfile);
        return { success: true, data: updatedProfile } as T;
      });
    }

    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // PATCH request
  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Create and export API client instance
export const apiClient = new ApiClient();

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_PROFILE: '/auth/profile',
  AUTH_SEARCH_USERS: '/auth/search',
  
  // Patients
  PATIENT_PROFILE: '/patients/profile',
  PATIENT_SEARCH_CONDITION: '/patients/search/condition',
  PATIENT_SEARCH_ALLERGY: '/patients/search/allergy',
  PATIENT_SEARCH_AGE: '/patients/search/age',
  
  // Medications
  MEDICATIONS: '/medications',
  MEDICATION_BY_ID: (id: string) => `/medications/${id}`,
  PATIENT_MEDICATIONS: (patientId: string) => `/patients/${patientId}/medications`,
  MEDICATION_LOGS: '/medication-logs',
  MEDICATION_LOG_BY_ID: (id: string) => `/medication-logs/${id}`,
  PATIENT_MEDICATION_LOGS: (patientId: string) => `/patients/${patientId}/medication-logs`,
  MEDICATION_REMINDERS: '/medication-reminders',
  PATIENT_MEDICATION_REMINDERS: (patientId: string) => `/patients/${patientId}/medication-reminders`,
  
  // Drug search (external API integration)
  DRUG_SEARCH: '/drugs/search',
  DRUG_DETAILS: (rxcui: string) => `/drugs/${rxcui}`,
  DRUG_INTERACTIONS: (rxcui: string) => `/drugs/${rxcui}/interactions`,
  
  // Healthcare Providers
  HEALTHCARE_PROVIDERS: (patientId: string) => `/healthcare/providers/${patientId}`,
  HEALTHCARE_PROVIDER_CREATE: '/healthcare/providers',
  HEALTHCARE_PROVIDER_BY_ID: (id: string) => `/healthcare/providers/${id}`,
  
  // Medical Facilities
  MEDICAL_FACILITIES: (patientId: string) => `/healthcare/facilities/${patientId}`,
  MEDICAL_FACILITY_CREATE: '/healthcare/facilities',
  MEDICAL_FACILITY_BY_ID: (id: string) => `/healthcare/facilities/${id}`,
  
  // Health check
  HEALTH: '/health',
  
  // Medical Events/Calendar
  MEDICAL_EVENTS: (patientId: string) => `/medical-events/${patientId}`,
  MEDICAL_EVENT_CREATE: '/medical-events',
  MEDICAL_EVENT_BY_ID: (eventId: string) => `/medical-events/${eventId}`,
  MEDICAL_EVENT_UPDATE: (eventId: string) => `/medical-events/${eventId}`,
  MEDICAL_EVENT_DELETE: (eventId: string) => `/medical-events/${eventId}`,
  
  // Family Access
  FAMILY_ACCESS: '/family-access',
  REMOVE_FAMILY_MEMBER: '/family-access',
  SEND_INVITATION: '/invitations/send',
  PENDING_INVITATIONS: '/invitations/pending',
  ACCEPT_INVITATION: (token: string) => `/invitations/accept/${token}`,
  DECLINE_INVITATION: (token: string) => `/invitations/decline/${token}`,
} as const;

// Type-safe API response
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};
