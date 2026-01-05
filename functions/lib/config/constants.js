"use strict";
/**
 * Application constants and configuration values
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCESS_LEVELS = exports.APP_URL = exports.SENDGRID_FROM_EMAIL = void 0;
exports.SENDGRID_FROM_EMAIL = 'mike.nguyen@twfg.com';
exports.APP_URL = 'https://claritystream-uldp9.web.app';
// Access levels for email template
exports.ACCESS_LEVELS = [
    { value: 'full', label: 'Full Access', description: 'Can view, create, and edit all medical information' },
    { value: 'limited', label: 'Limited Access', description: 'Can view and create appointments, limited medical info' },
    { value: 'view_only', label: 'View Only', description: 'Can only view basic appointment information' },
    { value: 'emergency_only', label: 'Emergency Only', description: 'Only receives emergency notifications' }
];
