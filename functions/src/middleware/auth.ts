import express from 'express';
import * as admin from 'firebase-admin';

/**
 * Authentication middleware for Firebase Functions
 * Verifies Firebase ID tokens and attaches user info to request
 */
export async function authenticate(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) {
	try {
		// Enhanced logging for unified medication API requests
		const isUnifiedMedicationAPI = req.path.includes('/unified-medication');
		if (isUnifiedMedicationAPI) {
			console.log('🔐 UNIFIED API AUTH CHECK:', {
				path: req.path,
				method: req.method,
				hasAuthHeader: !!req.headers.authorization,
				timestamp: new Date().toISOString()
			});
		}

		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
		if (!token) {
			console.error('❌ Authentication failed - no token:', {
				path: req.path,
				method: req.method,
				ip: req.ip,
				userAgent: req.headers['user-agent'],
				isUnifiedAPI: isUnifiedMedicationAPI,
				timestamp: new Date().toISOString()
			});
			return res.status(401).json({
				success: false,
				error: 'Access token required',
				errorCode: 'AUTH_TOKEN_MISSING',
				timestamp: new Date().toISOString()
			});
		}
		const decoded = await admin.auth().verifyIdToken(token);
		// Attach to request
		(req as any).user = decoded;
		
		// Enhanced success logging for unified medication API
		if (isUnifiedMedicationAPI) {
			console.log('✅ UNIFIED API AUTH SUCCESS:', {
				path: req.path,
				method: req.method,
				userId: decoded.uid,
				email: decoded.email,
				timestamp: new Date().toISOString()
			});
		}
		
		return next();
	} catch (err) {
		const isUnifiedMedicationAPI = req.path.includes('/unified-medication');
		console.error('❌ Authentication failed - invalid token:', {
			path: req.path,
			method: req.method,
			ip: req.ip,
			error: err instanceof Error ? err.message : 'Unknown error',
			errorCode: (err as any)?.code || 'Unknown code',
			isUnifiedAPI: isUnifiedMedicationAPI,
			timestamp: new Date().toISOString()
		});
		return res.status(403).json({
			success: false,
			error: 'Invalid or expired token',
			errorCode: 'AUTH_TOKEN_INVALID',
			timestamp: new Date().toISOString()
		});
	}
}

