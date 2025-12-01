/**
 * Real Estate Simplified - Home Page App
 */

document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedProperties();
    setupContactForm();
});

/**
 * Load featured properties
 */
async function loadFeaturedProperties() {
    const container = document.getElementById('featured-properties');
    
    try {
        const response = await API.getFeaturedProperties();
        
        if (response.properties && response.properties.length > 0) {
            container.innerHTML = response.properties.map(property => createPropertyCard(property)).join('');
        } else {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bi bi-house display-1 text-muted"></i>
                    <p class="mt-3 text-muted">No featured properties available at the moment.</p>
                    <a href="properties.html" class="btn btn-primary">Browse All Properties</a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading featured properties:', error);
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-exclamation-circle display-1 text-danger"></i>
                <p class="mt-3 text-muted">Unable to load properties. Please try again later.</p>
                <button class="btn btn-primary" onclick="loadFeaturedProperties()">
                    <i class="bi bi-arrow-clockwise me-2"></i>Retry
                </button>
            </div>
        `;
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
        <div class="col-md-6 col-lg-4">
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
                        <i class="bi bi-geo-alt me-1"></i>${property.city}
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
 * Setup contact form
 */
function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show success message (in real app, this would send to backend)
        Utils.showToast('Thank you for your message! We will get back to you soon.', 'success');
        form.reset();
    });
}
