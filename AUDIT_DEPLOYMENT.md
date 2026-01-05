# Audit Logging System - Deployment Guide

This guide covers deploying the audit logging system to your Firebase project.

## Prerequisites

- Firebase CLI installed and authenticated
- Firebase project configured (see [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md))
- Admin access to Firebase Console

## Deployment Steps

### 1. Deploy Firestore Indexes

Deploy the composite indexes required for efficient audit log queries:

```bash
firebase deploy --only firestore:indexes
```

**Expected output:**
```
✔  firestore: deployed indexes
```

**Note:** Index creation can take several minutes. Monitor progress in Firebase Console → Firestore → Indexes.

### 2. Deploy Firestore Security Rules

Deploy updated security rules that protect audit logs:

```bash
firebase deploy --only firestore:rules
```

**Expected output:**
```
✔  firestore: deployed security rules
```

**Security Rules Applied:**
- ✅ Client-side writes to `audit_logs` are **DENIED**
- ✅ Users can read their own audit logs
- ✅ Server-side writes via Admin SDK are allowed

### 3. Configure TTL (Time-to-Live)

Audit logs are automatically deleted after 90 days to comply with data retention policies.

#### Enable TTL via Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** → **Settings** (gear icon)
4. Scroll to **Time-to-live (TTL)**
5. Click **Enable TTL**
6. Configure the TTL policy:
   - **Collection Group:** `audit_logs`
   - **Field:** `createdAt`
   - **Expiration:** `7776000` seconds (90 days)
7. Click **Save**

#### Verify TTL Configuration:

```bash
# Check if TTL is enabled in your firestore.indexes.json
grep -A 5 "fieldOverrides" firestore.indexes.json
```

**Expected output:**
```json
"fieldOverrides": [
  {
    "collectionGroup": "audit_logs",
    "fieldPath": "createdAt",
    "ttl": true
  }
]
```

### 4. Deploy Cloud Functions (if applicable)

If you're using Cloud Functions for server-side operations:

```bash
firebase deploy --only functions
```

This ensures the audit service is available in your Cloud Functions environment.

### 5. Verify Deployment

#### Check Index Status

1. Go to Firebase Console → Firestore → Indexes
2. Verify all audit log indexes show status: **Enabled**
3. Look for these indexes:
   - `audit_logs`: userId + timestamp
   - `audit_logs`: action + timestamp
   - `audit_logs`: result + timestamp
   - `audit_logs`: resource + timestamp
   - `audit_logs`: resourceId + timestamp
   - `audit_logs`: ipAddress + timestamp

#### Test Audit Logging

Run a test to verify logging works:

```typescript
// In your application or test script
import { AuditService } from './shared/services/auditService';
import { AuditAction, AuditResult } from './shared/types';
import { db } from './firebase-admin';

const auditService = new AuditService({ db });

// Test logging
await auditService.log({
  userId: 'test-user',
  userEmail: 'test@example.com',
  action: AuditAction.LOGIN,
  resource: 'test',
  result: AuditResult.SUCCESS,
});

// Test retrieval
const logs = await auditService.getLogsByUserId('test-user', 10);
console.log('Audit logs retrieved:', logs.length);
```

## Post-Deployment Configuration

### 1. Update Service Initialization

Ensure all services are initialized with audit service:

```typescript
// Example: In your server startup
import { AuditService } from './shared/services/auditService';
import { AccessService } from './shared/services/accessService';

const auditService = new AuditService({ db });
const accessService = new AccessService({ db, auditService });

// Pass to middleware
const authMiddleware = createAuthMiddleware({ 
  verifyIdToken, 
  auditService 
});
```

### 2. Configure Monitoring (Optional)

Set up monitoring for security events:

1. **Firebase Console Alerts:**
   - Go to Firebase Console → Firestore
   - Set up alerts for unusual query patterns
   - Monitor index usage

2. **Custom Monitoring:**
   - Implement daily security event checks
   - Alert on spike in failed login attempts
   - Monitor denied access patterns

Example monitoring query:

