import { getIdToken } from './firebase';

// Always use the production Firebase Functions URL
const API_BASE_URL = 'https://claritystream-uldp9.web.app/api';

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

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<T> {
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
  
  // Family Access
  FAMILY_ACCESS: '/family-access',
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
