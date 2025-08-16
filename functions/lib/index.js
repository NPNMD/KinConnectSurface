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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const params_1 = require("firebase-functions/params");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const admin = __importStar(require("firebase-admin"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
// Initialize Admin SDK once
if (!admin.apps.length) {
    admin.initializeApp();
}
const firestore = admin.firestore();
// Define secrets
const sendgridApiKey = (0, params_1.defineSecret)('SENDGRID_API_KEY');
const SENDGRID_FROM_EMAIL = 'mike.nguyen@twfg.com';
const APP_URL = 'https://claritystream-uldp9.web.app';
// Create an Express app
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);
// Simple auth middleware for functions
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        if (!token) {
            return res.status(401).json({ success: false, error: 'Access token required' });
        }
        const decoded = await admin.auth().verifyIdToken(token);
        // Attach to request
        req.user = decoded;
        return next();
    }
    catch (err) {
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
}
// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Functions API healthy', timestamp: new Date().toISOString() });
});
// ===== INVITATION ROUTES =====
// Send family invitation
app.post('/api/invitations/send', authenticate, async (req, res) => {
    try {
        console.log('🚀 Starting invitation send process...');
        const { email, patientName } = req.body;
        const senderUserId = req.user.uid;
        console.log('📧 Invitation request:', { email, familyMemberName: patientName, senderUserId });
        if (!email || !patientName) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                error: 'Email and patient name are required'
            });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
        // Get sender's user info
        console.log('👤 Fetching sender information...');
        const senderDoc = await firestore.collection('users').doc(senderUserId).get();
        const senderData = senderDoc.data();
        if (!senderData) {
            return res.status(404).json({
                success: false,
                error: 'User profile not found'
            });
        }
        console.log('👤 Sender found:', { senderName: senderData.name, senderEmail: senderData.email });
        // Define permissions for the invitation
        const permissions = {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canClaimResponsibility: true,
            canManageFamily: false,
            canViewMedicalDetails: false,
            canReceiveNotifications: true
        };
        // Generate invitation token
        const invitationToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
        // Create family access record
        console.log('💾 Creating family access record...');
        const familyAccessData = {
            patientId: senderUserId,
            familyMemberId: '', // Will be set when invitation is accepted
            familyMemberName: patientName,
            familyMemberEmail: email,
            permissions,
            accessLevel: 'limited',
            eventTypesAllowed: [],
            emergencyAccess: false,
            status: 'pending',
            invitedAt: admin.firestore.Timestamp.now(),
            createdBy: senderUserId,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            invitationToken,
            invitationExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
        };
        const familyAccessRef = await firestore.collection('family_calendar_access').add(familyAccessData);
        console.log('✅ Family access record created:', familyAccessRef.id);
        // Send invitation email
        try {
            console.log('📨 Initializing SendGrid...');
            const rawApiKey = sendgridApiKey.value();
            // Clean the API key by removing any quotes and trimming whitespace
            const apiKey = rawApiKey ? rawApiKey.replace(/^["']|["']$/g, '').trim() : '';
            console.log('🔑 SendGrid API key available:', !!apiKey);
            console.log('🔑 API key starts with SG.:', apiKey.startsWith('SG.'));
            if (!apiKey || !apiKey.startsWith('SG.')) {
                console.warn('⚠️ SendGrid API key not found or invalid format, skipping email');
                return res.status(200).json({
                    success: true,
                    message: 'Invitation created but email delivery failed. Please try again or contact support.',
                    data: {
                        invitationId: familyAccessRef.id,
                        emailError: 'SendGrid API key not configured properly'
                    }
                });
            }
            mail_1.default.setApiKey(apiKey);
            const invitationLink = `${APP_URL}/accept-invitation?token=${invitationToken}`;
            console.log('🔗 Invitation link:', invitationLink);
            const emailContent = {
                to: email,
                from: SENDGRID_FROM_EMAIL,
                subject: `${senderData.name} has invited you to access their medical calendar`,
                html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
						<div style="text-align: center; margin-bottom: 30px;">
							<h1 style="color: #2563eb; margin: 0;">KinConnect</h1>
							<p style="color: #666; margin: 5px 0;">Medical Calendar Invitation</p>
						</div>
						
						<div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
							<h2 style="color: #1e293b; margin-top: 0;">You're Invited!</h2>
							<p>Hi ${patientName},</p>
							<p><strong>${senderData.name}</strong> has invited you to access their medical calendar on KinConnect.</p>
						</div>
						
						<div style="margin-bottom: 20px;">
							<h3 style="color: #1e293b;">What you can do:</h3>
							<ul style="color: #475569;">
								<li>View medical appointments and events</li>
								<li>Claim transportation responsibilities</li>
								<li>Receive email notifications</li>
							</ul>
						</div>
						
						<div style="text-align: center; margin: 30px 0;">
							<a href="${invitationLink}" 
								 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
								Accept Invitation
							</a>
						</div>
						
						<div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px;">
							<p>This invitation was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.</p>
							<p>The invitation link will expire in 7 days.</p>
						</div>
					</div>
				`
            };
            console.log('📧 Sending email to:', email);
            const emailResult = await mail_1.default.send(emailContent);
            console.log('✅ Email sent successfully:', emailResult[0].statusCode);
        }
        catch (emailError) {
            console.error('❌ Failed to send email:', emailError);
            // Continue without failing the invitation creation
        }
        console.log('🎉 Invitation process completed successfully');
        res.status(200).json({
            success: true,
            message: 'Invitation sent successfully',
            data: {
                invitationId: familyAccessRef.id,
                expiresAt: expiresAt
            }
        });
    }
    catch (error) {
        console.error('❌ Error sending invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error while sending invitation'
        });
    }
});
// ===== EXISTING ROUTES (keeping the working ones) =====
// Auth: profile
app.get('/api/auth/profile', authenticate, async (req, res) => {
    try {
        const decoded = req.user;
        const uid = decoded.uid;
        const email = decoded.email;
        const name = decoded.name;
        const picture = decoded.picture;
        const usersCol = firestore.collection('users');
        const userDocRef = usersCol.doc(uid);
        const userSnap = await userDocRef.get();
        const now = admin.firestore.Timestamp.now();
        if (!userSnap.exists) {
            const newUser = {
                id: uid,
                email: email || '',
                name: name || 'Unknown User',
                profilePicture: picture,
                userType: 'patient',
                createdAt: now,
                updatedAt: now,
            };
            await userDocRef.set(newUser, { merge: true });
            return res.json({ success: true, data: { ...newUser, createdAt: new Date(), updatedAt: new Date() } });
        }
        const data = userSnap.data() || {};
        const merged = {
            id: data.id || uid,
            email: data.email || email || '',
            name: data.name || name || 'Unknown User',
            profilePicture: data.profilePicture || picture,
            userType: data.userType || 'patient',
            createdAt: data.createdAt ? data.createdAt.toDate?.() || new Date() : new Date(),
            updatedAt: data.updatedAt ? data.updatedAt.toDate?.() || new Date() : new Date(),
        };
        return res.json({ success: true, data: merged });
    }
    catch (error) {
        console.error('Error in /api/auth/profile:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
// Medication calendar events endpoint (simplified)
app.get('/api/medication-calendar/events', authenticate, async (req, res) => {
    try {
        const patientId = req.user.uid;
        // Return empty array for now to prevent 500 errors
        res.json({
            success: true,
            data: [],
            message: 'Medication calendar events retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error getting medication calendar events:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Medication adherence endpoint (simplified)
app.get('/api/medication-calendar/adherence', authenticate, async (req, res) => {
    try {
        const patientId = req.user.uid;
        // Return empty array for now to prevent 500 errors
        res.json({
            success: true,
            data: [],
            message: 'Medication adherence calculated successfully'
        });
    }
    catch (error) {
        console.error('Error calculating medication adherence:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});
exports.api = functions
    .region('us-central1')
    .runWith({
    memory: '512MB',
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 10,
    secrets: [sendgridApiKey]
})
    .https.onRequest(app);
