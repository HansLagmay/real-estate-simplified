/**
 * Authentication Middleware
 * JWT token verification and role-based access control
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Validate JWT_SECRET is set in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is not set in production');
    process.exit(1);
}

// Use fallback only in development
const jwtSecret = JWT_SECRET || 'real-estate-simplified-dev-secret-change-in-production';

/**
 * Verify JWT token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

/**
 * Check if user is agent or admin
 */
const isAgentOrAdmin = (req, res, next) => {
    if (!['agent', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Agent or admin access required'
        });
    }
    next();
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
        },
        jwtSecret,
        { expiresIn: '24h' }
    );
};

module.exports = {
    authenticateToken,
    isAdmin,
    isAgentOrAdmin,
    generateToken,
    jwtSecret
};
