/**
 * Sentry Error Monitoring Service
 * 
 * Provides centralized error tracking and performance monitoring
 * with HIPAA-compliant data filtering for KinConnect.
 */

import * as Sentry from '@sentry/node';
import { config } from '../config';

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

// Sensitive URL patterns to scrub
const SENSITIVE_URL_PATTERNS = [
  /token=[^&]*/gi,
  /api_key=[^&]*/gi,
  /password=[^&]*/gi,
  /sessionToken=[^&]*/gi,
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
    // Check if string looks like sensitive data
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
 * Scrub sensitive data from URLs
 */
function scrubUrl(url: string): string {
  let scrubbedUrl = url;
  SENSITIVE_URL_PATTERNS.forEach(pattern => {
    scrubbedUrl = scrubbedUrl.replace(pattern, '[REDACTED]');
  });
  return scrubbedUrl;
}

/**
 * Initialize Sentry for server-side (Node.js) error tracking
 */
export function initSentryNode(options: {
  environment?: string;
  release?: string;
} = {}): void {
  // Only initialize if error tracking is enabled and DSN is configured
  if (!config.ENABLE_ERROR_TRACKING || !config.SENTRY_DSN) {
    console.log('Sentry error tracking is disabled or DSN not configured');
    return;
  }

  try {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: options.environment || config.SENTRY_ENVIRONMENT || config.NODE_ENV,
      release: options.release || config.SENTRY_RELEASE,
      
      // Performance monitoring
      tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
      
      // Integrations
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
      ],
      
      // Data scrubbing and filtering
      beforeSend(event, hint) {
        // Filter sensitive data from the event
        if (event.request) {
          // Scrub URLs
          if (event.request.url) {
            event.request.url = scrubUrl(event.request.url);
          }
          
          // Scrub headers
          if (event.request.headers) {
            event.request.headers = scrubSensitiveData(event.request.headers);
          }
          
          // Scrub query strings
          if (event.request.query_string) {
            event.request.query_string = scrubUrl(typeof event.request.query_string === 'string' ? event.request.query_string : JSON.stringify(event.request.query_string));
          }
          
          // Scrub POST data
          if (event.request.data) {
            event.request.data = scrubSensitiveData(event.request.data);
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
            message: breadcrumb.message ? scrubUrl(breadcrumb.message) : undefined,
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
        // Firebase errors that are expected
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
      ],
    });

    console.log('Sentry initialized successfully for Node.js');
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
  if (!config.ENABLE_ERROR_TRACKING) {
    return;
  }

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
  if (!config.ENABLE_ERROR_TRACKING) {
    return;
  }

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
  if (!config.ENABLE_ERROR_TRACKING) {
    return;
  }

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
  if (!config.ENABLE_ERROR_TRACKING) {
    console.error('Error (Sentry disabled):', error);
    return;
  }

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
 * Manually capture a message
 */
export function captureSentryMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: {
    tags?: Record<string, string | number | boolean>;
    extra?: Record<string, any>;
  }
): void {
  if (!config.ENABLE_ERROR_TRACKING) {
    console.log(`Message (Sentry disabled) [${level}]:`, message);
    return;
  }

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
        
        Sentry.captureMessage(message, level);
      });
    } else {
      Sentry.captureMessage(message, level);
    }
  } catch (error) {
    console.error('Failed to capture message in Sentry:', error);
  }
}

/**
 * Add a breadcrumb for debugging context
 */
export function addSentryBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, any>;
}): void {
  if (!config.ENABLE_ERROR_TRACKING) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category || 'custom',
      level: breadcrumb.level || 'info',
      data: breadcrumb.data ? scrubSensitiveData(breadcrumb.data) : undefined,
    });
  } catch (error) {
    console.error('Failed to add Sentry breadcrumb:', error);
  }
}

/**
 * Create Express error handler middleware for Sentry
 */
export function createSentryErrorHandler() {
  if (!config.ENABLE_ERROR_TRACKING) {
    return (err: any, req: any, res: any, next: any) => next(err);
  }

  return Sentry.Handlers.errorHandler();
}

/**
 * Create Express request handler middleware for Sentry
 */
export function createSentryRequestHandler() {
  if (!config.ENABLE_ERROR_TRACKING) {
    return (req: any, res: any, next: any) => next();
  }

  return Sentry.Handlers.requestHandler();
}

/**
 * Create Express tracing handler middleware for Sentry
 */
export function createSentryTracingHandler() {
  if (!config.ENABLE_ERROR_TRACKING) {
    return (req: any, res: any, next: any) => next();
  }

  return Sentry.Handlers.tracingHandler();
}

// Export Sentry for direct access if needed
export { Sentry };
