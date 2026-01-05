import { escapeHtml } from '../../../../shared/utils/security';

export const getWelcomeEmailHtml = (name: string): string => {
  const safeName = escapeHtml(name);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to KinConnect!</h2>
      <p>Hi ${safeName},</p>
      <p>We're thrilled to have you on board. KinConnect makes it easy to coordinate care for your loved ones.</p>
      <p>With KinConnect, you can:</p>
      <ul>
        <li>Track medications and get reminders</li>
        <li>Share health information with family members</li>
        <li>Manage appointments and care tasks</li>
      </ul>
      <p>If you have any questions, simply reply to this email.</p>
      <p>Best regards,<br>The KinConnect Team</p>
    </div>
  `;
};
