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
const functions = __importStar(require("firebase-functions"));
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
// Initialize SendGrid with secrets
const initializeSendGrid = () => {
    try {
        const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
        if (SENDGRID_API_KEY) {
            mail_1.default.setApiKey(SENDGRID_API_KEY);
            console.log('SendGrid initialized successfully');
        }
        else {
            console.warn('SendGrid API key not found in secrets');
        }
    }
    catch (error) {
        console.error('Failed to initialize SendGrid:', error);
    }
};
// Initialize SendGrid
initializeSendGrid();
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'mike.nguyen@twfg.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// Create an Express app
const app = (0, express_1.default)();
// Security middleware
// Disable COOP/COEP to avoid breaking OAuth popups (Firebase Google sign-in)
app.use((0, helmet_1.default)({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
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
// RxNorm API helper function
async function makeRxNormRequest(endpoint) {
    try {
        const response = await fetch(`https://rxnav.nlm.nih.gov/REST${endpoint}`);
        if (!response.ok) {
            throw new Error(`RxNorm API error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('RxNorm API request failed:', error);
        throw error;
    }
}
// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Functions API healthy' });
});
// Auth: profile - upsert and return a lightweight user profile compatible with the client
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
        // Ensure required fields
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
// Drug search endpoints
app.get('/api/drugs/search', authenticate, async (req, res) => {
    try {
        const { q: query, limit = '20' } = req.query;
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter "q" is required and must be at least 2 characters long'
            });
        }
        const maxEntries = Math.min(parseInt(limit) || 20, 50);
        try {
            // First try exact search
            const searchResponse = await makeRxNormRequest(`/drugs.json?name=${encodeURIComponent(query.trim())}`);
            let concepts = [];
            if (searchResponse.drugGroup?.conceptGroup) {
                searchResponse.drugGroup.conceptGroup.forEach((group) => {
                    if (group.conceptProperties) {
                        concepts.push(...group.conceptProperties);
                    }
                });
            }
            // If no results, try approximate search
            if (concepts.length === 0) {
                const approximateResponse = await makeRxNormRequest(`/approximateTerm.json?term=${encodeURIComponent(query.trim())}&maxEntries=${maxEntries}`);
                if (approximateResponse.approximateGroup?.candidate) {
                    concepts = approximateResponse.approximateGroup.candidate;
                }
            }
            // Remove duplicates and limit results
            const uniqueConcepts = concepts
                .filter((concept, index, self) => index === self.findIndex(c => c.rxcui === concept.rxcui))
                .slice(0, maxEntries);
            res.json({
                success: true,
                data: uniqueConcepts,
                message: `Found ${uniqueConcepts.length} drug(s)`
            });
        }
        catch (apiError) {
            console.error('RxNorm API error:', apiError);
            res.status(503).json({
                success: false,
                error: 'Drug search service temporarily unavailable'
            });
        }
    }
    catch (error) {
        console.error('Error searching drugs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get drug details by RXCUI
app.get('/api/drugs/:rxcui', authenticate, async (req, res) => {
    try {
        const { rxcui } = req.params;
        if (!rxcui || !/^\d+$/.test(rxcui)) {
            return res.status(400).json({
                success: false,
                error: 'Valid RXCUI is required'
            });
        }
        try {
            const detailsResponse = await makeRxNormRequest(`/rxcui/${rxcui}/properties.json`);
            if (!detailsResponse.propConceptGroup?.propConcept?.[0]) {
                return res.status(404).json({
                    success: false,
                    error: 'Drug not found'
                });
            }
            const drugDetails = detailsResponse.propConceptGroup.propConcept[0];
            res.json({
                success: true,
                data: drugDetails,
                message: 'Drug details retrieved successfully'
            });
        }
        catch (apiError) {
            console.error('RxNorm API error:', apiError);
            res.status(503).json({
                success: false,
                error: 'Drug details service temporarily unavailable'
            });
        }
    }
    catch (error) {
        console.error('Error getting drug details:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get drug interactions by RXCUI
app.get('/api/drugs/:rxcui/interactions', authenticate, async (req, res) => {
    try {
        const { rxcui } = req.params;
        if (!rxcui || !/^\d+$/.test(rxcui)) {
            return res.status(400).json({
                success: false,
                error: 'Valid RXCUI is required'
            });
        }
        try {
            const interactionsResponse = await makeRxNormRequest(`/interaction/interaction.json?rxcui=${rxcui}`);
            const interactions = interactionsResponse.interactionTypeGroup || [];
            res.json({
                success: true,
                data: interactions,
                message: `Found ${interactions.length} interaction(s)`
            });
        }
        catch (apiError) {
            console.error('RxNorm API error:', apiError);
            res.status(503).json({
                success: false,
                error: 'Drug interactions service temporarily unavailable'
            });
        }
    }
    catch (error) {
        console.error('Error getting drug interactions:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Medication CRUD operations
app.get('/api/medications', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const medicationsRef = firestore.collection('medications').where('patientId', '==', uid);
        const snapshot = await medicationsRef.get();
        const medications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            prescribedDate: doc.data().prescribedDate?.toDate() || new Date(),
            startDate: doc.data().startDate?.toDate(),
            endDate: doc.data().endDate?.toDate(),
        }));
        res.json({
            success: true,
            data: medications,
            message: 'Medications retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error getting medications:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.post('/api/medications', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const medicationData = {
            ...req.body,
            patientId: uid,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            prescribedDate: req.body.prescribedDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.prescribedDate)) : admin.firestore.Timestamp.now(),
            startDate: req.body.startDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.startDate)) : null,
            endDate: req.body.endDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.endDate)) : null,
        };
        const docRef = await firestore.collection('medications').add(medicationData);
        const newDoc = await docRef.get();
        const newMedication = {
            id: newDoc.id,
            ...newDoc.data(),
            createdAt: newDoc.data()?.createdAt?.toDate() || new Date(),
            updatedAt: newDoc.data()?.updatedAt?.toDate() || new Date(),
            prescribedDate: newDoc.data()?.prescribedDate?.toDate() || new Date(),
            startDate: newDoc.data()?.startDate?.toDate(),
            endDate: newDoc.data()?.endDate?.toDate(),
        };
        res.status(201).json({
            success: true,
            data: newMedication,
            message: 'Medication created successfully'
        });
    }
    catch (error) {
        console.error('Error creating medication:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.put('/api/medications/:id', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { id } = req.params;
        const docRef = firestore.collection('medications').doc(id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data()?.patientId !== uid) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        const updateData = {
            ...req.body,
            updatedAt: admin.firestore.Timestamp.now(),
            prescribedDate: req.body.prescribedDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.prescribedDate)) : undefined,
            startDate: req.body.startDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.startDate)) : undefined,
            endDate: req.body.endDate ? admin.firestore.Timestamp.fromDate(new Date(req.body.endDate)) : undefined,
        };
        await docRef.update(updateData);
        const updatedDoc = await docRef.get();
        const updatedMedication = {
            id: updatedDoc.id,
            ...updatedDoc.data(),
            createdAt: updatedDoc.data()?.createdAt?.toDate() || new Date(),
            updatedAt: updatedDoc.data()?.updatedAt?.toDate() || new Date(),
            prescribedDate: updatedDoc.data()?.prescribedDate?.toDate() || new Date(),
            startDate: updatedDoc.data()?.startDate?.toDate(),
            endDate: updatedDoc.data()?.endDate?.toDate(),
        };
        res.json({
            success: true,
            data: updatedMedication,
            message: 'Medication updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating medication:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.delete('/api/medications/:id', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { id } = req.params;
        const docRef = firestore.collection('medications').doc(id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data()?.patientId !== uid) {
            return res.status(404).json({
                success: false,
                error: 'Medication not found'
            });
        }
        await docRef.delete();
        res.json({
            success: true,
            message: 'Medication deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting medication:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Patient profile endpoints
app.get('/api/patients/profile', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const patientsRef = firestore.collection('patients').where('userId', '==', uid);
        const snapshot = await patientsRef.get();
        if (snapshot.empty) {
            return res.json({
                success: true,
                data: null,
                message: 'No patient profile found'
            });
        }
        const patientDoc = snapshot.docs[0];
        const patientData = {
            id: patientDoc.id,
            ...patientDoc.data(),
            createdAt: patientDoc.data().createdAt?.toDate() || new Date(),
            updatedAt: patientDoc.data().updatedAt?.toDate() || new Date(),
        };
        res.json({
            success: true,
            data: patientData,
            message: 'Patient profile retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error getting patient profile:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.post('/api/patients/profile', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const profileData = {
            ...req.body,
            userId: uid,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        const docRef = await firestore.collection('patients').add(profileData);
        const newDoc = await docRef.get();
        const newProfile = {
            id: newDoc.id,
            ...newDoc.data(),
            createdAt: newDoc.data()?.createdAt?.toDate() || new Date(),
            updatedAt: newDoc.data()?.updatedAt?.toDate() || new Date(),
        };
        res.status(201).json({
            success: true,
            data: newProfile,
            message: 'Patient profile created successfully'
        });
    }
    catch (error) {
        console.error('Error creating patient profile:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.put('/api/patients/profile', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        // Find existing patient profile
        const patientsRef = firestore.collection('patients').where('userId', '==', uid);
        const snapshot = await patientsRef.get();
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                error: 'Patient profile not found'
            });
        }
        const patientDoc = snapshot.docs[0];
        const updateData = {
            ...req.body,
            updatedAt: admin.firestore.Timestamp.now(),
        };
        await patientDoc.ref.update(updateData);
        const updatedDoc = await patientDoc.ref.get();
        const updatedProfile = {
            id: updatedDoc.id,
            ...updatedDoc.data(),
            createdAt: updatedDoc.data()?.createdAt?.toDate() || new Date(),
            updatedAt: updatedDoc.data()?.updatedAt?.toDate() || new Date(),
        };
        res.json({
            success: true,
            data: updatedProfile,
            message: 'Patient profile updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating patient profile:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Patient invitation endpoints
app.post('/api/invitations/send', authenticate, async (req, res) => {
    try {
        const { email, patientName, message } = req.body;
        const inviterUid = req.user.uid;
        if (!email || !patientName) {
            return res.status(400).json({
                success: false,
                error: 'Email and patient name are required'
            });
        }
        // Get inviter information
        const inviterDoc = await firestore.collection('users').doc(inviterUid).get();
        const inviterData = inviterDoc.data();
        const inviterName = inviterData?.name || 'A family member';
        // Create invitation record
        const invitationData = {
            inviterUid,
            inviterName,
            inviterEmail: inviterData?.email || '',
            patientEmail: email,
            patientName,
            message: message || '',
            status: 'pending',
            createdAt: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
        };
        const invitationRef = await firestore.collection('invitations').add(invitationData);
        const invitationId = invitationRef.id;
        // Send email invitation
        if (process.env.SENDGRID_API_KEY) {
            const invitationLink = `${APP_URL}/invitation/${invitationId}`;
            const emailContent = {
                to: email,
                from: SENDGRID_FROM_EMAIL,
                subject: `${inviterName} invited you to join KinConnect`,
                html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h2 style="color: #2563eb;">You're invited to join KinConnect!</h2>
						<p>Hi ${patientName},</p>
						<p>${inviterName} has invited you to join their family care network on KinConnect.</p>
						${message ? `<p><strong>Personal message:</strong><br>${message}</p>` : ''}
						<p>KinConnect helps families coordinate medical care and share important health information securely.</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="${invitationLink}"
								 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
								Accept Invitation
							</a>
						</div>
						<p style="color: #666; font-size: 14px;">
							This invitation will expire in 7 days. If you have any questions, please contact ${inviterName} directly.
						</p>
						<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
						<p style="color: #999; font-size: 12px;">
							This email was sent by KinConnect. If you didn't expect this invitation, you can safely ignore this email.
						</p>
					</div>
				`,
            };
            await mail_1.default.send(emailContent);
        }
        res.status(201).json({
            success: true,
            data: { invitationId, ...invitationData },
            message: 'Invitation sent successfully'
        });
    }
    catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send invitation'
        });
    }
});
// Get invitation details
app.get('/api/invitations/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const invitationDoc = await firestore.collection('invitations').doc(invitationId).get();
        if (!invitationDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Invitation not found'
            });
        }
        const invitationData = invitationDoc.data();
        // Check if invitation has expired
        const now = new Date();
        const expiresAt = invitationData?.expiresAt?.toDate();
        if (expiresAt && now > expiresAt) {
            return res.status(410).json({
                success: false,
                error: 'Invitation has expired'
            });
        }
        // Check if invitation is already accepted
        if (invitationData?.status === 'accepted') {
            return res.status(410).json({
                success: false,
                error: 'Invitation has already been accepted'
            });
        }
        res.json({
            success: true,
            data: {
                id: invitationId,
                ...invitationData,
                createdAt: invitationData?.createdAt?.toDate(),
                expiresAt: invitationData?.expiresAt?.toDate(),
            }
        });
    }
    catch (error) {
        console.error('Error getting invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invitation'
        });
    }
});
// Accept invitation
app.post('/api/invitations/:invitationId/accept', authenticate, async (req, res) => {
    try {
        const { invitationId } = req.params;
        const accepterUid = req.user.uid;
        const invitationDoc = await firestore.collection('invitations').doc(invitationId).get();
        if (!invitationDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Invitation not found'
            });
        }
        const invitationData = invitationDoc.data();
        // Check if invitation has expired
        const now = new Date();
        const expiresAt = invitationData?.expiresAt?.toDate();
        if (expiresAt && now > expiresAt) {
            return res.status(410).json({
                success: false,
                error: 'Invitation has expired'
            });
        }
        // Check if invitation is already accepted
        if (invitationData?.status === 'accepted') {
            return res.status(410).json({
                success: false,
                error: 'Invitation has already been accepted'
            });
        }
        // Update invitation status
        await firestore.collection('invitations').doc(invitationId).update({
            status: 'accepted',
            acceptedBy: accepterUid,
            acceptedAt: admin.firestore.Timestamp.now(),
        });
        // Create or update family group
        const inviterUid = invitationData?.inviterUid;
        if (inviterUid) {
            // Check if inviter already has a family group
            const familyGroupQuery = await firestore.collection('familyGroups')
                .where('createdBy', '==', inviterUid)
                .limit(1)
                .get();
            let familyGroupId;
            if (familyGroupQuery.empty) {
                // Create new family group
                const familyGroupData = {
                    createdBy: inviterUid,
                    name: `${invitationData?.inviterName}'s Family`,
                    members: [
                        {
                            uid: inviterUid,
                            email: invitationData?.inviterEmail,
                            name: invitationData?.inviterName,
                            role: 'admin',
                            joinedAt: admin.firestore.Timestamp.now(),
                        },
                        {
                            uid: accepterUid,
                            email: invitationData?.patientEmail,
                            name: invitationData?.patientName,
                            role: 'member',
                            joinedAt: admin.firestore.Timestamp.now(),
                        }
                    ],
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now(),
                };
                const familyGroupRef = await firestore.collection('familyGroups').add(familyGroupData);
                familyGroupId = familyGroupRef.id;
            }
            else {
                // Add to existing family group
                const familyGroupDoc = familyGroupQuery.docs[0];
                familyGroupId = familyGroupDoc.id;
                const familyGroupData = familyGroupDoc.data();
                // Check if user is already a member
                const existingMember = familyGroupData.members?.find((member) => member.uid === accepterUid);
                if (!existingMember) {
                    const newMember = {
                        uid: accepterUid,
                        email: invitationData?.patientEmail,
                        name: invitationData?.patientName,
                        role: 'member',
                        joinedAt: admin.firestore.Timestamp.now(),
                    };
                    await firestore.collection('familyGroups').doc(familyGroupId).update({
                        members: admin.firestore.FieldValue.arrayUnion(newMember),
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                }
            }
            // Update user profiles with family group reference
            await firestore.collection('users').doc(accepterUid).update({
                familyGroupId: familyGroupId,
                updatedAt: admin.firestore.Timestamp.now(),
            });
            // Ensure inviter also has family group reference
            await firestore.collection('users').doc(inviterUid).update({
                familyGroupId: familyGroupId,
                updatedAt: admin.firestore.Timestamp.now(),
            });
        }
        res.json({
            success: true,
            message: 'Invitation accepted successfully and family group updated'
        });
    }
    catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept invitation'
        });
    }
});
// Get user's sent invitations
app.get('/api/invitations/sent', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        const invitationsRef = firestore.collection('invitations')
            .where('inviterUid', '==', uid)
            .orderBy('createdAt', 'desc');
        const snapshot = await invitationsRef.get();
        const invitations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            expiresAt: doc.data().expiresAt?.toDate(),
            acceptedAt: doc.data().acceptedAt?.toDate(),
        }));
        res.json({
            success: true,
            data: invitations,
            message: 'Sent invitations retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error getting sent invitations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get sent invitations'
        });
    }
});
// Get user's family group
app.get('/api/family/group', authenticate, async (req, res) => {
    try {
        const uid = req.user.uid;
        // Get user's family group ID
        const userDoc = await firestore.collection('users').doc(uid).get();
        const userData = userDoc.data();
        const familyGroupId = userData?.familyGroupId;
        if (!familyGroupId) {
            return res.json({
                success: true,
                data: null,
                message: 'User is not part of any family group'
            });
        }
        // Get family group details
        const familyGroupDoc = await firestore.collection('familyGroups').doc(familyGroupId).get();
        if (!familyGroupDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Family group not found'
            });
        }
        const familyGroupData = familyGroupDoc.data();
        res.json({
            success: true,
            data: {
                id: familyGroupDoc.id,
                ...familyGroupData,
                createdAt: familyGroupData?.createdAt?.toDate(),
                updatedAt: familyGroupData?.updatedAt?.toDate(),
                members: familyGroupData?.members?.map((member) => ({
                    ...member,
                    joinedAt: member.joinedAt?.toDate(),
                })),
            },
            message: 'Family group retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error getting family group:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get family group'
        });
    }
});
exports.api = functions
    .runWith({
    memory: '512MB',
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 10,
    secrets: ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'APP_URL']
})
    .https.onRequest(app);
