/**
 * Real Estate Simplified - Admin Dashboard App
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const token = API.getToken();
    const user = API.getUser();
    
    if (token && user && user.role === 'admin') {
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
        
        if (response.user.role !== 'admin') {
            throw new Error('Access denied. Admin account required.');
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
        case 'properties':
            loadProperties();
            break;
        case 'agents':
            loadAgents();
            break;
        case 'sales':
            loadSalesReport();
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
        // Load stats
        const [appointmentStats, propertiesResponse, agentsResponse] = await Promise.all([
            API.getAppointmentStats().catch(() => ({ stats: {} })),
            API.getProperties({ limit: 1 }).catch(() => ({ pagination: { total: 0 } })),
            API.getAgents().catch(() => ({ agents: [] }))
        ]);
        
        document.getElementById('stat-pending').textContent = appointmentStats.stats?.pending || 0;
        document.getElementById('stat-properties').textContent = propertiesResponse.pagination?.total || 0;
        document.getElementById('stat-agents').textContent = agentsResponse.agents?.length || 0;
        
        // Load recent appointments
        const appointments = await API.getAppointments({ limit: 5 });
        renderRecentAppointments(appointments.appointments || []);
        
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function renderRecentAppointments(appointments) {
    const tbody = document.getElementById('recent-appointments');
    
    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">No appointments yet</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = appointments.map(apt => `
        <tr>
            <td>
                <strong>${apt.customerName}</strong><br>
                <small class="text-muted">${apt.customerEmail}</small>
            </td>
            <td>${apt.propertyTitle}</td>
            <td>${Utils.getStatusBadge(apt.status)}</td>
            <td>${Utils.formatDate(apt.createdAt)}</td>
            <td>
                ${apt.status === 'pending' ? `
                    <button class="btn btn-sm btn-outline-primary" onclick="openAssignModal(${apt.id})">
                        Assign
                    </button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

// ============ Appointments ============

async function loadAppointments() {
    const status = document.getElementById('appointment-status-filter').value;
    const tbody = document.getElementById('appointments-list');
    
    try {
        const response = await API.getAppointments({ status: status || undefined });
        
        if (!response.appointments || response.appointments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">No appointments found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = response.appointments.map(apt => `
            <tr>
                <td>${apt.priorityNumber}</td>
                <td>
                    <strong>${apt.customerName}</strong><br>
                    <small class="text-muted">${apt.customerMessage ? apt.customerMessage.substring(0, 50) + '...' : ''}</small>
                </td>
                <td>
                    <a href="#" onclick="alert('Property: ${apt.propertyTitle}')">${apt.propertyTitle}</a><br>
                    <small class="text-muted">${apt.propertyCity}</small>
                </td>
                <td>
                    <a href="tel:${apt.customerPhone}">${apt.customerPhone}</a><br>
                    <small class="text-muted">${apt.customerEmail}</small>
                </td>
                <td>${Utils.getStatusBadge(apt.status)}</td>
                <td>${apt.assignedAgentName || '<span class="text-muted">-</span>'}</td>
                <td>
                    ${apt.status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" onclick="openAssignModal(${apt.id})">
                            <i class="bi bi-person-plus"></i> Assign
                        </button>
                    ` : ''}
                    ${apt.scheduledDate ? `
                        <span class="badge bg-info">
                            <i class="bi bi-calendar"></i> ${Utils.formatDate(apt.scheduledDate)}
                        </span>
                    ` : ''}
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Load appointments error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">Failed to load appointments</td>
            </tr>
        `;
    }
    
    // Setup filter
    document.getElementById('appointment-status-filter').onchange = loadAppointments;
}

let agentsList = [];

async function openAssignModal(appointmentId) {
    document.getElementById('assign-appointment-id').value = appointmentId;
    
    const select = document.getElementById('assign-agent-select');
    select.innerHTML = '<option value="">Loading agents...</option>';
    
    const modal = new bootstrap.Modal(document.getElementById('assignAgentModal'));
    modal.show();
    
    try {
        const response = await API.getAgents();
        agentsList = response.agents || [];
        
        select.innerHTML = agentsList.map(agent => `
            <option value="${agent.id}">${agent.fullName} (${agent.email})</option>
        `).join('');
    } catch (error) {
        select.innerHTML = '<option value="">Failed to load agents</option>';
    }
    
    // Setup assign button
    document.getElementById('confirm-assign-btn').onclick = async () => {
        const agentId = select.value;
        if (!agentId) {
            Utils.showToast('Please select an agent', 'error');
            return;
        }
        
        try {
            await API.assignAgent(appointmentId, parseInt(agentId));
            Utils.showToast('Agent assigned successfully', 'success');
            modal.hide();
            loadAppointments();
            loadDashboard();
        } catch (error) {
            Utils.showToast(error.message || 'Failed to assign agent', 'error');
        }
    };
}

// ============ Properties ============

async function loadProperties() {
    const tbody = document.getElementById('properties-list');
    
    try {
        const response = await API.getProperties({ limit: 50, status: '' });
        
        if (!response.properties || response.properties.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">No properties found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = response.properties.map(prop => `
            <tr>
                <td>
                    <strong>${prop.title}</strong>
                    ${prop.isFeatured ? '<span class="badge bg-warning ms-2">Featured</span>' : ''}
                </td>
                <td><span class="badge bg-secondary">${prop.propertyType}</span></td>
                <td>${prop.address}, ${prop.city}</td>
                <td>${Utils.formatPrice(prop.price)}</td>
                <td>${Utils.getStatusBadge(prop.status)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editProperty(${prop.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProperty(${prop.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Load properties error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">Failed to load properties</td>
            </tr>
        `;
    }
    
    // Setup add property button
    document.getElementById('save-property-btn').onclick = saveProperty;
}

async function saveProperty() {
    const data = {
        title: document.getElementById('property-title').value,
        propertyType: document.getElementById('property-type').value,
        description: document.getElementById('property-description').value,
        address: document.getElementById('property-address').value,
        city: document.getElementById('property-city').value,
        price: parseFloat(document.getElementById('property-price').value),
        bedrooms: parseInt(document.getElementById('property-bedrooms').value) || null,
        bathrooms: parseInt(document.getElementById('property-bathrooms').value) || null,
        floorArea: parseFloat(document.getElementById('property-floor-area').value) || null,
        lotArea: parseFloat(document.getElementById('property-lot-area').value) || null,
        isFeatured: document.getElementById('property-featured').checked
    };
    
    try {
        await API.createProperty(data);
        Utils.showToast('Property created successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('propertyModal')).hide();
        document.getElementById('property-form').reset();
        loadProperties();
    } catch (error) {
        Utils.showToast(error.message || 'Failed to create property', 'error');
    }
}

function editProperty(id) {
    Utils.showToast('Edit feature coming soon', 'info');
}

async function deleteProperty(id) {
    if (!confirm('Are you sure you want to delete this property?')) return;
    
    try {
        await API.deleteProperty(id);
        Utils.showToast('Property deleted successfully', 'success');
        loadProperties();
    } catch (error) {
        Utils.showToast(error.message || 'Failed to delete property', 'error');
    }
}

// ============ Agents ============

async function loadAgents() {
    const container = document.getElementById('agents-list');
    
    try {
        const response = await API.getUsers({ role: 'agent' });
        
        if (!response.users || response.users.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bi bi-people display-1 text-muted"></i>
                    <p class="mt-3 text-muted">No agents found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = response.users.map(agent => `
            <div class="col-md-6 col-lg-4">
                <div class="card border-0 shadow-sm agent-card">
                    <div class="card-body text-center">
                        <div class="agent-avatar mx-auto mb-3">
                            <i class="bi bi-person"></i>
                        </div>
                        <h5>${agent.firstName} ${agent.lastName}</h5>
                        <p class="text-muted mb-2">${agent.email}</p>
                        <p class="text-muted mb-3">${agent.phone || 'No phone'}</p>
                        <div class="d-flex justify-content-center gap-2">
                            <span class="badge bg-primary">Commission: ${(agent.commissionRate * 100).toFixed(1)}%</span>
                            <span class="badge ${agent.isActive ? 'bg-success' : 'bg-danger'}">
                                ${agent.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load agents error:', error);
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-danger">
                Failed to load agents
            </div>
        `;
    }
    
    // Setup add agent button
    document.getElementById('save-agent-btn').onclick = saveAgent;
}

async function saveAgent() {
    const data = {
        firstName: document.getElementById('agent-firstname').value,
        lastName: document.getElementById('agent-lastname').value,
        email: document.getElementById('agent-email').value,
        phone: document.getElementById('agent-phone').value,
        password: document.getElementById('agent-password').value,
        role: 'agent',
        commissionRate: parseFloat(document.getElementById('agent-commission').value) / 100
    };
    
    try {
        await API.createUser(data);
        Utils.showToast('Agent created successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('agentModal')).hide();
        document.getElementById('agent-form').reset();
        loadAgents();
    } catch (error) {
        Utils.showToast(error.message || 'Failed to create agent', 'error');
    }
}

// ============ Sales Report ============

async function loadSalesReport() {
    const startDate = document.getElementById('sales-start-date').value;
    const endDate = document.getElementById('sales-end-date').value;
    const tbody = document.getElementById('sales-list');
    
    try {
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        
        const response = await API.getSalesReport(params);
        
        // Update summary
        document.getElementById('sales-total-count').textContent = response.summary?.totalSales || 0;
        document.getElementById('sales-total-value').textContent = Utils.formatPrice(response.summary?.totalValue || 0);
        document.getElementById('sales-total-commission').textContent = Utils.formatPrice(response.summary?.totalCommission || 0);
        
        if (!response.sales || response.sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">No sales found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = response.sales.map(sale => `
            <tr>
                <td><strong>${sale.title}</strong></td>
                <td>${sale.city}</td>
                <td>${sale.agentName}</td>
                <td>${Utils.formatPrice(sale.salePrice)}</td>
                <td class="text-success">${Utils.formatPrice(sale.commission)}</td>
                <td>${Utils.formatDate(sale.soldDate)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Load sales error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">Failed to load sales report</td>
            </tr>
        `;
    }
    
    // Setup filter button
    document.getElementById('filter-sales-btn').onclick = loadSalesReport;
    
    // Setup export button
    document.getElementById('export-csv-btn').onclick = exportSalesCSV;
}

function exportSalesCSV() {
    const startDate = document.getElementById('sales-start-date').value;
    const endDate = document.getElementById('sales-end-date').value;
    
    let url = `${API.baseUrl}/properties/sold/export`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
        url += '?' + params.toString();
    }
    
    // Open in new window with auth header
    const token = API.getToken();
    fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(error => {
        Utils.showToast('Failed to export CSV', 'error');
    });
}
