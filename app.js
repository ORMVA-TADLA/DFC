// app.js - Data Collector Application
// Main application logic for capturing and managing field data entries with photos and GPS

/* ============================================================================
   GLOBAL VARIABLES & DOM REFERENCES
   ============================================================================ */

// UI Element References
const ui = {
    loadingIndicator: document.getElementById('loading-indicator'),
    categorySelect: document.getElementById('category'),
    statusSelect: document.getElementById('status'),
    descriptionTextarea: document.getElementById('description'),
    getLocationBtn: document.getElementById('get-location-btn'),
    photoInput: document.getElementById('photo-input'),
    saveEntryBtn: document.getElementById('save-entry-btn'),
    viewEntriesBtn: document.getElementById('view-entries-btn'),
    backToFormBtn: document.getElementById('new-entry-btn'),
    photoCount: document.getElementById('photo-count'),
    photoPreview: document.getElementById('photo-preview'),
    previewCount: document.getElementById('preview-count'),
    previewSize: document.getElementById('preview-size'),
    previewGrid: document.getElementById('preview-grid'),
    formView: document.getElementById('form-view'),
    listView: document.getElementById('list-view'),
    entriesList: document.getElementById('entries-list'),
    emptyState: document.getElementById('empty-state'),
    entryCount: document.getElementById('entry-count'),
    totalEntries: document.getElementById('total-entries'),
    storageInfo: document.getElementById('storage-info'),
    storageText: document.getElementById('storage-text'),
    storageProgress: document.getElementById('storage-progress')
};

// Application State
let formData = {
    category: '',
    status: '',
    description: '',
    location: null,
    photos: []
};

let entries = []; // In-memory cache of all entries

// Configuration Constants
const CONFIG = {
    GPS_TIMEOUT: 3000, // GPS timeout in milliseconds
    MAX_PHOTO_SIZE: 10 * 1024 * 1024, // 10MB per photo
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    LOG_PREFIX: '[DataCollector]'
};

/* ============================================================================
   LOGGING UTILITIES
   ============================================================================ */

/**
 * Centralized logging utility with consistent formatting
 */
const logger = {
    /**
     * Log informational messages
     */
    info: (message, data = null) => {
        console.log(`${CONFIG.LOG_PREFIX} ℹ️ ${message}`, data || '');
    },

    /**
     * Log success messages
     */
    success: (message, data = null) => {
        console.log(`${CONFIG.LOG_PREFIX} ✅ ${message}`, data || '');
    },

    /**
     * Log warning messages
     */
    warn: (message, data = null) => {
        console.warn(`${CONFIG.LOG_PREFIX} ⚠️ ${message}`, data || '');
    },

    /**
     * Log error messages with stack trace
     */
    error: (message, error = null) => {
        console.error(`${CONFIG.LOG_PREFIX} ❌ ${message}`, error || '');
        if (error && error.stack) {
            console.error('Stack trace:', error.stack);
        }
    },

    /**
     * Log debug information (can be disabled in production)
     */
    debug: (message, data = null) => {
        // if (process.env.NODE_ENV !== 'production') {
        //     console.debug(`${CONFIG.LOG_PREFIX} 🔍 ${message}`, data || '');
        // }
        console.debug(`${CONFIG.LOG_PREFIX} 🔍 ${message}`, data || '');
    }
};

/* ============================================================================
   INITIALIZATION
   ============================================================================ */

/**
 * Initialize the application when DOM is ready
 */
function initializeApp() {
    logger.info('Application initializing...');

    try {
        setupEventListeners();
        loadEntriesOnStartup();
        updateStorageInfo();
        checkBrowserCapabilities();

        logger.success('Application initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize application', error);
        alert('Application failed to start. Please refresh the page.');
    }
}

/**
 * Check browser capabilities and warn user if features are unavailable
 */
