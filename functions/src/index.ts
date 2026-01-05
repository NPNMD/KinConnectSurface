import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { admin, db } from './firebase';
import swaggerUi from 'swagger-ui-express';
import * as YAML from 'yamljs';
import * as path from 'path';

// Import Sentry error monitoring
import {
  initSentryNode,
  createSentryRequestHandler,
  createSentryTracingHandler,
  createSentryErrorHandler
} from '../../shared/services/sentryService';

// Import shared services
import { MedicationService } from '../../shared/services/medicationService';
import { PatientService } from '../../shared/services/patientService';
import { AccessService } from '../../shared/services/accessService';
import { DrugService } from '../../shared/services/drugService';
import { RxImageService } from '../../shared/services/rxImageService';
import { DailyMedService } from '../../shared/services/dailyMedService';
import { createAuthMiddleware } from '../../shared/middleware/auth';
import { performanceMiddleware, skipHealthCheckMiddleware } from '../../shared/middleware/performance';
import { getPerformanceService } from '../../shared/services/performanceService';

// Import router factories from shared
import { createPatientRouter } from '../../shared/routes/patients';
import { createMedicationRouter } from '../../shared/routes/medications';
import { createDrugRouter } from '../../shared/routes/drugs';

// Import function-specific routes
import authRouter from './routes/auth';
import invitationsRouter from './routes/invitations';
import familyRouter from './routes/family';

// Initialize Sentry before app creation
initSentryNode({
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
});

const app = express();

// Sentry request handler - must be the first middleware
app.use(createSentryRequestHandler());
app.use(createSentryTracingHandler());

// Initialize services
// Note: functions `db` is admin.firestore()
const medicationService = new MedicationService({ db });
const patientService = new PatientService({ db });
const accessService = new AccessService({ db });
const drugService = new DrugService();
const rxImageService = new RxImageService();
const dailyMedService = new DailyMedService();

// Initialize middleware
const authenticateToken = createAuthMiddleware({
  verifyIdToken: (token) => admin.auth().verifyIdToken(token)
});

// Security middleware - Helmet with comprehensive CSP configuration
app.use(helmet({
    // Cross-Origin Opener Policy: Allow popups for OAuth flows (Google login, Calendar)
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    
    // Cross-Origin Embedder Policy: Not required for this app
    crossOriginEmbedderPolicy: false,
    
    // Content Security Policy Configuration
    contentSecurityPolicy: {
        directives: {
            // Default fallback for resources not covered by other directives
            defaultSrc: ["'self'"],
            
            // Script sources: Allow self, inline scripts (needed for Vite/React), and Firebase
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Required for React/Vite development and production builds
                "'unsafe-eval'", // Required for Vite HMR in development
                "https://*.firebaseapp.com",
                "https://*.googleapis.com",
                "https://www.gstatic.com",
            ],
            
            // Style sources: Allow self, inline styles (needed for React), and Google Fonts
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Required for React inline styles and Tailwind
                "https://fonts.googleapis.com",
            ],
            
            // Font sources: Allow self and Google Fonts
            fontSrc: [
                "'self'",
                "data:", // For base64 encoded fonts
                "https://fonts.gstatic.com",
            ],
            
            // Image sources: Allow self, data URIs, Firebase, external drug APIs
            imgSrc: [
                "'self'",
                "data:", // For base64 encoded images
                "blob:", // For dynamic image generation
                "https://*.firebaseapp.com",
                "https://*.googleapis.com",
                "https://rximage.nlm.nih.gov", // RxImage API
                "https://dailymed.nlm.nih.gov", // DailyMed API
            ],
            
            // Connect sources: APIs the app can make requests to
            connectSrc: [
                "'self'",
                "https://*.firebaseapp.com",
                "https://*.googleapis.com",
                "https://*.cloudfunctions.net", // Firebase Functions
                "https://identitytoolkit.googleapis.com", // Firebase Auth
                "https://securetoken.googleapis.com", // Firebase Auth tokens
                "https://firestore.googleapis.com", // Firestore
                "https://rxnav.nlm.nih.gov", // RxNorm API
                "https://rximage.nlm.nih.gov", // RxImage API
                "https://dailymed.nlm.nih.gov", // DailyMed API
                "wss://*.firebaseio.com", // Firebase Realtime Database WebSocket
            ],
            
            // Frame sources: Allow Google services for Calendar, Maps, OAuth
            frameSrc: [
                "'self'",
                "https://*.firebaseapp.com",
                "https://*.google.com",
                "https://accounts.google.com", // OAuth login
                "https://calendar.google.com", // Calendar integration
            ],
            
            // Object/Embed sources: Restrict plugins
            objectSrc: ["'none'"],
            
            // Media sources: Allow self
            mediaSrc: ["'self'"],
            
            // Base URI: Restrict to self
            baseUri: ["'self'"],
            
            // Form action: Allow self and Google OAuth
            formAction: [
                "'self'",
                "https://accounts.google.com",
            ],
            
            // Frame ancestors: Prevent clickjacking
            frameAncestors: ["'none'"],
            
            // Upgrade insecure requests in production
            upgradeInsecureRequests: [],
        },
    },
    
    // Additional security headers
    
    // X-Frame-Options: Prevent clickjacking (redundant with frameAncestors but kept for older browsers)
    frameguard: {
        action: 'deny',
    },
    
    // X-Content-Type-Options: Prevent MIME type sniffing
    noSniff: true,
    
    // Referrer-Policy: Control referrer information
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
    
    // Permissions-Policy: Control browser features
    // Note: Helmet uses permissionsPolicy instead of featurePolicy
    permittedCrossDomainPolicies: false,
}));

