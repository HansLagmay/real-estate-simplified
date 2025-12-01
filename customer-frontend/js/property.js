/**
 * Real Estate Simplified - Property Details Page
 */

let propertyId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Get property ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    propertyId = urlParams.get('id');
    
    if (!propertyId) {
        showError();
        return;
    }
    
    loadProperty();
    setupViewingForm();
});

/**
 * Load property details
 */
async function loadProperty() {
    try {
        const response = await API.getProperty(propertyId);
        
        if (response.property) {
            displayProperty(response.property);
        } else {
            showError();
        }
    } catch (error) {
        console.error('Error loading property:', error);
        showError();
    }
}

/**
 * Display property details
 */
function displayProperty(property) {
    // Hide loading, show content
    document.getElementById('loading-state').classList.add('d-none');
    document.getElementById('property-content').classList.remove('d-none');
    
    // Update page title
    document.title = `${property.title} - Real Estate Simplified`;
    document.getElementById('property-title').textContent = property.title;
    document.getElementById('property-title-detail').textContent = property.title;
    
    // Update badges
    document.getElementById('property-type').textContent = Utils.getPropertyTypeLabel(property.propertyType);
    const statusBadge = document.getElementById('property-status');
    statusBadge.textContent = property.status.charAt(0).toUpperCase() + property.status.slice(1);
    statusBadge.className = `badge ${Utils.getStatusBadgeClass(property.status)} mb-2 ms-2`;
    
    // Price and location
    document.getElementById('property-price').textContent = Utils.formatPrice(property.price);
    document.getElementById('property-location').textContent = `${property.address}, ${property.city}${property.province ? ', ' + property.province : ''}`;
    
    // Description
    document.getElementById('property-description').textContent = property.description || 'No description available.';
    
    // Photos
    displayPhotos(property.photos);
    
    // Specs
    displaySpecs(property);
    
    // Features
    displayFeatures(property.features);
    
    // Agent info
    if (property.listedByName) {
        document.getElementById('agent-name').textContent = property.listedByName;
    } else {
        document.getElementById('agent-card').classList.add('d-none');
    }
    
    // Disable form if property is not available
    if (property.status !== 'available') {
        const form = document.getElementById('viewing-form');
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-x-circle me-2"></i>Not Available';
        
        const notice = document.createElement('div');
        notice.className = 'alert alert-warning mt-3';
        notice.innerHTML = '<i class="bi bi-info-circle me-2"></i>This property is no longer available for viewing.';
        form.appendChild(notice);
    }
}

/**
 * Display photo carousel
 */
function displayPhotos(photos) {
    const container = document.getElementById('carousel-images');
    
    if (!photos || photos.length === 0) {
        container.innerHTML = `
            <div class="carousel-item active">
                <img src="${Utils.getPlaceholderImage()}" class="d-block w-100" alt="No image available">
            </div>
        `;
        return;
    }
    
    container.innerHTML = photos.map((photo, index) => `
        <div class="carousel-item ${index === 0 ? 'active' : ''}">
            <img src="${Utils.getImageUrl(photo.filename)}" class="d-block w-100" alt="${photo.originalName || 'Property photo'}"
                 onerror="this.src='${Utils.getPlaceholderImage()}'">
        </div>
    `).join('');
}

/**
 * Display property specifications
 */
function displaySpecs(property) {
    const container = document.getElementById('property-specs');
    const specs = [];
    
    if (property.bedrooms) {
        specs.push({
            icon: 'bi-door-open',
            label: 'Bedrooms',
            value: property.bedrooms
        });
    }
    
    if (property.bathrooms) {
        specs.push({
            icon: 'bi-droplet',
            label: 'Bathrooms',
            value: property.bathrooms
        });
    }
    
    if (property.floorArea) {
        specs.push({
            icon: 'bi-arrows-angle-expand',
            label: 'Floor Area',
            value: `${property.floorArea} sqm`
        });
    }
    
    if (property.lotArea) {
        specs.push({
            icon: 'bi-bounding-box',
            label: 'Lot Area',
            value: `${property.lotArea} sqm`
        });
    }
    
    if (property.yearBuilt) {
        specs.push({
            icon: 'bi-calendar3',
            label: 'Year Built',
            value: property.yearBuilt
        });
    }
    
    specs.push({
        icon: 'bi-tag',
        label: 'Property Type',
        value: Utils.getPropertyTypeLabel(property.propertyType)
    });
    
    container.innerHTML = specs.map(spec => `
        <div class="col-6 col-md-4">
            <div class="spec-item">
                <i class="bi ${spec.icon}"></i>
                <div>
                    <div class="spec-label">${spec.label}</div>
                    <div class="spec-value">${spec.value}</div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Display property features
 */
function displayFeatures(features) {
    const container = document.getElementById('property-features');
    const card = document.getElementById('features-card');
    
    if (!features || features.length === 0) {
        card.classList.add('d-none');
        return;
    }
    
    // Parse features if it's a string
    let featureList = features;
    if (typeof features === 'string') {
        try {
            featureList = JSON.parse(features);
        } catch (e) {
            featureList = [features];
        }
    }
    
    container.innerHTML = featureList.map(feature => `
        <span class="feature-badge">
            <i class="bi bi-check-circle"></i>${feature}
        </span>
    `).join('');
}

/**
 * Setup viewing request form
 */
function setupViewingForm() {
    const form = document.getElementById('viewing-form');
    const submitBtn = document.getElementById('submit-btn');
    const successMessage = document.getElementById('success-message');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate form
        const name = document.getElementById('customer-name').value.trim();
        const email = document.getElementById('customer-email').value.trim();
        const phone = document.getElementById('customer-phone').value.trim();
        const message = document.getElementById('customer-message').value.trim();
        
        if (!name || !email || !phone) {
            Utils.showToast('Please fill in all required fields.', 'error');
            return;
        }
        
        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
        
        try {
            const response = await API.submitViewingRequest({
                propertyId: parseInt(propertyId),
                customerName: name,
                customerEmail: email,
                customerPhone: phone,
                customerMessage: message
            });
            
            // Show success
            form.classList.add('d-none');
            successMessage.classList.remove('d-none');
            
        } catch (error) {
            console.error('Error submitting viewing request:', error);
            Utils.showToast(error.message || 'Failed to submit request. Please try again.', 'error');
            
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-send me-2"></i>Request Viewing';
        }
    });
}

/**
 * Show error state
 */
function showError() {
    document.getElementById('loading-state').classList.add('d-none');
    document.getElementById('error-state').classList.remove('d-none');
    document.getElementById('property-title').textContent = 'Property Not Found';
}
