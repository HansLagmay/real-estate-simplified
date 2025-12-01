/**
 * Real Estate Simplified - API Client
 * Handles all API communication with the backend
 */

const API = {
    baseUrl: 'http://localhost:3000/api',

    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add auth token if available
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * GET request
     */
    get(endpoint) {
        return this.request(endpoint);
    },

    /**
     * POST request
     */
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * PUT request
     */
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    /**
     * DELETE request
     */
    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    },

    // ============ Properties ============

    /**
     * Get properties with filters
     */
    getProperties(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/properties${queryString ? '?' + queryString : ''}`);
    },

    /**
     * Get single property
     */
    getProperty(id) {
        return this.get(`/properties/${id}`);
    },

    /**
     * Get featured properties
     */
    getFeaturedProperties() {
        return this.get('/properties?featured=true&limit=6');
    },

    // ============ Appointments ============

    /**
     * Submit viewing request
     */
    submitViewingRequest(data) {
        return this.post('/appointments', data);
    }
};

/**
 * Utility functions
 */
const Utils = {
    /**
     * Format currency (Philippine Peso)
     */
    formatPrice(amount) {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    /**
     * Format date
     */
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Get property type label
     */
    getPropertyTypeLabel(type) {
        const labels = {
            'house': 'House',
            'condo': 'Condo',
            'townhouse': 'Townhouse',
            'lot': 'Lot',
            'commercial': 'Commercial'
        };
        return labels[type] || type;
    },

    /**
     * Get status badge class
     */
    getStatusBadgeClass(status) {
        const classes = {
            'available': 'bg-success',
            'reserved': 'bg-warning',
            'sold': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Create toast container if not exists
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
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

        // Remove after hidden
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Get placeholder image
     */
    getPlaceholderImage() {
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23e9ecef" width="400" height="300"/%3E%3Ctext fill="%236c757d" font-family="sans-serif" font-size="20" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
    },

    /**
     * Get image URL
     */
    getImageUrl(filename) {
        if (!filename) return this.getPlaceholderImage();
        if (filename.startsWith('http')) return filename;
        return `${API.baseUrl.replace('/api', '')}/uploads/${filename}`;
    }
};
