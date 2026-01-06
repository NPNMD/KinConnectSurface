"use strict";
/**
 * Sentry Error Monitoring Service
 *
 * Provides centralized error tracking and performance monitoring
 * with HIPAA-compliant data filtering for KinConnect.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = void 0;
exports.initSentryNode = initSentryNode;
exports.setSentryUser = setSentryUser;
exports.clearSentryUser = clearSentryUser;
exports.setSentryContext = setSentryContext;
exports.captureSentryException = captureSentryException;
exports.captureSentryMessage = captureSentryMessage;
exports.addSentryBreadcrumb = addSentryBreadcrumb;
exports.createSentryErrorHandler = createSentryErrorHandler;
exports.createSentryRequestHandler = createSentryRequestHandler;
exports.createSentryTracingHandler = createSentryTracingHandler;
const Sentry = __importStar(require("@sentry/node"));
exports.Sentry = Sentry;
const config_1 = require("../config");
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
function scrubSensitiveData(data, depth = 0) {
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
        const scrubbed = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                // Check if key matches sensitive field patterns
                const lowerKey = key.toLowerCase();
                const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));
                if (isSensitive) {
                    scrubbed[key] = '[REDACTED]';
                }
                else {
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
function scrubUrl(url) {
    let scrubbedUrl = url;
    SENSITIVE_URL_PATTERNS.forEach(pattern => {
        scrubbedUrl = scrubbedUrl.replace(pattern, '[REDACTED]');
    });
    return scrubbedUrl;
}
/**
 * Initialize Sentry for server-side (Node.js) error tracking
 */
function initSentryNode(options = {}) {
    // Only initialize if error tracking is enabled and DSN is configured
    if (!config_1.config.ENABLE_ERROR_TRACKING || !config_1.config.SENTRY_DSN) {
        console.log('Sentry error tracking is disabled or DSN not configured');
        return;
    }
    try {
        Sentry.init({
            dsn: config_1.config.SENTRY_DSN,
            environment: options.environment || config_1.config.SENTRY_ENVIRONMENT || config_1.config.NODE_ENV,
            release: options.release || config_1.config.SENTRY_RELEASE,
            // Performance monitoring
            tracesSampleRate: config_1.config.SENTRY_TRACES_SAMPLE_RATE,
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
    }
    catch (error) {
        console.error('Failed to initialize Sentry:', error);
        // Don't throw - gracefully degrade if Sentry fails
    }
}
/**
 * Set user context for error tracking
 * Note: Only set non-PHI user identifiers
 */
function setSentryUser(user) {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
        return;
    }
    try {
        Sentry.setUser({
            id: user.id,
            role: user.role,
        });
    }
    catch (error) {
        console.error('Failed to set Sentry user:', error);
    }
}
/**
 * Clear user context (e.g., on logout)
 */
function clearSentryUser() {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
        return;
    }
    try {
        Sentry.setUser(null);
    }
    catch (error) {
        console.error('Failed to clear Sentry user:', error);
    }
}
/**
 * Add custom context/tags to error reports
 */
function setSentryContext(context) {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
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
    }
    catch (error) {
        console.error('Failed to set Sentry context:', error);
    }
}
/**
 * Manually capture an exception
 */
function captureSentryException(error, context) {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
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
        }
        else {
            Sentry.captureException(error);
        }
    }
    catch (err) {
        console.error('Failed to capture exception in Sentry:', err);
        console.error('Original error:', error);
    }
}
/**
 * Manually capture a message
 */
function captureSentryMessage(message, level = 'info', context) {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
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
        }
        else {
            Sentry.captureMessage(message, level);
        }
    }
    catch (error) {
        console.error('Failed to capture message in Sentry:', error);
    }
}
/**
 * Add a breadcrumb for debugging context
 */
function addSentryBreadcrumb(breadcrumb) {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
        return;
    }
    try {
        Sentry.addBreadcrumb({
            message: breadcrumb.message,
            category: breadcrumb.category || 'custom',
            level: breadcrumb.level || 'info',
            data: breadcrumb.data ? scrubSensitiveData(breadcrumb.data) : undefined,
        });
    }
    catch (error) {
        console.error('Failed to add Sentry breadcrumb:', error);
    }
}
/**
 * Create Express error handler middleware for Sentry
 */
function createSentryErrorHandler() {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
        return (err, req, res, next) => next(err);
    }
    return Sentry.Handlers.errorHandler();
}
/**
 * Create Express request handler middleware for Sentry
 */
function createSentryRequestHandler() {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.requestHandler();
}
/**
 * Create Express tracing handler middleware for Sentry
 */
function createSentryTracingHandler() {
    if (!config_1.config.ENABLE_ERROR_TRACKING) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.tracingHandler();
}
