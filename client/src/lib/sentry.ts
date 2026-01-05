/**
 * Client-Side Sentry Initialization
 * 
 * Initializes Sentry for React with appropriate configuration
 * and sensitive data filtering for HIPAA compliance
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Sensitive field names to filter from error reports
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'auth',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'idToken',
  'credit_card',
  'creditCard',
  'ssn',
  'social_security',
  'medicalRecordNumber',
  'mrn',
  // PHI/PII fields
  'dob',
  'dateOfBirth',
  'birthDate',
  'address',
  'phoneNumber',
  'phone',
  'email',
  'firstName',
  'lastName',
  'fullName',
  'diagnosis',
  'condition',
  'medication',
  'prescription',
  'allergyDescription',
  'notes',
];

/**
 * Recursively scrub sensitive data from objects
 */
function scrubSensitiveData(data: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[Max Depth Exceeded]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check if string looks like sensitive data (token-like)
    if (data.length > 20 && /^[A-Za-z0-9+/=_-]+$/.test(data)) {
      return '[REDACTED_TOKEN]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => scrubSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const scrubbed: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Check if key matches sensitive field patterns
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_FIELDS.some(field => 
          lowerKey.includes(field.toLowerCase())
        );

        if (isSensitive) {
          scrubbed[key] = '[REDACTED]';
        } else {
          scrubbed[key] = scrubSensitiveData(data[key], depth + 1);
        }
      }
    }
    return scrubbed;
  }

  return data;
}

/**
 * Initialize Sentry for React
 */
export function initSentry(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const enableErrorTracking = import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true';
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;

  // Only initialize if error tracking is enabled and DSN is configured
  if (!enableErrorTracking || !sentryDsn) {
    console.log('Sentry error tracking is disabled or DSN not configured');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release: import.meta.env.VITE_SENTRY_RELEASE,
      
      // Performance monitoring
      integrations: [
        new BrowserTracing({
          // Set tracePropagationTargets to control which outgoing requests have tracing headers attached
          tracePropagationTargets: [
            'localhost',
            /^https:\/\/.*\.kinconnect\.com/,
            /^https:\/\/.*\.cloudfunctions\.net/,
          ],
        }),
      ],
      
      tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      
      // Data scrubbing and filtering
      beforeSend(event) {
        // Filter sensitive data from the event
        if (event.request) {
          // Scrub POST data
          if (event.request.data) {
            event.request.data = scrubSensitiveData(event.request.data);
          }
          
          // Scrub headers
          if (event.request.headers) {
            event.request.headers = scrubSensitiveData(event.request.headers);
          }
        }
        
        // Scrub extra data
        if (event.extra) {
          event.extra = scrubSensitiveData(event.extra);
        }
        
        // Scrub context data
        if (event.contexts) {
          event.contexts = scrubSensitiveData(event.contexts);
        }
        
        // Scrub breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
            ...breadcrumb,
            data: breadcrumb.data ? scrubSensitiveData(breadcrumb.data) : undefined,
          }));
        }
        
        return event;
      },
      
      // Ignore certain errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'ChunkLoadError',
        // Random network errors
        'NetworkError',
        'Network request failed',
        'Failed to fetch',
        // Firebase errors that are expected
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        // ResizeObserver loop errors (common in browsers, not actionable)
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
      ],
      
      // Don't capture errors in development
      enabled: import.meta.env.MODE !== 'development' || import.meta.env.VITE_SENTRY_DEBUG === 'true',
      
      // Debug mode
      debug: import.meta.env.VITE_SENTRY_DEBUG === 'true',
    });

    console.log('Sentry initialized successfully for React');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    // Don't throw - gracefully degrade if Sentry fails
  }
}

/**
 * Set user context for error tracking
 * Note: Only set non-PHI user identifiers
 */
export function setSentryUser(user: {
  id: string;
  role?: string;
  // DO NOT include: email, name, PHI, or PII
}): void {
  try {
    Sentry.setUser({
      id: user.id,
      role: user.role,
    });
  } catch (error) {
    console.error('Failed to set Sentry user:', error);
  }
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearSentryUser(): void {
  try {
    Sentry.setUser(null);
  } catch (error) {
    console.error('Failed to clear Sentry user:', error);
  }
}

/**
 * Add custom context/tags to error reports
 */
export function setSentryContext(context: {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, any>;
}): void {
  try {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        Sentry.setTag(key, String(value));
      });
    }

    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        Sentry.setContext(key, scrubSensitiveData(value));
      });
    }
  } catch (error) {
    console.error('Failed to set Sentry context:', error);
  }
}

