// User types
export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  userType: 'patient' | 'family_member' | 'caregiver' | 'healthcare_provider';
  
  // Enhanced family member fields
  primaryPatientId?: string;           // Primary patient this family member manages
  familyMemberOf?: string[];           // Array of all patient IDs they have access to
  
  // Family member metadata
  familyRole?: 'primary_caregiver' | 'family_member' | 'emergency_contact';
  preferredPatientId?: string;         // Last active patient for quick switching
  
  // Debugging and monitoring
  lastFamilyAccessCheck?: Date;        // Last successful family access query
  familyAccessIssues?: string[];       // Array of recent access issues
  invitationHistory?: {                // Track invitation acceptance history
    invitationId: string;
    acceptedAt: Date;
    patientId: string;
  }[];
  
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
  
  // Insurance Information
  primaryInsuranceId?: string; // Reference to primary insurance
  hasInsurance?: boolean; // Quick flag
  
  // Preferred Pharmacy
  preferredPharmacyId?: string; // Reference to MedicalFacility with facilityType: 'pharmacy'
  
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

// Insurance Information Types
export interface InsuranceInformation {
  id: string;
  patientId: string;
  
  // Insurance Details
  insuranceType: 'primary' | 'secondary' | 'tertiary';
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberRelationship?: 'self' | 'spouse' | 'parent' | 'child' | 'other';
  subscriberId?: string;
  
  // Coverage Dates
  effectiveDate?: Date;
  expirationDate?: Date;
  
  // Card Images
  cardFrontUrl?: string;
  cardBackUrl?: string;
  cardFrontStoragePath?: string;
  cardBackStoragePath?: string;
  
  // Additional Information
  customerServicePhone?: string;
  claimsAddress?: string;
  rxBin?: string; // Prescription Bin Number
  rxPcn?: string; // Prescription Processor Control Number
  rxGroup?: string; // Prescription Group Number
  
  // Status
  isActive: boolean;
  isPrimary: boolean; // Quick flag for primary insurance
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface NewInsuranceInformation {
  patientId: string;
  insuranceType: 'primary' | 'secondary' | 'tertiary';
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberRelationship?: 'self' | 'spouse' | 'parent' | 'child' | 'other';
  subscriberId?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  customerServicePhone?: string;
  claimsAddress?: string;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  isActive: boolean;
  isPrimary: boolean;
  notes?: string;
  createdBy: string;
}

// Insurance Card Upload Types
export interface InsuranceCardUploadState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  frontStoragePath?: string;
  backStoragePath?: string;
}

