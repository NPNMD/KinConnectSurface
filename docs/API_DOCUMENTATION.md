# KinConnect API Documentation

Complete guide to using the KinConnect API for medication management, patient care coordination, and drug information.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Common Use Cases](#common-use-cases)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [Best Practices](#best-practices)

## Getting Started

### Base URL

The KinConnect API is available at the following endpoints:

- **Development**: `http://localhost:5001/{project-id}/us-central1/api`
- **Production**: `https://us-central1-{project-id}.cloudfunctions.net/api`

### Interactive Documentation

Access the interactive Swagger UI documentation at:
- **Development**: `http://localhost:5001/{project-id}/us-central1/api-docs`
- **Production**: `https://us-central1-{project-id}.cloudfunctions.net/api-docs`

### API Version

Current version: **v1**

All endpoints are prefixed with `/api/`.

## Authentication

### Overview

KinConnect uses Firebase Authentication with Bearer tokens. All API requests (except health check and invitation details) require authentication.

### Getting an Authentication Token

1. **Sign in with Firebase**:
   ```javascript
   import { signInWithEmailAndPassword } from 'firebase/auth';
   import { auth } from './firebase';
   
   const userCredential = await signInWithEmailAndPassword(auth, email, password);
   const token = await userCredential.user.getIdToken();
   ```

2. **Sign in with Google**:
   ```javascript
   import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
   
   const provider = new GoogleAuthProvider();
   const result = await signInWithPopup(auth, provider);
   const token = await result.user.getIdToken();
   ```

### Using the Token

Include the token in the `Authorization` header of all API requests:

```http
Authorization: Bearer YOUR_FIREBASE_ID_TOKEN
```

### Example Request

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://us-central1-kinconnect-prod.cloudfunctions.net/api/auth/profile
```

### Token Expiration

Firebase ID tokens expire after 1 hour. Refresh tokens automatically:

```javascript
const token = await auth.currentUser.getIdToken(true); // Force refresh
```

## API Endpoints

### Authentication

#### Get User Profile
```http
GET /api/auth/profile
```

Creates or retrieves the authenticated user's profile.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user123",
    "email": "john@example.com",
    "name": "John Doe",
    "userType": "patient",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Patients

#### Get Patient Profile
```http
GET /api/patients/profile
```

Retrieves the patient profile for the authenticated user.

#### Create Patient Profile
```http
POST /api/patients/profile
Content-Type: application/json

{
  "dateOfBirth": "1980-01-01",
  "gender": "male",
  "phoneNumber": "+1234567890",
  "medicalConditions": ["Hypertension"],
  "allergies": ["Penicillin"]
}
```

#### Update Patient Profile
```http
PUT /api/patients/profile
Content-Type: application/json

{
  "phoneNumber": "+1234567891",
  "address": "456 Oak Ave, City, State"
}
```

### Medications

#### List Medications
```http
GET /api/medications
```

Returns all medications for the authenticated user.

#### Create Medication
```http
POST /api/medications
Content-Type: application/json

{
  "name": "Lisinopril",
  "dosage": "10mg",
  "frequency": "Once daily",
  "instructions": "Take with food",
  "prescribedBy": "Dr. Smith",
  "isActive": true
}
```

**Full Example**:
```json
{
  "name": "Lisinopril",
  "genericName": "Lisinopril",
  "brandName": "Prinivil",
  "rxcui": "104377",
  "dosage": "10mg",
  "strength": "10mg",
  "dosageForm": "tablet",
  "frequency": "Once daily",
  "route": "oral",
  "instructions": "Take with food in the morning",
  "prescribedBy": "Dr. Smith",
  "prescribedDate": "2024-01-01",
  "startDate": "2024-01-01",
  "isActive": true,
  "isPRN": false,
  "pharmacy": "CVS Pharmacy",
  "refillsRemaining": 3
}
```

#### Update Medication
```http
PUT /api/medications/{medicationId}
Content-Type: application/json

{
  "dosage": "20mg",
  "refillsRemaining": 2
}
```

#### Delete Medication
```http
DELETE /api/medications/{medicationId}
```

### Medication Reminders

#### Get Reminders
```http
GET /api/medications/{medicationId}/reminders
```

#### Create Reminder
```http
POST /api/medications/{medicationId}/reminders
Content-Type: application/json

{
  "reminderTime": "08:00",
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "isActive": true
}
```

#### Update Reminder
```http
PUT /api/medications/reminders/{reminderId}
Content-Type: application/json

{
  "reminderTime": "09:00",
  "isActive": true
}
```

#### Delete Reminder
```http
DELETE /api/medications/reminders/{reminderId}
```

### Drug Search

#### Search Drugs
```http
GET /api/drugs/search?q=lisinopril&limit=20
```

**Query Parameters**:
- `q` (required): Search term (minimum 2 characters)
- `limit` (optional): Maximum results (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "rxcui": "104377",
      "name": "Lisinopril",
      "tty": "IN"
    }
  ],
  "message": "Found 1 drug(s)"
}
```

#### Get Drug Details
```http
GET /api/drugs/{rxcui}
```

#### Get Drug Interactions
```http
GET /api/drugs/{rxcui}/interactions
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "drugName": "Potassium",
      "rxcui": "8588",
      "severity": "major",
      "description": "May increase risk of hyperkalemia"
    }
  ]
}
```

#### Get Drug Images
```http
GET /api/drugs/{rxcui}/images
```

#### Search Drug Images by Name
```http
GET /api/drugs/images/search?name=Lisinopril
```

#### Get Clinical Information
```http
GET /api/drugs/{rxcui}/clinical-info
```

Returns detailed clinical information from DailyMed including indications, dosage, warnings, and adverse reactions.

#### Get Spelling Suggestions
```http
GET /api/drugs/suggestions/{term}
```

#### Get Related Drugs
```http
GET /api/drugs/{rxcui}/related
```

### Invitations

#### Send Invitation
```http
POST /api/invitations/send
Content-Type: application/json

{
  "email": "patient@example.com",
  "patientName": "Jane Smith",
  "message": "I'd like to help manage your medications"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "invitationId": "inv123",
    "status": "pending",
    "expiresAt": "2024-01-08T00:00:00Z"
  }
}
```

#### Get Invitation Details
```http
GET /api/invitations/{invitationId}
```

**Note**: This endpoint does not require authentication.

#### Accept Invitation
```http
POST /api/invitations/{invitationId}/accept
```

Creates or updates family group membership.

#### Get Sent Invitations
```http
GET /api/invitations/sent
```

### Family Groups

#### Get Family Group
```http
GET /api/family/group
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "family123",
    "name": "John Doe's Family",
    "members": [
      {
        "uid": "user123",
        "email": "john@example.com",
        "name": "John Doe",
        "role": "admin",
        "joinedAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

## Common Use Cases

### 1. Onboarding a New User

```javascript
// 1. User signs up with Firebase Auth
const userCredential = await createUserWithEmailAndPassword(auth, email, password);

// 2. Get auth token
const token = await userCredential.user.getIdToken();

// 3. Create/get user profile
const profileResponse = await fetch(`${baseUrl}/auth/profile`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 4. Create patient profile
const patientResponse = await fetch(`${baseUrl}/patients/profile`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dateOfBirth: '1980-01-01',
    phoneNumber: '+1234567890'
  })
});
```

### 2. Adding a New Medication

```javascript
// 1. Search for the drug
const searchResponse = await fetch(
  `${baseUrl}/drugs/search?q=lisinopril`,
  { headers: { 'Authorization': `Bearer ${token}` }}
);
const drugs = await searchResponse.json();
const drug = drugs.data[0]; // First result

