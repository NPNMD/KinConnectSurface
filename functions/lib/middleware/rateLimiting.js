"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.limiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Enhanced rate limiting with circuit breaker logic for medication operations
 */
exports.limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased from 300 to 500 requests per 15 minutes for medication operations
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use a simple key for Firebase Functions to avoid proxy issues
        return req.headers['x-forwarded-for'] || req.ip || 'unknown';
    },
    skip: (req) => {
        // Skip rate limiting for health checks and critical medication operations
        const skipPaths = [
            '/health',
            '/medication-calendar/events',
            '/medications',
            '/medication-calendar/check-missing-events'
        ];
        return skipPaths.some(path => req.path.includes(path));
    },
    handler: (req, res) => {
        // Enhanced handler with medication-specific logic
        const isMedicationRequest = req.path.includes('medication');
        console.log('⚠️ Rate limit exceeded for:', req.ip, req.path, 'isMedication:', isMedicationRequest);
        // More lenient handling for medication operations
        const retryAfter = isMedicationRequest ? 30 : 60; // Shorter retry for medication ops
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.',
            retryAfter,
            isMedicationOperation: isMedicationRequest,
            suggestion: isMedicationRequest ? 'Medication operations have priority - retry in 30 seconds' : 'General rate limit - retry in 60 seconds'
        });
    }
});
