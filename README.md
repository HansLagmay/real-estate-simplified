# Real Estate Simplified

A complete full-stack real estate platform with customer frontend, admin dashboard, and agent dashboard. Built with Express.js, MySQL, and vanilla JavaScript.

## 🏠 Overview

Real Estate Simplified is a comprehensive real estate management system designed for property agencies. It features:

- **Customer Frontend**: Browse properties and request viewings (no login required)
- **Admin Dashboard**: Manage properties, assign agents, view sales reports
- **Agent Dashboard**: Handle appointments, track sales, and commission earnings

## ✨ Features

### Customer Features
- Browse all available properties with filters
- View detailed property information with photos
- Request property viewings (no account required)
- Mobile-responsive design
- reCAPTCHA v3 spam prevention

### Admin Features
- Dashboard with key metrics
- Manage all appointments
- Assign agents to customer requests
- Full property management (CRUD)
- Agent management
- Sales reports with CSV export
- Commission tracking for all agents

### Agent Features
- Personal dashboard with stats
- View assigned appointments
- Click-to-call/SMS customer contacts
- Schedule viewings after customer coordination
- Mark viewings as completed with outcomes
- **My Sales page with commission tracking**
- Mark properties as sold

## 🗄️ Database Schema

### Users Table
```sql
- id, email, password_hash, first_name, last_name
- role (agent/admin)
- commission_rate (default: 3%)
- is_active, created_at, updated_at
```

### Properties Table
```sql
- id, title, description, property_type
- address, city, province, zip_code
- price, bedrooms, bathrooms, floor_area, lot_area
- status (available/reserved/sold)
- sold_by_agent_id, sold_date, sale_price
- is_featured, created_at, updated_at
```

### Appointments Table
```sql
- id, property_id
- customer_name, customer_email, customer_phone, customer_message
- priority_number (auto-assigned via trigger)
- assigned_agent_id, assigned_at
- scheduled_date, scheduled_time
- status (pending/assigned/scheduled/completed/cancelled)
- outcome (interested/offer_made/not_interested/no_show)
```

### Property Photos Table
```sql
- id, property_id, filename, original_name
- is_primary, sort_order
```

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- MySQL 5.7+ or 8.0+

### 1. Clone the Repository
```bash
git clone https://github.com/HansLagmay/real-estate-simplified.git
cd real-estate-simplified
```

### 2. Setup Backend
```bash
cd backend
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# nano .env
```

### 3. Configure Database
```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE real_estate_simplified;"

# Run schema
mysql -u root -p real_estate_simplified < sql/schema.sql

# (Optional) Load seed data
mysql -u root -p real_estate_simplified < sql/seed.sql
```

### 4. Environment Configuration
Edit `backend/.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=real_estate_simplified

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-key

# Email (optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# reCAPTCHA v3 (optional)
RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key
```

### 5. Start the Server
```bash
npm start
# or for development with auto-reload
npm run dev
```

Server runs on `http://localhost:3000`

### 6. Serve Frontend Files
Use any static file server for the frontend directories:

```bash
# Using Python
cd customer-frontend && python -m http.server 8080

# Or using Node.js http-server
npx http-server customer-frontend -p 8080
```

Frontend URLs:
- Customer: `http://localhost:8080`
- Admin: `http://localhost:8081` (serve admin-frontend)
- Agent: `http://localhost:8082` (serve agent-frontend)

## 📡 API Reference

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | List properties with filters |
| GET | `/api/properties/:id` | Get single property |
| POST | `/api/appointments` | Submit viewing request |
| GET | `/api/health` | Health check |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/profile` | Get current user profile |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/password` | Change password |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments` | List all appointments |
| PUT | `/api/appointments/:id/assign` | Assign agent |
| GET | `/api/appointments/stats` | Appointment statistics |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/users` | List all users |
| GET | `/api/users/agents` | List agents |
| PUT | `/api/users/:id` | Update user |
| GET | `/api/properties/sold/all` | Sales report (all agents) |
| GET | `/api/properties/sold/export` | Export sales CSV |

