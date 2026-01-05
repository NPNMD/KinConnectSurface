import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define configuration schema
const ConfigSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  APP_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(5000),
  
  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  
  // APIs
  RXNORM_BASE_URL: z.string().url().default('https://rxnav.nlm.nih.gov/REST'),
  RXIMAGE_BASE_URL: z.string().url().default('https://rximage.nlm.nih.gov/api/rximage/1'),
  DAILYMED_BASE_URL: z.string().url().default('https://dailymed.nlm.nih.gov/dailymed/services/v2'),
  
  // Email
  EMAIL_PROVIDER: z.enum(['sendgrid', 'resend']).default('resend'),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional().default('noreply@kinconnect.com'),
  SENDGRID_FROM_EMAIL: z.string().email().optional(), // For backward compatibility
  
  // Cache
  REDIS_URL: z.string().optional(),
  ENABLE_CACHE: z.coerce.boolean().default(true),
  CACHE_TTL_DRUG_DATA: z.coerce.number().positive().default(86400), // 24 hours in seconds
  CACHE_TTL_IMAGES: z.coerce.number().positive().default(604800), // 7 days in seconds
  CACHE_KEY_VERSION: z.string().default('v1'), // For cache invalidation
  
  // Google
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_CALENDAR_API_KEY: z.string().optional(),
  
  // Feature Flags
  ENABLE_DRUG_IMAGES: z.coerce.boolean().default(true),
  ENABLE_CLINICAL_INFO: z.coerce.boolean().default(true),
  ENABLE_AUTHORIZATION: z.coerce.boolean().default(true),
  ENABLE_ERROR_TRACKING: z.coerce.boolean().default(false),
  
  // Sentry Error Monitoring
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.enum(['development', 'staging', 'production']).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_RELEASE: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  // Load from environment
  // Note: For client-side, Vite uses import.meta.env, but shared code runs in Node.js
  // so we rely on process.env which dotenv populates.
  
  const rawConfig = {
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL,
    PORT: process.env.PORT,
    
    FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    
    RXNORM_BASE_URL: process.env.RXNORM_BASE_URL,
    RXIMAGE_BASE_URL: process.env.RXIMAGE_BASE_URL,
    DAILYMED_BASE_URL: process.env.DAILYMED_BASE_URL,
    
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL,
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
    
    REDIS_URL: process.env.REDIS_URL,
    ENABLE_CACHE: process.env.ENABLE_CACHE,
    CACHE_TTL_DRUG_DATA: process.env.CACHE_TTL_DRUG_DATA,
    CACHE_TTL_IMAGES: process.env.CACHE_TTL_IMAGES,
    CACHE_KEY_VERSION: process.env.CACHE_KEY_VERSION,
    
    GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
    GOOGLE_CALENDAR_API_KEY: process.env.VITE_GOOGLE_CALENDAR_API_KEY,
    
    ENABLE_DRUG_IMAGES: process.env.ENABLE_DRUG_IMAGES,
    ENABLE_CLINICAL_INFO: process.env.ENABLE_CLINICAL_INFO,
    ENABLE_AUTHORIZATION: process.env.ENABLE_AUTHORIZATION,
    ENABLE_ERROR_TRACKING: process.env.ENABLE_ERROR_TRACKING,
    
    SENTRY_DSN: process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.VITE_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    SENTRY_TRACES_SAMPLE_RATE: process.env.VITE_SENTRY_TRACES_SAMPLE_RATE || process.env.SENTRY_TRACES_SAMPLE_RATE,
    SENTRY_RELEASE: process.env.VITE_SENTRY_RELEASE || process.env.SENTRY_RELEASE,
  };
  
  // Validate and parse
  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    // Return a default config or throw? For robustness in dev, we might log warning but continue if defaults allow.
    // But for production correctness, we should probably default to safe values or fail if criticals missing.
    // Since we provided defaults in schema, it will only fail if types are totally wrong or non-optional fields missing.
    
    // Fallback for critical development
    console.warn('Using fallback configuration due to validation errors.');
    return {
        NODE_ENV: 'development',
        PORT: 5000,
        RXNORM_BASE_URL: 'https://rxnav.nlm.nih.gov/REST',
        RXIMAGE_BASE_URL: 'https://rximage.nlm.nih.gov/api/rximage/1',
        DAILYMED_BASE_URL: 'https://dailymed.nlm.nih.gov/dailymed/services/v2',
        EMAIL_PROVIDER: 'resend',
        FROM_EMAIL: 'noreply@kinconnect.com',
        ENABLE_CACHE: false,
        CACHE_TTL_DRUG_DATA: 86400,
        CACHE_TTL_IMAGES: 604800,
        CACHE_KEY_VERSION: 'v1',
        ENABLE_DRUG_IMAGES: true,
        ENABLE_CLINICAL_INFO: true,
        ENABLE_AUTHORIZATION: true,
        ENABLE_ERROR_TRACKING: false,
        SENTRY_TRACES_SAMPLE_RATE: 0.1
    } as Config;
  }
}

// Export singleton config
export const config = loadConfig();