// 2. Get drug details and images
const detailsResponse = await fetch(
  `${baseUrl}/drugs/${drug.rxcui}`,
  { headers: { 'Authorization': `Bearer ${token}` }}
);

// 3. Create medication with drug info
const medResponse = await fetch(`${baseUrl}/medications`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: drug.name,
    rxcui: drug.rxcui,
    dosage: '10mg',
    frequency: 'Once daily',
    instructions: 'Take with food',
    prescribedBy: 'Dr. Smith',
    isActive: true
  })
});

const medication = await medResponse.json();

// 4. Add a reminder
await fetch(`${baseUrl}/medications/${medication.data.id}/reminders`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reminderTime: '08:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    isActive: true
  })
});
```

### 3. Checking Drug Interactions

```javascript
// Get all patient medications
const medsResponse = await fetch(`${baseUrl}/medications`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const medications = await medsResponse.json();

// Check interactions for each medication
for (const med of medications.data) {
  if (med.rxcui) {
    const interactionsResponse = await fetch(
      `${baseUrl}/drugs/${med.rxcui}/interactions`,
      { headers: { 'Authorization': `Bearer ${token}` }}
    );
    const interactions = await interactionsResponse.json();
    
    if (interactions.data.length > 0) {
      console.log(`${med.name} has ${interactions.data.length} interactions`);
    }
  }
}
```

### 4. Inviting a Family Member

```javascript
// Send invitation
const inviteResponse = await fetch(`${baseUrl}/invitations/send`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'family@example.com',
    patientName: 'Jane Doe',
    message: 'Join my care team to help manage medications'
  })
});

