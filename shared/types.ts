// User types
export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  userType: 'patient' | 'family_member' | 'caregiver' | 'healthcare_provider';
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  email: string;
  name: string;
  profilePicture?: string;
  userType: 'patient' | 'family_member' | 'caregiver' | 'healthcare_provider';
}

// Patient types
export interface Patient {
  id: string;
  userId: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  address?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalConditions?: string[];
  allergies?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPatient {
  userId: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  address?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalConditions?: string[];
  allergies?: string[];
}

// Family Group types
export interface FamilyGroup {
  id: string;
  patientId: string;
  memberId: string;
  role: 'primary_caregiver' | 'family_member' | 'caregiver';
  permissions: string[];
  createdAt: Date;
}

export interface NewFamilyGroup {
  patientId: string;
  memberId: string;
  role: 'primary_caregiver' | 'family_member' | 'caregiver';
  permissions: string[];
}

// Medication types
export interface Medication {
  id: string;
  patientId: string;
  name: string;
  genericName?: string;
  brandName?: string;
  rxcui?: string; // RxNorm Concept Unique Identifier
  ndc?: string; // National Drug Code
  dosage: string;
  strength?: string;
  dosageForm?: string; // tablet, capsule, liquid, etc.
  frequency: string;
  route?: string; // oral, topical, injection, etc.
  instructions: string;
  prescribedBy: string;
  prescribedDate: Date;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isPRN?: boolean; // "as needed" medication
  maxDailyDose?: string;
  sideEffects?: string[];
  notes?: string;
  pharmacy?: string;
  prescriptionNumber?: string;
  refillsRemaining?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedication {
  patientId: string;
  name: string;
  genericName?: string;
  brandName?: string;
  rxcui?: string;
  ndc?: string;
  dosage: string;
  strength?: string;
  dosageForm?: string;
  frequency: string;
  route?: string;
  instructions: string;
  prescribedBy: string;
  prescribedDate: Date;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isPRN?: boolean;
  maxDailyDose?: string;
  sideEffects?: string[];
  notes?: string;
  pharmacy?: string;
  prescriptionNumber?: string;
  refillsRemaining?: number;
}

// Drug search and RxNorm types
export interface DrugSearchResult {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string; // Term type (SBD, SCD, GPCK, etc.)
  language?: string;
}

export interface DrugInteraction {
  drugName: string;
  rxcui: string;
  severity?: 'minor' | 'moderate' | 'major';
  description: string;
  source?: string;
}

export interface MedicationReminder {
  id: string;
  medicationId: string;
  patientId: string;
  reminderTime: string; // HH:MM format
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  isActive: boolean;
  lastNotified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedicationReminder {
  medicationId: string;
  patientId: string;
  reminderTime: string;
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  isActive: boolean;
}

// Medication Log types
export interface MedicationLog {
  id: string;
  medicationId: string;
  patientId: string;
  takenAt: Date;
  takenBy: string;
  notes?: string;
  createdAt: Date;
}

export interface NewMedicationLog {
  medicationId: string;
  patientId: string;
  takenAt: Date;
  takenBy: string;
  notes?: string;
}

// Task types
export interface Task {
  id: string;
  patientId: string;
  assignedTo: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTask {
  patientId: string;
  assignedTo: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: Date;
}

// Appointment types
export interface Appointment {
  id: string;
  patientId: string;
  title: string;
  description: string;
  dateTime: Date;
  duration: number; // in minutes
  location: string;
  provider: string;
  providerId?: string; // Reference to healthcare provider
  facilityId?: string; // Reference to medical facility
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  
  // Family Responsibility Features
  responsiblePersonId?: string; // Family member responsible for taking patient
  responsiblePersonName?: string; // Name of responsible person for display
  responsibilityStatus: 'unassigned' | 'claimed' | 'confirmed' | 'declined';
  responsibilityClaimedAt?: Date; // When someone claimed responsibility
  responsibilityConfirmedAt?: Date; // When patient/primary confirmed the assignment
  transportationNotes?: string; // Special transportation requirements or notes
  requiresTransportation: boolean; // Whether patient needs someone to take them
  
