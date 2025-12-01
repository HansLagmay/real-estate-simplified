/**
 * Users Routes
 * Agent management (admin only)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/**
 * GET /api/users
 * Admin - Get all users
 */
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { role, active } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (role) {
            whereClause += ' AND role = ?';
            params.push(role);
        }

        if (active !== undefined) {
            whereClause += ' AND is_active = ?';
            params.push(active === 'true');
        }

        const [users] = await pool.query(
            `SELECT id, email, first_name, last_name, phone, role, commission_rate, is_active, created_at
             FROM users ${whereClause}
             ORDER BY role, first_name`,
            params
        );

        res.json({
            success: true,
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                firstName: u.first_name,
                lastName: u.last_name,
                phone: u.phone,
                role: u.role,
                commissionRate: parseFloat(u.commission_rate),
                isActive: u.is_active,
                createdAt: u.created_at
            }))
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

/**
 * GET /api/users/agents
 * Admin - Get all agents (for assignment dropdown)
 */
router.get('/agents', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [agents] = await pool.query(
            `SELECT id, email, first_name, last_name, phone, commission_rate
             FROM users 
             WHERE role = 'agent' AND is_active = TRUE
             ORDER BY first_name`
        );

        res.json({
            success: true,
            agents: agents.map(a => ({
                id: a.id,
                email: a.email,
                firstName: a.first_name,
                lastName: a.last_name,
                fullName: `${a.first_name} ${a.last_name}`,
                phone: a.phone,
                commissionRate: parseFloat(a.commission_rate)
            }))
        });
    } catch (error) {
        console.error('Get agents error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agents'
        });
    }
});

/**
 * GET /api/users/:id
 * Admin - Get single user
 */
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.query(
            `SELECT id, email, first_name, last_name, phone, role, commission_rate, is_active, created_at
             FROM users WHERE id = ?`,
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Get agent stats if user is an agent
        let stats = null;
        if (user.role === 'agent') {
            const [salesStats] = await pool.query(
                `SELECT 
                    COUNT(*) as total_sales,
                    COALESCE(SUM(sale_price), 0) as total_value,
                    COALESCE(SUM(sale_price * ?), 0) as total_commission
                 FROM properties 
                 WHERE sold_by_agent_id = ? AND status = 'sold'`,
                [user.commission_rate, id]
            );

            const [appointmentStats] = await pool.query(
                `SELECT 
                    COUNT(*) as total_appointments,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN outcome = 'offer_made' THEN 1 ELSE 0 END) as offers_made
                 FROM appointments WHERE assigned_agent_id = ?`,
                [id]
            );

            stats = {
                totalSales: salesStats[0].total_sales,
                totalValue: parseFloat(salesStats[0].total_value),
                totalCommission: parseFloat(salesStats[0].total_commission),
                totalAppointments: appointmentStats[0].total_appointments,
                completedAppointments: appointmentStats[0].completed,
                offersMade: appointmentStats[0].offers_made
            };
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                role: user.role,
                commissionRate: parseFloat(user.commission_rate),
                isActive: user.is_active,
                createdAt: user.created_at,
                stats
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

/**
 * PUT /api/users/:id
 * Admin - Update user
 */
router.put('/:id', authenticateToken, isAdmin, [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('role').optional().isIn(['agent', 'admin']),
    body('commissionRate').optional().isFloat({ min: 0, max: 1 }),
    body('isActive').optional().isBoolean()
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
        const { firstName, lastName, email, phone, role, commissionRate, isActive } = req.body;

        // Verify user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check email uniqueness if changing email
        if (email) {
            const [emailCheck] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );
            if (emailCheck.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
        }

        const updates = [];
        const values = [];

        const fieldMappings = {
            firstName: 'first_name',
            lastName: 'last_name',
            email: 'email',
            phone: 'phone',
            role: 'role',
            commissionRate: 'commission_rate',
            isActive: 'is_active'
        };

        for (const [key, column] of Object.entries(fieldMappings)) {
            if (req.body[key] !== undefined) {
                updates.push(`${column} = ?`);
                values.push(req.body[key]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        values.push(id);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

/**
 * PUT /api/users/:id/password
 * Admin - Reset user password
 */
router.put('/:id/password', authenticateToken, isAdmin, [
    body('newPassword').isLength({ min: 6 })
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
        const { newPassword } = req.body;

        // Verify user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, id]
        );

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

/**
 * DELETE /api/users/:id
 * Admin - Deactivate user (soft delete)
 */
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Don't allow deleting yourself
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        // Verify user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Soft delete (deactivate)
        await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate user'
        });
    }
});

/**
 * GET /api/users/reports/performance
 * Admin - Get agent performance report
 */
router.get('/reports/performance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = '';
        const params = [];

        if (startDate && endDate) {
            dateFilter = 'AND p.sold_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        const [performance] = await pool.query(
            `SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.commission_rate,
                COUNT(DISTINCT p.id) as properties_sold,
                COALESCE(SUM(p.sale_price), 0) as total_sales,
                COALESCE(SUM(p.sale_price * u.commission_rate), 0) as total_commission,
                (SELECT COUNT(*) FROM appointments WHERE assigned_agent_id = u.id) as total_appointments,
                (SELECT COUNT(*) FROM appointments WHERE assigned_agent_id = u.id AND status = 'completed') as completed_appointments
             FROM users u
             LEFT JOIN properties p ON p.sold_by_agent_id = u.id AND p.status = 'sold' ${dateFilter}
             WHERE u.role = 'agent' AND u.is_active = TRUE
             GROUP BY u.id, u.first_name, u.last_name, u.email, u.commission_rate
             ORDER BY total_sales DESC`,
            params
        );

        res.json({
            success: true,
            performance: performance.map(p => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                fullName: `${p.first_name} ${p.last_name}`,
                email: p.email,
                commissionRate: parseFloat(p.commission_rate),
                propertiesSold: p.properties_sold,
                totalSales: parseFloat(p.total_sales),
                totalCommission: parseFloat(p.total_commission),
                totalAppointments: p.total_appointments,
                completedAppointments: p.completed_appointments
            }))
        });
    } catch (error) {
        console.error('Get performance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch performance report'
        });
    }
});

module.exports = router;
