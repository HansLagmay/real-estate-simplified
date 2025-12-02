/**
 * Properties Routes
 * Property CRUD, sales, and commission tracking
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, isAdmin, isAgentOrAdmin } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

/**
 * GET /api/properties
 * Public - Get all available properties
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            type,
            city,
            minPrice,
            maxPrice,
            bedrooms,
            status = 'available',
            featured,
            search
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND p.status = ?';
            params.push(status);
        }

        if (type) {
            whereClause += ' AND p.property_type = ?';
            params.push(type);
        }

        if (city) {
            whereClause += ' AND p.city LIKE ?';
            params.push(`%${city}%`);
        }

        if (minPrice) {
            whereClause += ' AND p.price >= ?';
            params.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            whereClause += ' AND p.price <= ?';
            params.push(parseFloat(maxPrice));
        }

        if (bedrooms) {
            whereClause += ' AND p.bedrooms >= ?';
            params.push(parseInt(bedrooms));
        }

        if (featured === 'true') {
            whereClause += ' AND p.is_featured = TRUE';
        }

        if (search) {
            whereClause += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM properties p ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        // Get properties with primary photo
        const [properties] = await pool.query(
            `SELECT p.*, 
                    pp.filename as primary_photo,
                    CONCAT(u.first_name, ' ', u.last_name) as listed_by_name
             FROM properties p
             LEFT JOIN property_photos pp ON pp.property_id = p.id AND pp.is_primary = TRUE
             LEFT JOIN users u ON u.id = p.listed_by_agent_id
             ${whereClause}
             ORDER BY p.is_featured DESC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({
            success: true,
            properties: properties.map(p => ({
                id: p.id,
                title: p.title,
                description: p.description,
                propertyType: p.property_type,
                address: p.address,
                city: p.city,
                province: p.province,
                zipCode: p.zip_code,
                price: parseFloat(p.price),
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                floorArea: p.floor_area ? parseFloat(p.floor_area) : null,
                lotArea: p.lot_area ? parseFloat(p.lot_area) : null,
                yearBuilt: p.year_built,
                features: p.features,
                status: p.status,
                isFeatured: p.is_featured,
                primaryPhoto: p.primary_photo,
                listedByName: p.listed_by_name,
                createdAt: p.created_at
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch properties'
        });
    }
});

/**
 * GET /api/properties/:id
 * Public - Get single property with all photos
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [properties] = await pool.query(
            `SELECT p.*, 
                    CONCAT(u.first_name, ' ', u.last_name) as listed_by_name,
                    u.email as listed_by_email,
                    u.phone as listed_by_phone
             FROM properties p
             LEFT JOIN users u ON u.id = p.listed_by_agent_id
             WHERE p.id = ?`,
            [id]
        );

        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        const property = properties[0];

        // Get all photos
        const [photos] = await pool.query(
            `SELECT id, filename, original_name, is_primary, sort_order 
             FROM property_photos WHERE property_id = ? ORDER BY sort_order`,
            [id]
        );

        res.json({
            success: true,
            property: {
                id: property.id,
                title: property.title,
                description: property.description,
                propertyType: property.property_type,
                address: property.address,
                city: property.city,
                province: property.province,
                zipCode: property.zip_code,
                price: parseFloat(property.price),
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                floorArea: property.floor_area ? parseFloat(property.floor_area) : null,
                lotArea: property.lot_area ? parseFloat(property.lot_area) : null,
                yearBuilt: property.year_built,
                features: property.features,
                status: property.status,
                isFeatured: property.is_featured,
                listedByName: property.listed_by_name,
                listedByEmail: property.listed_by_email,
                listedByPhone: property.listed_by_phone,
                photos: photos.map(p => ({
                    id: p.id,
                    filename: p.filename,
                    originalName: p.original_name,
                    isPrimary: p.is_primary
                })),
                createdAt: property.created_at
            }
        });
    } catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch property'
        });
    }
});

/**
 * POST /api/properties
 * Admin/Agent - Create new property
 */
