/**
 * Appointments Routes
 * Customer viewing requests and scheduling
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const { authenticateToken, isAdmin, isAgentOrAdmin } = require('../middleware/auth');
require('dotenv').config();

// Email transporter (configure in production)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Verify reCAPTCHA token (v3)
 */
const verifyRecaptcha = async (token) => {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
        // Skip verification if not configured
        return { success: true, score: 1.0 };
    }

    try {
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
        });
        return await response.json();
    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        return { success: false };
    }
};

/**
 * Send notification email
 */
const sendNotificationEmail = async (to, subject, html) => {
    if (!process.env.SMTP_USER) {
        console.log('Email not configured, skipping notification');
        return;
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@realestate.com',
            to,
            subject,
            html
        });
    } catch (error) {
        console.error('Email send error:', error);
    }
};

/**
 * POST /api/appointments
 * Public - Submit viewing request
 */
router.post('/', [
    body('propertyId').isInt({ min: 1 }),
    body('customerName').trim().notEmpty().isLength({ max: 200 }),
    body('customerEmail').isEmail().normalizeEmail(),
    body('customerPhone').trim().notEmpty().isLength({ max: 20 }),
    body('customerIntent').isIn(['buy', 'rent', 'invest', 'inquire']),
    body('customerMessage').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { propertyId, customerName, customerEmail, customerPhone, customerIntent, customerMessage, recaptchaToken } = req.body;

        // Verify reCAPTCHA
        let recaptchaScore = null;
        if (recaptchaToken) {
            const recaptchaResult = await verifyRecaptcha(recaptchaToken);
            if (!recaptchaResult.success) {
                return res.status(400).json({
                    success: false,
                    message: 'reCAPTCHA verification failed'
                });
            }
            recaptchaScore = recaptchaResult.score;
            
            // Block if score is too low (likely bot)
            if (recaptchaScore < 0.3) {
                return res.status(400).json({
                    success: false,
                    message: 'Request blocked due to suspicious activity'
                });
            }
        }

        // Verify property exists and is available
        const [properties] = await pool.query(
            'SELECT id, title, status FROM properties WHERE id = ?',
            [propertyId]
        );

        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        if (properties[0].status !== 'available') {
            return res.status(400).json({
                success: false,
                message: 'Property is no longer available for viewing'
            });
        }

        // Check for duplicate requests (same email + property within 24 hours)
        const [duplicates] = await pool.query(
            `SELECT id FROM appointments 
             WHERE property_id = ? AND customer_email = ? 
             AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
            [propertyId, customerEmail]
        );

        if (duplicates.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a request for this property. We will contact you soon.'
            });
        }

        // Get client IP (using socket.remoteAddress for Node.js compatibility)
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';

        // Insert appointment (priority_number is auto-assigned by trigger)
        const [result] = await pool.query(
            `INSERT INTO appointments 
             (property_id, customer_name, customer_email, customer_phone, customer_intent, customer_message, 
              recaptcha_score, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [propertyId, customerName, customerEmail, customerPhone, customerIntent || 'inquire', customerMessage || null, 
             recaptchaScore, ipAddress]
        );

        // Send confirmation email to customer
        await sendNotificationEmail(
            customerEmail,
            'Viewing Request Received - Real Estate Simplified',
            `
            <h2>Thank you for your viewing request!</h2>
            <p>Dear ${customerName},</p>
            <p>We have received your request to view <strong>${properties[0].title}</strong>.</p>
            <p>One of our agents will contact you within 24 hours to schedule a viewing.</p>
            <p>If you have any urgent questions, please call us at +63-917-123-4567.</p>
            <br>
            <p>Best regards,<br>Real Estate Simplified Team</p>
            `
        );

        res.status(201).json({
            success: true,
            message: 'Your viewing request has been submitted. We will contact you within 24 hours.',
            appointmentId: result.insertId
        });
    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit request'
        });
    }
});