### Agent Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments/my` | My assigned appointments |
| PUT | `/api/appointments/:id/schedule` | Set schedule |
| PUT | `/api/appointments/:id/complete` | Mark completed |
| GET | `/api/properties/my-sales` | My sales with commission |
| PUT | `/api/properties/:id/mark-sold` | Mark property sold |

### Property Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/properties` | Create property |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |
| POST | `/api/properties/:id/photos` | Upload photos |
| DELETE | `/api/properties/:id/photos/:photoId` | Delete photo |

## 👥 User Flows

### Customer Flow
1. Browse properties on the website
2. Click "Request Viewing" on a property
3. Fill form: name, email, phone, message
4. Submit → "We'll contact you within 24 hours"
5. Receive email confirmation
6. Agent calls to schedule viewing

### Admin Flow
1. Login to admin dashboard
2. View pending appointment requests
3. Assign agent to each request
4. Monitor agent performance
5. View/export sales reports
6. Manage properties and agents

### Agent Flow
1. Login to agent dashboard
2. See assigned requests in dashboard
3. Call customer using click-to-call
4. After phone coordination, set schedule in system
5. Conduct viewing
6. Mark as completed with outcome
7. If sale made, mark property as sold
8. View earnings in "My Sales" page

## 💰 Commission Tracking

### Agent "My Sales" Page
```
Property Title | Sale Price   | Commission (3%) | Sale Date
Modern 3BR     | ₱8,500,000  | ₱255,000        | Dec 15, 2025
Luxury Condo   | ₱12,000,000 | ₱360,000        | Dec 10, 2025

Total Sales: 2 properties
Total Commission: ₱615,000
```

### Admin Sales Report
- View all sales by all agents
- Filter by date range, agent
- Export to CSV for accounting
- Top performing agents ranking

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: 100 requests/15min (API), 10/hour (forms)
- **Input Validation**: express-validator on all endpoints
- **reCAPTCHA v3**: Bot prevention on public forms
- **Duplicate Detection**: Prevent spam submissions
- **CORS Configuration**: Configurable allowed origins

## 📁 Project Structure

```
real-estate-simplified/
├── README.md                 # This file
├── .gitignore
├── backend/
│   ├── server.js            # Express server entry
│   ├── package.json
│   ├── .env.example         # Environment template
│   ├── config/
│   │   └── database.js      # MySQL connection pool
│   ├── middleware/
│   │   └── auth.js          # JWT verification
│   ├── routes/
│   │   ├── auth.js          # Authentication
│   │   ├── properties.js    # Property CRUD
│   │   ├── appointments.js  # Appointment management
│   │   └── users.js         # User management
│   ├── sql/
│   │   ├── schema.sql       # Database schema
│   │   └── seed.sql         # Sample data
│   └── uploads/             # Photo uploads
├── customer-frontend/
│   ├── index.html           # Landing page
│   ├── properties.html      # Property listing
│   ├── property.html        # Property details
│   ├── css/style.css
│   └── js/
│       ├── api.js           # API client
│       ├── app.js           # Home page logic
│       ├── properties.js    # Listing logic
│       └── property.js      # Details/form logic
├── admin-frontend/
│   ├── index.html           # Admin dashboard
│   ├── css/style.css
│   └── js/
│       ├── api.js           # Admin API client
│       └── app.js           # Dashboard logic
└── agent-frontend/
    ├── index.html           # Agent dashboard
    ├── css/style.css
    └── js/
        ├── api.js           # Agent API client
        └── app.js           # Agent features
```

## 🧪 Default Login Credentials

After running seed.sql:

**Admin:**
- Email: `admin@company.com`
- Password: `admin123`

**Agents:**
- Email: `agent1@company.com` / Password: `agent123`
- Email: `agent2@company.com` / Password: `agent123`
- Email: `agent3@company.com` / Password: `agent123`

⚠️ **Change these passwords in production!**

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL with mysql2 driver
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **File Upload**: multer
- **Validation**: express-validator
- **Rate Limiting**: express-rate-limit
- **Email**: nodemailer
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5.3
- **Icons**: Bootstrap Icons

## 📝 License

MIT License - feel free to use for your own projects.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues or questions, please open a GitHub issue.