router.post('/', authenticateToken, isAgentOrAdmin, [
    body('title').trim().notEmpty(),
    body('propertyType').isIn(['house', 'condo', 'townhouse', 'lot', 'commercial']),
    body('address').trim().notEmpty(),
    body('city').trim().notEmpty(),
    body('price').isFloat({ min: 0 })
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

        const {
            title, description, propertyType, address, city, province, zipCode,
            price, bedrooms, bathrooms, floorArea, lotArea, yearBuilt, features, isFeatured
        } = req.body;

        const [result] = await pool.query(
            `INSERT INTO properties 
             (title, description, property_type, address, city, province, zip_code, 
              price, bedrooms, bathrooms, floor_area, lot_area, year_built, features, 
              listed_by_agent_id, is_featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title, description, propertyType, address, city, province || null, zipCode || null,
                price, bedrooms || null, bathrooms || null, floorArea || null, lotArea || null,
                yearBuilt || null, features ? JSON.stringify(features) : null,
                req.user.id, isFeatured || false
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Property created successfully',
            propertyId: result.insertId
        });
    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create property'
        });
    }
});

/**
 * PUT /api/properties/:id
 * Admin/Agent - Update property
 */
router.put('/:id', authenticateToken, isAgentOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, propertyType, address, city, province, zipCode,
            price, bedrooms, bathrooms, floorArea, lotArea, yearBuilt, features, isFeatured, status
        } = req.body;

        // Verify property exists
        const [existing] = await pool.query('SELECT id FROM properties WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        const updates = [];
        const values = [];

        const fieldMappings = {
            title: 'title',
            description: 'description',
            propertyType: 'property_type',
            address: 'address',
            city: 'city',
            province: 'province',
            zipCode: 'zip_code',
            price: 'price',
            bedrooms: 'bedrooms',
            bathrooms: 'bathrooms',
            floorArea: 'floor_area',
            lotArea: 'lot_area',
            yearBuilt: 'year_built',
            isFeatured: 'is_featured',
            status: 'status'
        };

        for (const [key, column] of Object.entries(fieldMappings)) {
            if (req.body[key] !== undefined) {
                updates.push(`${column} = ?`);
                values.push(req.body[key]);
            }
        }

        if (features !== undefined) {
            updates.push('features = ?');
            values.push(JSON.stringify(features));
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        values.push(id);
        await pool.query(
            `UPDATE properties SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Property updated successfully'
        });
    } catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update property'
        });
    }
});

/**
 * DELETE /api/properties/:id
 * Admin only - Delete property
 */
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get photos to delete files
        const [photos] = await pool.query(
            'SELECT filename FROM property_photos WHERE property_id = ?',
            [id]
        );

        // Delete property (cascades to photos table)
        const [result] = await pool.query('DELETE FROM properties WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        // Delete photo files
        for (const photo of photos) {
            const filePath = path.join(__dirname, '../uploads', photo.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.json({
            success: true,
            message: 'Property deleted successfully'
        });
    } catch (error) {
        console.error('Delete property error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete property'
        });
    }
});

/**
 * POST /api/properties/:id/photos
 * Admin/Agent - Upload photos
 */
