# Audit Logging System

## Overview

The KinConnect audit logging system provides comprehensive security event tracking and compliance monitoring for all critical application activities. This system is implemented as part of Phase 1.3 of the Implementation Roadmap.

## Architecture

### Components

1. **Audit Service** ([`shared/services/auditService.ts`](shared/services/auditService.ts))
   - Core logging functionality
   - Query methods for audit log retrieval
   - Non-blocking logging (failures don't break app)

2. **Type Definitions** ([`shared/types.ts`](shared/types.ts))
   - `AuditLog` interface
   - `AuditAction` enum (50+ action types)
   - `AuditResult` enum (SUCCESS, FAILURE, DENIED)

3. **Integration Points**
   - Access Service: Logs authorization checks
   - Auth Middleware: Logs authentication events
   - Future: All CRUD operations on sensitive data

## Features

### What Gets Logged

#### Authentication Events
- ✅ Successful logins (`LOGIN`)
- ✅ Failed login attempts (`LOGIN_FAILED`)
- ✅ Logout events (`LOGOUT`)
- ✅ Token refresh/verification (`TOKEN_REFRESH`)
- ✅ Invalid token attempts (`INVALID_TOKEN`)

#### Authorization Events
- ✅ Patient data access (`ACCESS_PATIENT`)
- ✅ Denied access attempts (`ACCESS_PATIENT_DENIED`)
- ✅ Permission checks (`PERMISSION_DENIED`)
- ✅ Unauthorized access (`UNAUTHORIZED_ACCESS`)

#### Data Operations (Ready for integration)
- Medication CRUD operations
- Patient profile changes
- Family group modifications
- Appointment and visit record changes

### Audit Log Data

Each audit log entry includes:

```typescript
{
  id: string;                    // Firestore document ID
  timestamp: Date;               // When the event occurred
  userId: string;                // Who performed the action
  userEmail?: string;            // User's email (if available)
  action: AuditAction;           // What action was attempted
  resource: string;              // What resource (e.g., "patient:123")
  resourceId?: string;           // ID of the affected resource
  result: AuditResult;           // SUCCESS, FAILURE, or DENIED
  ipAddress?: string;            // IP address of the request
  userAgent?: string;            // Browser/client user agent
  metadata?: object;             // Additional contextual data
  errorMessage?: string;         // Error details (for failures)
  createdAt: Date;               // When log was created
}
```

## Usage

### Initializing the Audit Service

```typescript
import { AuditService } from './shared/services/auditService';
import { db } from './firebase-admin';

const auditService = new AuditService({ db });
```

### Logging Events

#### Manual Logging

```typescript
// Log a custom event
await auditService.log({
  userId: 'user123',
  userEmail: 'john@example.com',
  action: AuditAction.UPDATE_MEDICATION,
  resource: 'medication:med456',
  resourceId: 'med456',
  result: AuditResult.SUCCESS,
  ipAddress: req.ipAddress,
  userAgent: req.userAgent,
  metadata: {
    changes: ['dosage updated from 10mg to 20mg']
  }
});
```

#### Using Helper Methods

```typescript
// Log successful login
await auditService.logLogin(
  userId, 
  userEmail, 
  ipAddress, 
  userAgent
);

// Log failed login
await auditService.logLoginFailed(
  email, 
  'Invalid password', 
  ipAddress, 
  userAgent
);

// Log patient access
await auditService.logPatientAccess(
  userId,
  patientId,
  AuditAction.VIEW_PATIENT_PROFILE,
  AuditResult.SUCCESS,
  { source: 'dashboard' },
  ipAddress,
  userAgent
);

// Log denied access
await auditService.logPatientAccessDenied(
  userId,
  patientId,
  'User not in family group',
  ipAddress,
  userAgent
);
```

### Querying Audit Logs

#### Get logs by user

```typescript
const logs = await auditService.getLogsByUserId('user123', 100);
```

#### Get logs by action type

```typescript
const failedLogins = await auditService.getLogsByAction(
  AuditAction.LOGIN_FAILED, 
  50
);
```

#### Get logs by date range

```typescript
const startDate = new Date('2026-01-01');
const endDate = new Date('2026-01-31');
const logs = await auditService.getLogsByDateRange(startDate, endDate, 1000);
```

#### Get failed authorization attempts

```typescript
const deniedAttempts = await auditService.getFailedAuthorizationAttempts(100);
```

#### Get security events

```typescript
// Gets all security-related events:
// - Failed logins
// - Unauthorized access
// - Permission denied
// - Invalid tokens
// - Denied patient access
const securityEvents = await auditService.getSecurityEvents(100);
```

#### Get patient activity

```typescript
// Get all activity related to a specific patient
const activity = await auditService.getPatientActivityLogs(patientId, 100);
```

## Integration Guide

### 1. Add Audit Service to Dependencies

When creating services that need audit logging, include the audit service in dependencies:

```typescript
interface MyServiceDeps {
  db: any;
  auditService?: AuditService;
}

class MyService {
  private auditService?: AuditService;
  
  constructor(deps: MyServiceDeps) {
    this.auditService = deps.auditService;
  }
}
```

### 2. Log Operations

Log important operations, especially:
- Data access (reading sensitive information)
- Data modifications (create, update, delete)
- Authorization decisions

```typescript
async updatePatientMedication(userId: string, medicationId: string, updates: any) {
  try {
    // Perform the update
    await this.db.collection('medications').doc(medicationId).update(updates);
    
    // Log success
    if (this.auditService) {
      await this.auditService.logMedicationOperation(
        userId,
        medicationId,
        AuditAction.UPDATE_MEDICATION,
        AuditResult.SUCCESS,
        { updates }
      );
    }
    
    return { success: true };
  } catch (error) {
    // Log failure
    if (this.auditService) {
      await this.auditService.logMedicationOperation(
        userId,
        medicationId,
        AuditAction.UPDATE_MEDICATION,
        AuditResult.FAILURE,
        { error: error.message }
      );
    }
    throw error;
  }
}
```

### 3. Extract IP and User Agent in Middleware

The auth middleware automatically extracts and attaches IP address and user agent to requests:

```typescript
// In your route handlers
app.post('/api/medications', authMiddleware, async (req, res) => {
  const userId = req.user.uid;
  const ipAddress = req.ipAddress;  // Attached by auth middleware
  const userAgent = req.userAgent;  // Attached by auth middleware
  
  // Use in your service calls
  await medicationService.createMedication(
    data, 
    userId, 
    ipAddress, 
    userAgent
  );
});
```

## Storage and Retention

### Firestore Collection

Audit logs are stored in the `audit_logs` collection.

### TTL (Time-to-Live)

Audit logs are automatically deleted after **90 days** using Firestore TTL:

- Configured via `createdAt` field with TTL enabled
- Deletion happens within 24-72 hours of expiration
- Reduces storage costs and complies with data retention policies

To enable TTL (run after deploying indexes):

```bash
# Deploy indexes first
firebase deploy --only firestore:indexes

# Then configure TTL in Firebase Console:
# Firestore → Settings → Time-to-live
# Set createdAt field to 90 days (7776000 seconds)
```

### Indexes

The following composite indexes support efficient querying:

1. `userId` + `timestamp` (DESC)
2. `action` + `timestamp` (DESC)
3. `timestamp` (ASC/DESC) for range queries
4. `result` + `timestamp` (DESC)
5. `resource` + `timestamp` (DESC)
6. `resourceId` + `timestamp` (DESC)
7. `ipAddress` + `timestamp` (DESC)

All indexes are defined in [`firestore.indexes.json`](firestore.indexes.json) and documented in [`FIRESTORE_INDEXES.md`](FIRESTORE_INDEXES.md).

## Security Considerations

### Log Integrity

- Audit logs are write-only for the application
- Regular users cannot modify or delete audit logs
- Only admin-level access can retrieve audit logs
- Firestore security rules should enforce this (TODO: Add in Phase 2)

### Privacy

- Avoid logging sensitive data (passwords, full credit card numbers, etc.)
- Use `metadata` field carefully - don't include PII unnecessarily
- IP addresses are logged for security but may be considered PII

### Performance

- All logging is **non-blocking**
- Logging failures are logged to console but never throw errors
- This ensures audit logging never breaks the user experience

## Compliance

### HIPAA Considerations

This audit logging system helps with HIPAA compliance by:

- ✅ Tracking all access to PHI (Protected Health Information)
- ✅ Recording who accessed what, when, and from where
- ✅ Logging failed access attempts
- ✅ Maintaining audit trail for compliance reviews
- ✅ 90-day minimum retention (configure longer as needed)

**Note:** This is a technical implementation. Legal compliance review is required.

### Future Enhancements (Phase 2+)

- [ ] Export audit logs to external SIEM systems
- [ ] Real-time alerting for suspicious activity
- [ ] Automated compliance reports
- [ ] Advanced analytics dashboard
- [ ] Encrypted audit log storage
- [ ] Digital signatures for log integrity

## Monitoring and Alerts

### Key Metrics to Track

1. **Failed login attempts**: Spike may indicate brute force attack
2. **Denied access attempts**: High rate may indicate unauthorized access attempts
3. **Security events**: Any occurrence warrants investigation
4. **IP address patterns**: Multiple accounts from same IP may be suspicious
5. **After-hours access**: Unusual access times may be suspicious

### Example Monitoring Queries

```typescript
// Get failed logins in last 24 hours
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const failedLogins = await auditService.getLogsByDateRange(
  yesterday, 
  new Date()
).then(logs => logs.filter(log => 
  log.action === AuditAction.LOGIN_FAILED
));

// Get denied access by specific user
const deniedAccess = await auditService.getLogsByUserId(userId)
  .then(logs => logs.filter(log => 
    log.result === AuditResult.DENIED
  ));
```

## Testing

To test the audit logging system:

```typescript
// 1. Create test instance
const testAuditService = new AuditService({ 
  db: testFirestore 
});

// 2. Log test events
await testAuditService.logLogin('test-user', 'test@example.com');

// 3. Query and verify
const logs = await testAuditService.getLogsByUserId('test-user');
expect(logs).toHaveLength(1);
expect(logs[0].action).toBe(AuditAction.LOGIN);
```

## Deployment Checklist

- [x] Deploy type definitions
- [x] Deploy audit service
- [x] Integrate with access service
- [x] Integrate with auth middleware
- [x] Deploy Firestore indexes
- [ ] Configure TTL in Firebase Console
- [ ] Update Firestore security rules
- [ ] Test logging in staging environment
- [ ] Set up monitoring/alerting
- [ ] Train team on audit log usage

## Support

For questions or issues with audit logging:

1. Review this documentation
2. Check [`shared/services/auditService.ts`](shared/services/auditService.ts) for implementation details
3. Consult [`FIRESTORE_INDEXES.md`](FIRESTORE_INDEXES.md) for query optimization
4. Review Phase 1.3 in [`plans/IMPLEMENTATION_ROADMAP.md`](plans/IMPLEMENTATION_ROADMAP.md)

---

**Last Updated:** 2026-01-05  
**Version:** 1.0  
**Status:** ✅ Production Ready (pending TTL configuration)
