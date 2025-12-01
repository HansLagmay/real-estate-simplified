/**
 * Real Estate Simplified - Backend Server
 * Express.js API with MySQL database
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const propertiesRoutes = require('./routes/properties');
const appointmentsRoutes = require('./routes/appointments');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    }
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// Stricter rate limit for public form submissions
const formLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: {
        success: false,
        message: 'Too many form submissions, please try again later'
    }
});

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Real Estate Simplified API is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/users', usersRoutes);

// Apply form limiter to appointment creation
app.use('/api/appointments', formLimiter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Start server
const startServer = async () => {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
        console.warn('⚠️  Starting server without database connection');
        console.warn('   Make sure MySQL is running and configured correctly');
    }

    app.listen(PORT, () => {
        console.log(`\n🏠 Real Estate Simplified API Server`);
        console.log(`   Running on: http://localhost:${PORT}`);
        console.log(`   Health check: http://localhost:${PORT}/api/health`);
        console.log(`\n   Endpoints:`);
        console.log(`   - POST /api/auth/login`);
        console.log(`   - GET  /api/properties`);
        console.log(`   - POST /api/appointments`);
        console.log(`   - GET  /api/health\n`);
    });
};

startServer();

module.exports = app;
