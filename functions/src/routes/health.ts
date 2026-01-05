import express from 'express';

/**
 * Health check and test routes
 */
export function registerHealthRoutes(app: express.Application) {
	// Health endpoint
	app.get('/health', (req, res) => {
		res.json({
			success: true,
			message: 'Enhanced Functions API healthy with family access improvements',
			timestamp: new Date().toISOString(),
			version: '2.0.0'
		});
	});

	// Test endpoint to verify deployment
	app.get('/test-deployment', (req, res) => {
		res.json({ success: true, message: 'Deployment working!', timestamp: new Date().toISOString() });
	});

	// Test remove endpoint
	app.post('/test-remove/:id', (req, res) => {
		res.json({ success: true, message: 'Test remove endpoint working!', id: req.params.id });
	});
}

