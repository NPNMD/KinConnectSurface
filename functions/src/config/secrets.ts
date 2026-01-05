import { defineSecret } from 'firebase-functions/params';

/**
 * Firebase Functions secrets configuration
 */
export const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
export const googleAIApiKey = defineSecret('GOOGLE_AI_API_KEY');

