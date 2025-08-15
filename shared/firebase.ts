// Client-side Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCWSNgfOEVh_Q86YWHdiCA8QaYHVUDK4ZY",
  authDomain: "claritystream-uldp9.firebaseapp.com",
  projectId: "claritystream-uldp9",
  storageBucket: "claritystream-uldp9.firebasestorage.app",
  messagingSenderId: "64645622155",
  appId: "1:64645622155:web:1f8ecfebe7c881a9c8a78e"
};

// Firebase collection names
export const COLLECTIONS = {
  USERS: 'users',
  PATIENTS: 'patients',
  FAMILY_GROUPS: 'family_groups',
  MEDICATIONS: 'medications',
  MEDICATION_LOGS: 'medication_logs',
  TASKS: 'tasks',
  APPOINTMENTS: 'appointments',
  VISIT_RECORDS: 'visit_records',
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
