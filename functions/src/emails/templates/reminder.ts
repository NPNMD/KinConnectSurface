interface ReminderEmailProps {
  name: string;
  medicationName: string;
  dosage: string;
  time: string;
  instructions?: string;
}

import { escapeHtml } from '../../../../shared/utils/security';

export const getReminderEmailHtml = ({
  name,
  medicationName,
  dosage,
  time,
  instructions
}: ReminderEmailProps): string => {
  const safeName = escapeHtml(name);
  const safeMedicationName = escapeHtml(medicationName);
  const safeDosage = escapeHtml(dosage);
  const safeTime = escapeHtml(time);
  const safeInstructions = instructions ? escapeHtml(instructions) : '';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Medication Reminder</h2>
      <p>Hi ${safeName},</p>
      <p>It's time to take your medication:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #111827;">${safeMedicationName}</h3>
        <p style="margin: 5px 0;"><strong>Dosage:</strong> ${safeDosage}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${safeTime}</p>
        ${safeInstructions ? `<p style="margin: 5px 0;"><strong>Instructions:</strong> ${safeInstructions}</p>` : ''}
      </div>
      <p>Don't forget to log it in the app once you've taken it.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL || 'https://kinconnect.app'}"
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Log Medication
        </a>
      </div>
    </div>
  `;
};