function checkBrowserCapabilities() {
    logger.info('Checking browser capabilities...');

    const capabilities = {
        persistentStorage: 'persist' in navigator.storage,
        geolocation: 'geolocation' in navigator,
        fileReader: typeof FileReader !== 'undefined',
        indexedDB: typeof indexedDB !== 'undefined',
        webShare: typeof navigator.share !== 'undefined'
    };

    logger.debug('Browser capabilities:', capabilities);

    if (!capabilities.persistentStorage) {
        logger.warn('Persistent storage not supported');
    }
    if (!capabilities.geolocation) {
        logger.warn('Geolocation API not supported');
    }
    if (!capabilities.indexedDB) {
        logger.error('IndexedDB not supported - data persistence will fail');
        alert('Your browser does not support local data storage. The app may not work correctly.');
    }
    if (!capabilities.webShare) {
        logger.info('Web Share API not available - will use fallback sharing');
    }
    if (!capabilities.fileReader) {
        logger.warn('FileReader API not supported');
    }
}

/* ============================================================================
   EVENT LISTENERS SETUP
   ============================================================================ */

/**
 * Setup all event listeners for the application
 */
function setupEventListeners() {
    logger.info('Setting up event listeners...');

    // Location capture
    ui.getLocationBtn.addEventListener('click', handleLocationCapture);

    // Photo handling
    ui.photoInput.addEventListener('change', handlePhotoCapture);

    // Entry management
    ui.saveEntryBtn.addEventListener('click', handleSaveEntry);
    ui.viewEntriesBtn.addEventListener('click', handleViewEntries);
    ui.backToFormBtn.addEventListener('click', handleBackToForm);

    // Form field updates
    ui.categorySelect.addEventListener('change', (e) => {
        formData.category = e.target.value;
        logger.debug('Category selected:', e.target.value);
    });

    ui.statusSelect.addEventListener('change', (e) => {
        formData.status = e.target.value;
        logger.debug('Status selected:', e.target.value);
    });

    ui.descriptionTextarea.addEventListener('input', (e) => {
        formData.description = e.target.value;
        logger.debug('Description updated, length:', e.target.value.length);
    });

    logger.success('Event listeners configured');
}

/* ============================================================================
   UI STATE MANAGEMENT
   ============================================================================ */

/**
 * Show loading indicator with optional message
 */
function showLoading(message = 'Loading...') {
    logger.debug('Showing loading indicator:', message);
    ui.loadingIndicator.style.display = 'block';
    ui.loadingIndicator.setAttribute('aria-label', message);
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    logger.debug('Hiding loading indicator');
    ui.loadingIndicator.style.display = 'none';
}

/**
 * Switch to entries list view
 */
function handleViewEntries() {
    logger.info('Switching to list view');
    ui.formView.style.display = 'none';
    ui.listView.style.display = 'block';
    renderEntriesList();
}

/**
 * Switch back to form view
 */
function handleBackToForm() {
    logger.info('Switching to form view');
    ui.listView.style.display = 'none';
    ui.formView.style.display = 'block';
}

/* ============================================================================
   GEOLOCATION HANDLING
   ============================================================================ */

/**
 * Capture GPS location with high accuracy
 */
function handleLocationCapture() {
    logger.info('Requesting GPS location...');

    if (!('geolocation' in navigator)) {
        logger.error('Geolocation not supported');
        alert('Location services are not supported by your browser');
        return;
    }

    showLoading('Capturing location...');

    const options = {
        enableHighAccuracy: true,
        timeout: CONFIG.GPS_TIMEOUT,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (position) => handleLocationSuccess(position),
        (error) => handleLocationError(error),
        options
    );
}

/**
 * Handle successful location capture
 */
function handleLocationSuccess(position) {
    const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
    };

    formData.location = location;

    logger.success('Location captured successfully', {
        latitude: location.lat,
        longitude: location.lng,
        accuracy: `±${location.accuracy}m`
    });

    hideLoading();
    alert(`Location captured!\nAccuracy: ±${location.accuracy.toFixed(0)}m`);
}

/**
 * Handle location capture errors
 */
function handleLocationError(error) {
    logger.error('Location capture failed', error);

    const errorMessages = {
        1: 'Location permission denied. Please enable location access.',
        2: 'Location unavailable. Please check your device settings.',
        3: 'Location request timed out. Please try again.'
    };

    const message = errorMessages[error.code] || `Location error: ${error.message}`;

    hideLoading();
    alert(message);
}

/* ============================================================================
   PHOTO HANDLING
   ============================================================================ */

/**
 * Handle photo file selection and processing
 */
