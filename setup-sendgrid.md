# SendGrid Setup Instructions

## Step 1: Add Environment Variables

Add the following environment variables to your `.env` file (create it if it doesn't exist):

```bash
# SendGrid Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=your_verified_sender_email@domain.com
SENDGRID_FROM_NAME=KinConnect Medical Calendar
```

## Step 2: Test SendGrid Integration

After adding the environment variables, restart your development server and run the test:

```bash
# Restart the dev server (Ctrl+C then npm run dev)
npm run dev

# In a new terminal, run the SendGrid test
node test-sendgrid.js
```

## Step 3: Verify Email Delivery

Check the email inbox for the configured sender email to confirm that test emails are being delivered.

## Step 4: Integration with Calendar Service

Once SendGrid is working, the email service will automatically be used by the calendar service for:

- Family member invitations
- Appointment notifications
- Transportation responsibility alerts
- Appointment reminders

## Environment Variables Explanation

- `SENDGRID_API_KEY`: Your SendGrid API key for authentication
- `SENDGRID_FROM_EMAIL`: The verified sender email address
- `SENDGRID_FROM_NAME`: The display name for outgoing emails

## Security Notes

- Keep API keys secure and never commit them to version control
- In production, use environment-specific API keys
- Ensure the sender email is verified in SendGrid
- Consider using SendGrid templates for production

## Troubleshooting

If emails aren't sending:

1. Verify the API key is correct
2. Ensure the sender email is verified in SendGrid
3. Check the server logs for error messages
4. Verify SendGrid account status and quotas

## Next Steps

Once SendGrid is working, we can proceed with Week 2 implementation:
- Family invitation system
- Email notification workflows
- Family access management UI