"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDeprecationHeaders = addDeprecationHeaders;
/**
 * Deprecation middleware for legacy endpoints
 * Adds deprecation headers and logs usage for monitoring
 */
function addDeprecationHeaders(endpoint, replacement, sunsetDate = '2025-12-31') {
    return (req, res, next) => {
        // Add deprecation headers
        res.setHeader('X-API-Deprecated', 'true');
        res.setHeader('X-API-Sunset', sunsetDate);
        res.setHeader('X-API-Replacement', replacement);
        res.setHeader('Deprecation', `date="${sunsetDate}"`);
        // Log usage for monitoring
        console.warn('⚠️ DEPRECATED ENDPOINT USED:', {
            endpoint,
            replacement,
            userId: req.user?.uid,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent']
        });
        next();
    };
}