// Additional custom security headers not covered by Helmet
app.use((req, res, next) => {
    // Permissions-Policy: Restrict access to browser features
    res.setHeader(
        'Permissions-Policy',
        'geolocation=(self), ' + // Allow location for address autocomplete
        'camera=(), ' + // Disable camera
        'microphone=(), ' + // Disable microphone
        'payment=(), ' + // Disable payment
        'usb=(), ' + // Disable USB
        'magnetometer=(), ' + // Disable magnetometer
        'accelerometer=(), ' + // Disable accelerometer
        'gyroscope=()' // Disable gyroscope
    );
    
    // X-XSS-Protection: Enable XSS filter (legacy, but doesn't hurt)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
});
app.use(cors({ origin: true }));
app.use(express.json());

// Performance monitoring middleware
// Skip health checks to reduce noise
app.use(skipHealthCheckMiddleware);
app.use(performanceMiddleware);

// Initialize performance service and log metrics every minute
const performanceService = getPerformanceService();

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/api/openapi.yaml'));

// Swagger UI configuration
const swaggerOptions = {
	customCss: '.swagger-ui .topbar { display: none }',
	customSiteTitle: 'KinConnect API Documentation',
	swaggerOptions: {
		persistAuthorization: true,
	}
};

// Serve API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// Health endpoint
app.get('/api/health', (req, res) => {
	res.json({ success: true, message: 'Functions API healthy' });
});

// Mount routers
app.use('/api/auth', authRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/family', familyRouter);

// Mount shared routers
// Note: We need to cast authenticateToken because Express types might mismatch between versions 
// but functionally it's compatible (req, res, next)
app.use('/api/patients', createPatientRouter(patientService, accessService, authenticateToken));
app.use('/api/medications', createMedicationRouter(medicationService, accessService, authenticateToken));
app.use('/api/drugs', createDrugRouter(drugService, rxImageService, dailyMedService, authenticateToken));

// Sentry error handler - must be after all routes and middleware
app.use(createSentryErrorHandler());

export const api = functions
	.runWith({
		memory: '512MB',
		timeoutSeconds: 60,
		minInstances: 0,
		maxInstances: 10,
		secrets: ['RESEND_API_KEY', 'FROM_EMAIL', 'SENDGRID_FROM_EMAIL', 'APP_URL']
	})
	.https.onRequest(app);