export interface InsuranceCardUploadOptions {
  patientId: string;
  insuranceId: string;
  side: 'front' | 'back';
  file: File;
  onProgress?: (progress: number) => void;
  onComplete?: (url: string, storagePath: string) => void;
  onError?: (error: string) => void;
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

// Family Member types for enhanced access control
export const FAMILY_ACCESS_LEVELS = [
  'full',
  'limited',
  'view_only',
  'emergency_only'
] as const;

export type FamilyAccessLevel = typeof FAMILY_ACCESS_LEVELS[number];

export const FAMILY_PERMISSIONS = [
  'view_appointments',
  'create_appointments',
  'edit_appointments',
  'cancel_appointments',
  'view_medical_records',
  'manage_medications',
  'receive_notifications',
  'emergency_contact'
] as const;

export type FamilyPermission = typeof FAMILY_PERMISSIONS[number];

export interface FamilyMember {
  id: string;
  patientId: string;
  userId: string | null; // null if invitation not yet accepted
  name: string;
  email: string;
  phone?: string;
  relationship: string;
  accessLevel: FamilyAccessLevel;
  permissions: FamilyPermission[];
  isEmergencyContact: boolean;
  canReceiveNotifications: boolean;
  preferredContactMethod: 'email' | 'phone' | 'sms';
  invitationStatus: 'pending' | 'accepted' | 'declined' | 'expired';
  invitedAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewFamilyMember {
  patientId: string;
  name: string;
  email: string;
  phone?: string;
  relationship: string;
  accessLevel: FamilyAccessLevel;
  permissions: FamilyPermission[];
  isEmergencyContact: boolean;
  canReceiveNotifications: boolean;
  preferredContactMethod: 'email' | 'phone' | 'sms';
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
  instructions?: string; // Now optional
  prescribedBy?: string; // Now optional
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
  hasReminders?: boolean; // Simple reminder flag
  reminderTimes?: string[]; // Default times for reminders based on frequency
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
  instructions?: string; // Now optional
  prescribedBy?: string; // Now optional
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
  hasReminders?: boolean;
  reminderTimes?: string[];
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

// Medication Schedule types for calendar integration
export interface MedicationSchedule {
  id: string;
  medicationId: string;
  patientId: string;
  
  // Schedule Configuration
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
  times: string[]; // Array of HH:MM times for daily doses
  daysOfWeek?: number[]; // 0-6, Sunday = 0 (for weekly schedules)
  dayOfMonth?: number; // 1-31 (for monthly schedules)
  
  // Duration and Dates
  startDate: Date;
  endDate?: Date;
  isIndefinite: boolean; // true if no end date
  
  // Dosage Information
  dosageAmount: string; // e.g., "1 tablet", "5ml"
  instructions?: string; // Special instructions for this schedule
  
  // Calendar Integration
  generateCalendarEvents: boolean; // Whether to create calendar events
  reminderMinutesBefore: number[]; // Reminder times before each dose
  
  // Status and Tracking
  isActive: boolean;
  isPaused: boolean;
  pausedUntil?: Date;
  lastGeneratedDate?: Date; // Last date events were generated for
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedicationSchedule {
  medicationId: string;
  patientId: string;
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'monthly' | 'as_needed';
  times: string[];
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date;
  isIndefinite: boolean;
  dosageAmount: string;
  instructions?: string;
  generateCalendarEvents: boolean;
  reminderMinutesBefore: number[];
  isActive: boolean;
}

// Medication Calendar Event - links medication schedules to calendar events
export interface MedicationCalendarEvent {
  id: string;
  medicationId: string;
  medicationScheduleId: string;
  medicalEventId: string; // Reference to the calendar event
  patientId: string;
  
  // Medication Details (cached for performance)
  medicationName: string;
  dosageAmount: string;
  instructions?: string;
  
  // Schedule Information
  scheduledDateTime: Date;
  actualTakenDateTime?: Date;
  
  // Status Tracking
  status: 'scheduled' | 'taken' | 'missed' | 'skipped' | 'late';
  takenBy?: string; // User ID who marked it as taken
  notes?: string;
  
  // Adherence Tracking
  isOnTime: boolean; // true if taken within acceptable window
  minutesLate?: number; // if taken late
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedicationCalendarEvent {
  medicationId: string;
  medicationScheduleId: string;
  medicalEventId: string;
  patientId: string;
  medicationName: string;
  dosageAmount: string;
  instructions?: string;
  scheduledDateTime: Date;
  status: 'scheduled' | 'taken' | 'missed' | 'skipped' | 'late';
  isOnTime: boolean;
}

// Medication Adherence Analytics
export interface MedicationAdherence {
  medicationId: string;
  patientId: string;
  
  // Time Period
  startDate: Date;
  endDate: Date;
  
  // Adherence Metrics
  totalScheduledDoses: number;
  takenDoses: number;
  missedDoses: number;
  skippedDoses: number;
  lateDoses: number;
  
  // Calculated Percentages
  adherenceRate: number; // (taken + late) / total
  onTimeRate: number; // taken on time / total
  missedRate: number; // missed / total
  
  // Timing Analysis
  averageDelayMinutes: number;
  longestDelayMinutes: number;
  
  // Patterns
  mostMissedTimeOfDay?: string; // HH:MM
  mostMissedDayOfWeek?: number; // 0-6
  
  // Metadata
  calculatedAt: Date;
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

// Medical Calendar Event Types
export const MEDICAL_EVENT_TYPES = [
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

export type MedicalEventType = typeof MEDICAL_EVENT_TYPES[number];

// Medical Event Priority Levels
export const MEDICAL_EVENT_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
  'emergency'
] as const;

export type MedicalEventPriority = typeof MEDICAL_EVENT_PRIORITIES[number];

// Medical Event Status
export const MEDICAL_EVENT_STATUSES = [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show',
  'pending_confirmation'
] as const;

export type MedicalEventStatus = typeof MEDICAL_EVENT_STATUSES[number];

// Enhanced Medical Event Interface
export interface MedicalEvent {
  id: string;
  patientId: string;
  
  // Basic Event Information
  title: string;
  description?: string;
  eventType: MedicalEventType;
  priority: MedicalEventPriority;
  status: MedicalEventStatus;
  
  // Date and Time
  startDateTime: Date;
  endDateTime: Date;
  duration: number; // in minutes
  isAllDay: boolean;
  timeZone?: string;
  
  // Location Information
  location?: string;
  address?: string;
  facilityId?: string; // Reference to MedicalFacility
  facilityName?: string; // Cached facility name for display
  room?: string;
  
  // Healthcare Provider Information
  providerId?: string; // Reference to HealthcareProvider
  providerName?: string; // Cached provider name for display
  providerSpecialty?: string;
  providerPhone?: string;
  providerEmail?: string;
  
  // Medical Context
  medicalConditions?: string[]; // Related medical conditions
  medications?: string[]; // Related medications
  allergies?: string[]; // Relevant allergies to consider
  specialInstructions?: string;
  preparationInstructions?: string;
  
  // Family Responsibility System
  requiresTransportation: boolean;
  responsiblePersonId?: string; // Family member responsible
  responsiblePersonName?: string;
  responsibilityStatus: 'unassigned' | 'claimed' | 'confirmed' | 'declined' | 'completed';
  responsibilityClaimedAt?: Date;
  responsibilityConfirmedAt?: Date;
  transportationNotes?: string;
  accompanimentRequired?: boolean; // Whether patient needs someone to stay with them
  
  // Recurring Event Information
  isRecurring: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // every N days/weeks/months/years
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
    endDate?: Date;
    occurrences?: number; // number of occurrences
  };
  parentEventId?: string; // For recurring event instances
  
  // Reminders and Notifications
  reminders: {
    id: string;
    type: 'email' | 'sms' | 'push' | 'phone';
    minutesBefore: number;
    isActive: boolean;
    sentAt?: Date;
  }[];
  familyNotificationsSent?: Date[];
  
  // Insurance and Financial
  insuranceRequired?: boolean;
  copayAmount?: number;
  preAuthRequired?: boolean;
  preAuthNumber?: string;
  
  // Results and Follow-up
  hasResults?: boolean;
  resultsAvailable?: boolean;
  resultsReviewedAt?: Date;
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpInstructions?: string;
  
  // Google Calendar Integration
  googleCalendarEventId?: string;
  syncedToGoogleCalendar?: boolean;
  lastSyncedAt?: Date;
  syncErrors?: string[];
  
  // Metadata
  notes?: string;
  attachments?: {
    id: string;
    name: string;
    type: string;
    url: string;
    uploadedAt: Date;
  }[];
  tags?: string[];
  
  // Audit Trail
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
  version: number;
}

export interface NewMedicalEvent {
  patientId: string;
  title: string;
  description?: string;
  eventType: MedicalEventType;
  priority: MedicalEventPriority;
  status: MedicalEventStatus;
  startDateTime: Date;
  endDateTime: Date;
  duration: number;
  isAllDay: boolean;
  timeZone?: string;
  location?: string;
  address?: string;
  facilityId?: string;
  facilityName?: string;
  room?: string;
  providerId?: string;
  providerName?: string;
  providerSpecialty?: string;
  providerPhone?: string;
  providerEmail?: string;
  medicalConditions?: string[];
  medications?: string[];
  allergies?: string[];
  specialInstructions?: string;
  preparationInstructions?: string;
  requiresTransportation: boolean;
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  responsibilityStatus: 'unassigned' | 'claimed' | 'confirmed' | 'declined' | 'completed';
  transportationNotes?: string;
  accompanimentRequired?: boolean;
  isRecurring: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: Date;
    occurrences?: number;
  };
  parentEventId?: string;
  reminders: {
    id: string;
    type: 'email' | 'sms' | 'push' | 'phone';
    minutesBefore: number;
    isActive: boolean;
  }[];
  insuranceRequired?: boolean;
  copayAmount?: number;
  preAuthRequired?: boolean;
  preAuthNumber?: string;
  hasResults?: boolean;
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpInstructions?: string;
  notes?: string;
  tags?: string[];
  createdBy: string;
}

// Family Calendar Access Control
export interface FamilyCalendarAccess {
  id: string;
  patientId: string;
  familyMemberId: string;
  familyMemberName: string;
  familyMemberEmail: string;
  
  // Access Permissions
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canClaimResponsibility: boolean;
    canManageFamily: boolean;
    canViewMedicalDetails: boolean;
    canReceiveNotifications: boolean;
  };
  
  // Access Scope
  accessLevel: 'full' | 'view_only' | 'limited' | 'emergency_only';
  eventTypesAllowed?: MedicalEventType[]; // If limited access
  
  // Emergency Access
  emergencyAccess: boolean;
  emergencyContactPriority?: number; // 1 = primary emergency contact
  emergencyAccessExpiresAt?: Date; // For temporary emergency access
  
  // Invitation System
  invitationToken?: string; // Token for accepting invitations
  invitationExpiresAt?: Date; // When invitation expires
  
  // Enhanced fields for reliability and debugging
  patientUserId?: string;              // Direct reference to patient's user ID
  repairedAt?: Date;                   // When auto-repair was performed
  repairReason?: string;               // Why repair was needed
  repairCount?: number;                // Number of times repaired
  lastQueryAt?: Date;                  // Last time this record was queried
  queryFailures?: number;              // Count of failed queries
  connectionVerified?: boolean;        // Whether connection has been verified
  lastVerificationAt?: Date;           // Last verification timestamp
  rollbackAt?: Date;                   // When rollback was performed
  rollbackReason?: string;             // Why rollback was needed
  
  // Status and Audit
  status: 'active' | 'suspended' | 'revoked' | 'pending' | 'expired';
  invitedAt: Date;
  acceptedAt?: Date;
  lastAccessAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revocationReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewFamilyCalendarAccess {
  patientId: string;
  familyMemberId: string;
  familyMemberName: string;
  familyMemberEmail: string;
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canClaimResponsibility: boolean;
    canManageFamily: boolean;
    canViewMedicalDetails: boolean;
    canReceiveNotifications: boolean;
  };
  accessLevel: 'full' | 'view_only' | 'limited' | 'emergency_only';
  eventTypesAllowed?: MedicalEventType[];
  emergencyAccess: boolean;
  emergencyContactPriority?: number;
  createdBy: string;
}

// Calendar View and Filter Types
export interface CalendarViewSettings {
  id: string;
  userId: string;
  patientId: string;
  
  // View Preferences
  defaultView: 'month' | 'week' | 'day' | 'agenda';
  timeFormat: '12h' | '24h';
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  
  // Filter Settings
  eventTypesVisible: MedicalEventType[];
  prioritiesVisible: MedicalEventPriority[];
  statusesVisible: MedicalEventStatus[];
  providersVisible: string[]; // Provider IDs
  facilitiesVisible: string[]; // Facility IDs
  
  // Display Options
  showMedicalDetails: boolean;
  showFamilyResponsibility: boolean;
  showReminders: boolean;
  colorCoding: 'eventType' | 'priority' | 'provider' | 'facility';
  
  // Notification Preferences
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  reminderDefaults: number[]; // Default reminder times in minutes
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCalendarViewSettings {
  userId: string;
  patientId: string;
  defaultView: 'month' | 'week' | 'day' | 'agenda';
  timeFormat: '12h' | '24h';
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  eventTypesVisible: MedicalEventType[];
  prioritiesVisible: MedicalEventPriority[];
  statusesVisible: MedicalEventStatus[];
  providersVisible: string[];
  facilitiesVisible: string[];
  showMedicalDetails: boolean;
  showFamilyResponsibility: boolean;
  showReminders: boolean;
  colorCoding: 'eventType' | 'priority' | 'provider' | 'facility';
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  reminderDefaults: number[];
}

// Google Calendar Sync Settings
export interface GoogleCalendarSyncSettings {
  id: string;
  userId: string;
  patientId: string;
  
  // Google Account Information
  googleAccountEmail: string;
  googleCalendarId: string;
  googleCalendarName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  
  // Sync Configuration
  syncEnabled: boolean;
  syncDirection: 'one_way_to_google' | 'one_way_from_google' | 'two_way';
  syncFrequency: 'real_time' | 'hourly' | 'daily';
  
  // Privacy Settings
  includeEventTypes: MedicalEventType[];
  includeMedicalDetails: boolean;
  includeProviderInfo: boolean;
  includeFamilyInfo: boolean;
  customEventTitleTemplate?: string; // e.g., "Medical Appointment"
  
  // Sync Status
  lastSyncAt?: Date;
  lastSyncStatus: 'success' | 'error' | 'partial';
  syncErrors?: string[];
  totalEventsSynced: number;
  
  // Conflict Resolution
  conflictResolution: 'google_wins' | 'app_wins' | 'manual_review';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NewGoogleCalendarSyncSettings {
  userId: string;
  patientId: string;
  googleAccountEmail: string;
  googleCalendarId: string;
  googleCalendarName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  syncEnabled: boolean;
  syncDirection: 'one_way_to_google' | 'one_way_from_google' | 'two_way';
  syncFrequency: 'real_time' | 'hourly' | 'daily';
  includeEventTypes: MedicalEventType[];
  includeMedicalDetails: boolean;
  includeProviderInfo: boolean;
  includeFamilyInfo: boolean;
  customEventTitleTemplate?: string;
  conflictResolution: 'google_wins' | 'app_wins' | 'manual_review';
}

// ===== VISIT SUMMARY TYPES =====

// Visit Summary Input Methods
export const VISIT_INPUT_METHODS = [
  'text',
  'voice',
  'dictation'
] as const;

export type VisitInputMethod = typeof VISIT_INPUT_METHODS[number];

// Visit Types
export const VISIT_TYPES = [
  'scheduled',
  'walk_in',
  'emergency',
  'follow_up',
  'consultation',
  'telemedicine'
] as const;

export type VisitType = typeof VISIT_TYPES[number];

// AI Processing Status
export const AI_PROCESSING_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'retry_needed'
] as const;

export type AIProcessingStatus = typeof AI_PROCESSING_STATUSES[number];

// Urgency Levels for AI-generated content
export const URGENCY_LEVELS = [
  'low',
  'medium',
  'high',
  'urgent'
] as const;

export type UrgencyLevel = typeof URGENCY_LEVELS[number];

// Family Access Levels for Visit Summaries
export const VISIT_FAMILY_ACCESS_LEVELS = [
  'full',
  'summary_only',
  'restricted',
  'none'
] as const;

export type VisitFamilyAccessLevel = typeof VISIT_FAMILY_ACCESS_LEVELS[number];

// Medication Change Types
export interface MedicationChange {
  name: string;
  dosage?: string;
  instructions?: string;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
}

export interface NewMedicationChange extends MedicationChange {
  changeType: 'new';
}

export interface StoppedMedicationChange extends MedicationChange {
  changeType: 'stopped';
  stopDate: Date;
}

export interface ModifiedMedicationChange extends MedicationChange {
  changeType: 'modified';
  oldDosage?: string;
  newDosage?: string;
  changeReason?: string;
}

export type AnyMedicationChange = NewMedicationChange | StoppedMedicationChange | ModifiedMedicationChange;

// AI-Generated Visit Summary Content
export interface AIProcessedSummary {
  // Key highlights from the visit
  keyPoints: string[];
  
  // Actionable items for patient/family
  actionItems: string[];
  
  // Medication changes detected by AI
  medicationChanges: {
    newMedications: NewMedicationChange[];
    stoppedMedications: StoppedMedicationChange[];
    changedMedications: ModifiedMedicationChange[];
  };
  
  // Follow-up requirements
  followUpRequired: boolean;
  followUpDate?: Date;
  followUpInstructions?: string;
  
  // AI-assessed urgency level
  urgencyLevel: UrgencyLevel;
  
  // Additional AI insights
  riskFactors?: string[];
  recommendations?: string[];
  warningFlags?: string[];
  
  // AI confidence scores (0-1)
  confidenceScores?: {
    overall: number;
    medicationChanges: number;
    urgencyAssessment: number;
    actionItems: number;
  };
}

// Google AI Configuration
export interface GoogleAIConfig {
  model: 'gemini-pro' | 'gemini-pro-vision';
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

// Visit Summary Main Interface
export interface VisitSummary {
  id: string;
  patientId: string;
  medicalEventId?: string; // Link to calendar event if exists
  
  // Visit Details
  visitDate: Date;
  providerName: string;
  providerSpecialty?: string;
  providerId?: string; // Reference to HealthcareProvider
  facilityName?: string;
  facilityId?: string; // Reference to MedicalFacility
  visitType: VisitType;
  visitDuration?: number; // in minutes
  
  // Input Data
  doctorSummary: string; // Raw doctor input
  treatmentPlan?: string; // Raw treatment plan input (optional)
  inputMethod: VisitInputMethod;
  voiceTranscriptionId?: string; // If voice input was used
  
  // Additional Visit Context
  chiefComplaint?: string;
  diagnosis?: string[];
  procedures?: string[];
  labResults?: string[];
  imagingResults?: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    oxygenSaturation?: number;
  };
  
  // AI-Generated Content
  aiProcessedSummary?: AIProcessedSummary;
  
  // Processing Status
  processingStatus: AIProcessingStatus;
  aiProcessingError?: string;
  aiProcessingAttempts: number;
  lastProcessingAttempt?: Date;
  
  // Google AI Metadata
  googleAIConfig?: GoogleAIConfig;
  googleAIRequestId?: string;
  googleAIResponseMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    processingTime?: number;
  };
  
  // Family Access Control
  sharedWithFamily: boolean;
  familyAccessLevel: VisitFamilyAccessLevel;
  familyNotificationsSent?: Date[];
  restrictedFields?: string[]; // Fields hidden from family
  
  // Integration with Medical Events
  linkedMedicalEvents?: string[]; // IDs of related medical events
  generatedFollowUpEvents?: string[]; // IDs of follow-up events created from this summary
  
  // Attachments and Documents
  attachments?: Array<{
    id: string;
    name: string;
    type: 'image' | 'pdf' | 'document' | 'audio' | 'other';
    url: string;
    size: number;
    uploadedAt: Date;
    uploadedBy: string;
  }>;
  
  // Tags and Categories
  tags?: string[];
  categories?: string[];
  
  // Audit Trail
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
  version: number;
  
  // Review and Approval
  reviewedBy?: string;
  reviewedAt?: Date;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewNotes?: string;
}

// New Visit Summary Interface
export interface NewVisitSummary {
  patientId: string;
  medicalEventId?: string;
  visitDate: Date;
  providerName: string;
  providerSpecialty?: string;
  providerId?: string;
  facilityName?: string;
  facilityId?: string;
  visitType: VisitType;
  visitDuration?: number;
  doctorSummary: string;
  treatmentPlan?: string;
  inputMethod: VisitInputMethod;
  voiceTranscriptionId?: string;
  chiefComplaint?: string;
  diagnosis?: string[];
  procedures?: string[];
  labResults?: string[];
  imagingResults?: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    oxygenSaturation?: number;
  };
  sharedWithFamily: boolean;
  familyAccessLevel: VisitFamilyAccessLevel;
  restrictedFields?: string[];
  tags?: string[];
  categories?: string[];
  createdBy: string;
}

// Visit Summary Search and Filter Types
export interface VisitSummaryFilters {
  patientId?: string;
  providerName?: string;
  providerId?: string;
  facilityId?: string;
  visitType?: VisitType[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  processingStatus?: AIProcessingStatus[];
  urgencyLevel?: UrgencyLevel[];
  tags?: string[];
  categories?: string[];
  hasFollowUp?: boolean;
  hasMedicationChanges?: boolean;
}

// Visit Summary Analytics
export interface VisitSummaryAnalytics {
  patientId: string;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  
  // Visit Statistics
  totalVisits: number;
  visitsByType: Record<VisitType, number>;
  visitsByProvider: Record<string, number>;
  visitsByMonth: Record<string, number>;
  
