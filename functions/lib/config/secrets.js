"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleAIApiKey = exports.sendgridApiKey = void 0;
const params_1 = require("firebase-functions/params");
/**
 * Firebase Functions secrets configuration
 */
exports.sendgridApiKey = (0, params_1.defineSecret)('SENDGRID_API_KEY');
exports.googleAIApiKey = (0, params_1.defineSecret)('GOOGLE_AI_API_KEY');
