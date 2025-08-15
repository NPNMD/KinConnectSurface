# Google API Setup Guide

This guide will help you set up Google Places and Google Calendar integration for KinConnect.

## Required Google APIs

1. **Google Maps JavaScript API** (for address autocomplete)
2. **Google Calendar API** (for appointment scheduling)

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 2. Enable Required APIs

1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for and enable:
   - **Maps JavaScript API**
   - **Places API**
   - **Calendar API**

### 3. Create API Credentials

#### For Google Maps/Places API:
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the API key
4. Click on the key to configure it:
   - Under **Application restrictions**, select **HTTP referrers**
   - Add your domains:
     - `http://localhost:*/*` (for development)
     - `https://claritystream-uldp9.web.app/*` (for production)
   - Under **API restrictions**, select **Restrict key**
   - Choose:
     - Maps JavaScript API
     - Places API

#### For Google Calendar API:
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. Configure the OAuth consent screen if prompted
4. For **Application type**, select **Web application**
5. Add authorized origins:
   - `http://localhost:5173` (for development)
   - `https://claritystream-uldp9.web.app` (for production)
6. Copy the **Client ID**

### 4. Configure Environment Variables

Create a `.env` file in your project root with:

```env
# Google Maps API (for address autocomplete)
VITE_GOOGLE_MAPS_API_KEY=your_maps_api_key_here

# Google Calendar API (for appointment scheduling)
VITE_GOOGLE_CLIENT_ID=your_oauth_client_id_here
```

### 5. Test the Integration

1. Start your development server: `npm run dev`
2. Go to the profile page
3. Try editing your profile:
   - The address field should show autocomplete suggestions
   - The appointments section should allow you to connect Google Calendar

## Security Notes

- Never commit your API keys to version control
- Use environment variables for all sensitive credentials
- Restrict your API keys to specific domains and APIs
- Monitor your API usage in Google Cloud Console

## Troubleshooting

### Address Autocomplete Not Working
- Check that the Google Maps API key is correctly set
- Verify the Maps JavaScript API and Places API are enabled
- Check browser console for any CORS or API key errors

### Google Calendar Integration Issues
- Ensure the OAuth 2.0 Client ID is correctly configured
- Check that authorized origins include your domain
- Verify the Calendar API is enabled in Google Cloud Console

### API Key Errors
- Make sure API keys are not restricted to the wrong domains
- Check that the required APIs are enabled
- Verify billing is enabled on your Google Cloud project (required for Maps API)

## Cost Considerations

- Google Maps API has usage limits and pricing
- Places API calls are charged per request
- Calendar API has generous free quotas
- Monitor usage in Google Cloud Console to avoid unexpected charges

For more detailed information, refer to:
- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)