  // AI Processing Statistics
  aiProcessingSuccessRate: number;
  averageProcessingTime: number;
  commonProcessingErrors: string[];
  
  // Medical Insights
  commonDiagnoses: Array<{
    diagnosis: string;
    count: number;
    percentage: number;
  }>;
  medicationChangeFrequency: {
    newMedications: number;
    stoppedMedications: number;
    changedMedications: number;
  };
  urgencyDistribution: Record<UrgencyLevel, number>;
  
  // Follow-up Compliance
  followUpRequired: number;
  followUpCompleted: number;
  followUpComplianceRate: number;
  
  // Family Engagement
  summariesSharedWithFamily: number;
  familyAccessLevelDistribution: Record<VisitFamilyAccessLevel, number>;
  
  calculatedAt: Date;
}

// Google AI Prompt Templates
export interface GoogleAIPromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'visit_summary' | 'medication_analysis' | 'follow_up_planning' | 'risk_assessment';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Voice Transcription Types
export interface VoiceTranscription {
  id: string;
  patientId: string;
  visitSummaryId?: string;
  audioFileUrl: string;
  transcriptionText: string;
  confidence: number;
  language: string;
  duration: number; // in seconds
  transcriptionService: 'google_speech' | 'azure_speech' | 'aws_transcribe';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewVoiceTranscription {
  patientId: string;
  visitSummaryId?: string;
  audioFileUrl: string;
  language: string;
  transcriptionService: 'google_speech' | 'azure_speech' | 'aws_transcribe';
  createdBy: string;
}

// ===== ENHANCED MEDICATION UX TYPES (Phase 1) =====

// Time slot definitions
export type TimeSlot = 'morning' | 'noon' | 'evening' | 'bedtime';
export type WorkScheduleType = 'standard' | 'night_shift' | 'custom';

// Patient Medication Preferences for time bucket organization
export interface PatientMedicationPreferences {
  id: string;
  patientId: string;
  timeSlots: {
    morning: { start: string; end: string; defaultTime: string; label: string };
    noon: { start: string; end: string; defaultTime: string; label: string };
    evening: { start: string; end: string; defaultTime: string; label: string };
    bedtime: { start: string; end: string; defaultTime: string; label: string };
  };
  workSchedule: WorkScheduleType;
  quietHours: {
    start: string;
    end: string;
    enabled: boolean;
  };
  