/**
 * GET /api/appointments
 * Admin - Get all appointments
 */
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND a.status = ?';
            params.push(status);
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM appointments a ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        // Get appointments
        const [appointments] = await pool.query(
            `SELECT a.*, 
                    p.title as property_title, p.address as property_address, p.city as property_city,
                    CONCAT(u.first_name, ' ', u.last_name) as assigned_agent_name
             FROM appointments a
             JOIN properties p ON p.id = a.property_id
             LEFT JOIN users u ON u.id = a.assigned_agent_id
             ${whereClause}
             ORDER BY 
                CASE a.status 
                    WHEN 'pending' THEN 1 
                    WHEN 'assigned' THEN 2 
                    WHEN 'scheduled' THEN 3 
                    ELSE 4 
                END,
                a.priority_number ASC,
                a.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({
            success: true,
            appointments: appointments.map(a => ({
                id: a.id,
                propertyId: a.property_id,
                propertyTitle: a.property_title,
                propertyAddress: a.property_address,
                propertyCity: a.property_city,
                customerName: a.customer_name,
                customerEmail: a.customer_email,
                customerPhone: a.customer_phone,
                customerIntent: a.customer_intent,
                customerMessage: a.customer_message,
                priorityNumber: a.priority_number,
                status: a.status,
                assignedAgentId: a.assigned_agent_id,
                assignedAgentName: a.assigned_agent_name,
                assignedAt: a.assigned_at,
                scheduledDate: a.scheduled_date,
                scheduledTime: a.scheduled_time,
                outcome: a.outcome,
                agentNotes: a.agent_notes,
                createdAt: a.created_at
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments'
        });
    }
});

/**
 * GET /api/appointments/my
 * Agent - Get my assigned appointments
 */
router.get('/my', authenticateToken, isAgentOrAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = 'WHERE a.assigned_agent_id = ?';
        const params = [req.user.id];

        if (status) {
            whereClause += ' AND a.status = ?';
            params.push(status);
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM appointments a ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        // Get appointments
        const [appointments] = await pool.query(
            `SELECT a.*, 
                    p.title as property_title, p.address as property_address, 
                    p.city as property_city, p.price as property_price
             FROM appointments a
             JOIN properties p ON p.id = a.property_id
             ${whereClause}
             ORDER BY 
                CASE a.status 
                    WHEN 'assigned' THEN 1 
                    WHEN 'scheduled' THEN 2 
                    ELSE 3 
                END,
                a.scheduled_date ASC,
                a.priority_number ASC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({
            success: true,
            appointments: appointments.map(a => ({
                id: a.id,
                propertyId: a.property_id,
                propertyTitle: a.property_title,
                propertyAddress: a.property_address,
                propertyCity: a.property_city,
                propertyPrice: a.property_price ? parseFloat(a.property_price) : null,
                customerName: a.customer_name,
                customerEmail: a.customer_email,
                customerPhone: a.customer_phone,
                customerIntent: a.customer_intent,
                customerMessage: a.customer_message,
                priorityNumber: a.priority_number,
                status: a.status,
                scheduledDate: a.scheduled_date,
                scheduledTime: a.scheduled_time,
                outcome: a.outcome,
                agentNotes: a.agent_notes,
                createdAt: a.created_at
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get my appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments'
        });
    }
});

/**
 * PUT /api/appointments/:id/assign
 * Admin - Assign agent to appointment
 */
router.put('/:id/assign', authenticateToken, isAdmin, [
    body('agentId').isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { agentId } = req.body;

        // Verify appointment exists
        const [appointments] = await pool.query(
            `SELECT a.*, p.title as property_title, p.address as property_address
             FROM appointments a
             JOIN properties p ON p.id = a.property_id
             WHERE a.id = ?`,
            [id]
        );

        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Verify agent exists and is an agent
        const [agents] = await pool.query(
            "SELECT id, email, first_name FROM users WHERE id = ? AND role = 'agent' AND is_active = TRUE",
            [agentId]
        );

        if (agents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Agent not found or inactive'
            });
        }

        const appointment = appointments[0];
        const agent = agents[0];

        // Update appointment
        await pool.query(
            `UPDATE appointments SET 
             assigned_agent_id = ?, 
             assigned_at = NOW(),
             status = 'assigned'
             WHERE id = ?`,
            [agentId, id]
        );

        // Send email to agent
        await sendNotificationEmail(
            agent.email,
            'New Viewing Request Assigned - Real Estate Simplified',
            `
            <h2>New Viewing Request Assigned</h2>
            <p>Dear ${agent.first_name},</p>
            <p>You have been assigned a new viewing request:</p>
            <ul>
                <li><strong>Property:</strong> ${appointment.property_title}</li>
                <li><strong>Address:</strong> ${appointment.property_address}</li>
                <li><strong>Customer:</strong> ${appointment.customer_name}</li>
                <li><strong>Phone:</strong> ${appointment.customer_phone}</li>
                <li><strong>Email:</strong> ${appointment.customer_email}</li>
            </ul>
            <p>Please contact the customer within 24 hours to schedule a viewing.</p>
            <br>
            <p>Best regards,<br>Real Estate Simplified</p>
            `
        );

        res.json({
            success: true,
            message: 'Agent assigned successfully'
        });
    } catch (error) {
        console.error('Assign agent error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign agent'
        });
    }
});

