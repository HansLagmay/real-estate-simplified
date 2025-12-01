/**
 * Real Estate Simplified - Agent API Client
 */

const API = {
    baseUrl: 'http://localhost:3000/api',

    getToken() {
        return localStorage.getItem('agentToken');
    },

    setToken(token) {
        localStorage.setItem('agentToken', token);
    },

    clearToken() {
        localStorage.removeItem('agentToken');
        localStorage.removeItem('agentUser');
    },

    getUser() {
        const user = localStorage.getItem('agentUser');
        return user ? JSON.parse(user) : null;
    },

    setUser(user) {
        localStorage.setItem('agentUser', JSON.stringify(user));
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

    getProfile() {
        return this.get('/auth/profile');
    },

    // My Appointments
    getMyAppointments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/appointments/my${queryString ? '?' + queryString : ''}`);
    },

    scheduleAppointment(id, data) {
        return this.put(`/appointments/${id}/schedule`, data);
    },

    completeAppointment(id, data) {
        return this.put(`/appointments/${id}/complete`, data);
    },

    // My Sales
    getMySales(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/properties/my-sales${queryString ? '?' + queryString : ''}`);
    },

    // Properties
    getProperties(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/properties${queryString ? '?' + queryString : ''}`);
    },

    markPropertySold(id, data) {
        return this.put(`/properties/${id}/mark-sold`, data);
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

    formatTime(timeString) {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${minutes} ${ampm}`;
    },

    getStatusBadge(status) {
        const badges = {
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
    },

    getPlaceholderImage() {
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"%3E%3Crect fill="%23e9ecef" width="400" height="200"/%3E%3Ctext fill="%236c757d" font-family="sans-serif" font-size="16" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
    },

    getImageUrl(filename) {
        if (!filename) return this.getPlaceholderImage();
        if (filename.startsWith('http')) return filename;
        return `${API.baseUrl.replace('/api', '')}/uploads/${filename}`;
    }
};