async function handlePhotoCapture(e) {
    const files = Array.from(e.target.files);

    if (files.length === 0) {
        logger.debug('No files selected');
        return;
    }

    logger.info(`Processing ${files.length} photo(s)...`);
    showLoading('Processing photos...');

    try {
        // Validate files
        const validFiles = validatePhotoFiles(files);

        if (validFiles.length === 0) {
            throw new Error('No valid image files selected');
        }

        // Convert files to base64
        const photoPromises = validFiles.map(file => convertPhotoToBase64(file));
        const photos = await Promise.all(photoPromises);

        // Add to form data
        formData.photos = [...formData.photos, ...photos];

        logger.success(`Successfully processed ${photos.length} photo(s)`, {
            totalPhotos: formData.photos.length,
            totalSize: formatBytes(photos.reduce((sum, p) => sum + p.size, 0))
        });

        updatePhotoPreview();
        hideLoading();

    } catch (error) {
        logger.error('Photo processing failed', error);
        hideLoading();
        alert(`Error processing photos: ${error.message}`);
    }

    // Reset input to allow selecting the same file again
    e.target.value = '';
}

/**
 * Validate photo files before processing
 */
function validatePhotoFiles(files) {
    logger.debug('Validating photo files...');

    const validFiles = files.filter(file => {
        // Check file type
        if (!CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
            logger.warn(`Unsupported file type: ${file.type} for ${file.name}`);
            return false;
        }

        // Check file size
        if (file.size > CONFIG.MAX_PHOTO_SIZE) {
            logger.warn(`File too large: ${file.name} (${formatBytes(file.size)})`);
            return false;
        }

        return true;
    });

    if (validFiles.length < files.length) {
        alert(`${files.length - validFiles.length} file(s) skipped (unsupported type or too large)`);
    }

    logger.debug(`Validated ${validFiles.length}/${files.length} files`);
    return validFiles;
}

/**
 * Convert photo file to base64 data URL
 */