  // Grace Period Configuration
  gracePeriodSettings?: {
    // Default grace periods by time slot (in minutes)
    defaultGracePeriods: {
      morning: number;
      noon: number;
      evening: number;
      bedtime: number;
    };
    
    // Medication-specific overrides
    medicationOverrides?: Array<{
      medicationId: string;
      medicationName: string;
      gracePeriodMinutes: number;
      reason: string;
    }>;
    
    // Medication type rules
    medicationTypeRules?: Array<{
      medicationType: 'critical' | 'standard' | 'prn' | 'vitamin';
      gracePeriodMinutes: number;
    }>;
    
    // Special circumstances multipliers
    weekendMultiplier?: number; // Default 1.5 = 50% longer grace period on weekends
    holidayMultiplier?: number; // Default 2.0 = 100% longer grace period on holidays
    sickDayMultiplier?: number; // Default 3.0 = 200% longer grace period when sick
    
    // Emergency notification settings
    emergencyNotificationThreshold?: number; // minutes after grace period to escalate
    emergencyContacts?: string[]; // family member IDs for critical misses
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPatientMedicationPreferences {
  patientId: string;
  timeSlots: {
    morning: { start: string; end: string; defaultTime: string; label: string };
    noon: { start: string; end: string; defaultTime: string; label: string };
    evening: { start: string; end: string; defaultTime: string; label: string };
    bedtime: { start: string; end: string; defaultTime: string; label: string };
  };
  workSchedule: WorkScheduleType;
  quietHours: {
    start: string;
    end: string;
    enabled: boolean;
  };
}

// Default time slot configurations
export const DEFAULT_TIME_SLOTS = {
  standard: {
    morning: { start: '06:00', end: '10:00', defaultTime: '07:00', label: 'Morning' },
    noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Noon' },
    evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
    bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
  },
  night_shift: {
    morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
    noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
    evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Late Evening' },
    bedtime: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning Sleep' }
  }
} as const;

// Medication Packs for grouped medication management
export interface MedicationPack {
  id: string;
  patientId: string;
  name: string; // "Morning Pack", "Evening Vitamins", etc.
  description?: string;
  timeSlot: TimeSlot | 'custom';
  customTime?: string; // if timeSlot is 'custom'
  medications: Array<{
    medicationId: string;
    scheduleId: string;
    dosageOverride?: string; // optional pack-specific dosage
  }>;
  isActive: boolean;
  autoTakeAll: boolean; // if true, "Take All" marks all as taken
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedicationPack {
  patientId: string;
  name: string;
  description?: string;
  timeSlot: TimeSlot | 'custom';
  customTime?: string;
  medications: Array<{
    medicationId: string;
    scheduleId: string;
    dosageOverride?: string;
  }>;
  isActive: boolean;
  autoTakeAll: boolean;
}

// Enhanced Medication Calendar Event with action history
export interface EnhancedMedicationCalendarEvent extends MedicationCalendarEvent {
  // Pack information
  packId?: string;
  packName?: string;
  isPartOfPack: boolean;
  packPosition?: number; // order within pack
  
  // Action history
  snoozeCount: number;
  snoozeHistory: Array<{
    snoozedAt: Date;
    snoozeMinutes: number;
    reason?: string;
    snoozedBy: string;
  }>;
  skipHistory: Array<{
    skippedAt: Date;
    reason: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other';
    notes?: string;
    skippedBy: string;
  }>;
  rescheduleHistory: Array<{
    originalDateTime: Date;
    newDateTime: Date;
    reason: string;
    isOneTime: boolean; // true = only this dose, false = ongoing schedule change
    rescheduledAt: Date;
    rescheduledBy: string;
  }>;
  
  // Time bucket classification
  timeBucket?: 'now' | 'due_soon' | 'morning' | 'noon' | 'evening' | 'bedtime' | 'overdue';
  minutesUntilDue?: number; // for "due soon" classification
  isOverdue?: boolean;
  minutesOverdue?: number;
}

// Medication Event Actions for tracking user interactions
export interface MedicationEventAction {
  id: string;
  eventId: string;
  actionType: 'take' | 'snooze' | 'skip' | 'reschedule';
  actionData: {
    // For snooze
    snoozeMinutes?: number;
    snoozeUntil?: Date;
    snoozeReason?: string;
    
    // For skip
    skipReason?: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other';
    skipNotes?: string;
    
    // For reschedule
    newDateTime?: Date;
    rescheduleReason?: string;
    isOneTime?: boolean; // true = only this dose, false = ongoing schedule change
  };
  performedBy: string;
  performedAt: Date;
}

export interface NewMedicationEventAction {
  eventId: string;
  actionType: 'take' | 'snooze' | 'skip' | 'reschedule';
  actionData: {
    snoozeMinutes?: number;
    snoozeUntil?: Date;
    snoozeReason?: string;
    skipReason?: 'forgot' | 'felt_sick' | 'ran_out' | 'side_effects' | 'other';
    skipNotes?: string;
    newDateTime?: Date;
    rescheduleReason?: string;
    isOneTime?: boolean;
  };
  performedBy: string;
}

// Time bucket organization for today's medications
export interface TodayMedicationBuckets {
  now: EnhancedMedicationCalendarEvent[];
  dueSoon: EnhancedMedicationCalendarEvent[]; // due within next 30 minutes
  morning: EnhancedMedicationCalendarEvent[];
  noon: EnhancedMedicationCalendarEvent[];
  evening: EnhancedMedicationCalendarEvent[];
  bedtime: EnhancedMedicationCalendarEvent[];
  overdue: EnhancedMedicationCalendarEvent[];
  completed: EnhancedMedicationCalendarEvent[]; // taken, missed, skipped medications
  patientPreferences: PatientMedicationPreferences;
  lastUpdated: Date;
}

// Snooze options for quick actions
export const SNOOZE_OPTIONS = [
  { minutes: 10, label: '10 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' }
] as const;

// Skip reasons for tracking
export const SKIP_REASONS = [
  { value: 'forgot', label: 'Forgot to take it', icon: '🤔' },
  { value: 'felt_sick', label: 'Felt sick/nauseous', icon: '🤢' },
  { value: 'ran_out', label: 'Ran out of medication', icon: '📦' },
  { value: 'side_effects', label: 'Experiencing side effects', icon: '⚠️' },
  { value: 'other', label: 'Other reason', icon: '💭' }
] as const;

export type SkipReason = typeof SKIP_REASONS[number]['value'];

// Medication pack status for display
export interface MedicationPackStatus {
  packId: string;
  packName: string;
  totalMedications: number;
  takenMedications: number;
  pendingMedications: number;
  overdueMedications: number;
  nextDueTime?: Date;
  allTaken: boolean;
  hasOverdue: boolean;
}

// ===== PHASE 2: ADVANCED SCHEDULING ENGINE TYPES =====

// Timing types for advanced scheduling
export type TimingType = 'absolute' | 'meal_relative' | 'sleep_relative' | 'interval';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type SleepRelativeType = 'bedtime' | 'wake_time';

// Enhanced Patient Medication Preferences with meal and sleep timing
export interface EnhancedPatientMedicationPreferences extends PatientMedicationPreferences {
  mealTimes: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    isFlexible: boolean; // if true, use meal logging; if false, use fixed times
  };
  sleepSchedule: {
    bedtime: string;
    wakeTime: string;
    isFlexible: boolean;
  };
  medicationSeparationRules: Array<{
    medication1: string; // medication name or active ingredient
    medication2: string;
    minimumSeparationMinutes: number;
    reason: string; // e.g., "Calcium interferes with thyroid absorption"
    type: 'absorption' | 'interaction' | 'effectiveness';
  }>;
}

export interface NewEnhancedPatientMedicationPreferences extends NewPatientMedicationPreferences {
  mealTimes: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    isFlexible: boolean;
  };
  sleepSchedule: {
    bedtime: string;
    wakeTime: string;
    isFlexible: boolean;
  };
  medicationSeparationRules: Array<{
    medication1: string;
    medication2: string;
    minimumSeparationMinutes: number;
    reason: string;
    type: 'absorption' | 'interaction' | 'effectiveness';
  }>;
}

// Meal logging for flexible timing
export interface MealLog {
  id: string;
  patientId: string;
  date: Date;
  mealType: MealType;
  loggedAt: Date;
  estimatedTime?: Date; // if logged later, estimated actual meal time
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMealLog {
  patientId: string;
  date: Date;
  mealType: MealType;
  loggedAt: Date;
  estimatedTime?: Date;
  notes?: string;
}

// Enhanced Medication Schedule with relative timing
export interface EnhancedMedicationSchedule extends MedicationSchedule {
  timingType: TimingType;
  
