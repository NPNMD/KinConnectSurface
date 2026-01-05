interface InvitationEmailProps {
  patientName: string;
  inviterName: string;
  invitationLink: string;
  message?: string;
}

import { escapeHtml } from '../../../../shared/utils/security';

export const getInvitationEmailHtml = ({
  patientName,
  inviterName,
  invitationLink,
  message,
}: InvitationEmailProps): string => {
  const safePatientName = escapeHtml(patientName);
  const safeInviterName = escapeHtml(inviterName);
  const safeMessage = message ? escapeHtml(message) : '';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">You're invited to join KinConnect!</h2>
      <p>Hi ${safePatientName},</p>
      <p>${safeInviterName} has invited you to join their family care network on KinConnect.</p>
      ${safeMessage ? `<p><strong>Personal message:</strong><br>${safeMessage}</p>` : ''}
      <p>KinConnect helps families coordinate medical care and share important health information securely.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationLink}"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        This invitation will expire in 7 days. If you have any questions, please contact ${safeInviterName} directly.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        This email was sent by KinConnect. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;
};