const invitation = await inviteResponse.json();
const invitationLink = `https://app.kinconnect.com/invitation/${invitation.data.invitationId}`;

// Share link with family member via email (sent automatically)
```

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid parameters or request body |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 410 | Gone | Invitation expired or already used |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | External service (RxNorm, DailyMed) unavailable |

### Error Examples

#### Invalid Auth Token
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

#### Resource Not Found
```json
{
  "success": false,
  "error": "Medication not found"
}
```

#### Validation Error
```json
{
  "success": false,
  "error": "Email and patient name are required"
}
```

### Handling Errors in Code

```javascript
try {
  const response = await fetch(`${baseUrl}/medications`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    // Handle API error
    console.error('API Error:', data.error);
    
    if (response.status === 401) {
      // Token expired, refresh and retry
      const newToken = await auth.currentUser.getIdToken(true);
      // Retry request with new token
    }
  } else {
    // Success
    const medications = data.data;
  }
} catch (error) {
  // Handle network or parsing error
  console.error('Request failed:', error);
}
```

## Rate Limiting

### Limits

- **100 requests per 15-minute window** per IP address
- Applies to all `/api/*` endpoints
- Health check endpoint is not rate limited

### Rate Limit Headers

Response headers include rate limit information:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

### Handling Rate Limits

When rate limited, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

**Best practices**:
- Implement exponential backoff for retries
- Cache responses when appropriate
- Batch operations when possible
- Monitor rate limit headers

## Pagination

Currently, the API does not implement pagination for list endpoints. All results are returned in a single response.

**Future Enhancement**: Pagination will be added with the following parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Suggested Implementation**:
```javascript
// Future pagination support
const response = await fetch(
  `${baseUrl}/medications?page=1&limit=20`,
  { headers: { 'Authorization': `Bearer ${token}` }}
);
```

## Best Practices

### 1. Token Management

```javascript
// Store token securely
let authToken = null;

async function getValidToken() {
  if (!authToken || isTokenExpired(authToken)) {
    authToken = await auth.currentUser.getIdToken(true);
  }
  return authToken;
}

// Use in requests
const token = await getValidToken();
```

### 2. Error Handling

```javascript
async function makeApiRequest(url, options = {}) {
  const token = await getValidToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data.data;
}
```

### 3. Batch Operations

```javascript
// Instead of multiple individual requests
const medications = await Promise.all(
  medicationIds.map(id => 
    fetch(`${baseUrl}/medications/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
  )
);
```

### 4. Caching

```javascript
// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedDrugDetails(rxcui) {
  const cacheKey = `drug:${rxcui}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await makeApiRequest(`${baseUrl}/drugs/${rxcui}`);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}
```

### 5. Request Validation

```javascript
// Validate input before sending
function validateMedication(medication) {
  const required = ['name', 'dosage', 'frequency', 'instructions', 'prescribedBy'];
  const missing = required.filter(field => !medication[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  return medication;
}

const medication = validateMedication({
  name: 'Lisinopril',
  dosage: '10mg',
  // ...
});
```

### 6. Retry Logic

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 7. Type Safety with TypeScript

```typescript
import { Medication, ApiResponse } from '@/types';

async function getMedications(): Promise<Medication[]> {
  const token = await getValidToken();
  
  const response = await fetch(`${baseUrl}/medications`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data: ApiResponse<Medication[]> = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data.data!;
}
```

## Additional Resources

- [OpenAPI Specification](./api/openapi.yaml)
- [Postman Collection](./api/KinConnect.postman_collection.json)
- [Swagger UI](http://localhost:5001/{project-id}/us-central1/api-docs) (when running locally)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [RxNorm API Documentation](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html)
- [DailyMed API Documentation](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm)

## Support

For API support or questions:
- Email: support@kinconnect.app
- GitHub Issues: [KinConnect Repository](https://github.com/kinconnect/kinconnect)
- Documentation: [GitHub Wiki](https://github.com/kinconnect/kinconnect/wiki)