  // For meal-relative timing
  mealRelativeTiming?: {
    mealType: MealType;
    offsetMinutes: number; // negative = before meal, positive = after meal
    isFlexible: boolean; // if true, adjust based on actual meal times
    fallbackTime?: string; // if no meal logged, use this time
  };
  
  // For sleep-relative timing
  sleepRelativeTiming?: {
    relativeTo: SleepRelativeType;
    offsetMinutes: number;
    fallbackTime?: string;
  };
  
  // For interval-based timing (q4h, q6h, etc.)
  intervalTiming?: {
    intervalHours: number;
    startTime: string; // first dose of the day
    endTime?: string; // last dose of the day
    avoidSleepHours: boolean;
    maxDosesPerDay?: number;
  };
  
  // Complex frequency patterns
  frequencyPattern?: {
    type: 'daily' | 'interval' | 'cycling' | 'weekly' | 'monthly' | 'custom';
    
    // For cycling patterns
    cyclingPattern?: {
      onDays: number; // take for X days
      offDays: number; // skip for Y days
      startDate: Date;
    };
    
    // For weekly patterns
    weeklyPattern?: {
      daysOfWeek: number[]; // 0-6, Sunday = 0
      weeksOn?: number; // take for X weeks
      weeksOff?: number; // skip for Y weeks
    };
    
    // For monthly patterns
    monthlyPattern?: {
      dayOfMonth?: number; // specific day (1-31)
      weekOfMonth?: number; // 1-4
      dayOfWeek?: number; // 0-6
      occurrence?: 'first' | 'second' | 'third' | 'fourth' | 'last';
    };
    
    // For custom patterns
    customPattern?: {
      rule: string; // human-readable rule
      dates: Date[]; // specific dates for irregular patterns
    };
  };
  
