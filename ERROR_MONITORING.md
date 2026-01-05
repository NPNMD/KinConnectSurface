# Error Monitoring with Sentry

This document describes the error monitoring and performance tracking setup for KinConnect using [Sentry](https://sentry.io/).

## Table of Contents

- [Overview](#overview)
- [Setup Guide](#setup-guide)
- [Configuration](#configuration)
- [Features](#features)
- [HIPAA Compliance](#hipaa-compliance)
- [Usage Guide](#usage-guide)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Alert Configuration](#alert-configuration)

## Overview

KinConnect uses Sentry for comprehensive error tracking and performance monitoring across both client-side (React) and server-side (Firebase Functions) code. Sentry provides:

- **Automatic error capture** with detailed stack traces
- **Performance monitoring** with transaction tracing
- **User context** for debugging (non-PHI only)
- **Custom tagging and categorization**
- **Release tracking** for error regression detection
- **Breadcrumbs** for understanding user actions leading to errors
- **HIPAA-compliant data filtering** to prevent PHI/PII leakage

## Setup Guide

### 1. Create a Sentry Account

1. Sign up at [sentry.io](https://sentry.io/)
2. Create a new organization
3. Create two projects (or use one for both):
   - **React** (for client-side monitoring)
   - **Node.js** (for server-side monitoring)

### 2. Get Your DSN Keys

1. Navigate to **Settings** → **Projects** → **[Your Project]** → **Client Keys (DSN)**
2. Copy the DSN URL (looks like: `https://xxxxx@sentry.io/xxxxx`)
3. You can use the same DSN for both client and server, or separate ones for better organization

### 3. Configure Environment Variables

Add the following to your `.env` file (see [`.env.example`](.env.example:42) for reference):

#### Client-Side (React/Vite)
```env
VITE_SENTRY_DSN=https://your_sentry_dsn@sentry.io/your_project_id
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_RELEASE=1.0.0
VITE_ENABLE_ERROR_TRACKING=true
VITE_SENTRY_DEBUG=false
```

#### Server-Side (Node.js/Firebase Functions)
```env
SENTRY_DSN=https://your_sentry_dsn@sentry.io/your_project_id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_RELEASE=1.0.0
ENABLE_ERROR_TRACKING=true
```

#### Firebase Functions Configuration

For Firebase Functions, add Sentry DSN as a secret:
```bash
firebase functions:secrets:set SENTRY_DSN
```

Update [`functions/src/index.ts`](functions/src/index.ts:228) to include `SENTRY_DSN` in the secrets array:
```typescript
export const api = functions
  .runWith({
    secrets: ['RESEND_API_KEY', 'SENTRY_DSN', ...],
  })
  .https.onRequest(app);
```

### 4. Install Dependencies

Dependencies are already added to [`package.json`](package.json:20) and [`functions/package.json`](functions/package.json:14):

```bash
# Install client dependencies
npm install

# Install Functions dependencies
cd functions
npm install
```

### 5. Enable Error Tracking

Set the feature flag to `true` in your environment:
```env
VITE_ENABLE_ERROR_TRACKING=true  # Client-side
ENABLE_ERROR_TRACKING=true        # Server-side
```

## Configuration

### Client-Side Configuration

Client-side Sentry is initialized in [`client/src/lib/sentry.ts`](client/src/lib/sentry.ts:1) and called from [`client/src/main.tsx`](client/src/main.tsx:8).

**Key Configuration Options:**
- **DSN**: Your Sentry project DSN
- **Environment**: `development`, `staging`, or `production`
- **Traces Sample Rate**: Percentage of transactions to monitor (0.0 to 1.0)
- **Release**: Version number for release tracking
- **Enabled**: Typically disabled in development, enabled in production

### Server-Side Configuration

Server-side Sentry is initialized in [`shared/services/sentryService.ts`](shared/services/sentryService.ts:1) and called from [`functions/src/index.ts`](functions/src/index.ts:36).

**Middleware Order** (important!):
1. Sentry request handler (first)
2. Sentry tracing handler (second)
3. Other middleware (CORS, helmet, etc.)
4. Routes
5. Sentry error handler (last)

### Sensitive Data Filtering

Both client and server implementations include comprehensive data scrubbing to prevent PHI/PII from being sent to Sentry. See [HIPAA Compliance](#hipaa-compliance) for details.

## Features

### 1. Automatic Error Capture

All uncaught errors and unhandled promise rejections are automatically captured and reported to Sentry.

**Client-side:**
```typescript
// Errors are automatically captured via ErrorBoundary
throw new Error('Something went wrong');
```

**Server-side:**
```typescript
// Errors are automatically captured via Sentry middleware
app.get('/api/example', (req, res) => {
  throw new Error('Something went wrong');
});
```

### 2. Manual Error Capture

You can manually capture errors with additional context:

```typescript
import { captureSentryException } from '@/lib/sentry'; // Client
import { captureSentryException } from '../../shared/services/sentryService'; // Server

try {
  // Some operation
} catch (error) {
  captureSentryException(error as Error, {
    tags: {
      feature: 'medication-search',
      component: 'MedicationSearch',
    },
    extra: {
      searchTerm: 'aspirin', // Non-sensitive data only
      resultCount: 10,
    },
  });
}
```

### 3. User Context

Track which user encountered an error (using non-PHI identifiers only):

```typescript
import { setSentryUser, clearSentryUser } from '@/lib/sentry';

// On login (client-side example)
setSentryUser({
  id: user.uid,           // Firebase UID - not PHI
  role: user.role,        // User role - not PHI
  // DO NOT include: email, name, or any PHI
});

// On logout
clearSentryUser();
```

### 4. Custom Tags and Context

Add custom metadata to error reports:

```typescript
import { setSentryContext } from '@/lib/sentry';

setSentryContext({
  tags: {
    environment: 'production',
    feature: 'appointments',
    apiVersion: 'v2',
  },
  extra: {
    deviceType: 'mobile',
    browserVersion: '120.0',
    // Only non-sensitive data
  },
});
```

### 5. Breadcrumbs

Add custom breadcrumbs to track user actions:

```typescript
import { addSentryBreadcrumb } from '../../shared/services/sentryService';

addSentryBreadcrumb({
  message: 'User searched for medication',
  category: 'user-action',
  level: 'info',
  data: {
    action: 'search',
    // Non-sensitive data only
  },
});
```

### 6. Performance Monitoring

Sentry automatically tracks:
- **Page load times** (client-side)
- **API response times** (server-side)
- **Database query performance**
- **Custom transactions**

Sample rate is configured via `SENTRY_TRACES_SAMPLE_RATE` (default: 10% of requests).

### 7. Release Tracking

Track errors by release version:

```bash
# Set release version
export VITE_SENTRY_RELEASE=$(git rev-parse HEAD)
export SENTRY_RELEASE=$(git rev-parse HEAD)

# Build and deploy
npm run build
firebase deploy
```

## HIPAA Compliance

### PHI/PII Protection

**Sensitive fields automatically scrubbed:**
- Passwords, tokens, API keys
- Names (first, last, full)
- Email addresses, phone numbers
- Date of birth, addresses
- Medical record numbers (MRN)
- Diagnoses, conditions
- Medications, prescriptions
- Allergy descriptions
- Clinical notes

### Data Filtering Implementation

All data sent to Sentry passes through [`scrubSensitiveData()`](shared/services/sentryService.ts:48) which:
1. Recursively traverses objects and arrays
2. Redacts fields matching sensitive patterns
3. Redacts long alphanumeric strings (potential tokens)
4. Scrubs URLs with sensitive query parameters
5. Filters HTTP headers and request bodies

### Compliance Recommendations

1. **Never log PHI** in error messages or custom contexts
2. **Use anonymized IDs** (Firebase UIDs) instead of names/emails
3. **Review error reports** to ensure no PHI leakage
4. **Configure Sentry data retention** per your compliance requirements
5. **Sign a BAA** (Business Associate Agreement) with Sentry if required
6. **Enable data residency** if required (Sentry offers EU hosting)

### Audit Trail

All error tracking is logged alongside the [audit logging system](AUDIT_LOGGING.md). When an error is captured:
1. Sentry receives scrubbed error data
2. Audit log records the error event (with full context)
3. Both systems can be correlated for investigation

## Usage Guide

### Viewing Errors in Sentry

1. Log in to [sentry.io](https://sentry.io/)
2. Select your project
3. Navigate to **Issues** to see all errors
4. Click on an issue to see:
   - Stack trace
   - User context (non-PHI)
   - Breadcrumbs (user actions)
   - Tags and metadata
   - Affected users count
   - First/last seen timestamps

### Error Triage Workflow

1. **Identify**: Check Sentry dashboard for new errors
2. **Prioritize**: Sort by frequency, user impact, or severity
3. **Investigate**: Review stack trace, breadcrumbs, and context
4. **Reproduce**: Use breadcrumbs to replicate user actions
5. **Fix**: Implement fix and deploy
6. **Verify**: Monitor for resolution in subsequent releases
7. **Resolve**: Mark issue as resolved in Sentry

### Filtering and Searching

**By Tag:**
```
environment:production
feature:medication-search
role:caregiver
```

**By Release:**
```
release:1.2.0
```

**By User:**
```
user.id:abc123xyz
```

**Combined:**
```
environment:production AND feature:appointments
```

## Best Practices

### 1. Error Messages

**Good:**
```typescript
throw new Error('Failed to fetch medications: Network timeout');
```

**Bad (includes PHI):**
```typescript
throw new Error(`Failed to fetch medications for patient John Doe (DOB: 1980-01-01)`);
```

### 2. Custom Context

**Good:**
```typescript
captureSentryException(error, {
  tags: { feature: 'medication-add' },
  extra: { medicationCount: 5 }
});
```

**Bad (includes PHI):**
```typescript
captureSentryException(error, {
  extra: { 
    patientName: 'John Doe',
    medications: ['Aspirin 81mg']
  }
});
```

### 3. Performance Monitoring

- Keep sample rate low in production (5-10%) to control costs
- Increase sample rate in staging for thorough testing
- Use custom transactions for critical operations:

```typescript
import { Sentry } from '@/lib/sentry';

const transaction = Sentry.startTransaction({
  name: 'medication-search',
  op: 'search',
});

try {
  // Perform search
  const results = await searchMedications(term);
} finally {
  transaction.finish();
}
```

### 4. Development vs Production

- **Development**: Disable or use debug mode
  ```env
  VITE_ENABLE_ERROR_TRACKING=false
  VITE_SENTRY_DEBUG=true
  ```

- **Production**: Enable with appropriate sample rate
  ```env
  VITE_ENABLE_ERROR_TRACKING=true
  VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
  ```

## Troubleshooting

### Sentry Not Initializing

**Check:**
1. DSN is correctly set in environment variables
2. `ENABLE_ERROR_TRACKING` is set to `true`
3. No console errors during initialization
4. Network access to `sentry.io` is not blocked

**Debug:**
```env
VITE_SENTRY_DEBUG=true
```

### Errors Not Being Captured

**Check:**
1. Sentry initialized before application code runs
2. Error boundary wraps your React app
3. Sentry middleware is properly ordered (server-side)
4. Error is not in the `ignoreErrors` list

### Too Many Events

**Solution:**
1. Reduce `SENTRY_TRACES_SAMPLE_RATE`
2. Add more errors to `ignoreErrors` list
3. Implement rate limiting per error type
4. Review and fix high-frequency errors

### PHI Being Sent to Sentry

**Immediate Action:**
1. Delete the affected events in Sentry
2. Review and enhance data scrubbing logic
3. Audit all custom context and tags
4. Update sensitive field patterns

## Alert Configuration

### Setting Up Alerts in Sentry

1. Navigate to **Alerts** → **Create Alert Rule**
2. Choose alert conditions:
   - **Issue States**: First seen, regression, etc.
   - **Frequency**: X events in Y minutes
   - **User impact**: Unique users affected
3. Configure notifications:
   - Email
   - Slack
   - PagerDuty
   - Webhooks

### Recommended Alerts

#### 1. Critical Errors
- **Condition**: Any error with tag `severity:critical`
- **Frequency**: Immediately
- **Notification**: PagerDuty + Email

#### 2. High-Frequency Errors
- **Condition**: >50 events in 5 minutes
- **Frequency**: Once per 15 minutes
- **Notification**: Slack + Email

#### 3. New Errors
- **Condition**: Issue is first seen
- **Frequency**: Immediately
- **Notification**: Slack

#### 4. Regression Errors
- **Condition**: Issue resurfaces after being resolved
- **Frequency**: Immediately
- **Notification**: Email to dev team

#### 5. Performance Degradation
- **Condition**: Transaction duration >2s (P95)
- **Frequency**: Sustained for 10 minutes
- **Notification**: Slack

### Alert Best Practices

1. **Start conservative**: Avoid alert fatigue
2. **Use environments**: Separate production from staging alerts
3. **Group related errors**: Use tags to categorize and route
4. **Set up escalation**: Critical alerts should escalate if unacknowledged
5. **Review regularly**: Adjust thresholds based on patterns

## Related Documentation

- [Audit Logging](AUDIT_LOGGING.md) - Comprehensive audit trail system
- [Deployment Guide](DEPLOYMENT.md) - Production deployment procedures
- [Firebase Setup](FIREBASE_SETUP.md) - Firebase configuration
- [Implementation Roadmap](plans/IMPLEMENTATION_ROADMAP.md) - Feature roadmap

## Support

For issues with Sentry integration:
1. Check Sentry documentation: https://docs.sentry.io/
2. Review this guide and troubleshooting section
3. Check Sentry status: https://status.sentry.io/
4. Contact support at: support@kinconnect.com

---

**Last Updated**: 2026-01-05  
**Version**: 1.0.0
