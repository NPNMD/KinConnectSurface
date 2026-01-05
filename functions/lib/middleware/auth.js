"use strict";
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
exports.authenticate = authenticate;
const admin = __importStar(require("firebase-admin"));
/**
 * Authentication middleware for Firebase Functions
 * Verifies Firebase ID tokens and attaches user info to request
 */
async function authenticate(req, res, next) {
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
        req.user = decoded;
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
    }
    catch (err) {
        const isUnifiedMedicationAPI = req.path.includes('/unified-medication');
        console.error('❌ Authentication failed - invalid token:', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            error: err instanceof Error ? err.message : 'Unknown error',
            errorCode: err?.code || 'Unknown code',
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
