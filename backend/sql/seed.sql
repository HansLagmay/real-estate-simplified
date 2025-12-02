-- Real Estate Simplified - Sample Seed Data
-- Run after schema.sql

-- Insert admin user (password: admin123)
-- Note: Password hash is for 'admin123' - generated with bcrypt
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
('admin@company.com', '$2a$10$rZ5xGV5VQgTPV3YO0VaKr.F6xHJYDl5LrXmSFN0jBKnGXTmwLYZHa', 'System', 'Admin', '+63-917-123-4567', 'admin');

-- Insert agent users (password: agent123)
-- Note: Password hash is for 'agent123' - generated with bcrypt
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, commission_rate) VALUES
('agent1@company.com', '$2a$10$rQMHPBWOBbLxWRYdGvzDu.YjV7xNMBWVGtGS.PJ2TUH7lPFGQ0X0K', 'Maria', 'Santos', '+63-917-234-5678', 'agent', 0.0300),
('agent2@company.com', '$2a$10$rQMHPBWOBbLxWRYdGvzDu.YjV7xNMBWVGtGS.PJ2TUH7lPFGQ0X0K', 'Juan', 'Dela Cruz', '+63-918-345-6789', 'agent', 0.0300),
('agent3@company.com', '$2a$10$rQMHPBWOBbLxWRYdGvzDu.YjV7xNMBWVGtGS.PJ2TUH7lPFGQ0X0K', 'Ana', 'Reyes', '+63-919-456-7890', 'agent', 0.0350);

-- Insert sample properties
INSERT INTO properties (title, description, property_type, address, city, province, zip_code, price, bedrooms, bathrooms, floor_area, lot_area, year_built, features, status, listed_by_agent_id, is_featured) VALUES
('Modern 3-Bedroom House in Makati', 'Beautiful modern house with spacious living areas, updated kitchen, and private garden. Located in a prestigious village with 24/7 security.', 'house', '123 Palm Village', 'Makati City', 'Metro Manila', '1230', 12500000.00, 3, 2, 180.00, 250.00, 2020, '["Swimming Pool", "Garage", "Garden", "Security"]', 'available', 2, TRUE),

('Luxury Condo in BGC', 'High-end condo unit with stunning city views. Fully furnished with premium appliances and fixtures. Walking distance to malls and offices.', 'condo', 'One Serendra, 11th Ave', 'Taguig City', 'Metro Manila', '1634', 18000000.00, 2, 2, 95.00, NULL, 2018, '["Gym", "Pool", "Concierge", "Parking"]', 'available', 3, TRUE),

('Cozy Townhouse in Quezon City', 'Affordable townhouse perfect for young families. Near schools, churches, and public transport. Move-in ready condition.', 'townhouse', '45 Scout Tuazon', 'Quezon City', 'Metro Manila', '1103', 5500000.00, 2, 1, 85.00, 60.00, 2015, '["Garage", "Near Schools"]', 'available', 2, FALSE),

('Commercial Lot in Pasig', 'Prime commercial lot along major road. High traffic area ideal for retail or mixed-use development. Clean title.', 'lot', 'Ortigas Avenue Extension', 'Pasig City', 'Metro Manila', '1600', 25000000.00, NULL, NULL, NULL, 500.00, NULL, '["Corner Lot", "Road Frontage"]', 'available', 4, FALSE),

('Executive House in Alabang', 'Stunning 4-bedroom executive home with modern design. Features home office, entertainment room, and landscaped gardens.', 'house', '78 Ayala Alabang Village', 'Muntinlupa City', 'Metro Manila', '1780', 35000000.00, 4, 4, 350.00, 400.00, 2022, '["Smart Home", "Pool", "Garden", "Office"]', 'available', 3, TRUE),

('Studio Condo near UST', 'Ideal for students or young professionals. Fully furnished studio unit near universities and commercial areas.', 'condo', 'España Boulevard', 'Manila', 'Metro Manila', '1008', 2800000.00, 1, 1, 28.00, NULL, 2019, '["Furnished", "Near Universities"]', 'available', 2, FALSE);

-- Insert sold properties for commission tracking
INSERT INTO properties (title, description, property_type, address, city, province, zip_code, price, bedrooms, bathrooms, floor_area, lot_area, year_built, features, status, listed_by_agent_id, sold_by_agent_id, sold_date, sale_price, is_featured) VALUES
('Charming 2BR in San Juan', 'Renovated 2-bedroom home with modern amenities in quiet neighborhood.', 'house', '234 N. Domingo St', 'San Juan City', 'Metro Manila', '1500', 8500000.00, 2, 2, 120.00, 150.00, 2010, '["Renovated", "Garden"]', 'sold', 2, 2, '2025-12-15', 8500000.00, FALSE),

('Premium Condo in Rockwell', 'High-end 3-bedroom unit with premium finishes and Makati skyline views.', 'condo', 'The Proscenium, Rockwell', 'Makati City', 'Metro Manila', '1210', 12000000.00, 3, 2, 150.00, NULL, 2021, '["Luxury", "Views", "Parking"]', 'sold', 3, 3, '2025-12-10', 12000000.00, FALSE),

('Family Home in Antipolo', 'Spacious family home with mountain views and cool climate. Great for weekend getaways.', 'house', '567 Sumulong Highway', 'Antipolo City', 'Rizal', '1870', 6500000.00, 3, 2, 200.00, 350.00, 2008, '["Mountain View", "Garden", "Cool Climate"]', 'sold', 4, 4, '2025-11-28', 6800000.00, FALSE);

-- Insert sample appointments
INSERT INTO appointments (property_id, customer_name, customer_email, customer_phone, customer_message, status, assigned_agent_id, assigned_at) VALUES
(1, 'Robert Garcia', 'robert.garcia@email.com', '+63-920-111-2222', 'Interested in viewing this property. Available on weekends.', 'assigned', 2, NOW()),
(2, 'Christine Lim', 'christine.lim@email.com', '+63-921-333-4444', 'Looking for a condo near my office. Please contact me.', 'pending', NULL, NULL),
(3, 'Michael Tan', 'michael.tan@email.com', '+63-922-555-6666', 'First-time homebuyer. Need more information about financing options.', 'scheduled', 2, NOW());

-- Update the scheduled appointment
UPDATE appointments SET scheduled_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY), scheduled_time = '14:00:00' WHERE id = 3;

-- Insert sample property photos
INSERT INTO property_photos (property_id, filename, original_name, is_primary, sort_order) VALUES
(1, 'property-1-main.jpg', 'modern-house-exterior.jpg', TRUE, 1),
(1, 'property-1-living.jpg', 'living-room.jpg', FALSE, 2),
(1, 'property-1-kitchen.jpg', 'kitchen.jpg', FALSE, 3),
(2, 'property-2-main.jpg', 'luxury-condo-view.jpg', TRUE, 1),
(2, 'property-2-interior.jpg', 'condo-interior.jpg', FALSE, 2),
(3, 'property-3-main.jpg', 'townhouse-front.jpg', TRUE, 1),
(5, 'property-5-main.jpg', 'executive-home.jpg', TRUE, 1),
(5, 'property-5-pool.jpg', 'pool-area.jpg', FALSE, 2);
