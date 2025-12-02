-- Real Estate Simplified Database Schema
-- Compatible with MySQL 5.7+

-- Drop tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS property_photos;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS users;

-- Users table (agents and admins only - customers don't have accounts)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('agent', 'admin') NOT NULL DEFAULT 'agent',
    commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0300,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Properties table
CREATE TABLE properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    property_type ENUM('house', 'condo', 'townhouse', 'lot', 'commercial') NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100),
    zip_code VARCHAR(20),
    price DECIMAL(15, 2) NOT NULL,
    bedrooms INT,
    bathrooms INT,
    floor_area DECIMAL(10, 2),
    lot_area DECIMAL(10, 2),
    year_built INT,
    features JSON,
    status ENUM('available', 'reserved', 'sold') NOT NULL DEFAULT 'available',
    listed_by_agent_id INT,
    sold_by_agent_id INT,
    sold_date DATE,
    sale_price DECIMAL(15, 2),
    buyer_name VARCHAR(200),
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (listed_by_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (sold_by_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_city (city),
    INDEX idx_property_type (property_type),
    INDEX idx_price (price),
    INDEX idx_sold_by_agent (sold_by_agent_id)
);

-- Property Photos table
CREATE TABLE property_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_property_id (property_id)
);

-- Appointments table (customer viewing requests)
CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    
    -- Customer information (no account required)
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_intent ENUM('buy', 'rent', 'invest', 'inquire') NOT NULL DEFAULT 'inquire',
    customer_message TEXT,
    
    -- Priority queue (auto-assigned)
    priority_number INT,
    
    -- Assignment and scheduling
    assigned_agent_id INT,
    assigned_at TIMESTAMP NULL,
    
    -- Schedule (agent fills after calling customer)
    scheduled_date DATE,
    scheduled_time TIME,
    
    -- Status tracking
    status ENUM('pending', 'assigned', 'scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    outcome ENUM('interested', 'offer_made', 'not_interested', 'no_show') NULL,
    outcome_notes TEXT,
    agent_notes TEXT,
    admin_notes TEXT,
    completed_at DATETIME NULL,
    
    -- Spam prevention
    recaptcha_score DECIMAL(3, 2),
    ip_address VARCHAR(45),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_assigned_agent (assigned_agent_id),
    INDEX idx_property_id (property_id),
    INDEX idx_priority (priority_number),
    INDEX idx_scheduled (scheduled_date, scheduled_time),
    -- UNIQUE constraint to prevent double-booking
    -- Note: MySQL allows multiple NULL values in unique constraints, so pending 
    -- appointments (with NULL scheduled_date/time) won't conflict with each other
    UNIQUE KEY unique_property_schedule (property_id, scheduled_date, scheduled_time)
);

-- Trigger to auto-assign priority number
DELIMITER //
CREATE TRIGGER before_appointment_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    DECLARE max_priority INT;
    SELECT COALESCE(MAX(priority_number), 0) + 1 INTO max_priority 
    FROM appointments 
    WHERE property_id = NEW.property_id;
    SET NEW.priority_number = max_priority;
END//
DELIMITER ;

-- Trigger to recalculate priorities when appointment is cancelled
DELIMITER //
CREATE TRIGGER after_appointment_cancel
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
    -- When an appointment is cancelled, recalculate priorities for remaining appointments
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        -- Update priority numbers for appointments with higher priority
        UPDATE appointments 
        SET priority_number = priority_number - 1 
        WHERE property_id = NEW.property_id 
        AND priority_number > NEW.priority_number
        AND status != 'cancelled';
    END IF;
END//
DELIMITER ;

-- Commission calculation view
CREATE VIEW agent_commissions AS
SELECT 
    u.id AS agent_id,
    u.first_name,
    u.last_name,
    u.email,
    u.commission_rate,
    COUNT(p.id) AS total_sales,
    COALESCE(SUM(p.sale_price), 0) AS total_sales_value,
    COALESCE(SUM(p.sale_price * u.commission_rate), 0) AS total_commission
FROM users u
LEFT JOIN properties p ON p.sold_by_agent_id = u.id AND p.status = 'sold'
WHERE u.role = 'agent'
GROUP BY u.id, u.first_name, u.last_name, u.email, u.commission_rate;

-- Monthly sales report view
CREATE VIEW monthly_sales_report AS
SELECT 
    YEAR(p.sold_date) AS sale_year,
    MONTH(p.sold_date) AS sale_month,
    u.id AS agent_id,
    CONCAT(u.first_name, ' ', u.last_name) AS agent_name,
    COUNT(p.id) AS properties_sold,
    SUM(p.sale_price) AS total_sales,
    SUM(p.sale_price * u.commission_rate) AS total_commission
FROM properties p
JOIN users u ON p.sold_by_agent_id = u.id
WHERE p.status = 'sold' AND p.sold_date IS NOT NULL
GROUP BY YEAR(p.sold_date), MONTH(p.sold_date), u.id, u.first_name, u.last_name
ORDER BY sale_year DESC, sale_month DESC, total_sales DESC;