  // Notifications and Reminders
  remindersSent?: Date[]; // Track when reminders were sent
  familyNotified?: boolean; // Whether family was notified about the appointment
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAppointment {
  patientId: string;
  title: string;
  description: string;
  dateTime: Date;
  duration: number;
  location: string;
  provider: string;
  providerId?: string;
  facilityId?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  
  // Family Responsibility Features
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  responsibilityStatus: 'unassigned' | 'claimed' | 'confirmed' | 'declined';
  transportationNotes?: string;
  requiresTransportation: boolean;
  
  notes?: string;
}

// Family Responsibility Management
export interface AppointmentResponsibility {
  id: string;
  appointmentId: string;
  patientId: string;
  responsiblePersonId: string;
  responsiblePersonName: string;
  status: 'claimed' | 'confirmed' | 'declined' | 'completed';
  claimedAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  transportationNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAppointmentResponsibility {
  appointmentId: string;
  patientId: string;
  responsiblePersonId: string;
  responsiblePersonName: string;
  status: 'claimed' | 'confirmed' | 'declined' | 'completed';
  transportationNotes?: string;
}

// Family Member Notification Types
export interface FamilyNotification {
  id: string;
  patientId: string;
  appointmentId: string;
  recipientId: string; // Family member receiving notification
  recipientEmail: string;
  recipientName: string;
  notificationType: 'appointment_created' | 'responsibility_needed' | 'responsibility_claimed' | 'appointment_reminder' | 'appointment_cancelled';
  message: string;
  sentAt: Date;
  readAt?: Date;
  actionTaken?: 'claimed' | 'declined' | 'acknowledged';
  actionTakenAt?: Date;
  createdAt: Date;
}

export interface NewFamilyNotification {
  patientId: string;
  appointmentId: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  notificationType: 'appointment_created' | 'responsibility_needed' | 'responsibility_claimed' | 'appointment_reminder' | 'appointment_cancelled';
  message: string;
}

// Visit Record types
export interface VisitRecord {
  id: string;
  patientId: string;
  appointmentId?: string;
  visitDate: Date;
  provider: string;
  diagnosis?: string;
  treatment?: string;
  medications?: string[];
  notes?: string;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewVisitRecord {
  patientId: string;
  appointmentId?: string;
  visitDate: Date;
  provider: string;
  diagnosis?: string;
  treatment?: string;
  medications?: string[];
  notes?: string;
  followUpDate?: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Healthcare Provider types
export interface HealthcareProvider {
  id: string;
  patientId: string;
  name: string;
  specialty: string;
  subSpecialty?: string;
  credentials?: string; // MD, DO, NP, PA, etc.
  
  // Contact Information
  phoneNumber?: string;
  email?: string;
  website?: string;
  
  // Address Information
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  
  // Google Places Data
  placeId?: string; // Google Places ID for verification
  googleRating?: number;
  googleReviews?: number;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  
  // Practice Information
  practiceName?: string;
  hospitalAffiliation?: string[];
  acceptedInsurance?: string[];
  languages?: string[];
  
  // Scheduling Information
  preferredAppointmentTime?: string; // e.g., "morning", "afternoon", "evening"
  typicalWaitTime?: string; // e.g., "1-2 weeks", "same day"
  
  // Relationship Information
  isPrimary?: boolean; // Primary care physician
  relationshipStart?: Date;
  lastVisit?: Date;
  nextAppointment?: Date;
  
  // Notes and Preferences
  notes?: string;
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NewHealthcareProvider {
  patientId: string;
  name: string;
  specialty: string;
  subSpecialty?: string;
  credentials?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  placeId?: string;
  googleRating?: number;
  googleReviews?: number;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  practiceName?: string;
  hospitalAffiliation?: string[];
  acceptedInsurance?: string[];
  languages?: string[];
  preferredAppointmentTime?: string;
  typicalWaitTime?: string;
  isPrimary?: boolean;
  relationshipStart?: Date;
  lastVisit?: Date;
  nextAppointment?: Date;
  notes?: string;
  isActive: boolean;
}

// Medical Facility types (hospitals, imaging centers, labs, etc.)
export interface MedicalFacility {
  id: string;
  patientId: string;
  name: string;
  facilityType: 'hospital' | 'imaging_center' | 'laboratory' | 'urgent_care' | 'pharmacy' | 'physical_therapy' | 'other';
  
  // Contact Information
  phoneNumber?: string;
  email?: string;
  website?: string;
  
  // Address Information
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  
  // Google Places Data
  placeId?: string;
  googleRating?: number;
  googleReviews?: number;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  
  // Facility Information
  services?: string[]; // e.g., ["MRI", "CT Scan", "X-Ray"]
  acceptedInsurance?: string[];
  emergencyServices?: boolean;
  
  // Preferences
  isPreferred?: boolean;
  notes?: string;
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedicalFacility {
  patientId: string;
  name: string;
  facilityType: 'hospital' | 'imaging_center' | 'laboratory' | 'urgent_care' | 'pharmacy' | 'physical_therapy' | 'other';
  phoneNumber?: string;
  email?: string;
  website?: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  placeId?: string;
  googleRating?: number;
  googleReviews?: number;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  services?: string[];
  acceptedInsurance?: string[];
  emergencyServices?: boolean;
  isPreferred?: boolean;
  notes?: string;
  isActive: boolean;
}

// Google Places API types
export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
}

export interface GooglePlaceSearchRequest {
  query: string;
  type?: 'doctor' | 'hospital' | 'pharmacy' | 'health';
  location?: {
    lat: number;
    lng: number;
  };
  radius?: number; // in meters
}

// Medical Specialties enum for consistency
export const MEDICAL_SPECIALTIES = [
  'Primary Care',
  'Internal Medicine',
  'Family Medicine',
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Hematology/Oncology',
  'Infectious Disease',
  'Nephrology',
  'Neurology',
  'Obstetrics/Gynecology',
  'Ophthalmology',
  'Orthopedics',
  'Otolaryngology (ENT)',
  'Psychiatry',
  'Psychology',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Urology',
  'Emergency Medicine',
  'Anesthesiology',
  'Pathology',
  'Physical Medicine & Rehabilitation',
  'Plastic Surgery',
  'General Surgery',
  'Dentistry',
  'Optometry',
  'Physical Therapy',
  'Occupational Therapy',
  'Speech Therapy',
  'Nutrition/Dietitian',
  'Other'
] as const;

export type MedicalSpecialty = typeof MEDICAL_SPECIALTIES[number];

// Facility types for consistency
export const FACILITY_TYPES = [
  'hospital',
  'imaging_center',
  'laboratory',
  'urgent_care',
  'pharmacy',
  'physical_therapy',
  'other'
] as const;

export type FacilityType = typeof FACILITY_TYPES[number];