/**
 * PUT /api/appointments/:id/schedule
 * Agent - Set schedule after calling customer
 */
router.put('/:id/schedule', authenticateToken, isAgentOrAdmin, [
    body('scheduledDate').isISO8601(),
    body('scheduledTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
    body('agentNotes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { scheduledDate, scheduledTime, agentNotes } = req.body;

        // Verify appointment exists and is assigned to this agent
        const [appointments] = await pool.query(
            `SELECT a.*, p.title as property_title
             FROM appointments a
             JOIN properties p ON p.id = a.property_id
             WHERE a.id = ? AND a.assigned_agent_id = ?`,
            [id, req.user.id]
        );

        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not assigned to you'
            });
        }

        const appointment = appointments[0];

        // Check for double-booking conflicts (same property, date, and time)
        const [conflicts] = await pool.query(
            `SELECT id FROM appointments 
             WHERE property_id = ? 
             AND scheduled_date = ? 
             AND scheduled_time = ?
             AND id != ?
             AND status != 'cancelled'`,
            [appointment.property_id, scheduledDate, scheduledTime, id]
        );

        if (conflicts.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked for this property. Please choose a different time.'
            });
        }

        // Update appointment
        await pool.query(
            `UPDATE appointments SET 
             scheduled_date = ?,
             scheduled_time = ?,
             agent_notes = ?,
             status = 'scheduled'
             WHERE id = ?`,
            [scheduledDate, scheduledTime, agentNotes || null, id]
        );

        // Send confirmation email to customer
        await sendNotificationEmail(
            appointment.customer_email,
            'Viewing Scheduled - Real Estate Simplified',
            `
            <h2>Your Viewing is Scheduled!</h2>
            <p>Dear ${appointment.customer_name},</p>
            <p>Your viewing for <strong>${appointment.property_title}</strong> has been scheduled:</p>
            <ul>
                <li><strong>Date:</strong> ${scheduledDate}</li>
                <li><strong>Time:</strong> ${scheduledTime}</li>
            </ul>
            <p>Please arrive 5 minutes early. If you need to reschedule, please contact us.</p>
            <br>
            <p>Best regards,<br>Real Estate Simplified Team</p>
            `
        );

        res.json({
            success: true,
            message: 'Viewing scheduled successfully'
        });
    } catch (error) {
        console.error('Schedule error:', error);
        // Handle unique constraint violation
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked for this property. Please choose a different time.'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to schedule viewing'
        });
    }
});

/**
 * PUT /api/appointments/:id/complete
 * Agent - Mark viewing as completed
 */
router.put('/:id/complete', authenticateToken, isAgentOrAdmin, [
    body('outcome').isIn(['interested', 'offer_made', 'not_interested', 'no_show', 'needs_followup']),
    body('outcomeNotes').optional().trim(),
    body('agentNotes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { outcome, outcomeNotes, agentNotes } = req.body;

        // Verify appointment exists and is assigned to this agent
        const [appointments] = await pool.query(
            'SELECT * FROM appointments WHERE id = ? AND assigned_agent_id = ?',
            [id, req.user.id]
        );

        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or not assigned to you'
            });
        }

        // Update appointment
        await pool.query(
            `UPDATE appointments SET 
             status = 'completed',
             outcome = ?,
             outcome_notes = ?,
             agent_notes = COALESCE(?, agent_notes),
             completed_at = NOW()
             WHERE id = ?`,
            [outcome, outcomeNotes || null, agentNotes, id]
        );

        res.json({
            success: true,
            message: 'Viewing marked as completed'
        });
    } catch (error) {
        console.error('Complete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete viewing'
        });
    }
});

