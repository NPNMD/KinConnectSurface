# KinConnect - Family Care Coordination Platform

A comprehensive family care coordination platform built with React, TypeScript, Node.js, and Firebase for managing patient medical information, medications, appointments, and family group coordination.

## 🚀 Features

- **User Authentication**: Google OAuth 2.0 integration with Firebase
- **Patient Profiles**: Comprehensive medical information management
- **Family Coordination**: Connect family members and caregivers
- **Medication Tracking**: Prescription and dosage management
- **Appointment Scheduling**: Healthcare visit coordination
- **Task Management**: Care coordination task assignment
- **Secure & Private**: HIPAA-compliant with enterprise-grade security

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **TanStack Query** for data fetching
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Firebase Admin SDK** for backend services
- **Firestore** for database
- **Firebase Authentication** for user management

### Infrastructure
- **Firebase** for hosting, authentication, and database
- **Vite** for fast development and building
- **ESLint** and **Prettier** for code quality

## 📁 Project Structure

```
kinconnect/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React contexts (Auth, etc.)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   ├── pages/         # Page components
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # App entry point
│   └── index.html         # HTML template
├── server/                 # Node.js backend
│   ├── middleware/         # Express middleware
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   ├── firebase-admin.ts  # Firebase Admin configuration
│   └── index.ts           # Server entry point
├── shared/                 # Shared types and utilities
│   ├── types.ts           # TypeScript interfaces
│   └── firebase.ts        # Firebase configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (or 20+ recommended)
- npm or yarn package manager
- Firebase project with Authentication and Firestore enabled
- Google Cloud Console account for OAuth

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kinconnect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000
   
   # Firebase Configuration
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"claritystream-uldp9","private_key_id":"your_private_key_id","private_key":"your_private_key","client_email":"your_client_email","client_id":"your_client_id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"your_cert_url"}
   
   # Client Configuration
   VITE_API_URL=http://localhost:5000/api
   
   # Security
   SESSION_SECRET=your-super-secret-session-key-here
   ```

4. **Firebase Setup**
   
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project or use existing one
   - Enable Authentication with Google provider
   - Enable Firestore database
   - Download service account key and add to `.env`

5. **Google OAuth Setup**
   
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `http://localhost:3000` (development)
     - `https://your-domain.com` (production)

### Development

1. **Start the development server**
   ```bash
   npm run dev
   ```
   
   This will start both:
   - Backend server on `http://localhost:5000`
   - Frontend dev server on `http://localhost:3000`

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Start production server**
   ```bash
   npm start
   ```

## 🔧 Available Scripts

- `npm run dev` - Start development servers
- `npm run server:dev` - Start backend server only
- `npm run client:dev` - Start frontend dev server only
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run type-check` - Run TypeScript type checking

## 🌐 API Endpoints

### Authentication
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `DELETE /api/auth/account` - Delete user account
- `GET /api/auth/search` - Search users

### Patients
- `GET /api/patients/profile` - Get patient profile
- `POST /api/patients/profile` - Create patient profile
- `PUT /api/patients/profile` - Update patient profile
- `GET /api/patients/:id` - Get patient by ID
- `GET /api/patients/search/condition/:condition` - Search by medical condition
- `GET /api/patients/search/allergy/:allergy` - Search by allergy
- `GET /api/patients/search/age/:min/:max` - Search by age range

### Health Check
- `GET /api/health` - API health status

## 🔒 Security Features

- **Firebase Authentication** with Google OAuth 2.0
- **JWT Token Validation** for API requests
- **Rate Limiting** to prevent abuse
- **CORS Configuration** for cross-origin requests
- **Input Validation** and sanitization
- **Secure Headers** with Helmet.js

## 🎨 UI Components

The application uses a custom design system built with Tailwind CSS:

- **Buttons**: Primary, secondary, and danger variants
- **Cards**: Consistent card layouts
- **Forms**: Styled form inputs and labels
- **Loading States**: Spinner components
- **Responsive Design**: Mobile-first approach

## 📱 Responsive Design

- Mobile-first responsive design
- Optimized for all screen sizes
- Touch-friendly interface
- Accessible navigation

## 🚀 Deployment

### Firebase Hosting

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase**
   ```bash
   firebase deploy
   ```

### Environment Variables

Make sure to set the following environment variables in your production environment:

- `NODE_ENV=production`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `VITE_API_URL`
- `SESSION_SECRET`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation

## 🔮 Roadmap

### Phase 1 (Current)
- [x] User authentication
- [x] Basic patient profiles
- [x] Dashboard interface
- [x] Profile management

### Phase 2 (Next)
- [ ] Medication management
- [ ] Appointment scheduling
- [ ] Family group coordination
- [ ] Task management

### Phase 3 (Future)
- [ ] Real-time notifications
- [ ] Mobile app development
- [ ] Third-party integrations
- [ ] Advanced analytics

---

**Built with ❤️ by the KinConnect Team**
