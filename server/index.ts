import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import medicationRoutes from './routes/medications';
import medicationCalendarRoutes from './routes/medicationCalendar';
import drugRoutes from './routes/drugs';
import healthcareProviderRoutes from './routes/healthcare-providers';
import calendarRoutes from './routes/calendar';
import familyAccessRoutes from './routes/familyAccess';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
// Configure helmet to allow OAuth popups (Firebase Google sign-in)
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://claritystream-uldp9.web.app', 'https://your-domain.com'] // Update with your production domain
    : ['http://localhost:3000', 'http://localhost:3001', 'https://claritystream-uldp9.web.app'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/medication-calendar', medicationCalendarRoutes);
app.use('/api/drugs', drugRoutes);
app.use('/api/healthcare', healthcareProviderRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/family-access', familyAccessRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'KinConnect API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist/client')));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/client/index.html'));
  });
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 KinConnect server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🎯 Client dev server: http://localhost:3000`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
