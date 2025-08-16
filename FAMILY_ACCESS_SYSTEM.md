# Family Access System Documentation

## Overview

The Family Access System is a comprehensive role-based access control system for KinConnect's medical calendar, allowing patients to grant family members specific permissions to view and manage their medical events. This system implements secure invitation workflows, granular permissions, emergency access, and audit logging.

## Architecture

### Core Components

1. **FamilyCalendarAccess Interface** (`shared/types.ts`)
   - Defines the data structure for family access permissions
   - Includes invitation tokens, expiration dates, and audit trails

2. **FamilyAccessService** (`server/services/familyAccessService.ts`)
   - Core business logic for family access management
   - Handles invitations, permissions, and emergency access

3. **Family Access Routes** (`server/routes/familyAccess.ts`)
   - RESTful API endpoints for family access operations
   - Protected by authentication middleware

4. **Permission Middleware** (`server/middleware/familyPermissions.ts`)
   - Middleware functions for checking specific permissions
   - Protects calendar endpoints with role-based access control

5. **Updated Calendar Routes** (`server/routes/calendar.ts`)
   - Enhanced with family permission checks
   - Supports multi-patient access for family members

## Features

### 1. Invitation System

**Create Invitation**
```typescript
POST /api/family-access/invite
{
  "patientId": "patient-123",
  "familyMemberEmail": "family@example.com",
  "familyMemberName": "John Family",
  "permissions": {
    "canView": true,
    "canCreate": false,
    "canEdit": false,
    "canDelete": false,
    "canClaimResponsibility": true,
    "canManageFamily": false,
    "canViewMedicalDetails": true,
    "canReceiveNotifications": true
  },
  "accessLevel": "limited",
  "eventTypesAllowed": ["appointment", "follow_up"]
}
```

**Accept Invitation**
```typescript
POST /api/family-access/accept
{
  "invitationToken": "inv_1234567890_abcdef123"
}
```

### 2. Permission Levels

#### Access Levels
- **Full**: Complete access to all medical events and details
- **Limited**: Restricted to specific event types
- **Emergency Only**: Temporary access during emergencies

#### Granular Permissions
- `canView`: View medical events and calendar
- `canCreate`: Create new medical events
- `canEdit`: Modify existing events
- `canDelete`: Remove events
- `canClaimResponsibility`: Claim transportation responsibilities
- `canManageFamily`: Manage other family member access
- `canViewMedicalDetails`: Access detailed medical information
- `canReceiveNotifications`: Receive email notifications

### 3. Emergency Access

Temporary access can be granted during emergencies:

```typescript
POST /api/family-access/emergency-access
{
  "patientId": "patient-123",
  "familyMemberId": "family-456",
  "duration": 24  // hours
}
```

### 4. Audit Logging

All family access actions are logged:
- Invitation creation and acceptance
- Permission changes
- Access revocation
- Emergency access grants
- Failed permission attempts

## API Endpoints

### Family Access Management

| Method | Endpoint | Description | Required Permission |
|--------|----------|-------------|-------------------|
| POST | `/api/family-access/invite` | Create family invitation | Patient or canManageFamily |
| POST | `/api/family-access/accept` | Accept invitation | Authenticated user |
| GET | `/api/family-access/patient/:patientId` | Get family access for patient | canManageFamily |
| GET | `/api/family-access/member` | Get access for current user | Authenticated user |
| PUT | `/api/family-access/:accessId` | Update permissions | canManageFamily |
| DELETE | `/api/family-access/:accessId` | Revoke access | canManageFamily |
| GET | `/api/family-access/check-permission/:patientId/:permission` | Check specific permission | Authenticated user |
| POST | `/api/family-access/emergency-access` | Grant emergency access | Patient or canManageFamily |
| POST | `/api/family-access/cleanup` | Clean expired access | Admin |

### Enhanced Calendar Endpoints

All calendar endpoints now require a `patientId` parameter and appropriate permissions:

| Method | Endpoint | Description | Required Permission |
|--------|----------|-------------|-------------------|
| GET | `/api/calendar/events/:patientId` | Get medical events | canView |
| GET | `/api/calendar/events/:patientId/:eventId` | Get specific event | canView |
| POST | `/api/calendar/events/:patientId` | Create event | canCreate |
| PUT | `/api/calendar/events/:patientId/:eventId` | Update event | canEdit |
| DELETE | `/api/calendar/events/:patientId/:eventId` | Delete event | canDelete |
| POST | `/api/calendar/events/:patientId/:eventId/claim-responsibility` | Claim responsibility | canClaimResponsibility |
| POST | `/api/calendar/events/:patientId/:eventId/confirm-responsibility` | Confirm responsibility | canManageFamily |

## Permission Middleware

### Available Middleware Functions