  // Short course management
  courseManagement?: {
    isShortCourse: boolean;
    totalDuration?: number; // in days
    totalDoses?: number;
    autoStopDate?: Date;
    completionBadge?: string;
    taperSchedule?: Array<{
      startDay: number;
      dosageAmount: string;
      frequency: string;
      instructions?: string;
    }>;
  };
}

export interface NewEnhancedMedicationSchedule extends NewMedicationSchedule {
  timingType: TimingType;
  mealRelativeTiming?: {
    mealType: MealType;
    offsetMinutes: number;
    isFlexible: boolean;
    fallbackTime?: string;
  };
  sleepRelativeTiming?: {
    relativeTo: SleepRelativeType;
    offsetMinutes: number;
    fallbackTime?: string;
  };
  intervalTiming?: {
    intervalHours: number;
    startTime: string;
    endTime?: string;
    avoidSleepHours: boolean;
    maxDosesPerDay?: number;
  };
  frequencyPattern?: {
    type: 'daily' | 'interval' | 'cycling' | 'weekly' | 'monthly' | 'custom';
    cyclingPattern?: {
      onDays: number;
      offDays: number;
      startDate: Date;
    };
    weeklyPattern?: {
      daysOfWeek: number[];
      weeksOn?: number;
      weeksOff?: number;
    };
    monthlyPattern?: {
      dayOfMonth?: number;
      weekOfMonth?: number;
      dayOfWeek?: number;
      occurrence?: 'first' | 'second' | 'third' | 'fourth' | 'last';
    };
    customPattern?: {
      rule: string;
      dates: Date[];
    };
  };
  courseManagement?: {
    isShortCourse: boolean;
    totalDuration?: number;
    totalDoses?: number;
    autoStopDate?: Date;
    completionBadge?: string;
    taperSchedule?: Array<{
      startDay: number;
      dosageAmount: string;
      frequency: string;
      instructions?: string;
    }>;
  };
}

// Schedule conflict detection
export interface ScheduleConflict {
  type: 'separation_violation' | 'sleep_disruption' | 'meal_conflict' | 'timing_overlap';
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  suggestedResolution: string;
  affectedSchedules: string[];
  affectedMedications: Array<{
    medicationId: string;
    medicationName: string;
    currentTime: string;
    suggestedTime?: string;
  }>;
}

// Schedule optimization suggestions
export interface ScheduleOptimization {
  type: 'timing_adjustment' | 'separation_improvement' | 'consolidation' | 'meal_alignment';
  title: string;
  description: string;
  currentSchedule: MedicationSchedule;
  suggestedSchedule: Partial<EnhancedMedicationSchedule>;
  benefits: string[];
  risks: string[];
  estimatedImprovementScore: number; // 0-100
}

// Interval scheduling presets
export const INTERVAL_PRESETS = [
  { hours: 4, label: 'Every 4 hours (q4h)', maxDaily: 6, description: 'Around the clock dosing' },
  { hours: 6, label: 'Every 6 hours (q6h)', maxDaily: 4, description: 'Four times daily' },
  { hours: 8, label: 'Every 8 hours (q8h)', maxDaily: 3, description: 'Three times daily' },
  { hours: 12, label: 'Every 12 hours (q12h)', maxDaily: 2, description: 'Twice daily' },
  { hours: 24, label: 'Every 24 hours (q24h)', maxDaily: 1, description: 'Once daily' }
] as const;

// Cycling pattern presets
export const CYCLING_PRESETS = [
  { onDays: 1, offDays: 1, label: 'Every other day', description: 'Take one day, skip one day' },
  { onDays: 5, offDays: 2, label: 'Weekdays only', description: 'Monday through Friday' },
  { onDays: 7, offDays: 7, label: 'Every other week', description: 'One week on, one week off' },
  { onDays: 21, offDays: 7, label: 'Three weeks on, one off', description: 'Common for some treatments' }
] as const;

// Monthly pattern presets
export const MONTHLY_PRESETS = [
  { type: 'day_of_month', value: 1, label: 'First of the month', description: 'Every month on the 1st' },
  { type: 'day_of_month', value: 15, label: 'Mid-month', description: 'Every month on the 15th' },
  { type: 'first_friday', label: 'First Friday', description: 'First Friday of each month' },
  { type: 'last_day', label: 'Last day of month', description: 'Last day of each month' }
] as const;

// Meal timing options
export const MEAL_TIMING_OPTIONS = [
  { offset: -30, label: '30 minutes before meal', icon: '🍽️⏰' },
  { offset: -15, label: '15 minutes before meal', icon: '🍽️⏰' },
  { offset: 0, label: 'With meal', icon: '🍽️' },
  { offset: 15, label: '15 minutes after meal', icon: '🍽️✅' },
  { offset: 30, label: '30 minutes after meal', icon: '🍽️✅' },
  { offset: 60, label: '1 hour after meal', icon: '🍽️✅' },
  { offset: 120, label: '2 hours after meal', icon: '🍽️✅' }
] as const;

// Sleep timing options
export const SLEEP_TIMING_OPTIONS = [
  { relativeTo: 'bedtime', offset: -60, label: '1 hour before bedtime', icon: '🌙⏰' },
  { relativeTo: 'bedtime', offset: -30, label: '30 minutes before bedtime', icon: '🌙⏰' },
  { relativeTo: 'bedtime', offset: 0, label: 'At bedtime', icon: '🌙' },
  { relativeTo: 'wake_time', offset: 0, label: 'Upon waking', icon: '☀️' },
  { relativeTo: 'wake_time', offset: 30, label: '30 minutes after waking', icon: '☀️✅' },
  { relativeTo: 'wake_time', offset: 60, label: '1 hour after waking', icon: '☀️✅' }
] as const;

// Common medication separation rules
export const COMMON_SEPARATION_RULES = [
  {
    medication1: 'levothyroxine',
    medication2: 'calcium',
    minimumSeparationMinutes: 240, // 4 hours
    reason: 'Calcium interferes with thyroid hormone absorption',
    type: 'absorption' as const
  },
  {
    medication1: 'levothyroxine',
    medication2: 'iron',
    minimumSeparationMinutes: 240, // 4 hours
    reason: 'Iron interferes with thyroid hormone absorption',
    type: 'absorption' as const
  },
  {
    medication1: 'bisphosphonate',
    medication2: 'food',
    minimumSeparationMinutes: 60, // 1 hour
    reason: 'Bisphosphonates require empty stomach for absorption',
    type: 'absorption' as const
  },
  {
    medication1: 'tetracycline',
    medication2: 'dairy',
    minimumSeparationMinutes: 120, // 2 hours
    reason: 'Dairy products reduce tetracycline absorption',
    type: 'absorption' as const
  }
] as const;


// ===== PHASE 3: SAFETY & INTELLIGENCE TYPES =====

// Enhanced drug information with safety data
export interface EnhancedDrugInformation {
  rxcui: string;
  name: string;
  brandNames: string[];
  genericNames: string[];
  activeIngredients: Array<{
    name: string;
    strength: string;
    unit: string;
  }>;
  
  // Enhanced OpenFDA data
  fdaLabelData: {
    boxedWarnings?: string[];
    contraindications?: string[];
    warnings?: string[];
    precautions?: string[];
    adverseReactions?: string[];
    drugInteractions?: string[];
    dosageAndAdministration?: string;
    storageInstructions?: string;
    indicationsAndUsage?: string;
  };
  
  // Interaction data
  knownInteractions: Array<{
    interactsWith: string; // medication name or ingredient
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    clinicalEffect: string;
    management: string;
    source: string;
  }>;
  