/**
 * PUT /api/appointments/:id/cancel
 * Admin/Agent - Cancel appointment
 */
router.put('/:id/cancel', authenticateToken, isAgentOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // For agents, verify they are assigned
        let query = 'SELECT * FROM appointments WHERE id = ?';
        const params = [id];

        if (req.user.role === 'agent') {
            query += ' AND assigned_agent_id = ?';
            params.push(req.user.id);
        }

        const [appointments] = await pool.query(query, params);

        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Update appointment
        await pool.query(
            `UPDATE appointments SET 
             status = 'cancelled',
             agent_notes = CONCAT(COALESCE(agent_notes, ''), '\nCancelled: ', ?)
             WHERE id = ?`,
            [reason || 'No reason provided', id]
        );

        res.json({
            success: true,
            message: 'Appointment cancelled'
        });
    } catch (error) {
        console.error('Cancel error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel appointment'
        });
    }
});

/**
 * GET /api/appointments/stats
 * Admin - Get appointment statistics
 */
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM appointments
        `);

        const [outcomes] = await pool.query(`
            SELECT outcome, COUNT(*) as count
            FROM appointments
            WHERE status = 'completed' AND outcome IS NOT NULL
            GROUP BY outcome
        `);

        res.json({
            success: true,
            stats: {
                total: stats[0].total,
                pending: stats[0].pending,
                assigned: stats[0].assigned,
                scheduled: stats[0].scheduled,
                completed: stats[0].completed,
                cancelled: stats[0].cancelled
            },
            outcomes: outcomes.reduce((acc, o) => {
                acc[o.outcome] = o.count;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

/**
 * GET /api/appointments/calendar
 * Admin/Agent - Get all scheduled appointments for shared calendar view
 * Shows ALL appointments from ALL agents to prevent double-booking
 */
router.get('/calendar', authenticateToken, isAgentOrAdmin, async (req, res) => {
    try {
        const { startDate, endDate, month, year } = req.query;

        let whereClause = "WHERE a.scheduled_date IS NOT NULL AND a.status IN ('scheduled', 'completed')";
        const params = [];

        // Filter by date range
        if (startDate && endDate) {
            whereClause += ' AND a.scheduled_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        } else if (month && year) {
            // Filter by month/year
            whereClause += ' AND MONTH(a.scheduled_date) = ? AND YEAR(a.scheduled_date) = ?';
            params.push(parseInt(month), parseInt(year));
        }

        const [appointments] = await pool.query(
            `SELECT a.id, a.property_id, a.scheduled_date, a.scheduled_time, a.status,
                    a.customer_name, a.assigned_agent_id,
                    p.title as property_title, p.address as property_address, p.city as property_city,
                    CONCAT(u.first_name, ' ', u.last_name) as agent_name
             FROM appointments a
             JOIN properties p ON p.id = a.property_id
             LEFT JOIN users u ON u.id = a.assigned_agent_id
             ${whereClause}
             ORDER BY a.scheduled_date ASC, a.scheduled_time ASC`,
            params
        );

        res.json({
            success: true,
            appointments: appointments.map(a => ({
                id: a.id,
                propertyId: a.property_id,
                propertyTitle: a.property_title,
                propertyAddress: a.property_address,
                propertyCity: a.property_city,
                customerName: a.customer_name,
                scheduledDate: a.scheduled_date,
                scheduledTime: a.scheduled_time,
                status: a.status,
                assignedAgentId: a.assigned_agent_id,
                agentName: a.agent_name
            }))
        });
    } catch (error) {
        console.error('Get calendar error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar'
        });
    }
});

module.exports = router;