```typescript
import {
  canViewCalendar,
  canCreateEvents,
  canEditEvents,
  canDeleteEvents,
  canClaimResponsibility,
  canManageFamily,
  canViewMedicalDetails,
  checkMultiplePermissions,
  checkAnyPermission,
  allowEmergencyAccess
} from '../middleware/familyPermissions';
```

### Usage Examples

```typescript
// Single permission check
router.get('/events/:patientId', authenticateToken, canViewCalendar, handler);

// Multiple permissions required (ALL must be true)
router.post('/events/:patientId', 
  authenticateToken, 
  checkMultiplePermissions(['canCreate', 'canViewMedicalDetails']), 
  handler
);

// Any permission allowed (at least ONE must be true)
router.get('/summary/:patientId', 
  authenticateToken, 
  checkAnyPermission(['canView', 'canViewMedicalDetails']), 
  handler
);

// Emergency access override
router.get('/emergency/:patientId', 
  authenticateToken, 
  allowEmergencyAccess('canView'), 
  handler
);
```

## Data Models

### FamilyCalendarAccess Interface

```typescript
interface FamilyCalendarAccess {
  id: string;
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
  emergencyAccessExpiresAt?: Date;
  
  invitationToken?: string;
  invitationExpiresAt?: Date;
  
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
```

## Security Features

### 1. Token-Based Invitations
- Unique invitation tokens with expiration dates
- Tokens are removed after acceptance
- Automatic cleanup of expired invitations

### 2. Permission Validation
- All API endpoints protected by permission middleware
- Granular permission checking at the service level
- Patient always has full access to their own data

### 3. Audit Trail
- Complete logging of all family access actions
- Immutable audit records in separate collection
- Includes user IDs, timestamps, and action details

### 4. Emergency Access Controls
- Time-limited emergency access with automatic expiration
- Separate emergency access permissions
- Audit logging for emergency access grants

## Email Notifications

The system integrates with SendGrid for email notifications:

### Invitation Emails
- Professional invitation templates
- Clear permission descriptions
- Secure acceptance links

### Notification Types
- Family invitation sent
- Invitation accepted
- Access revoked
- Emergency access granted
- Permission changes

## Database Collections

### 1. family_calendar_access
- Primary collection for family access records
- Indexed on patientId, familyMemberId, status
- Supports efficient permission queries

### 2. family_access_logs
- Audit trail for all family access actions
- Immutable records with timestamps
- Indexed on patientId, userId, timestamp

## Testing

### Test Coverage
- Family invitation creation and acceptance
- Permission checking and validation
- Emergency access functionality
- Expired access cleanup
- API endpoint protection

### Running Tests
```bash
cd server
npx tsx tests/familyAccess.test.js
```

## Configuration

### Environment Variables
```env
# SendGrid for email notifications
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_SENDER_EMAIL=noreply@kinconnect.com
SENDGRID_SENDER_NAME=KinConnect

# Firebase for database and authentication
FIREBASE_SERVICE_ACCOUNT_KEY=your_firebase_service_account_json
```

### Firebase Security Rules
```javascript
// Family calendar access rules
match /family_calendar_access/{accessId} {
  allow read, write: if request.auth != null && 
    (resource.data.patientId == request.auth.uid || 
     resource.data.familyMemberId == request.auth.uid);
}
```

## Best Practices

### 1. Permission Design
- Follow principle of least privilege
- Use specific permissions rather than broad access
- Regularly review and audit family access

### 2. Security
- Always validate permissions at the API level
- Use middleware for consistent permission checking
- Log all access attempts and changes

### 3. User Experience
- Clear permission descriptions in invitations
- Intuitive access level categories
- Graceful handling of permission denials

## Future Enhancements

### Planned Features
- Role-based permission templates
- Bulk family member management
- Advanced notification preferences
- Integration with healthcare provider systems
- Mobile app push notifications

### Scalability Considerations
- Permission caching for high-traffic scenarios
- Batch permission checking for multiple patients
- Optimized database queries with proper indexing

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Verify user has required permissions
   - Check if access has been revoked or expired
   - Ensure proper patientId in request

2. **Invitation Not Working**
   - Check email delivery (SendGrid configuration)
   - Verify invitation hasn't expired
   - Confirm invitation token is valid

3. **Emergency Access Issues**
   - Check if emergency access has expired
   - Verify emergency access was properly granted
   - Ensure user has emergency contact priority

### Debug Commands
```bash
# Check family access for patient
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/family-access/patient/PATIENT_ID

# Test permission check
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/family-access/check-permission/PATIENT_ID/canView
```

## Support

For technical support or questions about the Family Access System:
- Review this documentation
- Check the test files for usage examples
- Examine the middleware implementation for permission logic
- Consult the service layer for business logic details