/**
 * Manually capture an exception
 */
export function captureSentryException(error: Error, context?: {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, any>;
}): void {
  try {
    if (context) {
      Sentry.withScope(scope => {
        if (context.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, String(value));
          });
        }
        
        if (context.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setContext(key, scrubSensitiveData(value));
          });
        }
        
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (err) {
    console.error('Failed to capture exception in Sentry:', err);
    console.error('Original error:', error);
  }
}

/**
 * Create a custom Sentry transaction for performance tracking
 */
export function startTransaction(
  name: string,
  op: string,
  tags?: Record<string, string | number | boolean>
): any {
  try {
    const transaction = Sentry.startTransaction({
      name,
      op,
      tags,
    });
    return transaction;
  } catch (error) {
    console.error('Failed to start Sentry transaction:', error);
    // Return a no-op object
    return {
      setMeasurement: () => {},
      setTag: () => {},
      setData: () => {},
      finish: () => {},
      startChild: () => ({
        setMeasurement: () => {},
        setTag: () => {},
        setData: () => {},
        finish: () => {},
      }),
    };
  }
}

/**
 * Track login performance
 */
export function trackLoginPerformance(
  provider: string,
  duration: number,
  success: boolean
): void {
  try {
    const transaction = Sentry.startTransaction({
      op: 'user.login',
      name: `Login via ${provider}`,
      tags: {
        provider,
        success,
      },
    });

    transaction.setMeasurement('login_duration', duration, 'millisecond');
    transaction.finish();
  } catch (error) {
    console.error('Failed to track login performance:', error);
  }
}

/**
 * Track medication creation performance
 */
export function trackMedicationCreation(duration: number, success: boolean): void {
  try {
    const transaction = Sentry.startTransaction({
      op: 'medication.create',
      name: 'Create Medication',
      tags: {
        success,
      },
    });

    transaction.setMeasurement('creation_duration', duration, 'millisecond');
    transaction.finish();
  } catch (error) {
    console.error('Failed to track medication creation:', error);
  }
}

/**
 * Track drug search performance
 */
export function trackDrugSearch(
  query: string,
  resultCount: number,
  duration: number
): void {
  try {
    const transaction = Sentry.startTransaction({
      op: 'drug.search',
      name: 'Drug Search',
      tags: {
        hasResults: resultCount > 0,
      },
    });

    transaction.setMeasurement('search_duration', duration, 'millisecond');
    transaction.setMeasurement('result_count', resultCount, 'none');
    transaction.setData('query_length', query.length);
    transaction.finish();
  } catch (error) {
    console.error('Failed to track drug search:', error);
  }
}

/**
 * Track component render performance
 */
export function trackComponentRender(
  componentName: string,
  renderTime: number
): void {
  try {
    const transaction = Sentry.startTransaction({
      op: 'ui.react.render',
      name: `Render ${componentName}`,
      tags: {
        component: componentName,
      },
    });

    transaction.setMeasurement('render_time', renderTime, 'millisecond');
    transaction.finish();
  } catch (error) {
    console.error('Failed to track component render:', error);
  }
}

/**
 * Track API call performance
 */
export function trackApiCall(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  try {
    const transaction = Sentry.startTransaction({
      op: 'http.client',
      name: `${method} ${endpoint}`,
      tags: {
        endpoint,
        method,
        statusCode,
        success: statusCode >= 200 && statusCode < 300,
      },
    });

    transaction.setMeasurement('api_duration', duration, 'millisecond');
    transaction.finish();
  } catch (error) {
    console.error('Failed to track API call:', error);
  }
}

/**
 * Track page load performance
 */
export function trackPageLoad(pageName: string, loadTime: number): void {
  try {
    const transaction = Sentry.startTransaction({
      op: 'navigation',
      name: `Load ${pageName}`,
      tags: {
        page: pageName,
      },
    });

    transaction.setMeasurement('page_load_time', loadTime, 'millisecond');
    transaction.finish();
  } catch (error) {
    console.error('Failed to track page load:', error);
  }
}

/**
 * Measure an async operation and track in Sentry
 */
export async function measureAsync<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>,
  tags?: Record<string, string | number | boolean>
): Promise<T> {
  const startTime = performance.now();
  const transaction = startTransaction(name, operation, tags);

  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    transaction.setMeasurement('duration', duration, 'millisecond');
    transaction.setTag('success', true);
    transaction.finish();
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    transaction.setMeasurement('duration', duration, 'millisecond');
    transaction.setTag('success', false);
    transaction.finish();
    
    throw error;
  }
}

// Export Sentry for direct access if needed
export { Sentry };
