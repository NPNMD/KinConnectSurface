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
exports.registerAuthRoutes = registerAuthRoutes;
const admin = __importStar(require("firebase-admin"));
const middleware_1 = require("../middleware");
/**
 * Register authentication and profile routes
 * Handles user profile retrieval and management
 */
function registerAuthRoutes(app, firestore) {
    // Auth: profile
    app.get('/auth/profile', middleware_1.authenticate, async (req, res) => {
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
                // 🔥 SMART USER TYPE ASSIGNMENT: Check if user has pending invitations
                console.log('👤 New user detected, checking for pending invitations:', email);
                let userType = 'patient'; // Default to patient
                if (email) {
                    // Check for pending invitations for this email
                    const pendingInvitations = await firestore.collection('family_calendar_access')
                        .where('familyMemberEmail', '==', email.toLowerCase().trim())
                        .where('status', '==', 'pending')
                        .limit(1)
                        .get();
                    if (!pendingInvitations.empty) {
                        userType = 'family_member';
                        console.log('🎯 User has pending invitations, setting type to family_member');
                    }
                }
                const newUser = {
                    id: uid,
                    email: email || '',
                    name: name || 'Unknown User',
                    profilePicture: picture,
                    userType,
                    createdAt: now,
                    updatedAt: now,
                };
                await userDocRef.set(newUser, { merge: true });
                console.log('✅ Created new user with type:', userType);
                return res.json({ success: true, data: { ...newUser, createdAt: new Date(), updatedAt: new Date() } });
            }
            const data = userSnap.data() || {};
            // Auto-repair: if user is family_member but missing primaryPatientId, try inferring from active access
            try {
                if ((data.userType === 'family_member') && !data.primaryPatientId) {
                    const activeForUser = await firestore.collection('family_calendar_access')
                        .where('familyMemberId', '==', uid)
                        .where('status', '==', 'active')
                        .limit(1)
                        .get();
                    if (!activeForUser.empty) {
                        const inferredPatientId = activeForUser.docs[0].data().patientId;
                        await userDocRef.set({
                            primaryPatientId: inferredPatientId,
                            linkedPatientIds: admin.firestore.FieldValue.arrayUnion(inferredPatientId),
                            updatedAt: now,
                            repairedAt: now,
                            repairReason: 'auto_infer_primary_patient_from_access'
                        }, { merge: true });
                        const patientUserRef = firestore.collection('users').doc(inferredPatientId);
                        await patientUserRef.set({
                            familyMemberIds: admin.firestore.FieldValue.arrayUnion(uid),
                            updatedAt: now
                        }, { merge: true });
                        data.primaryPatientId = inferredPatientId;
                    }
                }
            }
            catch (e) {
                console.warn('Auto-repair primaryPatientId failed:', e);
            }
            const merged = {
                id: data.id || uid,
                email: data.email || email || '',
                name: data.name || name || 'Unknown User',
                profilePicture: data.profilePicture || picture,
                userType: data.userType || 'patient',
                primaryPatientId: data.primaryPatientId || null,
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
}
