import express from 'express';

/**
 * Deprecation middleware for legacy endpoints
 * Adds deprecation headers and logs usage for monitoring
 */
export function addDeprecationHeaders(
	endpoint: string,
	replacement: string,
	sunsetDate: string = '2025-12-31'
) {
	return (req: express.Request, res: express.Response, next: express.NextFunction) => {
		// Add deprecation headers
		res.setHeader('X-API-Deprecated', 'true');
		res.setHeader('X-API-Sunset', sunsetDate);
		res.setHeader('X-API-Replacement', replacement);
		res.setHeader('Deprecation', `date="${sunsetDate}"`);
		
		// Log usage for monitoring
		console.warn('⚠️ DEPRECATED ENDPOINT USED:', {
			endpoint,
			replacement,
			userId: (req as any).user?.uid,
			timestamp: new Date().toISOString(),
			userAgent: req.headers['user-agent']
		});
		
		next();
	};
}

