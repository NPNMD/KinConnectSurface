# KinConnect Documentation

Welcome to the KinConnect documentation hub! This directory contains comprehensive documentation for developers, API users, and contributors.

## 📚 Documentation Index

### API Documentation

- **[API Documentation Guide](./API_DOCUMENTATION.md)** - Complete guide to using the KinConnect API
  - Getting started
  - Authentication flow
  - Endpoint reference
  - Common use cases
  - Error handling
  - Best practices

- **[OpenAPI Specification](./api/openapi.yaml)** - Complete OpenAPI 3.0 specification
  - Machine-readable API definition
  - Schema definitions
  - Request/response examples
  - Import into API tools

- **[Postman Collection](./api/KinConnect.postman_collection.json)** - Ready-to-use Postman collection
  - Pre-configured requests
  - Environment variables
  - Test scripts
  - Import and test immediately

### Technical Documentation

- **[Audit Logging](../AUDIT_LOGGING.md)** - Comprehensive audit logging system
  - Track all user actions
  - Compliance requirements
  - Security monitoring
  - Query audit logs

- **[Firestore Indexes](../FIRESTORE_INDEXES.md)** - Database index configuration
  - Required composite indexes
  - Performance optimization
  - Query patterns

- **[Caching Strategy](../CACHING.md)** - API caching implementation
  - Redis-based caching
  - Cache invalidation
  - Performance improvements

- **[Error Monitoring](../ERROR_MONITORING.md)** - Sentry error tracking
  - Error reporting setup
  - Alert configuration
  - HIPAA compliance

- **[Performance Monitoring](./PERFORMANCE_MONITORING.md)** - Comprehensive performance tracking
  - API and database metrics
  - Core Web Vitals tracking
  - Performance budgets and KPIs
  - Optimization strategies
  - Load testing and benchmarking

### Setup & Deployment

- **[Firebase Setup](../FIREBASE_SETUP.md)** - Firebase project configuration
- **[Google Services Setup](../GOOGLE_SETUP.md)** - OAuth and Calendar integration
- **[Deployment Guide](../DEPLOYMENT.md)** - Production deployment instructions
- **[Audit Deployment](../AUDIT_DEPLOYMENT.md)** - Deploying audit logging features

## 🚀 Quick Start

### For API Users

1. **View Interactive API Documentation**:
   ```
   http://localhost:5001/{project-id}/us-central1/api-docs
   ```
   Or in production:
   ```
   https://us-central1-{project-id}.cloudfunctions.net/api-docs
   ```

2. **Import Postman Collection**:
   - Open Postman
   - Import [`api/KinConnect.postman_collection.json`](./api/KinConnect.postman_collection.json)
   - Set up environment variables (see Postman collection description)

3. **Read the API Guide**:
   - Start with [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)
   - Learn authentication flow
   - Explore common use cases

### For Developers

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kinconnect/kinconnect.git
   cd kinconnect
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd functions && npm install
   ```

3. **Set up Firebase**:
   - Follow [`FIREBASE_SETUP.md`](../FIREBASE_SETUP.md)
   - Configure environment variables
   - Set up Firestore indexes

4. **Run locally**:
   ```bash
   npm run dev
   ```

5. **Access API documentation**:
   ```
   http://localhost:5001/kinconnect-dev/us-central1/api-docs
   ```

## 🔑 Using Swagger UI

The interactive Swagger UI provides a user-friendly interface to explore and test the API.

### Accessing Swagger UI

**Development**:
```
http://localhost:5001/{your-project-id}/us-central1/api-docs
```

**Production**:
```
https://us-central1-{your-project-id}.cloudfunctions.net/api-docs
```

### Authenticating in Swagger UI

1. Click the **"Authorize"** button in the top right
2. Enter your Firebase ID token in the format: `Bearer YOUR_TOKEN`
3. Click **"Authorize"** and then **"Close"**
4. All subsequent requests will include authentication

### Getting Your Firebase Token

**From Browser Console** (when logged in):
```javascript
firebase.auth().currentUser.getIdToken().then(token => console.log(token));
```

**From Application** (IndexedDB):
1. Open browser DevTools
2. Go to Application > IndexedDB > firebaseLocalStorage
3. Find `stsTokenManager.accessToken`
4. Copy the token value

### Testing Endpoints

1. Select an endpoint from the list
2. Click **"Try it out"**
3. Fill in required parameters
4. Click **"Execute"**
5. View the response below

## 📦 Using Postman Collection

### Importing the Collection

1. Open Postman
2. Click **Import**
3. Select [`api/KinConnect.postman_collection.json`](./api/KinConnect.postman_collection.json)
4. The collection will appear in your sidebar

### Setting Up Environment

1. Create a new environment in Postman
2. Add these variables:
   - `baseUrl`: Your API base URL (e.g., `http://localhost:5001/kinconnect-dev/us-central1/api`)
   - `authToken`: Your Firebase ID token (get from browser or app)

