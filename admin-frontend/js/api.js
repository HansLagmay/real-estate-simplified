/**
 * Real Estate Simplified - Admin API Client
 */

const API = {
    baseUrl: 'http://localhost:3000/api',

    getToken() {
        return localStorage.getItem('adminToken');
    },

    setToken(token) {
        localStorage.setItem('adminToken', token);
    },

    clearToken() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
    },

    getUser() {
        const user = localStorage.getItem('adminUser');
        return user ? JSON.parse(user) : null;
    },

    setUser(user) {
        localStorage.setItem('adminUser', JSON.stringify(user));
    },

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        const token = this.getToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (response.status === 401 || response.status === 403) {
                this.clearToken();
                window.location.reload();
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint);
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    },

    // Auth
    login(email, password) {
        return this.post('/auth/login', { email, password });
    },

    // Appointments
    getAppointments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/appointments${queryString ? '?' + queryString : ''}`);
    },

    assignAgent(appointmentId, agentId) {
        return this.put(`/appointments/${appointmentId}/assign`, { agentId });
    },

    getAppointmentStats() {
        return this.get('/appointments/stats');
    },

    getCalendar(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/appointments/calendar${queryString ? '?' + queryString : ''}`);
    },

    // Properties
    getProperties(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/properties${queryString ? '?' + queryString : ''}`);
    },

    createProperty(data) {
        return this.post('/properties', data);
    },

    updateProperty(id, data) {
        return this.put(`/properties/${id}`, data);
    },

    deleteProperty(id) {
        return this.delete(`/properties/${id}`);
    },

    getSalesReport(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/properties/sold/all${queryString ? '?' + queryString : ''}`);
    },

    // Users
    getAgents() {
        return this.get('/users/agents');
    },

    getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/users${queryString ? '?' + queryString : ''}`);
    },

    createUser(data) {
        return this.post('/auth/register', data);
    },

    updateUser(id, data) {
        return this.put(`/users/${id}`, data);
    },

    getPerformanceReport(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/users/reports/performance${queryString ? '?' + queryString : ''}`);
    }
};

const Utils = {
    formatPrice(amount) {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    getStatusBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-pending">Pending</span>',
            'assigned': '<span class="badge badge-assigned">Assigned</span>',
            'scheduled': '<span class="badge badge-scheduled">Scheduled</span>',
            'completed': '<span class="badge badge-completed">Completed</span>',
            'cancelled': '<span class="badge badge-cancelled">Cancelled</span>',
            'available': '<span class="badge bg-success">Available</span>',
            'reserved': '<span class="badge bg-warning">Reserved</span>',
            'sold': '<span class="badge bg-danger">Sold</span>'
        };
        return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
    },

    showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toastId = `toast-${Date.now()}`;
        const bgClass = type === 'error' ? 'bg-danger' : type === 'success' ? 'bg-success' : 'bg-primary';
        
        const toastHtml = `
            <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
                <div class="toast-body d-flex justify-content-between align-items-center">
                    ${message}
                    <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
};