function convertPhotoToBase64(file) {
    logger.debug(`Converting ${file.name} to base64...`);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const photoData = {
                data: e.target.result,
                name: file.name,
                type: file.type,
                size: file.size,
                timestamp: Date.now()
            };

            logger.debug(`Converted ${file.name} (${formatBytes(file.size)})`);
            resolve(photoData);
        };

        reader.onerror = (error) => {
            logger.error(`Failed to read ${file.name}`, error);
            reject(new Error(`Failed to read file: ${file.name}`));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Update photo preview display
 */
function updatePhotoPreview() {
    const photoCount = formData.photos.length;

    logger.debug(`Updating photo preview: ${photoCount} photo(s)`);

    ui.photoCount.textContent = photoCount;

    if (photoCount === 0) {
        ui.photoPreview.style.display = 'none';
        return;
    }

    // Show preview container
    ui.photoPreview.style.display = 'block';
    ui.previewCount.textContent = photoCount;

    // Calculate total size
    const totalSize = formData.photos.reduce((sum, p) => sum + p.size, 0);
    ui.previewSize.textContent = formatBytes(totalSize);

    // Render preview grid
    ui.previewGrid.innerHTML = '';
    formData.photos.forEach((photo, index) => {
        const item = createPhotoPreviewItem(photo, index);
        ui.previewGrid.appendChild(item);
    });

    logger.debug('Photo preview updated', { count: photoCount, totalSize: formatBytes(totalSize) });
}

/**
 * Create a single photo preview item
 */
function createPhotoPreviewItem(photo, index) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
        <img src="${photo.data}" alt="Photo ${index + 1}">
        <button class="preview-remove" onclick="removePhoto(${index})" aria-label="Remove photo ${index + 1}">✕</button>
        <div class="preview-size-label">${formatBytes(photo.size)}</div>
    `;
    return item;
}

/**
 * Remove a photo from the preview (exposed globally)
 */
window.removePhoto = function (index) {
    logger.info(`Removing photo at index ${index}`);

    const photo = formData.photos[index];
    if (photo) {
        logger.debug(`Removed: ${photo.name} (${formatBytes(photo.size)})`);
    }

    formData.photos.splice(index, 1);
    updatePhotoPreview();
};

/* ============================================================================
   ENTRY MANAGEMENT
   ============================================================================ */

/**
 * Save current form data as a new entry
 */
async function handleSaveEntry() {
    logger.info('Attempting to save entry...');

    // Validate required fields
    if (!formData.category || !formData.status) {
        logger.warn('Save attempted with missing required fields');
        alert('Please fill in category and status');
        return;
    }

    showLoading('Saving entry...');

    try {
        // Create entry object
        const newEntry = createEntryObject();

        logger.info('Saving entry to IndexedDB', {
            id: newEntry.id,
            category: newEntry.category,
            status: newEntry.status,
            hasLocation: !!newEntry.location,
            photoCount: newEntry.photos.length
        });

        // Save to database
        await saveToIndexedDB(newEntry);

        // Reload entries
        await loadEntriesOnStartup();

        // Update storage info
        await updateStorageInfo();

        // Reset form
        resetForm();

        logger.success('Entry saved successfully', { id: newEntry.id });
        hideLoading();
        alert('Entry saved successfully!');

    } catch (error) {
        logger.error('Failed to save entry', error);
        hideLoading();
        alert(`Error saving entry: ${error.message}`);
    }
}

/**
 * Create entry object from current form data
 */
function createEntryObject() {
    const entry = {
        id: Date.now(),
        category: formData.category,
        status: formData.status,
        description: formData.description,
        location: formData.location,
        photos: formData.photos,
        timestamp: new Date().toISOString()
    };

    logger.debug('Created entry object', {
        id: entry.id,
        descriptionLength: entry.description.length,
        photoCount: entry.photos.length,
        hasLocation: !!entry.location
    });

    return entry;
}

/**
 * Reset form to initial state
 */
function resetForm() {
    logger.debug('Resetting form...');

    formData = {
        category: '',
        status: '',
        description: '',
        location: null,
        photos: []
    };

    ui.categorySelect.value = '';
    ui.statusSelect.value = '';
    ui.descriptionTextarea.value = '';
    ui.photoCount.textContent = '0';
    ui.photoPreview.style.display = 'none';

    logger.debug('Form reset complete');
}

/**
 * Load all entries from database on startup
 */
async function loadEntriesOnStartup() {
    logger.info('Loading entries from database...');

    try {
        entries = await getAllFromIndexedDB();

        logger.success(`Loaded ${entries.length} entries from database`);

        ui.entryCount.textContent = entries.length;

    } catch (error) {
        logger.error('Failed to load entries', error);
        alert('Error loading data from database');
        entries = [];
    }
}

/**
 * Delete an entry (exposed globally)
 */
window.deleteEntry = async function (id) {
    logger.info(`Delete requested for entry ${id}`);

    if (!confirm('Delete this entry? This cannot be undone.')) {
        logger.debug('Delete cancelled by user');
        return;
    }

    showLoading('Deleting entry...');

    try {
        await deleteFromIndexedDB(id);
        await loadEntriesOnStartup();
        renderEntriesList();
        await updateStorageInfo();

        logger.success(`Entry ${id} deleted successfully`);
        hideLoading();

    } catch (error) {
        logger.error(`Failed to delete entry ${id}`, error);
        hideLoading();
        alert(`Error deleting entry: ${error.message}`);
    }
};

/* ============================================================================
   STORAGE INFORMATION
   ============================================================================ */

/**
 * Update storage usage information display
 */
async function updateStorageInfo() {
    logger.debug('Updating storage information...');

    try {
        const estimate = await getStorageEstimate();

        if (!estimate) {
            logger.warn('Storage estimate not available');
            return;
        }

        const used = (estimate.usage / (1024 * 1024)).toFixed(2);
        const quota = (estimate.quota / (1024 * 1024)).toFixed(2);
        const percentage = Number(((estimate.usage / estimate.quota) * 100).toFixed(1));
        logger.debug('Storage estimate retrieved', { used: `${used}MB`, quota: `${quota}MB`, percentage: `${percentage}%` });

        ui.storageText.textContent = `Using ${used} MB of ${quota} MB (${percentage}%)`;
        ui.storageProgress.style.width = `${Math.min(percentage, 100)}%`;
        // Calculate red and green values (0% = green, 100% = red)
        const red = Math.round(255 * percentage / 100);
        const green = Math.round(255 * (100 - percentage) / 100);
        ui.storageInfo.style.backgroundColor = `rgba(${red}, ${green}, 0, 0.3)`;
        ui.storageProgress.style.backgroundColor = `rgba(${red}, ${green}, 0, 0.6)`;

        logger.debug('Storage info updated', { used: `${used}MB`, quota: `${quota}MB`, percentage: `${percentage}%` });

    } catch (error) {
        logger.error('Failed to update storage info', error);
    }
}

/* ============================================================================
   ENTRIES LIST RENDERING
   ============================================================================ */

/**
 * Render the list of all entries
 */
function renderEntriesList() {
    logger.info(`Rendering ${entries.length} entries...`);

    ui.totalEntries.textContent = entries.length;

    if (entries.length === 0) {
        showEmptyState();
        return;
    }

    ui.emptyState.style.display = 'none';
    ui.entriesList.innerHTML = '';

    entries.forEach((entry, index) => {
        const card = createEntryCard(entry);
        ui.entriesList.appendChild(card);

        if (index < 3) {
            logger.debug(`Rendered entry ${entry.id}`, {
                category: entry.category,
                status: entry.status,
                photoCount: entry.photos?.length || 0
            });
        }
    });

    if (entries.length > 3) {
        logger.debug(`... and ${entries.length - 3} more entries`);
    }

    logger.success('Entries list rendered successfully');
}

/**
 * Show empty state message
 */
function showEmptyState() {
    logger.debug('Showing empty state');
    ui.entriesList.innerHTML = '';
    ui.emptyState.style.display = 'block';
}

/**
 * Create an entry card element
 */
function createEntryCard(entry) {
    const card = document.createElement('div');
    card.className = 'entry-card';

    let html = createEntryHeader(entry);

    if (entry.description) {
        html += createEntryDescription(entry.description);
    }

    if (entry.location) {
        html += createEntryLocation(entry.location);
    }

    if (entry.photos && entry.photos.length > 0) {
        html += createEntryPhotos(entry.photos);
    }

    html += createEntryFooter(entry);

    card.innerHTML = html;
    return card;
}

/**
 * Create entry header HTML
 */
function createEntryHeader(entry) {
    return `
        <div class="entry-header">
            <div class="entry-badges">
                <span class="badge badge-blue">${escapeHtml(entry.category)}</span>
                <span class="badge badge-green">${escapeHtml(entry.status)}</span>
            </div>
            <div class="entry-actions">
                <button class="btn btn-share" onclick="shareEntry(${entry.id})" title="Share entry" aria-label="Share entry">
                    <span class="icon">🔗</span>
                </button>
                <button class="btn btn-delete" onclick="deleteEntry(${entry.id})" title="Delete entry" aria-label="Delete entry">
                    <span class="icon">🗑️</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Create entry description HTML
 */
function createEntryDescription(description) {
    return `
        <div class="entry-description">${escapeHtml(description)}</div>
    `;
}

/**
 * Create entry location HTML
 */
function createEntryLocation(location) {
    return `
        <div class="entry-location">
            <div class="location-icon">📍</div>
            <div>
                <div class="location-title">Location Captured</div>
                <div class="location-coords">${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</div>
                <div class="location-accuracy">Accuracy: ±${location.accuracy.toFixed(0)}m</div>
            </div>
        </div>
    `;
}

/**
 * Create entry photos HTML
 */
function createEntryPhotos(photos) {
    const totalSize = photos.reduce((sum, p) => sum + p.size, 0);

    let html = `
        <div class="entry-photos">
            <div class="photos-header">
                <span class="icon">📷</span>
                <span>${photos.length} Photo${photos.length > 1 ? 's' : ''}</span>
                <span class="photos-size">(${formatBytes(totalSize)})</span>
            </div>
            <div class="photos-grid">
    `;

    photos.forEach((photo, i) => {
        html += `
            <div class="photo-item">
                <img src="${photo.data}" alt="Photo ${i + 1}">
                <div class="photo-size">${formatBytes(photo.size)}</div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Create entry footer HTML
 */
function createEntryFooter(entry) {
    return `
        <div class="entry-footer">
            <span class="entry-id">ID: ${entry.id}</span>
            <span class="entry-timestamp">${new Date(entry.timestamp).toLocaleString()}</span>
        </div>
    `;
}

/* ============================================================================
   SHARING FUNCTIONALITY
   ============================================================================ */

/**
 * Share an entry (exposed globally)
 */
window.shareEntry = async function (id) {
    logger.info(`Share requested for entry ${id}`);

    const entry = entries.find(e => e.id === id);
    if (!entry) {
        logger.error(`Entry ${id} not found`);
        return;
    }

    try {
        const shareText = createShareText(entry);

        // Try Web Share API with files
        if (entry.photos && entry.photos.length > 0) {
            const shared = await tryShareWithPhotos(entry, shareText);
            if (shared) return;
        }

        // Try Web Share API without files
        const sharedText = await tryShareTextOnly(entry, shareText);
        if (sharedText) return;

        // Fallback to WhatsApp
        shareViaWhatsApp(shareText);

    } catch (error) {
        logger.error('Sharing failed', error);
    }
};

/**
 * Create formatted share text
 */
function createShareText(entry) {
    const locationText = entry.location
        ? `📍 Location: ${entry.location.lat.toFixed(6)}, ${entry.location.lng.toFixed(6)}\n🎯 Accuracy: ${entry.location.accuracy.toFixed(0)}m\n🗺️ Google Maps: https://maps.google.com/?q=${entry.location.lat},${entry.location.lng}`
        : '📍 Location: Not captured';

    const photoInfo = entry.photos && entry.photos.length > 0
        ? `📸 Photos: ${entry.photos.length} attached (${formatBytes(entry.photos.reduce((sum, p) => sum + p.size, 0))} total)`
        : '📸 Photos: None';

    return `
━━━━━━━━━━━━━━━━━━━━
📋 DATA ENTRY REPORT
━━━━━━━━━━━━━━━━━━━━

📂 Category: ${entry.category}
✅ Status: ${entry.status}

📝 Description:
${entry.description || 'No description provided'}

${locationText}

${photoInfo}

⏰ Timestamp: ${new Date(entry.timestamp).toLocaleString()}

━━━━━━━━━━━━━━━━━━━━
Generated by Data Collector App
    `.trim();
}

/**
 * Try sharing with photos using Web Share API
 */
async function tryShareWithPhotos(entry, text) {
    if (!navigator.share) return false;

    logger.debug('Attempting to share with photos...');

    try {
        const files = await convertPhotosToFiles(entry.photos);

        if (navigator.canShare && navigator.canShare({ files })) {
            await navigator.share({
                title: `Data Entry - ${entry.category}`,
                text: text,
                files: files
            });
            logger.success('Shared with photos successfully');
            return true;
        } else {
            logger.warn('Cannot share files, trying text only');
            return false;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.debug('Share cancelled by user');
            return true; // User cancelled, don't try other methods
        }
        logger.warn('Share with photos failed', error);
        return false;
    }
}

/**
 * Try sharing text only using Web Share API
 */
async function tryShareTextOnly(entry, text) {
    if (!navigator.share) return false;

    logger.debug('Attempting to share text only...');

    try {
        await navigator.share({
            title: `Data Entry - ${entry.category}`,
            text: text
        });
        logger.success('Shared text successfully');

        if (entry.photos && entry.photos.length > 0) {
            alert('Photos could not be shared. Only text was shared. You may need to attach photos manually.');
        }

        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.debug('Share cancelled by user');
            return true;
        }
        logger.warn('Share text failed', error);
        return false;
    }
}

/**
 * Convert photo data URLs to File objects
 */
async function convertPhotosToFiles(photos) {
    logger.debug(`Converting ${photos.length} photos to files...`);

    return await Promise.all(
        photos.map(async (photo, index) => {
            const response = await fetch(photo.data);
            const blob = await response.blob();
            return new File([blob], photo.name || `photo-${index + 1}.jpg`, {
                type: photo.type || 'image/jpeg'
            });
        })
    );
}

/**
 * Share via WhatsApp as fallback
 */
function shareViaWhatsApp(text) {
    logger.info('Using WhatsApp fallback for sharing');
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
}

/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 KB';
    return (bytes / 1024).toFixed(1) + ' KB';
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ============================================================================
   APPLICATION START
   ============================================================================ */

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

logger.info('App script loaded, waiting for DOM...');
