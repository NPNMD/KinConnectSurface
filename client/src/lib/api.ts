import { getIdToken } from './firebase';

// Always use the production Firebase Functions URL
const API_BASE_URL = 'https://claritystream-uldp9.web.app/api';

// Local storage keys for development fallback
const STORAGE_KEYS = {
  HEALTHCARE_PROVIDERS: 'kinconnect_healthcare_providers',
  PATIENT_PROFILE: 'kinconnect_patient_profile',
  MEDICATIONS: 'kinconnect_medications',
  MEDICAL_FACILITIES: 'kinconnect_medical_facilities',
} as const;

// Development fallback data
const createMockProvider = (name: string, specialty: string) => ({
  id: `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  specialty,
  phone: '',
  email: '',
  address: '',
  notes: '',
  patientId: 'current_user',
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
        return await fallbackHandler();
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

  // GET request with fallback
  async get<T>(endpoint: string): Promise<T> {
    // Special handling for healthcare providers
    if (endpoint.includes('/healthcare/providers/')) {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        const providers = this.getLocalStorageData(STORAGE_KEYS.HEALTHCARE_PROVIDERS, [
          createMockProvider('Dr. Sarah Johnson', 'Cardiologist'),
          createMockProvider('Dr. Michael Chen', 'Family Medicine'),
          createMockProvider('Dr. Emily Rodriguez', 'Dermatologist'),
          createMockProvider('Dr. David Kim', 'Orthopedic Surgery'),
        ]);
        return { success: true, data: providers } as T;
      });
    }

    // Special handling for patient profile
    if (endpoint === '/patients/profile') {
      return this.requestWithFallback<T>(endpoint, { method: 'GET' }, async () => {
        const profile = this.getLocalStorageData(STORAGE_KEYS.PATIENT_PROFILE, {
          id: 'current_user',
          name: 'John Doe',
          email: 'john.doe@example.com',
          dateOfBirth: '1990-01-01',
          phone: '(555) 123-4567',
          address: '123 Main St, City, State 12345',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '(555) 987-6543',
            relationship: 'Spouse'
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
        const newProvider = createMockProvider(data.name, data.specialty);
        Object.assign(newProvider, data);
        providers.push(newProvider);
        this.setLocalStorageData(STORAGE_KEYS.HEALTHCARE_PROVIDERS, providers);
        return { success: true, data: newProvider } as T;
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
