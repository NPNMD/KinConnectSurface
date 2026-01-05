// User types
export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  userType: 'patient' | 'family_member' | 'caregiver' | 'healthcare_provider';
  familyGroupId?: string;
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
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
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
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
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

// Audit Log types
export enum AuditAction {
  // Authentication events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Patient access events
  ACCESS_PATIENT = 'ACCESS_PATIENT',
  ACCESS_PATIENT_DENIED = 'ACCESS_PATIENT_DENIED',
  VIEW_PATIENT_PROFILE = 'VIEW_PATIENT_PROFILE',
  
  // Medication events
  CREATE_MEDICATION = 'CREATE_MEDICATION',
  UPDATE_MEDICATION = 'UPDATE_MEDICATION',
  DELETE_MEDICATION = 'DELETE_MEDICATION',
  VIEW_MEDICATIONS = 'VIEW_MEDICATIONS',
  MODIFY_MEDICATION = 'MODIFY_MEDICATION',
  LOG_MEDICATION_TAKEN = 'LOG_MEDICATION_TAKEN',
  
  // Patient data events
  CREATE_PATIENT = 'CREATE_PATIENT',
  UPDATE_PATIENT = 'UPDATE_PATIENT',
  DELETE_PATIENT = 'DELETE_PATIENT',
  
  // Family group events
  CREATE_FAMILY_GROUP = 'CREATE_FAMILY_GROUP',
  ADD_FAMILY_MEMBER = 'ADD_FAMILY_MEMBER',
  REMOVE_FAMILY_MEMBER = 'REMOVE_FAMILY_MEMBER',
  UPDATE_FAMILY_PERMISSIONS = 'UPDATE_FAMILY_PERMISSIONS',
  
  // Invitation events
  CREATE_INVITATION = 'CREATE_INVITATION',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  REJECT_INVITATION = 'REJECT_INVITATION',
  
  // Appointment events
  CREATE_APPOINTMENT = 'CREATE_APPOINTMENT',
  UPDATE_APPOINTMENT = 'UPDATE_APPOINTMENT',
  DELETE_APPOINTMENT = 'DELETE_APPOINTMENT',
  
  // Visit record events
  CREATE_VISIT_RECORD = 'CREATE_VISIT_RECORD',
  UPDATE_VISIT_RECORD = 'UPDATE_VISIT_RECORD',
  DELETE_VISIT_RECORD = 'DELETE_VISIT_RECORD',
  
  // Task events
  CREATE_TASK = 'CREATE_TASK',
  UPDATE_TASK = 'UPDATE_TASK',
  DELETE_TASK = 'DELETE_TASK',
  
  // Security events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_TOKEN = 'INVALID_TOKEN',
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  DENIED = 'DENIED',
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail?: string;
  action: AuditAction;
  resource: string; // e.g., "patient:123", "medication:456"
  resourceId?: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    [key: string]: any;
  };
  errorMessage?: string;
  createdAt: Date;
}

export interface NewAuditLog {
  userId: string;
  userEmail?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    [key: string]: any;
  };
  errorMessage?: string;
}
