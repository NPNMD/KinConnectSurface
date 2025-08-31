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
  accessLevel: 'full' | 'limited' | 'emergency_only';
  eventTypesAllowed?: MedicalEventType[]; // If limited access
  
  // Emergency Access
  emergencyAccess: boolean;
  emergencyContactPriority?: number; // 1 = primary emergency contact
  emergencyAccessExpiresAt?: Date; // For temporary emergency access
  
  // Invitation System
  invitationToken?: string; // Token for accepting invitations
  invitationExpiresAt?: Date; // When invitation expires
  
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
  accessLevel: 'full' | 'limited' | 'emergency_only';
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
  treatmentPlan: string; // Raw treatment plan input
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
  treatmentPlan: string;
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