router.post('/:id/photos', authenticateToken, isAgentOrAdmin, upload.array('photos', 10), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify property exists
        const [existing] = await pool.query('SELECT id FROM properties WHERE id = ?', [id]);
        if (existing.length === 0) {
            // Clean up uploaded files
            for (const file of req.files) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        // Check if this is the first photo (make it primary)
        const [existingPhotos] = await pool.query(
            'SELECT COUNT(*) as count FROM property_photos WHERE property_id = ?',
            [id]
        );
        const isFirst = existingPhotos[0].count === 0;

        // Insert photo records
        const photoIds = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const isPrimary = isFirst && i === 0;
            const [result] = await pool.query(
                `INSERT INTO property_photos (property_id, filename, original_name, is_primary, sort_order)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, file.filename, file.originalname, isPrimary, existingPhotos[0].count + i]
            );
            photoIds.push(result.insertId);
        }

        res.status(201).json({
            success: true,
            message: 'Photos uploaded successfully',
            photoIds
        });
    } catch (error) {
        console.error('Upload photos error:', error);
        // Clean up uploaded files on error
        if (req.files) {
            for (const file of req.files) {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
        }
        res.status(500).json({
            success: false,
            message: 'Failed to upload photos'
        });
    }
});

/**
 * DELETE /api/properties/:id/photos/:photoId
 * Admin/Agent - Delete photo
 */
router.delete('/:id/photos/:photoId', authenticateToken, isAgentOrAdmin, async (req, res) => {
    try {
        const { id, photoId } = req.params;

        // Get photo info
        const [photos] = await pool.query(
            'SELECT filename, is_primary FROM property_photos WHERE id = ? AND property_id = ?',
            [photoId, id]
        );

        if (photos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Photo not found'
            });
        }

        const photo = photos[0];

        // Delete from database
        await pool.query('DELETE FROM property_photos WHERE id = ?', [photoId]);

        // If deleted photo was primary, make another one primary
        if (photo.is_primary) {
            await pool.query(
                `UPDATE property_photos SET is_primary = TRUE 
                 WHERE property_id = ? ORDER BY sort_order LIMIT 1`,
                [id]
            );
        }

        // Delete file
        const filePath = path.join(__dirname, '../uploads', photo.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({
            success: true,
            message: 'Photo deleted successfully'
        });
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete photo'
        });
    }
});

/**
 * PUT /api/properties/:id/mark-sold
 * Agent - Mark property as sold
 */
router.put('/:id/mark-sold', authenticateToken, isAgentOrAdmin, [
    body('salePrice').isFloat({ min: 0 }),
    body('soldDate').optional().isISO8601(),
    body('buyerName').optional().trim().isLength({ max: 200 })
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
        const { salePrice, soldDate, buyerName } = req.body;

        // Format the sold date properly
        const formatDate = (dateStr) => {
            if (!dateStr) {
                return new Date().toISOString().slice(0, 10);
            }
            // Validate it's a proper date string
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return new Date().toISOString().slice(0, 10);
            }
            return date.toISOString().slice(0, 10);
        };

        const formattedSoldDate = formatDate(soldDate);

        // Verify property exists and is available
        const [existing] = await pool.query(
            'SELECT status FROM properties WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        if (existing[0].status === 'sold') {
            return res.status(400).json({
                success: false,
                message: 'Property is already sold'
            });
        }

        await pool.query(
            `UPDATE properties SET 
             status = 'sold',
             sold_by_agent_id = ?,
             sold_date = ?,
             sale_price = ?,
             buyer_name = ?
             WHERE id = ?`,
            [req.user.id, formattedSoldDate, salePrice, buyerName || null, id]
        );

        res.json({
            success: true,
            message: 'Property marked as sold'
        });
    } catch (error) {
        console.error('Mark sold error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark property as sold'
        });
    }
});

/**
 * GET /api/properties/sold/all
 * Admin - Get all sold properties (sales report)
 */
router.get('/sold/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, agentId } = req.query;

        let whereClause = "WHERE p.status = 'sold'";
        const params = [];

        if (startDate) {
            whereClause += ' AND p.sold_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND p.sold_date <= ?';
            params.push(endDate);
        }

        if (agentId) {
            whereClause += ' AND p.sold_by_agent_id = ?';
            params.push(agentId);
        }

        const [sales] = await pool.query(
            `SELECT p.id, p.title, p.city, p.sale_price, p.sold_date, p.buyer_name,
                    u.id as agent_id, CONCAT(u.first_name, ' ', u.last_name) as agent_name,
                    u.commission_rate,
                    (p.sale_price * u.commission_rate) as commission
             FROM properties p
             JOIN users u ON p.sold_by_agent_id = u.id
             ${whereClause}
             ORDER BY p.sold_date DESC`,
            params
        );

        // Calculate totals
        const totalSales = sales.length;
        const totalValue = sales.reduce((sum, s) => sum + parseFloat(s.sale_price), 0);
        const totalCommission = sales.reduce((sum, s) => sum + parseFloat(s.commission), 0);

        res.json({
            success: true,
            sales: sales.map(s => ({
                id: s.id,
                title: s.title,
                city: s.city,
                salePrice: parseFloat(s.sale_price),
                soldDate: s.sold_date,
                buyerName: s.buyer_name,
                agentId: s.agent_id,
                agentName: s.agent_name,
                commissionRate: parseFloat(s.commission_rate),
                commission: parseFloat(s.commission)
            })),
            summary: {
                totalSales,
                totalValue,
                totalCommission
            }
        });
    } catch (error) {
        console.error('Get sales report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales report'
        });
    }
});

/**
 * GET /api/properties/my-sales
 * Agent - Get my sales with commission
 */
router.get('/my-sales', authenticateToken, isAgentOrAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let whereClause = "WHERE p.status = 'sold' AND p.sold_by_agent_id = ?";
        const params = [req.user.id];

        if (startDate) {
            whereClause += ' AND p.sold_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND p.sold_date <= ?';
            params.push(endDate);
        }

        // Get agent commission rate
        const [agent] = await pool.query(
            'SELECT commission_rate FROM users WHERE id = ?',
            [req.user.id]
        );
        const commissionRate = agent.length > 0 ? parseFloat(agent[0].commission_rate) : 0.03;

        const [sales] = await pool.query(
            `SELECT p.id, p.title, p.city, p.sale_price, p.sold_date, p.price as original_price, p.buyer_name
             FROM properties p
             ${whereClause}
             ORDER BY p.sold_date DESC`,
            params
        );

        // Calculate totals
        const totalSales = sales.length;
        const totalValue = sales.reduce((sum, s) => sum + parseFloat(s.sale_price), 0);
        const totalCommission = totalValue * commissionRate;

        res.json({
            success: true,
            commissionRate,
            sales: sales.map(s => ({
                id: s.id,
                title: s.title,
                city: s.city,
                originalPrice: parseFloat(s.original_price),
                salePrice: parseFloat(s.sale_price),
                soldDate: s.sold_date,
                buyerName: s.buyer_name,
                commission: parseFloat(s.sale_price) * commissionRate
            })),
            summary: {
                totalSales,
                totalValue,
                totalCommission
            }
        });
    } catch (error) {
        console.error('Get my sales error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales'
        });
    }
});

/**
 * GET /api/properties/sold/export
 * Admin - Export sales to CSV
 */
router.get('/sold/export', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, agentId } = req.query;

        let whereClause = "WHERE p.status = 'sold'";
        const params = [];

        if (startDate) {
            whereClause += ' AND p.sold_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND p.sold_date <= ?';
            params.push(endDate);
        }

        if (agentId) {
            whereClause += ' AND p.sold_by_agent_id = ?';
            params.push(agentId);
        }

        const [sales] = await pool.query(
            `SELECT p.id, p.title, p.address, p.city, p.property_type,
                    p.price as listing_price, p.sale_price, p.sold_date, p.buyer_name,
                    u.id as agent_id, CONCAT(u.first_name, ' ', u.last_name) as agent_name,
                    u.email as agent_email, u.commission_rate,
                    (p.sale_price * u.commission_rate) as commission
             FROM properties p
             JOIN users u ON p.sold_by_agent_id = u.id
             ${whereClause}
             ORDER BY p.sold_date DESC`,
            params
        );

        // Generate CSV
        const headers = ['Property ID', 'Title', 'Address', 'City', 'Type', 'Listing Price', 'Sale Price', 'Sale Date', 'Buyer Name', 'Agent ID', 'Agent Name', 'Agent Email', 'Commission Rate', 'Commission'];
        const rows = sales.map(s => [
            s.id,
            `"${s.title}"`,
            `"${s.address}"`,
            `"${s.city}"`,
            s.property_type,
            s.listing_price,
            s.sale_price,
            s.sold_date,
            `"${s.buyer_name || ''}"`,
            s.agent_id,
            `"${s.agent_name}"`,
            s.agent_email,
            s.commission_rate,
            s.commission
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export sales error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export sales'
        });
    }
});

module.exports = router;
