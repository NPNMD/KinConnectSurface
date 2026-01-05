/**
 * Application constants and configuration values
 */

export const SENDGRID_FROM_EMAIL = 'mike.nguyen@twfg.com';
export const APP_URL = 'https://claritystream-uldp9.web.app';

// Access levels for email template
export const ACCESS_LEVELS = [
	{ value: 'full', label: 'Full Access', description: 'Can view, create, and edit all medical information' },
	{ value: 'limited', label: 'Limited Access', description: 'Can view and create appointments, limited medical info' },
	{ value: 'view_only', label: 'View Only', description: 'Can only view basic appointment information' },
	{ value: 'emergency_only', label: 'Emergency Only', description: 'Only receives emergency notifications' }
];

