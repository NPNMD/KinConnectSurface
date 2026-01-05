"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const middleware_1 = require("../middleware");
/**
 * Creates and configures the Express application with all middleware
 */
function createApp() {
    const app = (0, express_1.default)();
    // Security middleware - Configure for OAuth compatibility
    app.use((0, helmet_1.default)({
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
    app.use((0, cors_1.default)({
        origin: true,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Apply rate limiting to all routes
    app.use(middleware_1.limiter);
    return app;
}
