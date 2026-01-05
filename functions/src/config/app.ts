import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { limiter } from '../middleware';

/**
 * Creates and configures the Express application with all middleware
 */
export function createApp(): express.Application {
	const app = express();

	// Security middleware - Configure for OAuth compatibility
	app.use(helmet({
		crossOriginOpenerPolicy: false, // Disable COOP entirely for OAuth compatibility
		crossOriginEmbedderPolicy: false,
		contentSecurityPolicy: false,
	}));

	// Add explicit headers for OAuth compatibility
	app.use((req, res, next) => {
		// Remove any restrictive COOP headers
		res.removeHeader('Cross-Origin-Opener-Policy');
		// Set permissive COOP for OAuth popups
		res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
		next();
	});

	app.use(cors({
		origin: true,
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization'],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
	}));

	app.use(express.json({ limit: '10mb' }));
	app.use(express.urlencoded({ extended: true, limit: '10mb' }));

	// Apply rate limiting to all routes
	app.use(limiter);

	return app;
}

