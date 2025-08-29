// Updated Firestore security rules to prevent duplicate family access records
// This should be added to firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Family calendar access rules with duplicate prevention
    match /family_calendar_access/{accessId} {
      // Allow read if user is the patient or family member
      allow read: if request.auth != null && 
        (resource.data.patientId == request.auth.uid || 
         resource.data.familyMemberId == request.auth.uid);
      
      // Allow create only if:
      // 1. User is authenticated
      // 2. User is the patient (patientId matches auth.uid)
      // 3. Document ID follows the pattern: patientId_emailHash
      // 4. No existing active relationship exists (checked in Cloud Function)
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.patientId &&
        accessId.matches('^' + request.auth.uid + '_[a-zA-Z0-9]+$');
      
      // Allow update if user is the patient or family member
      // and not changing critical fields like patientId or familyMemberEmail
      allow update: if request.auth != null && 
        (resource.data.patientId == request.auth.uid || 
         resource.data.familyMemberId == request.auth.uid) &&
        request.resource.data.patientId == resource.data.patientId &&
        request.resource.data.familyMemberEmail == resource.data.familyMemberEmail;
      
      // Allow delete only by the patient
      allow delete: if request.auth != null && 
        resource.data.patientId == request.auth.uid;
    }
    
    // Family access logs (audit trail)
    match /family_access_logs/{logId} {
      // Read-only access for patients and family members
      allow read: if request.auth != null && 
        (resource.data.patientId == request.auth.uid || 
         resource.data.userId == request.auth.uid);
      
      // Only Cloud Functions can write logs
      allow write: if false;
    }
    
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Medical events with family access
    match /medical_events/{eventId} {
      allow read, write: if request.auth != null && 
        (resource.data.patientId == request.auth.uid ||
         // Check family access via Cloud Function
         exists(/databases/$(database)/documents/family_calendar_access/$(request.auth.uid + '_' + resource.data.patientId)));
    }
    
    // Other collections remain unchanged...
    match /medications/{medicationId} {
      allow read, write: if request.auth != null && resource.data.patientId == request.auth.uid;
    }
    
    match /healthcare_providers/{providerId} {
      allow read, write: if request.auth != null && resource.data.patientId == request.auth.uid;
    }
    
    match /healthcare_facilities/{facilityId} {
      allow read, write: if request.auth != null && resource.data.patientId == request.auth.uid;
    }
  }
}