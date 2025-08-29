// Client-side Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCWSNgfOEVh_Q86YWHdiCA8QaYHVUDK4ZY",
  authDomain: "claritystream-uldp9.firebaseapp.com",
  databaseURL: "https://claritystream-uldp9-default-rtdb.firebaseio.com/", // Added missing database URL
  projectId: "claritystream-uldp9",
  storageBucket: "claritystream-uldp9.firebasestorage.app",
  messagingSenderId: "64645622155",
  appId: "1:64645622155:web:1f8ecfebe7c881a9c8a78e"
};

// If using custom database ID, specify it here
export const FIRESTORE_DATABASE_ID = "(default)"; // Use default database

// Firebase collection names
export const COLLECTIONS = {
  USERS: 'users',
  PATIENTS: 'patients',
  FAMILY_GROUPS: 'family_groups',
  MEDICATIONS: 'medications',
  MEDICATION_LOGS: 'medication_logs',
  MEDICATION_SCHEDULES: 'medication_schedules',
  MEDICATION_CALENDAR_EVENTS: 'medication_calendar_events',
  MEDICATION_ADHERENCE: 'medication_adherence',
  TASKS: 'tasks',
  APPOINTMENTS: 'appointments',
  VISIT_RECORDS: 'visit_records',
  HEALTHCARE_PROVIDERS: 'healthcare_providers',
  MEDICAL_FACILITIES: 'medical_facilities',
  MEDICAL_EVENTS: 'medical_events',
  FAMILY_CALENDAR_ACCESS: 'family_calendar_access',
  CALENDAR_VIEW_SETTINGS: 'calendar_view_settings',
  GOOGLE_CALENDAR_SYNC_SETTINGS: 'google_calendar_sync_settings',
  FAMILY_NOTIFICATIONS: 'family_notifications',
  APPOINTMENT_RESPONSIBILITIES: 'appointment_responsibilities',
} as const;

// Firebase security rules (for reference)
export const FIREBASE_RULES = {
  users: {
    read: 'request.auth != null && (resource.data.id == request.auth.uid || resource.data.id in get(/databases/$(database.name)/documents/users/$(request.auth.uid)).data.familyGroupIds)',
    write: 'request.auth != null && request.auth.uid == resource.data.id'
  },
  patients: {
    read: 'request.auth != null && (resource.data.userId == request.auth.uid || request.auth.uid in get(/databases/$(database.name)/documents/family_groups).data.memberIds where resource.data.id == data.patientId)',
    write: 'request.auth != null && (resource.data.userId == request.auth.uid || request.auth.uid in get(/databases/$(database.name)/documents/family_groups).data.memberIds where resource.data.id == data.patientId)'
  },
  family_groups: {
    read: 'request.auth != null && (resource.data.patientId == request.auth.uid || resource.data.memberId == request.auth.uid)',
    write: 'request.auth != null && (resource.data.patientId == request.auth.uid || resource.data.memberId == request.auth.uid)'
  }
};
