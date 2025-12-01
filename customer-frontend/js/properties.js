/**
 * Real Estate Simplified - Properties Listing Page
 */

let currentPage = 1;
let totalPages = 1;
let currentFilters = {};

document.addEventListener('DOMContentLoaded', () => {
    // Get initial filters from URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type')) {
        document.getElementById('filter-type').value = urlParams.get('type');
        currentFilters.type = urlParams.get('type');
    }
    
    loadProperties();
    setupFilters();
});

/**
 * Load properties with current filters
 */
async function loadProperties(page = 1) {
    const container = document.getElementById('properties-container');
    const pagination = document.getElementById('pagination-container');
    const resultsCount = document.getElementById('results-count');
    
    // Show loading
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    try {
        const params = {
            page,
            limit: 12,
            ...currentFilters
        };
        
        const response = await API.getProperties(params);
        
        if (response.properties && response.properties.length > 0) {
            container.innerHTML = response.properties.map(property => createPropertyCard(property)).join('');
            
            currentPage = response.pagination.page;
            totalPages = response.pagination.pages;
            
            resultsCount.textContent = `Showing ${response.properties.length} of ${response.pagination.total} properties`;
            
            renderPagination(response.pagination);
            pagination.classList.remove('d-none');
        } else {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bi bi-search display-1 text-muted"></i>
                    <h4 class="mt-3">No Properties Found</h4>
                    <p class="text-muted">Try adjusting your filters to find more properties.</p>
                    <button class="btn btn-primary" onclick="clearFilters()">
                        Clear All Filters
                    </button>
                </div>
            `;
            resultsCount.textContent = 'No properties found';
            pagination.classList.add('d-none');
        }
    } catch (error) {
        console.error('Error loading properties:', error);
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-exclamation-circle display-1 text-danger"></i>
                <p class="mt-3 text-muted">Unable to load properties. Please try again later.</p>
                <button class="btn btn-primary" onclick="loadProperties()">
                    <i class="bi bi-arrow-clockwise me-2"></i>Retry
                </button>
            </div>
        `;
        resultsCount.textContent = 'Error loading properties';
        pagination.classList.add('d-none');
    }
}

/**
 * Create property card HTML
 */
function createPropertyCard(property) {
    const imageUrl = Utils.getImageUrl(property.primaryPhoto);
    const price = Utils.formatPrice(property.price);
    const typeLabel = Utils.getPropertyTypeLabel(property.propertyType);
    
    return `
        <div class="col-md-6 col-xl-4">
            <div class="card property-card h-100 border-0 shadow-sm">
                <div class="card-img-wrapper">
                    ${property.isFeatured ? '<span class="badge bg-warning badge-featured">Featured</span>' : ''}
                    <img src="${imageUrl}" class="card-img-top" alt="${property.title}"
                         onerror="this.src='${Utils.getPlaceholderImage()}'">
                </div>
                <div class="card-body">
                    <span class="badge bg-primary mb-2">${typeLabel}</span>
                    <h5 class="card-title">${property.title}</h5>
                    <p class="text-muted mb-2">
                        <i class="bi bi-geo-alt me-1"></i>${property.address}, ${property.city}
                    </p>
                    <div class="property-specs mb-3">
                        ${property.bedrooms ? `<span><i class="bi bi-door-open"></i>${property.bedrooms} BR</span>` : ''}
                        ${property.bathrooms ? `<span><i class="bi bi-droplet"></i>${property.bathrooms} BA</span>` : ''}
                        ${property.floorArea ? `<span><i class="bi bi-arrows-angle-expand"></i>${property.floorArea} sqm</span>` : ''}
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="property-price">${price}</span>
                        <a href="property.html?id=${property.id}" class="btn btn-outline-primary btn-sm">
                            View Details
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup filter form
 */
function setupFilters() {
    const form = document.getElementById('filter-form');
    const clearBtn = document.getElementById('clear-filters');
    const sortSelect = document.getElementById('sort-by');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        applyFilters();
    });
    
    clearBtn.addEventListener('click', clearFilters);
    
    sortSelect.addEventListener('change', () => {
        // Apply sort (in real app, would send to API)
        loadProperties(1);
    });
    
    // Setup search debounce
    const searchInput = document.getElementById('filter-search');
    searchInput.addEventListener('input', Utils.debounce(() => {
        applyFilters();
    }, 500));
}

/**
 * Apply current filters
 */
function applyFilters() {
    currentFilters = {};
    
    const search = document.getElementById('filter-search').value.trim();
    const type = document.getElementById('filter-type').value;
    const city = document.getElementById('filter-city').value;
    const minPrice = document.getElementById('filter-min-price').value;
    const maxPrice = document.getElementById('filter-max-price').value;
    const bedrooms = document.getElementById('filter-bedrooms').value;
    
    if (search) currentFilters.search = search;
    if (type) currentFilters.type = type;
    if (city) currentFilters.city = city;
    if (minPrice) currentFilters.minPrice = minPrice;
    if (maxPrice) currentFilters.maxPrice = maxPrice;
    if (bedrooms) currentFilters.bedrooms = bedrooms;
    
    loadProperties(1);
}

/**
 * Clear all filters
 */
function clearFilters() {
    document.getElementById('filter-form').reset();
    currentFilters = {};
    
    // Update URL
    window.history.replaceState({}, '', 'properties.html');
    
    loadProperties(1);
}

/**
 * Render pagination
 */
function renderPagination(pagination) {
    const container = document.querySelector('#pagination-container .pagination');
    if (!container) return;
    
    let html = '';
    
    // Previous button
    html += `
        <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="goToPage(${pagination.page - 1}); return false;">
                <i class="bi bi-chevron-left"></i>
            </a>
        </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);
    
    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="goToPage(1); return false;">1</a></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === pagination.page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="goToPage(${i}); return false;">${i}</a>
            </li>
        `;
    }
    
    if (endPage < pagination.pages) {
        if (endPage < pagination.pages - 1) {
            html += `<li class="page-item disabled"><a class="page-link">...</a></li>`;
        }
        html += `<li class="page-item"><a class="page-link" href="#" onclick="goToPage(${pagination.pages}); return false;">${pagination.pages}</a></li>`;
    }
    
    // Next button
    html += `
        <li class="page-item ${pagination.page === pagination.pages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="goToPage(${pagination.page + 1}); return false;">
                <i class="bi bi-chevron-right"></i>
            </a>
        </li>
    `;
    
    container.innerHTML = html;
}

/**
 * Go to specific page
 */
function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    loadProperties(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