3. Select the environment in the top-right dropdown

### Running Requests

1. Select a request from the collection
2. Ensure your environment is selected
3. Click **Send**
4. View the response and test results

### Test Scripts

Many requests include test scripts that:
- Validate response status codes
- Check response structure
- Store values for subsequent requests (e.g., medication IDs)

Check the **Tests** tab after running a request to see results.

## 📖 API Overview

### Authentication
All API endpoints (except health check and public invitation endpoints) require Firebase Authentication.

**Header Format**:
```
Authorization: Bearer <firebase-id-token>
```

### Base URL
```
https://us-central1-{project-id}.cloudfunctions.net/api
```

### Endpoints

| Category | Endpoints |
|----------|-----------|
| **Authentication** | `/auth/profile` - User profile management |
| **Patients** | `/patients/profile` - Patient profile CRUD |
| **Medications** | `/medications` - Medication management<br>`/medications/{id}/reminders` - Reminder management |
| **Drug Search** | `/drugs/search` - Search drugs<br>`/drugs/{rxcui}` - Drug details<br>`/drugs/{rxcui}/interactions` - Drug interactions<br>`/drugs/{rxcui}/images` - Drug images<br>`/drugs/{rxcui}/clinical-info` - Clinical information |
| **Invitations** | `/invitations/send` - Send invitation<br>`/invitations/{id}/accept` - Accept invitation |
| **Family** | `/family/group` - Family group management |

### Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description"
}
```

## 🛠️ Development Workflow

### Local Development

1. **Start Firebase Emulators** (optional):
   ```bash
   firebase emulators:start
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Access API Documentation**:
   ```
   http://localhost:5001/{project-id}/us-central1/api-docs
   ```

### Testing API Changes

1. Update route files in [`functions/src/routes/`](../functions/src/routes/)
2. Update OpenAPI spec in [`docs/api/openapi.yaml`](./api/openapi.yaml)
3. Test changes in Swagger UI
4. Update Postman collection if needed
5. Document in [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)

### Updating API Documentation

When adding new endpoints:

1. **Add route handler** in appropriate route file
2. **Update OpenAPI spec**:
   ```yaml
   /api/new-endpoint:
     get:
       tags: [Category]
       summary: Brief description
       # ... full endpoint definition
   ```
3. **Add to Postman collection** with example request
4. **Document in API guide** with usage examples
5. **Test thoroughly** using Swagger UI

## 📝 API Versioning

Current API version: **v1**

Future versions will be accessible via:
```
/api/v2/endpoint
```

Version 1 will remain available for backward compatibility.

## 🔒 Security

- All endpoints use **HTTPS** in production
- **Firebase Authentication** with Bearer tokens
- **Rate limiting**: 100 requests per 15 minutes
- **CORS** configured for approved origins
- **Helmet.js** security headers
- **Input validation** on all endpoints

## 📊 Rate Limiting

API requests are rate limited to prevent abuse:

- **Limit**: 100 requests per 15-minute window
- **Scope**: Per IP address
- **Applied to**: All `/api/*` endpoints
- **Exempt**: Health check endpoint

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## 🐛 Error Handling

### Standard HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 410 | Gone | Invitation expired |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | External service down |

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md#error-handling) for detailed error handling guide.

## 🔗 External APIs

KinConnect integrates with several external APIs:

- **[RxNorm](https://lhncbc.nlm.nih.gov/RxNav/)** - Drug database and search
- **[RxImage](https://rximage.nlm.nih.gov/)** - Drug images
- **[DailyMed](https://dailymed.nlm.nih.gov/)** - Clinical drug information
- **[Firebase](https://firebase.google.com/)** - Authentication, Firestore, Functions
- **[Google Calendar API](https://developers.google.com/calendar)** - Appointment integration

## 📚 Additional Resources

### Official Documentation
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Cloud Functions](https://firebase.google.com/docs/functions)
- [OpenAPI Specification](https://swagger.io/specification/)

### Tools
- [Postman](https://www.postman.com/) - API testing
- [Swagger Editor](https://editor.swagger.io/) - Edit OpenAPI specs
- [Firebase Console](https://console.firebase.google.com/) - Manage Firebase project

### Standards
- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [JSON API Specification](https://jsonapi.org/)

## 💬 Support & Contributing

### Getting Help

- **Documentation Issues**: Open an issue on GitHub
- **API Questions**: Contact support@kinconnect.app
- **Bug Reports**: Use GitHub issue tracker

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Update relevant documentation
5. Submit a pull request

See the main [README](../README.md) for contribution guidelines.

## 📄 License

KinConnect is open source software licensed under the MIT license.

---

**Last Updated**: January 2026  
**API Version**: v1.0.0  
**Documentation Version**: 1.0.0