  // Separation rules
  separationRequirements: Array<{
    separateFrom: string;
    minimumHours: number;
    reason: string;
    type: 'absorption' | 'interaction' | 'effectiveness';
  }>;
}

// Medication safety alerts
export interface MedicationSafetyAlert {
  id: string;
  patientId: string;
  alertType: 'interaction' | 'duplicate' | 'separation' | 'contraindication' | 'allergy' | 'dosage_concern';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedMedications: Array<{
    medicationId: string;
    medicationName: string;
    role: 'primary' | 'secondary'; // primary = main medication, secondary = interacting medication
  }>;
  recommendations: string[];
  source: 'openfda' | 'rxnorm' | 'clinical_rules' | 'user_profile';
  isActive: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  dismissedBy?: string;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMedicationSafetyAlert {
  patientId: string;
  alertType: 'interaction' | 'duplicate' | 'separation' | 'contraindication' | 'allergy' | 'dosage_concern';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedMedications: Array<{
    medicationId: string;
    medicationName: string;
    role: 'primary' | 'secondary';
  }>;
  recommendations: string[];
  source: 'openfda' | 'rxnorm' | 'clinical_rules' | 'user_profile';
}

// Patient safety profile
export interface PatientSafetyProfile {
  id: string;
  patientId: string;
  allergies: Array<{
    id: string;
    allergen: string;
    type: 'drug' | 'ingredient' | 'class';
    severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
    symptoms: string[];
    verifiedBy?: string;
    verifiedAt?: Date;
    notes?: string;
  }>;
  contraindications: Array<{
    id: string;
    medication: string;
    reason: string;
    source: 'medical_history' | 'provider_note' | 'drug_label';
    addedBy: string;
    addedAt: Date;
    notes?: string;
  }>;
  medicalConditions: Array<{
    id: string;
    condition: string;
    icd10Code?: string;
    affectsMedications: boolean;
    notes?: string;
    diagnosedDate?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPatientSafetyProfile {
  patientId: string;
  allergies: Array<{
    allergen: string;
    type: 'drug' | 'ingredient' | 'class';
    severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
    symptoms: string[];
    verifiedBy?: string;
    verifiedAt?: Date;
    notes?: string;
  }>;
  contraindications: Array<{
    medication: string;
    reason: string;
    source: 'medical_history' | 'provider_note' | 'drug_label';
    addedBy: string;
    notes?: string;
  }>;
  medicalConditions: Array<{
    condition: string;
    icd10Code?: string;
    affectsMedications: boolean;
    notes?: string;
    diagnosedDate?: Date;
  }>;
}

// ===== PHASE 4: ADVANCED FEATURES TYPES =====

// PRN medication logging
export interface PRNMedicationLog {
  id: string;
  medicationId: string;
  patientId: string;
  takenAt: Date;
  dosageAmount: string;
  reason: string;
  painScoreBefore?: number; // 1-10 scale
  painScoreAfter?: number; // 1-10 scale, logged later
  symptoms: string[];
  effectiveness?: 'very_effective' | 'somewhat_effective' | 'not_effective';
  sideEffects?: string[];
  notes?: string;
  loggedBy: string;
  followUpReminder?: Date; // remind to log effectiveness
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPRNMedicationLog {
  medicationId: string;
  patientId: string;
  takenAt: Date;
  dosageAmount: string;
  reason: string;
  painScoreBefore?: number;
  symptoms: string[];
  notes?: string;
  loggedBy: string;
}

// PRN medication tracking and analytics
export interface PRNMedicationTracking {
  medicationId: string;
  patientId: string;
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  minimumIntervalHours?: number;
  
  // Usage analytics
  usageStats: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    averageDaily: number;
    mostCommonReasons: Array<{ reason: string; count: number }>;
    effectivenessRate: number; // percentage of doses rated as effective
  };
  
  // Alerts
  overuseAlerts: Array<{
    date: Date;
    type: 'daily_limit' | 'frequency_concern' | 'effectiveness_concern';
    description: string;
  }>;
  
  lastCalculated: Date;
}

// Medication status management
export interface MedicationStatusChange {
  id: string;
  medicationId: string;
  patientId: string;
  changeType: 'hold' | 'resume' | 'discontinue' | 'replace';
  
  // For holds
  holdData?: {
    reason: string;
    holdUntil?: Date; // null = indefinite hold
    autoResumeEnabled: boolean;
    holdInstructions?: string;
  };
  
  // For discontinuation
  discontinueData?: {
    reason: string;
    stopDate: Date;
    taperSchedule?: Array<{
      startDate: Date;
      endDate: Date;
      dosageAmount: string;
      frequency: string;
      instructions: string;
    }>;
    followUpRequired: boolean;
    followUpInstructions?: string;
  };
  
  // For replacement
  replacementData?: {
    reason: string;
    newMedicationId?: string;
    transitionPlan?: string;
    overlapDays?: number; // days to take both medications
  };
  
  performedBy: string;
  performedAt: Date;
  approvedBy?: string; // for family access scenarios
  approvedAt?: Date;
  notes?: string;
}

export interface NewMedicationStatusChange {
  medicationId: string;
  patientId: string;
  changeType: 'hold' | 'resume' | 'discontinue' | 'replace';
  holdData?: {
    reason: string;
    holdUntil?: Date;
    autoResumeEnabled: boolean;
    holdInstructions?: string;
  };
  discontinueData?: {
    reason: string;
    stopDate: Date;
    taperSchedule?: Array<{
      startDate: Date;
      endDate: Date;
      dosageAmount: string;
      frequency: string;
      instructions: string;
    }>;
    followUpRequired: boolean;
    followUpInstructions?: string;
  };
  replacementData?: {
    reason: string;
    newMedicationId?: string;
    transitionPlan?: string;
    overlapDays?: number;
  };
  performedBy: string;
  notes?: string;
}

// Enhanced medication with status history
export interface MedicationWithHistory extends Medication {
  statusHistory: MedicationStatusChange[];
  currentStatus: 'active' | 'held' | 'discontinued' | 'replaced';
  statusReason?: string;
  statusChangedAt?: Date;
  statusChangedBy?: string;
  safetyAlerts: MedicationSafetyAlert[];
  prnTracking?: PRNMedicationTracking;
}

// Common PRN reasons
export const PRN_REASONS = [
  { value: 'pain', label: 'Pain', icon: '🩹', requiresPainScore: true },
  { value: 'headache', label: 'Headache', icon: '🤕', requiresPainScore: true },
  { value: 'nausea', label: 'Nausea', icon: '🤢', requiresPainScore: false },
  { value: 'anxiety', label: 'Anxiety', icon: '😰', requiresPainScore: false },
  { value: 'insomnia', label: 'Trouble sleeping', icon: '😴', requiresPainScore: false },
  { value: 'fever', label: 'Fever', icon: '🌡️', requiresPainScore: false },
  { value: 'other', label: 'Other reason', icon: '💭', requiresPainScore: false }
] as const;

// ===== GRACE PERIOD AND MISSED MEDICATION DETECTION TYPES =====

// Grace Period Configuration Interface
export interface GracePeriodConfiguration {
  id: string;
  patientId: string;
  medicationId?: string; // null = default for patient
  
  // Grace Period Rules
  gracePeriodMinutes: number;
  timeOfDayRules?: Array<{
    timeSlot: 'morning' | 'noon' | 'evening' | 'bedtime';
    gracePeriodMinutes: number;
  }>;
  
  // Medication-Specific Rules
  medicationTypeRules?: Array<{
    medicationType: 'critical' | 'standard' | 'prn' | 'vitamin';
    gracePeriodMinutes: number;
  }>;
  
  // Special Conditions
  weekendGracePeriodMinutes?: number;
  holidayGracePeriodMinutes?: number;
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Grace Period Calculation Result
export interface GracePeriodCalculation {
  gracePeriodMinutes: number;
  gracePeriodEnd: Date;
  appliedRules: string[];
  ruleDetails: Array<{
    ruleName: string;
    ruleType: string;
    value: number;
    reason: string;
  }>;
  isWeekend: boolean;
  isHoliday: boolean;
  finalMultiplier: number;
}

// Enhanced Medication Calendar Event with grace period tracking
export interface EnhancedMedicationCalendarEventWithGracePeriod extends EnhancedMedicationCalendarEvent {
  // Grace Period Tracking
  gracePeriodMinutes?: number;
  gracePeriodEnd?: Date;
  gracePeriodRules?: string[]; // Applied rules for audit
  
  // Missed Detection
  missedAt?: Date;
  missedReason?: 'automatic_detection' | 'manual_mark' | 'family_report';
  missedDetectionAttempts?: number;
  
  // Compliance Impact
  adherenceImpact?: number; // -1 to 1 scale
  complianceFlags?: string[];
  
  // Archival Status
  archivalEligibleAt?: Date;
  archivalStatus?: 'eligible' | 'archived' | 'retained';
}

// Default Grace Period Matrix
export const DEFAULT_GRACE_PERIODS = {
  critical: {
    morning: 15,   // Heart meds, diabetes
    noon: 20,
    evening: 15,
    bedtime: 30
  },
  standard: {
    morning: 30,   // Blood pressure, cholesterol
    noon: 45,
    evening: 30,
    bedtime: 60
  },
  vitamin: {
    morning: 120,  // Vitamins, supplements
    noon: 180,
    evening: 120,
    bedtime: 240
  },
  prn: {
    all: 0         // No grace period for as-needed meds
  }
} as const;

// Medication Types for grace period classification
export const MEDICATION_TYPES = [
  'critical',
  'standard',
  'vitamin',
  'prn'
] as const;

export type MedicationType = typeof MEDICATION_TYPES[number];

// Missed Medication Detection Result
export interface MissedMedicationDetectionResult {
  processed: number;
  missed: number;
  errors: string[];
  detectionTime: Date;
  batchResults?: Array<{
    eventId: string;
    medicationName: string;
    patientId: string;
    gracePeriodMinutes: number;
    gracePeriodEnd: Date;
    appliedRules: string[];
  }>;
}

// Compliance Alert Types
export interface ComplianceAlert {
  id: string;
  patientId: string;
  alertType: 'adherence_declining' | 'consecutive_missed' | 'pattern_concern' | 'critical_missed';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  
  // Alert Details
  title: string;
  description: string;
  affectedMedications: Array<{
    medicationId: string;
    medicationName: string;
    currentAdherenceRate: number;
    missedDoses: number;
    lastTaken?: Date;
  }>;
  
  // Recommendations
  recommendations: string[];
  suggestedActions: Array<{
    actionType: 'contact_patient' | 'adjust_schedule' | 'provider_consultation';
    priority: number;
    description: string;
  }>;
  
  // Notification Status
  notificationsSent: Array<{
    recipientType: 'patient' | 'family' | 'provider';
    recipientId: string;
    sentAt: Date;
    method: 'email' | 'sms' | 'push' | 'in_app';
  }>;
  
  // Resolution
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Medication Event Archive for lifecycle management
export interface MedicationEventArchive {
  id: string;
  originalEventId: string;
  patientId: string;
  medicationId: string;
  
  // Original Event Data (compressed)
  eventData: Partial<MedicationCalendarEvent>;
  
  // Archival Metadata
  archivedAt: Date;
  archivedReason: 'retention_policy' | 'medication_discontinued' | 'manual_archive';
  originalCreatedAt: Date;
  originalUpdatedAt: Date;
  
  // Retention Information
  retentionCategory: 'standard' | 'critical' | 'legal_hold';
  deleteAfter?: Date; // null = permanent retention
  
  // Compliance Data (for analytics)
  finalStatus: 'taken' | 'missed' | 'skipped';
  adherenceImpact: number; // -1 to 1 scale
}

export type PRNReason = typeof PRN_REASONS[number]['value'];

// Pain scale for PRN medications
export const PAIN_SCALE = [
  { value: 1, label: 'No pain', description: 'No pain at all', color: 'text-green-600' },
  { value: 2, label: 'Mild', description: 'Very mild pain', color: 'text-green-500' },
  { value: 3, label: 'Mild', description: 'Mild pain', color: 'text-yellow-500' },
  { value: 4, label: 'Moderate', description: 'Moderate pain', color: 'text-yellow-600' },
  { value: 5, label: 'Moderate', description: 'Moderate pain', color: 'text-orange-500' },
  { value: 6, label: 'Moderate', description: 'Moderately severe pain', color: 'text-orange-600' },
  { value: 7, label: 'Severe', description: 'Severe pain', color: 'text-red-500' },
  { value: 8, label: 'Severe', description: 'Very severe pain', color: 'text-red-600' },
  { value: 9, label: 'Severe', description: 'Extremely severe pain', color: 'text-red-700' },
  { value: 10, label: 'Worst', description: 'Worst possible pain', color: 'text-red-800' }
] as const;

// ===== UNIFIED CALENDAR TYPES =====

// Unified Calendar Event - combines medical events and medication events
export interface UnifiedCalendarEvent {
  id: string;
  type: 'medical' | 'medication';
  patientId: string;
  
  // Common fields
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  isAllDay: boolean;
  
  // Medical event specific fields (when type === 'medical')
  medicalEvent?: MedicalEvent;
  
  // Medication event specific fields (when type === 'medication')
  medicationEvent?: MedicationCalendarEvent;
  
  // Display properties
  color?: string;
  icon?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  
  // Permissions
  canEdit: boolean;
  canDelete: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Delete Medical Event Request
export interface DeleteMedicalEventRequest {
  eventId: string;
  patientId: string;
  scope?: 'single' | 'future' | 'all'; // For recurring events
  reason?: string;
  notifyFamily?: boolean;
  deletedBy: string;
}

// Delete Medical Event Response
export interface DeleteMedicalEventResponse {
  success: boolean;
  deletedCount: number;
  affectedEventIds: string[];
  message?: string;
  error?: string;
}

// Deleted Medical Event (Audit Trail)
export interface DeletedMedicalEvent {
  id: string;
  originalEventId: string;
  patientId: string;
  eventData: Partial<MedicalEvent>; // Snapshot of deleted event
  deletionScope: 'single' | 'future' | 'all';
  deletionReason?: string;
  deletedBy: string;
  deletedAt: Date;
  familyNotified: boolean;
  relatedEventIds?: string[]; // For recurring event deletions
}

// Calendar Update Event (for real-time sync)
export interface CalendarUpdateEvent {
  type: 'created' | 'updated' | 'deleted';
  eventType: 'medical' | 'medication';
  eventId: string;
  patientId: string;
  timestamp: Date;
  userId: string;
}

// Calendar Context State
export interface CalendarContextState {
  events: UnifiedCalendarEvent[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Calendar Context Actions
export interface CalendarContextActions {
  fetchEvents: (patientId: string, startDate?: Date, endDate?: Date) => Promise<void>;
  deleteEvent: (request: DeleteMedicalEventRequest) => Promise<DeleteMedicalEventResponse>;
  refreshEvents: () => Promise<void>;
  clearError: () => void;
}