```typescript
// Run daily to check for security anomalies
async function checkSecurityEvents() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const securityEvents = await auditService.getSecurityEvents(1000);
  
  const recentEvents = securityEvents.filter(
    event => event.timestamp > yesterday
  );
  
  if (recentEvents.length > 100) {
    // Alert: High number of security events
    console.warn('High security event count:', recentEvents.length);
  }
}
```

### 3. Export Configuration (Optional)

For compliance or backup purposes, you may want to export audit logs:

```typescript
// Example: Export to Cloud Storage
async function exportAuditLogs(startDate: Date, endDate: Date) {
  const logs = await auditService.getLogsByDateRange(startDate, endDate, 10000);
  
  // Convert to CSV or JSON
  const json = JSON.stringify(logs, null, 2);
  
  // Upload to Cloud Storage or download
  // ... implementation depends on your needs
}
```

## Rollback Procedure

If you need to rollback the deployment:

### 1. Rollback Firestore Rules

```bash
# Edit firestore.rules to remove audit_logs section
# Then deploy
firebase deploy --only firestore:rules
```

### 2. Remove Indexes

```bash
# Edit firestore.indexes.json to remove audit_logs indexes
# Then deploy
firebase deploy --only firestore:indexes
```

**Note:** You cannot delete data via rollback. Clean up audit logs manually if needed.

## Troubleshooting

### Index Creation Fails

**Problem:** Index stays in "Building" state for >30 minutes

**Solution:**
1. Check Firebase Console for specific error messages
2. Verify you're on a paid Firebase plan (indexes may be limited on free tier)
3. Delete and recreate the index
4. Contact Firebase Support if issue persists

### Permission Denied Errors

**Problem:** Client code throws permission denied when writing audit logs

**Solution:**
This is expected behavior! Audit logs should only be written server-side via Admin SDK. Check:
1. Are you trying to write from client code? (Don't do this)
2. Is your server using Admin SDK? (Required)
3. Are the firestore.rules correctly deployed?

### Missing Audit Logs

**Problem:** Expected audit logs are not being created

**Solution:**
1. Check server logs for audit service errors
2. Verify audit service is initialized and passed to services/middleware
3. Ensure logging is not being silently caught/ignored
4. Test with manual log creation

### High Storage Costs

**Problem:** audit_logs collection is consuming too much storage

**Solution:**
1. Verify TTL is configured correctly (should auto-delete after 90 days)
2. Manually query and delete old logs if needed:
   ```typescript
   // Delete logs older than 90 days
   const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
   const oldLogs = await db.collection('audit_logs')
     .where('createdAt', '<', cutoffDate)
     .get();
   
   const batch = db.batch();
   oldLogs.docs.forEach(doc => batch.delete(doc.ref));
   await batch.commit();
   ```
3. Consider reducing retention period if 90 days is not required

## Security Checklist

After deployment, verify:

- [ ] Firestore indexes deployed successfully
- [ ] Firestore security rules deployed successfully
- [ ] TTL configured for 90-day retention
- [ ] Client cannot write to audit_logs collection
- [ ] Server can write to audit_logs via Admin SDK
- [ ] Users can read their own audit logs
- [ ] Test logging works in production
- [ ] Monitoring/alerting configured (if applicable)

## Compliance Notes

### HIPAA Compliance

The audit logging system helps with HIPAA compliance by providing:

- ✅ Access logs for PHI
- ✅ Audit trail of who accessed what and when
- ✅ Failed access attempt tracking
- ✅ Minimum 90-day retention

**Important:** This is a technical implementation. Consult with legal/compliance team to ensure full HIPAA compliance.

### Data Retention Policy

Default retention: **90 days**

To change retention period:
1. Update TTL configuration in Firebase Console
2. Document in your compliance records
3. Update [`AUDIT_LOGGING.md`](AUDIT_LOGGING.md) documentation

## Support

For deployment issues:

1. Check this deployment guide
2. Review [`AUDIT_LOGGING.md`](AUDIT_LOGGING.md) for usage
3. Check [`FIRESTORE_INDEXES.md`](FIRESTORE_INDEXES.md) for index details
4. Consult Firebase documentation
5. Contact development team

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-05  
**Deployment Status:** Ready for Production
