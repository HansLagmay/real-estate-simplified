/**
 * Real Estate Simplified - Agent Dashboard App
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const token = API.getToken();
    const user = API.getUser();
    
    if (token && user && user.role === 'agent') {
        showDashboard();
    } else {
        showLogin();
    }
}

// ============ Authentication ============

function showLogin() {
    document.getElementById('login-page').classList.remove('d-none');
    document.getElementById('dashboard-page').classList.add('d-none');
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
    errorDiv.classList.add('d-none');
    
    try {
        const response = await API.login(email, password);
        
        if (response.user.role !== 'agent') {
            throw new Error('Access denied. Agent account required.');
        }
        
        API.setToken(response.token);
        API.setUser(response.user);
        
        showDashboard();
    } catch (error) {
        errorDiv.textContent = error.message || 'Login failed';
        errorDiv.classList.remove('d-none');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
    }
}

function showDashboard() {
    document.getElementById('login-page').classList.add('d-none');
    document.getElementById('dashboard-page').classList.remove('d-none');
    
    const user = API.getUser();
    document.getElementById('user-name').textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById('welcome-name').textContent = user.firstName;
    
    setupNavigation();
    setupLogout();
    loadDashboard();
}

// ============ Navigation ============

function setupNavigation() {
    const navLinks = document.querySelectorAll('[data-page]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });
    
    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('dashboard-page').classList.toggle('sidebar-collapsed');
    });
}

function navigateTo(page) {
    // Update nav links
    document.querySelectorAll('[data-page]').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    
    // Show/hide pages
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.add('d-none');
    });
    document.getElementById(`page-${page}`).classList.remove('d-none');
    
    // Load page data
    switch (page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'appointments':
            loadAppointments();
            break;
        case 'sales':
            loadMySales();
            break;
        case 'properties':
            loadProperties();
            break;
    }
}

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        API.clearToken();
        window.location.reload();
    });
}

// ============ Dashboard ============

async function loadDashboard() {
    try {
        // Load appointments stats
        const appointmentsResponse = await API.getMyAppointments({ limit: 100 });
        const appointments = appointmentsResponse.appointments || [];
        
        const assigned = appointments.filter(a => a.status === 'assigned').length;
        const scheduled = appointments.filter(a => a.status === 'scheduled').length;
        const completed = appointments.filter(a => a.status === 'completed').length;
        
        document.getElementById('stat-assigned').textContent = assigned;
        document.getElementById('stat-scheduled').textContent = scheduled;
        document.getElementById('stat-completed').textContent = completed;
        
        // Load sales/commission
        const salesResponse = await API.getMySales();
        document.getElementById('stat-commission').textContent = Utils.formatPrice(salesResponse.summary?.totalCommission || 0);
        
        // Show upcoming (assigned + scheduled)
        const upcoming = appointments.filter(a => ['assigned', 'scheduled'].includes(a.status)).slice(0, 5);
        renderUpcomingAppointments(upcoming);
        
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function renderUpcomingAppointments(appointments) {
    const tbody = document.getElementById('upcoming-appointments');
    
    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">No upcoming appointments</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = appointments.map(apt => `
        <tr>
            <td>
                <strong>${apt.customerName}</strong>
            </td>
            <td>
                ${apt.propertyTitle}<br>
                <small class="text-muted">${apt.propertyCity}</small>
            </td>
            <td>
                <a href="tel:${apt.customerPhone}" class="btn btn-sm btn-call me-1">
                    <i class="bi bi-telephone"></i>
                </a>
                <a href="sms:${apt.customerPhone}" class="btn btn-sm btn-sms">
                    <i class="bi bi-chat-dots"></i>
                </a>
            </td>
            <td>${Utils.getStatusBadge(apt.status)}</td>
            <td>
                ${apt.status === 'assigned' ? `
                    <button class="btn btn-sm btn-primary" onclick="openScheduleModal(${apt.id})">
                        <i class="bi bi-calendar-plus"></i> Schedule
                    </button>
                ` : apt.status === 'scheduled' ? `
                    <button class="btn btn-sm btn-success" onclick="openCompleteModal(${apt.id})">
                        <i class="bi bi-check-circle"></i> Complete
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// ============ Appointments ============

async function loadAppointments() {
    const container = document.getElementById('appointments-list');
    const status = document.getElementById('appointment-filter').value;
    
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary"></div>
        </div>
    `;
    
    try {
        const response = await API.getMyAppointments({ status: status || undefined });
        const appointments = response.appointments || [];
        
        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bi bi-calendar-x display-1 text-muted"></i>
                    <p class="mt-3 text-muted">No appointments found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = appointments.map(apt => `
            <div class="col-md-6 col-lg-4">
                <div class="card appointment-card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="customer-avatar me-3">
                                <i class="bi bi-person"></i>
                            </div>
                            <div>
                                <h6 class="mb-0">${apt.customerName}</h6>
                                <small class="text-muted">Priority #${apt.priorityNumber}</small>
                            </div>
                            <div class="ms-auto">
                                ${Utils.getStatusBadge(apt.status)}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <strong>${apt.propertyTitle}</strong><br>
                            <small class="text-muted">
                                <i class="bi bi-geo-alt me-1"></i>${apt.propertyCity}
                            </small>
                            ${apt.propertyPrice ? `<br><small class="text-primary">${Utils.formatPrice(apt.propertyPrice)}</small>` : ''}
                        </div>
                        
                        ${apt.customerMessage ? `
                            <div class="mb-3 p-2 bg-light rounded">
                                <small class="text-muted">"${apt.customerMessage}"</small>
                            </div>
                        ` : ''}
                        
                        ${apt.scheduledDate ? `
                            <div class="mb-3">
                                <i class="bi bi-calendar-event text-primary me-2"></i>
                                <strong>${Utils.formatDate(apt.scheduledDate)}</strong>
                                at <strong>${Utils.formatTime(apt.scheduledTime)}</strong>
                            </div>
                        ` : ''}
                        
                        <div class="d-flex gap-2 mb-3">
                            <a href="tel:${apt.customerPhone}" class="btn btn-call flex-fill">
                                <i class="bi bi-telephone me-1"></i>Call
                            </a>
                            <a href="sms:${apt.customerPhone}" class="btn btn-sms flex-fill">
                                <i class="bi bi-chat-dots me-1"></i>SMS
                            </a>
                        </div>
                        
                        <div class="d-flex gap-2">
                            ${apt.status === 'assigned' ? `
                                <button class="btn btn-primary w-100" onclick="openScheduleModal(${apt.id})">
                                    <i class="bi bi-calendar-plus me-1"></i>Set Schedule
                                </button>
                            ` : apt.status === 'scheduled' ? `
                                <button class="btn btn-success w-100" onclick="openCompleteModal(${apt.id})">
                                    <i class="bi bi-check-circle me-1"></i>Complete
                                </button>
                            ` : apt.outcome ? `
                                <div class="alert alert-light mb-0 w-100 text-center">
                                    Outcome: <strong>${apt.outcome.replace('_', ' ')}</strong>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load appointments error:', error);
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-danger">
                Failed to load appointments
            </div>
        `;
    }
    
    // Setup filter
    document.getElementById('appointment-filter').onchange = loadAppointments;
}

function openScheduleModal(appointmentId) {
    document.getElementById('schedule-appointment-id').value = appointmentId;
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('schedule-date').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('schedule-time').value = '10:00';
    document.getElementById('schedule-notes').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
    modal.show();
    
    document.getElementById('confirm-schedule-btn').onclick = async () => {
        const scheduledDate = document.getElementById('schedule-date').value;
        const scheduledTime = document.getElementById('schedule-time').value;
        const agentNotes = document.getElementById('schedule-notes').value;
        
        if (!scheduledDate || !scheduledTime) {
            Utils.showToast('Please select date and time', 'error');
            return;
        }
        
        try {
            await API.scheduleAppointment(appointmentId, {
                scheduledDate,
                scheduledTime,
                agentNotes
            });
            Utils.showToast('Viewing scheduled successfully', 'success');
            modal.hide();
            loadAppointments();
            loadDashboard();
        } catch (error) {
            Utils.showToast(error.message || 'Failed to schedule', 'error');
        }
    };
}

function openCompleteModal(appointmentId) {
    document.getElementById('complete-appointment-id').value = appointmentId;
    document.getElementById('complete-outcome').value = '';
    document.getElementById('complete-notes').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('completeModal'));
    modal.show();
    
    document.getElementById('confirm-complete-btn').onclick = async () => {
        const outcome = document.getElementById('complete-outcome').value;
        const agentNotes = document.getElementById('complete-notes').value;
        
        if (!outcome) {
            Utils.showToast('Please select an outcome', 'error');
            return;
        }
        
        try {
            await API.completeAppointment(appointmentId, {
                outcome,
                agentNotes
            });
            Utils.showToast('Viewing marked as completed', 'success');
            modal.hide();
            loadAppointments();
            loadDashboard();
        } catch (error) {
            Utils.showToast(error.message || 'Failed to complete', 'error');
        }
    };
}

// ============ My Sales ============

async function loadMySales() {
    const tbody = document.getElementById('sales-list');
    
    try {
        const response = await API.getMySales();
        
        // Update summary
        document.getElementById('sales-count').textContent = response.summary?.totalSales || 0;
        document.getElementById('sales-value').textContent = Utils.formatPrice(response.summary?.totalValue || 0);
        document.getElementById('total-commission').textContent = Utils.formatPrice(response.summary?.totalCommission || 0);
        document.getElementById('commission-rate').textContent = `at ${(response.commissionRate * 100).toFixed(1)}% rate`;
        
        const sales = response.sales || [];
        
        if (sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        No sales yet. Keep up the great work!
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = sales.map(sale => `
            <tr>
                <td><strong>${sale.title}</strong></td>
                <td>${sale.city}</td>
                <td>${Utils.formatPrice(sale.salePrice)}</td>
                <td class="text-success fw-bold">${Utils.formatPrice(sale.commission)}</td>
                <td>${Utils.formatDate(sale.soldDate)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Load sales error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-danger">Failed to load sales</td>
            </tr>
        `;
    }
}

// ============ Properties ============

async function loadProperties() {
    const container = document.getElementById('properties-list');
    
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary"></div>
        </div>
    `;
    
    try {
        const response = await API.getProperties({ status: 'available', limit: 50 });
        const properties = response.properties || [];
        
        if (properties.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bi bi-building display-1 text-muted"></i>
                    <p class="mt-3 text-muted">No available properties</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = properties.map(prop => `
            <div class="col-md-6 col-lg-4">
                <div class="card property-card border-0 shadow-sm h-100">
                    <div class="img-wrapper">
                        <img src="${Utils.getImageUrl(prop.primaryPhoto)}" class="card-img-top" alt="${prop.title}"
                             onerror="this.src='${Utils.getPlaceholderImage()}'">
                    </div>
                    <div class="card-body">
                        <span class="badge bg-primary mb-2">${prop.propertyType}</span>
                        ${prop.isFeatured ? '<span class="badge bg-warning mb-2 ms-1">Featured</span>' : ''}
                        <h6>${prop.title}</h6>
                        <p class="text-muted mb-2">
                            <i class="bi bi-geo-alt me-1"></i>${prop.city}
                        </p>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="text-primary fw-bold">${Utils.formatPrice(prop.price)}</span>
                            <small class="text-muted">
                                ${prop.bedrooms ? `${prop.bedrooms}BR` : ''} 
                                ${prop.bathrooms ? `${prop.bathrooms}BA` : ''}
                            </small>
                        </div>
                        <button class="btn btn-success w-100" onclick="openMarkSoldModal(${prop.id}, ${prop.price})">
                            <i class="bi bi-cash-coin me-1"></i>Mark as Sold
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load properties error:', error);
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-danger">
                Failed to load properties
            </div>
        `;
    }
}

function openMarkSoldModal(propertyId, defaultPrice) {
    document.getElementById('sold-property-id').value = propertyId;
    document.getElementById('sold-price').value = defaultPrice || '';
    document.getElementById('sold-date').value = new Date().toISOString().split('T')[0];
    
    const modal = new bootstrap.Modal(document.getElementById('markSoldModal'));
    modal.show();
    
    document.getElementById('confirm-sold-btn').onclick = async () => {
        const salePrice = parseFloat(document.getElementById('sold-price').value);
        const soldDate = document.getElementById('sold-date').value;
        
        if (!salePrice || salePrice <= 0) {
            Utils.showToast('Please enter a valid sale price', 'error');
            return;
        }
        
        if (!soldDate) {
            Utils.showToast('Please select sale date', 'error');
            return;
        }
        
        try {
            await API.markPropertySold(propertyId, {
                salePrice,
                soldDate
            });
            Utils.showToast('Property marked as sold! Commission added.', 'success');
            modal.hide();
            loadProperties();
            loadMySales();
            loadDashboard();
        } catch (error) {
            Utils.showToast(error.message || 'Failed to mark as sold', 'error');
        }
    };
}
